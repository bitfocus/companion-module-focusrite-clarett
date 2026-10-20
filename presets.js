/**
 * Focusrite Clarett / Scarlett Presets
 *
 * Pre-configured buttons for common operations.
 *
 * Presets are built from what the connected device actually reports, not from a
 * fixed list. The supported interfaces differ widely in what they expose: a
 * Scarlett 18i20 (2nd Gen), for instance, controls its preamps from the front
 * panel and reports no Air or input mode at all, while its mixer offers five
 * mixes of eighteen inputs. Offering buttons for controls that are not there
 * gives the user a page of keys that quietly do nothing.
 *
 * This runs once at startup, when nothing is known and the result is empty, and
 * again on device arrival once the structure has been parsed.
 */

import { combineRgb } from '@companion-module/base'

const WHITE = combineRgb(255, 255, 255)
const BLACK = combineRgb(0, 0, 0)

/**
 * Build the preset palette for the connected device.
 *
 * @param {object} [self] The module instance, or nothing before a device arrives.
 * @returns {{ structure: object[], presets: object }}
 */
export function getPresets(self) {
	const presets = {}
	const categories = []

	const mixes = self?.mixes || []
	const hardwareInputs = self?.hardwareInputs || []
	const monitoring = self?.monitoring || {}

	// Mixer presets follow the first mix, which is the one the corresponding
	// actions default to. Channel counts come from the mix itself rather than a
	// fixed eight, since these devices range from two inputs to eighteen.
	const firstMix = mixes[0]
	const mixInputs = firstMix?.inputs || []

	// ---------------------------------------------------------------- mutes
	const muteChannels = channelsWith(mixInputs, 'mute')
	for (const ch of muteChannels) {
		presets[`mute_input_${ch}`] = {
			type: 'simple',
			name: `Mute Input ${ch}`,
			style: { text: `MUTE\\nIN ${ch}`, size: '14', color: WHITE, bgcolor: BLACK },
			steps: [{ down: [{ actionId: 'mute_input', options: { channel: ch, mix: 1, state: 'toggle' } }], up: [] }],
			feedbacks: [
				{
					feedbackId: 'input_muted',
					options: { channel: ch, mix: 1 },
					style: { bgcolor: combineRgb(255, 0, 0), color: WHITE },
				},
			],
		}
	}

	// ---------------------------------------------------------------- solos
	const soloChannels = channelsWith(mixInputs, 'solo')
	for (const ch of soloChannels) {
		presets[`solo_input_${ch}`] = {
			type: 'simple',
			name: `Solo Input ${ch}`,
			style: { text: `SOLO\\nIN ${ch}`, size: '14', color: WHITE, bgcolor: BLACK },
			steps: [{ down: [{ actionId: 'solo_input', options: { channel: ch, mix: 1, state: 'toggle' } }], up: [] }],
			feedbacks: [
				{
					feedbackId: 'input_soloed',
					options: { channel: ch, mix: 1 },
					style: { bgcolor: combineRgb(255, 255, 0), color: BLACK },
				},
			],
		}
	}

	// ------------------------------------------------------------------ air
	const airChannels = channelsWith(hardwareInputs, 'air')
	for (const ch of airChannels) {
		presets[`air_${ch}`] = {
			type: 'simple',
			name: `Air ${ch}`,
			style: { text: `AIR\\nCH ${ch}`, size: '14', color: WHITE, bgcolor: BLACK },
			steps: [{ down: [{ actionId: 'set_air', options: { channel: ch, state: 'toggle' } }], up: [] }],
			feedbacks: [
				{
					feedbackId: 'air_enabled',
					options: { channel: ch },
					style: { bgcolor: combineRgb(255, 204, 0), color: BLACK },
				},
			],
		}
	}

	// ------------------------------------------------------------------ pad
	const padChannels = channelsWith(hardwareInputs, 'pad')
	for (const ch of padChannels) {
		presets[`pad_${ch}`] = {
			type: 'simple',
			name: `Pad ${ch}`,
			style: { text: `PAD\\nCH ${ch}`, size: '14', color: WHITE, bgcolor: BLACK },
			steps: [{ down: [{ actionId: 'set_pad', options: { channel: ch, state: 'toggle' } }], up: [] }],
			feedbacks: [
				{
					feedbackId: 'pad_enabled',
					options: { channel: ch },
					style: { bgcolor: combineRgb(0, 102, 204), color: WHITE },
				},
			],
		}
	}

	// ----------------------------------------------------------- input mode
	const modeChannels = channelsWith(hardwareInputs, 'mode')
	for (const ch of modeChannels) {
		presets[`mode_${ch}`] = {
			type: 'simple',
			name: `Mode ${ch}`,
			style: { text: `MODE\\nCH ${ch}`, size: '14', color: WHITE, bgcolor: combineRgb(64, 64, 64) },
			steps: [{ down: [{ actionId: 'cycle_mode', options: { channel: ch } }], up: [] }],
			feedbacks: [
				{
					feedbackId: 'mode_mic',
					options: { channel: ch },
					style: { bgcolor: combineRgb(255, 0, 0), color: WHITE, text: `MIC\\nCH ${ch}` },
				},
				{
					feedbackId: 'mode_line',
					options: { channel: ch },
					style: { bgcolor: combineRgb(102, 0, 0), color: WHITE, text: `LINE\\nCH ${ch}` },
				},
				{
					feedbackId: 'mode_inst',
					options: { channel: ch },
					style: { bgcolor: combineRgb(255, 102, 170), color: BLACK, text: `INST\\nCH ${ch}` },
				},
			],
		}
	}

	// -------------------------------------------------------------- monitor
	if (monitoring.dim) {
		presets['dim'] = {
			type: 'simple',
			name: 'Dim',
			style: { text: 'DIM', size: '18', color: WHITE, bgcolor: BLACK },
			steps: [{ down: [{ actionId: 'set_dim', options: { state: 'toggle' } }], up: [] }],
			feedbacks: [
				{
					feedbackId: 'dim_enabled',
					options: {},
					style: { bgcolor: combineRgb(180, 80, 0), color: WHITE },
				},
			],
		}
	}

	// Presets are grouped only when they produced something, so the palette
	// never shows an empty category.
	const inputDefinitions = [
		definition(
			'mutes',
			'Input Mutes',
			muteChannels.map((ch) => `mute_input_${ch}`),
		),
		definition(
			'solos',
			'Input Solos',
			soloChannels.map((ch) => `solo_input_${ch}`),
		),
		definition(
			'air',
			'Air Mode',
			airChannels.map((ch) => `air_${ch}`),
		),
		definition(
			'pad',
			'Pad',
			padChannels.map((ch) => `pad_${ch}`),
		),
		definition(
			'mode',
			'Input Mode',
			modeChannels.map((ch) => `mode_${ch}`),
		),
	].filter(Boolean)

	if (inputDefinitions.length > 0) {
		categories.push({ id: 'inputs', name: 'Inputs', definitions: inputDefinitions })
	}

	const monitorDefinitions = [definition('monitor_controls', 'Monitor Controls', presets['dim'] ? ['dim'] : [])].filter(
		Boolean,
	)

	if (monitorDefinitions.length > 0) {
		categories.push({ id: 'monitor', name: 'Monitor', definitions: monitorDefinitions })
	}

	return { structure: categories, presets }
}

/**
 * One-based channel numbers whose entry exposes the named control.
 *
 * Positions are preserved, so a device that offers a control on only some of
 * its inputs still gets the right channel number on each button.
 *
 * @param {object[]} entries
 * @param {string} control
 * @returns {number[]}
 */
function channelsWith(entries, control) {
	const channels = []
	for (let i = 0; i < entries.length; i++) {
		if (entries[i]?.[control]) channels.push(i + 1)
	}
	return channels
}

/**
 * A preset group, or nothing when it would be empty.
 */
function definition(id, name, presetIds) {
	if (presetIds.length === 0) return null
	return { id, type: 'simple', name, presets: presetIds }
}
