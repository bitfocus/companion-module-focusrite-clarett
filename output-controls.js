/**
 * Output control resolution for stereo pairs.
 *
 * Outputs come in pairs, left then right, and each carries its own volume and
 * mute items. Whether the pair is linked is a separate item, toggled by the
 * STEREO button in Focusrite Control, and it decides which items actually do
 * anything:
 *
 *   linked    the pair is driven by the left channel's items. Writes to the
 *             right channel's own items are ignored by the server.
 *   unlinked  each channel is independent and answers to its own items.
 *
 * Both behaviours were confirmed on a Scarlett 18i20 (2nd Gen). With Line
 * Outputs 3 and 4 unlinked, writing Line Output 4's own mute and gain changed
 * Line Output 4 and left Line Output 3 alone. With Line Outputs 5-6 linked,
 * writes to Line Output 6's own mute and gain were ignored, while Line Output 5's
 * mute was accepted.
 *
 * Previously every right channel was permanently wired to its left partner's
 * items, which is only correct while linked. On an unlinked pair, an action
 * aimed at the right channel moved the left one instead.
 *
 * The link can be toggled at any time, so this is resolved when a control is
 * used, from live item values, rather than fixed when the device is parsed.
 */

/**
 * Whether an output is currently part of a linked stereo pair.
 *
 * Reads the left channel's link item, since that one governs the pair. Only an
 * explicit "true" counts: an unlinked pair's item is typically never reported at
 * all, which reads as undefined.
 *
 * @param {object[]} outputs All outputs, in device order.
 * @param {Map<string, {value: string}>} items Current item values.
 * @param {object} output The output to check.
 * @returns {boolean}
 */
export function isStereoLinked(outputs, items, output) {
	if (!output) return false
	const left = output.isRight ? outputs?.[output.partner] : output
	const linkItem = left?.stereo ?? output.stereo
	if (!linkItem) return false
	return items?.get(linkItem)?.value === 'true'
}

/**
 * The item that actually controls an output's volume or mute right now.
 *
 * @param {object[]} outputs All outputs, in device order.
 * @param {Map<string, {value: string}>} items Current item values.
 * @param {object} output The output being controlled.
 * @param {'volume'|'mute'} kind Which control.
 * @returns {string|undefined} The item id, or undefined if there is none.
 */
export function outputControl(outputs, items, output, kind) {
	if (!output) return undefined
	if (output.isRight && isStereoLinked(outputs, items, output)) {
		return outputs?.[output.partner]?.[kind] ?? output[kind]
	}
	return output[kind]
}

/**
 * The mute item for an output, including the monitor case.
 *
 * Monitor outputs are muted through the monitoring section rather than their own
 * mute item, a rule inherited from the original implementation.
 */
export function outputMuteItem(outputs, items, monitoring, output) {
	if (!output) return undefined
	if (output.monitor) return monitoring?.mute
	return outputControl(outputs, items, output, 'mute')
}

/**
 * Choices for the output mute action and feedback.
 *
 * Every pair contributes an entry for its left channel, with the zero-based
 * string id these fields have always used, so buttons configured before this
 * change keep pointing at the same pair. It is labelled with the pair name while
 * linked and the channel name while unlinked, matching what Focusrite Control
 * shows.
 *
 * Every right channel now contributes an entry of its own, with an id of the
 * form "r<pair>". This is the only way to mute a right channel on its own, which
 * is possible while its pair is unlinked. The entry is listed whether or not the
 * pair is linked, so ids never appear and vanish as STEREO is toggled. While
 * linked it controls the whole pair, as the server requires, and says so.
 *
 * @returns {{id: string, label: string}[]}
 */
export function outputMuteChoices(outputs, items) {
	const choices = []
	const pairs = leftChannels(outputs)

	pairs.forEach((left, k) => {
		const linked = isStereoLinked(outputs, items, left)
		choices.push({ id: String(k), label: linked ? left.stereoName : left.name })

		const right = outputs[left.partner]
		if (right) {
			choices.push({ id: `r${k}`, label: linked ? `${right.name} (linked)` : right.name })
		}
	})

	return choices
}

/**
 * Resolve an output mute choice id back to the output it names.
 *
 * @param {object[]} outputs All outputs, in device order.
 * @param {string|number} choiceId A value produced by outputMuteChoices.
 * @returns {object|undefined}
 */
export function outputFromMuteChoice(outputs, choiceId) {
	const id = String(choiceId)
	const pairs = leftChannels(outputs)

	if (id.startsWith('r')) {
		const left = pairs[Number(id.slice(1))]
		return left ? outputs[left.partner] : undefined
	}
	return pairs[Number(id)]
}

/** Left channels of every pair, the list the old zero-based ids index into. */
function leftChannels(outputs) {
	return (outputs || []).filter((output) => output.stereoName)
}
