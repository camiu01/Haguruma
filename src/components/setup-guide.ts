/**
 * @file setup-guide.ts
 * @brief Assemble setup guide cards into shell mount points.
 */
import { getLang } from '../core/i18n/language';
import { state } from '../core/state/app-state';
import type { ElementRefs } from '../services/dom/element-refs';
import { getFixes } from '../core/setup/setup-matrix';
import { PROCEDURE_STEPS } from '../core/setup/setup-guide-content';
import { EntryDiagnosticCard } from './card/entry-diagnostic-card';
import { ExitTractionCard } from './card/exit-traction-card';
import { MidCornerCard } from './card/mid-corner-card';
import { PyrometerGuideCard } from './card/pyrometer-guide-card';
import { SetupFixCard } from './card/fix-card';
import { SetupGuideShellCard } from './card/setup-shell-card';
import { SetupProcedureCard } from './card/procedure-card';

/**
 * @brief Render wizard selects, ranked fixes, feel guide and procedure steps.
 * @param refs Cached DOM handles.
 * @return void
 */
export const renderSetupGuide = (refs: ElementRefs): void => {
	syncWizardSelects(refs);
	renderWizardResult(refs);
	renderFeelGuide(refs);
	renderProcedure(refs);
};

/**
 * @brief Align the wizard selects with the singleton state.
 * @param refs Cached DOM handles.
 * @return void
 */
export const syncWizardSelects = (refs: ElementRefs): void => {
	refs.setupPhase.value = state.setupGuide.phase;
	refs.setupIssue.value = state.setupGuide.issue;
};

/**
 * @brief Render the ranked fix list for the active phase/issue pair.
 * @param refs Cached DOM handles.
 * @return void
 */
export const renderWizardResult = (refs: ElementRefs): void => {
	const lang = getLang();
	const fixes = getFixes(state.setupGuide.phase, state.setupGuide.issue);
	refs.setupResult.replaceChildren();
	for (const fix of fixes) {
		new SetupFixCard({ fix, lang }).mount(refs.setupResult);
	}
};

/**
 * @brief Render phase diagnostic cards plus the pyrometer guide.
 * @param refs Cached DOM handles.
 * @return void
 */
export const renderFeelGuide = (refs: ElementRefs): void => {
	const lang = getLang();
	refs.setupFeel.replaceChildren();
	new EntryDiagnosticCard({ lang }).mount(refs.setupFeel);
	new MidCornerCard({ lang }).mount(refs.setupFeel);
	new ExitTractionCard({ lang }).mount(refs.setupFeel);
	new PyrometerGuideCard({ lang }).mount(refs.setupFeel);
};

/**
 * @brief Render the eight ordered procedure steps.
 * @param refs Cached DOM handles.
 * @return void
 */
export const renderProcedure = (refs: ElementRefs): void => {
	const lang = getLang();
	refs.setupProcedure.replaceChildren();
	new SetupProcedureCard({ steps: PROCEDURE_STEPS, lang }).mount(refs.setupProcedure);
};

/**
 * @brief Inject the setup card shell into its index.html mount point.
 * @brief Runs in bootstrap before refs resolve so ids and accordions exist.
 * @param host Mount element hosting the card.
 * @return void
 */
export const injectSetupGuideShell = (host: HTMLElement): void => {
	host.replaceChildren();
	new SetupGuideShellCard().mount(host);
};
