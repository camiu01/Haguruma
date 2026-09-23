/**
 * @file mobile-drawer-events.ts
 * @brief Left slide-over drawer relocating header controls on mobile.
 */
import type { ElementRefs } from '../dom/element-refs';
import { t } from '../../core/i18n/language';

/** Element focused before the drawer opened, restored on close. */
let lastFocused: HTMLElement | null = null;

/** Original header slots used to restore relocated controls on close. */
let homes: { el: HTMLElement; parent: HTMLElement; next: ChildNode | null }[] = [];

/**
 * Wire the mobile drawer open/close interactions and navigation data-view buttons.
 * @brief Controls relocate into drawer hosts; nav buttons scroll to sections.
 * @param refs Cached DOM handles.
 * @return void
 */
export const bindDrawerEvents = (refs: ElementRefs): void => {
	refs.btnMenu.addEventListener('click', () => {
		if (!isMobileViewport()) {
			return;
		}
		if (isOpen(refs)) {
			closeDrawer(refs);
		} else {
			openDrawer(refs);
		}
	});
	refs.mobileDrawerClose.addEventListener('click', () => closeDrawer(refs));
	refs.mobileDrawerBackdrop.addEventListener('click', () => closeDrawer(refs));
	document.addEventListener('keydown', (e: KeyboardEvent) => {
		if (e.key === 'Escape' && isOpen(refs)) {
			closeDrawer(refs);
		}
	});
	refs.presetSelector.addEventListener('change', () => {
		if (isOpen(refs) && isMobileViewport()) {
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
 * Check for the mobile viewport where the drawer is active.
 * @brief Guards relocation so desktop keeps inline header controls.
 * @return True below 768px.
 */
const isMobileViewport = (): boolean => {
	return window.matchMedia('(max-width: 767px)').matches;
};

/**
 * Remember an element home slot before relocating it.
 * @brief Skips duplicates so repeated opens stay idempotent.
 * @param el Element being relocated.
 * @return void
 */
const rememberHome = (el: HTMLElement): void => {
	if (homes.some((h) => h.el === el)) {
		return;
	}
	const parent = el.parentElement;
	if (parent) {
		homes.push({ el, parent, next: el.nextSibling });
	}
};

/**
 * Move one element into a drawer host.
 * @brief Keeps live nodes (no clones) so listeners keep working.
 * @param el Element to move.
 * @param host Drawer host receiving the element.
 * @return void
 */
const moveInto = (el: HTMLElement, host: HTMLElement): void => {
	if (el.parentElement === host) {
		return;
	}
	rememberHome(el);
	host.appendChild(el);
};

/**
 * Relocate header controls into the drawer hosts.
 * @brief Language, unit and preset groups share the slide-over.
 * @param refs Cached DOM handles.
 * @return void
 */
const relocateIntoDrawer = (refs: ElementRefs): void => {
	showInDrawer(refs.langGroup);
	showInDrawer(refs.unitGroup);
	refs.presetSelector.classList.remove('hidden');
	refs.presetSelector.classList.add('block', 'w-full');
	moveInto(refs.langGroup, refs.drawerLangHost);
	moveInto(refs.unitGroup, refs.drawerUnitHost);
	moveInto(refs.presetSelector, refs.drawerPresetHost);
};

/**
 * Reveal a relocated group inside the drawer.
 * @brief Hidden header groups become flex rows once moved.
 * @param el Group element to reveal.
 * @return void
 */
const showInDrawer = (el: HTMLElement): void => {
	el.classList.remove('hidden');
	el.classList.add('inline-flex');
};

/**
 * Restore relocated controls to their header slots.
 * @brief Runs on every close; desktop CSS hides the drawer itself.
 * @param refs Cached DOM handles.
 * @return void
 */
const restoreHomes = (refs: ElementRefs): void => {
	for (const home of homes) {
		home.parent.insertBefore(home.el, home.next);
	}
	homes = [];
	hideInHeader(refs.langGroup);
	hideInHeader(refs.unitGroup);
	refs.presetSelector.classList.add('hidden');
	refs.presetSelector.classList.remove('block', 'w-full');
};

/**
 * Hide a group again once it returns to the header.
 * @brief Desktop CSS keeps these hidden until md breakpoints.
 * @param el Group element to hide.
 * @return void
 */
const hideInHeader = (el: HTMLElement): void => {
	el.classList.add('hidden');
	el.classList.remove('inline-flex');
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
 * Data-view button handler — scrolls to the matching section, closes drawer on mobile.
 * @brief Matches data-view values to section selectors for smooth scrolling.
 * @param refs Cached DOM handles.
 * @return void
 */
const bindNavViewButtons = (refs: ElementRefs): void => {
	const targets: Record<string, string> = {
		dashboard: '[data-accordion="primary"]',
		gears: '[data-accordion="gears"]',
		engine: '[data-accordion="engine"]',
		aero: '[data-accordion="road"]',
		compare: '[data-accordion="compare"]',
		dynamics: '#running-gear-accordion',
	};
	document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((btn) => {
		btn.addEventListener('click', () => {
			const view = btn.dataset.view;
			if (!view || !targets[view]) {
				return;
			}
			const el = document.querySelector(targets[view]) as HTMLElement | null;
			if (el) {
				el.scrollIntoView({ behavior: 'smooth', block: 'start' });
			}
			if (isMobileViewport() && isOpen(refs)) {
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
	if (isMobileViewport()) {
		relocateIntoDrawer(refs);
	}
	refs.mobileDrawerBackdrop.classList.remove('hidden');
	refs.mobileDrawer.classList.remove('hidden');
	requestAnimationFrame(() => refs.mobileDrawer.classList.add('open'));
	document.body.style.overflow = 'hidden';
	syncMenuButton(refs, true);
	refs.mobileDrawerClose.focus();
};

/**
 * Close the drawer and restore controls and focus.
 * @brief Returns controls to the header and focus to the opener.
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
	restoreHomes(refs);
	syncMenuButton(refs, false);
	if (lastFocused && document.contains(lastFocused)) {
		lastFocused.focus();
	}
	lastFocused = null;
};
