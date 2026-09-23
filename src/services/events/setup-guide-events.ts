/**
 * @file setup-guide-events.ts
 * @brief Bind the setup troubleshooting wizard selects to the shared state.
 */
import { state } from '../../core/state/app-state';
import type { ElementRefs } from '../dom/element-refs';
import { renderWizardResult, syncWizardSelects } from '../../components/setup-guide';
import type { CornerPhase, HandlingIssue } from '../../core/setup/setup-matrix';
import { ISSUES, PHASES } from '../../core/setup/setup-matrix';

/**
 * @brief Check a raw select value against the allowed corner phases.
 * @param value Raw select value.
 * @return True when the value is a known phase.
 */
export const isPhase = (value: string): value is CornerPhase => {
	return (PHASES as string[]).includes(value);
};

/**
 * @brief Check a raw select value against the allowed handling issues.
 * @param value Raw select value.
 * @return True when the value is a known issue.
 */
export const isIssue = (value: string): value is HandlingIssue => {
	return (ISSUES as string[]).includes(value);
};

/**
 * @brief Wire wizard selects so each change updates state and re-renders fixes.
 * @param refs Cached DOM handles.
 * @return void
 */
export const bindSetupGuideEvents = (refs: ElementRefs): void => {
	refs.setupPhase.addEventListener('change', () => {
		if (isPhase(refs.setupPhase.value)) {
			state.setupGuide.phase = refs.setupPhase.value;
		}
		syncWizardSelects(refs);
		renderWizardResult(refs);
	});
	refs.setupIssue.addEventListener('change', () => {
		if (isIssue(refs.setupIssue.value)) {
			state.setupGuide.issue = refs.setupIssue.value;
		}
		syncWizardSelects(refs);
		renderWizardResult(refs);
	});
};
