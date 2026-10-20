import { InstanceBase, Regex, InstanceStatus } from '@companion-module/base'
import { FocusriteClient, isSupportedDevice, SUPPORTED_DEVICE_CLASSES } from './focusrite-client.js'
import { discoverPort, DEFAULT_PORT } from './port-discovery.js'
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

		// Lifecycle flags, checked by the long-running port scan so it gives up
		// promptly when the instance is torn down or reconfigured underneath it.
		this.destroyed = false
		this.rediscovering = false
		this.connectFailures = 0

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
		// Empty until a device arrives, since presets follow what it reports.
		this.updatePresets()

		// Connect to Focusrite Control Server
		await this.connectToServer()
	}

	/**
	 * Work out which port FocusriteControlServer is on.
	 *
	 * The server takes an OS-assigned port from the ephemeral range rather than
	 * binding a fixed one, and that port changes when the service restarts, so
	 * unless the user has pinned a port we go and find it. The last port that
	 * worked is tried first, which makes the common case a single probe.
	 *
	 * @returns {Promise<number>}
	 */
	async resolveServerPort() {
		const host = this.config.host || '127.0.0.1'
		const configuredPort = Number(this.config.port) || DEFAULT_PORT

		// Only an explicit opt-out disables discovery, so installs upgraded from
		// a version without the setting get it on.
		if (this.config.autoDiscoverPort === false) {
			return configuredPort
		}

		this.updateStatus(InstanceStatus.Connecting, 'Locating FocusriteControlServer...')

		const preferredPorts = [this.config.discoveredPort, configuredPort].filter((port) => Number(port) > 0)

		const found = await discoverPort({
			host,
			preferredPorts,
			log: (message) => this.log('debug', message),
			isCancelled: () => this.destroyed,
		})

		if (found === null) {
			this.log(
				'warn',
				`Could not find FocusriteControlServer on ${host}. Falling back to port ${configuredPort}. ` +
					`Check that Focusrite Control is installed and its Control Server service is running.`,
			)
			return configuredPort
		}

		if (Number(this.config.discoveredPort) !== found) {
			this.log('info', `FocusriteControlServer found on ${host}:${found}`)
			this.config.discoveredPort = found
			this.saveConfig(this.config)
		}

		return found
	}

	async connectToServer() {
		this.updateStatus(InstanceStatus.Connecting)

		const host = this.config.host || '127.0.0.1'
		const port = await this.resolveServerPort()
		if (this.destroyed) return

		this.activePort = port

		this.client = new FocusriteClient({
			host,
			port,
			clientName: 'Companion-Focusrite',
			clientId: this.config.clientId,
		})

		this.client.on('connected', () => {
			this.log('info', 'Connected to FocusriteControlServer')
			this.updateStatus(InstanceStatus.Connecting, 'Waiting for approval...')
		})

		this.client.on('approved', () => {
			this.log('info', 'Client approved by Focusrite Control')
			this.connectFailures = 0
			this.updateStatus(InstanceStatus.Ok)
		})

		this.client.on('approval-required', (hostname) => {
			// The socket is up, so this is not a connection problem. Commands are
			// accepted by the socket and then discarded by the server, which looks
			// like nothing happening at all unless we say so here.
			this.log(
				'error',
				`Focusrite Control has not approved this client, so every command will be ignored. ` +
					`Open Focusrite Control and approve "${hostname}".`,
			)
			this.updateStatus(InstanceStatus.InsufficientPermissions, `"${hostname}" not approved in Focusrite Control`)
		})

		this.client.on('disconnected', () => {
			this.log('warn', 'Disconnected from FocusriteControlServer')
			this.updateStatus(InstanceStatus.Disconnected)
		})

		this.client.on('error', (err) => {
			this.log('error', `Connection error: ${err.message}`)
			this.connectFailures++
			// A server restart lands on a different port, so a port that has
			// stopped answering is reason to go looking again rather than retry
			// the old one forever.
			if (this.connectFailures >= 3) {
				void this.rediscoverServer()
			}
		})

		this.client.on('debug', (msg) => {
			this.log('debug', msg)
		})

		this.client.on('device-renamed', (device) => {
			if (device.id === this.deviceId) {
				this.deviceInfo = device
				this.updateVariableValues()
			}
		})

		this.client.on('device-arrived', (device) => {
			this.log(
				'info',
				`Device arrived: ${device.model || 'unknown model'} (class ${device.deviceClass || 'unknown'}, ` +
					`serial ${device.serial || 'unknown'})`,
			)

			if (this.shouldUseDevice(device)) {
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
				this.updatePresets()
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

	/**
	 * Decide whether an arriving device should become the one we control.
	 *
	 * Takes the first supported device and keeps it, rather than letting a later
	 * arrival silently steal the connection.
	 *
	 * @param {object} device
	 * @returns {boolean}
	 */
	shouldUseDevice(device) {
		if (!isSupportedDevice(device)) {
			this.log(
				'debug',
				`Ignoring device ${device.model || device.id}: class "${device.deviceClass}" is not one of ` +
					SUPPORTED_DEVICE_CLASSES.join(', '),
			)
			return false
		}

		// Already bound to something supported, so leave it alone.
		return this.deviceId === null || this.deviceId === device.id
	}

	/**
	 * Re-run port discovery after the current port stopped answering.
	 *
	 * Guarded so overlapping connection errors cannot start several scans.
	 */
	async rediscoverServer() {
		if (this.destroyed || this.rediscovering) return
		if (this.config.autoDiscoverPort === false) return

		this.rediscovering = true
		this.connectFailures = 0

		try {
			this.log('info', `Port ${this.activePort} stopped responding, searching for FocusriteControlServer again`)

			// Forget the cached port so the scan cannot settle on the dead one.
			if (this.config.discoveredPort) {
				this.config.discoveredPort = null
				this.saveConfig(this.config)
			}

			if (this.client) {
				this.client.disconnect()
				this.client = null
			}

			await this.connectToServer()
		} catch (err) {
			this.log('error', `Re-discovery failed: ${err.message}`)
		} finally {
			this.rediscovering = false
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

		// Toggling STEREO in Focusrite Control changes how an output pair is
		// listed, "Line Outputs 3-4" versus the two channels on their own, so
		// rebuild the definitions that list them.
		if ((this.outputs || []).some((output) => output.stereo === itemId)) {
			this.updateActions()
			this.updateFeedbacks()
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
			// Prefer the nickname the user set in Focusrite Control, falling back
			// to the model, since the server sends no name attribute of its own.
			values['device_name'] = this.deviceInfo.nickname || this.deviceInfo.model || 'Unknown'
			values['device_model'] = this.deviceInfo.model
			values['device_class'] = this.deviceInfo.deviceClass
			values['device_serial'] = this.deviceInfo.serial
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
					'This module connects to the FocusriteControlServer to control your Focusrite interface. ' +
					'Supported device families: ' +
					SUPPORTED_DEVICE_CLASSES.join(', ') +
					'. Make sure Focusrite Control is installed (but does not need to be running).',
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
				type: 'checkbox',
				id: 'autoDiscoverPort',
				label: 'Auto-detect port',
				width: 4,
				default: true,
			},
			{
				type: 'static-text',
				id: 'portInfo',
				width: 12,
				label: '',
				value:
					'FocusriteControlServer does not use a fixed port. It takes one from the ephemeral range ' +
					'(starting at ' +
					DEFAULT_PORT +
					') and picks a different one each time the service restarts, so leave auto-detect on unless ' +
					'you have a reason to pin it. The port below is used as the starting guess when auto-detect ' +
					'is on, and used as-is when it is off.',
			},
			{
				type: 'number',
				id: 'port',
				label: 'Server Port',
				width: 4,
				default: DEFAULT_PORT,
				min: 1,
				max: 65535,
			},
		]
	}

	async configUpdated(config) {
		const hostChanged = this.config.host !== config.host
		const portChanged = this.config.port !== config.port
		const discoveryChanged = this.config.autoDiscoverPort !== config.autoDiscoverPort

		this.config = config

		if (hostChanged || portChanged || discoveryChanged) {
			// A new host or an explicitly pinned port makes the cached port stale.
			this.config.discoveredPort = null
			this.connectFailures = 0
			if (this.client) {
				this.client.disconnect()
				this.client = null
			}
			await this.connectToServer()
		}
	}

	async destroy() {
		// Stops an in-flight port scan from continuing past teardown.
		this.destroyed = true
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

	/**
	 * Rebuild the preset palette from the connected device.
	 *
	 * Called once at startup, when nothing is known and the palette is empty,
	 * and again whenever a device arrives and its structure has been parsed.
	 */
	updatePresets() {
		const { structure, presets } = getPresets(this)
		this.setPresetDefinitions(structure, presets)
	}

	updateVariableDefinitions() {
		updateVariables(this)
	}
}

export const UpgradeScripts = []
