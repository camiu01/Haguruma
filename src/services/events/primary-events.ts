import { state } from '../../core/state/app-state';
import { effectiveCircumferenceM, parseTire } from '../../core/math/tire-math';
import type { ElementRefs } from '../dom/element-refs';
import { drawGraph } from '../graph/graph-renderer';

/**
 * Bind primary setup inputs.
 * @purpose Validate tire text and forward numeric changes to state.
 * @param refs Cached DOM handles.
 * @param render Full refresh callback.
 */
export const bindPrimaryEvents = (refs: ElementRefs, render: () => void): void => {
	refs.primaryTire.addEventListener('input', (e) => {
		const value = (e.target as HTMLInputElement).value.trim();
		state.primaryTire = value;
		applyTireValidation(refs, value, render);
	});
	refs.primaryFd.addEventListener('input', (e) => {
		const v = parseFloat((e.target as HTMLInputElement).value);
		if (v > 0) {
			state.primaryFd = v;
			render();
		}
	});
	refs.primaryRedline.addEventListener('input', (e) => {
		const v = parseInt((e.target as HTMLInputElement).value, 10);
		if (v > 1000) {
			state.primaryRedline = v;
			render();
		}
	});
	refs.graphMaxSpeed.addEventListener('input', (e) => {
		const v = parseInt((e.target as HTMLInputElement).value, 10);
		if (v > 50) {
			state.maxGraphSpeed = v;
			drawGraph(refs);
		}
	});
};

/**
 * Validate tire text and update the status dot.
 * @purpose Give immediate feedback without blocking typing.
 */
const applyTireValidation = (refs: ElementRefs, value: string, render: () => void): void => {
	const parsed = parseTire(value);
	if (parsed) {
		refs.tireDot.className = 'absolute right-2.5 top-2.5 w-2 h-2 rounded-full bg-emerald-500';
		refs.tireError.classList.add('hidden');
		const dynMm = Math.round(effectiveCircumferenceM(parsed, state.rollingFactor) * 1000);
		refs.primaryCirc.textContent = `Circ: ${dynMm} mm`;
		render();
		return;
	}
	refs.tireDot.className = 'absolute right-2.5 top-2.5 w-2 h-2 rounded-full bg-rose-500';
	refs.tireError.classList.remove('hidden');
};
