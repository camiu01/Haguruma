/**
 * @file accordion-events.ts
 * @brief Collapsible accordion sections for the vehicle setup card.
 */
import type { ElementRefs } from '../dom/element-refs';

/**
 * Wire click-to-toggle on every [data-accordion] section.
 * @brief Toggles open class on header, content, and chevron.
 * @param refs Unused but kept for signature consistency.
 * @return void
 */
export const bindAccordionEvents = (_refs: ElementRefs): void => {
	const sections = document.querySelectorAll<HTMLElement>('[data-accordion]');
	sections.forEach((section) => {
		const header = section.querySelector<HTMLElement>('[data-accordion-header]');
		const content = section.querySelector<HTMLElement>('[data-accordion-content]');
		const chevron = section.querySelector<HTMLElement>('[data-chevron]');
		if (!header || !content) {
			return;
		}
		header.addEventListener('click', (e) => {
			// ignore clicks on form controls inside the header
			const target = e.target as HTMLElement;
			if (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'BUTTON') {
				return;
			}
			content.classList.toggle('open');
			if (chevron) {
				chevron.classList.toggle('open');
			}
		});
	});
};