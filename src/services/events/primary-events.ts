/**
 * @file primary-events.ts
 * @brief Primary setup inputs: final drive, redline, graph max and its auto-fit.
 *
 * Tire geometry is owned by `setup-controls.ts` (pills + validation); the
 * hidden `#primary-tire` carrier is written by that module.
 */
import { state } from '../../core/state/app-state';
import { effectiveCircumferenceM, parseTire } from '../../core/math/tire-math';
import { autoFitMaxSpeed } from '../../core/math/speed-math';
import type { ElementRefs } from '../dom/element-refs';
import { renderGraph } from '../graph/graph-renderer';

/**
 * Bind primary setup inputs.
 * @brief Forward numeric changes to state.
 * @param refs Cached DOM handles.
 * @param render Full refresh callback.
 * @return void
 */
export const bindPrimaryEvents = (refs: ElementRefs, render: () => void): void => {
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
			renderGraph(refs);
		}
	});
	document.getElementById('btn-autofit-speed')?.addEventListener('click', () => {
		const circM = effectiveCircumferenceM(parseTire(state.primaryTire), state.rollingFactor);
		if (!(circM > 0)) {
			return;
		}
		state.maxGraphSpeed = autoFitMaxSpeed(state.gears, state.primaryFd, circM, state.primaryRedline, state.unit);
		state.graphWindow = null;
		refs.graphMaxSpeed.value = String(state.maxGraphSpeed);
		render();
	});
};
