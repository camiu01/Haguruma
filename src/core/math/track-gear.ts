/**
 * @file track-gear.ts
 * @brief Track-archetype gear targets keeping 2nd and 3rd out of torque holes.
 * @brief Each archetype names the corner-exit speed window its 2nd and 3rd
 * @brief gears must pull from; ratios place those speeds at peak-torque rpm so
 * @brief the engine lands in the meat of the curve on corner exit.
 */
import { speedKmh } from './speed-math';

/** Track archetype id. */
export type TrackArchetype = 'hairpin' | 'balanced' | 'fast';

/** Corner-exit speed window plus straight target of one archetype. */
export interface TrackProfile {
	/** Archetype id. */
	id: TrackArchetype;
	/** 2nd-gear corner-exit window in km/h. */
	secondWindow: [number, number];
	/** 3rd-gear corner-exit window in km/h. */
	thirdWindow: [number, number];
	/** Reference straight speed sizing top gear in km/h. */
	straightKmh: number;
}

/** Built-in track archetype profiles. */
export const TRACK_PROFILES: TrackProfile[] = [
	{ id: 'hairpin', secondWindow: [45, 75], thirdWindow: [75, 110], straightKmh: 200 },
	{ id: 'balanced', secondWindow: [60, 95], thirdWindow: [95, 135], straightKmh: 240 },
	{ id: 'fast', secondWindow: [80, 120], thirdWindow: [120, 165], straightKmh: 280 },
];

/** Gear advice for one track archetype. */
export interface TrackGearAdvice {
	/** Archetype the advice was computed for. */
	archetype: TrackArchetype;
	/** Suggested 2nd-gear ratio. */
	second: number;
	/** Suggested 3rd-gear ratio. */
	third: number;
	/** Speed at peak torque in 2nd in km/h. */
	secondSpeedKmh: number;
	/** Speed at peak torque in 3rd in km/h. */
	thirdSpeedKmh: number;
}

/**
 * @brief Look up one track profile by id.
 * @param id Archetype id.
 * @return Profile, or null for unknown ids.
 */
export const trackProfile = (id: string): TrackProfile | null => {
	return TRACK_PROFILES.find((profile) => profile.id === id) ?? null;
};

/**
 * @brief Ratio placing one speed at peak-torque rpm.
 * @param speedKmhTarget Corner-exit speed in km/h.
 * @param peakTorqueRpm Peak-torque rpm.
 * @param fd Final drive ratio.
 * @param circM Tire rolling circumference in metres.
 * @return Gear ratio rounded to 0.01, NaN when invalid.
 */
const ratioForSpeedAtTorque = (speedKmhTarget: number, peakTorqueRpm: number, fd: number, circM: number): number => {
	const wheelRevPerMin = ((speedKmhTarget * 1000) / 3600 / circM) * 60;
	if (!(wheelRevPerMin > 0) || !(peakTorqueRpm > 0) || !(fd > 0)) {
		return NaN;
	}
	return Math.round(((peakTorqueRpm / wheelRevPerMin / fd) * 100)) / 100;
};

/**
 * @brief Suggest 2nd and 3rd gear ratios for a track archetype.
 * @brief Window mid-points land on peak torque so the engine pulls from the
 * @brief strongest point of the curve at corner exit.
 * @param archetype Track archetype id.
 * @param peakTorqueRpm Peak-torque rpm.
 * @param fd Final drive ratio.
 * @param circM Tire rolling circumference in metres.
 * @return Advice with ratios and check speeds, or null on invalid input.
 */
export const adviseTrackGears = (
	archetype: string,
	peakTorqueRpm: number,
	fd: number,
	circM: number,
): TrackGearAdvice | null => {
	const profile = trackProfile(archetype);
	if (!profile || !Number.isFinite(peakTorqueRpm) || peakTorqueRpm < 500) {
		return null;
	}
	const secondMid = (profile.secondWindow[0] + profile.secondWindow[1]) / 2;
	const thirdMid = (profile.thirdWindow[0] + profile.thirdWindow[1]) / 2;
	const second = ratioForSpeedAtTorque(secondMid, peakTorqueRpm, fd, circM);
	const third = ratioForSpeedAtTorque(thirdMid, peakTorqueRpm, fd, circM);
	if (!Number.isFinite(second) || !Number.isFinite(third) || second <= third) {
		return null;
	}
	return {
		archetype: profile.id,
		second,
		third,
		secondSpeedKmh: Math.round(speedKmh(peakTorqueRpm, second, fd, circM) * 10) / 10,
		thirdSpeedKmh: Math.round(speedKmh(peakTorqueRpm, third, fd, circM) * 10) / 10,
	};
};

/**
 * @brief Check one ratio against the archetype window at peak torque.
 * @param ratio Gear ratio under test.
 * @param window Corner-exit window in km/h.
 * @param peakTorqueRpm Peak-torque rpm.
 * @param fd Final drive ratio.
 * @param circM Tire rolling circumference in metres.
 * @return True when the torque-point speed lands inside the window.
 */
export const ratioInWindow = (
	ratio: number,
	window: [number, number],
	peakTorqueRpm: number,
	fd: number,
	circM: number,
): boolean => {
	const speed = speedKmh(peakTorqueRpm, ratio, fd, circM);
	return Number.isFinite(speed) && speed >= window[0] && speed <= window[1];
};
