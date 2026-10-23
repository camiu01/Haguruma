/**
 * @file setup-sensitivity.ts
 * @brief Finite-difference sensitivity of active gearing, mass and road grip.
 */
import { simulateAcceleration, type SimInput } from './accel-math';
import { dragLimitedSpeedKmh } from './aero-math';
import { speedKmh } from './speed-math';
import { optimalShiftFor } from './traction-math';

export interface SensitivityRow {
	input: 'gears' | 'fd' | 'tire' | 'mass' | 'grip';
	topSpeedDeltaPercent: number;
	shiftDeltaRpm: number;
	accelDeltaPercent: number | null;
}

/**
 * @brief Evaluate top speed, first upshift and 0–100 for one setup.
 * @param input Simulation input.
 * @return Comparable metrics.
 */
const evaluate = (input: SimInput): { top: number; shift: number; accel: number | null } => {
	const curve = input.curve;
	if (!curve) return { top: 0, shift: 0, accel: null };
	const gearingTop = speedKmh(curve.redline, input.gears[input.gears.length - 1], input.fd, input.circM);
	const aeroTop = dragLimitedSpeedKmh(curve.peakPowerKw * input.drivetrainEff, input.massKg, input.dragCd ?? 0,
		input.frontalAreaM2 ?? 0, input.rollingCrr ?? 0, input.roadGradePercent ?? 0);
	const shift = optimalShiftFor(input.gears, 0, input.fd, input.circM, curve, input.drivetrainEff, 'kmh', input.efficiencyMap);
	return { top: aeroTop > 0 ? Math.min(aeroTop, gearingTop) : gearingTop, shift: shift?.shiftRpm ?? curve.redline,
		accel: simulateAcceleration(input).time0To100S };
};

/**
 * @brief Rank the effect of a +5% change without mutating live state.
 * @param input Baseline simulation setup.
 * @return Rows sorted by their largest relative performance change.
 */
export const setupSensitivity = (input: SimInput): SensitivityRow[] => {
	const base = evaluate(input);
	const variants: [SensitivityRow['input'], SimInput][] = [
		['gears', { ...input, gears: input.gears.map((ratio) => ratio * 1.05) }],
		['fd', { ...input, fd: input.fd * 1.05 }],
		['tire', { ...input, circM: input.circM * 1.05 }],
		['mass', { ...input, massKg: input.massKg * 1.05 }],
		['grip', { ...input, runningGear: input.runningGear ? { ...input.runningGear, roadFrictionCoefficient: input.runningGear.roadFrictionCoefficient * 1.05 } : undefined }],
	];
	const strength = (row: SensitivityRow): number => Math.max(Math.abs(row.topSpeedDeltaPercent),
		Math.abs(row.accelDeltaPercent ?? 0), base.shift > 0 ? Math.abs(row.shiftDeltaRpm / base.shift * 100) : 0);
	return variants.map(([name, variant]) => {
		const next = evaluate(variant);
		return { input: name, topSpeedDeltaPercent: base.top > 0 ? (next.top / base.top - 1) * 100 : 0,
			shiftDeltaRpm: next.shift - base.shift,
			accelDeltaPercent: base.accel && next.accel ? (next.accel / base.accel - 1) * 100 : null };
	}).sort((a, b) => strength(b) - strength(a));
};
