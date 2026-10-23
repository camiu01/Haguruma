/**
 * @file lap-sequence.ts
 * @brief Bounded pedal/gear sequence integration with explicit rev-match transients.
 */
import type { SimInput } from './accel-math';
import { validateCurve, tractiveForceAt, dynamicRadiusM, type EngineCurve } from './traction-math';
import { rpmFromKmh, speedKmh } from './speed-math';
import { engineBrakeForceAt, maxCoastForceAtSpeed, maxDriveForceAtSpeed } from './dynamics-math';
import { dragForce, gradeForce, rollingForceAtSpeed } from './aero-math';
import { brakingTireForce, type BrakingInput } from './braking-simulation';
import { limiterTorqueFactor, mappedEfficiency } from './powertrain-math';
import { defaultRunningGear } from '../state/app-state';
import { handbrakeForceAtSpeed, combinedAxleBraking } from './handbrake-math';

export interface LapCommand { durationS: number; gear: number; throttle: number; brake: number; revMatch: boolean; handbrake?: number }
export interface LapPoint { timeS: number; distanceM: number; speedKmh: number; rpm: number; gear: number; accelMps2: number }
export interface LapShift { timeS: number; fromGear: number; toGear: number; targetRpm: number; blipRpm: number; lockRisk: boolean }
export interface LapResult { points: LapPoint[]; shifts: LapShift[]; error: 'invalid' | 'overrev' | 'divergent' | null }
interface Motion { time: number; distance: number; speed: number; accel: number; gear: number; cut: number; mismatch: number; settling: number }

/**
 * @brief Parse canonical pedal commands with an optional rear handbrake column.
 * @param text Rows: duration_s,gear,throttle,brake,rev_match[,handbrake].
 * @return Valid commands, or null if any row is invalid.
 */
export const parseLapCommands = (text: string): LapCommand[] | null => {
	if (text.length > 8000) return null;
	const lines = text.trim().split(/\r?\n/);
	const header = lines.shift()?.trim().toLowerCase();
	const hasHandbrake = header === 'duration_s,gear,throttle,brake,rev_match,handbrake';
	if ((!hasHandbrake && header !== 'duration_s,gear,throttle,brake,rev_match') || !lines.length || lines.length > 60) return null;
	const rows: LapCommand[] = [];
	for (const line of lines) {
		const cells = line.split(',').map((cell) => cell.trim());
		if (cells.length !== (hasHandbrake ? 6 : 5) || cells.some((cell) => !cell)) return null;
		const [durationS, gear, throttle, brake, revMatch] = cells.map(Number);
		if (![durationS, gear, throttle, brake, revMatch].every(Number.isFinite)
			|| durationS < 0.01 || durationS > 60 || !Number.isInteger(gear) || gear < 1 || gear > 8
			|| throttle < 0 || throttle > 1 || brake < 0 || brake > 1 || ![0, 1].includes(revMatch)) return null;
		const handbrake = hasHandbrake ? Number(cells[5]) : undefined;
		if (handbrake !== undefined && (!Number.isFinite(handbrake) || handbrake < 0 || handbrake > 1)) return null;
		rows.push({ durationS, gear, throttle, brake, revMatch: revMatch === 1, ...(handbrake === undefined ? {} : { handbrake }) });
	}
	return rows.reduce((sum, row) => sum + row.durationS, 0) <= 180 ? rows : null;
};

/**
 * @brief Resolve a gear change, cutting drive before a bounded clutch re-engagement.
 * @param motion Current mutable integration state.
 * @param command Requested phase.
 * @param input Physical setup.
 * @param curve Validated engine curve.
 * @return Shift report, or null for no gear change.
 */
const changeGear = (motion: Motion, command: LapCommand, input: SimInput, curve: EngineCurve): LapShift | null => {
	if (motion.gear === command.gear) return null;
	const from = rpmFromKmh(motion.speed * 3.6, input.gears[motion.gear - 1], input.fd, input.circM);
	const target = rpmFromKmh(motion.speed * 3.6, input.gears[command.gear - 1], input.fd, input.circM);
	const shift = { timeS: motion.time, fromGear: motion.gear, toGear: command.gear, targetRpm: target,
		blipRpm: command.revMatch ? Math.max(0, target - from) : 0, lockRisk: false };
	const inertia = input.engineInertiaKgM2 ?? 0.2;
	// Unmatched engine spin-up uses a 0.2 s clutch engagement, not a calibrated driver model.
	motion.mismatch = command.revMatch ? 0 : inertia * Math.max(0, target - from) * Math.PI / 30 / 0.2
		* input.gears[command.gear - 1] * input.fd / dynamicRadiusM(input.circM);
	motion.settling = 0.2;
	motion.cut = input.shiftTimesS?.[Math.min(motion.gear, command.gear) - 1] ?? input.shiftTimeS ?? 0;
	motion.gear = command.gear;
	return shift;
};

/**
 * @brief Resolve net longitudinal force without adding a second full tire budget.
 * @param motion Current motion.
 * @param command Current pedal command.
 * @param input Vehicle setup.
 * @param curve Validated curve.
 * @param brakeInput Shared brake setup.
 * @return Net force, RPM and coast-lock indication.
 */
const phaseForce = (motion: Motion, command: LapCommand, input: SimInput, curve: EngineCurve, brakeInput: BrakingInput): { force: number; rpm: number; lock: boolean } => {
	const speed = motion.speed * 3.6;
	const ratio = input.gears[command.gear - 1];
	const rpm = rpmFromKmh(speed, ratio, input.fd, input.circM);
	const engineRpm = Math.max(rpm, motion.speed < 1 ? input.launchRpm ?? 2000 : 800);
	const eff = mappedEfficiency(input.efficiencyMap, engineRpm, command.throttle, input.drivetrainEff);
	const rg = brakeInput.runningGear;
	const drive = motion.cut > 0 ? 0 : tractiveForceAt(engineRpm, ratio, input.fd, dynamicRadiusM(input.circM), curve, eff)
		* command.throttle * limiterTorqueFactor(rpm, curve.redline, motion.time, input.limiterMode);
	const grip = maxDriveForceAtSpeed(rg, input.massKg, speed, drive, motion.accel);
	const mismatch = motion.cut <= 0 && motion.settling > 0 ? motion.mismatch * motion.settling / 0.2 : 0;
	const coastDemand = motion.cut > 0 ? 0 : engineBrakeForceAt(rpm, ratio, input.fd, dynamicRadiusM(input.circM), curve, eff)
		* (1 - command.throttle) + mismatch;
	const coast = maxCoastForceAtSpeed(rg, input.massKg, speed, coastDemand, Math.max(0, -motion.accel));
	const service = brakingTireForce(brakeInput, speed, Math.max(0, -motion.accel), motion.time, command.brake);
	const rearBrake = handbrakeForceAtSpeed(rg, input.massKg, speed, motion.accel);
	const brakes = combinedAxleBraking(service, rg, coastDemand, coast.limitN, rearBrake);
	const road = dragForce(speed, input.dragCd ?? 0, input.frontalAreaM2 ?? 0)
		+ rollingForceAtSpeed(input.massKg, input.rollingCrr ?? 0, speed) + gradeForce(input.massKg, input.roadGradePercent ?? 0);
	return { force: Math.min(drive, grip.limitN) - brakes.forceN - road, rpm,
		lock: coast.isLockup || brakes.lockRisk || service.frontLock || service.rearLock };
};

/**
 * @brief Integrate one command at 10 ms, sampling the trajectory at 100 ms.
 * @param motion Mutable trajectory state.
 * @param command Phase command.
 * @param input Vehicle setup.
 * @param curve Engine curve.
 * @param brakeInput Brake model inputs.
 * @param result Accumulated points and shifts.
 * @return Failure code, or null.
 */
const integratePhase = (motion: Motion, command: LapCommand, input: SimInput, curve: EngineCurve, brakeInput: BrakingInput, result: LapResult): LapResult['error'] => {
	if (command.handbrake !== undefined) brakeInput = { ...brakeInput, runningGear: { ...brakeInput.runningGear,
		handbrakeFraction: command.handbrake, centerDisengaged: command.handbrake > 0 } };
	const shift = changeGear(motion, command, input, curve);
	if (shift) result.shifts.push(shift);
	let elapsed = 0;
	for (let step = 0; elapsed < command.durationS - 1e-9; step++) {
		const dt = Math.min(0.01, command.durationS - elapsed);
		const forces = phaseForce(motion, command, input, curve, brakeInput);
		if (forces.rpm > curve.redline + 1) return 'overrev';
		if (shift && forces.lock) shift.lockRisk = true;
		motion.accel = forces.force / (input.massKg + Math.max(0, input.rotatingMassKg ?? 0));
		let next = Math.max(0, motion.speed + motion.accel * dt);
		if (command.throttle > 0 && motion.cut <= 0 && forces.rpm < curve.redline) {
			next = Math.min(next, speedKmh(curve.redline, input.gears[command.gear - 1], input.fd, input.circM) / 3.6);
		}
		if (!Number.isFinite(next) || next > 500 / 3.6) return 'divergent';
		motion.distance += (motion.speed + next) * 0.5 * dt;
		motion.speed = next; motion.time += dt; elapsed += dt;
		if (motion.cut <= 0) motion.settling = Math.max(0, motion.settling - dt);
		motion.cut = Math.max(0, motion.cut - dt);
		if (step % 10 === 0 || elapsed >= command.durationS - 1e-9) result.points.push({
			timeS: motion.time, distanceM: motion.distance, speedKmh: next * 3.6,
			rpm: rpmFromKmh(next * 3.6, input.gears[command.gear - 1], input.fd, input.circM), gear: command.gear, accelMps2: motion.accel });
	}
	return null;
};

/**
 * @brief Simulate a complete bounded pedal/gear sequence, refusing unsafe downshifts.
 * @param input Active vehicle inputs.
 * @param initialSpeedKmh Initial road speed.
 * @param commands Validated command sequence.
 * @param frontBias Brake front share.
 * @param abs Approximate ABS enabled.
 * @return Trajectory, rev-match/lock reports and an explicit failure code.
 */
export const simulateLapSequence = (input: SimInput, initialSpeedKmh: number, commands: LapCommand[], frontBias = 0.65, abs = true): LapResult => {
	const result: LapResult = { points: [], shifts: [], error: 'invalid' };
	const curve = input.curve ? validateCurve(input.curve) : null;
	const serialized = 'duration_s,gear,throttle,brake,rev_match,handbrake\n' + commands.map((c) =>
		[c.durationS, c.gear, c.throttle, c.brake, Number(c.revMatch), c.handbrake ?? 0].join(',')).join('\n');
	if (!curve || !parseLapCommands(serialized) || !commands.length || commands.some((c) => c.gear > input.gears.length)
		|| ![input.massKg, input.fd, input.circM, input.drivetrainEff, initialSpeedKmh, frontBias,
			input.dragCd ?? 0, input.frontalAreaM2 ?? 0, input.rollingCrr ?? 0, input.roadGradePercent ?? 0].every(Number.isFinite)
		|| input.massKg <= 0 || input.fd <= 0 || input.circM <= 0 || input.drivetrainEff <= 0 || input.drivetrainEff > 1
		|| input.gears.some((ratio) => !Number.isFinite(ratio) || ratio <= 0)
		|| initialSpeedKmh < 0 || initialSpeedKmh > 500 || frontBias < 0 || frontBias > 1) return result;
	const motion: Motion = { time: 0, distance: 0, speed: initialSpeedKmh / 3.6, accel: 0,
		gear: commands[0].gear, cut: 0, mismatch: 0, settling: 0 };
	const brakeInput: BrakingInput = { speedKmh: initialSpeedKmh, massKg: input.massKg, runningGear: input.runningGear ?? defaultRunningGear,
		frontBias, abs, dragCd: input.dragCd ?? 0, areaM2: input.frontalAreaM2 ?? 0, gradePercent: input.roadGradePercent ?? 0 };
	result.error = null;
	result.points.push({ timeS: 0, distanceM: 0, speedKmh: initialSpeedKmh, gear: commands[0].gear,
		rpm: rpmFromKmh(initialSpeedKmh, input.gears[commands[0].gear - 1], input.fd, input.circM), accelMps2: 0 });
	for (const command of commands) {
		result.error = integratePhase(motion, command, input, curve, brakeInput, result);
		if (result.error) break;
	}
	return result;
};
