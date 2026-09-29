/**
 * @file accordion-events.ts
 * @brief Collapsible accordion sections for the vehicle setup card.
 */
import type { ElementRefs } from '../dom/element-refs';
import { syncAccordionHeight, syncOpenAccordionHeights } from '../dom/accordion-height';
import { debounce } from '../../core/debounce';

/**
 * Wire click-to-toggle on every [data-accordion] section.
 * @brief Headers act as buttons for mouse, touch and keyboard users.
 * @brief Open heights are re-synced at bind time, on font load and on resize
 * @brief so the collapse transition always matches the real content height.
 * @param refs Unused but kept for signature consistency.
 * @return void
 */
export const bindAccordionEvents = (_refs: ElementRefs): void => {
	syncOpenAccordionHeights();
	if (document.fonts) {
		document.fonts.ready.then(() => syncOpenAccordionHeights());
	}
	window.addEventListener('resize', debounce(() => syncOpenAccordionHeights(), 150));
	const sections = document.querySelectorAll<HTMLElement>('[data-accordion]');
	sections.forEach((section) => {
		const header = section.querySelector<HTMLElement>('[data-accordion-header]');
		const content = section.querySelector<HTMLElement>('[data-accordion-content]');
		const chevron = section.querySelector<HTMLElement>('[data-chevron]');
		if (!header || !content) {
			return;
		}
		header.setAttribute('tabindex', '0');
		header.setAttribute('role', 'button');
		header.setAttribute('aria-expanded', String(content.classList.contains('open')));
		header.addEventListener('click', (e) => {
			// ignore clicks on form controls inside the header
			const target = e.target as HTMLElement;
			if (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'BUTTON') {
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
			section?.querySelector('[data-accordion-header]')?.setAttribute('aria-expanded', 'true');
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
	header.setAttribute('aria-expanded', String(content.classList.contains('open')));
};