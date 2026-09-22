/**
 * @file engine-events.ts
 * @brief Bind engine torque/power curve anchors.
 */
import { state } from '../../core/state/app-state';
import { powerFromTorque } from '../../core/math/traction-math';
import type { ElementRefs } from '../dom/element-refs';

/**
 * @brief Bind engine curve inputs.
 * @param refs Cached DOM handles.
 * @param render Full refresh callback.
 * @return void
 */
export const bindEngineEvents = (refs: ElementRefs, render: () => void): void => {
	refs.torqueRpmInput.addEventListener('input', (e) => {
		const v = parseInt((e.target as HTMLInputElement).value, 10);
		if (v >= 1000 && v <= 12000) {
			state.peakTorqueRpm = v;
			syncEngineDerived(refs);
			render();
		}
	});
	refs.torqueInput.addEventListener('input', (e) => {
		const v = parseFloat((e.target as HTMLInputElement).value);
		if (v > 0) {
			state.peakTorqueNm = v;
			syncEngineDerived(refs);
			render();
		}
	});
	refs.powerRpmInput.addEventListener('input', (e) => {
		const v = parseInt((e.target as HTMLInputElement).value, 10);
		if (v >= 1000 && v <= 12000) {
			state.peakPowerRpm = v;
			syncEngineDerived(refs);
			render();
		}
	});
};

/**
 * @brief Sync engine inputs with current state (e.g. after preset load).
 * @param refs Cached DOM handles.
 * @return void
 */
export const syncEngineInputs = (refs: ElementRefs): void => {
	refs.torqueRpmInput.value = String(state.peakTorqueRpm);
	refs.torqueInput.value = String(state.peakTorqueNm);
	refs.powerRpmInput.value = String(state.peakPowerRpm);
	syncEngineDerived(refs);
};

/**
 * @brief Update the derived power-at-torque-peak readout.
 * @param refs Cached DOM handles.
 * @return void
 */
const syncEngineDerived = (refs: ElementRefs): void => {
	refs.powerAtDisplay.value = `${powerFromTorque(state.peakTorqueNm, state.peakTorqueRpm).toFixed(1)} kW`;
};
