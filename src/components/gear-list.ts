/**
 * @file gear-list.ts
 * @brief Prefix-parameterized per-gear ratio rows for primary and comparison setups.
 */
import { state } from '../core/state/app-state';
import { GRAPH_LIMITS } from '../config/graph-constants';
import { getGearColor } from '../config/gear-colors';
import { t } from '../core/i18n/language';
import { formatCompGears } from '../core/compare/compare-utils';
import type { ElementRefs } from '../services/dom/element-refs';

/** Setup slot owning a gear stack. */
type StackKind = 'primary' | 'compare';

/** Micro-stepper increment applied by the +/- row buttons. */
const MICRO_STEP = 0.005;

/** Classes of one micro-stepper button. */
const MICRO_BTN = 'gear-step-btn w-6 h-6 rounded bg-surface-subtle hover:bg-input font-mono text-[0.75rem] text-text-output flex items-center justify-center';

/** SVG markup of the remove-gear button icon. */
const REMOVE_ICON = `<svg class='w-3.5 h-3.5' fill='none' stroke='currentColor' viewBox='0 0 24 24' aria-hidden='true'><path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M6 18L18 6M6 6l12 12'/></svg>`;

/** Per-kind binding of one gear stack to its DOM and state slots. */
interface StackBinding {
	/** Container element receiving the rows, null when the mount is absent. */
	container: HTMLElement | null;
	/** Live ratio array owned by the stack. */
	gears: number[];
	/** Final drive used for the total-ratio readout. */
	fd: number;
	/** Class marking ratio inputs inside the stack. */
	inputClass: string;
	/** Class marking remove buttons inside the stack. */
	removeClass: string;
}

/** Change callback that skips the refresh, used for internal rebuilds mid-render. */
const noopOnChange = (): void => undefined;

/**
 * @brief Resolve the DOM and state binding of one gear stack.
 * @param kind Setup slot owning the stack.
 * @param refs Cached DOM handles.
 * @return Stack binding with a live reference to the slot's ratio array.
 */
const resolveStack = (kind: StackKind, refs: ElementRefs): StackBinding => ({
	container: kind === 'primary' ? refs.gearsContainer : document.getElementById('comp-gears-container'),
	gears: kind === 'primary' ? state.gears : state.compGears,
	fd: kind === 'primary' ? state.primaryFd : state.compFd,
	inputClass: kind === 'primary' ? 'gear-input' : 'comp-gear-input',
	removeClass: kind === 'primary' ? 'btn-remove-gear' : 'btn-remove-comp-gear',
});

/**
 * Render editable primary gear ratio rows plus the reverse editor.
 * @brief Rebuild the left-panel gear list after every structural change.
 * @param refs Cached DOM handles.
 * @param onChange Callback invoked after any ratio edit or removal.
 */
export const renderGearsList = (refs: ElementRefs, onChange: (redrawInputs: boolean) => void): void => {
	renderStack('primary', refs, onChange);
	refs.gearsContainer.appendChild(buildReverseRow());
	bindReverseInput(refs, onChange);
	updateAddButton('primary', refs);
};

/**
 * @brief Render editable comparison gear ratio rows.
 * @brief Rebuilds the secondary stack and mirrors it into the hidden CSV input.
 * @param refs Cached DOM handles.
 * @param onChange Callback invoked after any ratio edit or removal.
 * @return void
 */
export const renderCompareGearsList = (refs: ElementRefs, onChange: (redrawInputs: boolean) => void): void => {
	renderStack('compare', refs, onChange);
	refs.compGears.value = formatCompGears(state.compGears);
	updateAddButton('compare', refs);
};

/**
 * @brief Rebuild all rows of one stack and rewire their events.
 * @param kind Setup slot owning the stack.
 * @param refs Cached DOM handles.
 * @param onChange Callback invoked after any ratio edit or removal.
 * @return void
 */
const renderStack = (kind: StackKind, refs: ElementRefs, onChange: (redrawInputs: boolean) => void): void => {
	const binding = resolveStack(kind, refs);
	const { container } = binding;
	if (!container) {
		return;
	}
	container.replaceChildren();
	binding.gears.forEach((ratio, idx) => {
		container.appendChild(buildGearRow(binding, idx, ratio));
	});
	bindRowInputs(binding, refs, onChange);
	bindStepButtons(binding, refs, onChange);
	bindRemoveButtons(binding, refs, onChange);
};

/**
 * @brief Build one gear row element from the compact workbench template.
 * @param binding Stack binding supplying classes and the live ratio array.
 * @param idx Zero-based gear index.
 * @param ratio Gear ratio.
 * @return Row element with badge, input, total readout, steppers and remove.
 */
const buildGearRow = (binding: StackBinding, idx: number, ratio: number): HTMLElement => {
	const row = document.createElement('div');
	row.className = 'flex items-center gap-1.5 bg-surface-recessed px-2 py-1 rounded border border-border-hairline';
	row.innerHTML = gearRowHtml(binding, idx, ratio);
	return row;
};

/**
 * @brief Build the inner markup of one gear row.
 * @param binding Stack binding supplying classes and the live ratio array.
 * @param idx Zero-based gear index.
 * @param ratio Gear ratio.
 * @return Row markup string, remove button only while more than one gear exists.
 */
const gearRowHtml = (binding: StackBinding, idx: number, ratio: number): string => {
	const color = getGearColor(idx);
	const removable = binding.gears.length > 1 ? removeButtonHtml(binding, idx) : '';
	return (
		`<span class='w-1.5 h-4 rounded-sm' style='background-color: ${color}'></span>` +
		`<span class='w-5 text-center font-mono text-[0.625rem] font-bold' style='color: ${color}' title='${t('gear.prefix')} ${idx + 1}'>G${idx + 1}</span>` +
		`<input type='number' inputmode='decimal' step='0.001' min='${GRAPH_LIMITS.minGearRatio}' max='${GRAPH_LIMITS.maxGearRatio}' value='${ratio}' data-index='${idx}' aria-label='${t('gear.prefix')} ${idx + 1}' class='${binding.inputClass} w-16 bg-transparent text-right font-mono text-[0.8125rem] font-semibold text-text-output outline-none' />` +
		`<span class='font-mono text-[0.625rem] text-text-muted'>:1</span>` +
		`<span class='ml-auto whitespace-nowrap font-mono text-[0.625rem] text-text-dim' data-tot-index='${idx}'>${formatTot(binding, ratio)}</span>` +
		`<button type='button' class='${MICRO_BTN}' data-index='${idx}' data-direction='-1'>-</button>` +
		`<button type='button' class='${MICRO_BTN}' data-index='${idx}' data-direction='1'>+</button>` +
		removable
	);
};

/**
 * @brief Build the remove-gear button markup of one row.
 * @param binding Stack binding supplying the slot-specific remove class.
 * @param idx Zero-based gear index.
 * @return Button HTML string with the row index dataset.
 */
const removeButtonHtml = (binding: StackBinding, idx: number): string => {
	return `<button type='button' class='${binding.removeClass} flex items-center justify-center rounded text-text-muted hover:text-neon-red hover:bg-surface-subtle transition' data-index='${idx}' title='Remove gear' aria-label='Remove gear ${idx + 1}'>${REMOVE_ICON}</button>`;
};

/**
 * @brief Format the total-ratio readout of one row.
 * @param binding Stack binding supplying the final drive.
 * @param ratio Gear ratio.
 * @return Overall label such as 'Tot: 14.68:1', dashes when the FD is invalid.
 */
const formatTot = (binding: StackBinding, ratio: number): string => {
	const overall = binding.fd > 0 ? (ratio * binding.fd).toFixed(2) : '—';
	return `${t('setupctl.overall')}: ${overall}:1`;
};

/**
 * @brief Apply one micro-stepper increment to a gear ratio.
 * @param ratio Current ratio.
 * @param direction -1 or 1.
 * @return Clamped ratio rounded to 3 decimals.
 */
export const stepRatio = (ratio: number, direction: number): number => {
	const next = clamp(ratio + direction * MICRO_STEP, GRAPH_LIMITS.minGearRatio, GRAPH_LIMITS.maxGearRatio);
	return Number(next.toFixed(3));
};

/**
 * @brief Decide whether the comparison stack DOM must be rebuilt.
 * @param current Values currently shown by the stack inputs, null when unparsable.
 * @param gears Live secondary ratios from state.
 * @return True when the count changed or any displayed value drifted.
 */
export const compStackDrifted = (current: (number | null)[], gears: number[]): boolean => {
	if (current.length !== gears.length) {
		return true;
	}
	return current.some((value, idx) => value === null || value !== gears[idx]);
};

/**
 * Cheap refresh path for the comparison stack, called from renderAll.
 * @brief Rebuilds when the ratio count changed or values drifted, else only
 * @brief updates the total readouts; always mirrors state into the CSV input.
 * @param refs Cached DOM handles.
 * @return void
 */
export const syncCompGearStack = (refs: ElementRefs): void => {
	const container = document.getElementById('comp-gears-container');
	if (!container) {
		return;
	}
	refs.compGears.value = formatCompGears(state.compGears);
	const inputs = Array.from(container.querySelectorAll<HTMLInputElement>('.comp-gear-input'));
	const current = inputs.map((input) => {
		const v = parseFloat(input.value);
		return Number.isFinite(v) ? v : null;
	});
	if (compStackDrifted(current, state.compGears)) {
		renderCompareGearsList(refs, noopOnChange);
		return;
	}
	const binding = resolveStack('compare', refs);
	container.querySelectorAll<HTMLElement>('[data-tot-index]').forEach((label) => {
		const ratio = binding.gears[parseInt(label.dataset.totIndex || '0', 10)];
		if (ratio !== undefined) {
			label.textContent = formatTot(binding, ratio);
		}
	});
	updateAddButton('compare', refs);
};

/**
 * @brief Wire ratio inputs to state, mirroring compare edits into the CSV.
 * @param binding Stack binding supplying classes and the live ratio array.
 * @param refs Cached DOM handles.
 * @param onChange Refresh callback without input rebuild.
 * @return void
 */
const bindRowInputs = (binding: StackBinding, refs: ElementRefs, onChange: (redrawInputs: boolean) => void): void => {
	binding.container?.querySelectorAll<HTMLInputElement>(`.${binding.inputClass}`).forEach((input) => {
		input.addEventListener('input', (e) => {
			const target = e.target as HTMLInputElement;
			const idx = parseInt(target.dataset.index || '0', 10);
			const v = parseFloat(target.value);
			if (v > 0) {
				binding.gears[idx] = v;
				if (binding.inputClass === 'comp-gear-input') {
					refs.compGears.value = formatCompGears(state.compGears);
				}
				onChange(false);
			}
		});
	});
};

/**
 * @brief Wire micro-stepper buttons to state, compare stacks also mirror the CSV.
 * @param binding Stack binding supplying classes and the live ratio array.
 * @param refs Cached DOM handles.
 * @param onChange Refresh callback without input rebuild.
 * @return void
 */
const bindStepButtons = (binding: StackBinding, refs: ElementRefs, onChange: (redrawInputs: boolean) => void): void => {
	binding.container?.querySelectorAll<HTMLButtonElement>('.gear-step-btn').forEach((btn) => {
		btn.addEventListener('click', () => {
			const idx = parseInt(btn.dataset.index || '0', 10);
			const direction = Number(btn.dataset.direction);
			if (!Number.isFinite(direction) || direction === 0) {
				return;
			}
			binding.gears[idx] = stepRatio(binding.gears[idx], direction);
			const input = binding.container?.querySelector<HTMLInputElement>(`.${binding.inputClass}[data-index='${idx}']`);
			if (input) {
				input.value = String(binding.gears[idx]);
			}
			if (binding.inputClass === 'comp-gear-input') {
				refs.compGears.value = formatCompGears(state.compGears);
			}
			onChange(false);
		});
	});
};

/**
 * @brief Wire remove buttons to state, splice then fully re-render the stack.
 * @brief The remove button is only rendered while more than one gear exists,
 * @brief so the one-gear minimum is enforced by construction.
 * @param binding Stack binding supplying classes and the live ratio array.
 * @param refs Cached DOM handles.
 * @param onChange Refresh callback with input rebuild.
 * @return void
 */
const bindRemoveButtons = (binding: StackBinding, refs: ElementRefs, onChange: (redrawInputs: boolean) => void): void => {
	binding.container?.querySelectorAll<HTMLButtonElement>(`.${binding.removeClass}`).forEach((btn) => {
		btn.addEventListener('click', () => {
			const idx = parseInt(btn.dataset.index || '0', 10);
			binding.gears.splice(idx, 1);
			if (binding.removeClass === 'btn-remove-comp-gear') {
				renderCompareGearsList(refs, onChange);
			} else {
				renderGearsList(refs, onChange);
			}
			onChange(true);
		});
	});
};

/**
 * @brief Enable or disable one Add Gear button at the palette limit.
 * @brief Keep the 8-gear cap visible instead of silently ignoring clicks.
 * @param kind Setup slot owning the button.
 * @param refs Cached DOM handles.
 * @return void
 */
const updateAddButton = (kind: StackKind, refs: ElementRefs): void => {
	const btn = kind === 'primary' ? refs.btnAddGear : (document.getElementById('comp-btn-add-gear') as HTMLButtonElement | null);
	if (!btn) {
		return;
	}
	const atMax = (kind === 'primary' ? state.gears : state.compGears).length >= GRAPH_LIMITS.maxGears;
	btn.disabled = atMax;
	btn.classList.toggle('opacity-40', atMax);
	btn.classList.toggle('pointer-events-none', atMax);
	btn.title = atMax ? `${GRAPH_LIMITS.maxGears} ${t('gear.maxReached')}` : t('gears.add');
};

/**
 * Append a new primary gear derived from the previous ratio.
 * @brief Offer a sensible default shorter ratio.
 * @param refs Cached DOM handles.
 * @param onChange Refresh callback.
 */
export const addGear = (refs: ElementRefs, onChange: (redrawInputs: boolean) => void): void => {
	if (state.gears.length >= GRAPH_LIMITS.maxGears) {
		return;
	}
	const lastRatio = state.gears[state.gears.length - 1] || 1.0;
	state.gears.push(Math.max(0.5, +(lastRatio * 0.82).toFixed(2)));
	renderGearsList(refs, onChange);
	onChange(true);
};

/**
 * @brief Append a new comparison gear derived from the previous ratio.
 * @brief Mirrors the new list into the hidden CSV input before re-rendering.
 * @param refs Cached DOM handles.
 * @param onChange Refresh callback.
 * @return void
 */
export const addCompGear = (refs: ElementRefs, onChange: (redrawInputs: boolean) => void): void => {
	if (state.compGears.length >= GRAPH_LIMITS.maxGears) {
		return;
	}
	const lastRatio = state.compGears[state.compGears.length - 1] || 1.0;
	state.compGears.push(Math.max(0.5, +(lastRatio * 0.82).toFixed(2)));
	refs.compGears.value = formatCompGears(state.compGears);
	renderCompareGearsList(refs, onChange);
	onChange(true);
};

/**
 * Build the reverse-gear editor row.
 * @brief Optional R ratio with a dedicated gray marker.
 * @return Reverse row element bound to state on rebuild.
 */
const buildReverseRow = (): HTMLElement => {
	const row = document.createElement('div');
	row.className = 'flex items-center gap-2 bg-surface-recessed border border-dashed border-border-hairline px-2 py-1.5 rounded';
	const value = state.reverseRatio === null ? '' : String(state.reverseRatio);
	row.innerHTML = `<span class='w-2.5 h-2.5 rounded-full flex-shrink-0 bg-text-muted'></span><span class='gear-label w-16 font-mono text-[0.6875rem] font-medium text-text-dim'>${t('gear.reverse')}</span><input type='number' inputmode='decimal' step='0.01' min='1.0' max='6.0' value='${value}' placeholder='opt.' aria-label='${t('gear.reverse')}' class='reverse-input flex-1 bg-surface-input border border-border-hairline rounded px-2 py-1 font-mono text-[0.8125rem] font-semibold text-text-output text-right focus:border-neon-cyan outline-none' /><span class='text-text-muted font-mono text-[0.625rem] flex-shrink-0'>: 1</span>`;
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
 * @brief Clamp a number into an inclusive range.
 * @param value Candidate value.
 * @param min Lower bound.
 * @param max Upper bound.
 * @return Clamped value.
 */
const clamp = (value: number, min: number, max: number): number => {
	return Math.min(max, Math.max(min, value));
};
