/**
 * @file dynamics-math.ts
 * @brief Load transfer, Kamm circle, differential, wheelspin and coast limits.
 *
 * SI discipline: speeds enter in km/h at the API boundary but every
 * iterative relation (spin scan, force-vs-speed) converts once to SI
 * via kmhToMs / speedKmh / rpmFromKmh. Imperial display (mph) is
 * applied only at the final output step through toDisplaySpeed, so the
 * kmh<->mph factor never pollutes the physics loop.
 */
import { rpmFromKmh, speedKmh, toDisplaySpeed } from './speed-math';
import { dynamicRadiusM, tractiveForceAt } from './traction-math';
import { kmhToMs } from './aero-math';
import type { DifferentialType, RunningGear, SpeedUnit } from '../models';

/** Standard gravity in m/s2. */
export const GRAVITY = 9.81;
/** Torque bias ratio of a Torsen differential. */
export const TORSEN_TBR = 3.0;
/** Curve shape taken from tractiveForceAt without extra type imports. */
type Curve = Parameters<typeof tractiveForceAt>[4];
/** Four wheel loads in newtons. */
type Loads = { fl: number; fr: number; rl: number; rr: number };

/**
 * @brief Clamp a value into [min, max], NaN-safe.
 * @param v Candidate value, min lower bound, max upper bound.
 * @return Clamped finite value.
 */
const clampNum = (v: number, min: number, max: number): number => {
	if (!Number.isFinite(v)) return min;
	return Math.min(max, Math.max(min, v));
};

/**
 * @brief Static axle loads without transfer.
 * @param massKg Vehicle mass, frontDist front share [0, 1].
 * @return Front and rear static loads in newtons.
 */
export const staticAxleLoads = (massKg: number, frontDist: number): { frontN: number; rearN: number } => {
	if (!Number.isFinite(massKg) || massKg <= 0) return { frontN: 0, rearN: 0 };
	const total = massKg * GRAVITY;
	const share = clampNum(frontDist, 0, 1);
	return { frontN: total * share, rearN: total * (1 - share) };
};

/**
 * @brief Longitudinal load transfer under acceleration.
 * @param massKg Mass, accelMps2 accel, cogMm CoG height, wheelbaseMm base.
 * @return Transfer in newtons, rearward positive.
 */
export const longitudinalTransfer = (massKg: number, accelMps2: number, cogMm: number, wheelbaseMm: number): number => {
	if (!Number.isFinite(massKg) || massKg <= 0 || !Number.isFinite(accelMps2) || accelMps2 === 0) return 0;
	if (!Number.isFinite(cogMm) || !Number.isFinite(wheelbaseMm) || wheelbaseMm <= 0) return 0;
	return massKg * accelMps2 * (cogMm / wheelbaseMm);
};

/**
 * @brief Total lateral load transfer under cornering.
 * @param massKg Mass, latG lateral g, cogMm CoG height, trackMm track.
 * @return Side-to-side transfer in newtons.
 */
export const lateralTransfer = (massKg: number, latG: number, cogMm: number, trackMm: number): number => {
	if (!Number.isFinite(massKg) || massKg <= 0 || !Number.isFinite(latG) || latG === 0) return 0;
	if (!Number.isFinite(cogMm) || !Number.isFinite(trackMm) || trackMm <= 0) return 0;
	return massKg * latG * GRAVITY * (cogMm / trackMm);
};

/**
 * @brief Aerodynamic downforce from speed.
 * @param liftCd Lift coeff, areaM2 reference area, speedKmh speed.
 * @return Downforce in newtons.
 */
export const downforceN = (liftCd: number, areaM2: number, speedKmh: number): number => {
	if (!Number.isFinite(liftCd) || !Number.isFinite(areaM2) || areaM2 <= 0) return 0;
	if (!Number.isFinite(speedKmh) || speedKmh <= 0) return 0;
	const v = kmhToMs(speedKmh);
	return 0.5 * 1.225 * liftCd * areaM2 * v * v;
};

/**
 * @brief Suspension compression from vertical force (per-corner).
 * @param forceN Vertical force, springNmm per-corner rate.
 * @return Compression in millimetres.
 */
export const compressionMm = (forceN: number, springNmm: number): number => {
	if (!Number.isFinite(forceN) || forceN <= 0 || !Number.isFinite(springNmm) || springNmm <= 0) return 0;
	return forceN / springNmm;
};

/**
 * @brief Per-wheel vertical loads with axle-split lateral transfer.
 *
 * Physics: the TOTAL lateral transfer dLat arises from the rollover
 * torque m×ay×h balanced by the track T; it is then split between the
 * axles in proportion to the static load (dist / 1−dist), and each
 * axle share goes ENTIRELY from the inner wheel to the outer one:
 * inner = axleLoad/2 − dAxle, outer = axleLoad/2 + dAxle. Re-dividing
 * the axle share (dAxle/2) would underestimate the transfer by 50 %
 * and inflate the cornering grip.
 * @param rg Setup, massKg mass, accelMps2 longitudinal accel.
 * @return Four clamped wheel loads in newtons.
 */
export const wheelLoads = (rg: RunningGear, massKg: number, accelMps2: number): Loads => {
	if (!rg || !Number.isFinite(massKg) || massKg <= 0) return { fl: 0, fr: 0, rl: 0, rr: 0 };
	const dist = clampNum(rg.frontWeightDistribution, 0, 1);
	const total = massKg * GRAVITY;
	const ax = Number.isFinite(accelMps2) ? accelMps2 : 0;
	const dLong = longitudinalTransfer(massKg, ax, rg.centerOfGravityHeightMm, rg.wheelbaseMm);
	const stat = staticAxleLoads(massKg, dist);
	const frontAxle = clampNum(stat.frontN - dLong, 0, total);
	const rearAxle = clampNum(total - frontAxle, 0, total);
	const dLat = lateralTransfer(massKg, rg.lateralG, rg.centerOfGravityHeightMm, rg.trackWidthMm);
	const fLat = dLat * dist;
	const rLat = dLat * (1 - dist);
	return { fl: Math.max(0, frontAxle / 2 - fLat), fr: Math.max(0, frontAxle / 2 + fLat), rl: Math.max(0, rearAxle / 2 - rLat), rr: Math.max(0, rearAxle / 2 + rLat) };
};

/**
 * @brief Pick inner/outer driven loads for the diff model.
 * @param rg Setup (inner is left when latG >= 0), loads wheel loads.
 * @return Inner and outer loads in newtons.
 */
export const drivenWheelsLoad = (rg: RunningGear, loads: Loads): { innerN: number; outerN: number } => {
	const safe = (v: number): number => (Number.isFinite(v) && v > 0 ? v : 0);
	const fl = safe(loads?.fl);
	const fr = safe(loads?.fr);
	const rl = safe(loads?.rl);
	const rr = safe(loads?.rr);
	const leftIn = !Number.isFinite(rg?.lateralG) || rg.lateralG >= 0;
	if (rg?.drivetrainLayout === 'FWD') return leftIn ? { innerN: fl, outerN: fr } : { innerN: fr, outerN: fl };
	if (rg?.drivetrainLayout === 'RWD') return leftIn ? { innerN: rl, outerN: rr } : { innerN: rr, outerN: rl };
	return leftIn ? { innerN: fl + rl, outerN: fr + rr } : { innerN: fr + rr, outerN: fl + rl };
};

/**
 * @brief Kamm friction-circle longitudinal limit.
 * @param mu Friction, fzN vertical load, fyN lateral force.
 * @return Available longitudinal force in newtons.
 */
export const kammLimit = (mu: number, fzN: number, fyN: number): number => {
	if (!Number.isFinite(mu) || mu <= 0 || !Number.isFinite(fzN) || fzN <= 0) return 0;
	const fy = Number.isFinite(fyN) ? Math.abs(fyN) : 0;
	const avail = mu * fzN;
	if (fy >= avail) return 0;
	const inner = avail * avail - fy * fy;
	if (inner <= Math.max(1e-9, avail * avail * 1e-12)) return 0;
	return Math.sqrt(inner);
};

/**
 * @brief Differential-limited total drive force.
 * @param type Diff model, bias lock [0, 1], fxInner/fxOuter capacities.
 * @return Total drive-force limit in newtons.
 */
export const diffLimit = (type: DifferentialType, bias: number, fxInner: number, fxOuter: number): number => {
	const inner = Number.isFinite(fxInner) && fxInner > 0 ? fxInner : 0;
	const outer = Number.isFinite(fxOuter) && fxOuter > 0 ? fxOuter : 0;
	if (type === 'spool') return inner + outer;
	if (type === 'torsen') return inner * (1 + TORSEN_TBR);
	if (type === 'clutch_lsd') return inner + Math.min(outer, inner + clampNum(bias, 0, 1) * (outer - inner));
	return 2 * inner;
};

/**
 * @brief Friction-limited force the driven axle can transmit at speed.
 *
 * Shared by the acceleration path (differentialBias) and the coast /
 * engine-braking path (differentialCoastBias). Physics: F_down(v) =
 * ½ × ρ × CL × A × v² adds to the vertical load; the front/rear split
 * follows downforceFrontShare (default = static weight distribution).
 * Longitudinal transfer follows the signed accelMps2 (negative on
 * deceleration moves load forward). The lateral force is distributed
 * across the driven wheels in proportion to their vertical load, then
 * each wheel's longitudinal capacity comes from the Kamm circle.
 * @param rg Setup, massKg mass, speedKmh speed, accelMps2 signed accel.
 * @param bias Lock fraction applied to the clutch-LSD model.
 * @return Total driven-axle force limit in newtons.
 */
const drivenAxleLimitN = (rg: RunningGear, massKg: number, speedKmh: number, accelMps2: number, bias: number): number => {
	const loads = wheelLoads(rg, massKg, accelMps2);
	const vKmh = Number.isFinite(speedKmh) && speedKmh > 0 ? speedKmh : 0;
	const cl = Number.isFinite(rg.liftCoefficient) ? (rg.liftCoefficient as number) : 0;
	const area = Number.isFinite(rg.liftReferenceAreaM2) ? (rg.liftReferenceAreaM2 as number) : 0;
	const down = downforceN(cl, area, vKmh);
	const dist = clampNum(rg.frontWeightDistribution, 0, 1);
	const fShare = Number.isFinite(rg.downforceFrontShare) ? clampNum(rg.downforceFrontShare as number, 0, 1) : dist;
	const fz: Loads = { fl: loads.fl + (down * fShare) / 2, fr: loads.fr + (down * fShare) / 2, rl: loads.rl + (down * (1 - fShare)) / 2, rr: loads.rr + (down * (1 - fShare)) / 2 };
	const totalLat = massKg * GRAVITY * Math.abs(Number.isFinite(rg.lateralG) ? rg.lateralG : 0);
	const driven = drivenWheelsLoad(rg, fz);
	const awd = rg.drivetrainLayout === 'AWD';
	const share = rg.drivetrainLayout === 'FWD' ? dist : rg.drivetrainLayout === 'RWD' ? 1 - dist : 1;
	const axleFy = awd ? totalLat : totalLat * share;
	const latSum = driven.innerN + driven.outerN;
	const fyInner = latSum > 0 ? axleFy * driven.innerN / latSum : 0;
	const fyOuter = latSum > 0 ? axleFy * driven.outerN / latSum : 0;
	const fxIn = kammLimit(muOf(rg), driven.innerN, fyInner);
	const fxOut = kammLimit(muOf(rg), driven.outerN, fyOuter);
	return Math.max(0, diffLimit(rg.differentialType, bias, fxIn, fxOut));
};

/**
 * @brief Resolve the usable road friction coefficient of a setup.
 * @param rg Setup carrying roadFrictionCoefficient.
 * @return Friction coefficient, 0 when missing or invalid.
 */
const muOf = (rg: RunningGear): number => {
	return Number.isFinite(rg?.roadFrictionCoefficient) && rg.roadFrictionCoefficient > 0 ? rg.roadFrictionCoefficient : 0;
};

/**
 * @brief Friction-limited drive force at speed, with real downforce.
 *
 * Physics: F_down(v) = ½ × ρ × CL × A × v² adds to the vertical
 * load; the front/rear split follows downforceFrontShare (default =
 * static weight distribution). At v = 0 the term vanishes and the
 * limit reverts to pure μ × Fz_static.
 * @param rg Setup, massKg mass, speedKmh speed, engineForceN force, accelMps2 accel.
 * @param liftCd Lift coefficient override (NaN falls back to rg).
 * @param liftAreaM2 Reference area override (NaN falls back to rg).
 * @return Limit, per-wheel share and wheelspin flag.
 */
export const maxDriveForceAtSpeed = (rg: RunningGear, massKg: number, speedKmh: number, engineForceN: number, accelMps2: number, liftCd?: number, liftAreaM2?: number): { limitN: number; perWheelN: number; isSpin: boolean } => {
	if (!rg || !Number.isFinite(massKg) || massKg <= 0) return { limitN: 0, perWheelN: 0, isSpin: false };
	if (muOf(rg) <= 0) return { limitN: 0, perWheelN: 0, isSpin: false };
	const withOverrides = liftCd !== undefined || liftAreaM2 !== undefined ? { ...rg, liftCoefficient: Number.isFinite(liftCd as number) ? (liftCd as number) : rg.liftCoefficient, liftReferenceAreaM2: Number.isFinite(liftAreaM2 as number) ? (liftAreaM2 as number) : rg.liftReferenceAreaM2 } : rg;
	const limitN = drivenAxleLimitN(withOverrides, massKg, speedKmh, accelMps2, rg.differentialBias);
	const force = Number.isFinite(engineForceN) ? engineForceN : 0;
	return { limitN, perWheelN: limitN / (rg.drivetrainLayout === 'AWD' ? 4 : 2), isSpin: force > limitN };
};

/**
 * @brief Friction-limited engine-braking (coast) force at speed.
 *
 * Physics: on a closed throttle the engine drags through the driveline
 * with roughly ENGINE_BRAKE_FRACTION of its full-throttle torque; the
 * driven axle can only transmit as much of that force as the Kamm circle
 * allows with the COAST-side differential lock (differentialCoastBias).
 * Deceleration shifts load forward (negative accelMps2), so a RWD inner
 * wheel unloads and locks first, exactly what a high coast-lock LSD
 * exacerbates off-throttle.
 * @param rg Setup, massKg mass, speedKmh speed, demandN engine-brake force.
 * @param decelMps2 Deceleration magnitude causing the forward transfer.
 * @return Limit, per-wheel share and inside-wheel lockup flag.
 */
export const maxCoastForceAtSpeed = (rg: RunningGear, massKg: number, speedKmh: number, demandN: number, decelMps2: number): { limitN: number; perWheelN: number; isLockup: boolean } => {
	if (!rg || !Number.isFinite(massKg) || massKg <= 0) return { limitN: 0, perWheelN: 0, isLockup: false };
	if (muOf(rg) <= 0) return { limitN: 0, perWheelN: 0, isLockup: false };
	const limitN = drivenAxleLimitN(rg, massKg, speedKmh, -Math.abs(decelMps2), rg.differentialCoastBias ?? 0);
	const demand = Number.isFinite(demandN) ? Math.abs(demandN) : 0;
	return { limitN, perWheelN: limitN / (rg.drivetrainLayout === 'AWD' ? 4 : 2), isLockup: demand > limitN };
};

/**
 * @brief First wheelspin speed per gear.
 * @param gears Ratios, fd drive, circM circumference, curve engine, eff efficiency.
 * @return Per-gear spin speed or null when the gear never spins.
 */
export const criticalWheelspinSpeed = (gears: number[], fd: number, circM: number, curve: Curve | null, eff: number, rg: RunningGear, massKg: number, unit: SpeedUnit = 'kmh'): (number | null)[] => {
	if (!Array.isArray(gears)) return [];
	if (gears.length === 0 || !curve) return gears.map(() => null);
	const radius = dynamicRadiusM(circM);
	if (!radius || !Number.isFinite(fd) || fd <= 0) return gears.map(() => null);
	return gears.map((gear) => spinOnsetForGear(gear, fd, circM, radius, curve, eff, rg, massKg, unit));
};

/**
 * @brief Scan one gear in 2 km/h SI steps for spin onset.
 * @param gear Ratio, fd drive, circM circumference, radius wheel radius, curve engine.
 * @return Spin onset speed in the display unit, or null.
 */
const spinOnsetForGear = (gear: number, fd: number, circM: number, radius: number, curve: Curve, eff: number, rg: RunningGear, massKg: number, unit: SpeedUnit): number | null => {
	if (!Number.isFinite(gear) || gear <= 0 || !Number.isFinite(curve?.redline) || curve.redline <= 0) return null;
	const topKmh = speedKmh(curve.redline, gear, fd, circM);
	if (!Number.isFinite(topKmh) || topKmh <= 0) return null;
	for (let vKmh = 0; vKmh <= topKmh; vKmh += 2) {
		const rpm = rpmFromKmh(vKmh, gear, fd, circM);
		if (!Number.isFinite(rpm) || rpm < 1000 || rpm > curve.redline) continue;
		const force = tractiveForceAt(rpm, gear, fd, radius, curve, eff);
		if (force > maxDriveForceAtSpeed(rg, massKg, vKmh, 0, 0).limitN) return toDisplaySpeed(vKmh, unit);
	}
	return null;
};

/** Closed-throttle engine drag as a fraction of the full-throttle torque. */
export const ENGINE_BRAKE_FRACTION = 0.10;

/**
 * @brief Wheel force demanded by engine braking at one RPM.
 * @brief Closed-throttle drag is modeled as ENGINE_BRAKE_FRACTION of the
 * @brief full-throttle torque at the same engine speed.
 * @param rpm Engine speed in RPM.
 * @param gearRatio Selected gear ratio.
 * @param fd Differential ratio.
 * @param radius Dynamic rolling radius in metres.
 * @param curve Validated engine anchors.
 * @param eff Drivetrain efficiency between 0 and 1.
 * @return Engine-braking force magnitude in newtons.
 */
export const engineBrakeForceAt = (rpm: number, gearRatio: number, fd: number, radius: number, curve: Curve, eff: number): number => {
	return ENGINE_BRAKE_FRACTION * tractiveForceAt(rpm, gearRatio, fd, radius, curve, eff);
};

/**
 * @brief First inside-wheel lockup speed per gear under engine braking.
 * @brief Mirrors criticalWheelspinSpeed for the closed-throttle case: scans
 * @brief each gear in 2 km/h steps for the speed where the engine-braking
 * @brief demand exceeds the coast-lock-limited grip of the driven axle.
 * @param gears Ratios, fd drive, circM circumference, curve engine, eff efficiency.
 * @return Per-gear lockup speed or null when the gear never locks.
 */
export const criticalCoastLockupSpeed = (gears: number[], fd: number, circM: number, curve: Curve | null, eff: number, rg: RunningGear, massKg: number, unit: SpeedUnit = 'kmh'): (number | null)[] => {
	if (!Array.isArray(gears)) return [];
	if (gears.length === 0 || !curve) return gears.map(() => null);
	const radius = dynamicRadiusM(circM);
	if (!radius || !Number.isFinite(fd) || fd <= 0) return gears.map(() => null);
	return gears.map((gear) => coastLockupForGear(gear, fd, circM, radius, curve, eff, rg, massKg, unit));
};

/**
 * @brief Scan one gear in 2 km/h SI steps for coast lockup onset.
 * @brief Deceleration from the demand itself drives the forward load
 * @brief transfer, so a lightly loaded RWD inner wheel locks first.
 * @param gear Ratio, fd drive, circM circumference, radius wheel radius, curve engine.
 * @return Lockup onset speed in the display unit, or null.
 */
const coastLockupForGear = (gear: number, fd: number, circM: number, radius: number, curve: Curve, eff: number, rg: RunningGear, massKg: number, unit: SpeedUnit): number | null => {
	if (!Number.isFinite(gear) || gear <= 0 || !Number.isFinite(curve?.redline) || curve.redline <= 0) return null;
	if (!Number.isFinite(massKg) || massKg <= 0) return null;
	const topKmh = speedKmh(curve.redline, gear, fd, circM);
	if (!Number.isFinite(topKmh) || topKmh <= 0) return null;
	for (let vKmh = 0; vKmh <= topKmh; vKmh += 2) {
		const rpm = rpmFromKmh(vKmh, gear, fd, circM);
		if (!Number.isFinite(rpm) || rpm < 1000 || rpm > curve.redline) continue;
		const demand = engineBrakeForceAt(rpm, gear, fd, radius, curve, eff);
		const limit = maxCoastForceAtSpeed(rg, massKg, vKmh, demand, demand / massKg).limitN;
		if (demand > limit) return toDisplaySpeed(vKmh, unit);
	}
	return null;
};
