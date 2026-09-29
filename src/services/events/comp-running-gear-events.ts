/**
 * @file comp-running-gear-events.ts
 * @brief Bind secondary comparison running-gear inputs to compRunningGear.
 *
 * The comparison block is generated from the shared running-gear builder so
 * primary and secondary rows stay identical; only the state slot differs.
 * Everything written here drives the dashed COMP grip curve on the graph
 * (comp mass + comp running gear); the primary drivetrain efficiency input
 * is intentionally untouched because the comparison shares it.
 */
import { state } from '../../core/state/app-state';
import type { ElementRefs } from '../dom/element-refs';
import {
	bindRunningGearBlock,
	buildRunningGearBlock,
	syncRunningGearBlock,
} from '../../components/running-gear-block';

/**
 * @brief Generate the comparison block on first use.
 * @brief Keeps bootstrap order free: bind and sync both ensure the mount.
 * @return void
 */
const ensureCompBlock = (): void => {
	const mount = document.getElementById('comp-rg-mount');
	if (mount && !mount.hasChildNodes()) {
		mount.appendChild(buildRunningGearBlock('crg'));
	}
};

/**
 * @brief Bind the comparison running-gear selects, numbers and slider.
 * @param _refs Cached DOM handles (kept for binder signature consistency).
 * @param render Full refresh callback.
 * @return void
 */
export const bindCompRunningGearEvents = (_refs: ElementRefs, render: () => void): void => {
	ensureCompBlock();
	bindRunningGearBlock('crg', () => state.compRunningGear, render);
};

/**
 * @brief Sync comparison running-gear controls from compRunningGear state.
 * @brief Called after copy-primary, preset load and URL restore.
 * @return void
 */
export const syncCompRunningGearInputs = (): void => {
	ensureCompBlock();
	syncRunningGearBlock('crg', state.compRunningGear);
};
