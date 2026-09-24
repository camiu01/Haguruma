/**
 * @file road-load-events.ts
 * @brief Bind secondary road-load physics inputs (mass, drag, area, Crr, grade, tire factor).
 */
import { state } from '../../core/state/app-state';
import { clampGrade } from '../../core/math/aero-math';
import { clampRollingFactor } from '../../core/math/tire-math';
import { formatPowerInput, fromDisplayPower } from '../../core/units/unit-utils';
import type { ElementRefs } from '../dom/element-refs';

/**
 * @brief Bind the road-load toggle and its numeric inputs.
 * @param refs Cached DOM handles.
 * @param render Full refresh callback.
 * @return void
 */
export const bindRoadLoadEvents = (refs: ElementRefs, render: () => void): void => {
	refs.roadLoadToggle.addEventListener('change', (e) => {
		state.roadLoadEnabled = (e.target as HTMLInputElement).checked;
		applyRoadLoadVisibility(refs);
		render();
	});
	refs.massInput.addEventListener('input', (e) => {
		const v = parseFloat((e.target as HTMLInputElement).value);
		if (v > 0) {
			state.vehicleMassKg = v;
			render();
		}
	});
	refs.cdInput.addEventListener('input', (e) => {
		const v = parseFloat((e.target as HTMLInputElement).value);
		if (v > 0) {
			state.dragCd = v;
			render();
		}
	});
	refs.areaInput.addEventListener('input', (e) => {
		const v = parseFloat((e.target as HTMLInputElement).value);
		if (v > 0) {
			state.frontalAreaM2 = v;
			render();
		}
	});
	refs.crrInput.addEventListener('input', (e) => {
		const v = parseFloat((e.target as HTMLInputElement).value);
		if (v > 0) {
			state.rollingCrr = v;
			render();
		}
	});
	refs.powerInput.addEventListener('input', (e) => {
		const v = parseFloat((e.target as HTMLInputElement).value);
		if (v > 0) {
			state.enginePowerKw = fromDisplayPower(v, state.powerUnit);
			render();
		}
	});
	refs.effInput.addEventListener('input', (e) => {
		const v = parseFloat((e.target as HTMLInputElement).value);
		if (v > 0 && v <= 1) {
			state.drivetrainEff = v;
			render();
		}
	});
	refs.gradeInput.addEventListener('input', (e) => {
		const v = parseFloat((e.target as HTMLInputElement).value);
		if (Number.isFinite(v)) {
			state.roadGradePercent = clampGrade(v);
			render();
		}
	});
	refs.rollFactorInput.addEventListener('input', (e) => {
		const v = parseFloat((e.target as HTMLInputElement).value);
		if (Number.isFinite(v)) {
			state.rollingFactor = clampRollingFactor(v);
			render();
		}
	});
	refs.rotMassInput.addEventListener('input', (e) => {
		const v = parseFloat((e.target as HTMLInputElement).value);
		if (Number.isFinite(v) && v >= 0) {
			state.rotatingMassKg = Math.min(500, v);
			render();
		}
	});
	refs.shiftTimeInput.addEventListener('input', (e) => {
		const v = parseFloat((e.target as HTMLInputElement).value);
		if (Number.isFinite(v) && v >= 0) {
			state.shiftTimeS = Math.min(3, v);
			render();
		}
	});
};

/**
 * @brief Dim the road-load fields when the secondary estimate is off.
 * @param refs Cached DOM handles.
 * @return void
 */
const applyRoadLoadVisibility = (refs: ElementRefs): void => {
	if (state.roadLoadEnabled) {
		refs.roadLoadFields.classList.remove('opacity-40', 'pointer-events-none');
		return;
	}
	refs.roadLoadFields.classList.add('opacity-40', 'pointer-events-none');
};

/**
 * @brief Sync road-load inputs with current state (e.g. after preset load).
 * @param refs Cached DOM handles.
 * @return void
 */
export const syncRoadLoadInputs = (refs: ElementRefs): void => {
	refs.roadLoadToggle.checked = state.roadLoadEnabled;
	refs.massInput.value = String(state.vehicleMassKg);
	refs.cdInput.value = String(state.dragCd);
	refs.areaInput.value = String(state.frontalAreaM2);
	refs.crrInput.value = String(state.rollingCrr);
	refs.powerInput.value = formatPowerInput(state.enginePowerKw, state.powerUnit);
	refs.effInput.value = String(state.drivetrainEff);
	refs.gradeInput.value = String(state.roadGradePercent);
	refs.rollFactorInput.value = String(state.rollingFactor);
	refs.rotMassInput.value = String(state.rotatingMassKg);
	refs.shiftTimeInput.value = String(state.shiftTimeS);
	applyRoadLoadVisibility(refs);
};
