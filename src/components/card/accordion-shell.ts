/**
 * @file accordion-shell.ts
 * @brief Shared accordion section and tool-card chrome builder.
 *
 * Every tool card repeats the same recipe: an optional stacked card, a boxed
 * accordion, a titled header with an optional accent dot, optional note and
 * live pill, and a padded body. The shell owns that markup so tool modules
 * only supply their body content.
 */
import type { DictKey } from '../../core/i18n/dictionaries';
import { t } from '../../core/i18n/language';
import { createEl } from './base-card';

/** Header inputs shared by plain sections and tool cards. */
export interface SectionHeaderOptions {
	/** Title dictionary key rendered in the header. */
	title: DictKey;
	/** Accent classes of the leading dot; defaults to neon cyan, `null` omits it. */
	dot?: string | null;
	/** Optional muted note rendered right of the title. */
	note?: DictKey;
	/** Live element such as a verdict pill placed before the chevron. */
	middle?: Node;
}

/** Section inputs: header inputs plus the collapsible body. */
export interface SectionOptions extends SectionHeaderOptions {
	/** `data-accordion` key naming the section. */
	id: string;
	/** Body node appended to the content area; an element or a fragment. */
	body: Node;
	/** Extra content classes; padding comes from the shared CSS rule. */
	bodyClass?: string;
	/** Start collapsed; defaults to open. */
	open?: boolean;
}

/** Tool card inputs: section inputs plus the card chrome toggle. */
export interface ToolShellOptions extends SectionOptions {
	/** Wrap the accordion in the stacked tool card; defaults to true. */
	stack?: boolean;
}

/**
 * @brief Build the shared accordion chevron icon.
 * @param none No parameters.
 * @return SVG chevron already marked open for the initial paint.
 */
export const buildChevron = (): SVGSVGElement => {
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
 * @brief Build the accordion header: optional dot, title, note, pill, chevron.
 * @param options Header inputs; `dot: null` drops the accent dot.
 * @return Header element picked up by the shared accordion binder.
 */
export const buildSectionHeader = (options: SectionHeaderOptions): HTMLElement => {
	const header = createEl('div', 'section-header');
	header.dataset.accordionHeader = '';
	const left = createEl('div', 'section-head');
	if (options.dot !== null) {
		left.append(createEl('span', `section-dot ${options.dot ?? 'text-neon-cyan'}`));
	}
	const title = createEl('span', 'section-title', options.title);
	title.textContent = t(options.title);
	left.append(title);
	if (options.note) {
		const note = createEl('span', 'section-note', options.note);
		note.textContent = t(options.note);
		left.append(note);
	}
	header.append(left);
	if (options.middle) {
		header.append(options.middle);
	}
	header.append(buildChevron());
	return header;
};

/**
 * @brief Build one collapsible accordion section with the shared header.
 * @param options Section inputs describing header and body.
 * @return Section element picked up by the shared accordion binder.
 */
export const buildAccordionSection = (options: SectionOptions): HTMLElement => {
	const section = createEl('div');
	section.dataset.accordion = options.id;
	const content = createEl('div', `section-content${options.open === false ? '' : ' open'}${options.bodyClass ? ` ${options.bodyClass}` : ''}`);
	content.dataset.accordionContent = '';
	content.append(options.body);
	section.append(buildSectionHeader(options), content);
	return section;
};

/**
 * @brief Build a collapsible accordion, optionally wrapped in the stacked card.
 * @brief Panel chrome comes from the shared `[data-accordion]` recipe, so a
 * @brief single-section tool renders a banded header while a card-level shell
 * @brief that wraps sibling sections (setup) renders the flat title row.
 * @param options Section inputs plus the card chrome toggle.
 * @return Card element when stacked, bare section otherwise.
 */
export const buildToolShell = (options: ToolShellOptions): HTMLElement => {
	const section = buildAccordionSection(options);
	if (options.stack === false) {
		return section;
	}
	const card = createEl('div', 'card card-container card--stack');
	card.append(section);
	return card;
};
