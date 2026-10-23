/**
 * @file setup-controls-events.ts
 * @brief Bind the tire pills and steppers of every prefix-parameterized setup block.
 */
import { state } from '../../core/state/app-state';
import { parseTire } from '../../core/math/tire-math';
import type { SetupPrefix } from '../../components/setup-controls';
import type { ElementRefs } from '../dom/element-refs';

/** Lowest final-drive ratio the stepper will accept. */
const FD_MIN = 1.0;

/** Highest final-drive ratio the stepper will accept. */
const FD_MAX = 10.0;

/** Lowest rev limiter the stepper will accept, in RPM. */
const REV_MIN = 3000;

/** Highest rev limiter the stepper will accept, in RPM. */
const REV_MAX = 12000;

/** Final-drive increment, matching the button labels. */
const FD_STEP = 0.05;

/** Rev-limiter increment, matching the button labels. */
const REV_STEP = 100;

/** Setup slots bound by this binder. */
const PREFIXES: SetupPrefix[] = ['primary', 'compare'];

/**
 * Wire the touch-first setup blocks of both prefixes exactly once.
 * @brief Delegated listeners survive the pill rebuilds of syncSetupControls,
 * @brief so injected off-list pills stay clickable without rebinding.
 * @brief Every change rewrites its hidden legacy input and flows through render.
 * @param refs Cached DOM handles.
 * @param render Full refresh callback.
 * @return void
 */
export const bindSetupControlsEvents = (refs: ElementRefs, render: () => void): void => {
	PREFIXES.forEach((prefix) => {
		document.querySelectorAll<HTMLElement>(`[data-setup-prefix='${prefix}']`).forEach((root) => {
			bindRoot(root, prefix, refs, render);
		});
	});
};

/**
 * @brief Attach one delegated click listener to a block root, once.
 * @brief The data-setup-bound attribute guards against double binding.
 * @param root Block root element carrying data-setup-prefix.
 * @param prefix Setup slot the root belongs to.
 * @param refs Cached DOM handles.
 * @param render Full refresh callback.
 * @return void
 */
const bindRoot = (root: HTMLElement, prefix: SetupPrefix, refs: ElementRefs, render: () => void): void => {
	if (root.dataset.setupBound === 'true') {
		return;
	}
	root.dataset.setupBound = 'true';
	root.addEventListener('click', (e) => {
		const target = e.target as HTMLElement;
		const pill = target.closest<HTMLButtonElement>('.tire-pill');
		if (pill) {
			applyTirePill(prefix, pill, refs);
			render();
			return;
		}
		const stepper = target.closest<HTMLButtonElement>('.stepper-btn');
		if (stepper) {
			applyStepper(prefix, stepper, refs);
			render();
		}
	});
	root.addEventListener('change', (e) => {
		const input = (e.target as HTMLElement).closest<HTMLInputElement>('[data-tire-input], [data-setup-input]');
		if (!input) {
			return;
		}
		if (input.dataset.tireInput) {
			applyTireInput(prefix, input, refs);
		} else {
			applySetupInput(prefix, input, refs);
		}
		render();
	});
};

/**
 * @brief Apply one segmented tire field to the legacy tire specification.
 * @param prefix Setup slot whose tire spec is rewritten.
 * @param input Edited numeric field.
 * @param refs Cached DOM handles.
 * @return void
 */
const applyTireInput = (prefix: SetupPrefix, input: HTMLInputElement, refs: ElementRefs): void => {
	const tire = parseTire(prefix === 'primary' ? state.primaryTire : state.compTire);
	const value = Number(input.value);
	if (!tire || !Number.isFinite(value) || value <= 0) {
		return;
	}
	const width = input.dataset.tireInput === 'width' ? value : tire.width;
	const aspect = input.dataset.tireInput === 'aspect' ? value : tire.aspect;
	const rimInch = input.dataset.tireInput === 'rim' ? value : tire.rimInch;
	const next = `${Math.round(width)}/${Math.round(aspect)}R${Math.round(rimInch)}`;
	if (prefix === 'primary') {
		state.primaryTire = next;
		refs.primaryTire.value = next;
		return;
	}
	state.compTire = next;
	refs.compTire.value = next;
};

/**
 * @brief Apply a directly edited final-drive or rev-limiter field.
 * @param prefix Setup slot whose value is rewritten.
 * @param input Edited numeric field.
 * @param refs Cached DOM handles.
 * @return void
 */
const applySetupInput = (prefix: SetupPrefix, input: HTMLInputElement, refs: ElementRefs): void => {
	const value = Number(input.value);
	if (!Number.isFinite(value)) {
		return;
	}
	if (input.dataset.setupInput === 'fd') {
		const next = Number(clamp(value, FD_MIN, FD_MAX).toFixed(3));
		if (prefix === 'primary') {
			state.primaryFd = next;
			refs.primaryFd.value = String(next);
		} else {
			state.compFd = next;
			refs.compFd.value = String(next);
		}
		return;
	}
	const next = Math.round(clamp(value, REV_MIN, REV_MAX));
	if (prefix === 'primary') {
		state.primaryRedline = next;
		refs.primaryRedline.value = String(next);
	} else {
		state.compRedline = next;
		refs.compRedline.value = String(next);
	}
};

/**
 * @brief Rewrite the tire spec of one setup slot from a selected pill.
 * @brief The pill replaces only its own dimension, keeping the others intact.
 * @param prefix Setup slot whose tire spec is rewritten.
 * @param btn Pill button carrying the dimension and value datasets.
 * @param refs Cached DOM handles.
 * @return void
 */
const applyTirePill = (prefix: SetupPrefix, btn: HTMLButtonElement, refs: ElementRefs): void => {
	const tire = parseTire(prefix === 'primary' ? state.primaryTire : state.compTire);
	if (!tire) {
		return;
	}
	const value = Number(btn.dataset.value);
	if (!Number.isFinite(value) || value <= 0) {
		return;
	}
	const width = btn.dataset.dim === 'width' ? value : tire.width;
	const aspect = btn.dataset.dim === 'aspect' ? value : tire.aspect;
	const rimInch = btn.dataset.dim === 'rim' ? value : tire.rimInch;
	const next = `${Math.round(width)}/${Math.round(aspect)}R${Math.round(rimInch)}`;
	if (prefix === 'primary') {
		state.primaryTire = next;
		refs.primaryTire.value = next;
		return;
	}
	state.compTire = next;
	refs.compTire.value = next;
};

/**
 * @brief Apply one final-drive or rev-limiter stepper click to a setup slot.
 * @brief Values are clamped to the same ranges the numeric inputs allow.
 * @param prefix Setup slot whose value is rewritten.
 * @param btn Stepper button carrying the target and direction datasets.
 * @param refs Cached DOM handles.
 * @return void
 */
const applyStepper = (prefix: SetupPrefix, btn: HTMLButtonElement, refs: ElementRefs): void => {
	const direction = Number(btn.dataset.direction);
	if (!Number.isFinite(direction) || direction === 0) {
		return;
	}
	if (btn.dataset.stepper === 'fd') {
		const base = prefix === 'primary' ? state.primaryFd : state.compFd;
		const next = clamp(base + direction * FD_STEP, FD_MIN, FD_MAX);
		if (prefix === 'primary') {
			state.primaryFd = Number(next.toFixed(3));
			refs.primaryFd.value = String(state.primaryFd);
		} else {
			state.compFd = Number(next.toFixed(3));
			refs.compFd.value = String(state.compFd);
		}
		return;
	}
	const base = prefix === 'primary' ? state.primaryRedline : state.compRedline;
	const next = clamp(base + direction * REV_STEP, REV_MIN, REV_MAX);
	if (prefix === 'primary') {
		state.primaryRedline = Math.round(next);
		refs.primaryRedline.value = String(state.primaryRedline);
	} else {
		state.compRedline = Math.round(next);
		refs.compRedline.value = String(state.compRedline);
	}
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
