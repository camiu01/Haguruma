/**
 * @file traction-math.ts
 * @brief Engine torque model, tractive force at the wheels and optimal shift points.
 *
 * Physics chain: power curve (peak power + peak torque anchors) -> engine torque
 * via T = P * (30000/π) / n -> wheel force via F = T * i_total * eta / r_dyn.
 * Optimal shift per gear pair: shift where the next gear delivers more wheel
 * force than staying in the current gear (tractive-force curve crossing).
 */

import { rpmFromKmh, speedKmh, toDisplaySpeed } from './speed-math';
import type { SpeedUnit } from '../models';

/** kW to Nm conversion constant: T[Nm] = P[kW] * (30000/π) / n[rpm]. */
export const KW_TO_NM = 30000 / Math.PI;

/** Minimum engine speed sampled on the power curve. */
export const CURVE_MIN_RPM = 1000;

/** Sampling step for curve crossing search. */
const CURVE_STEP_RPM = 50;

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
}

/**
 * Optimal shift prescription for one gear pair.
 * @brief Shift RPM, landing RPM and the reason behind the choice.
 */
export interface OptimalShift {
	/** Zero-based index of the gear being left. */
	fromIndex: number;
	/** Zero-based index of the gear being entered. */
	toIndex: number;
	/** RPM at which to shift for maximum wheel force. */
	shiftRpm: number;
	/** RPM in the next gear after the shift. */
	landingRpm: number;
	/** Vehicle speed at the shift point (display unit). */
	shiftSpeed: number;
	/** True when shifting at redline is already optimal. */
	atRedline: boolean;
}

/**
 * @brief Clamp engine anchors into a sane, self-consistent curve.
 * @param curve Raw engine anchors from state.
 * @return Validated curve or null when unusable.
 */
export const validateCurve = (curve: EngineCurve): EngineCurve | null => {
	if (!curve || !Number.isFinite(curve.redline) || curve.redline < 3000 || curve.redline > 12000) {
		return null;
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
	return { redline: curve.redline, peakTorqueRpm, peakTorqueNm, peakPowerRpm, peakPowerKw: curve.peakPowerKw };
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
 * @brief Engine power at a given RPM from the anchored curve.
 * @param rpm Engine speed in RPM.
 * @param curve Validated engine anchors.
 * @return Power in kilowatts.
 */
export const enginePowerAt = (rpm: number, curve: EngineCurve): number => {
	if (!Number.isFinite(rpm) || rpm <= 0) {
		return 0;
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
 * @brief Engine torque at a given RPM from the anchored curve.
 * @param rpm Engine speed in RPM.
 * @param curve Validated engine anchors.
 * @return Torque in Nm.
 */
export const engineTorqueAt = (rpm: number, curve: EngineCurve): number => {
	return torqueFromPower(enginePowerAt(rpm, curve), rpm);
};

/**
 * @brief Tractive force at the wheels for one gear and RPM.
 * @param rpm Engine speed in RPM.
 * @param gearRatio Selected gear ratio.
 * @param finalDrive Differential ratio.
 * @param dynRadiusM Dynamic rolling radius in metres.
 * @param curve Validated engine anchors.
 * @param drivetrainEff Drivetrain efficiency between 0 and 1.
 * @return Wheel force in newtons, 0 when invalid.
 */
export const tractiveForceAt = (
	rpm: number,
	gearRatio: number,
	finalDrive: number,
	dynRadiusM: number,
	curve: EngineCurve,
	drivetrainEff: number,
): number => {
	if (!Number.isFinite(rpm) || rpm <= 0 || !Number.isFinite(gearRatio) || gearRatio <= 0) {
		return 0;
	}
	if (!Number.isFinite(finalDrive) || finalDrive <= 0 || !Number.isFinite(dynRadiusM) || dynRadiusM <= 0) {
		return 0;
	}
	const eff = Number.isFinite(drivetrainEff) ? clamp(drivetrainEff, 0, 1) : 0;
	if (eff <= 0) {
		return 0;
	}
	const torque = engineTorqueAt(rpm, curve);
	return (torque * gearRatio * finalDrive * eff) / dynRadiusM;
};

/**
 * @brief Dynamic rolling radius from effective circumference.
 * @param circM Effective rolling circumference in metres.
 * @return Rolling radius in metres, 0 when invalid.
 */
export const dynamicRadiusM = (circM: number): number => {
	if (!Number.isFinite(circM) || circM <= 0) {
		return 0;
	}
	return circM / (2 * Math.PI);
};

/**
 * @brief Find the optimal shift RPM for one gear pair, robust to curve shape.
 *
 * Physics: at the same road speed v, F1(v) > F2(v) ⇔ T(n1)*i1 > T(n2)*i2
 * (radius, final drive and efficiency cancel out). The zero of
 * dF(n) = F_next(landing(n)) − F_now(n) is found by scanning BACKWARD from
 * the rev limiter: the first crossing encountered while descending is the
 * relevant one, and low-RPM irregularities (turbo lag, non-monotonic curves
 * below 2000 RPM) cannot produce false positives because the search stops at
 * the first useful zero coming from the top. The zero is then refined by
 * bisection to 25 RPM resolution.
 * @param gears Full gearset from first to top gear.
 * @param fromIndex Zero-based index of the gear being left.
 * @param finalDrive Differential ratio.
 * @param circM Effective rolling circumference in metres.
 * @param curve Validated engine anchors (null makes the function return null).
 * @param drivetrainEff Drivetrain efficiency between 0 and 1.
 * @param unit Display unit for the shift speed.
 * @return Optimal shift prescription.
 */
export const optimalShiftFor = (
	gears: number[],
	fromIndex: number,
	finalDrive: number,
	circM: number,
	curve: EngineCurve | null,
	drivetrainEff: number,
	unit: SpeedUnit = 'kmh',
): OptimalShift | null => {
	if (!Array.isArray(gears) || fromIndex < 0 || fromIndex >= gears.length - 1) {
		return null;
	}
	const current = gears[fromIndex];
	const next = gears[fromIndex + 1];
	const radius = dynamicRadiusM(circM);
	if (!radius || !Number.isFinite(current) || current <= 0 || !Number.isFinite(next) || next <= 0) {
		return null;
	}
	if (!Number.isFinite(finalDrive) || finalDrive <= 0) {
		return null;
	}
	const redline = curve?.redline ?? 0;
	if (!curve || redline <= 0) {
		return null;
	}
	const deltaForce = (rpm: number): number => {
		const vKmh = speedKmh(rpm, current, finalDrive, circM);
		const landing = rpmFromKmh(vKmh, next, finalDrive, circM);
		if (!Number.isFinite(landing) || landing < CURVE_MIN_RPM) {
			return Number.NaN;
		}
		const forceNow = tractiveForceAt(rpm, current, finalDrive, radius, curve, drivetrainEff);
		const forceNext = tractiveForceAt(landing, next, finalDrive, radius, curve, drivetrainEff);
		if (!Number.isFinite(forceNow) || !Number.isFinite(forceNext)) {
			return Number.NaN;
		}
		return forceNext - forceNow;
	};
	const crossingRpm = findCrossingFromTop(redline, deltaForce);
	const resolved = crossingRpm === null ? redline : crossingRpm;
	const shiftSpeedKmh = speedKmh(resolved, current, finalDrive, circM);
	const landingRpm = rpmFromKmh(shiftSpeedKmh, next, finalDrive, circM);
	return {
		fromIndex,
		toIndex: fromIndex + 1,
		shiftRpm: Math.round(resolved),
		landingRpm: Math.round(landingRpm),
		shiftSpeed: toDisplaySpeed(shiftSpeedKmh, unit),
		atRedline: resolved >= redline,
	};
};

/**
 * @brief Scan from idle upward and keep the highest crossing that still holds at redline.
 *
 * Anti-false-positive strategy: sample dF every CURVE_STEP_RPM from the
 * bottom upward, take the LAST −→+ crossing (the highest one), and accept
 * it only if dF stays > 0 all the way to the rev limiter. Low-RPM
 * oscillations (turbo lag, non-monotonic curves) generate crossings
 * followed by a return to negative and are therefore discarded in favour
 * of a safe redline shift.
 * @param redline Rev limiter in RPM, upper search bound.
 * @param deltaForce Signed force gap (next minus current) at an RPM.
 * @return Refined crossing RPM, or null when the next gear never wins last.
 */
const findCrossingFromTop = (redline: number, deltaForce: (rpm: number) => number): number | null => {
	const samples: { rpm: number; d: number }[] = [];
	for (let rpm = CURVE_MIN_RPM; rpm <= redline; rpm += CURVE_STEP_RPM) {
		const d = deltaForce(rpm);
		if (Number.isFinite(d)) {
			samples.push({ rpm, d });
		}
	}
	const topD = deltaForce(redline);
	if (Number.isFinite(topD) && (samples.length === 0 || samples[samples.length - 1].rpm < redline)) {
		samples.push({ rpm: redline, d: topD });
	}
	if (samples.length === 0) {
		return null;
	}
	let cross: { lo: number; hi: number } | null = null;
	for (let i = 1; i < samples.length; i += 1) {
		if (samples[i - 1].d <= 0 && samples[i].d > 0) {
			cross = { lo: samples[i - 1].rpm, hi: samples[i].rpm };
		}
	}
	if (!cross) {
		return null;
	}
	for (let i = 0; i < samples.length; i += 1) {
		if (samples[i].rpm > cross.hi && samples[i].d <= 0) {
			return null;
		}
	}
	return refineCrossing(cross.lo, cross.hi, deltaForce);
};

/**
 * @brief Bisect the zero of the force gap inside a bracket.
 * @param loRpm Lower bracket edge with gap <= 0.
 * @param hiRpm Upper bracket edge with gap > 0.
 * @param deltaForce Signed force gap function.
 * @return Crossing RPM rounded to 25 rpm resolution.
 */
const refineCrossing = (loRpm: number, hiRpm: number, deltaForce: (rpm: number) => number): number => {
	let a = loRpm;
	let b = hiRpm;
	for (let i = 0; i < 24; i += 1) {
		if (b - a <= 25) {
			break;
		}
		const mid = (a + b) / 2;
		const d = deltaForce(mid);
		if (!Number.isFinite(d)) {
			a = mid;
			continue;
		}
		if (d > 0) {
			b = mid;
		} else {
			a = mid;
		}
	}
	return Math.round((a + b) / 2);
};

/**
 * @brief Optimal shift points for a full gearset.
 * @param gears Full gearset from first to top gear.
 * @param finalDrive Differential ratio.
 * @param circM Effective rolling circumference in metres.
 * @param curve Validated engine anchors (or null when invalid).
 * @param drivetrainEff Drivetrain efficiency between 0 and 1.
 * @param unit Display unit for shift speeds.
 * @return One prescription per gear change.
 */
export const optimalShiftsForAll = (
	gears: number[],
	finalDrive: number,
	circM: number,
	curve: EngineCurve | null,
	drivetrainEff: number,
	unit: SpeedUnit = 'kmh',
): OptimalShift[] => {
	const out: OptimalShift[] = [];
	if (!Array.isArray(gears) || !curve) {
		return out;
	}
	for (let i = 0; i < gears.length - 1; i += 1) {
		const shift = optimalShiftFor(gears, i, finalDrive, circM, curve, drivetrainEff, unit);
		if (shift) {
			out.push(shift);
		}
	}
	return out;
};

/**
 * @brief Clamp a value into [min, max].
 * @param v Candidate value.
 * @param min Lower bound.
 * @param max Upper bound.
 * @return Clamped value.
 */
const clamp = (v: number, min: number, max: number): number => {
	return Math.min(max, Math.max(min, v));
};
