/**
 * @file drive-force.ts
 * @brief Shared mapped wheel force and self-consistent longitudinal transfer.
 */
import { tractiveForceAt, type EngineCurve } from './traction-math';
import { maxDriveForceAtSpeed } from './dynamics-math';
import type { RunningGear } from '../models';
import { gripGainFor } from '../../config/tire-compounds';

/**
 * @brief Compute wheel force with optional torque/load-sensitive losses.
 * @param rpm Engine speed.
 * @param ratio Engaged ratio.
 * @param fd Final drive.
 * @param radius Rolling radius.
 * @param curve Valid engine curve.
 * @param nominal Nominal transmission efficiency.
 * @param rg Chassis layout.
 * @param mapped Enable the loss map.
 * @return Wheel force in newtons.
 */
export const wheelForceAt = (
	rpm: number, ratio: number, fd: number, radius: number, curve: EngineCurve,
	nominal: number, rg?: RunningGear, mapped = false,
): number => {
	if (![rpm, ratio, fd, radius, nominal].every(Number.isFinite)
		|| rpm <= 0 || ratio <= 0 || fd <= 0 || radius <= 0) return 0;
	return tractiveForceAt(rpm, ratio, fd, radius, curve, nominal, mapped ? rg?.drivetrainLayout ?? 'RWD' : undefined);
};

/**
 * @brief Solve acceleration and grip together by bounded relaxed iteration.
 * @param rg Running gear, absent disables the traction clamp.
 * @param massKg Static vehicle mass.
 * @param effectiveMassKg Mass plus reflected rotating inertia.
 * @param speedKmh Current road speed.
 * @param demandN Unclamped engine wheel force.
 * @param resistanceN Signed road resistance.
 * @param radiusM Rolling radius for axle preload, defaults to 0.3 m for legacy callers.
 * @return Available drive force, always including a zero-grip clamp.
 */
export const transferredDriveForce = (
	rg: RunningGear | undefined, massKg: number, effectiveMassKg: number,
	speedKmh: number, demandN: number, resistanceN: number, radiusM = 0.3,
): number => {
	if (!rg) return demandN;
	if (rg.lateralG === 0 && rg.drivetrainLayout === 'AWD' && rg.centerDiffLock === 1) {
		return Math.min(Math.max(0, demandN), maxDriveForceAtSpeed(rg, massKg, speedKmh, demandN, 0, undefined, undefined, radiusM).limitN);
	}
	if (rg.lateralG === 0 && rg.drivetrainLayout !== 'AWD') {
		return straightDriveForce(rg, massKg, effectiveMassKg, speedKmh, demandN, resistanceN, radiusM);
	}
	let acceleration = 0;
	let force = 0;
	for (let i = 0; i < 12; i += 1) {
		const limit = maxDriveForceAtSpeed(rg, massKg, speedKmh, demandN, acceleration, undefined, undefined, radiusM).limitN;
		force = Math.min(Math.max(0, demandN), limit);
		const next = (force - resistanceN) / effectiveMassKg;
		if (Math.abs(next - acceleration) < 0.002) break;
		acceleration = (acceleration + next) / 2;
	}
	return force;
};

/**
 * @brief Solve the linear straight-line axle-transfer relation without iteration.
 * @param rg Two-wheel-drive running gear with zero lateral demand.
 * @param massKg Static vehicle mass.
 * @param effectiveMassKg Effective accelerating mass.
 * @param speedKmh Current speed.
 * @param demandN Engine wheel force.
 * @param resistanceN Signed road loads.
 * @param radiusM Rolling radius for axle preload.
 * @return Self-consistent clamped wheel force.
 */
const straightDriveForce = (
	rg: RunningGear, massKg: number, effectiveMassKg: number, speedKmh: number, demandN: number, resistanceN: number, radiusM: number,
): number => {
	const base = maxDriveForceAtSpeed(rg, massKg, speedKmh, demandN, 0, undefined, undefined, radiusM).limitN;
	const mu = rg.roadFrictionCoefficient * gripGainFor(rg.tireCompoundId);
	const slope = mu * massKg * rg.centerOfGravityHeightMm / rg.wheelbaseMm
		* (rg.drivetrainLayout === 'FWD' ? -1 : 1);
	const denominator = 1 - slope / effectiveMassKg;
	const limit = denominator > 0 ? Math.max(0, (base - slope * resistanceN / effectiveMassKg) / denominator) : demandN;
	const force = Math.min(Math.max(0, demandN), limit);
	const actualLimit = maxDriveForceAtSpeed(rg, massKg, speedKmh, force,
		(force - resistanceN) / effectiveMassKg, undefined, undefined, radiusM).limitN;
	return Math.min(force, actualLimit);
};
