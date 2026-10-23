/**
 * @file catalog-quality.ts
 * @brief Broad catalog plausibility lint, not a substitute for datasheet data.
 *
 * `validateCatalogEntry` in `car-catalog.ts` answers "can this entry be
 * loaded?". This module answers a different question: "is this entry
 * plausible?". It is deliberately generous, because the catalog holds tuned
 * and swapped cars whose real numbers sit far from a showroom baseline; it
 * only rejects combinations that cannot describe a working vehicle, so a
 * corrupted or copy-pasted entry cannot reach the presets unnoticed.
 */
import type { GearPreset } from '../core/models';
import { powerFromTorque, torqueFromPower } from '../core/math/engine-curve-core';
import { parseTire } from '../core/math/tire-math';

/** Tolerance allowed before an engine anchor is called contradictory. */
const ANCHOR_TOLERANCE = 1.08;

/** Plausible range of one numeric catalog field. */
interface RangeCheck {
	/** Field name as it appears in the catalog JSON. */
	field: string;
	/** Value read from the preset, undefined when the field is optional. */
	value: number | undefined;
	/** Smallest plausible value. */
	min: number;
	/** Largest plausible value. */
	max: number;
}

/**
 * @brief Check the scalar fields of a preset against plausible ranges.
 * @param preset Structurally valid vehicle preset.
 * @return One issue per out-of-range or missing field.
 */
const rangeIssues = (preset: GearPreset): string[] => {
	const checks: RangeCheck[] = [
		{ field: 'massKg', value: preset.massKg, min: 300, max: 4000 },
		{ field: 'powerKw', value: preset.powerKw, min: 10, max: 1500 },
		{ field: 'fd', value: preset.fd, min: 1, max: 10 },
		{ field: 'redline', value: preset.redline, min: 3000, max: 15000 },
		{ field: 'peakTorqueNm', value: preset.peakTorqueNm, min: 10, max: 2500 },
	];
	const issues: string[] = [];
	for (const { field, value, min, max } of checks) {
		if (value === undefined || !Number.isFinite(value) || value < min || value > max) {
			issues.push(`${field} must be between ${min} and ${max}`);
		}
	}
	return issues;
};

/**
 * @brief Check the tire, the gear count, the spread and the gear spacing.
 * @param preset Structurally valid vehicle preset.
 * @return One issue per implausible gearbox property.
 */
const gearboxIssues = (preset: GearPreset): string[] => {
	const issues: string[] = [];
	if (!parseTire(preset.tire)) {
		issues.push('tire must use a supported metric specification');
	}
	if (preset.gears.length < 2 || preset.gears.length > 10) {
		issues.push('forward gear count must be between 2 and 10');
	}
	const spread = preset.gears[0] / preset.gears[preset.gears.length - 1];
	if (!Number.isFinite(spread) || spread < 1.5 || spread > 12) {
		issues.push('overall forward gear spread must be between 1.5 and 12');
	}
	for (let index = 0; index < preset.gears.length; index += 1) {
		const ratio = preset.gears[index];
		if (!Number.isFinite(ratio) || ratio < 0.25 || ratio > 8) {
			issues.push(`gear ${index + 1} ratio must be between 0.25 and 8`);
		}
		if (index > 0 && ratio / preset.gears[index - 1] < 0.35) {
			issues.push(`gear ${index + 1} loses more than 65% RPM on upshift`);
		}
	}
	return issues;
};

/**
 * @brief Allow rounding tolerance but reject contradictory peak claims.
 * @brief A torque peak at or above the power peak, or either above the
 * @brief limiter, cannot describe a real engine. The cross-checks then catch a
 * @brief torque figure that would imply more power than the preset claims.
 * @param preset Engine anchors from a catalog preset.
 * @return Engine-specific plausibility issues.
 */
const anchorIssues = (preset: GearPreset): string[] => {
	const torqueRpm = preset.peakTorqueRpm;
	const powerRpm = preset.peakPowerRpm;
	if (
		torqueRpm === undefined ||
		powerRpm === undefined ||
		!Number.isFinite(torqueRpm) ||
		!Number.isFinite(powerRpm) ||
		!(torqueRpm >= 500 && torqueRpm <= powerRpm && powerRpm <= preset.redline)
	) {
		return ['engine anchor RPM must satisfy 500 <= torque peak <= power peak <= redline'];
	}
	const issues: string[] = [];
	if (preset.powerKw && preset.peakTorqueNm) {
		if (powerFromTorque(preset.peakTorqueNm, torqueRpm) > preset.powerKw * ANCHOR_TOLERANCE) {
			issues.push('power at the torque peak exceeds claimed maximum power by more than 8%');
		}
		if (torqueFromPower(preset.powerKw, powerRpm) > preset.peakTorqueNm * ANCHOR_TOLERANCE) {
			issues.push('torque at the power peak exceeds claimed maximum torque by more than 8%');
		}
	}
	return issues;
};

/**
 * @brief Flag suspicious mass, power, engine anchors and gearbox spacing.
 * @param preset Structurally valid vehicle preset.
 * @return Human-readable issues suitable for CI reports, empty when plausible.
 */
export const catalogQualityIssues = (preset: GearPreset): string[] => {
	return [...rangeIssues(preset), ...gearboxIssues(preset), ...anchorIssues(preset)];
};
