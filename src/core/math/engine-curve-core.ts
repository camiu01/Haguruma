/**
 * @file engine-curve-core.ts
 * @brief Engine curve model: anchors, custom dyno points, torque and power.
 *
 * Two interchangeable models behind one EngineCurve value: the classic
 * anchor interpolation (peak torque + peak power points) and measured dyno
 * point curves (CSV import or share URL). Custom points win whenever at
 * least two valid rows survive sanitation; past the last measured point
 * power tapers 10% toward the rev limiter so the model never extrapolates
 * rising power beyond the data.
 */
import type { TorqueCurvePoint } from '../models';

/** kW to Nm conversion constant: T[Nm] = P[kW] * (30000/π) / n[rpm]. */
export const KW_TO_NM = 30000 / Math.PI;

/** Minimum engine speed sampled on the power curve. */
export const CURVE_MIN_RPM = 1000;

/** Lowest accepted RPM for a custom dyno point. */
export const POINTS_MIN_RPM = 500;

/** Highest accepted RPM for a custom dyno point. */
export const POINTS_MAX_RPM = 15000;

/** Lowest accepted crank torque in Nm for a custom dyno point. */
export const POINTS_MIN_NM = 5;

/** Highest accepted crank torque in Nm for a custom dyno point. */
export const POINTS_MAX_NM = 5000;

/** RPM scan step used to derive the peak-power anchor from dyno points. */
const ANCHOR_SCAN_RPM = 25;

/** Power taper (fraction) applied past the last measured dyno point. */
const POINT_TAIL_TAPER = 0.1;

/**
 * Engine anchors defining the power curve shape.
 * @brief Peak torque point plus peak power point, interpolated linearly.
 */
export interface EngineCurve {
	/** Rev limiter in RPM. */
	redline: number;
	/** RPM of peak engine torque. */
	peakTorqueRpm: number;
	/** Peak engine torque in Nm. */
	peakTorqueNm: number;
	/** RPM of peak engine power. */
	peakPowerRpm: number;
	/** Peak engine power in kW. */
	peakPowerKw: number;
	/** Custom dyno points overriding the anchor model (null = anchors). */
	points?: TorqueCurvePoint[] | null;
}

/**
 * @brief Clamp a value into [min, max].
 * @param v Candidate value.
 * @param min Lower bound.
 * @param max Upper bound.
 * @return Clamped value.
 */
export const clamp = (v: number, min: number, max: number): number => {
	return Math.min(max, Math.max(min, v));
};

/**
 * @brief Derive engine torque from power: T = P * (30000/π) / n.
 * @param powerKw Engine power in kilowatts.
 * @param rpm Engine speed in RPM.
 * @return Engine torque in Nm, 0 when invalid.
 */
export const torqueFromPower = (powerKw: number, rpm: number): number => {
	if (!Number.isFinite(powerKw) || powerKw < 0 || !Number.isFinite(rpm) || rpm <= 0) {
		return 0;
	}
	return (powerKw * KW_TO_NM) / rpm;
};

/**
 * @brief Derive engine power from torque: P = T * n / (30000/π).
 * @param torqueNm Engine torque in Nm.
 * @param rpm Engine speed in RPM.
 * @return Engine power in kilowatts, 0 when invalid.
 */
export const powerFromTorque = (torqueNm: number, rpm: number): number => {
	if (!Number.isFinite(torqueNm) || torqueNm < 0 || !Number.isFinite(rpm) || rpm <= 0) {
		return 0;
	}
	return (torqueNm * rpm) / KW_TO_NM;
};

/**
 * @brief Validate, sort and deduplicate custom dyno torque points.
 * @param points Raw rpm/torque pairs from CSV import or a shared URL.
 * @return Sorted unique points (at least two) or null when unusable.
 */
export const sanitizeTorquePoints = (points: TorqueCurvePoint[] | null | undefined): TorqueCurvePoint[] | null => {
	if (!Array.isArray(points)) {
		return null;
	}
	const clean: TorqueCurvePoint[] = [];
	for (const p of points) {
		if (!p || !Number.isFinite(p.rpm) || !Number.isFinite(p.torqueNm)) {
			continue;
		}
		if (p.rpm < POINTS_MIN_RPM || p.rpm > POINTS_MAX_RPM) {
			continue;
		}
		if (p.torqueNm < POINTS_MIN_NM || p.torqueNm > POINTS_MAX_NM) {
			continue;
		}
		clean.push({ rpm: Math.round(p.rpm), torqueNm: p.torqueNm });
	}
	clean.sort((a, b) => a.rpm - b.rpm);
	const out: TorqueCurvePoint[] = [];
	for (const p of clean) {
		if (out.length > 0 && out[out.length - 1].rpm === p.rpm) {
			continue;
		}
		out.push(p);
	}
	return out.length >= 2 ? out : null;
};

/**
 * @brief Segment slopes between consecutive dyno points.
 * @param points Sorted rpm/torque points (at least two).
 * @return Slope per segment in Nm per RPM.
 */
const segmentSlopes = (points: TorqueCurvePoint[]): number[] => {
	const out: number[] = [];
	for (let i = 0; i < points.length - 1; i += 1) {
		const dx = points[i + 1].rpm - points[i].rpm;
		out.push(dx > 0 ? (points[i + 1].torqueNm - points[i].torqueNm) / dx : 0);
	}
	return out;
};

/**
 * @brief Akima tangents at every point (edge slopes padded by duplication).
 * @param slopes Segment slopes from segmentSlopes.
 * @return Tangent per point in Nm per RPM.
 */
const akimaTangents = (slopes: number[]): number[] => {
	const n = slopes.length + 1;
	const m = [slopes[0], slopes[0], ...slopes, slopes[slopes.length - 1], slopes[slopes.length - 1]];
	const out: number[] = [];
	for (let i = 0; i < n; i += 1) {
		const w1 = Math.abs(m[i + 3] - m[i + 2]);
		const w2 = Math.abs(m[i + 1] - m[i]);
		const denom = w1 + w2;
		out.push(denom > 0 ? (w1 * m[i + 1] + w2 * m[i + 2]) / denom : (m[i + 1] + m[i + 2]) / 2);
	}
	return out;
};

/**
 * @brief Cubic Hermite evaluation on one interval.
 * @param x0 Left RPM bound.
 * @param y0 Left torque in Nm.
 * @param t0 Left tangent in Nm per RPM.
 * @param x1 Right RPM bound.
 * @param y1 Right torque in Nm.
 * @param t1 Right tangent in Nm per RPM.
 * @param rpm Query RPM inside the interval.
 * @return Interpolated torque in Nm.
 */
const hermiteAt = (x0: number, y0: number, t0: number, x1: number, y1: number, t1: number, rpm: number): number => {
	const h = x1 - x0;
	const s = h > 0 ? (rpm - x0) / h : 0;
	const s2 = s * s;
	const s3 = s2 * s;
	return (2 * s3 - 3 * s2 + 1) * y0 + (s3 - 2 * s2 + s) * h * t0 + (-2 * s3 + 3 * s2) * y1 + (s3 - s2) * h * t1;
};

/**
 * @brief Akima interpolation of crank torque from custom dyno points.
 * @brief Local cubic Hermite: smooth like a spline but without the global
 * @brief overshoot on noisy roller data; exact at every measured node and
 * @brief clamped to the segment range so monotone runs stay monotone.
 * @param points Sorted rpm/torque points (at least two).
 * @param rpm Engine speed in RPM.
 * @return Torque in Nm, holding the end values outside the data range.
 */
export const torqueAtRpm = (points: TorqueCurvePoint[], rpm: number): number => {
	if (!Array.isArray(points) || points.length === 0 || !Number.isFinite(rpm) || rpm <= 0) {
		return 0;
	}
	const first = points[0];
	if (rpm <= first.rpm) {
		return first.torqueNm;
	}
	const last = points[points.length - 1];
	if (rpm >= last.rpm) {
		return last.torqueNm;
	}
	if (points.length === 2) {
		const span = last.rpm - points[0].rpm;
		const k = span > 0 ? (rpm - points[0].rpm) / span : 0;
		return points[0].torqueNm + (last.torqueNm - points[0].torqueNm) * k;
	}
	const tangents = akimaTangents(segmentSlopes(points));
	for (let i = 1; i < points.length; i += 1) {
		const hi = points[i];
		if (rpm <= hi.rpm) {
			const lo = points[i - 1];
			const raw = hermiteAt(lo.rpm, lo.torqueNm, tangents[i - 1], hi.rpm, hi.torqueNm, tangents[i], rpm);
			return Math.min(Math.max(lo.torqueNm, hi.torqueNm), Math.max(Math.min(lo.torqueNm, hi.torqueNm), raw));
		}
	}
	return last.torqueNm;
};

/**
 * @brief Derive peak torque and peak power anchors from dyno points.
 * @param points Sorted unique dyno points (at least two).
 * @return Anchor values consistent with the measured curve.
 */
export const anchorsFromPoints = (points: TorqueCurvePoint[]): Pick<EngineCurve, 'peakTorqueRpm' | 'peakTorqueNm' | 'peakPowerRpm' | 'peakPowerKw'> => {
	let peakTorqueRpm = points[0].rpm;
	let peakTorqueNm = points[0].torqueNm;
	for (const p of points) {
		if (p.torqueNm > peakTorqueNm) {
			peakTorqueNm = p.torqueNm;
			peakTorqueRpm = p.rpm;
		}
	}
	const firstRpm = points[0].rpm;
	const lastRpm = points[points.length - 1].rpm;
	let peakPowerRpm = firstRpm;
	let peakPowerKw = 0;
	for (let rpm = firstRpm; rpm <= lastRpm; rpm += ANCHOR_SCAN_RPM) {
		const kw = powerFromTorque(torqueAtRpm(points, rpm), rpm);
		if (kw > peakPowerKw) {
			peakPowerKw = kw;
			peakPowerRpm = rpm;
		}
	}
	return { peakTorqueRpm, peakTorqueNm, peakPowerRpm, peakPowerKw };
};

/**
 * @brief Clamp engine anchors into a sane, self-consistent curve.
 * @brief Custom dyno points (>= 2 valid rows) override the anchor model.
 * @param curve Raw engine anchors and optional dyno points from state.
 * @return Validated curve or null when unusable.
 */
export const validateCurve = (curve: EngineCurve): EngineCurve | null => {
	if (!curve || !Number.isFinite(curve.redline) || curve.redline < 3000 || curve.redline > 12000) {
		return null;
	}
	const points = sanitizeTorquePoints(curve.points);
	if (points) {
		return { redline: curve.redline, ...anchorsFromPoints(points), points };
	}
	if (!Number.isFinite(curve.peakPowerKw) || curve.peakPowerKw <= 0) {
		return null;
	}
	const peakPowerRpm = clamp(curve.peakPowerRpm, CURVE_MIN_RPM, curve.redline);
	const peakTorqueRpm = clamp(curve.peakTorqueRpm, CURVE_MIN_RPM, peakPowerRpm);
	const peakTorqueNm = curve.peakTorqueNm;
	if (!Number.isFinite(peakTorqueNm) || peakTorqueNm <= 0) {
		return null;
	}
	return { redline: curve.redline, peakTorqueRpm, peakTorqueNm, peakPowerRpm, peakPowerKw: curve.peakPowerKw, points: null };
};

/**
 * @brief Engine power at a given RPM from the anchored or measured curve.
 * @brief Custom dyno points interpolate torque directly; past the last
 * @brief measured point power tapers toward the rev limiter so the model
 * @brief never extrapolates rising power beyond the data.
 * @param rpm Engine speed in RPM.
 * @param curve Validated engine anchors.
 * @return Power in kilowatts.
 */
export const enginePowerAt = (rpm: number, curve: EngineCurve): number => {
	if (!Number.isFinite(rpm) || rpm <= 0) {
		return 0;
	}
	if (curve.points && curve.points.length >= 2) {
		if (rpm > curve.redline) {
			return 0;
		}
		const last = curve.points[curve.points.length - 1];
		if (rpm > last.rpm) {
			const lastKw = powerFromTorque(last.torqueNm, last.rpm);
			const span = Math.max(1, curve.redline - last.rpm);
			const k = clamp((rpm - last.rpm) / span, 0, 1);
			return lastKw * (1 - POINT_TAIL_TAPER * k);
		}
		return powerFromTorque(torqueAtRpm(curve.points, rpm), rpm);
	}
	if (rpm <= curve.peakTorqueRpm) {
		const span = Math.max(1, curve.peakTorqueRpm - CURVE_MIN_RPM);
		const k = clamp((rpm - CURVE_MIN_RPM) / span, 0, 1);
		const t = curve.peakTorqueNm * (0.5 + 0.5 * k);
		return powerFromTorque(t, rpm);
	}
	if (rpm <= curve.peakPowerRpm) {
		const powerAtTorquePeak = powerFromTorque(curve.peakTorqueNm, curve.peakTorqueRpm);
		const span = Math.max(1, curve.peakPowerRpm - curve.peakTorqueRpm);
		const k = (rpm - curve.peakTorqueRpm) / span;
		return powerAtTorquePeak + (curve.peakPowerKw - powerAtTorquePeak) * k;
	}
	if (rpm <= curve.redline) {
		const span = Math.max(1, curve.redline - curve.peakPowerRpm);
		const k = (rpm - curve.peakPowerRpm) / span;
		return curve.peakPowerKw * (1 - 0.10 * k);
	}
	return 0;
};

/**
 * @brief Engine torque at a given RPM from the anchored or measured curve.
 * @brief Custom dyno points return torque directly, avoiding the power
 * @brief round-trip and the interpolation error it would introduce.
 * @param rpm Engine speed in RPM.
 * @param curve Validated engine anchors and optional dyno points.
 * @return Torque in Nm.
 */
export const engineTorqueAt = (rpm: number, curve: EngineCurve): number => {
	if (curve.points && curve.points.length >= 2) {
		if (!Number.isFinite(rpm) || rpm <= 0 || rpm > curve.redline) {
			return 0;
		}
		const last = curve.points[curve.points.length - 1];
		if (rpm > last.rpm) {
			return torqueFromPower(enginePowerAt(rpm, curve), rpm);
		}
		return torqueAtRpm(curve.points, rpm);
	}
	return torqueFromPower(enginePowerAt(rpm, curve), rpm);
};
