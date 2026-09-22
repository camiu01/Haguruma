/**
 * @file speed-math.ts
 * @brief Engine RPM to vehicle speed conversions.
 */
import type { SpeedUnit } from '../models';

const KMH_TO_MPH = 0.621371;

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
 * @brief Convert engine RPM into vehicle speed.
 * @param rpm Engine speed.
 * @param gearRatio Selected gear ratio.
 * @param finalDrive Differential ratio.
 * @param tireCircumferenceMeters Rolling circumference.
 * @param unit Desired output unit.
 * @return Vehicle speed in the requested unit.
 */
export const calculateSpeed = (
	rpm: number,
	gearRatio: number,
	finalDrive: number,
	tireCircumferenceMeters: number,
	unit: SpeedUnit = 'kmh',
): number => {
	if (!isValidDrive(rpm, gearRatio, finalDrive, tireCircumferenceMeters)) {
		return 0;
	}
	const overallRatio = gearRatio * finalDrive;
	const wheelRpm = rpm / overallRatio;
	const metersPerMin = wheelRpm * tireCircumferenceMeters;
	const kmh = (metersPerMin * 60) / 1000;
	if (!Number.isFinite(kmh) || kmh < 0) {
		return 0;
	}
	return unit === 'mph' ? kmh * KMH_TO_MPH : kmh;
};

/**
 * @brief Convert vehicle speed back into engine RPM.
 * @param speed Vehicle speed in the given unit.
 * @param gearRatio Selected gear ratio.
 * @param finalDrive Differential ratio.
 * @param tireCircumferenceMeters Rolling circumference.
 * @param unit Input speed unit.
 * @return Engine RPM for that speed and gear.
 */
export const calculateRpm = (
	speed: number,
	gearRatio: number,
	finalDrive: number,
	tireCircumferenceMeters: number,
	unit: SpeedUnit = 'kmh',
): number => {
	if (
		!Number.isFinite(speed) ||
		speed < 0 ||
		!Number.isFinite(gearRatio) ||
		gearRatio <= 0 ||
		!Number.isFinite(finalDrive) ||
		finalDrive <= 0 ||
		!Number.isFinite(tireCircumferenceMeters) ||
		tireCircumferenceMeters <= 0
	) {
		return 0;
	}
	const overallRatio = gearRatio * finalDrive;
	const kmh = unit === 'mph' ? speed / KMH_TO_MPH : speed;
	const metersPerMin = (kmh * 1000) / 60;
	const wheelRpm = metersPerMin / tireCircumferenceMeters;
	const rpm = wheelRpm * overallRatio;
	return Number.isFinite(rpm) && rpm >= 0 ? rpm : 0;
};
