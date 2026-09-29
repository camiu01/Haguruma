/**
 * @file running-gear-events.ts
 * @brief Bind running-gear chassis inputs to primary state.
 */
import { state } from '../../core/state/app-state';
import { efficiencyForLayout } from '../../config/drivetrain-eff';
import type { ElementRefs } from '../dom/element-refs';
import {
	applyDiffModelTo,
	bindRunningGearBlock,
	setLockVisibility,
	syncRunningGearBlock,
} from '../../components/running-gear-block';

export { applyDiffModelTo };

/**
 * @brief Show lock inputs only for clutch-LSD catalog models.
 * @param refs Cached DOM handles.
 * @return void
 */
export const applyRunningGearVisibility = (refs: ElementRefs): void => {
	setLockVisibility('rg', refs.rgDiff.value);
};

/**
 * @brief Bind selects, numbers, lateral-G slider and the accordion toggle.
 * @brief Layout changes also set the layout default drivetrain efficiency.
 * @param refs Cached DOM handles.
 * @param render Full refresh callback.
 * @return void
 */
export const bindRunningGearEvents = (refs: ElementRefs, render: () => void): void => {
	bindRunningGearBlock('rg', () => state.runningGear, render, {
		onLayout: (lay) => {
			state.drivetrainEff = efficiencyForLayout(lay);
			refs.effInput.value = String(state.drivetrainEff);
		},
	});
	refs.rgAccordion.addEventListener('toggle', () => {
		const open = (refs.rgAccordion as HTMLDetailsElement).open;
		refs.rgAccordion.setAttribute('aria-expanded', String(open));
	});
};

/**
 * @brief Sync running-gear controls from primary state.
 * @param refs Cached DOM handles.
 * @return void
 */
export const syncRunningGearInputs = (refs: ElementRefs): void => {
	syncRunningGearBlock('rg', state.runningGear);
	applyRunningGearVisibility(refs);
};
