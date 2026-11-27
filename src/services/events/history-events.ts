/**
 * @file history-events.ts
 * @brief Undo/redo of setup edits: header buttons plus Ctrl/Cmd+Z, Ctrl+Y and Ctrl/Cmd+Shift+Z.
 *
 * Every full render schedules a snapshot (debounced, so dragging a stepper or
 * typing a ratio is one step). Snapshots use the share codec without the zoom
 * window, so panning the plot never fills the history.
 */
import { state } from '../../core/state/app-state';
import { encodeState } from '../../core/share/share-utils';
import { createHistory, recordSnapshot, redoSnapshot, undoSnapshot } from '../../core/state/setup-history';
import type { ElementRefs } from '../dom/element-refs';
import { applyHashState } from './share-events';

/** Quiet time before an edit becomes an undo step, in ms. */
const SETTLE_MS = 400;

/** Session undo/redo stacks. */
const history = createHistory();

/** Pending snapshot timer, 0 while idle. */
let timer = 0;

/** True while a snapshot is being applied, so its own render is not recorded. */
let restoring = false;

/**
 * @brief Encode the current setup without view-only state.
 * @return Snapshot string.
 */
const snapshot = (): string => encodeState({ ...state, graphWindow: null });

/**
 * @brief Enable or disable the header buttons to match the stacks.
 * @return void
 */
const syncButtons = (): void => {
	const undo = document.getElementById('btn-undo') as HTMLButtonElement | null;
	const redo = document.getElementById('btn-redo') as HTMLButtonElement | null;
	if (undo) {
		undo.disabled = history.past.length === 0;
	}
	if (redo) {
		redo.disabled = history.future.length === 0;
	}
};

/**
 * @brief Schedule a snapshot after the current burst of edits settles.
 * @brief Called at the end of every full render; a no-op while restoring.
 * @return void
 */
export const scheduleHistorySnapshot = (): void => {
	if (restoring || typeof window === 'undefined') {
		return;
	}
	window.clearTimeout(timer);
	timer = window.setTimeout(() => {
		recordSnapshot(history, snapshot());
		syncButtons();
	}, SETTLE_MS);
};

/**
 * @brief Restore one snapshot from the history.
 * @param refs Cached DOM handles.
 * @param render Full refresh callback.
 * @param target Snapshot to apply, null when the stack was empty.
 * @return void
 */
const restore = (refs: ElementRefs, render: () => void, target: string | null): void => {
	if (target === null) {
		return;
	}
	window.clearTimeout(timer);
	restoring = true;
	applyHashState(refs, render, target);
	render();
	restoring = false;
	syncButtons();
};

/**
 * @brief Decide whether a key event belongs to a text field's own undo.
 * @param event Keyboard event.
 * @return True when focus is in an editable field.
 */
const inTextField = (event: KeyboardEvent): boolean => {
	const el = event.target as HTMLElement | null;
	return !!el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));
};

/**
 * @brief Bind the undo/redo buttons and keyboard shortcuts.
 * @param refs Cached DOM handles.
 * @param render Full refresh callback.
 * @return void
 */
export const bindHistoryEvents = (refs: ElementRefs, render: () => void): void => {
	const undo = (): void => restore(refs, render, undoSnapshot(history));
	const redo = (): void => restore(refs, render, redoSnapshot(history));
	document.getElementById('btn-undo')?.addEventListener('click', undo);
	document.getElementById('btn-redo')?.addEventListener('click', redo);
	document.addEventListener('keydown', (event) => {
		if (!(event.ctrlKey || event.metaKey) || event.altKey || inTextField(event)) {
			return;
		}
		const key = event.key.toLowerCase();
		if (key === 'z' && !event.shiftKey) {
			event.preventDefault();
			undo();
		} else if (key === 'y' || (key === 'z' && event.shiftKey)) {
			event.preventDefault();
			redo();
		}
	});
	recordSnapshot(history, snapshot());
	syncButtons();
};
