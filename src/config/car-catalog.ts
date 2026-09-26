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
	return validateCatalogEntry(entry).length === 0;
};

/**
 * @brief Strict validator returning one error per broken rule (Zod-style).
 * @param entry Unknown parsed JSON value.
 * @return Error list, empty when the entry is usable.
 */
export const validateCatalogEntry = (entry: unknown): string[] => {
	const errors: string[] = [];
	if (typeof entry !== 'object' || entry === null) {
		return ['entry must be an object'];
	}
	const candidate = entry as Record<string, unknown>;
	if (typeof candidate.id !== 'string' || candidate.id.length === 0) {
		errors.push('id must be a non-empty string');
	}
	if (typeof candidate.label !== 'string' || candidate.label.length === 0) {
		errors.push('label must be a non-empty string');
	}
	if (typeof candidate.group !== 'string' || candidate.group.length === 0) {
		errors.push('group must be a non-empty string');
	}
	errors.push(...validatePresetBody(candidate.preset));
	return errors;
};

/**
 * @brief Validate the preset body of one catalog entry.
 * @param preset Unknown preset value.
 * @return Error list, empty when the body is usable.
 */
const validatePresetBody = (preset: unknown): string[] => {
	const errors: string[] = [];
	if (typeof preset !== 'object' || preset === null) {
		return ['preset must be an object'];
	}
	const p = preset as Record<string, unknown>;
	if (typeof p.tire !== 'string' || p.tire.length === 0) {
		errors.push('preset.tire must be a non-empty string');
	}
	if (typeof p.fd !== 'number' || !(p.fd > 0)) {
		errors.push('preset.fd must be a positive number');
	}
	if (typeof p.redline !== 'number' || !(p.redline > 0)) {
		errors.push('preset.redline must be a positive number');
	}
	errors.push(...validateGearRatios(p.gears));
	errors.push(...validateRunningGearBody(p.runningGear));
	return errors;
};

/**
 * @brief Validate gear ratios are positive and strictly decreasing.
 * @param gears Unknown gears value.
 * @return Error list, empty when ratios are usable.
 */
const validateGearRatios = (gears: unknown): string[] => {
	if (!Array.isArray(gears) || gears.length === 0) {
		return ['preset.gears must be a non-empty array'];
	}
	if (!(gears as unknown[]).every((g) => typeof g === 'number' && g > 0)) {
		return ['preset.gears must hold positive numbers'];
	}
	const ratios = gears as number[];
	for (let i = 1; i < ratios.length; i += 1) {
		if (!(ratios[i] < ratios[i - 1])) {
			return ['preset.gears must be strictly decreasing'];
		}
	}
	return [];
};

/**
 * @brief Validate the runningGear block when present.
 * @param rg Unknown runningGear value.
 * @return Error list, empty when absent or valid.
 */
const validateRunningGearBody = (rg: unknown): string[] => {
	if (rg === undefined) {
		return [];
	}
	if (typeof rg !== 'object' || rg === null) {
		return ['preset.runningGear must be an object'];
	}
	const g = rg as Record<string, unknown>;
	const layouts = ['FWD', 'RWD', 'AWD'];
	const diffs = ['open', 'torsen', 'clutch_lsd', 'spool', 'custom'];
	if (!layouts.includes(g.drivetrainLayout as string)) {
		return ['preset.runningGear.drivetrainLayout has an unknown layout'];
	}
	if (!diffs.includes(g.differentialType as string)) {
		return ['preset.runningGear.differentialType has an unknown type'];
	}
	return [];
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
