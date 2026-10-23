/**
 * @file mobile-drawer-events.ts
 * @brief Slide-over drawer hosting garage, settings and share on every viewport.
 */
import type { ElementRefs } from '../dom/element-refs';
import { trapTabKey } from '../dom/focus-trap';
import { openAccordionTree } from './accordion-events';
import { t } from '../../core/i18n/language';

/** Element focused before the drawer opened, restored on close. */
let lastFocused: HTMLElement | null = null;

/**
 * Wire the drawer open/close interactions and navigation data-view buttons.
 * @brief Controls live in the drawer permanently; nav buttons scroll to sections.
 * @param refs Cached DOM handles.
 * @return void
 */
export const bindDrawerEvents = (refs: ElementRefs): void => {
	refs.btnMenu.addEventListener('click', () => {
		if (isOpen(refs)) {
			closeDrawer(refs);
		} else {
			openDrawer(refs);
		}
	});
	refs.mobileDrawerClose.addEventListener('click', () => closeDrawer(refs));
	refs.mobileDrawerBackdrop.addEventListener('click', () => closeDrawer(refs));
	refs.btnMyCars.addEventListener('click', () => closeDrawer(refs));
	document.addEventListener('keydown', (e: KeyboardEvent) => {
		if (e.key === 'Escape' && isOpen(refs)) {
			closeDrawer(refs);
			return;
		}
		if (e.key === 'Tab' && isOpen(refs)) {
			trapTabKey(refs.mobileDrawer, e);
		}
	});
	refs.presetSelector.addEventListener('change', () => {
		if (isOpen(refs)) {
			closeDrawer(refs);
		}
	});
	bindNavViewButtons(refs);
};

/**
 * Check whether the drawer is currently visible.
 * @brief Single source of truth for the open-class toggle.
 * @param refs Cached DOM handles.
 * @return True when the drawer is open.
 */
const isOpen = (refs: ElementRefs): boolean => {
	return refs.mobileDrawer.classList.contains('open');
};

/**
 * Sync hamburger expanded state and accessible label.
 * @brief Keeps aria-expanded/controls truthful for screen readers.
 * @param refs Cached DOM handles.
 * @param open Current drawer visibility.
 * @return void
 */
const syncMenuButton = (refs: ElementRefs, open: boolean): void => {
	refs.btnMenu.setAttribute('aria-expanded', String(open));
	const label = open ? t('menu.close') : t('menu.open');
	refs.btnMenu.setAttribute('aria-label', label);
	refs.btnMenu.title = label;
	refs.btnMenu.setAttribute('data-tip', label);
};

/**
 * Data-view button handler — scrolls to the matching section, closes drawer.
 * @brief Matches data-view values to section selectors for smooth scrolling.
 * @param refs Cached DOM handles.
 * @return void
 */
const bindNavViewButtons = (refs: ElementRefs): void => {
	const targets: Record<string, string> = {
		dashboard: '[data-accordion="primary"]',
		primaryCar: '[data-accordion="primary"]',
		gears: '[data-accordion="gears"]',
		engine: '[data-accordion="engine"]',
		aero: '[data-accordion="road"]',
		compare: '[data-accordion="compare"]',
		secondaryCar: '[data-accordion="compare"]',
		dynamics: '#running-gear-accordion',
		setup: '#setup-guide-mount',
		handbook: '[data-accordion="handbook"]',
		pyrometer: '#pyrometer-mount',
		cruise: '[data-accordion="cruise"]',
		tools: '#cruise-mount',
		presets: '#preset-anchor',
	};
	document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((btn) => {
		btn.addEventListener('click', () => {
			const view = btn.dataset.view;
			if (!view || !targets[view]) {
				return;
			}
			const el = document.querySelector(targets[view]) as HTMLElement | null;
			if (el) {
				openAccordionTree(el);
				el.scrollIntoView({ behavior: 'smooth', block: 'start' });
			}
			if (isOpen(refs)) {
				closeDrawer(refs);
			}
		});
	});
};

/**
 * Open the drawer with scroll lock and focus management.
 * @brief Focus moves to the close button for keyboard users.
 * @param refs Cached DOM handles.
 * @return void
 */
const openDrawer = (refs: ElementRefs): void => {
	if (isOpen(refs)) {
		return;
	}
	lastFocused = document.activeElement as HTMLElement | null;
	refs.mobileDrawerBackdrop.classList.remove('hidden');
	refs.mobileDrawer.classList.remove('hidden');
	requestAnimationFrame(() => refs.mobileDrawer.classList.add('open'));
	document.body.style.overflow = 'hidden';
	syncMenuButton(refs, true);
	refs.mobileDrawerClose.focus();
};

/**
 * Close the drawer and restore focus.
 * @brief Returns focus to the opener.
 * @param refs Cached DOM handles.
 * @return void
 */
const closeDrawer = (refs: ElementRefs): void => {
	if (refs.mobileDrawer.classList.contains('hidden')) {
		return;
	}
	refs.mobileDrawer.classList.remove('open');
	refs.mobileDrawer.classList.add('hidden');
	refs.mobileDrawerBackdrop.classList.add('hidden');
	document.body.style.overflow = '';
	syncMenuButton(refs, false);
	if (lastFocused && document.contains(lastFocused)) {
		lastFocused.focus();
	}
	lastFocused = null;
};
