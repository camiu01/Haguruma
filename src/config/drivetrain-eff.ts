/**
 * @file drivetrain-eff.ts
 * @brief Default drivetrain efficiency mapped to the driven axle layout.
 */
import type { DrivetrainLayout } from '../core/models';

/** Default crank-to-wheel efficiency per layout (manual gearbox baseline). */
export const DEFAULT_DRIVETRAIN_EFF: Record<DrivetrainLayout, number> = {
	FWD: 0.90,
	RWD: 0.85,
	AWD: 0.80,
};

/**
 * @brief Resolve the default drivetrain efficiency for a layout.
 * @brief FWD loses less in the shorter half-shaft path, AWD pays for the
 * @brief extra transfer box and prop shaft, RWD sits in between.
 * @param layout Driven axle layout.
 * @return Efficiency in [0.7, 1], RWD default when the layout is unknown.
 */
export const efficiencyForLayout = (layout: DrivetrainLayout): number => {
	const v = DEFAULT_DRIVETRAIN_EFF[layout];
	return Number.isFinite(v) && v > 0 ? v : DEFAULT_DRIVETRAIN_EFF.RWD;
};
