/**
 * @file dynamics-input.ts
 * @brief Build shared simulation inputs from primary application state.
 */
import { state } from './app-state';
import { activeEngineCurve, compEngineCurve } from './engine-curve';
import { effectiveCircumferenceM, parseTire } from '../math/tire-math';
import type { SimInput } from '../math/accel-math';
import type { BrakingInput } from '../math/braking-simulation';
import type { ForceProfileInput } from '../math/force-profile';

/**
 * @brief Resolve the current primary rolling circumference.
 * @return Circumference in metres, zero for an invalid tire.
 */
export const primaryCircM = (): number => {
	const tire = parseTire(state.primaryTire);
	return tire ? effectiveCircumferenceM(tire, state.rollingFactor) : 0;
};

/**
 * @brief Build acceleration and lap-sequence inputs including v0.7 controls.
 * @return Current simulation inputs.
 */
export const primarySimInput = (): SimInput => ({
	massKg: state.vehicleMassKg, gears: state.gears, fd: state.primaryFd, circM: primaryCircM(),
	curve: activeEngineCurve(), drivetrainEff: state.drivetrainEff, runningGear: state.runningGear,
	rotatingMassKg: state.rotatingMassKg, shiftTimeS: state.dynamics.useGearboxDefaults ? undefined : state.shiftTimeS,
	shiftTimesS: state.dynamics.shiftTimesS, gearbox: state.dynamics.gearbox,
	limiter: state.dynamics.limiter, efficiencyMap: state.dynamics.efficiencyMap,
	dragCd: state.dragCd, frontalAreaM2: state.frontalAreaM2, rollingCrr: state.rollingCrr,
	roadGradePercent: state.roadGradePercent,
});

/**
 * @brief Build stopping-run inputs from the live primary chassis.
 * @return Current braking settings.
 */
export const primaryBrakingInput = (): BrakingInput => ({
	massKg: state.vehicleMassKg, runningGear: state.runningGear,
	abs: state.dynamics.abs, frontBias: state.dynamics.brakeFrontBias, demandG: state.dynamics.brakeDemandG,
	dragCd: state.dragCd, frontalAreaM2: state.frontalAreaM2,
	rollingCrr: state.rollingCrr, roadGradePercent: state.roadGradePercent,
});

/**
 * @brief Build the primary force profile used by graph, table and telemetry.
 * @return Current wheel-force and road-load inputs.
 */
export const primaryForceInput = (): ForceProfileInput => ({
	gears: state.gears, fd: state.primaryFd, circM: primaryCircM(), curve: activeEngineCurve(),
	eff: state.drivetrainEff, mapped: state.dynamics.efficiencyMap, runningGear: state.runningGear,
	massKg: state.vehicleMassKg, cd: state.dragCd, areaM2: state.frontalAreaM2,
	crr: state.rollingCrr, grade: state.roadGradePercent,
});

/**
 * @brief Build independent force-profile inputs for the secondary vehicle.
 * @return Secondary profile, null for an invalid tire.
 */
export const comparisonForceInput = (): ForceProfileInput | null => {
	const tire = parseTire(state.compTire);
	if (!tire) return null;
	return { gears: state.compGears, fd: state.compFd, circM: effectiveCircumferenceM(tire, state.rollingFactor),
		curve: compEngineCurve(), eff: state.drivetrainEff, mapped: state.dynamics.efficiencyMap,
		runningGear: state.compRunningGear, massKg: state.compMassKg, cd: state.compCd,
		areaM2: state.compFrontalAreaM2, crr: state.rollingCrr, grade: state.roadGradePercent };
};
