/**
 * @file timer-math.ts
 * @brief Pure standing-start splits from a phone speed series.
 * @brief Interpolates crossing times for 0-100 km/h, 0-60 mph and 0-160
 * @brief km/h, integrates distance for the 60 ft, quarter-mile and trap-speed
 * @brief splits, and leaves sensor access to the UI layer so every split is
 * @brief unit-testable without GPS hardware.
 */

/** One phone speed sample. */
export interface SpeedTraceSample {
	/** Time in seconds since launch. */
	t: number;
	/** Vehicle speed in km/h. */
	speedKmh: number;
}

/** Standing-start splits recovered from the series. */
export interface PhoneSplits {
	/** 0-100 km/h time in seconds, null when never reached. */
	time0To100S: number | null;
	/** 0-60 mph time in seconds, null when never reached. */
	time0To60S: number | null;
	/** 0-160 km/h time in seconds, null when never reached. */
	time0To160S: number | null;
	/** 60 ft (18.288 m) time in seconds, null when never reached. */
	sixtyFtS: number | null;
	/** Quarter-mile (402.336 m) time in seconds, null when never reached. */
	quarterS: number | null;
	/** Quarter-mile trap speed in km/h, null when never reached. */
	trapKmh: number | null;
}

/** 60 mph reference in km/h. */
const SIXTY_MPH_KMH = 96.56064;

/** 60 ft reference in metres. */
const SIXTY_FT_M = 18.288;

/** Quarter-mile reference in metres. */
const QUARTER_MILE_M = 402.336;

/**
 * @brief Interpolate the crossing time of one speed threshold.
 * @param trace Ordered speed series.
 * @param targetKmh Threshold speed in km/h.
 * @return Crossing time in seconds, or null when never reached.
 */
const crossingTime = (trace: SpeedTraceSample[], targetKmh: number): number | null => {
	for (let idx = 1; idx < trace.length; idx += 1) {
		const prev = trace[idx - 1];
		const next = trace[idx];
		if (prev.speedKmh < targetKmh && next.speedKmh >= targetKmh && next.t > prev.t) {
			const frac = (targetKmh - prev.speedKmh) / (next.speedKmh - prev.speedKmh);
			return prev.t + frac * (next.t - prev.t);
		}
	}
	return null;
};

/**
 * @brief Integrate distance and interpolate one distance-mark time.
 * @param trace Ordered speed series.
 * @param targetM Distance mark in metres.
 * @return Time and speed at the mark, or null when never reached.
 */
const distanceMark = (trace: SpeedTraceSample[], targetM: number): { t: number; speedKmh: number } | null => {
	let dist = 0;
	for (let idx = 1; idx < trace.length; idx += 1) {
		const prev = trace[idx - 1];
		const next = trace[idx];
		const dt = next.t - prev.t;
		if (!(dt > 0)) {
			continue;
		}
		const step = ((prev.speedKmh + next.speedKmh) / 2 / 3.6) * dt;
		if (dist + step >= targetM) {
			const frac = (targetM - dist) / step;
			return { t: prev.t + frac * dt, speedKmh: prev.speedKmh + frac * (next.speedKmh - prev.speedKmh) };
		}
		dist += step;
	}
	return null;
};

/**
 * @brief Round one nullable split to two decimals.
 * @param value Split value in seconds or km/h.
 * @return Rounded value, null stays null.
 */
const roundSplit = (value: number | null): number | null => {
	return value === null ? null : Math.round(value * 100) / 100;
};

/**
 * @brief Recover standing-start splits from a phone speed series.
 * @param trace Ordered speed samples starting near standstill.
 * @return Splits with nulls for marks the series never reaches.
 */
export const splitsFromSpeedSeries = (trace: SpeedTraceSample[]): PhoneSplits => {
	const empty: PhoneSplits = {
		time0To100S: null,
		time0To60S: null,
		time0To160S: null,
		sixtyFtS: null,
		quarterS: null,
		trapKmh: null,
	};
	if (!Array.isArray(trace) || trace.length < 2) {
		return empty;
	}
	const sixty = distanceMark(trace, SIXTY_FT_M);
	const quarter = distanceMark(trace, QUARTER_MILE_M);
	return {
		time0To100S: roundSplit(crossingTime(trace, 100)),
		time0To60S: roundSplit(crossingTime(trace, SIXTY_MPH_KMH)),
		time0To160S: roundSplit(crossingTime(trace, 160)),
		sixtyFtS: roundSplit(sixty ? sixty.t : null),
		quarterS: roundSplit(quarter ? quarter.t : null),
		trapKmh: roundSplit(quarter ? quarter.speedKmh : null),
	};
};
