/**
 * @file backup-store.ts
 * @brief Versioned, allowlisted local backup with transactional restore.
 */
import { isPreset, migrateCustomStore } from './custom-store';
import { parseTire } from '../math/tire-math';
import { parsePerformanceSession } from './performance-store';

export const BACKUP_KEYS = [
	'haguruma-custom-presets', 'haguruma-lang', 'haguruma-theme', 'haguruma-unit',
	'haguruma-power-unit', 'haguruma-setup-level', 'haguruma-comp-level',
	'haguruma-performance-session',
] as const;

/**
 * @brief Strictly validate a custom-car map before importing any entry.
 * @param value Parsed legacy map or versioned custom-store envelope.
 * @return Current compatible map, null on malformed or unsafe entries.
 */
export const validateGarageBackup = (value: unknown): ReturnType<typeof migrateCustomStore> | null => {
	if (typeof value !== 'object' || !value || Array.isArray(value)) return null;
	const map = migrateCustomStore(value);
	const raw = value as Record<string, unknown>;
	const source = raw.schemaVersion === 1 ? raw.presets : raw;
	if (typeof source !== 'object' || !source || Array.isArray(source)) return null;
	const names = Object.keys(source);
	if (names.length > 500 || names.length !== Object.keys(map).length) return null;
	for (const name of names) {
		const preset = map[name];
		if (!name.trim() || name.length > 120 || ['__proto__', 'prototype', 'constructor'].includes(name)
			|| !isPreset(preset) || !parseTire(preset.tire) || !Number.isFinite(preset.fd) || preset.fd > 10
			|| !Number.isFinite(preset.redline) || preset.redline < 1000 || preset.redline > 30000
			|| preset.gears.length > 8 || preset.gears.some((gear) => !Number.isFinite(gear) || gear > 8)
			|| Object.values(preset).some((field) => typeof field === 'number' && !Number.isFinite(field))) return null;
	}
	return map;
};

/**
 * @brief Accept a single custom preset, legacy map or versioned garage envelope.
 * @param text Bounded untrusted JSON.
 * @param fileName Fallback name when the file holds a single preset.
 * @return Entire validated garage, never a silently filtered subset.
 */
export const parseGarageImport = (text: string, fileName: string): ReturnType<typeof migrateCustomStore> | null => {
	if (text.length > 2_000_000) return null;
	try {
		const raw = JSON.parse(text);
		const name = fileName.replace(/\.json$/i, '').trim().slice(0, 120) || 'Imported car';
		return validateGarageBackup(isPreset(raw) ? { [name]: raw } : raw);
	} catch { return null; }
};

/**
 * @brief Serialize only app-owned persisted preferences and garage data.
 * @param storage Browser-compatible storage.
 * @return Downloadable JSON backup.
 */
export const exportStateBackup = (storage: Pick<Storage, 'getItem'>): string => {
	const values: Record<string, string> = {};
	for (const key of BACKUP_KEYS) {
		const value = storage.getItem(key);
		if (value !== null) values[key] = value;
	}
	return JSON.stringify({ schemaVersion: 1, values }, null, 2);
};

/**
 * @brief Validate every backup value before touching browser storage.
 * @param text Untrusted JSON file.
 * @return Allowlisted values, null for malformed or future versions.
 */
export const parseStateBackup = (text: string): Record<string, string> | null => {
	if (text.length > 2_000_000) return null;
	try {
		const data = JSON.parse(text) as { schemaVersion?: unknown; values?: unknown };
		if (data.schemaVersion !== 1 || typeof data.values !== 'object' || !data.values || Array.isArray(data.values)) return null;
		const out: Record<string, string> = {};
		const enums: Record<string, string[]> = {
			'haguruma-lang': ['en', 'it', 'de', 'es', 'fr'], 'haguruma-theme': ['dark', 'oled', 'light'],
			'haguruma-unit': ['kmh', 'mph'], 'haguruma-power-unit': ['kw', 'cv'],
			'haguruma-setup-level': ['easy', 'medium', 'full'], 'haguruma-comp-level': ['easy', 'medium', 'full'],
		};
		for (const [key, value] of Object.entries(data.values)) {
			if (!(BACKUP_KEYS as readonly string[]).includes(key) || typeof value !== 'string') return null;
			if (key === 'haguruma-custom-presets') {
				if (!validateGarageBackup(JSON.parse(value))) return null;
			} else if (key === 'haguruma-performance-session') {
				const samples = parsePerformanceSession(value);
				if (!samples) return null;
				out[key] = JSON.stringify({ schemaVersion: 1, samples });
				continue;
			} else if (!enums[key]?.includes(value)) return null;
			out[key] = value;
		}
		return out;
	} catch {
		return null;
	}
};

/**
 * @brief Restore a validated backup, rolling back on quota/storage errors.
 * @param storage Browser-compatible storage.
 * @param values Validated allowlisted entries.
 * @return True when all writes succeeded.
 */
export const restoreStateBackup = (storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>, values: Record<string, string>): boolean => {
	const validated = parseStateBackup(JSON.stringify({ schemaVersion: 1, values }));
	if (!validated) return false;
	const previous = new Map<string, string | null>();
	try {
		for (const [key, value] of Object.entries(validated)) {
			previous.set(key, storage.getItem(key));
			storage.setItem(key, value);
		}
		return true;
	} catch {
		for (const [key, value] of previous) {
			try {
				if (value === null) storage.removeItem(key);
				else storage.setItem(key, value);
			} catch { /* Leave the download as the recovery source if storage stays unavailable. */ }
		}
		return false;
	}
};
