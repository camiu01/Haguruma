/**
 * @file setup-guide.ts
 * @brief Shell injection and live render for the setup troubleshooting wizard.
 */
import { getLang, t } from '../core/i18n/language';
import type { DictKey } from '../core/i18n/dictionaries';
import { state } from '../core/state/app-state';
import type { ElementRefs } from '../services/dom/element-refs';
import { getFixes } from '../core/setup/setup-matrix';
import { PROCEDURE_STEPS } from '../core/setup/setup-guide-content';
import { EntryDiagnosticCard } from './card/entry-diagnostic-card';
import { ExitTractionCard } from './card/exit-traction-card';
import { MidCornerCard } from './card/mid-corner-card';
import { PyrometerGuideCard } from './card/pyrometer-guide-card';
import { SetupFixCard } from './card/fix-card';
import { SetupProcedureCard } from './card/procedure-card';
import { buildAccordionSection, buildToolShell } from './card/accordion-shell';

/** Wizard select option descriptor. */
interface SetupGuideOption {
	/** Option value written to state. */
	value: string;
	/** Dictionary key for the option label. */
	key: DictKey;
	/** Preselected default. */
	selected: boolean;
}

/** Phase options matching AppState.setupGuide defaults. */
const PHASE_OPTIONS: SetupGuideOption[] = [
	{ value: 'entry', key: 'setup.phaseEntry', selected: false },
	{ value: 'mid', key: 'setup.phaseMid', selected: true },
	{ value: 'exit', key: 'setup.phaseExit', selected: false },
];

/** Issue options matching AppState.setupGuide defaults. */
const ISSUE_OPTIONS: SetupGuideOption[] = [
	{ value: 'understeer', key: 'setup.issueUndersteer', selected: true },
	{ value: 'oversteer', key: 'setup.issueOversteer', selected: false },
	{ value: 'transfer', key: 'setup.issueTransfer', selected: false },
	{ value: 'bottoming', key: 'setup.issueBottoming', selected: false },
];

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
 * @brief Inject the setup guide tool shell into its mount point.
 * @brief Runs in bootstrap before refs resolve so ids and accordion exist.
 * @brief Mirrors the card-level shell shape (main setup / tools card): one
 * @brief card, a flat header reading t('setup.title'), then the wizard and
 * @brief the manual as banded accordion sections built like the primary
 * @brief setup inner headers.
 * @param host Mount element hosting the card.
 * @return void
 */
export const injectSetupGuideShell = (host: HTMLElement): void => {
	host.replaceChildren();
	host.appendChild(buildToolShell({
		id: 'setup',
		title: 'setup.title',
		dot: null,
		body: buildBody(),
		bodyClass: 'flex flex-col gap-3',
	}));
};

/**
 * @brief Build one tagged heading for the card body.
 * @param tag Heading tag name.
 * @param className Tailwind plus setup-guide classes.
 * @param key Dictionary key written to data-i18n and used as initial text.
 * @return Heading element carrying the static copy.
 */
const buildHeading = (tag: 'h3' | 'h4', className: string, key: DictKey): HTMLElement => {
	const node = document.createElement(tag);
	node.className = className;
	node.setAttribute('data-i18n', key);
	node.textContent = t(key);
	return node;
};

/**
 * @brief Build one labelled wizard select with localised options.
 * @param id Select element id referenced by refs and label.
 * @param labelKey Dictionary key for the label text.
 * @param options Option descriptors with values and defaults.
 * @return Wrapped label plus select column.
 */
const buildSelect = (id: string, labelKey: DictKey, options: SetupGuideOption[]): HTMLElement => {
	const wrap = document.createElement('div');
	wrap.className = 'field-half';
	const label = document.createElement('label');
	label.className = 'field-label';
	label.setAttribute('for', id);
	label.setAttribute('data-i18n', labelKey);
	label.textContent = t(labelKey);
	const select = document.createElement('select');
	select.id = id;
	select.className = 'w-full field-input field-input--md';
	for (const opt of options) {
		const node = document.createElement('option');
		node.value = opt.value;
		node.setAttribute('data-i18n', opt.key);
		node.textContent = t(opt.key);
		node.selected = opt.selected;
		select.appendChild(node);
	}
	wrap.append(label, select);
	return wrap;
};

/**
 * @brief Build a live region container with a fixed id.
 * @param id Element id resolved by element-refs and the renderers.
 * @param className Setup-guide region classes.
 * @return Empty region element filled on every render.
 */
const buildRegion = (id: string, className: string): HTMLElement => {
	const region = document.createElement('div');
	region.id = id;
	region.className = className;
	return region;
};

/**
 * @brief Build the accordion body: wizard and manual nested sections.
 * @brief Both sections carry the shared inner-header style (title, chevron)
 * @brief so the card matches the primary setup accordions.
 * @return Body element ready to append to the section content.
 */
const buildBody = (): HTMLElement => {
	const body = document.createElement('div');
	body.className = 'setup-guide';
	body.appendChild(buildSection('setup-wizard', 'setup.wizardTitle', buildWizardPanel()));
	body.appendChild(buildSection('setup-manual', 'setup.handbookTitle', buildManualPanel()));
	return body;
};

/**
 * @brief Build one nested accordion section with the shared header style.
 * @brief Delegates to the shared shell so the title and chevron land in the
 * @brief header exactly like the primary setup inner sections; the accent dot
 * @brief is omitted on this card.
 * @param id data-accordion key naming the section.
 * @param titleKey Dictionary key written to the header title.
 * @param panel Collapsible panel content.
 * @return Section element picked up by the shared accordion binder.
 */
const buildSection = (id: string, titleKey: DictKey, panel: HTMLElement): HTMLElement => buildAccordionSection({
	id,
	title: titleKey,
	dot: 'bg-neon-cyan shadow-[0_0_8px_#00f0ff]',
	body: panel,
	bodyClass: 'flex flex-col gap-3',
});

/**
 * @brief Build the wizard panel: phase and issue selects plus ranked fixes.
 * @return Panel element holding the selects and the result region.
 */
const buildWizardPanel = (): HTMLElement => {
	const panel = document.createElement('div');
	panel.className = 'flex flex-col gap-3';
	const grid = document.createElement('div');
	grid.className = 'grid grid-cols-2 gap-3';
	grid.append(buildSelect('setup-phase', 'setup.phaseLabel', PHASE_OPTIONS));
	grid.append(buildSelect('setup-issue', 'setup.issueLabel', ISSUE_OPTIONS));
	panel.append(grid, buildHeading('h4', 'setup-h4', 'setup.resultTitle'));
	panel.appendChild(buildRegion('setup-result', 'setup-result'));
	return panel;
};

/**
 * @brief Build the manual panel: feel guide and systematic procedure.
 * @return Panel element holding both handbook regions.
 */
const buildManualPanel = (): HTMLElement => {
	const panel = document.createElement('div');
	panel.className = 'flex flex-col gap-3';
	panel.appendChild(buildHeading('h3', 'setup-h3', 'setup.feelTitle'));
	panel.appendChild(buildRegion('setup-feel', 'setup-feel'));
	panel.appendChild(buildHeading('h3', 'setup-h3', 'setup.procedureTitle'));
	panel.appendChild(buildRegion('setup-procedure', 'setup-procedure'));
	return panel;
};
