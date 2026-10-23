/**
 * @file efficiency-map.ts
 * @brief Strict measured RPM/load efficiency map import, with no fabricated calibration.
 */
import type { EfficiencySample } from './powertrain-math';

/**
 * @brief Validate every measured sample atomically and discard unknown properties.
 * @param value Untrusted parsed samples.
 * @return Sanitized map, null for invalid or duplicate operating points.
 */
export const validateEfficiencyMap = (value: unknown): EfficiencySample[] | null => {
	if (!Array.isArray(value) || value.length < 2 || value.length > 256) return null;
	const out: EfficiencySample[] = [];
	const seen = new Set<string>();
	for (const row of value) {
		if (!row || typeof row !== 'object') return null;
		const { rpm, load, efficiency } = row;
		if (![rpm, load, efficiency].every((v) => typeof v === 'number' && Number.isFinite(v))
			|| rpm < 500 || rpm > 15000 || load < 0 || load > 1 || efficiency <= 0 || efficiency > 1) return null;
		const key = `${rpm}:${load}`;
		if (seen.has(key)) return null;
		seen.add(key); out.push({ rpm, load, efficiency });
	}
	return out;
};

/**
 * @brief Read canonical rpm/load/efficiency CSV, fractions rather than percentages.
 * @param text CSV with a mandatory three-column header, at most 50 kB.
 * @return Entire validated measured map or null.
 */
export const parseEfficiencyCsv = (text: string): EfficiencySample[] | null => {
	if (text.length > 50_000) return null;
	const lines = text.replace(/^\uFEFF/, '').trim().split(/\r?\n/).filter((line) => line.trim());
	const separator = lines[0]?.includes(';') ? ';' : lines[0]?.includes('\t') ? '\t' : ',';
	const cells = (line: string): string[] => line.split(separator).map((cell) => cell.trim().replace(/^"|"$/g, ''));
	if (cells(lines[0] ?? '').map((cell) => cell.toLowerCase()).join(',') !== 'rpm,load,efficiency') return null;
	const rows = [];
	for (const line of lines.slice(1)) {
		const row = cells(line);
		if (row.length !== 3 || row.some((value) => !value.trim())) return null;
		const [rpm, load, efficiency] = row.map((value) => Number(value.replace(',', '.')));
		rows.push({ rpm, load, efficiency });
	}
	return validateEfficiencyMap(rows);
};
