/**
 * @file drivetrain-export.ts
 * @brief Sim-racing drivetrain exchange (Assetto Corsa .ini + generic JSON).
 */
export interface DrivetrainExportInput {
	/** Forward gear ratios from first to top gear. */
	gears: number[];
	/** Final drive ratio. */
	fd: number;
	/** Reverse ratio, omitted when null. */
	reverseRatio: number | null;
	/** Vehicle label used in comments. */
	label: string;
}

/** Parsed drivetrain from an .ini or JSON payload. */
export interface ParsedDrivetrain {
	/** Forward gear ratios sorted by gear number. */
	gears: number[];
	/** Final drive ratio. */
	fd: number;
	/** Reverse ratio, null when absent. */
	reverseRatio: number | null;
}

/**
 * @brief Format a ratio with three decimals for .ini output.
 * @param v Ratio value.
 * @return Fixed-point string.
 */
const fmt = (v: number): string => {
	return v.toFixed(3);
};

/**
 * @brief Build an Assetto Corsa drivetrain.ini payload.
 * @param input Gears, final drive and optional reverse.
 * @return INI text with [GEARS] section.
 */
export const buildAssettoCorsaIni = (input: DrivetrainExportInput): string => {
	const lines: string[] = ['; Haguruma drivetrain export', `; ${input.label}`, '[GEARS]'];
	input.gears.forEach((g, i) => {
		lines.push(`GEAR_${i + 1}=${fmt(g)}`);
	});
	lines.push(`FINAL=${fmt(input.fd)}`);
	if (input.reverseRatio !== null && input.reverseRatio > 0) {
		lines.push(`REVERSE=${fmt(input.reverseRatio)}`);
	}
	lines.push('COUNT=' + String(input.gears.length));
	return lines.join('\n') + '\n';
};

/**
 * @brief Build a generic JSON drivetrain payload.
 * @param input Gears, final drive and optional reverse.
 * @return Pretty-printed JSON string.
 */
export const buildDrivetrainJson = (input: DrivetrainExportInput): string => {
	return JSON.stringify(
		{
			label: input.label,
			gears: input.gears,
			finalDrive: input.fd,
			reverseRatio: input.reverseRatio,
			exporter: 'haguruma',
		},
		null,
		2,
	);
};

/**
 * @brief Trigger a browser download of a text payload.
 * @param text File content.
 * @param filename Download file name.
 * @param mime MIME type.
 * @return void
 */
export const downloadTextFile = (text: string, filename: string, mime: string): void => {
	const blob = new Blob([text], { type: mime });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
};

/**
 * @brief Parse one INI line into a key/value pair.
 * @param line Raw file line.
 * @return Tuple or null for comments, sections and blanks.
 */
const parseIniLine = (line: string): [string, string] | null => {
	const clean = line.trim();
	if (!clean || clean.startsWith(';') || clean.startsWith('#') || clean.startsWith('[')) {
		return null;
	}
	const cut = clean.search(/[;#]/);
	const body = (cut >= 0 ? clean.slice(0, cut) : clean).trim();
	const eq = body.indexOf('=');
	if (eq <= 0) {
		return null;
	}
	return [body.slice(0, eq).trim().toUpperCase(), body.slice(eq + 1).trim()];
};

/**
 * @brief Check a parsed ratio against its physical range.
 * @param v Candidate ratio.
 * @param min Lower bound.
 * @param max Upper bound.
 * @return True when finite and inside range.
 */
const inRange = (v: number, min: number, max: number): boolean => {
	return Number.isFinite(v) && v >= min && v <= max;
};

/**
 * @brief Parse an Assetto Corsa drivetrain.ini payload.
 * @brief Reads GEAR_n / FINAL / REVERSE keys, ignores sections and comments.
 * @param text Full .ini file contents.
 * @return Parsed gears, or null when required keys are missing or invalid.
 */
export const parseAssettoCorsaIni = (text: string): ParsedDrivetrain | null => {
	if (!text) {
		return null;
	}
	const gearByIndex = new Map<number, number>();
	let fd = Number.NaN;
	let reverse: number | null = null;
	for (const line of text.split(/\r?\n/)) {
		const pair = parseIniLine(line);
		if (!pair) {
			continue;
		}
		const [key, raw] = pair;
		const value = Number(raw);
		if (key === 'FINAL' && inRange(value, 1.0, 10.0)) {
			fd = value;
		} else if (key === 'REVERSE' && inRange(value, 1.0, 6.0)) {
			reverse = value;
		} else if (key.startsWith('GEAR_')) {
			const idx = Number(key.slice(5));
			if (Number.isInteger(idx) && idx >= 1 && idx <= 12 && inRange(value, 0.4, 6.0)) {
				gearByIndex.set(idx, value);
			}
		}
	}
	if (!inRange(fd, 1.0, 10.0) || gearByIndex.size === 0) {
		return null;
	}
	const gears = [...gearByIndex.entries()].sort((a, b) => a[0] - b[0]).map(([, g]) => g);
	return { gears, fd, reverseRatio: reverse };
};
