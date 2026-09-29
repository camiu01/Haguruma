/**
 * @file recovery-math.ts
 * @brief Gear-drop recovery time after an upshift.
 *
 * After a shift the engine lands below its power band and must climb back to
 * peak-torque rpm. With the engaged-gear equivalent mass and the residual
 * wheel force treated as constant over the short rpm window, the recovery
 * time is t = dv / a with a = F / m and the rpm window converted to a speed
 * window through the gearing. Deliberately a first-order estimate, not a
 * transient turbo-spool model.
 */

/**
 * @brief Estimate milliseconds to recover peak-torque rpm after a shift.
 * @param landingRpm Engine rpm just after the shift (> 0).
 * @param targetRpm Rpm to recover (peak torque or power, > landingRpm).
 * @param totalRatio Engaged-gear total ratio (gear x final drive, > 0).
 * @param circM Dynamic rolling circumference in metres (> 0).
 * @param equivMassKg Vehicle plus reflected rotating mass in kg (> 0).
 * @param residualForceN Residual wheel force in N driving the recovery.
 * @return Recovery time in ms, 0 when already at target or on invalid input, Infinity when no residual force exists.
 */
export const gearDropRecoveryMs = (
	landingRpm: number,
	targetRpm: number,
	totalRatio: number,
	circM: number,
	equivMassKg: number,
	residualForceN: number,
): number => {
	const inputs = [landingRpm, targetRpm, totalRatio, circM, equivMassKg, residualForceN];
	if (!inputs.every((v) => Number.isFinite(v))) {
		return 0;
	}
	if (landingRpm <= 0 || totalRatio <= 0 || circM <= 0 || equivMassKg <= 0) {
		return 0;
	}
	if (targetRpm <= landingRpm) {
		return 0;
	}
	if (residualForceN <= 0) {
		return Number.POSITIVE_INFINITY;
	}
	const rpmToKmh = (circM * 60) / (1000 * totalRatio);
	const deltaVms = ((targetRpm - landingRpm) * rpmToKmh) / 3.6;
	const accel = residualForceN / equivMassKg;
	return ((deltaVms / accel) * 1000);
};
