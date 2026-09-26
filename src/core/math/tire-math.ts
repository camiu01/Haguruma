/**
 * @file tire-math.ts
 * @brief Tire string parsing and circumference computation.
 */
import type { TireSpec } from '../models';

const TIRE_REGEX = /^(\d{3})\/(\d{2})\s*R?(\d{2})$/i;
const MM_PER_INCH = 25.4;

/**
 * Standard ISO/ETRTO loaded rolling-circumference factor.
 * @brief Dynamic circumference is about 97-98% of the geometric value.
 */
export const ROLLING_FACTOR_DEFAULT = 0.975;

/** Minimum accepted deflection factor (≈10% squash, beyond is invalid). */
export const ROLLING_FACTOR_MIN = 0.9;

/** Maximum accepted deflection factor (geometric circumference). */
export const ROLLING_FACTOR_MAX = 1.0;

/** Reference speed for centrifugal tire growth (growth hits cap near 250 km/h). */
export const TIRE_GROWTH_REF_KMH = 250;

/** Maximum radial growth fraction at very high speed (≈3%). */
export const TIRE_GROWTH_MAX = 0.03;

/**
 * @brief Parse a tire string like 205/55R16.
 * @param specStr Raw input value.
 * @return Parsed spec or null when the format is invalid.
 */
export const parseTire = (specStr: string): TireSpec | null => {
	if (!specStr) {
		return null;
	}
	const match = specStr.trim().match(TIRE_REGEX);
	if (!match) {
		return null;
	}
	const width = parseFloat(match[1]);
	const aspect = parseFloat(match[2]);
	const rimInch = parseFloat(match[3]);
	const sidewallMm = width * (aspect / 100);
	const diameterMm = rimInch * MM_PER_INCH + sidewallMm * 2;
	const circumferenceMm = diameterMm * Math.PI;
	return {
		width,
		aspect,
		rimInch,
		diameterMm,
		circumferenceMm,
		circumferenceM: circumferenceMm / 1000,
	};
};

/**
 * @brief Clamp a deflection factor into the valid loaded-tire range.
 * @param factor Candidate factor, e.g. 0.975.
 * @return Factor within [0.9, 1.0], default when invalid.
 */
export const clampRollingFactor = (factor: number): number => {
	if (!Number.isFinite(factor)) {
		return ROLLING_FACTOR_DEFAULT;
	}
	return Math.min(ROLLING_FACTOR_MAX, Math.max(ROLLING_FACTOR_MIN, factor));
};

/**
 * @brief Compute the effective dynamic rolling circumference.
 * @param spec Parsed tire geometry (geometric circumference).
 * @param factor Deflection factor, defaults to ISO/ETRTO 0.975.
 * @return Rolling circumference in metres, 0 when spec is null.
 */
export const effectiveCircumferenceM = (spec: TireSpec | null, factor: number = ROLLING_FACTOR_DEFAULT): number => {
	if (!spec || !Number.isFinite(spec.circumferenceM) || spec.circumferenceM <= 0) {
		return 0;
	}
	return spec.circumferenceM * clampRollingFactor(factor);
};

/**
 * @brief Centrifugal growth factor at speed (quadratic, capped at +3%).
 * @param speedKmh Vehicle speed in km/h.
 * @return Multiplier >= 1, 1 at standstill.
 */
export const tireGrowthFactorAtSpeed = (speedKmh: number): number => {
	if (!Number.isFinite(speedKmh) || speedKmh <= 0) {
		return 1;
	}
	const ratio = speedKmh / TIRE_GROWTH_REF_KMH;
	const growth = TIRE_GROWTH_MAX * ratio * ratio;
	return 1 + Math.min(TIRE_GROWTH_MAX, growth);
};

/**
 * @brief Dynamic rolling circumference with centrifugal growth.
 * @param spec Parsed tire geometry.
 * @param factor Static deflection factor (load squash).
 * @param speedKmh Vehicle speed in km/h.
 * @return Growth-adjusted circumference in metres, 0 when spec is null.
 */
export const dynamicCircumferenceM = (
	spec: TireSpec | null,
	factor: number = ROLLING_FACTOR_DEFAULT,
	speedKmh: number = 0,
): number => {
	return effectiveCircumferenceM(spec, factor) * tireGrowthFactorAtSpeed(speedKmh);
};
