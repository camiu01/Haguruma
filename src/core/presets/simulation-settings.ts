/**
 * @file simulation-settings.ts
 * @brief Validate and clone optional saved powertrain settings.
 */
import type { AppState } from '../models';
import { validateEfficiencyMap } from '../math/efficiency-map';

/**
 * @brief Reject invalid settings atomically and return independently owned arrays.
 * @param value Untrusted optional settings.
 * @return Validated settings or null.
 */
export const parseSimulationSettings = (value: unknown): NonNullable<AppState['simulation']> | null => {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
	const raw = value as Record<string, unknown>;
	if ((raw.limiterMode !== 'hard' && raw.limiterMode !== 'bounce') || !Array.isArray(raw.shiftTimesS)
		|| raw.shiftTimesS.length > 7 || raw.shiftTimesS.some((time) => typeof time !== 'number' || !Number.isFinite(time) || time < 0 || time > 3)) return null;
	const result: NonNullable<AppState['simulation']> = { limiterMode: raw.limiterMode, shiftTimesS: [...raw.shiftTimesS] };
	if (raw.efficiencyMap !== undefined) {
		const map = validateEfficiencyMap(raw.efficiencyMap);
		if (!map) return null;
		result.efficiencyMap = map;
	}
	return result;
};
