/**
 * @file fitment-math.ts
 * @brief Pure rim-channel sizing and tire-on-rim fitment classification.
 * @brief Ratios follow ETRTO practice: the rim channel is about 80% of the
 * @brief tire section width, with an accepted window of roughly 70-90%.
 */
export const MM_PER_INCH = 25.4;

/** Rim-to-tire ratio at the centre of the square-fit window. */
export const FIT_IDEAL_RATIO = 0.8;

/** Lower edge of the accepted rim-to-tire window (balloon side). */
export const FIT_MIN_RATIO = 0.7;

/** Upper edge of the accepted rim-to-tire window (stretch side). */
export const FIT_MAX_RATIO = 0.9;

/** Tire-on-rim fitment verdict, from balloon to stretch. */
export type FitmentKind = 'balloon' | 'bulge' | 'square' | 'flush' | 'stretch';

/** Rim channel range in inches for one tire section width. */
export interface RimRange {
	/** Narrowest accepted channel in inches, rounded to 0.5. */
	min: number;
	/** Ideal channel in inches, rounded to 0.5. */
	ideal: number;
	/** Widest accepted channel in inches, rounded to 0.5. */
	max: number;
}

/** Tire width range in mm for one rim channel. */
export interface TireRange {
	/** Narrowest accepted tire in mm, rounded to 5. */
	min: number;
	/** Ideal tire in mm, rounded to 5. */
	ideal: number;
	/** Widest accepted tire in mm, rounded to 5. */
	max: number;
}

/**
 * @brief Round a channel width to the nearest half inch.
 * @param value Raw channel width in inches.
 * @return Rounded channel width, NaN on invalid input.
 */
export const roundToHalfInch = (value: number): number => {
	if (!Number.isFinite(value)) {
		return NaN;
	}
	return Math.round(value * 2) / 2;
};

/**
 * @brief Round a tire section width to the nearest 5 mm step.
 * @param value Raw tire width in mm.
 * @return Rounded tire width, NaN on invalid input.
 */
export const roundToFiveMm = (value: number): number => {
	if (!Number.isFinite(value)) {
		return NaN;
	}
	return Math.round(value / 5) * 5;
};

/**
 * @brief Check a tire section width for physical plausibility.
 * @param widthMm Tire section width in mm.
 * @return True for widths inside the 125-395 mm catalog span.
 */
export const isTireWidthValid = (widthMm: number): boolean => {
	return Number.isFinite(widthMm) && widthMm >= 125 && widthMm <= 395;
};

/**
 * @brief Check a rim channel width for physical plausibility.
 * @param rimInch Rim channel width in inches.
 * @return True for channels inside the 4-14 inch span.
 */
export const isRimWidthValid = (rimInch: number): boolean => {
	return Number.isFinite(rimInch) && rimInch >= 4 && rimInch <= 14;
};

/**
 * @brief Ideal rim channel for a tire section width.
 * @param tireWidthMm Tire section width in mm.
 * @return Ideal channel in inches rounded to 0.5, NaN when invalid.
 */
export const idealRimWidthInch = (tireWidthMm: number): number => {
	if (!isTireWidthValid(tireWidthMm)) {
		return NaN;
	}
	return roundToHalfInch((tireWidthMm / MM_PER_INCH) * FIT_IDEAL_RATIO);
};

/**
 * @brief Accepted rim channel window for a tire section width.
 * @param tireWidthMm Tire section width in mm.
 * @return Min/ideal/max channel in inches, or null when invalid.
 */
export const rimRangeForTire = (tireWidthMm: number): RimRange | null => {
	if (!isTireWidthValid(tireWidthMm)) {
		return null;
	}
	const base = tireWidthMm / MM_PER_INCH;
	return {
		min: roundToHalfInch(base * FIT_MIN_RATIO),
		ideal: roundToHalfInch(base * FIT_IDEAL_RATIO),
		max: roundToHalfInch(base * FIT_MAX_RATIO),
	};
};

/**
 * @brief Accepted tire width window for a rim channel.
 * @param rimInch Rim channel width in inches.
 * @return Min/ideal/max tire width in mm, or null when invalid.
 */
export const tireRangeForRim = (rimInch: number): TireRange | null => {
	if (!isRimWidthValid(rimInch)) {
		return null;
	}
	const channelMm = rimInch * MM_PER_INCH;
	return {
		min: roundToFiveMm(channelMm / FIT_MAX_RATIO),
		ideal: roundToFiveMm(channelMm / FIT_IDEAL_RATIO),
		max: roundToFiveMm(channelMm / FIT_MIN_RATIO),
	};
};

/**
 * @brief Rim-to-tire width ratio driving the fitment verdict.
 * @param tireWidthMm Tire section width in mm.
 * @param rimInch Rim channel width in inches.
 * @return Channel share of the section width, NaN when invalid.
 */
export const fitmentRatio = (tireWidthMm: number, rimInch: number): number => {
	if (!isTireWidthValid(tireWidthMm) || !isRimWidthValid(rimInch)) {
		return NaN;
	}
	return (rimInch * MM_PER_INCH) / tireWidthMm;
};

/**
 * @brief Classify the tire-on-rim fitment from the width ratio.
 * @param tireWidthMm Tire section width in mm.
 * @param rimInch Rim channel width in inches.
 * @return Fitment verdict, or null when either input is invalid.
 */
export const classifyFitment = (tireWidthMm: number, rimInch: number): FitmentKind | null => {
	const ratio = fitmentRatio(tireWidthMm, rimInch);
	if (!Number.isFinite(ratio)) {
		return null;
	}
	if (ratio < 0.67) {
		return 'balloon';
	}
	if (ratio < 0.73) {
		return 'bulge';
	}
	if (ratio <= 0.87) {
		return 'square';
	}
	if (ratio <= 0.93) {
		return 'flush';
	}
	return 'stretch';
};
