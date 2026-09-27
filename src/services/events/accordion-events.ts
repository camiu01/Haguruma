/**
 * @file accordion-events.ts
 * @brief Collapsible accordion sections for the vehicle setup card.
 */
import type { ElementRefs } from '../dom/element-refs';

/**
 * Wire click-to-toggle on every [data-accordion] section.
 * @brief Headers act as buttons for mouse, touch and keyboard users.
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
 * @brief Toggle one accordion section and its expanded state.
 * @param header Section header acting as the button.
 * @param content Collapsible section body.
 * @param chevron Optional chevron icon, null when absent.
 * @return void
 */
const toggleSection = (header: HTMLElement, content: HTMLElement, chevron: HTMLElement | null): void => {
	content.classList.toggle('open');
	if (chevron) {
		chevron.classList.toggle('open');
	}
	header.setAttribute('aria-expanded', String(content.classList.contains('open')));
};