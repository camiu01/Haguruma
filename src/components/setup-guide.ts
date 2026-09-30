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
 * @brief Mirrors the cruise/tiresize/pyrometer shape: one card, one
 * @brief data-accordion section, wizard plus handbook sections in one body.
 * @param host Mount element hosting the card.
 * @return void
 */
export const injectSetupGuideShell = (host: HTMLElement): void => {
	host.replaceChildren();
	const card = document.createElement('div');
	card.className = 'card border border-border-hairline rounded-lg p-3 flex flex-col gap-3';
	const accordion = document.createElement('div');
	accordion.className = 'bg-surface-subtle rounded border border-border-hairline overflow-hidden';
	accordion.setAttribute('data-accordion', 'setup');
	const content = document.createElement('div');
	content.className = 'section-content open p-3 flex flex-col gap-3';
	content.setAttribute('data-accordion-content', '');
	content.appendChild(buildBody());
	accordion.append(buildHeader(), content);
	card.appendChild(accordion);
	host.appendChild(card);
};

/**
 * @brief Build the accordion header: dot, title and chevron.
 * @param none No parameters.
 * @return Header element picked up by the shared accordion binder.
 */
const buildHeader = (): HTMLElement => {
	const header = document.createElement('div');
	header.className = 'section-header px-3 py-2 bg-surface-subtle border-b border-border-hairline';
	header.setAttribute('data-accordion-header', '');
	const left = document.createElement('div');
	left.className = 'flex items-center gap-2';
	const dot = document.createElement('span');
	dot.className = 'w-2 h-2 rounded-full bg-neon-cyan';
	const title = document.createElement('span');
	title.className = 'text-[0.8125rem] font-semibold uppercase tracking-wide text-text-output';
	title.setAttribute('data-i18n', 'setup.title');
	title.textContent = t('setup.title');
	left.append(dot, title);
	header.append(left, buildChevron());
	return header;
};

/**
 * @brief Build the standard accordion chevron icon.
 * @param none No parameters.
 * @return Inline SVG chevron in the expanded state.
 */
const buildChevron = (): SVGSVGElement => {
	const chevron = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
	chevron.setAttribute('class', 'chevron open');
	chevron.setAttribute('data-chevron', '');
	chevron.setAttribute('viewBox', '0 0 24 24');
	chevron.setAttribute('fill', 'none');
	chevron.setAttribute('stroke', 'currentColor');
	chevron.setAttribute('stroke-width', '2');
	chevron.setAttribute('aria-hidden', 'true');
	const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
	poly.setAttribute('points', '6 9 12 15 18 9');
	chevron.appendChild(poly);
	return chevron;
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
	wrap.className = 'col-span-2 sm:col-span-1';
	const label = document.createElement('label');
	label.className = 'mb-1 block text-[0.6875rem] font-medium text-text-dim';
	label.setAttribute('for', id);
	label.setAttribute('data-i18n', labelKey);
	label.textContent = t(labelKey);
	const select = document.createElement('select');
	select.id = id;
	select.className = 'w-full bg-surface-input border border-border-hairline rounded px-2 py-2 font-mono text-[0.8125rem] text-text-output outline-none focus:border-neon-cyan';
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
 * @brief Build the accordion body: wizard, result, handbook, feel, procedure.
 * @param none No parameters.
 * @return Body element ready to append to the section content.
 */
const buildBody = (): HTMLElement => {
	const body = document.createElement('div');
	body.className = 'setup-guide';
	body.appendChild(buildHeading('h3', 'setup-h3', 'setup.wizardTitle'));
	const grid = document.createElement('div');
	grid.className = 'grid grid-cols-2 gap-3';
	grid.append(buildSelect('setup-phase', 'setup.phaseLabel', PHASE_OPTIONS));
	grid.append(buildSelect('setup-issue', 'setup.issueLabel', ISSUE_OPTIONS));
	body.appendChild(grid);
	body.appendChild(buildHeading('h4', 'setup-h4', 'setup.resultTitle'));
	body.appendChild(buildRegion('setup-result', 'setup-result'));
	body.appendChild(buildHeading('h3', 'setup-h3', 'setup.handbookTitle'));
	body.appendChild(buildHeading('h3', 'setup-h3', 'setup.feelTitle'));
	body.appendChild(buildRegion('setup-feel', 'setup-feel'));
	body.appendChild(buildHeading('h3', 'setup-h3', 'setup.procedureTitle'));
	body.appendChild(buildRegion('setup-procedure', 'setup-procedure'));
	return body;
};
