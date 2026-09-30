/**
 * @file accordion-events.ts
 * @brief Collapsible accordion sections for the vehicle setup card.
 */
import type { ElementRefs } from '../dom/element-refs';
import { observeAccordionHeights, syncAccordionHeight, syncOpenAccordionHeights } from '../dom/accordion-height';
import { debounce } from '../../core/debounce';

/**
 * Wire click-to-toggle on every [data-accordion] section.
 * @brief Headers act as buttons for mouse, touch and keyboard users.
 * @brief Open heights are re-synced at bind time, on font load, on resize and
 * @brief through the document mutation observer, so the collapse transition
 * @brief always matches the real content height.
 * @param refs Unused but kept for signature consistency.
 * @return void
 */
export const bindAccordionEvents = (_refs: ElementRefs): void => {
	syncOpenAccordionHeights();
	observeAccordionHeights();
	if (document.fonts) {
		document.fonts.ready.then(() => syncOpenAccordionHeights());
	}
	window.addEventListener('resize', debounce(() => syncOpenAccordionHeights(), 150));
	// `<details>` toggles change height without a class mutation.
	document.querySelectorAll<HTMLDetailsElement>('details.accordion').forEach((details) => {
		details.addEventListener('toggle', () => syncOpenAccordionHeights());
	});
	const sections = document.querySelectorAll<HTMLElement>('[data-accordion]');
	sections.forEach((section) => {
		const header = section.querySelector<HTMLElement>('[data-accordion-header]');
		const content = section.querySelector<HTMLElement>('[data-accordion-content]');
		const chevron = section.querySelector<HTMLElement>('[data-chevron]');
		if (!header || !content) {
			return;
		}
		if (header.querySelector('input, select, button, a[href], textarea')) {
			bindHeaderToggle(section, header, content, chevron);
		} else {
			header.setAttribute('tabindex', '0');
			header.setAttribute('role', 'button');
			header.setAttribute('aria-expanded', String(content.classList.contains('open')));
		}
		header.addEventListener('click', (e) => {
			const target = e.target as HTMLElement;
			if (target.closest('input, select, button, a[href], textarea')) {
				return;
			}
			toggleSection(header, content, chevron);
		});
		header.addEventListener('keydown', (e) => {
			const target = e.target as HTMLElement;
			if (target !== header || (e.key !== 'Enter' && e.key !== ' ')) {
				return;
			}
			e.preventDefault();
			toggleSection(header, content, chevron);
		});
	});
};

/**
 * @brief Give headers with form controls a separate keyboard-accessible toggle.
 * @param section Accordion section that owns the header.
 * @param header Header containing interactive controls.
 * @param content Collapsible section body.
 * @param chevron Existing indicator moved into the toggle.
 * @return void
 */
const bindHeaderToggle = (
	section: HTMLElement,
	header: HTMLElement,
	content: HTMLElement,
	chevron: HTMLElement | null,
): void => {
	const button = document.createElement('button');
	button.type = 'button';
	button.className = 'accordion-toggle';
	button.setAttribute('aria-expanded', String(content.classList.contains('open')));
	const label = header.querySelector<HTMLElement>('[data-i18n]');
	if (label) {
		label.id ||= `accordion-label-${section.dataset.accordion}`;
		button.setAttribute('aria-labelledby', label.id);
	} else {
		button.setAttribute('aria-label', header.textContent?.trim() ?? '');
	}
	if (chevron) {
		button.appendChild(chevron);
	}
	header.appendChild(button);
	button.addEventListener('click', () => toggleSection(header, content, chevron));
};

/**
 * @brief Open every collapsed accordion ancestor of an element.
 * @brief Keeps nav scrolling useful when a parent card is collapsed.
 * @param el Target element inside nested accordions.
 * @return void
 */
export const openAccordionTree = (el: HTMLElement): void => {
	let node: HTMLElement | null = el.parentElement;
	while (node) {
		if (node.hasAttribute('data-accordion-content') && !node.classList.contains('open')) {
			node.classList.add('open');
			syncAccordionHeight(node);
			const section = node.parentElement;
			section?.querySelector('[data-accordion-header][role="button"]')?.setAttribute('aria-expanded', 'true');
			section?.querySelector('.accordion-toggle')?.setAttribute('aria-expanded', 'true');
			section?.querySelector('[data-chevron]')?.classList.add('open');
		}
		node = node.parentElement;
	}
};

/**
 * @brief Toggle one accordion section and its expanded state.
 * @param header Section header acting as the button.
 * @param content Collapsible section body.
 * @param chevron Optional chevron icon, null when absent.
 * @return void
 */
const toggleSection = (header: HTMLElement, content: HTMLElement, chevron: HTMLElement | null): void => {
	content.classList.toggle('open');
	syncAccordionHeight(content);
	if (chevron) {
		chevron.classList.toggle('open');
	}
	if (header.getAttribute('role') === 'button') {
		header.setAttribute('aria-expanded', String(content.classList.contains('open')));
	}
	header.querySelector('.accordion-toggle')?.setAttribute('aria-expanded', String(content.classList.contains('open')));
};