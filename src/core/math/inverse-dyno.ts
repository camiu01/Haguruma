/**
 * @file inverse-dyno.ts
 * @brief Pure torque-curve recovery from a logged acceleration run.
 * @brief Differentiates a v(t) speed trace, subtracts aerodynamic drag and
 * @brief rolling resistance, converts the residual wheel force back through
 * @brief one fixed gear and bins engine torque by rpm. The pull must happen in
 * @brief a single gear on flat road; grade, wind and shift cuts are not
 * @brief modelled, so the curve is an estimate, not a dyno measurement.
 */
import { dragForce, rollingForceAtSpeed } from './aero-math';
import { rpmFromKmh } from './speed-math';

/** One speed-trace sample of the acceleration run. */
export interface AccelTraceSample {
	/** Time in seconds. */
	t: number;
	/** Vehicle speed in km/h. */
	speedKmh: number;
}

/** Known vehicle parameters of the logged pull. */
export interface InverseDynoVehicle {
	/** Vehicle mass in kg. */
	massKg: number;
	/** Engaged gear ratio of the pull. */
	gearRatio: number;
	/** Final drive ratio. */
	fd: number;
	/** Tire rolling circumference in metres. */
	circM: number;
	/** Drag coefficient. */
	cd: number;
	/** Frontal area in square metres. */
	areaM2: number;
	/** Base rolling-resistance coefficient. */
	crr: number;
	/** Drivetrain efficiency 0-1. */
	eff: number;
}

/** Recovered torque point. */
export interface RecoveredTorquePoint {
	/** Bin-centre engine speed in RPM. */
	rpm: number;
	/** Median engine torque in Nm. */
	torqueNm: number;
}

/** Rpm bin width of the recovered curve. */
export const INVERSE_DYNO_BIN_RPM = 250;

/** Minimum trace pairs for ausable curve. */
const MIN_PAIRS = 5;

/**
 * @brief Validate one inverse-dyno vehicle setup.
 * @param vehicle Candidate vehicle parameters.
 * @return True when every field sits inside its physical range.
 */
const validVehicle = (vehicle: InverseDynoVehicle): boolean => {
	return (
		vehicle.massKg > 0 && vehicle.gearRatio > 0 && vehicle.fd > 0 &&
		vehicle.circM > 0 && vehicle.cd > 0 && vehicle.areaM2 > 0 &&
		vehicle.crr > 0 && vehicle.eff > 0 && vehicle.eff <= 1
	);
};

/**
 * @brief Recover an engine torque curve from a single-gear acceleration trace.
 * @param trace Speed-over-time samples, strictly increasing in time.
 * @param vehicle Known mass, gearing, aero and efficiency of the pull.
 * @return Torque points sorted by rpm, or null when unusable.
 */
export const torqueFromAccelLog = (
	trace: AccelTraceSample[],
	vehicle: InverseDynoVehicle,
): RecoveredTorquePoint[] | null => {
	if (!Array.isArray(trace) || trace.length < MIN_PAIRS + 1 || !validVehicle(vehicle)) {
		return null;
	}
	const radiusM = vehicle.circM / (2 * Math.PI);
	const totalRatio = vehicle.gearRatio * vehicle.fd;
	const bins = new Map<number, number[]>();
	for (let idx = 1; idx < trace.length; idx += 1) {
		const prev = trace[idx - 1];
		const next = trace[idx];
		const dt = next.t - prev.t;
		if (!(dt > 0) || !(next.speedKmh >= prev.speedKmh)) {
			continue;
		}
		const accel = (next.speedKmh - prev.speedKmh) / 3.6 / dt;
		const mid = (next.speedKmh + prev.speedKmh) / 2;
		const force = vehicle.massKg * accel + dragForce(mid, vehicle.cd, vehicle.areaM2) +
			rollingForceAtSpeed(vehicle.massKg, vehicle.crr, mid);
		const engineTorque = (force * radiusM) / totalRatio / vehicle.eff;
		const rpm = rpmFromKmh(mid, vehicle.gearRatio, vehicle.fd, vehicle.circM);
		if (!(rpm > 0) || !(engineTorque > 0)) {
			continue;
		}
		const bin = Math.round(rpm / INVERSE_DYNO_BIN_RPM) * INVERSE_DYNO_BIN_RPM;
		const list = bins.get(bin) ?? [];
		list.push(engineTorque);
		bins.set(bin, list);
	}
	const points: RecoveredTorquePoint[] = [];
	for (const [rpm, list] of bins) {
		if (list.length === 0) {
			continue;
		}
		const sorted = [...list].sort((a, b) => a - b);
		points.push({ rpm, torqueNm: Math.round(sorted[Math.floor(sorted.length / 2)] * 10) / 10 });
	}
	if (points.length < 2) {
		return null;
	}
	points.sort((a, b) => a.rpm - b.rpm);
	return points;
};

/**
 * @brief Format recovered points as a dyno CSV ready for the engine import.
 * @param points Recovered torque points.
 * @return CSV text with an rpm,torque_Nm header, empty when no points.
 */
export const recoveredPointsToCsv = (points: RecoveredTorquePoint[]): string => {
	const rows = points.map((point) => `${point.rpm},${point.torqueNm}`);
	return ['rpm,torque_Nm', ...rows].join('\n');
};
