/**
 * @file graph-window-share.ts
 * @brief Unit-independent, validated graph windows alongside legacy share tokens.
 */
import type { AppState } from '../models';

/**
 * @brief Decode all four window bounds atomically.
 * @param params Parsed URL parameters.
 * @return Valid window patch, or no changes for absent/invalid bounds.
 */
export const decodeGraphWindow = (params: URLSearchParams): Partial<AppState> => {
	const keys = ['z_min', 'z_max', 'z_rmin', 'z_rmax'];
	if (keys.some((key) => !params.get(key)?.trim())) {
		return {};
	}
	const [minKmh, maxKmh, minRpm, maxRpm] = keys.map((key) => Number(params.get(key)));
	if (![minKmh, maxKmh, minRpm, maxRpm].every(Number.isFinite)
		|| minKmh < 0 || maxKmh > 2000 || maxKmh - minKmh < 5
		|| minRpm < 0 || maxRpm > 30000 || maxRpm - minRpm < 250) {
		return {};
	}
	return { graphWindow: { minKmh, maxKmh, minRpm, maxRpm } };
};

/**
 * @brief Append the current window without modifying the packed protocol.
 * @param params Destination URL parameters.
 * @param s Setup carrying an optional graph window.
 * @return void
 */
export const encodeGraphWindow = (params: URLSearchParams, s: AppState): void => {
	const w = s.graphWindow;
	if (!w) {
		return;
	}
	params.set('z_min', String(w.minKmh));
	params.set('z_max', String(w.maxKmh));
	params.set('z_rmin', String(w.minRpm));
	params.set('z_rmax', String(w.maxRpm));
};
