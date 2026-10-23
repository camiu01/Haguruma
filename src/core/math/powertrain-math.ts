/**
 * @file powertrain-math.ts
 * @brief Optional measured efficiency maps and rev-limiter behavior.
 */

/** A measured efficiency sample at a normalized engine load and RPM. */
export interface EfficiencySample {
	rpm: number;
	load: number;
	efficiency: number;
}

/**
 * @brief Interpolate a user-supplied map with inverse-distance weighting.
 * @param samples Measured map, not an assumed factory calibration.
 * @param rpm Engine speed.
 * @param load Normalized torque demand.
 * @param fallback Constant efficiency used without valid samples.
 * @return Efficiency constrained to 0–1.
 */
export const mappedEfficiency = (samples: EfficiencySample[] | undefined, rpm: number, load: number, fallback: number): number => {
	if (!samples?.length) return Math.max(0, Math.min(1, Number.isFinite(fallback) ? fallback : 0));
	let sum = 0;
	let weights = 0;
	for (const sample of samples) {
		if (!Number.isFinite(sample.rpm) || !Number.isFinite(sample.load) || !Number.isFinite(sample.efficiency)
			|| sample.rpm < 0 || sample.load < 0 || sample.load > 1 || sample.efficiency <= 0 || sample.efficiency > 1) {
			continue;
		}
		const distance = ((sample.rpm - rpm) / 1000) ** 2 + ((sample.load - load) * 4) ** 2;
		if (distance < 1e-12) {
			return sample.efficiency;
		}
		const weight = 1 / distance;
		weights += weight;
		sum += weight * sample.efficiency;
	}
	return weights > 0 ? sum / weights : Math.max(0, Math.min(1, Number.isFinite(fallback) ? fallback : 0));
};

/**
 * @brief Gate torque at redline with a hard cut or a timed bounce cut.
 * @param rpm Current engine RPM.
 * @param redline Limiter threshold.
 * @param timeS Simulation time.
 * @param mode Limiter type.
 * @return Torque multiplier.
 */
export const limiterTorqueFactor = (rpm: number, redline: number, timeS: number, mode: 'hard' | 'bounce' = 'hard'): number => {
	if (rpm < redline) {
		return 1;
	}
	if (mode === 'hard' || rpm >= redline + 150) {
		return 0;
	}
	return timeS % 0.1 < 0.05 ? 0 : 1;
};
