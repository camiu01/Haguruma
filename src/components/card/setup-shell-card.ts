/**
 * @file setup-shell-card.ts
 * @brief Static setup guide shell: collapsible card with wizard selects.
 */
import type { DictKey } from '../../core/i18n/dictionaries';
import { Card, createEl } from './base-card';
import type { CardOptions } from './base-card';

/** Wizard select option descriptor. */
interface SetupShellOption {
	/** Option value written to state. */
	value: string;
	/** Chrome dictionary key for the label. */
	key: DictKey;
	/** Preselected default. */
	selected: boolean;
}

/** Phase options matching AppState.setupGuide defaults. */
const PHASE_OPTIONS: SetupShellOption[] = [
	{ value: 'entry', key: 'setup.phaseEntry', selected: false },
	{ value: 'mid', key: 'setup.phaseMid', selected: true },
	{ value: 'exit', key: 'setup.phaseExit', selected: false },
];

/** Issue options matching AppState.setupGuide defaults. */
const ISSUE_OPTIONS: SetupShellOption[] = [
	{ value: 'understeer', key: 'setup.issueUndersteer', selected: true },
	{ value: 'oversteer', key: 'setup.issueOversteer', selected: false },
	{ value: 'transfer', key: 'setup.issueTransfer', selected: false },
	{ value: 'bottoming', key: 'setup.issueBottoming', selected: false },
];

/** Props for the setup shell card, no extra data needed. */
export type SetupShellCardOptions = CardOptions;

/**
 * @brief Owns the static shell; dynamic regions are filled by renderers.
 * @brief Interoperates with the global accordion binder via data attributes.
 */
export class SetupGuideShellCard extends Card<SetupShellCardOptions> {
	/**
	 * @brief Receive optional shell props, defaulting to open.
	 * @param options Shell props, may be omitted.
	 * @return void
	 */
	constructor(options: SetupShellCardOptions = {}) {
		super(options);
	}

	/**
	 * @brief Build the card shell with header, selects and mount points.
	 * @return Detached shell element.
	 */
	render(): HTMLElement {
		const open = this.isOpen();
		const card = createEl('div', 'card border border-border rounded-xl p-4');
		const accordion = createEl('div');
		accordion.dataset.accordion = 'setup';
		const header = createEl('div', 'section-header');
		header.dataset.accordionHeader = '';
		const titleRow = createEl('div', 'flex items-center gap-2 min-w-0');
		titleRow.append(createEl('span', 'w-2 h-2 rounded-full bg-neon-cyan'));
		titleRow.append(createEl('span', 'text-sm font-semibold text-text-main', 'setup.title'));
		titleRow.append(createEl('span', 'text-[10px] text-text-dim whitespace-nowrap', 'setup.note'));
		header.append(titleRow, this.buildChevron(open));
		const content = createEl('div', open ? 'section-content open' : 'section-content');
		content.dataset.accordionContent = '';
		const guide = createEl('div', 'setup-guide pt-1');
		guide.appendChild(createEl('h3', 'setup-h3', 'setup.wizardTitle'));
		const grid = createEl('div', 'grid grid-cols-2 gap-4');
		grid.append(this.buildSelect('setup-phase', 'setup.phaseLabel', PHASE_OPTIONS));
		grid.append(this.buildSelect('setup-issue', 'setup.issueLabel', ISSUE_OPTIONS));
		guide.appendChild(grid);
		guide.appendChild(createEl('h4', 'setup-h4', 'setup.resultTitle'));
		const result = createEl('div', 'setup-result');
		result.id = 'setup-result';
		guide.appendChild(result);
		guide.appendChild(createEl('h3', 'setup-h3', 'setup.feelTitle'));
		const feel = createEl('div', 'setup-feel');
		feel.id = 'setup-feel';
		guide.appendChild(feel);
		guide.appendChild(createEl('h3', 'setup-h3', 'setup.procedureTitle'));
		const procedure = createEl('div', 'setup-procedure');
		procedure.id = 'setup-procedure';
		guide.appendChild(procedure);
		content.appendChild(guide);
		accordion.append(header, content);
		card.appendChild(accordion);
		return card;
	}

	/**
	 * @brief Build the accordion chevron icon.
	 * @param open Current open state for the icon class.
	 * @return SVG chevron matching the shell accordions.
	 */
	private buildChevron(open: boolean): SVGSVGElement {
		const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		svg.setAttribute('class', open ? 'chevron open' : 'chevron');
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
	}

	/**
	 * @brief Build one labelled wizard select with localised options.
	 * @param id Select element id referenced by refs and label.
	 * @param labelKey Dictionary key for the label text.
	 * @param options Option descriptors with values and defaults.
	 * @return Wrapped label plus select column.
	 */
	private buildSelect(id: string, labelKey: DictKey, options: SetupShellOption[]): HTMLElement {
		const wrap = createEl('div', 'col-span-2 sm:col-span-1');
		const label = createEl('label', 'block text-xs font-medium text-text-dim mb-1', labelKey);
		label.setAttribute('for', id);
		const select = document.createElement('select');
		select.id = id;
		select.className = 'w-full bg-surface-input border border-surface-border rounded-lg px-3 py-2 text-xs text-text-output font-mono focus:outline-none focus:border-text-dim';
		for (const opt of options) {
			const node = document.createElement('option');
			node.value = opt.value;
			node.dataset.i18n = opt.key;
			node.selected = opt.selected;
			select.appendChild(node);
		}
		wrap.append(label, select);
		return wrap;
	}
}
