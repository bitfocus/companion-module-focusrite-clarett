import { InstanceBase, Regex, InstanceStatus } from '@companion-module/base'
import { FocusriteClient } from './focusrite-client.js'
import { updateActions } from './actions.js'
import { updateFeedbacks } from './feedbacks.js'
import { updateVariables } from './variables.js'
import { getPresets } from './presets.js'

export default class FocusriteClarettInstance extends InstanceBase {
	constructor(internal) {
		super(internal)
	}

	async init(config) {
		this.config = config
		this.client = null

		// Persist a stable client ID so Focusrite Control doesn't ask for re-approval on every restart
		if (!this.config.clientId) {
			const hex = () => Math.floor(Math.random() * 16).toString(16)
			const section = (len) => Array(len).fill(0).map(hex).join('')
			this.config.clientId = `${section(8)}-${section(4)}-${section(4)}-${section(4)}-${section(12)}`
			this.saveConfig(this.config)
		}

		// State storage
		this.deviceId = null
		this.deviceInfo = null
		this.items = new Map()
		this.mixerInputs = []
		this.outputs = []
		this.hardwareInputs = []
		this.mixes = []
		this.inputSourceControls = []
		this.monitoring = {}

		// Initialize actions, feedbacks, variables
		this.updateActions()
		this.updateFeedbacks()
		this.updateVariableDefinitions()
		const { structure: presetStructure, presets: presetDefs } = getPresets()
		this.setPresetDefinitions(presetStructure, presetDefs)

		// Connect to Focusrite Control Server
		await this.connectToServer()
	}

	async connectToServer() {
		this.updateStatus(InstanceStatus.Connecting)

		this.client = new FocusriteClient({
			host: this.config.host || '127.0.0.1',
			port: this.config.port || 49152,
			clientName: 'Companion-Focusrite',
			clientId: this.config.clientId,
		})

		this.client.on('connected', () => {
			this.log('info', 'Connected to FocusriteControlServer')
			this.updateStatus(InstanceStatus.Connecting, 'Waiting for approval...')
		})

		this.client.on('approved', () => {
			this.log('info', 'Client approved by Focusrite Control')
			this.updateStatus(InstanceStatus.Ok)
		})

		this.client.on('disconnected', () => {
			this.log('warn', 'Disconnected from FocusriteControlServer')
			this.updateStatus(InstanceStatus.Disconnected)
		})

		this.client.on('error', (err) => {
			this.log('error', `Connection error: ${err.message}`)
		})

		this.client.on('debug', (msg) => {
			this.log('debug', msg)
		})

		this.client.on('device-arrived', (device) => {
			this.log('info', `Device arrived: ${device.name}`)

			// Use first device or match configured device
			if (!this.deviceId || device.name.includes('Clarett')) {
				this.deviceId = device.id
				this.deviceInfo = device
				this.items = device.items
				this.hardwareInputs = device.hardwareInputs || []
				this.mixes = device.mixes || []
				this.outputs = device.outputs || []
				this.inputSourceControls = device.inputSourceControls || []
				this.monitoring = device.monitoring || {}

				this.log(
					'info',
					`Found ${this.hardwareInputs.length} hardware inputs, ${this.mixes.length} mixes, ${this.outputs.length} outputs`,
				)

				this.parseDeviceStructure()
				this.updateVariableValues()
				this.updateActions()
				this.updateFeedbacks()
				this.checkAllFeedbacks()
			}
		})

		this.client.on('device-removed', (deviceId) => {
			if (deviceId === this.deviceId) {
				this.log('warn', 'Active device removed')
				this.deviceId = null
				this.deviceInfo = null
			}
		})

		this.client.on('value-changed', ({ deviceId, itemId, value }) => {
			if (deviceId === this.deviceId) {
				this.handleValueChange(itemId, value)
			}
		})

		try {
			await this.client.connect()
		} catch (err) {
			this.log('error', `Failed to connect: ${err.message}`)
			this.updateStatus(InstanceStatus.ConnectionFailure, err.message)
		}
	}

	parseDeviceStructure() {
		// Parse additional mixer inputs from items if not already populated
		this.mixerInputs = []

		for (const [itemId, item] of this.items) {
			// Detect mixer inputs (typically have 'mixer' and 'input' in the ID)
			if (itemId.includes('mixer') && itemId.includes('input')) {
				this.mixerInputs.push({ id: itemId, ...item })
			}
		}

		// Log debug info about hardware inputs
		if (this.hardwareInputs.length > 0) {
			for (let i = 0; i < Math.min(4, this.hardwareInputs.length); i++) {
				const hw = this.hardwareInputs[i]
				const modes = hw.modeValues ? hw.modeValues.join('/') : 'none'
				this.log('debug', `  ${hw.name}: air=${hw.air || 'none'}, mode=${modes}`)
			}
		}
	}

	handleValueChange(itemId, value) {
		// Update internal state - create item if it doesn't exist
		if (this.items.has(itemId)) {
			this.items.get(itemId).value = value
		} else {
			this.items.set(itemId, { id: itemId, value: value })
		}

		// Update variables for hardware inputs (air, mode)
		this.updateHardwareInputVariable(itemId, value)

		// Update generic variables
		this.updateVariableValue(itemId, value)

		// Check feedbacks
		this.checkAllFeedbacks()
	}

	updateHardwareInputVariable(itemId, value) {
		// Find which hardware input this control belongs to
		for (let i = 0; i < this.hardwareInputs.length; i++) {
			const hwInput = this.hardwareInputs[i]
			const ch = i + 1

			if (hwInput.air === itemId) {
				this.setVariableValues({ [`input_${ch}_air`]: value })
				return
			}
			if (hwInput.mode === itemId) {
				this.setVariableValues({ [`input_${ch}_mode`]: value })
				return
			}
		}

		// Monitoring controls
		if (this.monitoring?.dim === itemId) {
			this.setVariableValues({ monitor_dim: value })
		}
	}

	updateVariableValue(itemId, value) {
		// Convert item ID to variable-safe name
		const varId = itemId.replace(/[^a-zA-Z0-9]/g, '_')
		this.setVariableValues({ [varId]: value })
	}

	updateVariableValues() {
		const values = {}
		for (const [itemId, item] of this.items) {
			const varId = itemId.replace(/[^a-zA-Z0-9]/g, '_')
			values[varId] = item.value || ''
		}

		if (this.deviceInfo) {
			values['device_name'] = this.deviceInfo.name
			values['device_model'] = this.deviceInfo.model
		}

		if (this.monitoring?.dim) {
			const dimItem = this.items.get(this.monitoring.dim)
			values['monitor_dim'] = dimItem?.value || 'false'
		}

		this.setVariableValues(values)
	}

	// Action: Set a control value
	setValue(itemId, value) {
		this.log('debug', `setValue called: itemId=${itemId} value=${value} deviceId=${this.deviceId}`)
		if (this.client && this.deviceId) {
			// Update local state optimistically since server may not echo back
			if (this.items.has(itemId)) {
				this.items.get(itemId).value = value
			}
			this.client.setValue(this.deviceId, itemId, value)
		} else {
			this.log('warn', `setValue failed: client=${!!this.client} deviceId=${this.deviceId}`)
		}
	}

	// Action: Toggle a boolean value
	toggleValue(itemId) {
		const item = this.items.get(itemId)
		if (!item) {
			// Item not yet in map – assume false, toggle to true
			this.log('debug', `toggleValue: item ${itemId} not in items map, assuming false`)
			this.setValue(itemId, 'true')
			return
		}
		const currentValue = item.value === 'true' || item.value === '1'
		this.setValue(itemId, currentValue ? 'false' : 'true')
	}

	getConfigFields() {
		return [
			{
				type: 'static-text',
				id: 'info',
				width: 12,
				label: 'Information',
				value:
					'This module connects to the FocusriteControlServer to control your Clarett interface. Make sure Focusrite Control is installed (but does not need to be running).',
			},
			{
				type: 'textinput',
				id: 'host',
				label: 'Server Host',
				width: 8,
				default: '127.0.0.1',
				regex: Regex.IP,
			},
			{
				type: 'number',
				id: 'port',
				label: 'Server Port',
				width: 4,
				default: 49152,
				min: 1,
				max: 65535,
			},
		]
	}

	async configUpdated(config) {
		const hostChanged = this.config.host !== config.host
		const portChanged = this.config.port !== config.port

		this.config = config

		if (hostChanged || portChanged) {
			if (this.client) {
				this.client.disconnect()
			}
			await this.connectToServer()
		}
	}

	async destroy() {
		if (this.client) {
			this.client.disconnect()
			this.client = null
		}
	}

	updateActions() {
		updateActions(this)
	}

	updateFeedbacks() {
		updateFeedbacks(this)
	}

	updateVariableDefinitions() {
		updateVariables(this)
	}
}

export const UpgradeScripts = []
