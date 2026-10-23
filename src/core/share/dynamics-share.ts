/**
 * @file dynamics-share.ts
 * @brief Validated v0.7 sidecar params without changing the immutable v1 token.
 */
import type { AppState, RunningGear } from '../models';
import { defaultRunningGear } from '../state/app-state';
import { defaultDynamicsSettings, type DynamicsSettings } from '../state/dynamics-settings';
import { numParam } from './running-gear-share';
import { parseLapCommands } from '../math/lap-sequence';

const NUMBERS: [keyof DynamicsSettings, number, number, boolean][] = [
	['brakeFrontBias', 0, 1, false], ['brakeDemandG', 0, 3, false], ['cornerRadiusM', 1, 1000, false],
	['cornerMaxG', 0.05, 3, false], ['approachGear', 1, 8, true], ['sequenceSpeedKmh', 0, 500, false],
];
const ENUMS: Partial<Record<keyof DynamicsSettings, readonly string[]>> = {
	limiter: ['hard', 'bounce'], gearbox: ['synchro', 'dog'], graphView: ['rpm', 'force', 'braking'],
};
const BOOLEANS: (keyof DynamicsSettings)[] = ['abs', 'efficiencyMap', 'revMatch', 'tractionOverlay', 'useGearboxDefaults'];
const RG_NUMBERS: [string, keyof RunningGear, number, number, number][] = [
	['dp', 'differentialPreloadNm', 0, 500, 0], ['af', 'awdFrontShare', 0, 1, 0.5],
	['cl', 'centerDiffLock', 0, 1, 0], ['tv', 'torqueVectoring', 0, 1, 0],
];
const RG_BOOLEANS: [string, keyof RunningGear, boolean][] = [
	['hd', 'handbrakeDisengage', true], ['ha', 'handbrakeApplied', false],
];

/**
 * @brief Encode non-default extended controls alongside either share encoding.
 * @param params Params receiving sidecar keys.
 * @param s State being shared.
 * @return void
 */
export const encodeDynamicsParams = (params: URLSearchParams, s: AppState): void => {
	for (const key of Object.keys(defaultDynamicsSettings) as (keyof DynamicsSettings)[]) {
		const value = s.dynamics[key];
		if (JSON.stringify(value) === JSON.stringify(defaultDynamicsSettings[key])) continue;
		params.set(`d_${key}`, Array.isArray(value) ? value.join(',') : String(value));
	}
	for (const [prefix, rg] of [['rg_', s.runningGear], ['crg_', s.compRunningGear]] as const) {
		for (const [slug, key, , , fallback] of RG_NUMBERS) {
			const value = rg[key] ?? fallback;
			if (value !== fallback) params.set(prefix + slug, String(value));
		}
		for (const [slug, key, fallback] of RG_BOOLEANS) {
			const value = rg[key] ?? fallback;
			if (value !== fallback) params.set(prefix + slug, value ? '1' : '0');
		}
	}
};

/**
 * @brief Decode extended settings with bounds, exact enums and array validation.
 * @param params Shared params.
 * @return Valid settings, or null when no valid sidecar settings exist.
 */
const decodeSettings = (params: URLSearchParams): DynamicsSettings | null => {
	const out: DynamicsSettings = { ...defaultDynamicsSettings, shiftTimesS: [] };
	let changed = false;
	for (const [key, min, max, integer] of NUMBERS) {
		const value = numParam(params, `d_${key}`, min, max);
		if (value === null || (integer && !Number.isInteger(value))) continue;
		(out[key] as number) = value;
		changed = true;
	}
	for (const [key, allowed] of Object.entries(ENUMS)) {
		const value = params.get(`d_${key}`);
		if (!value || !allowed.includes(value)) continue;
		(out[key as keyof DynamicsSettings] as string) = value;
		changed = true;
	}
	for (const key of BOOLEANS) {
		const value = params.get(`d_${key}`);
		if (value !== 'true' && value !== 'false') continue;
		(out[key] as boolean) = value === 'true';
		changed = true;
	}
	const shiftTimes = params.get('d_shiftTimesS');
	if (shiftTimes !== null && shiftTimes.length <= 100) {
		const values = shiftTimes.trim() ? shiftTimes.split(',').map(Number) : [];
		if (values.length <= 8 && !shiftTimes.split(',').some((v) => shiftTimes.trim() && !v.trim())
			&& values.every((v) => Number.isFinite(v) && v >= 0 && v <= 3)) {
			out.shiftTimesS = values;
			changed = true;
		}
	}
	const csv = params.get('d_sequenceCsv');
	if (csv && parseLapCommands(csv)) {
		out.sequenceCsv = csv;
		changed = true;
	}
	return changed ? out : null;
};

/**
 * @brief Merge extended differential values into decoded stock/compact running gear.
 * @param params Shared params.
 * @param prefix Primary or comparison param prefix.
 * @param base Previously decoded running gear.
 * @return Merged running gear, null when no valid extension was present.
 */
const decodeExtendedGear = (params: URLSearchParams, prefix: string, base?: RunningGear): RunningGear | null => {
	const out = { ...(base ?? defaultRunningGear) };
	let changed = false;
	for (const [slug, key, min, max] of RG_NUMBERS) {
		const value = numParam(params, prefix + slug, min, max);
		if (value === null) continue;
		(out[key] as number) = value;
		changed = true;
	}
	for (const [slug, key] of RG_BOOLEANS) {
		const value = params.get(prefix + slug);
		if (value !== '1' && value !== '0') continue;
		(out[key] as boolean) = value === '1';
		changed = true;
	}
	return changed ? out : null;
};

/**
 * @brief Decode sidecars after the base so chassis values are never reset.
 * @param params Shared params.
 * @param base Previously decoded compact or verbose fields.
 * @return Extended state patch.
 */
export const decodeDynamicsParams = (params: URLSearchParams, base: Partial<AppState>): Partial<AppState> => {
	const out: Partial<AppState> = {};
	const dynamics = decodeSettings(params);
	const rg = decodeExtendedGear(params, 'rg_', base.runningGear);
	const crg = decodeExtendedGear(params, 'crg_', base.compRunningGear);
	if (dynamics) out.dynamics = dynamics;
	if (rg) out.runningGear = rg;
	if (crg) out.compRunningGear = crg;
	return out;
};
