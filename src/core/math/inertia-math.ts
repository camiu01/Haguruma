/**
 * @file inertia-math.ts
 * @brief Equivalent translational mass of rotating driveline inertia in a given gear.
 *
 * Rotating components (crankshaft/flywheel/clutch and wheels) store kinetic
 * energy that the engine must also spin up. Reflecting their moment of
 * inertia through the gear ratio yields an equivalent translational mass that
 * adds to the curb mass in longitudinal dynamics:
 *
 *   m_eq = (I_engine * (gear * fd)^2 + n_wheels * I_wheel) / r_dyn^2
 */

/** Default number of rotating road wheels. */
const DEFAULT_WHEEL_COUNT = 4;

/**
 * Inputs for the rotating-inertia reflection.
 * @brief Physical inertias plus the drivetrain state at which to reflect them.
 */
export interface RotatingInertiaInput {
	/** Crankshaft + flywheel + clutch moment of inertia in kg·m². */
	engineInertiaKgM2: number;
	/** Single-wheel moment of inertia (rim + tire + brake) in kg·m². */
	wheelInertiaKgM2: number;
	/** Gear ratio in which the reflection is evaluated. */
	gearRatio: number;
	/** Differential ratio. */
	fd: number;
	/** Dynamic rolling radius in metres. */
	dynRadiusM: number;
	/** Rotating wheel count (defaults to 4). */
	wheelCount?: number;
}

/**
 * @brief Reflect rotating inertia into an equivalent translational mass.
 * @param input Physical inertias and drivetrain state.
 * @return Equivalent mass in kilograms; 0 when any input is invalid.
 */
export const equivalentRotatingMassKg = (input: RotatingInertiaInput): number => {
	if (!input) {
		return 0;
	}
	const { engineInertiaKgM2, wheelInertiaKgM2, gearRatio, fd, dynRadiusM } = input;
	if (!Number.isFinite(engineInertiaKgM2) || engineInertiaKgM2 < 0) {
		return 0;
	}
	if (!Number.isFinite(wheelInertiaKgM2) || wheelInertiaKgM2 < 0) {
		return 0;
	}
	if (!Number.isFinite(gearRatio) || gearRatio <= 0 || !Number.isFinite(fd) || fd <= 0) {
		return 0;
	}
	if (!Number.isFinite(dynRadiusM) || dynRadiusM <= 0) {
		return 0;
	}
	const wheelCount = Number.isFinite(input.wheelCount as number)
		? Math.max(0, Math.floor(input.wheelCount as number))
		: DEFAULT_WHEEL_COUNT;
	const totalRatio = gearRatio * fd;
	const radiusSq = dynRadiusM * dynRadiusM;
	return (engineInertiaKgM2 * totalRatio * totalRatio + wheelCount * wheelInertiaKgM2) / radiusSq;
};

/**
 * @brief Convenience alias resolving the equivalent mass in first gear
 *        (worst-case launch inertia) using the provided gearset.
 * @param engineInertiaKgM2 Crank/flywheel inertia in kg·m².
 * @param wheelInertiaKgM2 Per-wheel inertia in kg·m².
 * @param gears Forward gear ratios (first gear is used).
 * @param fd Differential ratio.
 * @param dynRadiusM Dynamic rolling radius in metres.
 * @return Equivalent mass in kilograms; 0 when inputs are invalid.
 */
export const launchRotatingMassKg = (
	engineInertiaKgM2: number,
	wheelInertiaKgM2: number,
	gears: number[],
	fd: number,
	dynRadiusM: number,
): number => {
	if (!Array.isArray(gears) || gears.length === 0) {
		return 0;
	}
	return equivalentRotatingMassKg({
		engineInertiaKgM2,
		wheelInertiaKgM2,
		gearRatio: gears[0],
		fd,
		dynRadiusM,
	});
};
