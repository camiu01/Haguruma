/**
 * @file shift-math.ts
 * @brief Upshift analysis: landing RPM, drops, ratios and torque-band checks.
 */
import { calculateRpm, calculateSpeed } from './speed-math';
import type { SpeedUnit } from '../models';

const MIN_RATIO = 0.4;
const MAX_RATIO = 6.0;

/**
 * Single upshift description at the rev limiter.
 * @brief Landing RPM plus drop for one gear change.
 */
export interface ShiftStep {
	/** Zero-based index of the gear being left. */
	fromIndex: number;
	/** Zero-based index of the gear being entered. */
	toIndex: number;
	/** Top speed of the lower gear at redline (display unit). */
	topSpeed: number;
	/** RPM in the next gear at that speed. */
	landingRpm: number;
	/** RPM lost in the shift (redline minus landing). */
	rpmDrop: number;
	/** Ratio step (next ratio divided by current ratio). */
	stepRatio: number;
	/** Gap as percent of redline. */
	dropPercent: number;
}

/**
 * Torque-band verdict for one upshift.
 * @brief Flags bogging risk when landing below the usable band.
 */
export interface ShiftVerdict extends ShiftStep {
	/** True when landing RPM falls below the torque band floor. */
	bogging: boolean;
	/** True when landing is within the margin just above the floor. */
	warning: boolean;
}

/**
 * @brief Validate a gear ratio before shift arithmetic.
 * @param ratio Candidate ratio.
 * @return True when finite and within the gearbox range.
 */
const isValidRatio = (ratio: number): boolean => {
	return Number.isFinite(ratio) && ratio >= MIN_RATIO && ratio <= MAX_RATIO;
};

/**
 * @brief Describe one upshift at the rev limiter.
 * @param gears Full gearset from first to top gear.
 * @param fromIndex Zero-based index of the gear being left.
 * @param redline Rev limiter in RPM.
 * @param finalDrive Differential ratio.
 * @param circM Effective rolling circumference in metres.
 * @param unit Display unit for the top speed.
 * @return Shift step or null when inputs are invalid.
 */
export const describeUpshift = (
	gears: number[],
	fromIndex: number,
	redline: number,
	finalDrive: number,
	circM: number,
	unit: SpeedUnit = 'kmh',
): ShiftStep | null => {
	if (!Array.isArray(gears) || fromIndex < 0 || fromIndex >= gears.length - 1) {
		return null;
	}
	const current = gears[fromIndex];
	const next = gears[fromIndex + 1];
	if (!isValidRatio(current) || !isValidRatio(next)) {
		return null;
	}
	if (!Number.isFinite(redline) || redline <= 0 || !Number.isFinite(finalDrive) || finalDrive <= 0) {
		return null;
	}
	if (!Number.isFinite(circM) || circM <= 0) {
		return null;
	}
	const topSpeed = calculateSpeed(redline, current, finalDrive, circM, unit);
	const landingRpm = redline * (next / current);
	if (!Number.isFinite(topSpeed) || !Number.isFinite(landingRpm)) {
		return null;
	}
	const rpmDrop = redline - landingRpm;
	return {
		fromIndex,
		toIndex: fromIndex + 1,
		topSpeed,
		landingRpm,
		rpmDrop,
		stepRatio: next / current,
		dropPercent: redline > 0 ? (rpmDrop / redline) * 100 : 0,
	};
};

/**
 * @brief Describe every upshift in a gearset.
 * @param gears Full gearset from first to top gear.
 * @param redline Rev limiter in RPM.
 * @param finalDrive Differential ratio.
 * @param circM Effective rolling circumference in metres.
 * @param unit Display unit for top speeds.
 * @return One step per gear change, skipping invalid pairs.
 */
export const describeAllUpshifts = (
	gears: number[],
	redline: number,
	finalDrive: number,
	circM: number,
	unit: SpeedUnit = 'kmh',
): ShiftStep[] => {
	const steps: ShiftStep[] = [];
	if (!Array.isArray(gears)) {
		return steps;
	}
	for (let i = 0; i < gears.length - 1; i += 1) {
		const step = describeUpshift(gears, i, redline, finalDrive, circM, unit);
		if (step) {
			steps.push(step);
		}
	}
	return steps;
};

/**
 * Primary-vs-comparison delta at one up-shift point.
 * @brief Landing-RPM gap in the next gear plus shift-speed gap, display units.
 */
export interface ShiftPointDelta {
	/** Zero-based index of the gear being left. */
	fromIndex: number;
	/** Comparison landing RPM minus primary landing RPM. */
	dLandingRpm: number;
	/** Comparison shift speed minus primary shift speed (display unit). */
	dShiftSpeed: number;
}

/**
 * @brief Compare primary and secondary landing RPM at the same road speed.
 * @brief The primary shift speed comes from its redline point; both landings
 * @brief are evaluated in the next gear at that speed, like the graph peaks.
 * @param gears Primary gearset from first to top gear.
 * @param fromIndex Zero-based index of the gear being left.
 * @param redline Primary rev limiter in RPM.
 * @param fd Primary final drive.
 * @param circM Primary rolling circumference in metres.
 * @param compGears Secondary gearset.
 * @param compFd Secondary final drive.
 * @param compCircM Secondary rolling circumference in metres.
 * @param compRedline Secondary rev limiter in RPM.
 * @param unit Display unit for speeds.
 * @return Delta entry, or null when either side is invalid.
 */
export const describeShiftDelta = (
	gears: number[],
	fromIndex: number,
	redline: number,
	fd: number,
	circM: number,
	compGears: number[],
	compFd: number,
	compCircM: number,
	compRedline: number,
	unit: SpeedUnit = 'kmh',
): ShiftPointDelta | null => {
	if (!Array.isArray(gears) || !Array.isArray(compGears) || fromIndex < 0) {
		return null;
	}
	const next = gears[fromIndex + 1];
	const compNext = compGears[fromIndex + 1];
	const current = gears[fromIndex];
	const compCurrent = compGears[fromIndex];
	if (!isValidRatio(current) || !isValidRatio(next) || !isValidRatio(compCurrent) || !isValidRatio(compNext)) {
		return null;
	}
	if (!Number.isFinite(redline) || redline <= 0 || !Number.isFinite(compRedline) || compRedline <= 0) {
		return null;
	}
	if (!Number.isFinite(fd) || fd <= 0 || !Number.isFinite(compFd) || compFd <= 0) {
		return null;
	}
	if (!Number.isFinite(circM) || circM <= 0 || !Number.isFinite(compCircM) || compCircM <= 0) {
		return null;
	}
	const shiftSpeed = calculateSpeed(redline, current, fd, circM, unit);
	const compShiftSpeed = calculateSpeed(compRedline, compCurrent, compFd, compCircM, unit);
	const landing = calculateRpm(shiftSpeed, next, fd, circM, unit);
	const compLanding = calculateRpm(shiftSpeed, compNext, compFd, compCircM, unit);
	if (![shiftSpeed, compShiftSpeed, landing, compLanding].every((v) => Number.isFinite(v))) {
		return null;
	}
	return { fromIndex, dLandingRpm: compLanding - landing, dShiftSpeed: compShiftSpeed - shiftSpeed };
};

/**
 * @brief Compare every shared up-shift point of two gearsets.
 * @param gears Primary gearset from first to top gear.
 * @param redline Primary rev limiter in RPM.
 * @param fd Primary final drive.
 * @param circM Primary rolling circumference in metres.
 * @param compGears Secondary gearset.
 * @param compFd Secondary final drive.
 * @param compCircM Secondary rolling circumference in metres.
 * @param compRedline Secondary rev limiter in RPM.
 * @param unit Display unit for speeds.
 * @return One delta per shared gear change, skipping invalid pairs.
 */
export const describeAllShiftDeltas = (
	gears: number[],
	redline: number,
	fd: number,
	circM: number,
	compGears: number[],
	compFd: number,
	compCircM: number,
	compRedline: number,
	unit: SpeedUnit = 'kmh',
): ShiftPointDelta[] => {
	const out: ShiftPointDelta[] = [];
	if (!Array.isArray(gears) || !Array.isArray(compGears)) {
		return out;
	}
	const pairs = Math.min(gears.length, compGears.length) - 1;
	for (let i = 0; i < pairs; i += 1) {
		const delta = describeShiftDelta(gears, i, redline, fd, circM, compGears, compFd, compCircM, compRedline, unit);
		if (delta) {
			out.push(delta);
		}
	}
	return out;
};

/**
 * @brief Judge upshifts against a usable torque band.
 * @param steps Upshift steps at redline.
 * @param bandFloor Minimum useful RPM (torque onset).
 * @param warnMargin RPM margin above the floor flagged as warning.
 * @return Verdict per step with bogging and warning flags.
 */
export const judgeShifts = (steps: ShiftStep[], bandFloor: number, warnMargin: number = 400): ShiftVerdict[] => {
	const floor = Number.isFinite(bandFloor) && bandFloor > 0 ? bandFloor : 0;
	const margin = Number.isFinite(warnMargin) && warnMargin >= 0 ? warnMargin : 0;
	return steps.map((step) => {
		const bogging = floor > 0 && step.landingRpm < floor;
		const warning = !bogging && floor > 0 && step.landingRpm < floor + margin;
		return { ...step, bogging, warning };
	});
};

/**
 * @brief Compute the target speed behind a desired landing RPM.
 * @param landingRpm Desired RPM in the next gear.
 * @param nextRatio Ratio of the gear being entered.
 * @param finalDrive Differential ratio.
 * @param circM Effective rolling circumference in metres.
 * @param unit Display unit for the returned speed.
 * @return Vehicle speed producing that landing RPM, 0 when invalid.
 */
export const speedForLandingRpm = (
	landingRpm: number,
	nextRatio: number,
	finalDrive: number,
	circM: number,
	unit: SpeedUnit = 'kmh',
): number => {
	if (!Number.isFinite(landingRpm) || landingRpm <= 0 || !isValidRatio(nextRatio)) {
		return 0;
	}
	if (!Number.isFinite(finalDrive) || finalDrive <= 0 || !Number.isFinite(circM) || circM <= 0) {
		return 0;
	}
	return calculateSpeed(landingRpm, nextRatio, finalDrive, circM, unit);
};
