/**
 * @file share-utils.ts
 * @brief Encode and decode the full setup into a shareable URL hash.
 */
import { state } from '../state/app-state';
import type { AppState } from '../models';
import { parseCompGears } from '../compare/compare-utils';
import { parseTire } from '../math/tire-math';

/**
 * @brief Serialize current state into a compact hash string.
 * @brief Hash holds setup fields only, unit and theme stay in localStorage.
 * @param s Full application state.
 * @return URL-encoded query string without leading #.
 */
export const encodeState = (s: AppState): string => {
	const p = new URLSearchParams();
	p.set('tire', s.primaryTire);
	p.set('fd', String(s.primaryFd));
	p.set('rl', String(s.primaryRedline));
	p.set('max', String(s.maxGraphSpeed));
	p.set('g', s.gears.join(','));
	if (s.reverseRatio !== null) {
		p.set('rev', String(s.reverseRatio));
	}
	p.set('cmp', s.compareEnabled ? '1' : '0');
	p.set('ctire', s.compTire);
	p.set('cfd', String(s.compFd));
	p.set('cg', s.compGears.join(','));
	p.set('crl', String(s.compRedline));
	p.set('cmass', String(s.compMassKg));
	p.set('ccd', String(s.compCd));
	p.set('carea', String(s.compFrontalAreaM2));
	p.set('cpw', String(s.compPowerKw));
	p.set('ctq', String(s.compPeakTorqueRpm));
	p.set('ctqn', String(s.compPeakTorqueNm));
	p.set('cpwr', String(s.compPeakPowerRpm));
	p.set('mass', String(s.vehicleMassKg));
	p.set('cd', String(s.dragCd));
	p.set('area', String(s.frontalAreaM2));
	p.set('crr', String(s.rollingCrr));
	p.set('pw', String(s.enginePowerKw));
	p.set('eff', String(s.drivetrainEff));
	p.set('rle', s.roadLoadEnabled ? '1' : '0');
	p.set('grade', String(s.roadGradePercent));
	p.set('rf', String(s.rollingFactor));
	p.set('tq', String(s.peakTorqueRpm));
	p.set('tqn', String(s.peakTorqueNm));
	p.set('pwr', String(s.peakPowerRpm));
	return p.toString();
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
	const cfd = numParam(params, 'cfd', 1.0, 10.0);
	if (cfd !== null) {
		out.compFd = cfd;
	}
	const cg = parseCompGears(params.get('cg') ?? '');
	if (cg) {
		out.compGears = cg;
	}
	const crl = numParam(params, 'crl', 3000, 12000);
	if (crl !== null) {
		out.compRedline = Math.round(crl);
	}
	const cmass = numParam(params, 'cmass', 500, 3000);
	if (cmass !== null) {
		out.compMassKg = cmass;
	}
	const ccd = numParam(params, 'ccd', 0.15, 0.6);
	if (ccd !== null) {
		out.compCd = ccd;
	}
	const carea = numParam(params, 'carea', 1.0, 4.0);
	if (carea !== null) {
		out.compFrontalAreaM2 = carea;
	}
	const cpw = numParam(params, 'cpw', 30, 500);
	if (cpw !== null) {
		out.compPowerKw = cpw;
	}
	const ctq = numParam(params, 'ctq', 1000, 12000);
	if (ctq !== null) {
		out.compPeakTorqueRpm = Math.round(ctq);
	}
	const ctqn = numParam(params, 'ctqn', 20, 1500);
	if (ctqn !== null) {
		out.compPeakTorqueNm = ctqn;
	}
	const cpwr = numParam(params, 'cpwr', 1000, 12000);
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
	const mass = numParam(params, 'mass', 500, 3000);
	if (mass !== null) {
		out.vehicleMassKg = mass;
	}
	const cd = numParam(params, 'cd', 0.15, 0.6);
	if (cd !== null) {
		out.dragCd = cd;
	}
	const area = numParam(params, 'area', 1.0, 4.0);
	if (area !== null) {
		out.frontalAreaM2 = area;
	}
	const crr = numParam(params, 'crr', 0.005, 0.03);
	if (crr !== null) {
		out.rollingCrr = crr;
	}
	const pw = numParam(params, 'pw', 30, 500);
	if (pw !== null) {
		out.enginePowerKw = pw;
	}
	const eff = numParam(params, 'eff', 0.7, 1.0);
	if (eff !== null) {
		out.drivetrainEff = eff;
	}
	const rle = params.get('rle');
	if (rle === '1' || rle === '0') {
		out.roadLoadEnabled = rle === '1';
	}
	const grade = numParam(params, 'grade', -30, 30);
	if (grade !== null) {
		out.roadGradePercent = grade;
	}
	const rf = numParam(params, 'rf', 0.9, 1.0);
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
