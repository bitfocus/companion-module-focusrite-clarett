/**
 * Focusrite Clarett Feedbacks
 *
 * Visual feedback for button states
 */

import { combineRgb } from '@companion-module/base'
import { outputFromMuteChoice, outputMuteChoices, outputMuteItem } from './output-controls.js'

export function updateFeedbacks(self) {
	self.setFeedbackDefinitions({
		// ============================================
		// MUTE FEEDBACKS
		// ============================================
		input_muted: {
			name: 'Input Muted',
			type: 'boolean',
			description: 'Change button style when input is muted',
			defaultStyle: {
				bgcolor: combineRgb(255, 0, 0),
				color: combineRgb(255, 255, 255),
			},
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
					label: 'Mix (1=first)',
					default: 1,
					min: 1,
					max: 10,
				},
			],
			callback: (feedback) => {
				const ch = feedback.options.channel - 1
				const mixIdx = (feedback.options.mix || 1) - 1
				const mix = self.mixes?.[mixIdx]
				const input = mix?.inputs?.[ch]
				const itemId = input?.mute
				if (!itemId) return false
				const item = self.items.get(itemId)
				return item && (item.value === 'true' || item.value === '1')
			},
		},

		output_muted: {
			name: 'Output Muted',
			type: 'boolean',
			description: 'Change button style when output is muted',
			defaultStyle: {
				bgcolor: combineRgb(255, 0, 0),
				color: combineRgb(255, 255, 255),
			},
			options: [
				{
					id: 'channel',
					type: 'dropdown',
					label: 'Output',
					choices: outputMuteChoices(self.outputs, self.items),
					default: '0',
				},
			],
			callback: (feedback) => {
				const output = outputFromMuteChoice(self.outputs, feedback.options.channel)
				const itemId = outputMuteItem(self.outputs, self.items, self.monitoring, output)
				if (!itemId) return false
				const item = self.items.get(itemId)
				return item && (item.value === 'true' || item.value === '1')
			},
		},

		// ============================================
		// SOLO FEEDBACKS
		// ============================================
		input_soloed: {
			name: 'Input Soloed',
			type: 'boolean',
			description: 'Change button style when input is soloed',
			defaultStyle: {
				bgcolor: combineRgb(255, 255, 0),
				color: combineRgb(0, 0, 0),
			},
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
					label: 'Mix (1=first)',
					default: 1,
					min: 1,
					max: 10,
				},
			],
			callback: (feedback) => {
				const ch = feedback.options.channel - 1
				const mixIdx = (feedback.options.mix || 1) - 1
				const mix = self.mixes?.[mixIdx]
				const input = mix?.inputs?.[ch]
				const itemId = input?.solo
				if (!itemId) return false
				const item = self.items.get(itemId)
				return item && (item.value === 'true' || item.value === '1')
			},
		},

		// ============================================
		// HARDWARE FEEDBACKS
		// ============================================
		air_enabled: {
			name: 'Air Mode Enabled',
			type: 'boolean',
			description: 'Change button style when Air mode is on',
			defaultStyle: {
				bgcolor: combineRgb(255, 204, 0), // Yellow like Clarett LED
				color: combineRgb(0, 0, 0),
			},
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
			callback: (feedback) => {
				const ch = feedback.options.channel
				// Use actual Air control ID from hardware inputs if available
				const hwInput = self.hardwareInputs?.[ch - 1]
				const itemId = hwInput?.air
				if (!itemId) return false
				const item = self.items.get(itemId)
				return item && (item.value === 'true' || item.value === '1')
			},
		},

		pad_enabled: {
			name: 'Pad Enabled',
			type: 'boolean',
			description: 'Change button style when the -10dB pad is on',
			defaultStyle: {
				bgcolor: combineRgb(0, 102, 204), // Blue
				color: combineRgb(255, 255, 255),
			},
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
			callback: (feedback) => {
				const ch = feedback.options.channel
				const hwInput = self.hardwareInputs?.[ch - 1]
				const itemId = hwInput?.pad
				if (!itemId) return false
				// An item we have never been told about means off. The declared
				// type here is boolean, so return one rather than leaking
				// undefined the way the older feedbacks in this file do.
				const item = self.items.get(itemId)
				return item?.value === 'true' || item?.value === '1'
			},
		},

		mode_mic: {
			name: 'Mode is Mic',
			type: 'boolean',
			description: 'Change button style when input mode is Mic',
			defaultStyle: {
				bgcolor: combineRgb(255, 0, 0), // Bright red
				color: combineRgb(255, 255, 255),
			},
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
			callback: (feedback) => {
				const ch = feedback.options.channel
				const hwInput = self.hardwareInputs?.[ch - 1]
				if (!hwInput?.mode) return false
				const item = self.items.get(hwInput.mode)
				return item && item.value === 'Mic'
			},
		},

		mode_line: {
			name: 'Mode is Line',
			type: 'boolean',
			description: 'Change button style when input mode is Line',
			defaultStyle: {
				bgcolor: combineRgb(102, 0, 0), // Dark red
				color: combineRgb(255, 255, 255),
			},
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
			callback: (feedback) => {
				const ch = feedback.options.channel
				const hwInput = self.hardwareInputs?.[ch - 1]
				if (!hwInput?.mode) return false
				const item = self.items.get(hwInput.mode)
				return item && item.value === 'Line'
			},
		},

		mode_inst: {
			name: 'Mode is Instrument',
			type: 'boolean',
			description: 'Change button style when input mode is Instrument (ch 1-2 only)',
			defaultStyle: {
				bgcolor: combineRgb(255, 102, 170), // Pink
				color: combineRgb(0, 0, 0),
			},
			options: [
				{
					id: 'channel',
					type: 'number',
					label: 'Input Channel',
					default: 1,
					min: 1,
					max: 2,
				},
			],
			callback: (feedback) => {
				const ch = feedback.options.channel
				const hwInput = self.hardwareInputs?.[ch - 1]
				if (!hwInput?.mode) return false
				const item = self.items.get(hwInput.mode)
				return item && item.value === 'Inst'
			},
		},

		// ============================================
		// MONITOR FEEDBACKS
		// ============================================
		dim_enabled: {
			name: 'Dim Enabled',
			type: 'boolean',
			description: 'Change button style when monitor dim is active',
			defaultStyle: {
				bgcolor: combineRgb(180, 80, 0),
				color: combineRgb(255, 255, 255),
			},
			options: [],
			callback: (_feedback) => {
				const itemId = self.monitoring?.dim
				if (!itemId) return false
				const item = self.items.get(itemId)
				return item && (item.value === 'true' || item.value === '1')
			},
		},

		talkback_enabled: {
			name: 'Talkback Enabled',
			type: 'boolean',
			description: 'Change button style when talkback is active (requires item ID from Set Raw Value)',
			defaultStyle: {
				bgcolor: combineRgb(0, 255, 0),
				color: combineRgb(0, 0, 0),
			},
			options: [
				{
					id: 'itemId',
					type: 'textinput',
					label: 'Talkback Item ID',
					default: '',
				},
			],
			callback: (feedback) => {
				const itemId = feedback.options.itemId
				if (!itemId) return false
				const item = self.items.get(itemId)
				return item && (item.value === 'true' || item.value === '1')
			},
		},

		// ============================================
		// STEREO LINK FEEDBACKS
		// ============================================
		stereo_linked: {
			name: 'Stereo Linked',
			type: 'boolean',
			description: 'Change button style when stereo link is active',
			defaultStyle: {
				bgcolor: combineRgb(0, 128, 0),
				color: combineRgb(255, 255, 255),
			},
			options: [
				{
					id: 'channel',
					type: 'number',
					label: 'Input Channel (odd)',
					default: 1,
					min: 1,
					max: 7,
				},
			],
			callback: (feedback) => {
				const ch = feedback.options.channel
				const hwInput = self.hardwareInputs?.[ch - 1]
				const itemId = hwInput?.stereo
				if (!itemId) return false
				const item = self.items.get(itemId)
				return item && (item.value === 'true' || item.value === '1')
			},
		},

		// ============================================
		// GENERIC VALUE FEEDBACK
		// ============================================
		value_equals: {
			name: 'Value Equals (Advanced)',
			type: 'boolean',
			description: 'Check if an item has a specific value',
			defaultStyle: {
				bgcolor: combineRgb(0, 255, 0),
				color: combineRgb(0, 0, 0),
			},
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
					label: 'Expected Value',
					default: 'true',
				},
			],
			callback: (feedback) => {
				const itemId = feedback.options.itemId
				const expectedValue = feedback.options.value
				const item = self.items.get(itemId)
				return item && item.value === expectedValue
			},
		},
	})
}
