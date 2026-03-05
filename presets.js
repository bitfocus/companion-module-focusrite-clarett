/**
 * Focusrite Clarett Presets
 *
 * Pre-configured buttons for common operations
 */

import { combineRgb } from '@companion-module/base'

export function getPresets() {
	const presets = {}

	// ============================================
	// INPUT MUTE PRESETS (Mix 1)
	// ============================================
	for (let i = 1; i <= 8; i++) {
		presets[`mute_input_${i}`] = {
			type: 'simple',
			name: `Mute Input ${i}`,
			style: {
				text: `MUTE\\nIN ${i}`,
				size: '14',
				color: combineRgb(255, 255, 255),
				bgcolor: combineRgb(0, 0, 0),
			},
			steps: [
				{
					down: [
						{
							actionId: 'mute_input',
							options: { channel: i, mix: 1, state: 'toggle' },
						},
					],
					up: [],
				},
			],
			feedbacks: [
				{
					feedbackId: 'input_muted',
					options: { channel: i, mix: 1 },
					style: {
						bgcolor: combineRgb(255, 0, 0),
						color: combineRgb(255, 255, 255),
					},
				},
			],
		}
	}

	// ============================================
	// INPUT SOLO PRESETS (Mix 1)
	// ============================================
	for (let i = 1; i <= 8; i++) {
		presets[`solo_input_${i}`] = {
			type: 'simple',
			name: `Solo Input ${i}`,
			style: {
				text: `SOLO\\nIN ${i}`,
				size: '14',
				color: combineRgb(255, 255, 255),
				bgcolor: combineRgb(0, 0, 0),
			},
			steps: [
				{
					down: [
						{
							actionId: 'solo_input',
							options: { channel: i, mix: 1, state: 'toggle' },
						},
					],
					up: [],
				},
			],
			feedbacks: [
				{
					feedbackId: 'input_soloed',
					options: { channel: i, mix: 1 },
					style: {
						bgcolor: combineRgb(255, 255, 0),
						color: combineRgb(0, 0, 0),
					},
				},
			],
		}
	}

	// ============================================
	// PHANTOM POWER PRESETS
	// ============================================
	for (let i = 1; i <= 8; i++) {
		presets[`phantom_${i}`] = {
			type: 'simple',
			name: `Phantom ${i}`,
			style: {
				text: `48V\\nCH ${i}`,
				size: '14',
				color: combineRgb(255, 255, 255),
				bgcolor: combineRgb(0, 0, 0),
			},
			steps: [
				{
					down: [
						{
							actionId: 'set_phantom',
							options: { channel: i, state: 'toggle' },
						},
					],
					up: [],
				},
			],
			feedbacks: [
				{
					feedbackId: 'phantom_enabled',
					options: { channel: i },
					style: {
						bgcolor: combineRgb(255, 128, 0),
						color: combineRgb(0, 0, 0),
					},
				},
			],
		}
	}

	// ============================================
	// AIR MODE PRESETS
	// ============================================
	for (let i = 1; i <= 8; i++) {
		presets[`air_${i}`] = {
			type: 'simple',
			name: `Air ${i}`,
			style: {
				text: `AIR\\nCH ${i}`,
				size: '14',
				color: combineRgb(0, 0, 0),
				bgcolor: combineRgb(64, 64, 64),
			},
			steps: [
				{
					down: [
						{
							actionId: 'set_air',
							options: { channel: i, state: 'toggle' },
						},
					],
					up: [],
				},
			],
			feedbacks: [
				{
					feedbackId: 'air_enabled',
					options: { channel: i },
					style: {
						bgcolor: combineRgb(255, 204, 0), // Yellow like Clarett LED
						color: combineRgb(0, 0, 0),
					},
				},
			],
		}
	}

	// ============================================
	// INPUT MODE PRESETS
	// ============================================
	for (let i = 1; i <= 8; i++) {
		presets[`mode_${i}`] = {
			type: 'simple',
			name: `Mode ${i}`,
			style: {
				text: `MODE\\nCH ${i}`,
				size: '14',
				color: combineRgb(255, 255, 255),
				bgcolor: combineRgb(64, 64, 64),
			},
			steps: [
				{
					down: [
						{
							actionId: 'cycle_mode',
							options: { channel: i },
						},
					],
					up: [],
				},
			],
			feedbacks: [
				{
					feedbackId: 'mode_mic',
					options: { channel: i },
					style: {
						bgcolor: combineRgb(255, 0, 0), // Bright red
						color: combineRgb(255, 255, 255),
						text: `MIC\\nCH ${i}`,
					},
				},
				{
					feedbackId: 'mode_line',
					options: { channel: i },
					style: {
						bgcolor: combineRgb(102, 0, 0), // Dark red
						color: combineRgb(255, 255, 255),
						text: `LINE\\nCH ${i}`,
					},
				},
				{
					feedbackId: 'mode_inst',
					options: { channel: i },
					style: {
						bgcolor: combineRgb(255, 102, 170), // Pink
						color: combineRgb(0, 0, 0),
						text: `INST\\nCH ${i}`,
					},
				},
			],
		}
	}

	// ============================================
	// PAD PRESETS
	// ============================================
	for (let i = 1; i <= 8; i++) {
		presets[`pad_${i}`] = {
			type: 'simple',
			name: `Pad ${i}`,
			style: {
				text: `PAD\\nCH ${i}`,
				size: '14',
				color: combineRgb(255, 255, 255),
				bgcolor: combineRgb(0, 0, 0),
			},
			steps: [
				{
					down: [
						{
							actionId: 'set_pad',
							options: { channel: i, state: 'toggle' },
						},
					],
					up: [],
				},
			],
			feedbacks: [
				{
					feedbackId: 'pad_enabled',
					options: { channel: i },
					style: {
						bgcolor: combineRgb(0, 128, 255),
						color: combineRgb(255, 255, 255),
					},
				},
			],
		}
	}

	// ============================================
	// HPF PRESETS
	// ============================================
	for (let i = 1; i <= 8; i++) {
		presets[`hpf_${i}`] = {
			type: 'simple',
			name: `HPF ${i}`,
			style: {
				text: `HPF\\nCH ${i}`,
				size: '14',
				color: combineRgb(255, 255, 255),
				bgcolor: combineRgb(0, 0, 0),
			},
			steps: [
				{
					down: [
						{
							actionId: 'set_hpf',
							options: { channel: i, state: 'toggle' },
						},
					],
					up: [],
				},
			],
			feedbacks: [
				{
					feedbackId: 'hpf_enabled',
					options: { channel: i },
					style: {
						bgcolor: combineRgb(128, 0, 255),
						color: combineRgb(255, 255, 255),
					},
				},
			],
		}
	}

	// ============================================
	// MONITOR PRESETS
	// ============================================
	presets['dim'] = {
		type: 'simple',
		name: 'Dim',
		style: {
			text: 'DIM',
			size: '18',
			color: combineRgb(255, 255, 255),
			bgcolor: combineRgb(0, 0, 0),
		},
		steps: [
			{
				down: [{ actionId: 'set_dim', options: { state: 'toggle' } }],
				up: [],
			},
		],
		feedbacks: [
			{
				feedbackId: 'dim_enabled',
				options: {},
				style: {
					bgcolor: combineRgb(180, 80, 0),
					color: combineRgb(255, 255, 255),
				},
			},
		],
	}

	presets['talkback'] = {
		type: 'simple',
		name: 'Talkback',
		style: {
			text: 'TALK',
			size: '18',
			color: combineRgb(255, 255, 255),
			bgcolor: combineRgb(0, 0, 0),
		},
		steps: [
			{
				down: [
					{
						actionId: 'set_talkback',
						options: { state: 'on' },
					},
				],
				up: [
					{
						actionId: 'set_talkback',
						options: { state: 'off' },
					},
				],
			},
		],
		feedbacks: [
			{
				feedbackId: 'talkback_enabled',
				options: {},
				style: {
					bgcolor: combineRgb(0, 255, 0),
					color: combineRgb(0, 0, 0),
				},
			},
		],
	}

	return {
		structure: [
			{
				id: 'inputs',
				name: 'Inputs',
				definitions: [
					{
						id: 'mutes',
						type: 'simple',
						name: 'Input Mutes',
						presets: Array.from({ length: 8 }, (_, i) => `mute_input_${i + 1}`),
					},
					{
						id: 'solos',
						type: 'simple',
						name: 'Input Solos',
						presets: Array.from({ length: 8 }, (_, i) => `solo_input_${i + 1}`),
					},
					{
						id: 'phantom',
						type: 'simple',
						name: 'Phantom Power',
						presets: Array.from({ length: 8 }, (_, i) => `phantom_${i + 1}`),
					},
					{
						id: 'air',
						type: 'simple',
						name: 'Air Mode',
						presets: Array.from({ length: 8 }, (_, i) => `air_${i + 1}`),
					},
					{
						id: 'mode',
						type: 'simple',
						name: 'Input Mode',
						presets: Array.from({ length: 8 }, (_, i) => `mode_${i + 1}`),
					},
					{
						id: 'pad',
						type: 'simple',
						name: 'Pad',
						presets: Array.from({ length: 8 }, (_, i) => `pad_${i + 1}`),
					},
					{
						id: 'hpf',
						type: 'simple',
						name: 'High Pass Filter',
						presets: Array.from({ length: 8 }, (_, i) => `hpf_${i + 1}`),
					},
				],
			},
			{
				id: 'monitor',
				name: 'Monitor',
				definitions: [
					{
						id: 'monitor_controls',
						type: 'simple',
						name: 'Monitor Controls',
						presets: ['dim', 'talkback'],
					},
				],
			},
		],
		presets,
	}
}
