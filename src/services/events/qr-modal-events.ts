/**
 * @file qr-modal-events.ts
 * @brief Bottom-sheet modal showing the setup share URL as a QR code.
 */
import { buildShareUrl, syncUrlHash } from '../../core/share/share-utils';
import { qrSvg } from '../../core/share/qr-svg';
import { t } from '../../core/i18n/language';
import type { ElementRefs } from '../dom/element-refs';
import { trapTabKey } from '../dom/focus-trap';

/**
 * Wire open/close events for the QR share modal.
 * @brief QR trigger, backdrop, close button, escape key; code rendered on open.
 * @param refs Typed DOM handles.
 * @return void
 */
export const bindQrModalEvents = (refs: ElementRefs): void => {
	const { btnQr, qrModal, qrModalBackdrop, qrModalClose, qrImage } = refs;
	let trigger: HTMLElement | null = null;

	const open = (): void => {
		trigger = document.activeElement as HTMLElement;
		syncUrlHash();
		const svg = qrSvg(buildShareUrl(), 5);
		qrImage.innerHTML = '';
		if (svg) {
			qrImage.innerHTML = svg;
		} else {
			qrImage.textContent = t('share.qrTooLong');
		}
		qrModalBackdrop.classList.remove('hidden');
		qrModal.classList.remove('hidden');
		requestAnimationFrame(() => {
			qrModal.classList.add('open');
			qrModalBackdrop.classList.add('open');
		});
		document.body.style.overflow = 'hidden';
		qrModalClose.focus();
	};

	const close = (): void => {
		qrModal.classList.remove('open');
		qrModalBackdrop.classList.remove('open');
		setTimeout(() => {
			qrModal.classList.add('hidden');
			qrModalBackdrop.classList.add('hidden');
		}, 300);
		document.body.style.overflow = '';
		if (trigger) {
			trigger.focus();
			trigger = null;
		}
	};

	btnQr.addEventListener('click', open);
	qrModalClose.addEventListener('click', close);
	qrModalBackdrop.addEventListener('click', close);

	document.addEventListener('keydown', (e) => {
		if (qrModal.classList.contains('hidden')) {
			return;
		}
		if (e.key === 'Escape') {
			close();
			return;
		}
		if (e.key === 'Tab') {
			trapTabKey(qrModal, e);
		}
	});
};
