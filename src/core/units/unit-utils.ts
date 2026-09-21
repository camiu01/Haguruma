/**
 * @file unit-utils.ts
 * @brief Speed unit helpers, RPM axis scaling and localStorage persistence.
 */
import type { SpeedUnit } from '../models';

const UNIT_STORAGE_KEY = 'haguruma-unit';

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
