/**
 * @file performance-store.ts
 * @brief Strict speed-only session validation for storage and backups.
 */
import type { PerformanceSample } from '../math/performance-session';

export const SESSION_STORAGE_KEY = 'haguruma-performance-session';

/**
 * @brief Validate a bounded versioned session without retaining unknown fields.
 * @param text Serialized session.
 * @return Sanitized samples, null when malformed or future-versioned.
 */
export const parsePerformanceSession = (text: string): PerformanceSample[] | null => {
	if (text.length > 1_000_000) return null;
	try {
		const data = JSON.parse(text);
		if (!data || data.schemaVersion !== 1 || !Array.isArray(data.samples) || data.samples.length > 5000) return null;
		const samples: PerformanceSample[] = [];
		for (const row of data.samples) {
			if (!row || ![row.timeS, row.speedKmh, row.accuracyM].every((value) => typeof value === 'number' && Number.isFinite(value))
				|| row.timeS < 0 || row.timeS > 120 || row.speedKmh < 0 || row.speedKmh > 500 || row.accuracyM < 0 || row.accuracyM > 15
				|| (samples.length > 0 && row.timeS <= samples[samples.length - 1].timeS)) return null;
			samples.push({ timeS: row.timeS, speedKmh: row.speedKmh, accuracyM: row.accuracyM });
		}
		return samples;
	} catch { return null; }
};
