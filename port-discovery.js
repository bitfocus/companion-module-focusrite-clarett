/**
 * FocusriteControlServer port discovery
 *
 * FocusriteControlServer does not bind a fixed port. It takes an OS-assigned
 * port from the platform's ephemeral range, which on Windows starts at 49152.
 * The value 49152 that older documentation quotes is simply the bottom of that
 * range, so it is only correct when the server happens to win the first slot.
 * The port also changes when the service restarts, which means a hard-coded
 * value is unreliable even on a machine where it worked once.
 *
 * Focusrite's own applications locate the server dynamically. There is no mDNS
 * advertisement and no file on disk recording the port, so we find it the same
 * way: probe the ephemeral range and keep the first listener that answers the
 * FocusriteControlServer protocol.
 *
 * The probe sends a bare <keep-alive/>, which the server echoes back framed.
 * That is enough to identify it, and unlike <client-details> it carries no
 * client identity, so probing never registers a client or raises an approval
 * prompt in Focusrite Control.
 */

import net from 'net'
import { encodeMessage, FRAME_HEADER_REGEX } from './focusrite-client.js'

/** Bottom of the ephemeral range, and the port older docs quote as fixed. */
export const DEFAULT_PORT = 49152

/** Highest port worth probing. */
export const EPHEMERAL_END = 65535

const DEFAULT_PROBE_TIMEOUT = 500
const DEFAULT_CONCURRENCY = 256

/**
 * Check whether a single host:port speaks the FocusriteControlServer protocol.
 *
 * Resolves true only when the peer echoes a correctly framed reply. Refused
 * connections, timeouts and listeners that answer with anything else all
 * resolve false, so a caller can treat this as a simple predicate.
 *
 * @returns {Promise<boolean>}
 */
export function probePort({ host = '127.0.0.1', port, timeoutMs = DEFAULT_PROBE_TIMEOUT } = {}) {
	return new Promise((resolve) => {
		const socket = new net.Socket()
		socket.setEncoding('utf8')

		let buffer = ''
		let settled = false

		const finish = (result) => {
			if (settled) return
			settled = true
			socket.removeAllListeners()
			socket.destroy()
			resolve(result)
		}

		socket.setTimeout(timeoutMs, () => finish(false))
		socket.on('error', () => finish(false))
		socket.on('close', () => finish(false))

		socket.on('connect', () => {
			socket.write(encodeMessage('<keep-alive/>'))
		})

		socket.on('data', (chunk) => {
			buffer += chunk
			if (FRAME_HEADER_REGEX.test(buffer)) {
				finish(true)
			} else if (buffer.length > 64) {
				// Something is listening, but it is not talking our protocol.
				finish(false)
			}
		})

		socket.connect(port, host)
	})
}

/**
 * Build the ordered list of ports to probe.
 *
 * Any previously known port is tried first so a warm start costs one probe
 * rather than a scan, then the ephemeral range is walked upwards.
 */
function buildCandidates({ preferredPorts = [], startPort = DEFAULT_PORT, endPort = EPHEMERAL_END }) {
	const seen = new Set()
	const candidates = []

	for (const port of preferredPorts) {
		const value = Number(port)
		if (!Number.isInteger(value) || value < 1 || value > 65535) continue
		if (seen.has(value)) continue
		seen.add(value)
		candidates.push(value)
	}

	for (let port = startPort; port <= endPort; port++) {
		if (seen.has(port)) continue
		seen.add(port)
		candidates.push(port)
	}

	return candidates
}

/**
 * Find the port FocusriteControlServer is listening on.
 *
 * Probes run in batches. Within a batch the lowest matching port wins, so the
 * result does not depend on which socket happened to answer first.
 *
 * @param {object} options
 * @param {string} [options.host] Host to probe.
 * @param {number[]} [options.preferredPorts] Ports to try before scanning.
 * @param {number} [options.startPort] First port of the scan range.
 * @param {number} [options.endPort] Last port of the scan range.
 * @param {number} [options.timeoutMs] Per-probe timeout.
 * @param {number} [options.concurrency] Probes in flight per batch.
 * @param {(message: string) => void} [options.log] Progress sink.
 * @param {() => boolean} [options.isCancelled] Return true to abort the scan.
 * @returns {Promise<number|null>} The port, or null if nothing answered.
 */
export async function discoverPort({
	host = '127.0.0.1',
	preferredPorts = [],
	startPort = DEFAULT_PORT,
	endPort = EPHEMERAL_END,
	timeoutMs = DEFAULT_PROBE_TIMEOUT,
	concurrency = DEFAULT_CONCURRENCY,
	log,
	isCancelled,
} = {}) {
	const candidates = buildCandidates({ preferredPorts, startPort, endPort })
	const batchSize = Math.max(1, concurrency)

	log?.(`Scanning ${host} for FocusriteControlServer across ${candidates.length} candidate ports`)

	for (let offset = 0; offset < candidates.length; offset += batchSize) {
		if (isCancelled?.()) {
			log?.('Port discovery cancelled')
			return null
		}

		const batch = candidates.slice(offset, offset + batchSize)
		const results = await Promise.all(batch.map((port) => probePort({ host, port, timeoutMs })))

		let match = null
		for (let i = 0; i < batch.length; i++) {
			if (!results[i]) continue
			if (match === null || batch[i] < match) match = batch[i]
		}

		if (match !== null) {
			log?.(`Found FocusriteControlServer on ${host}:${match}`)
			return match
		}
	}

	log?.(`No FocusriteControlServer found on ${host}`)
	return null
}
