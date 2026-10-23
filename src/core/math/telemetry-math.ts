/**
 * @file telemetry-math.ts
 * @brief Local CSV telemetry normalization, ratio recovery and inverse dyno.
 */
import { dragForce, gradeForce, rollingForceAtSpeed } from './aero-math';
import type { TorqueCurvePoint } from '../models';
import { sanitizeTorquePoints } from './engine-curve-core';

export interface TelemetryRow { timeS: number; rpm: number; speedKmh: number; gear?: number }
export interface RecoveredRatio { ratio: number; samples: number; slipFraction: number }

/**
 * @brief Split a CSV record including quoted separators and escaped quotes.
 * @param line One CSV record.
 * @param separator Chosen field delimiter.
 * @return Unquoted cells.
 */
const csvCells = (line: string, separator: string): string[] => {
	const cells: string[] = [];
	let cell = '';
	let quoted = false;
	for (let i = 0; i < line.length; i += 1) {
		if (line[i] === '"' && line[i + 1] === '"' && quoted) {
			cell += '"';
			i += 1;
		} else if (line[i] === '"') {
			quoted = !quoted;
		} else if (line[i] === separator && !quoted) {
			cells.push(cell.trim());
			cell = '';
		} else {
			cell += line[i];
		}
	}
	return [...cells, cell.trim()];
};

/**
 * @brief Normalize common MoTeC, AiM, RaceChrono and OBD2 CSV channels.
 * @param text CSV text with headers and SI units, optionally a units row.
 * @return Strictly time-ordered usable samples, capped at 50000.
 */
export const parseTelemetryCsv = (text: string): TelemetryRow[] => {
	if (text.length > 10_000_000) return [];
	const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
	const headerIndex = lines.findIndex((line) => /rpm|engine.?speed/i.test(line) && /speed|velocity/i.test(line));
	if (headerIndex < 0) return [];
	const header = lines[headerIndex];
	const separator = header.includes(';') ? ';' : header.includes('\t') ? '\t' : ',';
	const names = csvCells(header, separator).map((cell) => cell.toLowerCase().replace(/[^a-z0-9]/g, ''));
	const rpmIndex = names.findIndex((name) => /^(rpm|enginerpm|enginespeed)/.test(name));
	const speedIndex = names.findIndex((name) => /^(wheelspeed|speed|gpsspeed|velocity)/.test(name));
	const timeIndex = names.findIndex((name) => /^(time|elapsed|timestamp)/.test(name));
	const gearIndex = names.findIndex((name) => /^(gear|gearindex)$/.test(name));
	if (rpmIndex < 0 || speedIndex < 0 || timeIndex < 0 || /mph|mps/.test(names[speedIndex])) return [];
	const rows: TelemetryRow[] = [];
	for (const line of lines.slice(headerIndex + 1, headerIndex + 50002)) {
		const cells = csvCells(line, separator);
		const numeric = (index: number): number => cells[index]?.trim() ? Number(cells[index].replace(',', '.')) : NaN;
		const timeS = numeric(timeIndex);
		const rpm = numeric(rpmIndex);
		const speedKmh = numeric(speedIndex);
		const gear = numeric(gearIndex);
		if (![timeS, rpm, speedKmh].every(Number.isFinite) || timeS < 0 || rpm < 0 || rpm > 30000 || speedKmh < 0 || speedKmh > 600) continue;
		if (rows.length > 0 && timeS <= rows[rows.length - 1].timeS) continue;
		rows.push({ timeS, rpm, speedKmh, ...(Number.isInteger(gear) && gear >= 1 && gear <= 8 ? { gear } : {}) });
	}
	return rows;
};

/**
 * @brief Recover discrete gearbox ratios from RPM and road speed.
 * @param rows Normalized telemetry.
 * @param circM Known effective tire circumference.
 * @param fd Known final drive.
 * @return Decreasing ratios with at least three samples and outlier fractions.
 */
export const recoverGearRatios = (rows: TelemetryRow[], circM: number, fd: number): RecoveredRatio[] => {
	if (![circM, fd].every(Number.isFinite) || circM <= 0 || fd <= 0) return [];
	const groups: { center: number; values: number[] }[] = [];
	for (const row of rows) {
		if (row.speedKmh < 15 || row.rpm < 1000) continue;
		const ratio = row.rpm * circM * 0.06 / (row.speedKmh * fd);
		if (ratio < 0.3 || ratio > 8) continue;
		const group = groups.find((entry) => Math.abs(entry.center - ratio) / entry.center < 0.06);
		if (group) {
			group.values.push(ratio);
			group.center += (ratio - group.center) / group.values.length;
		} else if (groups.length < 64) {
			groups.push({ center: ratio, values: [ratio] });
		}
	}
	return groups.filter((group) => group.values.length >= 3).map((group) => {
		const sorted = [...group.values].sort((a, b) => a - b);
		const median = sorted[Math.floor(sorted.length / 2)];
		return { ratio: median, samples: sorted.length, slipFraction: sorted.filter((value) => Math.abs(value - median) / median > 0.03).length / sorted.length };
	}).sort((a, b) => b.ratio - a.ratio).slice(0, 8);
};

export interface InverseDynoInput {
	massKg: number;
	gears: number[];
	fd: number;
	circM: number;
	efficiency: number;
	dragCd: number;
	areaM2: number;
	rollingCrr: number;
	gradePercent: number;
}

/**
 * @brief Estimate full-throttle crank torque from a clean acceleration log.
 * @param rows Timed RPM/speed samples with known gears.
 * @param setup Known vehicle properties.
 * @return Sanitized torque points, null without steady-gear acceleration.
 */
export const inverseDyno = (rows: TelemetryRow[], setup: InverseDynoInput): TorqueCurvePoint[] | null => {
	if (![setup.massKg, setup.fd, setup.circM, setup.efficiency, setup.dragCd, setup.areaM2, setup.rollingCrr, setup.gradePercent].every(Number.isFinite)
		|| setup.massKg <= 0 || setup.fd <= 0 || setup.circM <= 0 || setup.efficiency <= 0 || setup.efficiency > 1) return null;
	const bins = new Map<number, number[]>();
	for (let i = 1; i < rows.length - 1; i += 1) {
		const [a, row, b] = [rows[i - 1], rows[i], rows[i + 1]];
		if (!row.gear || row.gear !== a.gear || row.gear !== b.gear || row.speedKmh < 15) continue;
		const ratio = setup.gears[row.gear - 1];
		const dt = b.timeS - a.timeS;
		if (!ratio || dt <= 0 || dt > 2) continue;
		const acceleration = (b.speedKmh - a.speedKmh) / (3.6 * dt);
		if (acceleration <= 0 || acceleration > 20) continue;
		const wheelForce = setup.massKg * acceleration + dragForce(row.speedKmh, setup.dragCd, setup.areaM2)
			+ rollingForceAtSpeed(setup.massKg, setup.rollingCrr, row.speedKmh) + gradeForce(setup.massKg, setup.gradePercent);
		const torque = wheelForce * setup.circM / (2 * Math.PI * ratio * setup.fd * setup.efficiency);
		const rpm = Math.round(row.rpm / 250) * 250;
		const values = bins.get(rpm) ?? [];
		values.push(torque);
		bins.set(rpm, values);
	}
	return sanitizeTorquePoints([...bins].map(([rpm, values]) => ({ rpm, torqueNm: values.reduce((sum, value) => sum + value, 0) / values.length })));
};
