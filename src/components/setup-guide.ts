/**
 * @file setup-guide.ts
 * @brief Render the setup wizard result plus the feel-the-car and procedure guides.
 */
import { getLang, t } from '../core/i18n/language';
import type { DictKey } from '../core/i18n/dictionaries';
import { state } from '../core/state/app-state';
import type { ElementRefs } from '../services/dom/element-refs';
import { getFixes, pickLang } from '../core/setup/setup-matrix';
import type { SetupFix, Severity } from '../core/setup/setup-matrix';
import { FEEL_GUIDE, PROCEDURE_STEPS, localiseFeel, localiseStep } from '../core/setup/setup-guide-content';

/**
 * @brief Map a fix severity to its badge dictionary key.
 * @param severity Fix severity level.
 * @return Dictionary key for the localised badge label.
 */
export const severityDictKey = (severity: Severity): DictKey => {
	if (severity === 'low') {
		return 'setup.sevLow';
	}
	if (severity === 'medium') {
		return 'setup.sevMedium';
	}
	return 'setup.sevHigh';
};

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
	fixes.forEach((fix) => refs.setupResult.appendChild(buildFixCard(fix, lang)));
};

/**
 * @brief Build one ranked fix card with severity badge and trade-off warning.
 * @param fix Fix entry to render.
 * @param lang Active interface language.
 * @return Card element ready to append.
 */
const buildFixCard = (fix: SetupFix, lang: Parameters<typeof pickLang>[1]): HTMLElement => {
	const card = document.createElement('article');
	card.className = 'setup-fix';
	const head = document.createElement('div');
	head.className = 'setup-fix-head';
	const rank = document.createElement('span');
	rank.className = 'setup-rank';
	rank.textContent = String(fix.rank);
	const action = document.createElement('h4');
	action.className = 'setup-fix-title';
	action.textContent = pickLang(fix.action, lang);
	const badge = document.createElement('span');
	badge.className = `setup-sev setup-sev-${fix.severity}`;
	badge.textContent = t(severityDictKey(fix.severity));
	head.append(rank, action, badge);
	const detail = document.createElement('p');
	detail.className = 'setup-fix-detail';
	detail.textContent = pickLang(fix.detail, lang);
	card.append(head, detail);
	if (fix.tradeoff) {
		const warn = document.createElement('p');
		warn.className = 'setup-tradeoff';
		warn.textContent = `${t('setup.tradeoff')}: ${pickLang(fix.tradeoff, lang)}`;
		card.appendChild(warn);
	}
	return card;
};

/**
 * @brief Render the feel-the-car sections (entry / mid / exit cues).
 * @param refs Cached DOM handles.
 * @return void
 */
export const renderFeelGuide = (refs: ElementRefs): void => {
	const lang = getLang();
	refs.setupFeel.replaceChildren();
	FEEL_GUIDE.forEach((section) => {
		const local = localiseFeel(section, lang);
		const block = document.createElement('div');
		block.className = 'setup-feel-block';
		const title = document.createElement('h4');
		title.className = 'setup-feel-title';
		title.textContent = local.title;
		block.appendChild(title);
		const list = document.createElement('ul');
		list.className = 'setup-feel-list';
		local.cues.forEach((cue) => {
			const item = document.createElement('li');
			item.className = 'setup-feel-item';
			const name = document.createElement('strong');
			name.textContent = cue.title;
			const text = document.createElement('span');
			text.textContent = ` — ${cue.body}`;
			item.append(name, text);
			list.appendChild(item);
		});
		block.appendChild(list);
		refs.setupFeel.appendChild(block);
	});
};

/**
 * @brief Render the eight ordered procedure steps.
 * @param refs Cached DOM handles.
 * @return void
 */
export const renderProcedure = (refs: ElementRefs): void => {
	const lang = getLang();
	refs.setupProcedure.replaceChildren();
	const list = document.createElement('ol');
	list.className = 'setup-steps';
	PROCEDURE_STEPS.forEach((step) => {
		const local = localiseStep(step, lang);
		const item = document.createElement('li');
		item.className = 'setup-step';
		const num = document.createElement('span');
		num.className = 'setup-step-num';
		num.textContent = String(local.n);
		const body = document.createElement('div');
		body.className = 'setup-step-body';
		const title = document.createElement('h4');
		title.className = 'setup-step-title';
		title.textContent = local.title;
		const text = document.createElement('p');
		text.className = 'setup-step-text';
		text.textContent = local.body;
		body.append(title, text);
		item.append(num, body);
		list.appendChild(item);
	});
	refs.setupProcedure.appendChild(list);
};

/** Wizard select option descriptor. */
interface SetupOption {
	/** Option value written to state. */
	value: string;
	/** Chrome dictionary key for the label. */
	key: DictKey;
	/** Preselected default. */
	selected: boolean;
}

/** Phase options matching AppState.setupGuide defaults. */
const PHASE_OPTIONS: SetupOption[] = [
	{ value: 'entry', key: 'setup.phaseEntry', selected: false },
	{ value: 'mid', key: 'setup.phaseMid', selected: true },
	{ value: 'exit', key: 'setup.phaseExit', selected: false },
];

/** Issue options matching AppState.setupGuide defaults. */
const ISSUE_OPTIONS: SetupOption[] = [
	{ value: 'understeer', key: 'setup.issueUndersteer', selected: true },
	{ value: 'oversteer', key: 'setup.issueOversteer', selected: false },
	{ value: 'transfer', key: 'setup.issueTransfer', selected: false },
	{ value: 'bottoming', key: 'setup.issueBottoming', selected: false },
];

/**
 * @brief Create an element with class list and optional i18n key.
 * @param tag Tag name to create.
 * @param className Space-separated classes.
 * @param i18nKey Dictionary key applied as data-i18n, when present.
 * @return Prepared element without children.
 */
const el = (tag: string, className: string, i18nKey?: DictKey): HTMLElement => {
	const node = document.createElement(tag);
	if (className) {
		node.className = className;
	}
	if (i18nKey) {
		node.dataset.i18n = i18nKey;
	}
	return node;
};

/**
 * @brief Build the accordion chevron icon.
 * @return SVG chevron matching the shell accordions.
 */
const buildChevron = (): SVGSVGElement => {
	const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
	svg.setAttribute('class', 'chevron open');
	svg.setAttribute('viewBox', '0 0 24 24');
	svg.setAttribute('fill', 'none');
	svg.setAttribute('stroke', 'currentColor');
	svg.setAttribute('stroke-width', '2');
	svg.setAttribute('stroke-linecap', 'round');
	svg.setAttribute('stroke-linejoin', 'round');
	svg.setAttribute('aria-hidden', 'true');
	const line = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
	line.setAttribute('points', '6 9 12 15 18 9');
	svg.appendChild(line);
	return svg;
};

/**
 * @brief Build one labelled wizard select with localised options.
 * @param id Select element id referenced by refs and label.
 * @param labelKey Dictionary key for the label text.
 * @param options Option descriptors with values and defaults.
 * @return Wrapped label plus select column.
 */
const buildWizardSelect = (id: string, labelKey: DictKey, options: SetupOption[]): HTMLElement => {
	const wrap = el('div', 'col-span-2 sm:col-span-1');
	const label = el('label', 'block text-xs font-medium text-text-dim mb-1', labelKey);
	label.setAttribute('for', id);
	const select = document.createElement('select');
	select.id = id;
	select.className = 'w-full bg-surface-input border border-surface-border rounded-lg px-3 py-2 text-xs text-text-output font-mono focus:outline-none focus:border-text-dim';
	options.forEach((opt) => {
		const node = document.createElement('option');
		node.value = opt.value;
		node.dataset.i18n = opt.key;
		node.selected = opt.selected;
		select.appendChild(node);
	});
	wrap.append(label, select);
	return wrap;
};

/**
 * @brief Build the static setup card shell (header, selects, mount points).
 * @return Card element ready to mount, content filled by renderers.
 */
const buildSetupShell = (): HTMLElement => {
	const card = el('div', 'card border border-border rounded-xl p-4');
	const accordion = el('div', '');
	accordion.dataset.accordion = 'setup';
	const header = el('div', 'section-header');
	header.dataset.accordionHeader = '';
	const titleRow = el('div', 'flex items-center gap-2 min-w-0');
	titleRow.append(el('span', 'w-2 h-2 rounded-full bg-neon-cyan'));
	titleRow.append(el('span', 'text-sm font-semibold text-text-main', 'setup.title'));
	titleRow.append(el('span', 'text-[10px] text-text-dim whitespace-nowrap', 'setup.note'));
	header.append(titleRow, buildChevron());
	const content = el('div', 'section-content open');
	content.dataset.accordionContent = '';
	const guide = el('div', 'setup-guide pt-1');
	guide.appendChild(el('h3', 'setup-h3', 'setup.wizardTitle'));
	const grid = el('div', 'grid grid-cols-2 gap-4');
	grid.append(buildWizardSelect('setup-phase', 'setup.phaseLabel', PHASE_OPTIONS));
	grid.append(buildWizardSelect('setup-issue', 'setup.issueLabel', ISSUE_OPTIONS));
	guide.appendChild(grid);
	guide.appendChild(el('h4', 'setup-h4', 'setup.resultTitle'));
	const result = el('div', 'setup-result');
	result.id = 'setup-result';
	guide.appendChild(result);
	guide.appendChild(el('h3', 'setup-h3', 'setup.feelTitle'));
	const feel = el('div', 'setup-feel');
	feel.id = 'setup-feel';
	guide.appendChild(feel);
	guide.appendChild(el('h3', 'setup-h3', 'setup.procedureTitle'));
	const procedure = el('div', 'setup-procedure');
	procedure.id = 'setup-procedure';
	guide.appendChild(procedure);
	content.appendChild(guide);
	accordion.append(header, content);
	card.appendChild(accordion);
	return card;
};

/**
 * @brief Inject the setup card shell into its index.html mount point.
 * @brief Runs in bootstrap before refs resolve so ids and accordions exist.
 * @param host Mount element hosting the card.
 * @return void
 */
export const injectSetupGuideShell = (host: HTMLElement): void => {
	host.replaceChildren(buildSetupShell());
};
