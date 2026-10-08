/**
 * @file state-backup.ts
 * @brief Full-state backup bundle plus bulk custom-preset transfer.
 * @brief The bundle snapshots every persisted localStorage value (custom
 * @brief cars, units, theme, language, setup levels, sessions) into one
 * @brief versioned JSON file; the bulk transfer moves only the custom-car map
 * @brief for device migration. Validation is pure so corrupt files are
 * @brief rejected before any storage write.
 */
import { CUSTOM_STORE_VERSION, isPreset, migrateCustomStore } from '../presets/custom-store';
import type { GearPreset } from '../models';

/** Backup envelope version. */
export const BACKUP_VERSION = 1;

/** localStorage keys snapshotted by the full-state bundle. */
export const BACKUP_KEYS = [
	'haguruma-custom-presets',
	'haguruma-lang',
	'haguruma-unit',
	'haguruma-power-unit',
	'haguruma-theme',
	'haguruma-setup-level',
	'haguruma-comp-level',
	'haguruma-sessions',
];

/** Parsed backup bundle. */
export interface StateBackup {
	/** Envelope version, always BACKUP_VERSION. */
	schemaVersion: number;
	/** ISO export timestamp. */
	exportedAt: string;
	/** Raw key-to-value snapshot. */
	values: Record<string, string>;
}

/**
 * @brief Check for browser storage (false under vitest node environment).
 * @return True when localStorage may be touched.
 */
const hasStorage = (): boolean => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

/**
 * @brief Collect every persisted value into a backup envelope.
 * @return Bundle with the raw stored strings, empty values when no storage.
 */
export const collectBackup = (): StateBackup => {
	const values: Record<string, string> = {};
	if (hasStorage()) {
		for (const key of BACKUP_KEYS) {
			try {
				const raw = window.localStorage.getItem(key);
				if (raw !== null) {
					values[key] = raw;
				}
			} catch {
				continue;
			}
		}
	}
	return { schemaVersion: BACKUP_VERSION, exportedAt: new Date().toISOString(), values };
};

/**
 * @brief Validate backup JSON text without touching storage.
 * @param text Raw file text.
 * @return Bundle, or null when the envelope is corrupt or from the future.
 */
export const parseBackup = (text: string): StateBackup | null => {
	if (!text || typeof text !== 'string') {
		return null;
	}
	try {
		const parsed = JSON.parse(text) as { schemaVersion?: unknown; values?: unknown };
		if (parsed.schemaVersion !== BACKUP_VERSION || typeof parsed.values !== 'object' || parsed.values === null) {
			return null;
		}
		const values: Record<string, string> = {};
		for (const [key, value] of Object.entries(parsed.values as Record<string, unknown>)) {
			if (typeof value === 'string') {
				values[key] = value;
			}
		}
		return { schemaVersion: BACKUP_VERSION, exportedAt: new Date().toISOString(), values };
	} catch {
		return null;
	}
};

/**
 * @brief Write a validated bundle back to storage.
 * @param backup Validated bundle.
 * @return Count of restored keys.
 */
export const restoreBackup = (backup: StateBackup): number => {
	if (!hasStorage()) {
		return 0;
	}
	let restored = 0;
	for (const key of BACKUP_KEYS) {
		const raw = backup.values[key];
		if (raw === undefined) {
			continue;
		}
		try {
			window.localStorage.setItem(key, raw);
			restored += 1;
		} catch {
			continue;
		}
	}
	return restored;
};

/**
 * @brief Build the bulk custom-preset transfer payload.
 * @param presets Name-keyed presets to export.
 * @return Versioned JSON text.
 */
export const exportPresetsBundle = (presets: Record<string, GearPreset>): string => {
	return JSON.stringify({ schemaVersion: CUSTOM_STORE_VERSION, presets }, null, 2);
};

/**
 * @brief Validate bulk preset JSON text without touching storage.
 * @param text Raw file text.
 * @return Name-keyed valid presets, empty when nothing is usable.
 */
export const parsePresetsBundle = (text: string): Record<string, GearPreset> => {
	if (!text || typeof text !== 'string') {
		return {};
	}
	try {
		return migrateCustomStore(JSON.parse(text) as unknown);
	} catch {
		return {};
	}
};

/**
 * @brief Count usable presets in a parsed bundle.
 * @param presets Parsed bundle presets.
 * @return Valid preset count.
 */
export const countValidPresets = (presets: Record<string, GearPreset>): number => {
	return Object.values(presets).filter(isPreset).length;
};

/**
 * @brief Download text as a file through a temporary anchor.
 * @param filename Download filename.
 * @param text File content.
 * @param mime MIME type, JSON by default.
 * @return void
 */
export const downloadTextFile = (filename: string, text: string, mime: string = 'application/json'): void => {
	const blob = new Blob([text], { type: mime });
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement('a');
	anchor.href = url;
	anchor.download = filename;
	document.body.appendChild(anchor);
	anchor.click();
	anchor.remove();
	URL.revokeObjectURL(url);
};

/**
 * @brief Read a user-picked file as text.
 * @param file File picked from an input element.
 * @return File text.
 */
export const readFileText = (file: File): Promise<string> => {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = (): void => resolve(typeof reader.result === 'string' ? reader.result : '');
		reader.onerror = (): void => reject(reader.error);
		reader.readAsText(file);
	});
};
