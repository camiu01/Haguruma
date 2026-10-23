/**
 * @file custom-store.ts
 * @brief User-defined car presets persisted in localStorage.
 */
import type { GearPreset } from '../models';
import { defaultRunningGear } from '../state/app-state';

const STORAGE_KEY = 'haguruma-custom-presets';

/** Current envelope version for the custom preset store. */
export const CUSTOM_STORE_VERSION = 1;

/** Dropdown value prefix marking user presets. */
export const CUSTOM_PREFIX = 'custom:';

/**
 * @brief Check for browser storage (false under vitest node environment).
 * @return True when localStorage may be touched.
 */
const hasStorage = (): boolean => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

/**
 * @brief Parse a free-form gear list into ratios.
 * @param raw Comma, space or semicolon separated ratios.
 * @return Ratio array, or null when empty or any entry is not positive.
 */
export const parseGearsInput = (raw: string): number[] | null => {
	const parts = raw.split(/[,\s;]+/).filter((p) => p.length > 0);
	if (parts.length === 0) {
		return null;
	}
	const ratios = parts.map((p) => parseFloat(p));
	if (ratios.some((r) => Number.isNaN(r) || r <= 0)) {
		return null;
	}
	return ratios;
};

/**
 * @brief Slugify a car name for dropdown option values.
 * @param name Display name typed by the user.
 * @return URL-safe slug, or empty string when nothing usable remains.
 */
export const slugify = (name: string): string => {
	return name
		.trim()
		.toLowerCase()
		.replace(/\s+/g, '-')
		.replace(/[^a-z0-9-_]/g, '')
		.slice(0, 40);
};

/**
 * @brief Type-guard a stored value as a usable preset.
 * @param value Unknown parsed JSON value.
 * @return True when the value looks like a GearPreset.
 */
export const isPreset = (value: unknown): value is GearPreset => {
	if (typeof value !== 'object' || value === null) {
		return false;
	}
	const p = value as Record<string, unknown>;
	return (
		typeof p.tire === 'string' &&
		typeof p.fd === 'number' && p.fd > 0 &&
		typeof p.redline === 'number' && p.redline > 0 &&
		Array.isArray(p.gears) &&
		p.gears.length > 0 &&
		(p.gears as unknown[]).every((g) => typeof g === 'number' && g > 0)
	);
};

/**
 * @brief Migrate a raw stored value to the current preset map.
 * @brief Accepts the v1 envelope, legacy bare maps and corrupt input.
 * @param raw Parsed JSON from storage.
 * @return Name-keyed valid presets, empty when nothing is usable.
 */
export const migrateCustomStore = (raw: unknown): Record<string, GearPreset> => {
	if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
		return {};
	}
	const candidate = raw as Record<string, unknown>;
	if (typeof candidate.schemaVersion === 'number') {
		if (candidate.schemaVersion !== CUSTOM_STORE_VERSION || typeof candidate.presets !== 'object' || candidate.presets === null) {
			return {};
		}
		return collectPresets(candidate.presets as Record<string, unknown>);
	}
	return collectPresets(candidate);
};

/**
 * @brief Keep valid presets, backfilling the running gear on legacy rows.
 * @param table Name-keyed candidate presets.
 * @return Name-keyed valid presets.
 */
const collectPresets = (table: Record<string, unknown>): Record<string, GearPreset> => {
	const out: Record<string, GearPreset> = {};
	for (const name of Object.keys(table)) {
		const candidate = table[name];
		if (isPreset(candidate)) {
			out[name] = candidate.runningGear ? candidate : { ...candidate, runningGear: { ...defaultRunningGear } };
		}
	}
	return out;
};

/**
 * @brief Load user presets from storage.
 * @return Name-keyed presets, empty when storage is missing or corrupt.
 */
export const loadCustomPresets = (): Record<string, GearPreset> => {
	if (!hasStorage()) {
		return {};
	}
	try {
		const raw = window.localStorage.getItem(STORAGE_KEY);
		if (!raw) {
			return {};
		}
		return migrateCustomStore(JSON.parse(raw) as unknown);
	} catch {
		return {};
	}
};

/**
 * @brief Persist the full custom preset map.
 * @param customs Name-keyed presets to store.
 * @return void
 */
const storeCustomPresets = (customs: Record<string, GearPreset>): void => {
	if (!hasStorage()) {
		return;
	}
	try {
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: CUSTOM_STORE_VERSION, presets: customs }));
	} catch {
		return;
	}
};

/**
 * @brief Save or overwrite one user preset.
 * @param name Display name.
 * @param preset Preset data.
 * @return void
 */
export const saveCustomPreset = (name: string, preset: GearPreset): void => {
	const customs = loadCustomPresets();
	customs[name] = preset;
	storeCustomPresets(customs);
};

/**
 * @brief Delete one user preset by display name.
 * @param name Display name.
 * @return void
 */
export const deleteCustomPreset = (name: string): void => {
	const customs = loadCustomPresets();
	delete customs[name];
	storeCustomPresets(customs);
};
