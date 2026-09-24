/**
 * @file unit-utils.ts
 * @brief Speed/power unit helpers, RPM axis scaling and localStorage persistence.
 */
import type { PowerUnit, SpeedUnit } from '../models';
import { hpToKw, kwToHp } from '../math/aero-math';

const UNIT_STORAGE_KEY = 'haguruma-unit';
const POWER_UNIT_STORAGE_KEY = 'haguruma-power-unit';

/**
 * @brief Check for a browser DOM (false under vitest node environment).
 * @return True when localStorage may be touched.
 */
const hasDom = (): boolean => typeof document !== 'undefined';

/**
 * @brief Get the axis step for the speed grid.
 * @param unit Active unit.
 * @return Step size in display units.
 */
export const getSpeedStep = (unit: SpeedUnit): number => {
	return unit === 'kmh' ? 50 : 25;
};

/**
 * @brief Get the unit label shown in the UI.
 * @param unit Active unit.
 * @return Short label.
 */
export const getUnitLabel = (unit: SpeedUnit): string => {
	return unit === 'kmh' ? 'km/h' : 'mph';
};

/**
 * @brief Round redline up to a nice axis ceiling.
 * @param redline Configured rev limit.
 * @return Axis maximum RPM.
 */
export const getMaxRpm = (redline: number): number => {
	return Math.ceil(redline / 1000) * 1000 + 500;
};

/**
 * @brief Validate a raw unit value from storage or legacy URLs.
 * @param raw Candidate value.
 * @return SpeedUnit or null when invalid.
 */
export const parseUnit = (raw: string | null): SpeedUnit | null => {
	if (raw === 'kmh' || raw === 'mph') {
		return raw;
	}
	return null;
};

/**
 * @brief Persist the display unit without throwing on restricted storage.
 * @param unit Unit to persist.
 * @return void
 */
export const storeUnit = (unit: SpeedUnit): void => {
	if (!hasDom()) {
		return;
	}
	try {
		window.localStorage.setItem(UNIT_STORAGE_KEY, unit);
	} catch {
		return;
	}
};

/**
 * @brief Restore the persisted display unit on startup.
 * @return Stored unit or kmh by default.
 */
export const initUnit = (): SpeedUnit => {
	if (!hasDom()) {
		return 'kmh';
	}
	try {
		return parseUnit(window.localStorage.getItem(UNIT_STORAGE_KEY)) ?? 'kmh';
	} catch {
		return 'kmh';
	}
};

/**
 * @brief Get the power unit label shown in the UI.
 * @param unit Active power unit.
 * @return Short label (kW or cv).
 */
export const getPowerUnitLabel = (unit: PowerUnit): string => {
	return unit === 'kw' ? 'kW' : 'cv';
};

/**
 * @brief Validate a raw power unit value from storage.
 * @param raw Candidate value.
 * @return PowerUnit or null when invalid.
 */
export const parsePowerUnit = (raw: string | null): PowerUnit | null => {
	if (raw === 'kw' || raw === 'cv') {
		return raw;
	}
	return null;
};

/**
 * @brief Convert canonical kW into the active display unit.
 * @param kw Power in kilowatts.
 * @param unit Active power unit.
 * @return Power in kW or metric hp.
 */
export const toDisplayPower = (kw: number, unit: PowerUnit): number => {
	return unit === 'cv' ? kwToHp(kw) : kw;
};

/**
 * @brief Convert a user-entered value from the active unit into canonical kW.
 * @param value Power in the active display unit.
 * @param unit Active power unit.
 * @return Power in kilowatts.
 */
export const fromDisplayPower = (value: number, unit: PowerUnit): number => {
	return unit === 'cv' ? hpToKw(value) : value;
};

/**
 * @brief Format kW for the active power unit (one decimal place).
 * @param kw Power in kilowatts.
 * @param unit Active power unit.
 * @return Display string such as 110.0 kW or 149.6 cv.
 */
export const formatPower = (kw: number, unit: PowerUnit): string => {
	return `${toDisplayPower(kw, unit).toFixed(1)} ${getPowerUnitLabel(unit)}`;
};

/**
 * @brief Format a kW value as a bare input-field number in the active unit.
 * @param kw Power in kilowatts.
 * @param unit Active power unit.
 * @return Numeric string with one decimal place.
 */
export const formatPowerInput = (kw: number, unit: PowerUnit): string => {
	return toDisplayPower(kw, unit).toFixed(1);
};

/**
 * @brief Persist the power display unit without throwing on restricted storage.
 * @param unit Unit to persist.
 * @return void
 */
export const storePowerUnit = (unit: PowerUnit): void => {
	if (!hasDom()) {
		return;
	}
	try {
		window.localStorage.setItem(POWER_UNIT_STORAGE_KEY, unit);
	} catch {
		return;
	}
};

/**
 * @brief Restore the persisted power display unit on startup.
 * @return Stored unit or kW by default.
 */
export const initPowerUnit = (): PowerUnit => {
	if (!hasDom()) {
		return 'kw';
	}
	try {
		return parsePowerUnit(window.localStorage.getItem(POWER_UNIT_STORAGE_KEY)) ?? 'kw';
	} catch {
		return 'kw';
	}
};
