/**
 * @file setup-history.test.ts
 * @brief Undo/redo stacks: dedupe, branch reset, bound and empty-stack behaviour.
 */
import { describe, expect, it } from 'vitest';
import { createHistory, HISTORY_LIMIT, recordSnapshot, redoSnapshot, undoSnapshot } from '../src/core/state/setup-history';

describe('setup-history', () => {
	it('treats the first snapshot as the baseline, not an undo step', () => {
		const h = createHistory();
		expect(recordSnapshot(h, 'a')).toBe(false);
		expect(undoSnapshot(h)).toBeNull();
	});

	it('ignores identical consecutive snapshots', () => {
		const h = createHistory();
		recordSnapshot(h, 'a');
		expect(recordSnapshot(h, 'a')).toBe(false);
		expect(h.past).toEqual([]);
	});

	it('undoes and redoes in order', () => {
		const h = createHistory();
		['a', 'b', 'c'].forEach((s) => recordSnapshot(h, s));
		expect(undoSnapshot(h)).toBe('b');
		expect(undoSnapshot(h)).toBe('a');
		expect(undoSnapshot(h)).toBeNull();
		expect(redoSnapshot(h)).toBe('b');
		expect(redoSnapshot(h)).toBe('c');
		expect(redoSnapshot(h)).toBeNull();
	});

	it('drops the redo branch on a new edit', () => {
		const h = createHistory();
		['a', 'b'].forEach((s) => recordSnapshot(h, s));
		undoSnapshot(h);
		recordSnapshot(h, 'x');
		expect(redoSnapshot(h)).toBeNull();
		expect(undoSnapshot(h)).toBe('a');
	});

	it('keeps at most HISTORY_LIMIT undo steps', () => {
		const h = createHistory();
		for (let i = 0; i <= HISTORY_LIMIT + 10; i += 1) {
			recordSnapshot(h, String(i));
		}
		expect(h.past).toHaveLength(HISTORY_LIMIT);
		expect(h.past[0]).toBe('10');
	});
});
