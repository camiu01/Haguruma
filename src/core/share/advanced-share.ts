/**
 * @file advanced-share.ts
 * @brief Optional v0.7+ fields without changing legacy packed payloads.
 */
import type { AppState, RunningGear } from '../models';
import { validateEfficiencyMap } from '../math/efficiency-map';

const FIELDS = ['awdFrontShare', 'differentialPreloadNm', 'preloadRadiusM', 'centerDisengaged', 'activeCenter', 'handbrakeFraction'] as const;

/**
 * @brief Append advanced values outside the immutable compact token.
 * @param params Share params.
 * @param s Application state.
 * @return void
 */
export const encodeAdvancedState = (params: URLSearchParams, s: AppState): void => {
	if (s.graphMode === 'force') params.set('view', 'force');
	if (s.showTractionMargin) params.set('margin', '1');
	if (s.simulation) params.set('sim', JSON.stringify(s.simulation));
	for (const [prefix, rg] of [['rgx', s.runningGear], ['crgx', s.compRunningGear]] as const) {
		const values: Record<string, unknown> = {};
		for (const field of FIELDS) if (rg[field] !== undefined) values[field] = rg[field];
		if (Object.keys(values).length > 0) params.set(prefix, JSON.stringify(values));
	}
};

/**
 * @brief Read bounded advanced fields and merge with already-decoded running gear.
 * @param params Share params.
 * @param base Previously decoded state.
 * @return Optional extension fields.
 */
export const decodeAdvancedState = (params: URLSearchParams, base: Partial<AppState>): Partial<AppState> => {
	const out: Partial<AppState> = {};
	if (params.get('view') === 'force') out.graphMode = 'force';
	if (params.get('margin') === '1') out.showTractionMargin = true;
	try {
		const raw = params.get('sim');
		if (raw && raw.length < 25000) {
			const sim = JSON.parse(raw);
			if (sim && ['hard', 'bounce'].includes(sim.limiterMode) && Array.isArray(sim.shiftTimesS)
				&& sim.shiftTimesS.length <= 7 && sim.shiftTimesS.every((value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 3)) {
				out.simulation = { limiterMode: sim.limiterMode, shiftTimesS: [...sim.shiftTimesS] };
				const map = validateEfficiencyMap(sim.efficiencyMap);
				if (map) out.simulation.efficiencyMap = map;
			}
		}
	} catch { /* A malformed extension must not discard the legacy setup. */ }
	for (const [prefix, key] of [['rgx', 'runningGear'], ['crgx', 'compRunningGear']] as const) {
		const values = decodeAdvancedGear(params.get(prefix));
		const gear = base[key];
		if (values && gear) out[key] = { ...gear, ...values };
	}
	return out;
};

/**
 * @brief Validate the optional differential extension independently.
 * @param text Raw JSON payload.
 * @return Sanitized partial running gear, null if malformed.
 */
const decodeAdvancedGear = (text: string | null): Partial<RunningGear> | null => {
	if (!text || text.length > 1000) return null;
	try {
		const raw = JSON.parse(text);
		if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
		const out: Partial<RunningGear> = {};
		for (const [key, min, max] of [['awdFrontShare', 0, 1], ['differentialPreloadNm', 0, 1000], ['preloadRadiusM', 0.1, 1], ['handbrakeFraction', 0, 1]] as const) {
			const value = raw[key];
			if (typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max) out[key] = value;
		}
		if (typeof raw.centerDisengaged === 'boolean') out.centerDisengaged = raw.centerDisengaged;
		if (typeof raw.activeCenter === 'boolean') out.activeCenter = raw.activeCenter;
		return out;
	} catch { return null; }
};
