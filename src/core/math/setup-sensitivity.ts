/**
 * @file setup-sensitivity.ts
 * @brief Finite-difference sensitivity of gearing, mass and road grip.
 *
 * One setup is evaluated, then the same setup is evaluated again with a single
 * input scaled by `PERTURBATION`. The reported deltas are signed, so the sign
 * carries the direction of the effect (a heavier car loses top speed, a taller
 * final drive gains it when the gearing, not the aero wall, is the limit).
 *
 * Nothing here mutates the setup it is given: every variant is a fresh object.
 */
import { simulateAcceleration, type SimInput } from './accel-math';
import { dragLimitedSpeedKmh } from './aero-math';
import { speedKmh } from './speed-math';
import { optimalShiftFor } from './traction-math';

/** Relative step applied to one input at a time. */
export const PERTURBATION = 0.05;

/** Inputs the sensitivity ranking can probe. */
export type SensitivityInput = 'gears' | 'fd' | 'tire' | 'mass' | 'grip';

/** One ranked row of the sensitivity report. */
export interface SensitivityRow {
	/** Input that was scaled for this row. */
	input: SensitivityInput;
	/** Signed change in limited top speed, in percent. */
	topSpeedDeltaPercent: number;
	/** Signed change in the first upshift RPM. */
	shiftDeltaRpm: number;
	/** Signed change in the 0-100 km/h time, in percent, null when not reached. */
	accelDeltaPercent: number | null;
}

/** Comparable metrics of one evaluated setup. */
interface SetupMetrics {
	/** Limited top speed in km/h. */
	top: number;
	/** RPM of the first upshift. */
	shift: number;
	/** 0-100 km/h time in seconds, null when the run never reaches it. */
	accel: number | null;
}

/**
 * @brief Evaluate top speed, first upshift and 0-100 for one setup.
 * @brief Top speed is the lower of the gearing limit and the aero limit, so a
 * @brief gearing change only shows up when the gearing is what limits the car.
 * @param input Simulation input.
 * @return Comparable metrics, all zero when the curve is unusable.
 */
const evaluate = (input: SimInput): SetupMetrics => {
	const curve = input.curve;
	if (!curve) {
		return { top: 0, shift: 0, accel: null };
	}
	const gearingTop = speedKmh(curve.redline, input.gears[input.gears.length - 1], input.fd, input.circM);
	const aeroTop = dragLimitedSpeedKmh(
		curve.peakPowerKw * input.drivetrainEff,
		input.massKg,
		input.dragCd ?? 0,
		input.frontalAreaM2 ?? 0,
		input.rollingCrr ?? 0,
		input.roadGradePercent ?? 0,
	);
	const mappedLayout = input.efficiencyMap ? input.runningGear?.drivetrainLayout : undefined;
	const shift = optimalShiftFor(input.gears, 0, input.fd, input.circM, curve, input.drivetrainEff, 'kmh', mappedLayout);
	return {
		top: aeroTop > 0 ? Math.min(aeroTop, gearingTop) : gearingTop,
		shift: shift?.shiftRpm ?? curve.redline,
		accel: simulateAcceleration(input).time0To100S,
	};
};

/**
 * @brief Build the one-input perturbation of every probeable input.
 * @param input Baseline setup.
 * @return Input name plus its perturbed variant.
 */
const variantsOf = (input: SimInput): [SensitivityInput, SimInput][] => {
	return [
		['gears', { ...input, gears: input.gears.map((ratio) => ratio * (1 + PERTURBATION)) }],
		['fd', { ...input, fd: input.fd * (1 + PERTURBATION) }],
		['tire', { ...input, circM: input.circM * (1 + PERTURBATION) }],
		['mass', { ...input, massKg: input.massKg * (1 + PERTURBATION) }],
		[
			'grip',
			{
				...input,
				runningGear: input.runningGear
					? { ...input.runningGear, roadFrictionCoefficient: input.runningGear.roadFrictionCoefficient * (1 + PERTURBATION) }
					: undefined,
			},
		],
	];
};

/**
 * @brief Score a row by its largest relative performance change.
 * @param row Row to score.
 * @param baseShift Baseline upshift RPM, used to normalize the shift delta.
 * @return Non-negative strength, larger means more sensitive.
 */
const strength = (row: SensitivityRow, baseShift: number): number => {
	return Math.max(
		Math.abs(row.topSpeedDeltaPercent),
		Math.abs(row.accelDeltaPercent ?? 0),
		baseShift > 0 ? Math.abs((row.shiftDeltaRpm / baseShift) * 100) : 0,
	);
};

/**
 * @brief Rank the effect of a +5% change on each setup input.
 * @param input Baseline simulation setup, never mutated.
 * @return One row per input, most influential first.
 */
export const setupSensitivity = (input: SimInput): SensitivityRow[] => {
	const base = evaluate(input);
	const rows = variantsOf(input).map(([name, variant]) => {
		const next = evaluate(variant);
		return {
			input: name,
			topSpeedDeltaPercent: base.top > 0 ? (next.top / base.top - 1) * 100 : 0,
			shiftDeltaRpm: next.shift - base.shift,
			accelDeltaPercent: base.accel && next.accel ? (next.accel / base.accel - 1) * 100 : null,
		};
	});
	return rows.sort((a, b) => strength(b, base.shift) - strength(a, base.shift));
};
