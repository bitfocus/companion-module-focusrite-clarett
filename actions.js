/**
 * Focusrite Clarett Actions
 *
 * Control actions for mixer inputs, outputs, routing, and hardware controls
 */

export function updateActions(self) {
	// Build dynamic choices from device items
	const inputChoices = []
	const outputChoices = []
	const itemChoices = []

	if (self.items) {
		for (const [itemId, item] of self.items) {
			itemChoices.push({ id: itemId, label: item.name || itemId })

			if (itemId.includes('input') || itemId.includes('mic') || itemId.includes('line-in')) {
				inputChoices.push({ id: itemId, label: item.name || itemId })
			}
			if (itemId.includes('output') || itemId.includes('line-out') || itemId.includes('monitor')) {
				outputChoices.push({ id: itemId, label: item.name || itemId })
			}
		}
	}

	// Default choices if no device connected
	if (inputChoices.length === 0) {
		for (let i = 1; i <= 8; i++) {
			inputChoices.push({ id: `input-${i}`, label: `Input ${i}` })
		}
	}
	if (outputChoices.length === 0) {
		for (let i = 1; i <= 10; i++) {
			outputChoices.push({ id: `output-${i}`, label: `Output ${i}` })
		}
	}

	self.setActionDefinitions({
		// ============================================
		// MUTE CONTROLS
		// ============================================
		mute_input: {
			name: 'Mute Input',
			options: [
				{
					id: 'channel',
					type: 'number',
					label: 'Input Channel',
					default: 1,
					min: 1,
					max: 30,
				},
				{
					id: 'mix',
					type: 'number',
					label: 'Mix (only Custom Mix-enabled outputs)',
					default: 1,
					min: 1,
					max: 10,
				},
				{
					id: 'state',
					type: 'dropdown',
					label: 'State',
					choices: [
						{ id: 'on', label: 'Mute On' },
						{ id: 'off', label: 'Mute Off' },
						{ id: 'toggle', label: 'Toggle' },
					],
					default: 'toggle',
				},
			],
			callback: async (event) => {
				const ch = event.options.channel - 1
				const mixIdx = event.options.mix - 1
				const mix = self.mixes?.[mixIdx]
				const input = mix?.inputs?.[ch]
				const itemId = input?.mute

				if (!itemId) {
					self.log('warn', `No mute control for mix ${event.options.mix} channel ${event.options.channel}`)
					return
				}

				if (event.options.state === 'toggle') {
					self.toggleValue(itemId)
				} else {
					self.setValue(itemId, event.options.state === 'on' ? 'true' : 'false')
				}
			},
		},

		mute_output: {
			name: 'Mute Output',
			options: [
				{
					id: 'channel',
					type: 'dropdown',
					label: 'Output Pair',
					choices: (self.outputs || [])
						.filter((o) => o.stereoName)
						.map((o, i) => ({ id: String(i), label: o.stereoName })),
					default: '0',
				},
				{
					id: 'state',
					type: 'dropdown',
					label: 'State',
					choices: [
						{ id: 'on', label: 'Mute On' },
						{ id: 'off', label: 'Mute Off' },
						{ id: 'toggle', label: 'Toggle' },
					],
					default: 'toggle',
				},
			],
			callback: async (event) => {
				const pairs = (self.outputs || []).filter((o) => o.stereoName)
				const output = pairs[Number(event.options.channel)]
				const itemId = output?.monitor ? self.monitoring?.mute : output?.mute

				if (!itemId) {
					self.log('warn', `No mute control for output pair ${event.options.channel}`)
					return
				}

				if (event.options.state === 'toggle') {
					self.toggleValue(itemId)
				} else {
					self.setValue(itemId, event.options.state === 'on' ? 'true' : 'false')
				}
			},
		},

		// ============================================
		// SOLO CONTROLS
		// ============================================
		solo_input: {
			name: 'Solo Input',
			options: [
				{
					id: 'channel',
					type: 'number',
					label: 'Input Channel',
					default: 1,
					min: 1,
					max: 30,
				},
				{
					id: 'mix',
					type: 'number',
					label: 'Mix (only Custom Mix-enabled outputs)',
					default: 1,
					min: 1,
					max: 10,
				},
				{
					id: 'state',
					type: 'dropdown',
					label: 'State',
					choices: [
						{ id: 'on', label: 'Solo On' },
						{ id: 'off', label: 'Solo Off' },
						{ id: 'toggle', label: 'Toggle' },
					],
					default: 'toggle',
				},
			],
			callback: async (event) => {
				const ch = event.options.channel - 1
				const mixIdx = event.options.mix - 1
				const mix = self.mixes?.[mixIdx]
				const input = mix?.inputs?.[ch]
				const itemId = input?.solo

				if (!itemId) {
					self.log('warn', `No solo control for mix ${event.options.mix} channel ${event.options.channel}`)
					return
				}

				if (event.options.state === 'toggle') {
					self.toggleValue(itemId)
				} else {
					self.setValue(itemId, event.options.state === 'on' ? 'true' : 'false')
				}
			},
		},

		// ============================================
		// GAIN / VOLUME CONTROLS
		// ============================================
		set_fader: {
			name: 'Set Mixer Fader',
			options: [
				{
					id: 'channel',
					type: 'number',
					label: 'Input Channel',
					default: 1,
					min: 1,
					max: 30,
				},
				{
					id: 'mix',
					type: 'number',
					label: 'Mix (only Custom Mix-enabled outputs)',
					default: 1,
					min: 1,
					max: 10,
				},
				{
					id: 'level',
					type: 'number',
					label: 'Level dB (-128 to +6)',
					default: 0,
					min: -128,
					max: 6,
				},
			],
			callback: async (event) => {
				const ch = event.options.channel - 1
				const mixIdx = event.options.mix - 1
				const mix = self.mixes?.[mixIdx]
				const input = mix?.inputs?.[ch]
				const itemId = input?.gain

				if (!itemId) {
					self.log('warn', `No fader control for mix ${event.options.mix} channel ${event.options.channel}`)
					return
				}

				self.setValue(itemId, event.options.level.toString())
			},
		},

		set_output_volume: {
			name: 'Set Output Volume',
			options: [
				{
					id: 'channel',
					type: 'number',
					label: 'Output Channel',
					default: 1,
					min: 1,
					max: 10,
				},
				{
					id: 'level',
					type: 'number',
					label: 'Level dB (-128 to +6)',
					default: 0,
					min: -128,
					max: 6,
				},
			],
			callback: async (event) => {
				const ch = event.options.channel - 1
				const output = self.outputs?.[ch]
				const itemId = output?.volume

				if (!itemId) {
					self.log('warn', `No volume control for output ${event.options.channel}`)
					return
				}

				self.setValue(itemId, event.options.level.toString())
			},
		},

		adjust_fader: {
			name: 'Adjust Mixer Fader (relative)',
			options: [
				{
					id: 'channel',
					type: 'number',
					label: 'Input Channel',
					default: 1,
					min: 1,
					max: 30,
				},
				{
					id: 'mix',
					type: 'number',
					label: 'Mix',
					default: 1,
					min: 1,
					max: 10,
				},
				{
					id: 'step',
					type: 'number',
					label: 'Step dB (positive = up, negative = down)',
					default: 1,
					min: -128,
					max: 128,
				},
			],
			callback: async (event) => {
				const ch = event.options.channel - 1
				const mixIdx = event.options.mix - 1
				const mix = self.mixes?.[mixIdx]
				const input = mix?.inputs?.[ch]
				const itemId = input?.gain

				if (!itemId) {
					self.log('warn', `No fader control for mix ${event.options.mix} channel ${event.options.channel}`)
					return
				}

				const current = parseFloat(self.client.getItemValue(self.deviceId, itemId) ?? '0')
				const next = Math.min(6, Math.max(-128, current + event.options.step))
				self.setValue(itemId, next.toString())
			},
		},

		adjust_output_volume: {
			name: 'Adjust Output Volume (relative)',
			options: [
				{
					id: 'channel',
					type: 'number',
					label: 'Output Channel',
					default: 1,
					min: 1,
					max: 10,
				},
				{
					id: 'step',
					type: 'number',
					label: 'Step dB (positive = up, negative = down)',
					default: 1,
					min: -128,
					max: 128,
				},
			],
			callback: async (event) => {
				const ch = event.options.channel - 1
				const output = self.outputs?.[ch]
				const itemId = output?.volume

				if (!itemId) {
					self.log('warn', `No volume control for output ${event.options.channel}`)
					return
				}

				const current = parseFloat(self.client.getItemValue(self.deviceId, itemId) ?? '0')
				const next = Math.min(6, Math.max(-128, current + event.options.step))
				self.setValue(itemId, next.toString())
			},
		},

		// ============================================
		// PAN CONTROLS
		// ============================================
		set_pan: {
			name: 'Set Pan',
			options: [
				{
					id: 'channel',
					type: 'number',
					label: 'Input Channel',
					default: 1,
					min: 1,
					max: 30,
				},
				{
					id: 'mix',
					type: 'number',
					label: 'Mix (only Custom Mix-enabled outputs)',
					default: 1,
					min: 1,
					max: 10,
				},
				{
					id: 'pan',
					type: 'number',
					label: 'Pan (-100 to 100)',
					default: 0,
					min: -100,
					max: 100,
				},
			],
			callback: async (event) => {
				const ch = event.options.channel - 1
				const mixIdx = event.options.mix - 1
				const mix = self.mixes?.[mixIdx]
				const input = mix?.inputs?.[ch]
				const itemId = input?.pan

				if (!itemId) {
					self.log('warn', `No pan control for mix ${event.options.mix} channel ${event.options.channel}`)
					return
				}

				// Convert -100..100 to device range (0-65535)
				const value = Math.round(((event.options.pan + 100) / 200) * 65535)
				self.setValue(itemId, value.toString())
			},
		},

		// ============================================
		// HARDWARE CONTROLS
		// ============================================

		set_air: {
			name: 'Air Mode',
			options: [
				{
					id: 'channel',
					type: 'number',
					label: 'Input Channel',
					default: 1,
					min: 1,
					max: 8,
				},
				{
					id: 'state',
					type: 'dropdown',
					label: 'State',
					choices: [
						{ id: 'on', label: 'On' },
						{ id: 'off', label: 'Off' },
						{ id: 'toggle', label: 'Toggle' },
					],
					default: 'toggle',
				},
			],
			callback: async (event) => {
				const ch = event.options.channel
				// Use actual Air control ID from hardware inputs if available
				const hwInput = self.hardwareInputs?.[ch - 1]
				const itemId = hwInput?.air || `input-${ch}/air`

				if (event.options.state === 'toggle') {
					self.toggleValue(itemId)
				} else {
					self.setValue(itemId, event.options.state === 'on' ? 'true' : 'false')
				}
			},
		},

		set_mode: {
			name: 'Input Mode (Mic/Line/Inst)',
			options: [
				{
					id: 'channel',
					type: 'number',
					label: 'Input Channel',
					default: 1,
					min: 1,
					max: 8,
				},
				{
					id: 'mode',
					type: 'dropdown',
					label: 'Mode',
					choices: [
						{ id: 'Mic', label: 'Mic' },
						{ id: 'Line', label: 'Line' },
						{ id: 'Inst', label: 'Instrument (ch 1-2 only)' },
					],
					default: 'Mic',
				},
			],
			callback: async (event) => {
				const ch = event.options.channel
				const hwInput = self.hardwareInputs?.[ch - 1]

				if (!hwInput?.mode) {
					self.log('warn', `No mode control for channel ${ch}`)
					return
				}

				// Validate mode is supported on this channel
				const validModes = hwInput.modeValues || ['Mic', 'Line']
				const requestedMode = event.options.mode

				if (!validModes.includes(requestedMode)) {
					self.log('warn', `Mode ${requestedMode} not supported on channel ${ch}. Valid: ${validModes.join(', ')}`)
					return
				}

				self.setValue(hwInput.mode, requestedMode)
			},
		},

		cycle_mode: {
			name: 'Cycle Input Mode',
			options: [
				{
					id: 'channel',
					type: 'number',
					label: 'Input Channel',
					default: 1,
					min: 1,
					max: 8,
				},
			],
			callback: async (event) => {
				const ch = event.options.channel
				const hwInput = self.hardwareInputs?.[ch - 1]

				if (!hwInput?.mode) {
					self.log('warn', `No mode control for channel ${ch}`)
					return
				}

				const validModes = hwInput.modeValues || ['Mic', 'Line']
				const item = self.items.get(hwInput.mode)
				const currentMode = item?.value || validModes[0]
				const currentIndex = validModes.indexOf(currentMode)
				const nextIndex = (currentIndex + 1) % validModes.length
				const nextMode = validModes[nextIndex]

				self.setValue(hwInput.mode, nextMode)
			},
		},

		// ============================================
		// MONITOR CONTROLS
		// ============================================
		set_dim: {
			name: 'Dim Monitor Output',
			options: [
				{
					id: 'state',
					type: 'dropdown',
					label: 'State',
					choices: [
						{ id: 'on', label: 'Dim On' },
						{ id: 'off', label: 'Dim Off' },
						{ id: 'toggle', label: 'Toggle' },
					],
					default: 'toggle',
				},
			],
			callback: async (event) => {
				const itemId = self.monitoring?.dim
				if (!itemId) {
					self.log('warn', 'No dim control found in monitoring section')
					return
				}
				if (event.options.state === 'toggle') {
					self.toggleValue(itemId)
				} else {
					self.setValue(itemId, event.options.state === 'on' ? 'true' : 'false')
				}
			},
		},

		set_talkback: {
			name: 'Talkback',
			options: [
				{
					id: 'itemId',
					type: 'textinput',
					label: 'Talkback Item ID (use Set Raw Value to discover)',
					default: '',
				},
				{
					id: 'state',
					type: 'dropdown',
					label: 'State',
					choices: [
						{ id: 'on', label: 'Talkback On' },
						{ id: 'off', label: 'Talkback Off' },
						{ id: 'toggle', label: 'Toggle' },
					],
					default: 'toggle',
				},
			],
			callback: async (event) => {
				const itemId = event.options.itemId
				if (!itemId) {
					self.log('warn', 'No talkback item ID configured')
					return
				}

				if (event.options.state === 'toggle') {
					self.toggleValue(itemId)
				} else {
					self.setValue(itemId, event.options.state === 'on' ? 'true' : 'false')
				}
			},
		},

		// ============================================
		// STEREO LINK
		// ============================================
		set_stereo_link: {
			name: 'Stereo Link',
			options: [
				{
					id: 'channel',
					type: 'number',
					label: 'Input Channel (odd number, 1-7)',
					default: 1,
					min: 1,
					max: 7,
				},
				{
					id: 'state',
					type: 'dropdown',
					label: 'State',
					choices: [
						{ id: 'on', label: 'Link On' },
						{ id: 'off', label: 'Link Off' },
						{ id: 'toggle', label: 'Toggle' },
					],
					default: 'toggle',
				},
			],
			callback: async (event) => {
				const ch = event.options.channel
				const hwInput = self.hardwareInputs?.[ch - 1]
				const itemId = hwInput?.stereo

				if (!itemId) {
					self.log('warn', `No stereo link control for channel ${ch}`)
					return
				}

				if (event.options.state === 'toggle') {
					self.toggleValue(itemId)
				} else {
					self.setValue(itemId, event.options.state === 'on' ? 'true' : 'false')
				}
			},
		},

		// ============================================
		// GENERIC SET VALUE
		// ============================================
		set_raw_value: {
			name: 'Set Raw Value (Advanced)',
			options: [
				{
					id: 'itemId',
					type: 'textinput',
					label: 'Item ID',
					default: '',
				},
				{
					id: 'value',
					type: 'textinput',
					label: 'Value',
					default: '',
				},
			],
			callback: async (event) => {
				if (event.options.itemId && event.options.value !== undefined) {
					self.setValue(event.options.itemId, event.options.value)
				}
			},
		},

		toggle_raw_value: {
			name: 'Toggle Raw Value (Advanced)',
			options: [
				{
					id: 'itemId',
					type: 'textinput',
					label: 'Item ID',
					default: '',
				},
			],
			callback: async (event) => {
				if (event.options.itemId) {
					self.toggleValue(event.options.itemId)
				}
			},
		},
	})
}
