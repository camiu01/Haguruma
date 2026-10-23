/**
 * @file quick-spec.ts
 * @brief Range-checked datasheet presets with explicitly estimated engine and aero inputs.
 */
import type { GearPreset } from '../models';
import { parseTire } from '../math/tire-math';
import { torqueFromPower } from '../math/engine-curve-core';
import { defaultRunningGear } from '../state/app-state';

export interface QuickSpec {
	name: string; tire: string; gears: string; fd: number; redline: number; massKg: number; powerKw: number;
}

/**
 * @brief Build a saved starting point without pretending to know unprovided measurements.
 * @param spec Datasheet values in canonical kW, kg and RPM.
 * @return Named preset or null on any invalid field.
 */
export const presetFromQuickSpec = (spec: QuickSpec): { name: string; preset: GearPreset } | null => {
	const name = spec.name.trim();
	if (!name || name.length > 120 || ['__proto__', 'constructor', 'prototype'].includes(name) || !parseTire(spec.tire)) return null;
	if (![spec.fd, spec.redline, spec.massKg, spec.powerKw].every(Number.isFinite)
		|| spec.fd < 1 || spec.fd > 10 || spec.redline < 3000 || spec.redline > 12000
		|| spec.massKg < 300 || spec.massKg > 4000 || spec.powerKw < 5 || spec.powerKw > 1500) return null;
	const gears = spec.gears.trim().split(/[,;\s]+/).map(Number);
	if (gears.length < 2 || gears.length > 8 || gears.some((gear, index) =>
		!Number.isFinite(gear) || gear < 0.25 || gear > 8 || (index > 0 && gear >= gears[index - 1]))) return null;
	const peakPowerRpm = Math.round(spec.redline * 0.85);
	return { name, preset: {
		tire: spec.tire.trim(), gears, fd: spec.fd, redline: spec.redline, massKg: spec.massKg, powerKw: spec.powerKw,
		peakPowerRpm, peakTorqueRpm: Math.round(spec.redline * 0.6),
		peakTorqueNm: torqueFromPower(spec.powerKw, peakPowerRpm), dragCd: 0.32, frontalAreaM2: 2,
		runningGear: { ...defaultRunningGear },
	} };
};
