/**
 * @file dyno-csv.ts
 * @brief Parse dyno CSV exports into a validated custom torque curve.
 *
 * Accepted layouts: an optional header row (rpm / torque / power in any
 * column order, English or Italian labels, Nm or kgm torque, kW or cv/hp
 * power) or header-less `rpm,torqueNm[,powerKw]` rows. Comma, semicolon and
 * tab delimiters are supported, and decimal commas are accepted alongside
 * semicolon-separated European spreadsheets. Power-only files are converted
 * to torque via T = P x (30000/pi) / n.
 */
import { KW_TO_NM, anchorsFromPoints, sanitizeTorquePoints, torqueAtRpm } from './engine-curve-core';
import { hpToKw } from './aero-math';
import type { TorqueCurvePoint } from '../models';

/** Cap on curve points so share URLs stay compact (import resamples above it). */
export const MAX_CURVE_POINTS = 64;

/** Minimum rows required to build a usable curve. */
const MIN_ROWS = 2;

/** kgm (kilogram-metre) to Nm conversion. */
const KGM_TO_NM = 9.80665;

/** Rpm column matcher for header cells. */
const RPM_HEADER = /(rpm|giri|rev)/i;

/** Torque column matcher for header cells (Nm or kgm). */
const TORQUE_HEADER = /(nm|coppia|torque|torq|kgm|mkg)/i;

/** Power column matcher for header cells (kW or metric cv/hp/ps). */
const POWER_HEADER = /(kw|cv|hp|ps|potenza|power)/i;

/** Metric horsepower unit matcher for header cells. */
const HP_UNIT = /(cv|hp|ps)/i;

/** Kilogram-metre unit matcher for header cells. */
const KGM_UNIT = /(kgm|mkg)/i;

/**
 * One dyno CSV parse result.
 * @brief Sanitized points plus anchors consistent with the measurement.
 */
export interface DynoCurve {
	/** Sorted unique torque points (at most MAX_CURVE_POINTS). */
	points: TorqueCurvePoint[];
	/** RPM of peak torque derived from the points. */
	peakTorqueRpm: number;
	/** Peak torque in Nm derived from the points. */
	peakTorqueNm: number;
	/** RPM of peak power derived from the points. */
	peakPowerRpm: number;
	/** Peak power in kW derived from the points. */
	peakPowerKw: number;
}

/**
 * @brief Resample a sorted point list down to a fixed count.
 * @param points Sorted unique torque points.
 * @param maxPoints Target count (>= 2).
 * @return Evenly spaced points interpolated from the source curve.
 */
export const resampleTorquePoints = (points: TorqueCurvePoint[], maxPoints: number): TorqueCurvePoint[] => {
	if (points.length <= maxPoints || maxPoints < 2) {
		return points;
	}
	const first = points[0].rpm;
	const last = points[points.length - 1].rpm;
	const out: TorqueCurvePoint[] = [];
	for (let i = 0; i < maxPoints; i += 1) {
		const rpm = Math.round(first + ((last - first) * i) / (maxPoints - 1));
		out.push({ rpm, torqueNm: torqueAtRpm(points, rpm) });
	}
	return out;
};

/**
 * @brief Parse raw dyno CSV text into a validated curve.
 * @param text Full CSV file contents.
 * @return Dyno curve, or null when no usable rpm + torque/power rows exist.
 */
export const parseDynoCsv = (text: string): DynoCurve | null => {
	if (typeof text !== 'string' || text.trim() === '') {
		return null;
	}
	const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0 && !l.startsWith('#'));
	if (lines.length < MIN_ROWS) {
		return null;
	}
	const delimiter = detectDelimiter(lines[0]);
	const columns = resolveColumns(lines[0], delimiter);
	if (!columns) {
		return null;
	}
	const rows = lines.slice(columns.hasHeader ? 1 : 0);
	const points = collectPoints(rows, delimiter, columns);
	const sanitized = sanitizeTorquePoints(points);
	if (!sanitized) {
		return null;
	}
	const capped = resampleTorquePoints(sanitized, MAX_CURVE_POINTS);
	return { points: capped, ...anchorsFromPoints(capped) };
};

/**
 * @brief Detect the CSV delimiter from the first line.
 * @param line First non-empty line.
 * @return ';', ',' or tab, whichever occurs most.
 */
const detectDelimiter = (line: string): string => {
	const counts: Record<string, number> = { ';': (line.match(/;/g) ?? []).length, ',': (line.match(/,/g) ?? []).length, '\t': (line.match(/\t/g) ?? []).length };
	let best = ',';
	let bestCount = counts[','] ?? 0;
	if ((counts[';'] ?? 0) > bestCount) {
		best = ';';
		bestCount = counts[';'] ?? 0;
	}
	if ((counts['\t'] ?? 0) > bestCount) {
		best = '\t';
	}
	return best;
};

/**
 * @brief Resolve which column holds rpm, torque and power.
 * @param line First non-empty line.
 * @param delimiter Active cell delimiter.
 * @return Column map, or null when the header is unrecognizable.
 */
const resolveColumns = (line: string, delimiter: string): ColumnMap | null => {
	const cells = splitCells(line, delimiter);
	const hasHeader = cells.some((c) => c === '' ? false : Number.isNaN(Number(c)));
	if (!hasHeader) {
		if (cells.length < 2) {
			return null;
		}
		return { hasHeader: false, rpm: 0, torque: 1, power: cells.length >= 3 ? 2 : -1, torqueIsKgm: false, powerIsHp: false };
	}
	let rpm = -1;
	let torque = -1;
	let power = -1;
	let torqueIsKgm = false;
	let powerIsHp = false;
	cells.forEach((cell, idx) => {
		const name = cell.toLowerCase();
		if (rpm < 0 && RPM_HEADER.test(name)) {
			rpm = idx;
			return;
		}
		if (torque < 0 && TORQUE_HEADER.test(name) && !POWER_HEADER.test(name)) {
			torque = idx;
			torqueIsKgm = KGM_UNIT.test(name);
			return;
		}
		if (power < 0 && POWER_HEADER.test(name)) {
			power = idx;
			powerIsHp = HP_UNIT.test(name);
		}
	});
	if (rpm < 0 || (torque < 0 && power < 0)) {
		return null;
	}
	return { hasHeader: true, rpm, torque, power, torqueIsKgm, powerIsHp };
};

/** Column indexes and unit flags for one CSV layout. */
interface ColumnMap {
	/** True when the first line is a header row. */
	hasHeader: boolean;
	/** Column index holding engine speed. */
	rpm: number;
	/** Column index holding torque, -1 when absent. */
	torque: number;
	/** Column index holding power, -1 when absent. */
	power: number;
	/** True when the torque column uses kgm instead of Nm. */
	torqueIsKgm: boolean;
	/** True when the power column uses cv/hp/ps instead of kW. */
	powerIsHp: boolean;
}

/**
 * @brief Split one line into trimmed cells.
 * @param line Raw CSV line.
 * @param delimiter Active cell delimiter.
 * @return Trimmed cell strings.
 */
const splitCells = (line: string, delimiter: string): string[] => {
	return line.split(delimiter).map((c) => c.trim().replace(/\s+/g, ''));
};

/**
 * @brief Convert raw rows into torque points.
 * @param rows Data lines without the header.
 * @param delimiter Active cell delimiter.
 * @param columns Resolved column map.
 * @return Raw points before sanitation.
 */
const collectPoints = (rows: string[], delimiter: string, columns: ColumnMap): TorqueCurvePoint[] => {
	const decimalComma = delimiter === ';';
	const points: TorqueCurvePoint[] = [];
	for (const row of rows) {
		const cells = splitCells(row, delimiter);
		const rpm = parseNum(cells[columns.rpm], decimalComma);
		if (rpm === null || rpm <= 0) {
			continue;
		}
		let torqueNm = Number.NaN;
		if (columns.torque >= 0) {
			const raw = parseNum(cells[columns.torque], decimalComma);
			if (raw !== null) {
				torqueNm = columns.torqueIsKgm ? raw * KGM_TO_NM : raw;
			}
		}
		if (!Number.isFinite(torqueNm) && columns.power >= 0) {
			const raw = parseNum(cells[columns.power], decimalComma);
			if (raw !== null && raw > 0) {
				const kw = columns.powerIsHp ? hpToKw(raw) : raw;
				torqueNm = (kw * KW_TO_NM) / rpm;
			}
		}
		if (Number.isFinite(torqueNm) && torqueNm > 0) {
			points.push({ rpm, torqueNm });
		}
	}
	return points;
};

/**
 * @brief Parse one CSV cell into a number.
 * @param cell Raw cell text.
 * @param decimalComma True when commas mark decimals (semicolon delimiter).
 * @return Parsed number or null when the cell is not numeric.
 */
const parseNum = (cell: string | undefined, decimalComma: boolean): number | null => {
	if (cell === undefined || cell === '') {
		return null;
	}
	const cleaned = decimalComma ? cell.replace(/,/g, '.') : cell;
	const v = Number(cleaned);
	return Number.isFinite(v) ? v : null;
};
