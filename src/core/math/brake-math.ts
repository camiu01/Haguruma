/**
 * @file brake-math.ts
 * @brief Braking bias and stopping-distance model from dynamic load transfer.
 *
 * Under deceleration the vertical load moves forward by m x a x h / L, so the
 * ideal front brake bias equals the dynamic front load share. When the rear
 * dynamic load collapses the rear axle locks first (trail-braking
 * instability); when bias stays too far forward the front locks early and the
 * car understeers on entry. Stopping distance follows v^2 / (2 x a) with the
 * friction deceleration corrected by aero drag (helps) and grade (signed).
 */
import { GRAVITY } from './dynamics-math';

/** Rear dynamic load share below which rear lockup is flagged. */
export const REAR_LOCK_SHARE = 0.2;

/**
 * Ideal brake bias result.
 * @brief Dynamic axle loads at the given deceleration plus lockup flag.
 */
export interface BrakeBias {
	/** Ideal front bias fraction in [0, 1] (0 on invalid input). */
	frontBias: number;
	/** Dynamic front axle load in N. */
	frontDynN: number;
	/** Dynamic rear axle load in N (clamped at 0). */
	rearDynN: number;
	/** True when the rear share drops below REAR_LOCK_SHARE. */
	rearLockRisk: boolean;
}

/**
 * @brief Ideal front brake bias from deceleration load transfer.
 * @param staticFrontN Static front axle load in N.
 * @param staticRearN Static rear axle load in N.
 * @param wheelbaseM Wheelbase in metres.
 * @param cogHeightM CoG height in metres.
 * @param decelG Deceleration in g (positive value, e.g. 1.2).
 * @return BrakeBias with dynamic loads; neutral zeros on invalid input.
 */
export const idealBrakeBiasFront = (
	staticFrontN: number,
	staticRearN: number,
	wheelbaseM: number,
	cogHeightM: number,
	decelG: number,
): BrakeBias => {
	const neutral: BrakeBias = { frontBias: 0, frontDynN: 0, rearDynN: 0, rearLockRisk: false };
	if (
		![staticFrontN, staticRearN, wheelbaseM, cogHeightM, decelG].every((v) => Number.isFinite(v)) ||
		staticFrontN < 0 ||
		staticRearN < 0 ||
		wheelbaseM <= 0 ||
		cogHeightM < 0 ||
		decelG < 0
	) {
		return neutral;
	}
	const total = staticFrontN + staticRearN;
	if (total <= 0) {
		return neutral;
	}
	const transfer = total * decelG * (cogHeightM / wheelbaseM);
	const frontDynN = staticFrontN + transfer;
	const rearDynN = Math.max(0, staticRearN - transfer);
	const denom = frontDynN + rearDynN;
	if (denom <= 0) {
		return neutral;
	}
	return {
		frontBias: frontDynN / denom,
		frontDynN,
		rearDynN,
		rearLockRisk: rearDynN / denom < REAR_LOCK_SHARE,
	};
};

/**
 * @brief Stopping distance from speed with mu plus aero/grade correction.
 * @param speedKmh Initial speed in km/h.
 * @param mu Road friction coefficient (> 0).
 * @param massKg Vehicle mass in kg (> 0).
 * @param dragN Aerodynamic drag force in N at that speed (helps braking).
 * @param gradeN Grade resistance in N (positive uphill, negative downhill).
 * @return Stopping distance in metres, 0 on invalid input, Infinity when the net deceleration is not positive.
 */
export const stoppingDistanceM = (
	speedKmh: number,
	mu: number,
	massKg: number,
	dragN: number = 0,
	gradeN: number = 0,
): number => {
	if (
		![speedKmh, mu, massKg, dragN, gradeN].every((v) => Number.isFinite(v)) ||
		speedKmh < 0 ||
		mu <= 0 ||
		massKg <= 0
	) {
		return 0;
	}
	const vms = speedKmh / 3.6;
	const decel = mu * GRAVITY + (dragN + gradeN) / massKg;
	if (decel <= 0) {
		return Number.POSITIVE_INFINITY;
	}
	return (vms * vms) / (2 * decel);
};
