/**
 * Focusrite Control Server TCP Client
 *
 * @author Linus Wileryd
 * @repository https://github.com/lnswlrd/companion-module-focusrite-clarett
 *
 * Protocol: XML messages with "Length=XXXXXX " prefix (6-digit hex)
 * Port: assigned from the ephemeral range, located at runtime by port-discovery.js
 *
 * ============================================
 * PROTOCOL REVERSE ENGINEERING SOURCES
 * ============================================
 *
 * This implementation is based on protocol analysis from:
 *
 * 1. Focusrite Midi Control by Radu Varga
 *    https://github.com/raduvarga/Focusrite-Midi-Control
 *    - TCP message format: "Length=%06X <xml>" (prefix, not suffix)
 *    - client-key attribute requirement for client-details
 *    - Keep-alive mechanism (3 second interval)
 *    - Device subscription and approval flow
 *
 * 2. Focusrite Control API by Mathieu2301
 *    https://github.com/Mathieu2301/Focusrite-Control-API
 *    - XML <set devid="X"><item id="Y" value="Z"/></set> command structure
 *    - Device discovery via <device-arrival> messages
 *
 * 3. Original protocol discovery via packet capture
 *    of communication between Focusrite Control app
 *    and FocusriteControlServer daemon.
 *
 * The FocusriteControlServer is installed as part of Focusrite Control
 * software and runs as a system daemon on macOS (launchd) and Windows.
 * ============================================
 */

import { EventEmitter } from 'events'
import net from 'net'
import { parseStringPromise } from 'xml2js'

/**
 * Matches the frame header that prefixes every message on the wire:
 * "Length=XXXXXX " where XXXXXX is the payload length in hex.
 *
 * The server replies in lowercase hex even though it accepts uppercase, so the
 * character class has to cover both. Deliberately not a global regex, so it is
 * safe to share between .test() and .match() callers.
 */
export const FRAME_HEADER_REGEX = /^Length=([0-9A-Fa-f]{6}) /

/**
 * Wrap an XML payload in the length-prefixed frame the server expects.
 *
 * @param {string} xml
 * @returns {string}
 */
export function encodeMessage(xml) {
	return `Length=${xml.length.toString(16).toUpperCase().padStart(6, '0')} ${xml}`
}

/**
 * Device classes this module knows how to drive.
 *
 * Clarett and Scarlett expose the same control schema through
 * FocusriteControlServer, so the same item parsing works for both.
 */
export const SUPPORTED_DEVICE_CLASSES = ['Clarett', 'Scarlett']

/**
 * Whether a parsed device looks like something this module can drive.
 *
 * Checks the class attribute first and falls back to the model string, so a
 * device that omits class still matches on a recognisable model name.
 *
 * @param {{ deviceClass?: string, model?: string }} deviceInfo
 * @returns {boolean}
 */
export function isSupportedDevice(deviceInfo) {
	const haystack = `${deviceInfo?.deviceClass || ''} ${deviceInfo?.model || ''}`.toLowerCase()
	return SUPPORTED_DEVICE_CLASSES.some((cls) => haystack.includes(cls.toLowerCase()))
}

export class FocusriteClient extends EventEmitter {
	constructor(options = {}) {
		super()
		this.host = options.host || '127.0.0.1'
		this.port = options.port || 49152
		this.clientId = options.clientId || this.generateClientId()
		this.clientName = options.clientName || 'Companion'

		this.socket = null
		this.connected = false
		this.approved = false
		// Whether the server has told us anything about our own approval yet.
		// Distinguishes "not approved" from "no answer so far".
		this.approvalKnown = false
		// The id the server assigns us in its <client-details> reply. Approval
		// messages are keyed by this, not by hostname.
		this.serverClientId = null
		this.buffer = ''
		this.devices = new Map()
		this.deviceState = new Map()
		this.keepAliveInterval = null
		this.reconnectTimeout = null
		// Set while we are tearing the socket down on purpose, so the close
		// handler does not schedule a reconnect we asked not to happen.
		this.intentionalClose = false

		// Source name map (source ID -> name like "Analogue 1", "Playback 1")
		this.sourceNames = new Map()
	}

	generateClientId() {
		// Generate UUID-like client ID
		const hex = () => Math.floor(Math.random() * 16).toString(16)
		const section = (len) => Array(len).fill(0).map(hex).join('')
		return `${section(8)}-${section(4)}-${section(4)}-${section(4)}-${section(12)}`
	}

	connect() {
		return new Promise((resolve, reject) => {
			if (this.socket) {
				// Drop the old socket's listeners first, otherwise its close
				// event lands on the handlers below and looks like a drop of the
				// connection we are in the middle of opening.
				this.socket.removeAllListeners()
				this.socket.destroy()
			}

			this.intentionalClose = false
			this.socket = new net.Socket()
			this.socket.setEncoding('utf8')

			this.socket.on('connect', () => {
				this.connected = true
				this.emit('connected')
				this.sendClientDetails()
				this.startKeepAlive()
				resolve()
			})

			this.socket.on('data', (data) => {
				this.handleData(data)
			})

			this.socket.on('close', () => {
				this.connected = false
				this.approved = false
				this.approvalKnown = false
				this.serverClientId = null
				this.stopKeepAlive()
				if (this.intentionalClose) return
				this.emit('disconnected')
				this.scheduleReconnect()
			})

			this.socket.on('error', (err) => {
				this.emit('error', err)
				if (!this.connected) {
					reject(err)
				}
			})

			this.socket.connect(this.port, this.host)
		})
	}

	disconnect() {
		this.intentionalClose = true
		this.stopKeepAlive()
		if (this.reconnectTimeout) {
			clearTimeout(this.reconnectTimeout)
			this.reconnectTimeout = null
		}
		if (this.socket) {
			this.socket.removeAllListeners()
			this.socket.destroy()
			this.socket = null
		}
		this.connected = false
		this.approved = false
		this.approvalKnown = false
		this.serverClientId = null
	}

	scheduleReconnect() {
		if (this.intentionalClose) return
		if (this.reconnectTimeout) return
		this.reconnectTimeout = setTimeout(() => {
			this.reconnectTimeout = null
			this.connect().catch(() => {})
		}, 5000)
	}

	startKeepAlive() {
		this.stopKeepAlive()
		this.keepAliveInterval = setInterval(() => {
			this.sendKeepAlive()
		}, 3000)
	}

	stopKeepAlive() {
		if (this.keepAliveInterval) {
			clearInterval(this.keepAliveInterval)
			this.keepAliveInterval = null
		}
	}

	/**
	 * Send XML message with length PREFIX
	 * Format: Length=XXXXXX <xml> (uppercase hex, space before xml)
	 */
	send(xml) {
		if (!this.socket || !this.connected) {
			return false
		}
		this.socket.write(encodeMessage(xml))
		return true
	}

	sendClientDetails() {
		const xml = `<client-details hostname="${this.clientName}" client-key="${this.clientId}"/>`
		this.send(xml)
	}

	sendKeepAlive() {
		this.send('<keep-alive/>')
	}

	/**
	 * Subscribe to a device
	 */
	subscribeDevice(deviceId) {
		const xml = `<device-subscribe devid="${deviceId}"/>`
		this.send(xml)
	}

	/**
	 * Set a control value
	 */
	setValue(deviceId, itemId, value) {
		const xml = `<set devid="${deviceId}"><item id="${itemId}" value="${value}"/></set>`
		this.send(xml)
		this.emit('debug', `SET: device=${deviceId} item=${itemId} value=${value}`)
	}

	/**
	 * Handle incoming data from server
	 * Format: Length=XXXXXX <xml> (Length PREFIX, not suffix)
	 */
	handleData(data) {
		this.buffer += data

		// Parse messages: Length=XXXXXX <xml>
		while (true) {
			// Look for Length= prefix
			const lengthMatch = this.buffer.match(FRAME_HEADER_REGEX)
			if (!lengthMatch) break

			const msgLength = parseInt(lengthMatch[1], 16)
			const headerLength = lengthMatch[0].length // "Length=XXXXXX "

			// Check if we have the full message
			if (this.buffer.length < headerLength + msgLength) break

			// Extract XML
			const xml = this.buffer.substring(headerLength, headerLength + msgLength)
			this.buffer = this.buffer.substring(headerLength + msgLength)

			// Parse message
			this.parseMessage(xml)
		}
	}

	async parseMessage(xml) {
		try {
			// Handle server announcement
			if (xml.startsWith('<server-announcement')) {
				this.emit('debug', 'Received server announcement')
				return
			}

			// The server answers our handshake with the id it will use to refer
			// to us from then on, including in approval messages.
			if (xml.startsWith('<client-details')) {
				this.serverClientId = xml.match(/id="([^"]*)"/)?.[1] ?? null
				this.emit('debug', `Server assigned this client id ${this.serverClientId}`)
				return
			}

			// Handle device arrival
			if (xml.includes('<device-arrival>') || xml.includes('<device ')) {
				await this.parseDeviceArrival(xml)
				return
			}

			// Handle device removal
			if (xml.includes('<device-removal')) {
				const match = xml.match(/id="([^"]+)"/)
				if (match) {
					const deviceId = match[1]
					this.devices.delete(deviceId)
					this.emit('device-removed', deviceId)
				}
				return
			}

			// Handle approval
			if (xml.includes('<approval')) {
				this.handleApproval(xml)
				return
			}

			// Handle value updates
			if (xml.includes('<set ') || xml.includes('<item ')) {
				await this.parseValueUpdate(xml)
				return
			}

			this.emit('debug', `Unknown message: ${xml.substring(0, 100)}...`)
		} catch (err) {
			this.emit('error', err)
		}
	}

	/**
	 * Track our own approval state.
	 *
	 * On connect the server reports the state of every client it knows about, one
	 * <approval> message each, carrying an explicit authorised flag:
	 *
	 *   <approval hostname="Focusrite Midi Control" id="15292012315328466575" type="response" authorised="true"/>
	 *   <approval hostname="Companion-Focusrite"    id="13558620755254330003" type="response" authorised="true"/>
	 *   <approval hostname="Companion-Focusrite"    id="5178171929872993862"  type="response" authorised="false"/>
	 *
	 * Two things matter here. An approval naming somebody else says nothing about
	 * us, and one naming us may be a refusal, so treating any <approval> as our
	 * own approval reports a healthy connection while the server quietly discards
	 * everything we send.
	 *
	 * Less obviously, the hostname does not identify us. As above, several clients
	 * can register the same hostname with different client keys and end up with
	 * different approval states, so matching on hostname picks an arbitrary one of
	 * them. The id the server handed us in its <client-details> reply is the only
	 * reliable identity, so match on that and use the hostname for reporting only.
	 *
	 * Emits 'approved' once we are authorised and 'approval-required' while we are
	 * not, on change only, since this state is repeated on every connect. Until
	 * the server mentions our id at all, approval stays unknown rather than denied,
	 * which is the case for a client key the user has not yet responded to.
	 */
	handleApproval(xml) {
		const hostname = xml.match(/hostname="([^"]*)"/)?.[1] ?? ''
		const id = xml.match(/id="([^"]*)"/)?.[1] ?? ''
		const authorisedAttr = xml.match(/authori[sz]ed="([^"]*)"/i)?.[1]
		const authorised = authorisedAttr === 'true'

		if (!this.serverClientId || id !== this.serverClientId) {
			this.emit('debug', `Approval state for another client "${hostname}" (id ${id}): authorised=${authorised}`)
			return
		}

		const previous = this.approvalKnown ? this.approved : null
		this.approvalKnown = true
		this.approved = authorised

		if (previous === authorised) return

		if (authorised) {
			this.emit('approved')
		} else {
			this.emit('approval-required', hostname)
		}
	}

	async parseDeviceArrival(xml) {
		try {
			const result = await parseStringPromise(xml, { explicitArray: false })

			// Find device element
			let device = result.device || result['device-arrival']?.device
			if (!device) return

			// Handle array of devices
			if (!Array.isArray(device)) {
				device = [device]
			}

			for (const dev of device) {
				const attrs = dev.$ || {}
				const deviceId = attrs.id

				// The server does not send a "name" attribute. Real arrivals look like:
				//   <device id="1" protocol="USB" model="Scarlett 18i20 (2nd Gen)"
				//           class="Scarlett" bus-id="0" serial-number="4485" version="2">
				// The user-facing name lives in the <nickname> item and only arrives
				// later, in a <set> update, so model is the best name we have up front.
				const model = attrs.model || ''
				const deviceClass = attrs.class || ''
				const deviceInfo = {
					id: deviceId,
					name: model || deviceClass || 'Unknown',
					model: model,
					deviceClass: deviceClass,
					protocol: attrs.protocol || '',
					serial: attrs['serial-number'] || attrs.serial || '',
					version: attrs.version || '',
					// Item id carrying the editable device nickname, when present.
					nicknameItem: dev.nickname?.$?.id || null,
					nickname: '',
					items: new Map(),
					hardwareInputs: [],
					mixes: [],
					outputs: [],
					inputSourceControls: [],
					monitoring: {},
				}

				// Parse all items recursively
				this.parseItems(dev, deviceInfo.items, '')

				// Parse hardware inputs (analogue) with Air and Mode controls
				this.parseHardwareInputs(xml, deviceInfo)

				// Build source name map
				this.parseSourceNames(xml)

				// Parse mixer inputs source controls
				this.parseInputSourceControls(xml, deviceInfo)

				// Parse outputs
				this.parseOutputs(xml, deviceInfo)

				// Parse monitoring controls (dim, mute, gain on Out 1-2)
				this.parseMonitoring(xml, deviceInfo)

				// Parse mixes
				this.parseMixes(xml, deviceInfo)

				this.devices.set(deviceId, deviceInfo)
				this.emit('device-arrived', deviceInfo)
				this.emit(
					'debug',
					`Device arrived: ${deviceInfo.model || 'unknown model'} class=${deviceInfo.deviceClass || 'unknown'} ` +
						`serial=${deviceInfo.serial || 'unknown'} (devid ${deviceId}) - ` +
						`${deviceInfo.hardwareInputs.length} inputs, ${deviceInfo.mixes.length} mixes, ${deviceInfo.outputs.length} outputs`,
				)

				// Auto-subscribe to device
				this.subscribeDevice(deviceId)
			}
		} catch (err) {
			this.emit('error', err)
		}
	}

	/**
	 * Parse hardware inputs (analogue) with Air, Mode, Phantom, Pad, HPF, Phase controls
	 */
	parseHardwareInputs(xml, deviceInfo) {
		const analogueRegex = /<analogue([^>]*)>([\s\S]*?)<\/analogue>/g
		let match
		while ((match = analogueRegex.exec(xml)) !== null) {
			const attrs = match[1]
			const content = match[2]

			const idMatch = attrs.match(/id="(\d+)"/)
			const nameMatch = attrs.match(/name="([^"]*)"/)
			if (!idMatch || !nameMatch) continue

			const name = nameMatch[1]
			if (!name || name.trim() === '') continue
			if (name.includes('-') || name.includes('Monitor')) continue

			const input = { id: idMatch[1], name: name }

			// Air control
			const airMatch = content.match(/<air[^>]+id="(\d+)"/)
			if (airMatch) input.air = airMatch[1]

			// Mode control with valid enum values
			const modeMatch = content.match(/<mode[^>]+id="(\d+)"[^>]*>([\s\S]*?)<\/mode>/)
			if (modeMatch) {
				input.mode = modeMatch[1]
				const modeContent = modeMatch[2]
				const enumValues = []
				const enumRegex = /<enum[^>]+value="([^"]+)"/g
				let enumMatch
				while ((enumMatch = enumRegex.exec(modeContent)) !== null) {
					enumValues.push(enumMatch[1])
				}
				input.modeValues = enumValues
			}

			// Phantom power (48V)
			const phantomMatch = content.match(/<phantom[^>]+id="(\d+)"/)
			if (phantomMatch) input.phantom = phantomMatch[1]

			// Pad (-10dB)
			const padMatch = content.match(/<pad[^>]+id="(\d+)"/)
			if (padMatch) input.pad = padMatch[1]

			// High pass filter
			const hpfMatch = content.match(/<highpass[^>]+id="(\d+)"/) || content.match(/<hpf[^>]+id="(\d+)"/)
			if (hpfMatch) input.hpf = hpfMatch[1]

			// Phase invert / polarity
			const phaseMatch = content.match(/<polarity[^>]+id="(\d+)"/) || content.match(/<phase[^>]+id="(\d+)"/)
			if (phaseMatch) input.phase = phaseMatch[1]

			// Gain control
			const gainMatch = content.match(/<gain[^>]+id="(\d+)"/)
			if (gainMatch) input.gain = gainMatch[1]

			// Stereo link
			const stereoMatch = content.match(/<stereolink[^>]+id="(\d+)"/) || content.match(/<stereo[^>]+id="(\d+)"/)
			if (stereoMatch) input.stereo = stereoMatch[1]

			deviceInfo.hardwareInputs.push(input)
		}
	}

	/**
	 * Build source name map from all source types
	 */
	parseSourceNames(xml) {
		this.sourceNames = new Map()

		const extractSources = (tagName) => {
			const regex = new RegExp(`<${tagName}([^>]*)>`, 'g')
			let match
			while ((match = regex.exec(xml)) !== null) {
				const attrs = match[1]
				const idMatch = attrs.match(/id="(\d+)"/)
				const nameMatch = attrs.match(/name="([^"]*)"/)
				if (idMatch && nameMatch && nameMatch[1].trim() !== '') {
					this.sourceNames.set(idMatch[1], nameMatch[1])
				}
			}
		}

		extractSources('analogue')
		extractSources('playback')
		extractSources('spdif')
		extractSources('adat')
		extractSources('loopback')
	}

	/**
	 * Parse mixer input source controls
	 */
	parseInputSourceControls(xml, deviceInfo) {
		const inputsMatch = xml.match(/<inputs>([\s\S]*?)<\/inputs>/)
		if (!inputsMatch) return

		const inputsContent = inputsMatch[1]
		const inputBlockRegex = /<input>([\s\S]*?)<\/input>/g
		let blockMatch
		while ((blockMatch = inputBlockRegex.exec(inputsContent)) !== null) {
			const inputContent = blockMatch[1]
			const sourceMatch = inputContent.match(/<source([^>]*)\/?>|<source([^>]*)>/)
			if (sourceMatch) {
				const attrs = sourceMatch[1] || sourceMatch[2]
				const idMatch = attrs.match(/id="(\d+)"/)
				const valueMatch = attrs.match(/value="(\d+)"/)
				if (idMatch) {
					deviceInfo.inputSourceControls.push({
						id: idMatch[1],
						value: valueMatch ? valueMatch[1] : null,
					})
				}
			}
		}
	}

	/**
	 * Parse outputs with volume/mute controls (scoped to <outputs> section).
	 * Handles analogue, S/PDIF, ADAT, loopback and any other output types.
	 * Detects stereo pairs via stereo-name attribute; routes right-channel
	 * controls to the left channel's IDs (server only responds to left channel).
	 */
	parseOutputs(xml, deviceInfo) {
		const outSectionMatch = xml.match(/<outputs[^>]*>([\s\S]*?)<\/outputs>/)
		if (!outSectionMatch) {
			this.emit('debug', 'parseOutputs: no <outputs> section found')
			return
		}
		const outXml = outSectionMatch[1]

		const outputElementRegex = /<([\w-]+)([^>]*)>([\s\S]*?)<\/\1>/g
		let match
		let index = 0
		// Position in deviceInfo.outputs of the most recent left channel, so the
		// right channel that follows can be paired with it.
		let lastLeftPosition = null
		while ((match = outputElementRegex.exec(outXml)) !== null) {
			const attrs = match[2]
			const content = match[3]

			const nameMatch = attrs.match(/name="([^"]*)"/)
			if (!nameMatch) continue

			const name = nameMatch[1]
			if (!name || name.trim() === '') continue

			const output = { id: String(index), name: name }
			index++

			// Mark monitor outputs (stereo pair controlled via hardware-controls mute)
			if (attrs.match(/monitor="true"/)) output.monitor = true

			// Store stereo pair name and detect right channel (stereo-name="" = right/secondary)
			const stereoNameMatch = attrs.match(/stereo-name="([^"]*)"/)
			const isRightChannel = stereoNameMatch && stereoNameMatch[1] === ''
			if (stereoNameMatch && stereoNameMatch[1]) output.stereoName = stereoNameMatch[1]

			const gainMatch = content.match(/<gain[^>]+id="(\d+)"/)
			if (gainMatch) output.volume = gainMatch[1]

			const muteMatch = content.match(/<mute[^>]+id="(\d+)"/)
			if (muteMatch) output.mute = muteMatch[1]

			// Whether the pair is linked is its own item, toggled by the STEREO
			// button in Focusrite Control. Every channel keeps its own volume and
			// mute; output-controls.js decides at use time whether the pair's left
			// channel should drive it instead, since the link can change at any
			// time and the server ignores a right channel's own items only while
			// linked.
			const stereoMatch = content.match(/<stereo[^>]+id="(\d+)"/)
			if (stereoMatch) output.stereo = stereoMatch[1]

			if (!output.volume && !output.mute) continue

			const position = deviceInfo.outputs.length
			if (isRightChannel && lastLeftPosition !== null) {
				output.isRight = true
				output.partner = lastLeftPosition
				deviceInfo.outputs[lastLeftPosition].partner = position
				lastLeftPosition = null
			} else if (!isRightChannel) {
				lastLeftPosition = position
			}

			deviceInfo.outputs.push(output)
		}
	}

	/**
	 * Parse monitoring section (dim/mute/gain on monitor outputs, i.e. Out 1-2)
	 */
	parseMonitoring(xml, deviceInfo) {
		const monSection = xml.match(/<monitoring>([\s\S]*?)<\/monitoring>/)
		if (!monSection) return
		const hwControls = monSection[1].match(/<hardware-controls[^>]*exclusive[^>]*>([\s\S]*?)<\/hardware-controls>/)
		if (!hwControls) return
		const content = hwControls[1]

		const gainMatch = content.match(/<gain[^>]+id="(\d+)"/)
		if (gainMatch) deviceInfo.monitoring.gain = gainMatch[1]

		const dimMatch = content.match(/<dim[^>]+id="(\d+)"/)
		if (dimMatch) deviceInfo.monitoring.dim = dimMatch[1]

		const muteMatch = content.match(/<mute[^>]+id="(\d+)"/)
		if (muteMatch) deviceInfo.monitoring.mute = muteMatch[1]
	}

	/**
	 * Parse mixes with inputs (gain, pan, mute, solo)
	 */
	parseMixes(xml, deviceInfo) {
		const mixRegex = /<mix[^>]+id="(\d+)"[^>]*name="([^"]*)"[^>]*>([\s\S]*?)<\/mix>/g
		let mixMatch
		while ((mixMatch = mixRegex.exec(xml)) !== null) {
			const mixName = mixMatch[2]
			if (!mixName || mixName.trim() === '') continue

			const mix = {
				id: mixMatch[1],
				name: mixName,
				inputs: [],
			}

			const inputRegex = /<input>([\s\S]*?)<\/input>/g
			let inputMatch
			const mixContent = mixMatch[3]
			while ((inputMatch = inputRegex.exec(mixContent)) !== null) {
				const inputContent = inputMatch[1]
				const gainMatch = inputContent.match(/<gain[^>]+id="(\d+)"/)
				const panMatch = inputContent.match(/<pan[^>]+id="(\d+)"/)
				const muteMatch = inputContent.match(/<mute[^>]+id="(\d+)"/)
				const soloMatch = inputContent.match(/<solo[^>]+id="(\d+)"/)

				if (gainMatch) {
					mix.inputs.push({
						gain: gainMatch[1],
						pan: panMatch ? panMatch[1] : null,
						mute: muteMatch ? muteMatch[1] : null,
						solo: soloMatch ? soloMatch[1] : null,
					})
				}
			}

			const meterMatch = mixContent.match(/<meter[^>]+id="(\d+)"/)
			if (meterMatch) mix.meter = meterMatch[1]

			deviceInfo.mixes.push(mix)
		}
	}

	parseItems(element, itemsMap, prefix) {
		if (!element) return

		// Check for item elements
		if (element.item) {
			const items = Array.isArray(element.item) ? element.item : [element.item]
			for (const item of items) {
				if (item.$ && item.$.id) {
					const itemId = item.$.id
					const path = prefix ? `${prefix}` : itemId
					itemsMap.set(itemId, {
						id: itemId,
						path: path,
						value: item.$.value,
						name: item.$.name || itemId,
						type: item.$.type || 'unknown',
						min: item.$.min,
						max: item.$.max,
					})
				}
			}
		}

		// Also capture named control elements that have id (e.g. <air id="X" value="Y"/>, <mute id="X"/>, <dim id="X"/>)
		for (const key of Object.keys(element)) {
			if (key === '$' || key === 'item') continue
			const children = Array.isArray(element[key]) ? element[key] : [element[key]]
			for (const child of children) {
				if (child && typeof child === 'object' && child.$ && child.$.id !== undefined) {
					const itemId = child.$.id
					if (!itemsMap.has(itemId)) {
						const childPath = prefix ? `${prefix}/${key}` : key
						itemsMap.set(itemId, {
							id: itemId,
							path: childPath,
							value: child.$.value,
							name: child.$.name || key,
							type: child.$.type || key,
							min: child.$.min,
							max: child.$.max,
						})
					}
				}
			}
		}

		// Recurse into child elements
		for (const key of Object.keys(element)) {
			if (key !== '$' && key !== 'item' && typeof element[key] === 'object') {
				const childPrefix = prefix ? `${prefix}/${key}` : key
				this.parseItems(element[key], itemsMap, childPrefix)
			}
		}
	}

	async parseValueUpdate(xml) {
		try {
			const result = await parseStringPromise(xml, { explicitArray: false })

			let setElement = result.set
			if (!setElement) return

			const deviceId = setElement.$.devid

			// Parse items
			let items = setElement.item
			if (!items) return
			if (!Array.isArray(items)) items = [items]

			for (const item of items) {
				const itemId = item.$.id
				const value = item.$.value

				// Update local state (add item if not yet known)
				const device = this.devices.get(deviceId)
				if (device) {
					if (device.items.has(itemId)) {
						device.items.get(itemId).value = value
					} else {
						device.items.set(itemId, { id: itemId, value, name: itemId, type: 'unknown' })
					}

					// The nickname is the name the user sees in Focusrite Control.
					// It arrives here rather than on the device element, so keep it
					// on the device and let listeners refresh any derived naming.
					if (device.nicknameItem && itemId === device.nicknameItem) {
						const nickname = value || ''
						// The server repeats the nickname in more than one update,
						// so only announce a genuine change.
						if (nickname !== device.nickname) {
							device.nickname = nickname
							this.emit('device-renamed', device)
						}
					}
				}

				this.emit('value-changed', { deviceId, itemId, value })
			}
		} catch (err) {
			this.emit('error', err)
		}
	}

	/**
	 * Get all devices
	 */
	getDevices() {
		return Array.from(this.devices.values())
	}

	/**
	 * Get device by ID
	 */
	getDevice(deviceId) {
		return this.devices.get(deviceId)
	}

	/**
	 * Get item value
	 */
	getItemValue(deviceId, itemId) {
		const device = this.devices.get(deviceId)
		if (!device) return undefined
		const item = device.items.get(itemId)
		return item ? item.value : undefined
	}

	/**
	 * Get source name by ID
	 */
	getSourceName(sourceId) {
		return this.sourceNames.get(sourceId)
	}

	/**
	 * Get short label from source name
	 */
	getShortSourceLabel(sourceName) {
		if (!sourceName) return null
		return sourceName
			.replace('Analogue ', 'An')
			.replace('Playback ', 'Pb')
			.replace('S/PDIF ', 'SP')
			.replace('SPDIF ', 'SP')
			.replace('ADAT ', 'AD')
			.replace('Loopback ', 'Lb')
			.replace(' ', '')
	}
}

export default FocusriteClient
