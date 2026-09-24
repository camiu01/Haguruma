/**
 * @file cruise-math.ts
 * @brief Highway cruising RPM, engine load and power-headroom check.
 *
 * Picks the tallest gear whose RPM stays at or above a floor, then compares
 * the road-load power at the requested cruise speed against the crank power
 * available at that RPM (scaled by drivetrain efficiency).
 */

import { availableWheelKw, roadLoadPowerKw } from './aero-math';
import { rpmFromKmh } from './speed-math';
import { enginePowerAt, type EngineCurve } from './traction-math';

/** Minimum RPM considered comfortable in the chosen cruising gear. */
export const CRUISE_MIN_RPM = 1600;

/** RPM above which the engine is considered lugging-band-high. */
export const CRUISE_HIGH_RPM_FRACTION = 0.85;

/** Verdict classification for one cruise check. */
export type CruiseVerdict = 'ok' | 'high' | 'over';

/**
 * Inputs for one cruising check.
 * @brief Everything needed to size gear, load and headroom at a cruise speed.
 */
export interface CruiseInput {
	/** Requested cruise speed in km/h. */
	speedKmh: number;
	/** Forward gear ratios from first to top gear. */
	gears: number[];
	/** Differential ratio. */
	fd: number;
	/** Effective rolling circumference in metres. */
	circM: number;
	/** Validated engine curve. */
	curve: EngineCurve;
	/** Drivetrain efficiency between 0 and 1. */
	drivetrainEff: number;
	/** Vehicle mass in kilograms. */
	massKg: number;
	/** Aerodynamic drag coefficient. */
	dragCd: number;
	/** Frontal area in square metres. */
	frontalAreaM2: number;
	/** Rolling-resistance coefficient. */
	rollingCrr: number;
	/** Road slope in percent. */
	roadGradePercent: number;
}

/**
 * Result of one cruising check.
 * @brief Gear choice, RPM, power balance and verdict at the cruise speed.
 */
export interface CruiseResult {
	/** Zero-based index of the selected gear. */
	gearIndex: number;
	/** One-based gear number for display. */
	gearNumber: number;
	/** Engine RPM in the selected gear. */
	rpm: number;
	/** Wheel power required by road load at the cruise speed, in kW. */
	requiredWheelKw: number;
	/** Wheel power available at the cruising RPM, in kW. */
	availableWheelKw: number;
	/** Required / available as a percentage (may exceed 100). */
	engineLoadPct: number;
	/** Comfort / capacity verdict. */
	verdict: CruiseVerdict;
}

/**
 * @brief Validate cruise inputs before any arithmetic.
 * @param input Raw cruise input.
 * @return True when every required field is usable.
 */
const isValid = (input: CruiseInput): boolean => {
	if (!input || !Number.isFinite(input.speedKmh) || input.speedKmh <= 0) {
		return false;
	}
	if (!Array.isArray(input.gears) || input.gears.length === 0) {
		return false;
	}
	if (!Number.isFinite(input.fd) || input.fd <= 0 || !Number.isFinite(input.circM) || input.circM <= 0) {
		return false;
	}
	if (!input.curve || !Number.isFinite(input.curve.redline) || input.curve.redline <= 0) {
		return false;
	}
	if (!Number.isFinite(input.drivetrainEff) || input.drivetrainEff <= 0 || input.drivetrainEff > 1) {
		return false;
	}
	return Number.isFinite(input.massKg) && input.massKg > 0;
};

/**
 * @brief Pick the tallest gear that keeps RPM at or above the floor.
 * @param gears Forward gear ratios.
 * @param speedKmh Cruise speed in km/h.
 * @param fd Differential ratio.
 * @param circM Rolling circumference in metres.
 * @return Zero-based gear index (0 when no gear reaches the floor).
 */
const pickGearIndex = (gears: number[], speedKmh: number, fd: number, circM: number): number => {
	for (let i = gears.length - 1; i >= 0; i -= 1) {
		const rpm = rpmFromKmh(speedKmh, gears[i], fd, circM);
		if (rpm >= CRUISE_MIN_RPM) {
			return i;
		}
	}
	return 0;
};

/**
 * @brief Run one highway cruising check.
 * @param input Cruise inputs (validated internally).
 * @return Cruise result, or null when inputs are unusable.
 */
export const cruiseCheck = (input: CruiseInput): CruiseResult | null => {
	if (!isValid(input)) {
		return null;
	}
	const gearIndex = pickGearIndex(input.gears, input.speedKmh, input.fd, input.circM);
	const gear = input.gears[gearIndex];
	const rpm = rpmFromKmh(input.speedKmh, gear, input.fd, input.circM);
	const required = roadLoadPowerKw(
		input.speedKmh,
		input.massKg,
		input.dragCd,
		input.frontalAreaM2,
		input.rollingCrr,
		input.roadGradePercent,
	);
	const available = availableWheelKw(enginePowerAt(rpm, input.curve), input.drivetrainEff);
	const loadPct = available > 0 ? (required / available) * 100 : Number.POSITIVE_INFINITY;
	return {
		gearIndex,
		gearNumber: gearIndex + 1,
		rpm,
		requiredWheelKw: required,
		availableWheelKw: available,
		engineLoadPct: loadPct,
		verdict: classifyVerdict(loadPct, rpm, input.curve.redline),
	};
};

/**
 * @brief Classify load and RPM into a cruise verdict.
 * @param loadPct Required / available power as a percentage.
 * @param rpm Engine RPM in the selected gear.
 * @param redline Rev limiter in RPM.
 * @return 'over' when power is insufficient, 'high' near redline, else 'ok'.
 */
const classifyVerdict = (loadPct: number, rpm: number, redline: number): CruiseVerdict => {
	if (loadPct > 100) {
		return 'over';
	}
	if (rpm > redline * CRUISE_HIGH_RPM_FRACTION) {
		return 'high';
	}
	return 'ok';
};
