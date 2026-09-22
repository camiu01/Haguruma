/**
 * @file aero-math.ts
 * @brief Secondary road-load physics: weight, aerodynamic drag and rolling resistance.
 *
 * The primary graph shows no-load theoretical speed at the rev limiter.
 * This secondary module estimates the wheel power required to sustain each
 * gear peak against road load, so drag-limited expectations stay visible
 * next to the theoretical figures.
 */

const GRAVITY = 9.81;
const AIR_DENSITY = 1.225;
const KW_TO_HP = 1.35962;

/** Absolute ceiling for the top-speed bisection (record prototypes, dragsters). */
const TOP_SPEED_HARD_CAP = 600;

/** Minimum window for the bisection upper bound. */
const TOP_SPEED_MIN_HIGH = 400;

/**
 * @brief Clamp a road grade into a sane range.
 * @param gradePercent Slope in percent (+uphill, -downhill).
 * @return Grade within [-30, +30].
 */
export const clampGrade = (gradePercent: number): number => {
	if (!Number.isFinite(gradePercent)) {
		return 0;
	}
	return Math.min(30, Math.max(-30, gradePercent));
};

/**
 * @brief Convert km/h to m/s.
 * @param kmh Speed in kilometres per hour.
 * @return Speed in metres per second.
 */
export const kmhToMs = (kmh: number): number => {
	return kmh / 3.6;
};

/**
 * @brief Compute aerodynamic drag force.
 * @param speedKmh Vehicle speed in km/h.
 * @param dragCd Drag coefficient (dimensionless).
 * @param frontalAreaM2 Frontal area in square metres.
 * @param rho Air density in kg/m3.
 * @return Drag force in newtons.
 */
export const dragForce = (
	speedKmh: number,
	dragCd: number,
	frontalAreaM2: number,
	rho: number = AIR_DENSITY,
): number => {
	const v = kmhToMs(Math.max(0, speedKmh));
	return 0.5 * rho * dragCd * frontalAreaM2 * v * v;
};

/**
 * @brief Compute rolling-resistance force from vehicle mass.
 * @param massKg Vehicle mass in kilograms.
 * @param crr Rolling-resistance coefficient.
 * @return Rolling force in newtons.
 */
export const rollingForce = (massKg: number, crr: number): number => {
	if (massKg <= 0 || crr <= 0) {
		return 0;
	}
	return massKg * GRAVITY * crr;
};

/**
 * @brief Compute grade-resistance force from road slope.
 * @param massKg Vehicle mass in kilograms.
 * @param gradePercent Slope in percent (+uphill, -downhill).
 * @return Grade force in newtons (negative on descents).
 */
export const gradeForce = (massKg: number, gradePercent: number): number => {
	if (massKg <= 0) {
		return 0;
	}
	const grade = clampGrade(gradePercent) / 100;
	return massKg * GRAVITY * (grade / Math.sqrt(1 + grade * grade));
};

/**
 * @brief Estimate wheel power required to sustain a given speed.
 * @param speedKmh Vehicle speed in km/h.
 * @param massKg Vehicle mass in kilograms.
 * @param dragCd Drag coefficient.
 * @param frontalAreaM2 Frontal area in square metres.
 * @param crr Rolling-resistance coefficient.
 * @param gradePercent Road slope in percent (+uphill, -downhill).
 * @return Required power in kilowatts.
 */
export const roadLoadPowerKw = (
	speedKmh: number,
	massKg: number,
	dragCd: number,
	frontalAreaM2: number,
	crr: number,
	gradePercent: number = 0,
): number => {
	const totalForce =
		dragForce(speedKmh, dragCd, frontalAreaM2) + rollingForce(massKg, crr) + gradeForce(massKg, gradePercent);
	return (totalForce * kmhToMs(Math.max(0, speedKmh))) / 1000;
};

/**
 * @brief Convert kilowatts to metric horsepower.
 * @param kw Power in kilowatts.
 * @return Power in hp.
 */
export const kwToHp = (kw: number): number => {
	return kw * KW_TO_HP;
};

/**
 * @brief Compute available wheel power from engine output.
 * @param engineKw Engine crank power in kilowatts.
 * @param drivetrainEff Drivetrain efficiency between 0 and 1.
 * @return Wheel power in kilowatts.
 */
export const availableWheelKw = (engineKw: number, drivetrainEff: number): number => {
	if (engineKw <= 0 || drivetrainEff <= 0) {
		return 0;
	}
	return engineKw * Math.min(1, drivetrainEff);
};

/**
 * @brief Solve the drag-limited top speed for a given wheel power.
 * @brief Finds v where road-load power equals available power (bisection).
 * @param wheelKw Available wheel power in kilowatts.
 * @param massKg Vehicle mass in kilograms.
 * @param dragCd Drag coefficient.
 * @param frontalAreaM2 Frontal area in square metres.
 * @param crr Rolling-resistance coefficient.
 * @param gradePercent Road slope in percent (+uphill, -downhill).
 * @return Drag-limited speed in km/h, or 0 when power is zero.
 */
export const dragLimitedSpeedKmh = (
	wheelKw: number,
	massKg: number,
	dragCd: number,
	frontalAreaM2: number,
	crr: number,
	gradePercent: number = 0,
): number => {
	if (wheelKw <= 0 || !Number.isFinite(wheelKw)) {
		return 0;
	}
	const loadAt = (v: number): number => roadLoadPowerKw(v, massKg, dragCd, frontalAreaM2, crr, gradePercent);
	let low = 0;
	let high = TOP_SPEED_MIN_HIGH;
	while (high < TOP_SPEED_HARD_CAP && loadAt(high) <= wheelKw) {
		low = high;
		high = Math.min(TOP_SPEED_HARD_CAP, high * 1.5);
		if (high >= TOP_SPEED_HARD_CAP) {
			break;
		}
	}
	for (let i = 0; i < 40; i += 1) {
		const mid = (low + high) / 2;
		if (loadAt(mid) <= wheelKw) {
			low = mid;
		} else {
			high = mid;
		}
	}
	return low;
};
