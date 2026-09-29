/**
 * @file car-catalog.ts
 * @brief Vehicle catalog assembled from per-car files via Vite glob.
 */
import type { GearPreset } from '../core/models';
import { TIRE_COMPOUND_IDS } from './tire-compounds';
import { DIFF_PRESETS } from './diff-presets';

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
	errors.push(...validateFinalDrives(p.finalDrives, p.fd));
	errors.push(...validateDrivetrainOptions(p.drivetrainOptions, p.fd));
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
 * @brief Validate optional alternative final drives.
 * @param drives Unknown finalDrives value.
 * @param fd Stock final drive that the list must contain.
 * @return Error list, empty when absent or valid.
 */
const validateFinalDrives = (drives: unknown, fd: unknown): string[] => {
	if (drives === undefined) {
		return [];
	}
	if (!Array.isArray(drives) || drives.length < 2) {
		return ['preset.finalDrives must hold at least two ratios'];
	}
	if (!(drives as unknown[]).every((d) => typeof d === 'number' && d >= 1 && d <= 10)) {
		return ['preset.finalDrives must hold ratios between 1 and 10'];
	}
	if (typeof fd !== 'number' || !(drives as number[]).includes(fd)) {
		return ['preset.finalDrives must contain the stock fd'];
	}
	return [];
};

/** Maximum aftermarket gearsets per preset. */
const MAX_GEARSETS = 8;

/**
 * @brief Validate optional aftermarket drivetrain variants.
 * @param options Unknown drivetrainOptions value.
 * @param fd Stock final drive that alternate lists must contain.
 * @return Error list, empty when absent or valid.
 */
const validateDrivetrainOptions = (options: unknown, fd: unknown): string[] => {
	if (options === undefined) {
		return [];
	}
	if (typeof options !== 'object' || options === null) {
		return ['preset.drivetrainOptions must be an object'];
	}
	const o = options as Record<string, unknown>;
	if (o.finalDrives !== undefined) {
		const errs = validateFinalDrives(o.finalDrives, fd);
		if (errs.length > 0) {
			return errs.map((e) => e.replace('preset.finalDrives', 'preset.drivetrainOptions.finalDrives'));
		}
	}
	if (o.gearsets !== undefined) {
		if (!Array.isArray(o.gearsets) || o.gearsets.length === 0 || o.gearsets.length > MAX_GEARSETS) {
			return ['preset.drivetrainOptions.gearsets must hold 1-8 entries'];
		}
		for (const g of o.gearsets) {
			if (typeof g !== 'object' || g === null) {
				return ['preset.drivetrainOptions.gearsets entries must be objects'];
			}
			const set = g as Record<string, unknown>;
			if (typeof set.label !== 'string' || set.label.length === 0 || set.label.length > 40) {
				return ['preset.drivetrainOptions.gearsets labels must be 1-40 chars'];
			}
			const ratios = set.ratios as unknown;
			if (!Array.isArray(ratios) || ratios.length === 0 || !(ratios as unknown[]).every((r) => typeof r === 'number' && r >= 0.4 && r <= 6)) {
				return ['preset.drivetrainOptions.gearsets ratios must be within 0.4-6.0'];
			}
			for (let i = 1; i < (ratios as number[]).length; i += 1) {
				if (!((ratios as number[])[i] < (ratios as number[])[i - 1])) {
					return ['preset.drivetrainOptions.gearsets ratios must be strictly decreasing'];
				}
			}
		}
	}
	if (o.lsds !== undefined) {
		if (!Array.isArray(o.lsds) || !(o.lsds as unknown[]).every((id) => typeof id === 'string' && DIFF_PRESETS.some((p) => p.id === id))) {
			return ['preset.drivetrainOptions.lsds must hold catalog differential ids'];
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
	if (g.tireCompoundId !== undefined && !TIRE_COMPOUND_IDS.has(g.tireCompoundId as string)) {
		return ['preset.runningGear.tireCompoundId has an unknown compound'];
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
