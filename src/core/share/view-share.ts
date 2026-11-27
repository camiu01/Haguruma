/**
 * @file view-share.ts
 * @brief Encode and decode the zoomed plot window (`z` key) in the share hash.
 *
 * The key sits next to the packed `c` token as `z=minKmh:maxKmh:minRpm:maxRpm`,
 * so a zoomed view can be shared and restored. It is omitted while the plot
 * shows the full axis, and an invalid value is ignored (legacy-safe).
 */
import type { AppState, GraphWindow } from '../models';

/** Accepted bounds for a shared window. */
const LIMITS = { maxKmh: 600, maxRpm: 20000 } as const;

/**
 * @brief Append the zoom window to the share params when the plot is zoomed.
 * @param p Params receiving the key.
 * @param s Full application state.
 * @return void
 */
export const encodeViewParams = (p: URLSearchParams, s: AppState): void => {
	const w = s.graphWindow;
	if (!w) {
		return;
	}
	p.set('z', [w.minKmh, w.maxKmh, w.minRpm, w.maxRpm].map((v) => String(Math.round(v * 10) / 10)).join(':'));
};

/**
 * @brief Parse the `z` key back into a validated window.
 * @param params Parsed hash params.
 * @return Partial state with `graphWindow`, or empty when absent or invalid.
 */
export const decodeViewParams = (params: URLSearchParams): Partial<AppState> => {
	const raw = params.get('z');
	if (!raw) {
		return {};
	}
	const parts = raw.split(':').map(Number);
	if (parts.length !== 4 || !parts.every(Number.isFinite)) {
		return {};
	}
	const [minKmh, maxKmh, minRpm, maxRpm] = parts;
	const window: GraphWindow = { minKmh, maxKmh, minRpm, maxRpm };
	const valid = minKmh >= 0 && maxKmh > minKmh && maxKmh <= LIMITS.maxKmh && minRpm >= 0 && maxRpm > minRpm && maxRpm <= LIMITS.maxRpm;
	return valid ? { graphWindow: window } : {};
};
