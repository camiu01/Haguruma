/**
 * @file car-catalog.ts
 * @brief Vehicle catalog assembled from per-car files via Vite glob.
 */
import type { GearPreset } from '../core/models';

/**
 * @brief Strict shared model for every vehicle configuration file.
 * @brief Each file under src/config/cars/ must satisfy this contract.
 */
export interface CarCatalogEntry {
	/** Stable preset key, matches the file name. */
	id: string;
	/** Human-readable dropdown label. */
	label: string;
	/** Preset group bucket, e.g. factory or community. */
	group: string;
	/** Vehicle preset body. */
	preset: GearPreset;
}

/**
 * @brief Unwrap one globbed module to its catalog entry candidate.
 * @brief Eager JSON globs yield either the entry or a default wrapper.
 * @param mod Raw globbed module value.
 * @return Unwrapped candidate value.
 */
const unwrapModule = (mod: unknown): unknown => {
	if (typeof mod === 'object' && mod !== null && 'default' in mod) {
		return (mod as { default: unknown }).default;
	}
	return mod;
};

/**
 * @brief Validate one parsed car file against the catalog contract.
 * @param entry Unknown parsed JSON value.
 * @return True when the entry is usable.
 */
export const isCatalogEntry = (entry: unknown): entry is CarCatalogEntry => {
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
 * @brief Discover every car file, validate and sort by id for stable order.
 * @brief Adding a car is a file drop; no registry edits needed.
 * @return Valid catalog entries sorted by id.
 */
const loadCatalogEntries = (): CarCatalogEntry[] => {
	const modules = import.meta.glob('./cars/*.json', { eager: true });
	const out: CarCatalogEntry[] = [];
	for (const mod of Object.values(modules)) {
		const entry = unwrapModule(mod);
		if (isCatalogEntry(entry)) {
			out.push(entry);
		}
	}
	out.sort((a, b) => a.id.localeCompare(b.id));
	return out;
};

/**
 * Catalog entries resolved from src/config/cars/ at build time.
 * @brief Single source consumed by presets without static imports.
 */
export const catalogEntries: CarCatalogEntry[] = loadCatalogEntries();
