/**
 * @file session-store.ts
 * @brief Local session-run log with MoTeC/AiM friendly exports.
 * @brief Runs are recorded from solver KPIs or phone-timer splits, kept in a
 * @brief versioned localStorage envelope and exported as CSV or JSON. The CSV
 * @brief layout mirrors the drivetrain-export tables so AiM Race Studio and
 * @brief MoTeC i2 pick the columns up without remapping.
 */

/** One logged session run. */
export interface SessionRun {
	/** Stable run id. */
	id: string;
	/** ISO timestamp of the recording. */
	dateISO: string;
	/** Display name typed by the user. */
	name: string;
	/** Preset active when the run was recorded. */
	presetName: string;
	/** 0-100 km/h time in seconds, null when unknown. */
	time0To100S: number | null;
	/** Quarter-mile time in seconds, null when unknown. */
	quarterS: number | null;
	/** Trap speed in km/h, null when unknown. */
	trapKmh: number | null;
	/** Free note typed by the user. */
	note: string;
}

/** Storage key for the session envelope. */
const SESSION_KEY = 'haguruma-sessions';

/** Envelope version for the session log. */
const SESSION_VERSION = 1;

/**
 * @brief Check for browser storage (false under vitest node environment).
 * @return True when localStorage may be touched.
 */
const hasStorage = (): boolean => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

/**
 * @brief Type-guard one stored value as a session run.
 * @param value Unknown parsed JSON value.
 * @return True when the value carries the required run fields.
 */
const isRun = (value: unknown): value is SessionRun => {
	if (typeof value !== 'object' || value === null) {
		return false;
	}
	const run = value as Record<string, unknown>;
	return typeof run.id === 'string' && typeof run.dateISO === 'string' && typeof run.name === 'string';
};

/**
 * @brief Load logged session runs from storage.
 * @return Runs newest-last, empty when storage is missing or corrupt.
 */
export const loadSessions = (): SessionRun[] => {
	if (!hasStorage()) {
		return [];
	}
	try {
		const raw = window.localStorage.getItem(SESSION_KEY);
		if (!raw) {
			return [];
		}
		const parsed = JSON.parse(raw) as { schemaVersion?: unknown; runs?: unknown };
		if (parsed.schemaVersion !== SESSION_VERSION || !Array.isArray(parsed.runs)) {
			return [];
		}
		return parsed.runs.filter(isRun);
	} catch {
		return [];
	}
};

/**
 * @brief Persist the full session run list.
 * @param runs Runs to store.
 * @return void
 */
const storeSessions = (runs: SessionRun[]): void => {
	if (!hasStorage()) {
		return;
	}
	try {
		window.localStorage.setItem(SESSION_KEY, JSON.stringify({ schemaVersion: SESSION_VERSION, runs }));
	} catch {
		return;
	}
};

/**
 * @brief Append one session run to the log.
 * @param run Run without id and timestamp.
 * @return Stored run with id and timestamp assigned.
 */
export const saveSession = (run: Omit<SessionRun, 'id' | 'dateISO'>): SessionRun => {
	const stored: SessionRun = {
		...run,
		id: `run-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`,
		dateISO: new Date().toISOString(),
	};
	storeSessions([...loadSessions(), stored]);
	return stored;
};

/**
 * @brief Delete one session run by id.
 * @param id Run id.
 * @return Remaining runs.
 */
export const deleteSession = (id: string): SessionRun[] => {
	const kept = loadSessions().filter((run) => run.id !== id);
	storeSessions(kept);
	return kept;
};

/**
 * @brief Format one nullable number for the CSV export.
 * @param value Value in seconds or km/h.
 * @return Two-decimal text, empty when null.
 */
const csvNum = (value: number | null): string => {
	return value === null || !Number.isFinite(value) ? '' : value.toFixed(2);
};

/**
 * @brief Export session runs as CSV for MoTeC / AiM tooling.
 * @param runs Runs to export.
 * @return CSV text with a header row.
 */
export const sessionsToCsv = (runs: SessionRun[]): string => {
	const rows = runs.map((run) => [
		run.dateISO,
		`"${run.name.replace(/"/g, '""')}"`,
		`"${run.presetName.replace(/"/g, '""')}"`,
		csvNum(run.time0To100S),
		csvNum(run.quarterS),
		csvNum(run.trapKmh),
		`"${run.note.replace(/"/g, '""')}"`,
	].join(','));
	return ['date_iso,name,preset,time_0_100_s,quarter_s,trap_kmh,note', ...rows].join('\n');
};

/**
 * @brief Export session runs as JSON.
 * @param runs Runs to export.
 * @return Versioned JSON envelope text.
 */
export const sessionsToJson = (runs: SessionRun[]): string => {
	return JSON.stringify({ schemaVersion: SESSION_VERSION, runs }, null, 2);
};
