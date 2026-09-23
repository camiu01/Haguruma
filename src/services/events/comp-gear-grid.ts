/**
 * @file comp-gear-grid.ts
 * @brief Per-gear secondary ratio cells synced to the hidden #comp-gears input.
 */
import { parseCompGears } from '../../core/compare/compare-utils';
import type { ElementRefs } from '../dom/element-refs';

/** CSS class of one ratio cell input inside #comp-gear-grid. */
const CELL_CLASS = 'comp-gear-cell-input';

/**
 * Build or refresh visible gear cells from the hidden input value.
 * @brief Keeps the grid aligned after programmatic #comp-gears writes.
 * @param refs Cached DOM handles.
 * @return void
 */
export const syncCompGearCells = (refs: ElementRefs): void => {
	const grid = document.getElementById('comp-gear-grid');
	if (!grid) {
		return;
	}
	const ratios = parseCompGears(refs.compGears.value);
	if (!ratios) {
		return;
	}
	const existing = grid.querySelectorAll<HTMLInputElement>(`.${CELL_CLASS}`);
	if (existing.length !== ratios.length) {
		rebuildGrid(grid, ratios);
		return;
	}
	existing.forEach((cell, idx) => {
		const next = String(ratios[idx]);
		if (cell.value !== next) {
			cell.value = next;
		}
	});
};

/**
 * Wire delegated cell editing and perform the first build.
 * @brief Cell edits rewrite the CSV and re-dispatch input on #comp-gears.
 * @param refs Cached DOM handles.
 * @return void
 */
export const bindCompGearGrid = (refs: ElementRefs): void => {
	const grid = document.getElementById('comp-gear-grid');
	if (!grid) {
		return;
	}
	grid.addEventListener('input', () => {
		const cells = grid.querySelectorAll<HTMLInputElement>(`.${CELL_CLASS}`);
		const raw = Array.from(cells)
			.map((cell) => cell.value)
			.join(', ');
		refs.compGears.value = raw;
		refs.compGears.dispatchEvent(new Event('input', { bubbles: true }));
	});
	syncCompGearCells(refs);
};

/**
 * Replace grid children with one cell per ratio.
 * @brief Used when the ratio count changes (copy, preset, restore).
 * @param grid Grid container element.
 * @param ratios Parsed secondary ratios.
 * @return void
 */
const rebuildGrid = (grid: HTMLElement, ratios: number[]): void => {
	grid.innerHTML = '';
	ratios.forEach((ratio, idx) => {
		const cell = document.createElement('div');
		cell.className = 'comp-gear-cell';
		const label = document.createElement('label');
		label.className = 'comp-gear-cell-label';
		label.htmlFor = `comp-gear-cell-${idx}`;
		label.textContent = `G${idx + 1}`;
		const input = document.createElement('input');
		input.type = 'number';
		input.inputMode = 'decimal';
		input.step = '0.01';
		input.min = '0.4';
		input.max = '6.0';
		input.id = `comp-gear-cell-${idx}`;
		input.className = CELL_CLASS;
		input.value = String(ratio);
		cell.append(label, input);
		grid.appendChild(cell);
	});
};
