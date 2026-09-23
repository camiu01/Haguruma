/**
 * @file presets.ts
 * @brief Catalog-backed preset loader preserving the presets contract.
 */
import type { GearPreset } from '../core/models';
import { catalogEntries } from './car-catalog';

const entries = catalogEntries;

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
