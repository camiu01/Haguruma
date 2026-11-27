/**
 * @file setup-history.ts
 * @brief Bounded undo/redo stacks of encoded setup snapshots (no DOM).
 *
 * Snapshots are share-hash strings, so the history reuses the validated share
 * codec instead of deep-copying state by hand.
 */

/** Maximum undo steps kept. */
export const HISTORY_LIMIT = 50;

/** Undo/redo stacks around the current snapshot. */
export interface SetupHistory {
	past: string[];
	present: string | null;
	future: string[];
}

/**
 * @brief Create an empty history.
 * @return History with no snapshot yet.
 */
export const createHistory = (): SetupHistory => ({ past: [], present: null, future: [] });

/**
 * @brief Record a snapshot; identical consecutive snapshots are ignored.
 * @param h History to update in place.
 * @param snapshot Encoded setup.
 * @return True when a new undo step was created.
 */
export const recordSnapshot = (h: SetupHistory, snapshot: string): boolean => {
	if (snapshot === h.present) {
		return false;
	}
	if (h.present === null) {
		h.present = snapshot;
		return false;
	}
	h.past.push(h.present);
	if (h.past.length > HISTORY_LIMIT) {
		h.past.shift();
	}
	h.present = snapshot;
	h.future = [];
	return true;
};

/**
 * @brief Step back one snapshot.
 * @param h History to update in place.
 * @return Snapshot to restore, null when there is nothing to undo.
 */
export const undoSnapshot = (h: SetupHistory): string | null => {
	const prev = h.past.pop();
	if (prev === undefined || h.present === null) {
		return null;
	}
	h.future.push(h.present);
	h.present = prev;
	return prev;
};

/**
 * @brief Step forward one snapshot.
 * @param h History to update in place.
 * @return Snapshot to restore, null when there is nothing to redo.
 */
export const redoSnapshot = (h: SetupHistory): string | null => {
	const next = h.future.pop();
	if (next === undefined || h.present === null) {
		return null;
	}
	h.past.push(h.present);
	h.present = next;
	return next;
};
