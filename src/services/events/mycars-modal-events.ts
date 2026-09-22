/**
 * @file mycars-modal-events.ts
 * @brief Bottom-sheet modal for the My Cars custom presets.
 */
import type { ElementRefs } from '../dom/element-refs';

/**
 * Wire open/close events for the My Cars bottom-sheet modal.
 * @brief Click trigger, backdrop, close button, escape key.
 * @param refs Typed DOM handles.
 * @return void
 */
export const bindMyCarsModalEvents = (refs: ElementRefs): void => {
	const { btnMyCars, myCarsModal, myCarsModalBackdrop, myCarsModalClose } = refs;
	let trigger: HTMLElement | null = null;

	const open = (): void => {
		trigger = document.activeElement as HTMLElement;
		myCarsModalBackdrop.classList.remove('hidden');
		myCarsModal.classList.remove('hidden');
		// allow CSS transition to kick in
		requestAnimationFrame(() => {
			myCarsModal.classList.add('open');
			myCarsModalBackdrop.classList.add('open');
		});
		document.body.style.overflow = 'hidden';
		myCarsModalClose.focus();
	};

	const close = (): void => {
		myCarsModal.classList.remove('open');
		myCarsModalBackdrop.classList.remove('open');
		// wait for transition to finish before hiding
		setTimeout(() => {
			myCarsModal.classList.add('hidden');
			myCarsModalBackdrop.classList.add('hidden');
		}, 300);
		document.body.style.overflow = '';
		if (trigger) {
			trigger.focus();
			trigger = null;
		}
	};

	btnMyCars.addEventListener('click', open);
	myCarsModalClose.addEventListener('click', close);
	myCarsModalBackdrop.addEventListener('click', close);

	document.addEventListener('keydown', (e) => {
		if (e.key === 'Escape' && !myCarsModal.classList.contains('hidden')) {
			close();
		}
	});
};