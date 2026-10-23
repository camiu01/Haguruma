/**
 * @file drawer-display-events.ts
 * @brief Drawer display preferences and the export/IO quick actions.
 */
import { state } from '../../core/state/app-state';
import type { ElementRefs } from '../dom/element-refs';
import { exportGraphPng, exportGraphSvg } from '../graph/graph-export';
import { exportDrivetrainAs } from './export-events';

/**
 * Wire the drawer display switches and its export pipeline buttons.
 * @brief Every export route reuses the single graph/drivetrain entry point so
 * @brief the drawer can never diverge from the toolbar.
 * @param refs Cached DOM handles.
 * @param render Full refresh callback.
 * @return void
 */
export const bindDrawerDisplayEvents = (refs: ElementRefs, render: () => void): void => {
	bindToggle('drawer-fine-grid', (checked) => {
		state.graphLayers.fineGrid = checked;
		render();
	});
	bindToggle('drawer-snap-hud', (checked) => {
		state.graphLayers.snapHud = checked;
		render();
	});
	bindAction('drawer-export-png', () => exportGraphPng(refs));
	bindAction('drawer-export-svg', () => exportGraphSvg(refs));
	bindAction('drawer-export-ini', () => exportDrivetrainAs('ini'));
	bindAction('drawer-export-json', () => exportDrivetrainAs('json'));
	bindAction('drawer-export-jbeam', () => exportDrivetrainAs('jbeam'));
	bindAction('drawer-export-motec', () => exportDrivetrainAs('motec'));
	bindAction('drawer-footer-close', () => refs.mobileDrawerClose.click());
	syncDrawerDisplay();
};

/**
 * Align the drawer display checkboxes with the graph-layer state.
 * @brief Called on bind and from every full render so a share-link restore
 * @brief can never leave the switches lying about the active layers.
 * @return void
 */
export const syncDrawerDisplay = (): void => {
	setChecked('drawer-fine-grid', state.graphLayers.fineGrid);
	setChecked('drawer-snap-hud', state.graphLayers.snapHud);
};

/**
 * @brief Write the checked state of one optional checkbox by id.
 * @param id Checkbox element id.
 * @param checked Desired checked state.
 * @return void
 */
const setChecked = (id: string, checked: boolean): void => {
	const input = document.getElementById(id);
	if (input instanceof HTMLInputElement) {
		input.checked = checked;
	}
};

/**
 * Bind one drawer checkbox to a graph-layer preference.
 * @brief The graph repaints through the shared refresh callback.
 * @param id Checkbox element id.
 * @param apply Callback receiving the new checked state.
 * @return void
 */
const bindToggle = (id: string, apply: (checked: boolean) => void): void => {
	const input = document.getElementById(id);
	if (!(input instanceof HTMLInputElement)) {
		return;
	}
	input.addEventListener('change', () => apply(input.checked));
};

/**
 * @brief Bind one drawer action button by id, ignoring missing nodes.
 * @param id Button element id.
 * @param handler Click handler.
 * @return void
 */
const bindAction = (id: string, handler: () => void): void => {
	const btn = document.getElementById(id);
	if (!btn) {
		return;
	}
	btn.addEventListener('click', handler);
};
