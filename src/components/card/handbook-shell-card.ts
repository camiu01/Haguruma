/**
 * @file handbook-shell-card.ts
 * @brief Static setup handbook shell: feel guide plus procedure steps.
 */
import { Card, createEl } from './base-card';
import type { CardOptions } from './base-card';

/** Props for the handbook shell card, no extra data needed. */
export type HandbookShellCardOptions = CardOptions;

/**
 * @brief Owns the static handbook shell; regions filled by renderers.
 * @brief Interoperates with the global accordion binder via data attributes.
 */
export class HandbookShellCard extends Card<HandbookShellCardOptions> {
	/**
	 * @brief Receive optional shell props, defaulting to open.
	 * @param options Shell props, may be omitted.
	 * @return void
	 */
	constructor(options: HandbookShellCardOptions = {}) {
		super(options);
	}

	/**
	 * @brief Build the handbook accordion (host card owns the outer frame).
	 * @return Detached accordion element.
	 */
	render(): HTMLElement {
		const open = this.isOpen();
		const accordion = createEl('div');
		accordion.dataset.accordion = 'handbook';
		const header = createEl('div', 'section-header');
		header.dataset.accordionHeader = '';
		const titleRow = createEl('div', 'flex items-center gap-2 min-w-0');
		titleRow.append(createEl('span', 'w-2 h-2 rounded-full bg-neon-purple'));
		titleRow.append(createEl('span', 'text-sm font-semibold text-text-main', 'setup.handbookTitle'));
		header.append(titleRow, this.buildChevron(open));
		const content = createEl('div', open ? 'section-content open' : 'section-content');
		content.dataset.accordionContent = '';
		const guide = createEl('div', 'setup-guide pt-1');
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
		return accordion;
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
}
