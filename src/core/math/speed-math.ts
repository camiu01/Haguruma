/**
 * @file speed-math.ts
 * @brief Engine RPM to vehicle speed conversions in strict SI internally.
 *
 * SI discipline: every physical relation is evaluated in SI base units
 * (metres, seconds, radians, RPM-as-rev/min converted once). Imperial
 * display units (mph) are applied ONLY at the final output boundary, so
 * iterative scans (shift search, spin onset) never accumulate the
 * kmh<->mph round-trip error between calculateRpm and calculateSpeed.
 */
import type { SpeedUnit } from '../models';

/** Exact km/h per mph, single source for every mph boundary conversion. */
export const KMH_PER_MPH = 1.609344;

/** MPH per km/h, derived so the pair can never drift apart. */
export const MPH_PER_KMH = 1 / KMH_PER_MPH;

/**
 * @brief Validate drivetrain inputs before any division.
 * @param rpm Engine speed.
 * @param gearRatio Selected gear ratio.
 * @param finalDrive Differential ratio.
 * @param tireCircumferenceMeters Rolling circumference.
 * @return True when every value is finite and strictly positive (rpm may be zero).
 */
const isValidDrive = (
	rpm: number,
	gearRatio: number,
	finalDrive: number,
	tireCircumferenceMeters: number,
): boolean => {
	return (
		Number.isFinite(rpm) &&
		rpm >= 0 &&
		Number.isFinite(gearRatio) &&
		gearRatio > 0 &&
		Number.isFinite(finalDrive) &&
		finalDrive > 0 &&
		Number.isFinite(tireCircumferenceMeters) &&
		tireCircumferenceMeters > 0
	);
};

/**
 * @brief Core SI relation: engine RPM to vehicle speed in km/h.
 * @param rpm Engine speed in RPM.
 * @param gearRatio Selected gear ratio.
 * @param finalDrive Differential ratio.
 * @param tireCircumferenceMeters Rolling circumference in metres.
 * @return Vehicle speed in km/h, 0 when invalid.
 */
export const speedKmh = (
	rpm: number,
	gearRatio: number,
	finalDrive: number,
	tireCircumferenceMeters: number,
): number => {
	if (!isValidDrive(rpm, gearRatio, finalDrive, tireCircumferenceMeters)) {
		return 0;
	}
	const wheelRevPerMin = rpm / (gearRatio * finalDrive);
	const kmh = (wheelRevPerMin * tireCircumferenceMeters * 60) / 1000;
	return Number.isFinite(kmh) && kmh >= 0 ? kmh : 0;
};

/**
 * @brief Core SI relation: vehicle speed in km/h back to engine RPM.
 * @param speedKmh Vehicle speed in km/h (SI-side, never mph).
 * @param gearRatio Selected gear ratio.
 * @param finalDrive Differential ratio.
 * @param tireCircumferenceMeters Rolling circumference in metres.
 * @return Engine RPM for that speed and gear.
 */
export const rpmFromKmh = (
	speedKmh: number,
	gearRatio: number,
	finalDrive: number,
	tireCircumferenceMeters: number,
): number => {
	if (
		!Number.isFinite(speedKmh) ||
		speedKmh < 0 ||
		!Number.isFinite(gearRatio) ||
		gearRatio <= 0 ||
		!Number.isFinite(finalDrive) ||
		finalDrive <= 0 ||
		!Number.isFinite(tireCircumferenceMeters) ||
		tireCircumferenceMeters <= 0
	) {
		return 0;
	}
	const wheelRevPerMin = (speedKmh * 1000) / 60 / tireCircumferenceMeters;
	const rpm = wheelRevPerMin * gearRatio * finalDrive;
	return Number.isFinite(rpm) && rpm >= 0 ? rpm : 0;
};

/**
 * @brief Convert km/h to the requested display unit (boundary only).
 * @param kmh Speed in km/h.
 * @param unit Desired output unit.
 * @return Speed in the requested unit.
 */
export const toDisplaySpeed = (kmh: number, unit: SpeedUnit = 'kmh'): number => {
	if (!Number.isFinite(kmh) || kmh < 0) {
		return 0;
	}
	return unit === 'mph' ? kmh * MPH_PER_KMH : kmh;
};

/**
 * @brief Convert a display-unit speed back to km/h (boundary only).
 * @param speed Speed in the given unit.
 * @param unit Input speed unit.
 * @return Speed in km/h.
 */
export const fromDisplaySpeed = (speed: number, unit: SpeedUnit = 'kmh'): number => {
	if (!Number.isFinite(speed) || speed < 0) {
		return 0;
	}
	return unit === 'mph' ? speed * KMH_PER_MPH : speed;
};

/**
 * @brief Convert engine RPM into vehicle speed.
 * @param rpm Engine speed.
 * @param gearRatio Selected gear ratio.
 * @param finalDrive Differential ratio.
 * @param tireCircumferenceMeters Rolling circumference.
 * @param unit Desired output unit (mph applied at the boundary only).
 * @return Vehicle speed in the requested unit.
 */
export const calculateSpeed = (
	rpm: number,
	gearRatio: number,
	finalDrive: number,
	tireCircumferenceMeters: number,
	unit: SpeedUnit = 'kmh',
): number => {
	return toDisplaySpeed(speedKmh(rpm, gearRatio, finalDrive, tireCircumferenceMeters), unit);
};

/**
 * @brief Convert vehicle speed back into engine RPM.
 * @param speed Vehicle speed in the given unit.
 * @param gearRatio Selected gear ratio.
 * @param finalDrive Differential ratio.
 * @param tireCircumferenceMeters Rolling circumference.
 * @param unit Input speed unit (mph normalized to km/h first).
 * @return Engine RPM for that speed and gear.
 */
export const calculateRpm = (
	speed: number,
	gearRatio: number,
	finalDrive: number,
	tireCircumferenceMeters: number,
	unit: SpeedUnit = 'kmh',
): number => {
	return rpmFromKmh(fromDisplaySpeed(speed, unit), gearRatio, finalDrive, tireCircumferenceMeters);
};
