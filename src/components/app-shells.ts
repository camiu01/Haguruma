/**
 * @file app-shells.ts
 * @brief Component shell assembly before DOM refs and translations resolve.
 */
import { injectSetupGuideShell } from './setup-guide';
import { injectCruiseShell } from './cruise-card';
import { injectTireSizeShell } from './tire-size-tool';
import { injectGraphControlsShell } from './graph-controls';
import { injectDynamicsTools } from './dynamics-tools';
import { injectDiagnosticTools } from './diagnostic-tools';
import { injectBackupTools, injectHardwareTools } from './backup-tools';
import { injectPerformanceTimer } from './performance-timer';
import { injectTractionMarginHeading } from './traction-margin';
import { injectLapSequenceTools } from './lap-sequence-tools';

/**
 * @brief Resolve a required component mount without silently skipping features.
 * @param id Mount identifier.
 * @return Existing mount.
 */
const mount = (id: string): HTMLElement => {
	const node = document.getElementById(id);
	if (!node) throw new Error(`Missing required element: ${id}`);
	return node;
};

/**
 * @brief Assemble application-owned shells and trackside tool sections.
 * @param none No parameters.
 * @return Tool container used for later stateful binders.
 */
export const injectAppShells = (): HTMLElement => {
	injectSetupGuideShell(mount('setup-guide-mount'));
	const cruise = mount('cruise-mount');
	injectCruiseShell(cruise);
	injectTireSizeShell(mount('tire-size-mount'));
	const tools = document.createElement('div');
	tools.className = 'track-tools';
	cruise.append(tools);
	injectDynamicsTools(tools);
	injectLapSequenceTools(tools);
	injectDiagnosticTools(tools);
	injectBackupTools(tools);
	injectHardwareTools(tools);
	injectPerformanceTimer(tools);
	const graph = document.querySelector<HTMLElement>('.graph-wrap');
	if (!graph) throw new Error('Missing required element: graph-wrap');
	injectGraphControlsShell(graph);
	injectTractionMarginHeading();
	return tools;
};
