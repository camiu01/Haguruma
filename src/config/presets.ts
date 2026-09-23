/**
 * @file presets.ts
 * @brief Catalog-backed preset loader preserving the presets contract.
 */
import type { GearPreset } from '../core/models';
import catalog from './car-catalog.json';

/**
 * @brief Raw catalog entry shape from car-catalog.json.
 * @param none No parameters.
 * @return void
 */
interface CatalogEntry {
	/** Stable preset key. */
	id: string;
	/** Human-readable dropdown label. */
	label: string;
	/** Preset group bucket. */
	group: string;
	/** Vehicle preset body. */
	preset: GearPreset;
}

/**
 * @brief Minimal catalog entry validation.
 * @param entry Unknown parsed JSON entry.
 * @return True when the entry is usable.
 */
const isValidEntry = (entry: unknown): entry is CatalogEntry => {
	if (typeof entry !== 'object' || entry === null) {
		return false;
	}
	const candidate = entry as Record<string, unknown>;
	const preset = candidate.preset as Record<string, unknown> | undefined;
	if (typeof candidate.id !== 'string' || candidate.id.length === 0) {
		return false;
	}
	if (typeof candidate.label !== 'string' || candidate.label.length === 0) {
		return false;
	}
	if (typeof candidate.group !== 'string' || candidate.group.length === 0) {
		return false;
	}
	if (typeof preset !== 'object' || preset === null) {
		return false;
	}
	if (typeof preset.tire !== 'string' || preset.tire.length === 0) {
		return false;
	}
	if (typeof preset.fd !== 'number' || preset.fd <= 0) {
		return false;
	}
	if (typeof preset.redline !== 'number' || preset.redline <= 0) {
		return false;
	}
	if (!Array.isArray(preset.gears) || preset.gears.length === 0) {
		return false;
	}
	return (preset.gears as unknown[]).every((g) => typeof g === 'number' && g > 0);
};

/**
 * @brief Load validated catalog entries, skipping invalid rows.
 * @param none No parameters.
 * @return Valid catalog entries in file order.
 */
const loadCatalog = (): CatalogEntry[] => {
	const out: CatalogEntry[] = [];
	for (const entry of catalog as unknown as unknown[]) {
		if (isValidEntry(entry)) {
			out.push(entry);
		}
	}
	return out;
};

const entries: CatalogEntry[] = loadCatalog();

/**
 * Factory preset vehicles for the header dropdown.
 * @brief Realistic starting points including the Eclipse 1G GS hero preset.
 */
export const presets: Record<string, GearPreset> = {};

/**
 * Dropdown labels and group buckets keyed by preset id.
 * @brief Feeds runtime optgroup construction.
 */
export const presetMeta: Record<string, { label: string; group: string }> = {};

/**
 * Preset ids bucketed by group in catalog order.
 * @brief Supports factory/community optgroup rendering.
 */
export const presetGroups: Record<string, string[]> = { factory: [], community: [] };

for (const entry of entries) {
	presets[entry.id] = entry.preset;
	presetMeta[entry.id] = { label: entry.label, group: entry.group };
	if (!presetGroups[entry.group]) {
		presetGroups[entry.group] = [];
	}
	presetGroups[entry.group].push(entry.id);
}
