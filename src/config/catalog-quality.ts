/**
 * @file catalog-quality.ts
 * @brief Broad catalog plausibility checks, not a substitute for datasheet validation.
 */
import type { GearPreset } from '../core/models';
import { powerFromTorque, torqueFromPower } from '../core/math/engine-curve-core';
import { parseTire } from '../core/math/tire-math';

/**
 * @brief Flag suspicious mass, power, engine anchors and gearbox spacing.
 * @param preset Structurally valid vehicle preset.
 * @return Human-readable issues suitable for CI reports.
 */
export const catalogQualityIssues = (preset: GearPreset): string[] => {
	const issues: string[] = [];
	const ranges: [string, number | undefined, number, number][] = [
		['massKg', preset.massKg, 300, 4000], ['powerKw', preset.powerKw, 10, 1500],
		['fd', preset.fd, 1, 10], ['redline', preset.redline, 3000, 15000],
		['peakTorqueNm', preset.peakTorqueNm, 10, 2500],
	];
	for (const [key, value, min, max] of ranges) {
		if (value === undefined || !Number.isFinite(value) || value < min || value > max) issues.push(`${key} must be between ${min} and ${max}`);
	}
	if (!parseTire(preset.tire)) issues.push('tire must use a supported metric specification');
	if (preset.gears.length < 2 || preset.gears.length > 10) issues.push('forward gear count must be between 2 and 10');
	const spread = preset.gears[0] / preset.gears[preset.gears.length - 1];
	if (spread < 1.5 || spread > 12) issues.push('overall forward gear spread must be between 1.5 and 12');
	for (let index = 0; index < preset.gears.length; index += 1) {
		const ratio = preset.gears[index];
		if (!Number.isFinite(ratio) || ratio < 0.25 || ratio > 8) issues.push(`gear ${index + 1} ratio must be between 0.25 and 8`);
		if (index > 0 && ratio / preset.gears[index - 1] < 0.35) issues.push(`gear ${index + 1} loses more than 65% RPM on upshift`);
	}
	issues.push(...anchorQualityIssues(preset));
	return issues;
};

/**
 * @brief Allow rounding tolerance but reject contradictory peak claims.
 * @param preset Engine anchors from a catalog preset.
 * @return Engine-specific plausibility issues.
 */
const anchorQualityIssues = (preset: GearPreset): string[] => {
	const issues: string[] = [];
	const torqueRpm = preset.peakTorqueRpm;
	const powerRpm = preset.peakPowerRpm;
	if (!Number.isFinite(torqueRpm) || !Number.isFinite(powerRpm)
		|| !(torqueRpm! >= 500 && torqueRpm! <= powerRpm! && powerRpm! <= preset.redline)) {
		issues.push('engine anchor RPM must satisfy 500 <= torque peak <= power peak <= redline');
		return issues;
	}
	if (preset.powerKw && preset.peakTorqueNm) {
		if (powerFromTorque(preset.peakTorqueNm, torqueRpm!) > preset.powerKw * 1.08) {
			issues.push('power at the torque peak exceeds claimed maximum power by more than 8%');
		}
		if (torqueFromPower(preset.powerKw, powerRpm!) > preset.peakTorqueNm * 1.08) {
			issues.push('torque at the power peak exceeds claimed maximum torque by more than 8%');
		}
	}
	return issues;
};
