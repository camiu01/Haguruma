import { state } from '../core/state/app-state';
import { GRAPH_LIMITS } from '../config/graph-constants';
import { getGearColor } from '../config/gear-colors';
import { t } from '../core/i18n/language';
import type { ElementRefs } from '../services/dom/element-refs';

/**
 * Render editable gear ratio rows.
 * @purpose Rebuild the left-panel gear list after every structural change.
 * @param refs Cached DOM handles.
 * @param onChange Callback invoked after any ratio edit or removal.
 */
export const renderGearsList = (refs: ElementRefs, onChange: (redrawInputs: boolean) => void): void => {
	refs.gearsContainer.innerHTML = '';
	state.gears.forEach((ratio, idx) => {
		refs.gearsContainer.appendChild(buildGearRow(refs, idx, ratio, onChange));
	});
	refs.gearsContainer.appendChild(buildReverseRow());
	bindGearInputs(refs, onChange);
	bindRemoveButtons(refs, onChange);
	bindReverseInput(refs, onChange);
	updateAddButton(refs);
};

/**
 * Enable or disable the Add Gear button at the palette limit.
 * @brief Keep the 8-gear cap visible instead of silently ignoring clicks.
 * @param refs Cached DOM handles.
 * @return void
 */
const updateAddButton = (refs: ElementRefs): void => {
	const atMax = state.gears.length >= GRAPH_LIMITS.maxGears;
	refs.btnAddGear.disabled = atMax;
	refs.btnAddGear.classList.toggle('opacity-40', atMax);
	refs.btnAddGear.classList.toggle('pointer-events-none', atMax);
	refs.btnAddGear.title = atMax
		? `${GRAPH_LIMITS.maxGears} ${t('gear.maxReached')}`
		: t('gears.add');
};

/**
 * Build one gear row element.
 * @purpose Isolate DOM templating from event wiring.
 */
const buildGearRow = (
	refs: ElementRefs,
	idx: number,
	ratio: number,
	onChange: (redrawInputs: boolean) => void,
): HTMLElement => {
	const color = getGearColor(idx);
	const glowClass = `gear-glow-${(idx % 8) + 1}`;
	const row = document.createElement('div');
	row.className = 'flex items-center gap-2 bg-surface-row border border-surface-border hover:border-input px-2 py-1.5 rounded-lg transition-colors';
	const removable = state.gears.length > 1 ? buildRemoveButton(idx) : '';
	row.innerHTML = `<span class='w-2.5 h-2.5 rounded-full flex-shrink-0 ${glowClass}' style='background-color: ${color}'></span><span class='gear-label text-xs font-medium text-text-dim font-mono w-16'>${t('gear.prefix')} ${idx + 1}</span><input type='number' inputmode='decimal' step='0.01' min='0.4' max='6.0' value='${ratio}' data-index='${idx}' class='gear-input flex-1 bg-surface-input border border-surface-border rounded px-2.5 py-1 text-xs font-mono font-bold text-text-output text-right focus:border-text-dim outline-none' /><span class='text-text-muted font-mono text-xs flex-shrink-0'>: 1</span>${removable}`;
	void refs;
	void onChange;
	return row;
};

/**
 * Build the reverse-gear editor row.
 * @brief Optional R ratio with a dedicated gray marker.
 * @return Reverse row element bound to state on rebuild.
 */
const buildReverseRow = (): HTMLElement => {
	const row = document.createElement('div');
	row.className = 'flex items-center gap-2 bg-surface-row border border-dashed border-surface-border px-2 py-1.5 rounded-lg';
	const value = state.reverseRatio === null ? '' : String(state.reverseRatio);
	row.innerHTML = `<span class='w-2.5 h-2.5 rounded-full flex-shrink-0 bg-text-muted'></span><span class='gear-label text-xs font-medium text-text-dim font-mono w-16'>${t('gear.reverse')}</span><input type='number' inputmode='decimal' step='0.01' min='1.0' max='6.0' value='${value}' placeholder='opt.' class='reverse-input flex-1 bg-surface-input border border-surface-border rounded px-2.5 py-1 text-xs font-mono font-bold text-text-output text-right focus:border-text-dim outline-none' /><span class='text-text-muted font-mono text-xs flex-shrink-0'>: 1</span>`;
	return row;
};

/**
 * Wire the reverse input to state.
 * @brief Empty value clears the reverse gear entirely.
 * @param refs Cached DOM handles.
 * @param onChange Refresh callback without input rebuild.
 * @return void
 */
const bindReverseInput = (refs: ElementRefs, onChange: (redrawInputs: boolean) => void): void => {
	const inp = refs.gearsContainer.querySelector('.reverse-input') as HTMLInputElement | null;
	if (!inp) {
		return;
	}
	inp.addEventListener('input', (e) => {
		const raw = (e.target as HTMLInputElement).value.trim();
		if (raw === '') {
			state.reverseRatio = null;
			onChange(false);
			return;
		}
		const v = parseFloat(raw);
		if (v > 0) {
			state.reverseRatio = v;
			onChange(false);
		}
	});
};
/**
 * Build the remove-gear button markup.
 * @brief Keep the row template readable.
 * @param idx Zero-based gear index.
 * @return Button HTML string.
 */
const buildRemoveButton = (idx: number): string => {
	return `<button type='button' class='btn-remove-gear text-text-muted hover:text-neon-red px-1.5 text-xs transition rounded hover:bg-surface-subtle' data-index='${idx}' title='Remove gear' aria-label='Remove gear ${idx + 1}'><svg class='w-3.5 h-3.5' fill='none' stroke='currentColor' viewBox='0 0 24 24' aria-hidden='true'><path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M6 18L18 6M6 6l12 12'/></svg></button>`;
};

/**
 * Wire ratio inputs to state.
 * @purpose Update state live while typing without rebuilding inputs.
 */
const bindGearInputs = (refs: ElementRefs, onChange: (redrawInputs: boolean) => void): void => {
	refs.gearsContainer.querySelectorAll('.gear-input').forEach((inp) => {
		inp.addEventListener('input', (e) => {
			const target = e.target as HTMLInputElement;
			const i = parseInt(target.dataset.index || '0', 10);
			const v = parseFloat(target.value);
			if (v > 0) {
				state.gears[i] = v;
				onChange(false);
			}
		});
	});
};

/**
 * Wire remove buttons to state.
 * @purpose Delete a gear and trigger a full refresh.
 */
const bindRemoveButtons = (refs: ElementRefs, onChange: (redrawInputs: boolean) => void): void => {
	refs.gearsContainer.querySelectorAll('.btn-remove-gear').forEach((btn) => {
		btn.addEventListener('click', (e) => {
			const targetBtn = (e.target as HTMLElement).closest('.btn-remove-gear') as HTMLElement;
			const i = parseInt(targetBtn.dataset.index || '0', 10);
			state.gears.splice(i, 1);
			renderGearsList(refs, onChange);
			onChange(true);
		});
	});
};

/**
 * Append a new gear derived from the previous ratio.
 * @purpose Offer a sensible default shorter ratio.
 * @param refs Cached DOM handles.
 * @param onChange Refresh callback.
 */
export const addGear = (refs: ElementRefs, onChange: (redrawInputs: boolean) => void): void => {
	if (state.gears.length >= GRAPH_LIMITS.maxGears) {
		return;
	}
	const lastRatio = state.gears[state.gears.length - 1] || 1.0;
	const nextRatio = Math.max(0.5, +(lastRatio * 0.82).toFixed(2));
	state.gears.push(nextRatio);
	renderGearsList(refs, onChange);
	onChange(true);
};
