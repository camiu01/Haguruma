/**
 * @file handbrake-math.ts
 * @brief Rear-axle handbrake retardation with live load and lateral grip budgets.
 */
import type { RunningGear } from '../models';
import { wheelLoads, downforceN, kammLimit, GRAVITY } from './dynamics-math';
import { gripGainFor } from '../../config/tire-compounds';
import type { BrakingTireForces } from './braking-simulation';

/**
 * @brief Estimate rear braking force independently of the released AWD center coupling.
 * @param rg Chassis and rear handbrake demand.
 * @param massKg Vehicle mass.
 * @param speedKmh Road speed.
 * @param accelMps2 Signed longitudinal acceleration for live load transfer.
 * @return Nonnegative tire-limited rear force in newtons.
 */
export const handbrakeForceAtSpeed = (rg: RunningGear | undefined, massKg: number, speedKmh: number, accelMps2: number): number => {
	if (!rg || !Number.isFinite(rg.handbrakeFraction) || (rg.handbrakeFraction ?? 0) <= 0) return 0;
	const fraction = Math.min(1, rg.handbrakeFraction!);
	const loads = wheelLoads(rg, massKg, accelMps2);
	const down = downforceN(rg.liftCoefficient ?? 0, rg.liftReferenceAreaM2 ?? 0, speedKmh);
	const front = rg.downforceFrontShare ?? rg.frontWeightDistribution;
	const normal = loads.rl + loads.rr + down * (1 - front);
	const lateral = massKg * GRAVITY * Math.abs(rg.lateralG) * (1 - rg.frontWeightDistribution);
	const mu = rg.roadFrictionCoefficient * gripGainFor(rg.tireCompoundId);
	const force = kammLimit(mu, normal, lateral) * fraction;
	return Number.isFinite(force) ? Math.max(0, force) : 0;
};

/**
 * @brief Share each axle's tire budget across service, handbrake and engine braking.
 * @param service Pedal force and live axle capacities.
 * @param rg Axle layout and center coupling.
 * @param coastDemand Requested engine/clutch braking.
 * @param coastLimit Differential-limited coast force.
 * @param handbrake Rear handbrake force request.
 * @return Combined force and indication that added braking exceeded an axle budget.
 */
export const combinedAxleBraking = (service: BrakingTireForces, rg: RunningGear, coastDemand: number, coastLimit: number, handbrake: number): { forceN: number; lockRisk: boolean } => {
	const rear = Math.min(service.rearCapacityN, service.rearForceN + handbrake);
	const frontRemaining = Math.max(0, service.frontCapacityN - service.frontForceN);
	const rearRemaining = Math.max(0, service.rearCapacityN - rear);
	let split = rg.awdFrontShare ?? rg.frontWeightDistribution;
	if (rg.drivetrainLayout === 'FWD' || (rg.drivetrainLayout === 'AWD' && rg.centerDisengaged)) split = 1;
	else if (rg.drivetrainLayout === 'RWD') split = 0;
	else if (rg.activeCenter) split = frontRemaining / Math.max(1, frontRemaining + rearRemaining);
	const coast = Math.max(0, Math.min(coastDemand, coastLimit));
	const extra = Math.min(frontRemaining, coast * split) + Math.min(rearRemaining, coast * (1 - split));
	return { forceN: service.frontForceN + rear + extra,
		lockRisk: service.rearForceN + handbrake > service.rearCapacityN + 1 || coast > extra + 1 };
};
