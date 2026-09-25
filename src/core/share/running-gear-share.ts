/**
 * @file running-gear-share.ts
 * @brief Running-gear hash encode/decode plus the shared numeric param reader.
 */
import type { AppState, DifferentialType, DrivetrainLayout, RunningGear } from '../models';
import { defaultRunningGear } from '../state/app-state';
import { findDiffPreset } from '../../config/diff-presets';

/**
 * @brief Serialize a running-gear setup with a key prefix.
 * @param p Params receiving the keys.
 * @param rg Running-gear setup to encode.
 * @param prefix Key prefix (rg_ or crg_).
 * @return void
 */
export const encodeRunningGear = (p: URLSearchParams, rg: RunningGear, prefix: string): void => {
	const n2 = (v: number): string => v.toFixed(2);
	p.set(`${prefix}wd`, n2(rg.frontWeightDistribution)); p.set(`${prefix}cg`, String(Math.round(rg.centerOfGravityHeightMm)));
	p.set(`${prefix}wb`, String(Math.round(rg.wheelbaseMm))); p.set(`${prefix}tw`, String(Math.round(rg.trackWidthMm)));
	p.set(`${prefix}mu`, n2(rg.roadFrictionCoefficient)); p.set(`${prefix}lay`, rg.drivetrainLayout); p.set(`${prefix}df`, rg.differentialType);
	p.set(`${prefix}db`, n2(rg.differentialBias)); p.set(`${prefix}dc`, n2(rg.differentialCoastBias ?? 0));
	if (rg.differentialModelId) {
		p.set(`${prefix}dm`, rg.differentialModelId);
	}
	p.set(`${prefix}sf`, String(Math.round(rg.springRateFrontNmm)));
	p.set(`${prefix}sr`, String(Math.round(rg.springRateRearNmm))); p.set(`${prefix}lat`, n2(rg.lateralG));
	p.set(`${prefix}lc`, n2(rg.liftCoefficient ?? 0));
	p.set(`${prefix}la`, n2(rg.liftReferenceAreaM2 ?? 0));
	p.set(`${prefix}ls`, n2(rg.downforceFrontShare ?? rg.frontWeightDistribution));
};

/**
 * @brief Decode primary and secondary running-gear params.
 * @param params Parsed query params.
 * @return Partial grip fields, empty when no rg keys are present.
 */
export const decodeGripParams = (params: URLSearchParams): Partial<AppState> => {
	const out: Partial<AppState> = {};
	const rg = decodeRunningGearParams(params, 'rg_');
	if (Object.keys(rg).length > 0) {
		out.runningGear = { ...defaultRunningGear, ...rg };
	}
	const crg = decodeRunningGearParams(params, 'crg_');
	if (Object.keys(crg).length > 0) {
		out.compRunningGear = { ...defaultRunningGear, ...crg };
	}
	return out;
};

/** Numeric grip fields with ranges: key, prop, min, max, round. */
type GripSpec = [string, keyof RunningGear, number, number, boolean];

/** Shared numeric spec table for both rg_ and crg_ prefixes. */
const GRIP_SPECS: GripSpec[] = [
	['wd', 'frontWeightDistribution', 0.4, 0.7, false],
	['cg', 'centerOfGravityHeightMm', 200, 800, true],
	['wb', 'wheelbaseMm', 2000, 3500, true],
	['tw', 'trackWidthMm', 1200, 1800, true],
	['mu', 'roadFrictionCoefficient', 0.5, 1.6, false],
	['db', 'differentialBias', 0, 1, false],
	['dc', 'differentialCoastBias', 0, 1, false],
	['sf', 'springRateFrontNmm', 10, 120, true],
	['sr', 'springRateRearNmm', 10, 120, true],
	['lat', 'lateralG', 0, 2, false],
	['lc', 'liftCoefficient', 0, 4, false],
	['la', 'liftReferenceAreaM2', 0.5, 5, false],
	['ls', 'downforceFrontShare', 0.2, 0.8, false],
];

/**
 * @brief Decode one running-gear block with range and enum guards.
 * @param params Parsed query params.
 * @param prefix Key prefix (rg_ or crg_).
 * @return Partial running gear, empty when no keys are present.
 */
export const decodeRunningGearParams = (params: URLSearchParams, prefix: string): Partial<RunningGear> => {
	const out: Partial<RunningGear> = {};
	for (const [key, prop, min, max, round] of GRIP_SPECS) {
		const v = numParam(params, `${prefix}${key}`, min, max);
		if (v !== null) {
			(out[prop] as number) = round ? Math.round(v) : v;
		}
	}
	const lay = params.get(`${prefix}lay`);
	if (lay === 'FWD' || lay === 'RWD' || lay === 'AWD') {
		out.drivetrainLayout = lay as DrivetrainLayout;
	}
	const df = params.get(`${prefix}df`);
	if (df === 'open' || df === 'torsen' || df === 'clutch_lsd' || df === 'spool') {
		out.differentialType = df as DifferentialType;
	}
	const dm = params.get(`${prefix}dm`);
	if (dm && findDiffPreset(dm)) {
		out.differentialModelId = dm;
	}
	return out;
};

/**
 * @brief Read a numeric query param within range.
 * @param params Parsed query params.
 * @param key Param name.
 * @param min Minimum accepted value.
 * @param max Maximum accepted value.
 * @return Number or null when missing or invalid.
 */
export const numParam = (params: URLSearchParams, key: string, min: number, max: number): number | null => {
	const raw = params.get(key);
	if (raw === null || raw.trim() === '') {
		return null;
	}
	const v = Number(raw);
	if (!Number.isFinite(v) || v < min || v > max) {
		return null;
	}
	return v;
};
