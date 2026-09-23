/**
 * @file share-utils.ts
 * @brief Encode and decode the full setup into a shareable URL hash.
 */
import { state } from '../state/app-state';
import type { AppState } from '../models';
import { parseCompGears } from '../compare/compare-utils';
import { parseTire } from '../math/tire-math';
import { defaultRunningGear } from '../state/app-state';
import type { DifferentialType, DrivetrainLayout, RunningGear } from '../models';

/**
 * @brief Serialize current state into a compact hash string.
 * @brief Hash holds setup fields only, unit and theme stay in localStorage.
 * @param s Full application state.
 * @return URL-encoded query string without leading #.
 */
export const encodeState = (s: AppState): string => {
	const p = new URLSearchParams();
	p.set('tire', s.primaryTire); p.set('fd', String(s.primaryFd)); p.set('rl', String(s.primaryRedline));
	p.set('max', String(s.maxGraphSpeed)); p.set('g', s.gears.join(','));
	if (s.reverseRatio !== null) {
		p.set('rev', String(s.reverseRatio));
	}
	p.set('cmp', s.compareEnabled ? '1' : '0'); p.set('ctire', s.compTire); p.set('cfd', String(s.compFd));
	p.set('cg', s.compGears.join(',')); p.set('crl', String(s.compRedline)); p.set('cmass', String(s.compMassKg));
	p.set('ccd', String(s.compCd)); p.set('carea', String(s.compFrontalAreaM2)); p.set('cpw', String(s.compPowerKw));
	p.set('ctq', String(s.compPeakTorqueRpm)); p.set('ctqn', String(s.compPeakTorqueNm)); p.set('cpwr', String(s.compPeakPowerRpm));
	p.set('mass', String(s.vehicleMassKg)); p.set('cd', String(s.dragCd)); p.set('area', String(s.frontalAreaM2));
	p.set('crr', String(s.rollingCrr)); p.set('pw', String(s.enginePowerKw)); p.set('eff', String(s.drivetrainEff));
	p.set('rle', s.roadLoadEnabled ? '1' : '0'); p.set('grade', String(s.roadGradePercent)); p.set('rf', String(s.rollingFactor));
	p.set('tq', String(s.peakTorqueRpm)); p.set('tqn', String(s.peakTorqueNm)); p.set('pwr', String(s.peakPowerRpm));
	encodeRunningGear(p, s.runningGear ?? defaultRunningGear, 'rg_');
	encodeRunningGear(p, s.compRunningGear ?? s.runningGear ?? defaultRunningGear, 'crg_');
	return p.toString();
};

/**
 * @brief Serialize a running-gear setup with a key prefix.
 * @param p Params receiving the keys.
 * @param rg Running-gear setup to encode.
 * @param prefix Key prefix (rg_ or crg_).
 * @return void
 */
const encodeRunningGear = (p: URLSearchParams, rg: RunningGear, prefix: string): void => {
	const n2 = (v: number): string => v.toFixed(2);
	p.set(`${prefix}wd`, n2(rg.frontWeightDistribution)); p.set(`${prefix}cg`, String(Math.round(rg.centerOfGravityHeightMm)));
	p.set(`${prefix}wb`, String(Math.round(rg.wheelbaseMm))); p.set(`${prefix}tw`, String(Math.round(rg.trackWidthMm)));
	p.set(`${prefix}mu`, n2(rg.roadFrictionCoefficient)); p.set(`${prefix}lay`, rg.drivetrainLayout); p.set(`${prefix}df`, rg.differentialType);
	p.set(`${prefix}db`, n2(rg.differentialBias)); p.set(`${prefix}sf`, String(Math.round(rg.springRateFrontNmm)));
	p.set(`${prefix}sr`, String(Math.round(rg.springRateRearNmm))); p.set(`${prefix}lat`, n2(rg.lateralG));
};

/**
 * @brief Build a full shareable URL for the current state.
 * @return Absolute URL with the setup in the hash.
 */
export const buildShareUrl = (): string => {
	const base = `${window.location.origin}${window.location.pathname}`;
	return `${base}#${encodeState(state)}`;
};

/**
 * @brief Update the address bar hash without reloading.
 * @return void
 */
export const syncUrlHash = (): void => {
	try {
		const hash = `#${encodeState(state)}`;
		window.history.replaceState(null, '', hash);
	} catch {
		return;
	}
};

/**
 * @brief Parse a hash string back into validated state fields.
 * @brief Hash holds setup fields only, unit and theme stay in localStorage.
 * @param hash Raw location.hash value with or without leading #.
 * @return Partial state with only valid fields applied.
 */
export const decodeState = (hash: string): Partial<AppState> => {
	const clean = hash.startsWith('#') ? hash.slice(1) : hash;
	if (!clean) {
		return {};
	}
	let params: URLSearchParams;
	try {
		params = new URLSearchParams(clean);
	} catch {
		return {};
	}
	return {
		...decodePrimaryParams(params),
		...decodeCompareParams(params),
		...decodeRoadParams(params),
		...decodeEngineParams(params),
		...decodeGripParams(params),
	};
};

/**
 * @brief Decode primary setup params.
 * @param params Parsed query params.
 * @return Partial primary fields.
 */
const decodePrimaryParams = (params: URLSearchParams): Partial<AppState> => {
	const out: Partial<AppState> = {};
	const tire = params.get('tire');
	if (tire && parseTire(tire)) {
		out.primaryTire = tire.toUpperCase();
	}
	const fd = numParam(params, 'fd', 1.0, 10.0);
	if (fd !== null) {
		out.primaryFd = fd;
	}
	const rl = numParam(params, 'rl', 3000, 12000);
	if (rl !== null) {
		out.primaryRedline = Math.round(rl);
	}
	const max = numParam(params, 'max', 50, 500);
	if (max !== null) {
		out.maxGraphSpeed = Math.round(max);
	}
	const gears = parseCompGears(params.get('g') ?? '');
	if (gears) {
		out.gears = gears;
	}
	const revRaw = params.get('rev');
	if (revRaw !== null) {
		decodeReverseParam(revRaw, out);
	}
	const cmp = params.get('cmp');
	if (cmp === '1' || cmp === '0') {
		out.compareEnabled = cmp === '1';
	}
	return out;
};

/**
 * @brief Decode one reverse param value.
 * @param revRaw Raw reverse param.
 * @param out Patch receiving the value.
 * @return void
 */
const decodeReverseParam = (revRaw: string, out: Partial<AppState>): void => {
	if (revRaw === '') {
		out.reverseRatio = null;
		return;
	}
	const rev = Number(revRaw);
	if (Number.isFinite(rev) && rev >= 1.0 && rev <= 6.0) {
		out.reverseRatio = rev;
	}
};

/**
 * @brief Decode secondary comparison params.
 * @param params Parsed query params.
 * @return Partial comparison fields.
 */
const decodeCompareParams = (params: URLSearchParams): Partial<AppState> => {
	const out: Partial<AppState> = {};
	const ctire = params.get('ctire');
	if (ctire && parseTire(ctire)) {
		out.compTire = ctire.toUpperCase();
	}
	const get = (k: string, min: number, max: number): number | null => numParam(params, k, min, max);
	const cfd = get('cfd', 1.0, 10.0);
	if (cfd !== null) {
		out.compFd = cfd;
	}
	const cg = parseCompGears(params.get('cg') ?? '');
	if (cg) {
		out.compGears = cg;
	}
	const crl = get('crl', 3000, 12000);
	if (crl !== null) {
		out.compRedline = Math.round(crl);
	}
	const cmass = get('cmass', 500, 3000);
	if (cmass !== null) {
		out.compMassKg = cmass;
	}
	const ccd = get('ccd', 0.15, 0.6);
	if (ccd !== null) {
		out.compCd = ccd;
	}
	const carea = get('carea', 1.0, 4.0);
	if (carea !== null) {
		out.compFrontalAreaM2 = carea;
	}
	const cpw = get('cpw', 30, 500);
	if (cpw !== null) {
		out.compPowerKw = cpw;
	}
	const ctq = get('ctq', 1000, 12000);
	if (ctq !== null) {
		out.compPeakTorqueRpm = Math.round(ctq);
	}
	const ctqn = get('ctqn', 20, 1500);
	if (ctqn !== null) {
		out.compPeakTorqueNm = ctqn;
	}
	const cpwr = get('cpwr', 1000, 12000);
	if (cpwr !== null) {
		out.compPeakPowerRpm = Math.round(cpwr);
	}
	return out;
};

/**
 * @brief Decode road-load params.
 * @param params Parsed query params.
 * @return Partial road-load fields.
 */
const decodeRoadParams = (params: URLSearchParams): Partial<AppState> => {
	const out: Partial<AppState> = {};
	const get = (k: string, min: number, max: number): number | null => numParam(params, k, min, max);
	const mass = get('mass', 500, 3000);
	if (mass !== null) {
		out.vehicleMassKg = mass;
	}
	const cd = get('cd', 0.15, 0.6);
	if (cd !== null) {
		out.dragCd = cd;
	}
	const area = get('area', 1.0, 4.0);
	if (area !== null) {
		out.frontalAreaM2 = area;
	}
	const crr = get('crr', 0.005, 0.03);
	if (crr !== null) {
		out.rollingCrr = crr;
	}
	const pw = get('pw', 30, 500);
	if (pw !== null) {
		out.enginePowerKw = pw;
	}
	const eff = get('eff', 0.7, 1.0);
	if (eff !== null) {
		out.drivetrainEff = eff;
	}
	const rle = params.get('rle');
	if (rle === '1' || rle === '0') {
		out.roadLoadEnabled = rle === '1';
	}
	const grade = get('grade', -30, 30);
	if (grade !== null) {
		out.roadGradePercent = grade;
	}
	const rf = get('rf', 0.9, 1.0);
	if (rf !== null) {
		out.rollingFactor = rf;
	}
	return out;
};

/**
 * @brief Decode engine-curve params.
 * @param params Parsed query params.
 * @return Partial engine fields.
 */
const decodeEngineParams = (params: URLSearchParams): Partial<AppState> => {
	const out: Partial<AppState> = {};
	const tq = numParam(params, 'tq', 1000, 12000);
	if (tq !== null) {
		out.peakTorqueRpm = Math.round(tq);
	}
	const tqn = numParam(params, 'tqn', 20, 1500);
	if (tqn !== null) {
		out.peakTorqueNm = tqn;
	}
	const pwr = numParam(params, 'pwr', 1000, 12000);
	if (pwr !== null) {
		out.peakPowerRpm = Math.round(pwr);
	}
	return out;
};

/**
 * @brief Decode primary and secondary running-gear params.
 * @param params Parsed query params.
 * @return Partial grip fields, empty when no rg keys are present.
 */
const decodeGripParams = (params: URLSearchParams): Partial<AppState> => {
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
	['wb', 'wheelbaseMm', 2000, 3200, true],
	['tw', 'trackWidthMm', 1200, 1800, true],
	['mu', 'roadFrictionCoefficient', 1.0, 1.3, false],
	['db', 'differentialBias', 0, 0.6, false],
	['sf', 'springRateFrontNmm', 10, 120, true],
	['sr', 'springRateRearNmm', 10, 120, true],
	['lat', 'lateralG', 0, 2, false],
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
	return out;
};

/**
 * @brief Apply a decoded partial state to the live store.
 * @param patch Validated fields from the URL.
 * @return True when at least one field was applied.
 */
export const applySharedState = (patch: Partial<AppState>): boolean => {
	const keys = Object.keys(patch) as (keyof AppState)[];
	if (keys.length === 0) {
		return false;
	}
	for (const key of keys) {
		applySharedKey(key, patch[key]);
	}
	return true;
};

/**
 * @brief Apply one decoded field with array deep-clone.
 * @param key State key to write.
 * @param value Decoded value for the key.
 * @return void
 */
const applySharedKey = (key: keyof AppState, value: Partial<AppState>[keyof AppState]): void => {
	if (value === undefined) {
		return;
	}
	if (key === 'gears' || key === 'compGears') {
		(state[key] as number[]) = [...(value as number[])];
		return;
	}
	if (key === 'runningGear' || key === 'compRunningGear') {
		(state[key] as unknown) = { ...(value as object) };
		return;
	}
	(state[key] as unknown) = value;
};

/**
 * @brief Read a numeric query param within range.
 * @param params Parsed query params.
 * @param key Param name.
 * @param min Minimum accepted value.
 * @param max Maximum accepted value.
 * @return Number or null when missing or invalid.
 */
const numParam = (params: URLSearchParams, key: string, min: number, max: number): number | null => {
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
