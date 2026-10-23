/**
 * @file performance-session.ts
 * @brief GPS-speed performance estimates with strict freshness and accuracy gates.
 */
export interface PerformanceSample { timeS: number; speedKmh: number; accuracyM: number }
export interface PerformanceMetrics { time0To100S: number | null; quarterMileS: number | null; distanceM: number }

/** International quarter mile in metres. */
const QUARTER_MILE_M = 402.336;

/**
 * @brief Estimate acceleration splits from an armed standstill GPS trace.
 * @param samples GPS speed samples; positions are deliberately not stored.
 * @return Indicative metrics, null splits for stale, inaccurate or rolling-start data.
 */
export const measurePerformanceSession = (samples: PerformanceSample[]): PerformanceMetrics => {
	const empty: PerformanceMetrics = { time0To100S: null, quarterMileS: null, distanceM: 0 };
	if (samples.length < 2 || samples[0].speedKmh > 1 || samples.some((sample) =>
		![sample.timeS, sample.speedKmh, sample.accuracyM].every(Number.isFinite)
		|| sample.timeS < 0 || sample.timeS > 120 || sample.speedKmh < 0 || sample.speedKmh > 500
		|| sample.accuracyM < 0 || sample.accuracyM > 15)) return empty;
	let start: number | null = null;
	let distanceM = 0;
	let time0To100S: number | null = null;
	let quarterMileS: number | null = null;
	for (let index = 1; index < samples.length; index += 1) {
		const a = samples[index - 1];
		const b = samples[index];
		const dt = b.timeS - a.timeS;
		if (dt <= 0 || dt > 2) return empty;
		if (start === null && b.speedKmh > 1) start = a.timeS;
		if (start === null) continue;
		const step = (a.speedKmh + b.speedKmh) / 7.2 * dt;
		const before = distanceM;
		distanceM += step;
		if (time0To100S === null && a.speedKmh < 100 && b.speedKmh >= 100) {
			time0To100S = a.timeS - start + dt * (100 - a.speedKmh) / (b.speedKmh - a.speedKmh);
		}
		if (quarterMileS === null && before < QUARTER_MILE_M && distanceM >= QUARTER_MILE_M) {
			const remaining = QUARTER_MILE_M - before;
			const speedMps = a.speedKmh / 3.6;
			const accel = (b.speedKmh - a.speedKmh) / 3.6 / dt;
			const atDistance = Math.sqrt(Math.max(0, speedMps * speedMps + 2 * accel * remaining));
			const duration = 2 * remaining / (speedMps + atDistance);
			quarterMileS = a.timeS - start + duration;
		}
	}
	return { time0To100S, quarterMileS, distanceM };
};

/**
 * @brief Serialize speed-only sessions for local analysis tools.
 * @param samples Recorded speed samples.
 * @return Canonical SI-channel CSV without location coordinates.
 */
export const performanceSessionCsv = (samples: PerformanceSample[]): string => {
	return ['time,speed_kmh,accuracy_m', ...samples.map((sample) =>
		`${sample.timeS.toFixed(3)},${sample.speedKmh.toFixed(3)},${sample.accuracyM.toFixed(1)}`)].join('\n');
};
