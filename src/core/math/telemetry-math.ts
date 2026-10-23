/**
 * @file telemetry-math.ts
 * @brief Pure telemetry-log parsing and gear-ratio recovery.
 * @brief Reads MoTeC, AiM, RaceChrono and OBD2 style CSV logs carrying engine
 * @brief rpm and wheel speed, clusters the rpm-per-wheel-rev samples into gear
 * @brief ratios and flags clutch or tire slip as off-cluster samples.
 */

/** One synchronized telemetry sample. */
export interface TelemetrySample {
	/** Time in seconds since log start. */
	t: number;
	/** Engine speed in RPM. */
	rpm: number;
	/** Vehicle speed in km/h. */
	speedKmh: number;
}

/** Recovered gear with its ratio estimate and slip share. */
export interface RecoveredGear {
	/** Gear number from shortest (1) to tallest. */
	gear: number;
	/** Median overall ratio (gear x final drive). */
	ratio: number;
	/** Samples assigned to this cluster. */
	samples: number;
	/** Share of samples over 5% off the median (slip), 0-100. */
	slipPct: number;
}

/** Largest log accepted for one analysis pass. */
export const TELEMETRY_MAX_SAMPLES = 20000;

/** Clustering window: ratios within 3% join the same gear. */
const CLUSTER_TOLERANCE = 0.03;

/** Slip flag: samples over 5% off the cluster median. */
const SLIP_TOLERANCE = 0.05;

/** Minimum samples for a cluster to count as a gear. */
const MIN_CLUSTER_SAMPLES = 5;

/**
 * @brief Split one CSV line on comma, semicolon or tab.
 * @param line Raw line without the line break.
 * @return Trimmed cell list.
 */
const splitLine = (line: string): string[] => {
	const delim = line.includes(';') ? ';' : line.includes('\t') ? '\t' : ',';
	return line.split(delim).map((cell) => cell.trim());
};

/**
 * @brief Parse one number accepting decimal commas on semicolon logs.
 * @param raw Raw cell text.
 * @param commaDecimals True when commas are decimal separators.
 * @return Finite number or NaN.
 */
const parseNum = (raw: string, commaDecimals: boolean): number => {
	const text = commaDecimals ? raw.replace(/\./g, '').replace(',', '.') : raw.replace(',', '');
	return parseFloat(text);
};

/**
 * @brief Locate the rpm, speed and optional time columns of a header row.
 * @param cells Lower-cased header cells.
 * @return Column indexes, -1 when a column is absent.
 */
const findColumns = (cells: string[]): { rpm: number; speed: number; time: number } => {
	const out = { rpm: -1, speed: -1, time: -1 };
	cells.forEach((cell, idx) => {
		if (out.rpm < 0 && cell.includes('rpm')) {
			out.rpm = idx;
		} else if (out.speed < 0 && (cell.includes('speed') || cell.includes('kmh') || cell.includes('velocity') || cell.includes('mph'))) {
			out.speed = idx;
		} else if (out.time < 0 && (cell === 't' || cell.includes('time') || cell.includes('second'))) {
			out.time = idx;
		}
	});
	return out;
};

/**
 * @brief Convert an mph column to km/h when the header says so.
 * @param value Raw speed value.
 * @param header Header cell text of the speed column.
 * @return Speed in km/h.
 */
const toKmh = (value: number, header: string): number => {
	return header.includes('mph') ? value * 1.609344 : value;
};

/**
 * @brief Parse a telemetry CSV log into synchronized samples.
 * @brief Accepts a header row (engine_rpm / wheel_speed_kmh style) or a
 * @brief header-less rpm,speed / time,rpm,speed layout; semicolons and decimal
 * @brief commas are supported.
 * @param text Raw CSV text.
 * @return Sample list capped at TELEMETRY_MAX_SAMPLES, or null when empty.
 */
export const parseTelemetryCsv = (text: string): TelemetrySample[] | null => {
	if (!text || typeof text !== 'string') {
		return null;
	}
	const lines = text.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.length > 0);
	if (lines.length === 0) {
		return null;
	}
	const commaDecimals = lines[0].includes(';');
	const first = splitLine(lines[0]).map((cell) => cell.toLowerCase());
	const header = findColumns(first);
	const hasHeader = header.rpm >= 0 && header.speed >= 0;
	const rows = hasHeader ? lines.slice(1) : lines;
	const out: TelemetrySample[] = [];
	for (const line of rows) {
		if (out.length >= TELEMETRY_MAX_SAMPLES) {
			break;
		}
		const cells = splitLine(line);
		let rpmRaw: string | undefined;
		let speedRaw: string | undefined;
		let timeRaw: string | undefined;
		if (hasHeader) {
			rpmRaw = cells[header.rpm];
			speedRaw = cells[header.speed];
			timeRaw = header.time >= 0 ? cells[header.time] : undefined;
		} else if (cells.length >= 3) {
			timeRaw = cells[0];
			rpmRaw = cells[1];
			speedRaw = cells[2];
		} else if (cells.length === 2) {
			rpmRaw = cells[0];
			speedRaw = cells[1];
		} else {
			continue;
		}
		const rpm = parseNum(rpmRaw ?? '', commaDecimals);
		const speed = parseNum(speedRaw ?? '', commaDecimals);
		const time = timeRaw !== undefined ? parseNum(timeRaw, commaDecimals) : out.length * 0.1;
		if (!Number.isFinite(rpm) || rpm <= 0 || !Number.isFinite(speed) || speed <= 0) {
			continue;
		}
		out.push({
			t: Number.isFinite(time) ? time : out.length * 0.1,
			rpm,
			speedKmh: hasHeader ? toKmh(speed, first[header.speed]) : speed,
		});
	}
	return out.length > 0 ? out : null;
};

/**
 * @brief Recover gear ratios from telemetry samples.
 * @brief Forms the rpm-per-wheel-rev ratio of every sample, sorts them and
 * @brief groups ratios within 3% into gears; samples over 5% off the cluster
 * @brief median count as clutch or tire slip.
 * @param samples Parsed telemetry samples.
 * @param circM Tire rolling circumference in metres.
 * @return Gears sorted shortest-first, or null when input is unusable.
 */
export const estimateGearRatios = (samples: TelemetrySample[], circM: number): RecoveredGear[] | null => {
	if (!Array.isArray(samples) || samples.length < MIN_CLUSTER_SAMPLES) {
		return null;
	}
	if (!Number.isFinite(circM) || circM <= 0) {
		return null;
	}
	const ratios = samples.map((sample) => {
		const wheelRevPerMin = ((sample.speedKmh * 1000) / 3600 / circM) * 60;
		return wheelRevPerMin > 0 ? sample.rpm / wheelRevPerMin : NaN;
	}).filter((ratio) => Number.isFinite(ratio) && ratio > 0);
	if (ratios.length < MIN_CLUSTER_SAMPLES) {
		return null;
	}
	ratios.sort((a, b) => a - b);
	const clusters: number[][] = [];
	for (const ratio of ratios) {
		const open = clusters[clusters.length - 1];
		const seed = open ? open[open.length - 1] : NaN;
		if (open && Math.abs(ratio - seed) / seed <= CLUSTER_TOLERANCE) {
			open.push(ratio);
		} else {
			clusters.push([ratio]);
		}
	}
	const gears: RecoveredGear[] = [];
	clusters.forEach((cluster) => {
		if (cluster.length < MIN_CLUSTER_SAMPLES) {
			return;
		}
		const sorted = [...cluster].sort((a, b) => a - b);
		const median = sorted[Math.floor(sorted.length / 2)];
		const slipped = cluster.filter((ratio) => Math.abs(ratio - median) / median > SLIP_TOLERANCE).length;
		gears.push({
			gear: 0,
			ratio: Math.round(median * 1000) / 1000,
			samples: cluster.length,
			slipPct: Math.round((slipped / cluster.length) * 1000) / 10,
		});
	});
	if (gears.length === 0) {
		return null;
	}
	gears.sort((a, b) => b.ratio - a.ratio);
	gears.forEach((gear, idx) => {
		gear.gear = idx + 1;
	});
	return gears;
};
