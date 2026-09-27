/**
 * @file share-compact.ts
 * @brief Packed Base64URL codec for ultra-compact share links (no dependencies).
 *
 * Legacy primary layout (v0): tire width/aspect/rim (3B), fd x100 (2B),
 * redline (2B), gear count (1B), gears x1000 (2B each, max 8), reverse x1000 (2B, 0 = null).
 * Full-state layout (v1, first byte 1): flags, primary, compare, road/engine
 * and both running-gear blocks as scaled big-endian integers.
 */
import { parseTire } from '../math/tire-math';
import type { AppState, RunningGear } from '../models';
import { defaultRunningGear } from '../state/app-state';
import { DIFF_PRESETS } from '../../config/diff-presets';

export interface CompactSetup {
	/** Tire string like 205/55R16. */
	tire: string;
	/** Final drive ratio. */
	fd: number;
	/** Rev limiter in RPM. */
	redline: number;
	/** Forward gear ratios. */
	gears: number[];
	/** Reverse ratio, null when unset. */
	reverseRatio: number | null;
}

/** Maximum gears carried by the compact payload. */
export const COMPACT_MAX_GEARS = 8;

/**
 * @brief Encode bytes as Base64URL.
 * @param bytes Raw bytes.
 * @return Base64URL string without padding.
 */
const toBase64Url = (bytes: Uint8Array): string => {
	let bin = '';
	for (const b of bytes) {
		bin += String.fromCharCode(b);
	}
	const b64 = typeof Buffer !== 'undefined' ? Buffer.from(bin, 'binary').toString('base64') : btoa(bin);
	return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

/**
 * @brief Decode a Base64URL string back to bytes.
 * @param code Base64URL payload.
 * @return Raw bytes, or null when malformed.
 */
const fromBase64Url = (code: string): Uint8Array | null => {
	if (!code || !/^[A-Za-z0-9_-]+$/.test(code)) {
		return null;
	}
	try {
		let b64 = code.replace(/-/g, '+').replace(/_/g, '/');
		while (b64.length % 4 !== 0) {
			b64 += '=';
		}
		const bin = typeof Buffer !== 'undefined' ? Buffer.from(b64, 'base64').toString('binary') : atob(b64);
		const out = new Uint8Array(bin.length);
		for (let i = 0; i < bin.length; i += 1) {
			out[i] = bin.charCodeAt(i);
		}
		return out;
	} catch {
		return null;
	}
};

/**
 * @brief Encode a primary setup into a compact token.
 * @param setup Tire, final drive, redline, gears and reverse.
 * @return Compact token, or null when inputs are invalid.
 */
export const encodeCompactSetup = (setup: CompactSetup): string | null => {
	const tire = parseTire(setup.tire);
	if (!tire || setup.gears.length === 0 || setup.gears.length > COMPACT_MAX_GEARS) {
		return null;
	}
	if (!(setup.fd >= 1 && setup.fd <= 10) || !(setup.redline >= 3000 && setup.redline <= 12000)) {
		return null;
	}
	const bytes = new Uint8Array(10 + setup.gears.length * 2);
	const view = new DataView(bytes.buffer);
	view.setUint8(0, Math.min(255, Math.round(tire.width)));
	view.setUint8(1, Math.min(99, Math.round(tire.aspect)));
	view.setUint8(2, Math.min(99, Math.round(tire.rimInch)));
	view.setUint16(3, Math.round(setup.fd * 100));
	view.setUint16(5, Math.round(setup.redline));
	view.setUint8(7, setup.gears.length);
	setup.gears.forEach((g, i) => {
		view.setUint16(8 + i * 2, Math.round(g * 1000));
	});
	const revOffset = 8 + setup.gears.length * 2;
	view.setUint16(revOffset, setup.reverseRatio === null ? 0 : Math.round(setup.reverseRatio * 1000));
	return toBase64Url(bytes.slice(0, revOffset + 2));
};

/**
 * @brief Decode a compact token back to a primary setup.
 * @param code Compact token from encodeCompactSetup.
 * @return Setup fields, or null when malformed.
 */
export const decodeCompactSetup = (code: string): CompactSetup | null => {
	const bytes = fromBase64Url(code);
	if (!bytes || bytes.length < 10) {
		return null;
	}
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	const count = view.getUint8(7);
	if (count === 0 || count > COMPACT_MAX_GEARS || bytes.length !== 10 + count * 2) {
		return null;
	}
	const gears: number[] = [];
	for (let i = 0; i < count; i += 1) {
		gears.push(view.getUint16(8 + i * 2) / 1000);
	}
	const revRaw = view.getUint16(8 + count * 2);
	const tire = `${view.getUint8(0)}/${view.getUint8(1)}R${view.getUint8(2)}`;
	if (!parseTire(tire)) {
		return null;
	}
	return {
		tire,
		fd: view.getUint16(3) / 100,
		redline: view.getUint16(5),
		gears,
		reverseRatio: revRaw === 0 ? null : revRaw / 1000,
	};
};

/** Full-state format version carried in the first byte. */
export const COMPACT_HASH_VERSION = 1;

/** Layout order for the packed drivetrain enum. */
const LAYOUTS = ['FWD', 'RWD', 'AWD'];

/** Differential order for the packed diff enum. */
const DTYPES = ['open', 'clutch_lsd', 'torsen', 'spool'];

/** Sentinel for an absent differential model id. */
const DM_ABSENT = 255;

/**
 * @brief Check a value against an inclusive range.
 * @param v Candidate value.
 * @param min Lower bound.
 * @param max Upper bound.
 * @return True when finite and inside range.
 */
const inR = (v: unknown, min: number, max: number): v is number => {
	return typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
};

/**
 * @brief Append one byte.
 * @param out Byte sink.
 * @param v Value 0-255.
 * @return void
 */
const pushU8 = (out: number[], v: number): void => {
	out.push(v & 0xff);
};

/**
 * @brief Append one big-endian uint16.
 * @param out Byte sink.
 * @param v Value 0-65535.
 * @return void
 */
const pushU16 = (out: number[], v: number): void => {
	out.push((v >> 8) & 0xff, v & 0xff);
};

/**
 * @brief Append a tire as width/aspect/rim bytes.
 * @param out Byte sink.
 * @param tire Tire string like 205/55R16.
 * @return True on success.
 */
const pushTire = (out: number[], tire: string): boolean => {
	const spec = parseTire(tire);
	if (!spec) {
		return false;
	}
	pushU8(out, Math.round(spec.width));
	pushU8(out, Math.round(spec.aspect));
	pushU8(out, Math.round(spec.rimInch));
	return true;
};

/**
 * @brief Append a gear list as count plus ratios x1000.
 * @param out Byte sink.
 * @param gears Forward gear ratios.
 * @return True on success.
 */
const pushGearList = (out: number[], gears: number[]): boolean => {
	if (!Array.isArray(gears) || gears.length === 0 || gears.length > COMPACT_MAX_GEARS) {
		return false;
	}
	pushU8(out, gears.length);
	for (const g of gears) {
		if (!inR(g, 0.4, 6.0)) {
			return false;
		}
		pushU16(out, Math.round(g * 1000));
	}
	return true;
};

/**
 * @brief Append one running-gear block as scaled integers.
 * @param out Byte sink.
 * @param rg Running-gear setup.
 * @return True on success.
 */
const pushGrip = (out: number[], rg: RunningGear): boolean => {
	if (!rg || !inR(rg.frontWeightDistribution, 0.4, 0.7) || !inR(rg.centerOfGravityHeightMm, 200, 800)) {
		return false;
	}
	if (!inR(rg.wheelbaseMm, 2000, 3500) || !inR(rg.trackWidthMm, 1200, 1800) || !inR(rg.roadFrictionCoefficient, 0.5, 1.6)) {
		return false;
	}
	const lay = LAYOUTS.indexOf(rg.drivetrainLayout);
	const df = DTYPES.indexOf(rg.differentialType);
	if (lay < 0 || df < 0 || !inR(rg.differentialBias, 0, 1) || !inR(rg.differentialCoastBias ?? 0, 0, 1)) {
		return false;
	}
	let dm = DM_ABSENT;
	if (rg.differentialModelId !== undefined) {
		dm = DIFF_PRESETS.findIndex((p) => p.id === rg.differentialModelId);
		if (dm < 0) {
			return false;
		}
	}
	const lc = rg.liftCoefficient ?? 0;
	const la = rg.liftReferenceAreaM2 ?? 0;
	const ls = rg.downforceFrontShare ?? rg.frontWeightDistribution;
	if (!inR(rg.springRateFrontNmm, 10, 120) || !inR(rg.springRateRearNmm, 10, 120) || !inR(rg.lateralG, 0, 2)) {
		return false;
	}
	if (!inR(lc, 0, 4) || !inR(la, 0, 5) || !inR(ls, 0.2, 0.8)) {
		return false;
	}
	pushU8(out, Math.round(rg.frontWeightDistribution * 100));
	pushU16(out, Math.round(rg.centerOfGravityHeightMm));
	pushU16(out, Math.round(rg.wheelbaseMm));
	pushU16(out, Math.round(rg.trackWidthMm));
	pushU8(out, Math.round(rg.roadFrictionCoefficient * 100));
	pushU8(out, lay);
	pushU8(out, df);
	pushU8(out, Math.round(rg.differentialBias * 100));
	pushU8(out, Math.round((rg.differentialCoastBias ?? 0) * 100));
	pushU8(out, dm);
	pushU8(out, Math.round(rg.springRateFrontNmm));
	pushU8(out, Math.round(rg.springRateRearNmm));
	pushU8(out, Math.round(rg.lateralG * 100));
	pushU16(out, Math.round(lc * 1000));
	pushU16(out, Math.round(la * 1000));
	pushU8(out, Math.round(ls * 100));
	return true;
};

/**
 * @brief Encode the full setup into one compact token.
 * @brief Falls back to null (verbose hash) with custom dyno curves or exotic values.
 * @param s Full application state.
 * @return Compact token, or null when the state does not fit the packing.
 */
export const encodeCompactHash = (s: AppState): string | null => {
	if (s.torqueCurvePoints && s.torqueCurvePoints.length > 0) {
		return null;
	}
	if (!inR(s.primaryFd, 1, 10) || !inR(s.primaryRedline, 3000, 12000) || !inR(s.maxGraphSpeed, 50, 500)) {
		return null;
	}
	if (s.reverseRatio !== null && !inR(s.reverseRatio, 1, 6)) {
		return null;
	}
	if (!inR(s.compFd, 1, 10) || !inR(s.compRedline, 3000, 12000) || !inR(s.compMassKg, 500, 3000)) {
		return null;
	}
	if (!inR(s.compCd, 0.15, 0.6) || !inR(s.compFrontalAreaM2, 1, 4) || !inR(s.compPowerKw, 30, 700)) {
		return null;
	}
	if (!inR(s.compPeakTorqueRpm, 1000, 12000) || !inR(s.compPeakTorqueNm, 20, 1500) || !inR(s.compPeakPowerRpm, 1000, 12000)) {
		return null;
	}
	if (!inR(s.vehicleMassKg, 500, 3000) || !inR(s.dragCd, 0.15, 0.6) || !inR(s.frontalAreaM2, 1, 4)) {
		return null;
	}
	if (!inR(s.rollingCrr, 0.005, 0.03) || !inR(s.enginePowerKw, 30, 700) || !inR(s.drivetrainEff, 0.7, 1)) {
		return null;
	}
	if (!inR(s.roadGradePercent, -30, 30) || !inR(s.rollingFactor, 0.9, 1) || !inR(s.peakTorqueRpm, 1000, 12000)) {
		return null;
	}
	if (!inR(s.peakTorqueNm, 20, 1500) || !inR(s.peakPowerRpm, 1000, 12000) || !inR(s.rotatingMassKg, 0, 500)) {
		return null;
	}
	if (!inR(s.shiftTimeS, 0, 3)) {
		return null;
	}
	const out: number[] = [COMPACT_HASH_VERSION, (s.compareEnabled ? 1 : 0) | (s.roadLoadEnabled ? 2 : 0) | (s.reverseRatio !== null ? 4 : 0)];
	if (!pushTire(out, s.primaryTire)) {
		return null;
	}
	pushU16(out, Math.round(s.primaryFd * 1000));
	pushU16(out, Math.round(s.primaryRedline));
	pushU16(out, Math.round(s.maxGraphSpeed));
	if (!pushGearList(out, s.gears)) {
		return null;
	}
	pushU16(out, s.reverseRatio === null ? 0 : Math.round(s.reverseRatio * 1000));
	if (!pushTire(out, s.compTire)) {
		return null;
	}
	pushU16(out, Math.round(s.compFd * 1000));
	pushU16(out, Math.round(s.compRedline));
	pushU16(out, Math.round(s.compMassKg));
	pushU16(out, Math.round(s.compCd * 1000));
	pushU16(out, Math.round(s.compFrontalAreaM2 * 1000));
	pushU16(out, Math.round(s.compPowerKw * 10));
	pushU16(out, Math.round(s.compPeakTorqueRpm));
	pushU16(out, Math.round(s.compPeakTorqueNm * 10));
	pushU16(out, Math.round(s.compPeakPowerRpm));
	if (!pushGearList(out, s.compGears)) {
		return null;
	}
	pushU16(out, Math.round(s.vehicleMassKg));
	pushU16(out, Math.round(s.dragCd * 1000));
	pushU16(out, Math.round(s.frontalAreaM2 * 1000));
	pushU16(out, Math.round(s.rollingCrr * 100000));
	pushU16(out, Math.round(s.enginePowerKw * 10));
	pushU16(out, Math.round(s.drivetrainEff * 100));
	pushU8(out, Math.round(s.roadGradePercent * 2) + 60);
	pushU16(out, Math.round(s.rollingFactor * 1000));
	pushU16(out, Math.round(s.peakTorqueRpm));
	pushU16(out, Math.round(s.peakTorqueNm * 10));
	pushU16(out, Math.round(s.peakPowerRpm));
	pushU16(out, Math.round(s.rotatingMassKg));
	pushU16(out, Math.round(s.shiftTimeS * 100));
	if (!pushGrip(out, s.runningGear) || !pushGrip(out, s.compRunningGear)) {
		return null;
	}
	return toBase64Url(new Uint8Array(out));
};

/**
 * @brief Bounds-checked big-endian reader over the hash bytes.
 */
class HashReader {
	/** Current offset. */
	pos = 0;
	/** False after any overrun. */
	ok = true;
	/** @brief Wrap raw bytes. */
	constructor(private readonly view: DataView) {}
	/** @brief Read one byte. */
	u8(): number {
		if (this.pos + 1 > this.view.byteLength) {
			this.ok = false;
			return 0;
		}
		const v = this.view.getUint8(this.pos);
		this.pos += 1;
		return v;
	}
	/** @brief Read one big-endian uint16. */
	u16(): number {
		if (this.pos + 2 > this.view.byteLength) {
			this.ok = false;
			return 0;
		}
		const v = this.view.getUint16(this.pos);
		this.pos += 2;
		return v;
	}
}

/**
 * @brief Read a packed tire block.
 * @param r Hash reader.
 * @return Tire string, or null when invalid.
 */
const readTire = (r: HashReader): string | null => {
	const tire = `${r.u8()}/${r.u8()}R${r.u8()}`;
	return parseTire(tire) ? tire : null;
};

/**
 * @brief Read a packed gear list block.
 * @param r Hash reader.
 * @return Gear ratios, or null when malformed.
 */
const readGearList = (r: HashReader): number[] | null => {
	const count = r.u8();
	if (count === 0 || count > COMPACT_MAX_GEARS) {
		return null;
	}
	const gears: number[] = [];
	for (let i = 0; i < count; i += 1) {
		gears.push(r.u16() / 1000);
	}
	return gears;
};

/**
 * @brief Read one packed running-gear block.
 * @param r Hash reader.
 * @return Running gear, or null when enums are unknown.
 */
const readGrip = (r: HashReader): RunningGear | null => {
	const wd = r.u8() / 100;
	const cg = r.u16();
	const wb = r.u16();
	const tw = r.u16();
	const mu = r.u8() / 100;
	const lay = LAYOUTS[r.u8()];
	const df = DTYPES[r.u8()];
	const db = r.u8() / 100;
	const dc = r.u8() / 100;
	const dmRaw = r.u8();
	const sf = r.u8();
	const sr = r.u8();
	const lat = r.u8() / 100;
	const lc = r.u16() / 1000;
	const la = r.u16() / 1000;
	const ls = r.u8() / 100;
	if (lay === undefined || df === undefined) {
		return null;
	}
	const dm = dmRaw === DM_ABSENT ? undefined : DIFF_PRESETS[dmRaw]?.id;
	if (dmRaw !== DM_ABSENT && dm === undefined) {
		return null;
	}
	return {
		...defaultRunningGear,
		frontWeightDistribution: wd,
		centerOfGravityHeightMm: cg,
		wheelbaseMm: wb,
		trackWidthMm: tw,
		roadFrictionCoefficient: mu,
		drivetrainLayout: lay as RunningGear['drivetrainLayout'],
		differentialType: df as RunningGear['differentialType'],
		differentialBias: db,
		differentialCoastBias: dc,
		differentialModelId: dm,
		springRateFrontNmm: sf,
		springRateRearNmm: sr,
		lateralG: lat,
		liftCoefficient: lc,
		liftReferenceAreaM2: la,
		downforceFrontShare: ls,
	};
};

/**
 * @brief Decode a full-state compact token back to state fields.
 * @param code Compact token from encodeCompactHash.
 * @return Partial state, or null when malformed.
 */
export const decodeCompactHash = (code: string): Partial<AppState> | null => {
	const bytes = fromBase64Url(code);
	if (!bytes || bytes.length < 4 || bytes[0] !== COMPACT_HASH_VERSION) {
		return null;
	}
	const r = new HashReader(new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength));
	r.pos = 1;
	const flags = r.u8();
	const primaryTire = readTire(r);
	const primaryFd = r.u16() / 1000;
	const primaryRedline = r.u16();
	const maxGraphSpeed = r.u16();
	const gears = readGearList(r);
	const reverseRaw = r.u16();
	const compTire = readTire(r);
	if (!primaryTire || !gears || !compTire) {
		return null;
	}
	const patch: Partial<AppState> = {
		compareEnabled: (flags & 1) !== 0,
		roadLoadEnabled: (flags & 2) !== 0,
		primaryTire,
		primaryFd,
		primaryRedline,
		maxGraphSpeed,
		gears,
		reverseRatio: (flags & 4) !== 0 ? reverseRaw / 1000 : null,
		compTire,
		compFd: r.u16() / 1000,
		compRedline: r.u16(),
		compMassKg: r.u16(),
		compCd: r.u16() / 1000,
		compFrontalAreaM2: r.u16() / 1000,
		compPowerKw: r.u16() / 10,
		compPeakTorqueRpm: r.u16(),
		compPeakTorqueNm: r.u16() / 10,
		compPeakPowerRpm: r.u16(),
	};
	const compGears = readGearList(r);
	if (!compGears) {
		return null;
	}
	patch.compGears = compGears;
	patch.vehicleMassKg = r.u16();
	patch.dragCd = r.u16() / 1000;
	patch.frontalAreaM2 = r.u16() / 1000;
	patch.rollingCrr = r.u16() / 100000;
	patch.enginePowerKw = r.u16() / 10;
	patch.drivetrainEff = r.u16() / 100;
	patch.roadGradePercent = (r.u8() - 60) / 2;
	patch.rollingFactor = r.u16() / 1000;
	patch.peakTorqueRpm = r.u16();
	patch.peakTorqueNm = r.u16() / 10;
	patch.peakPowerRpm = r.u16();
	patch.rotatingMassKg = r.u16();
	patch.shiftTimeS = r.u16() / 100;
	const rg = readGrip(r);
	const crg = readGrip(r);
	if (!rg || !crg || !r.ok || r.pos !== bytes.length) {
		return null;
	}
	patch.runningGear = rg;
	patch.compRunningGear = crg;
	return patch;
};
