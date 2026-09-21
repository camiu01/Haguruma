/**
 * @file share-events.ts
 * @brief Shareable URL handling with clipboard copy.
 */
import { state } from '../../core/state/app-state';
import { applySharedState, buildShareUrl, decodeState, syncUrlHash } from '../../core/share/share-utils';
import { formatCompGears } from '../../core/compare/compare-utils';
import { t } from '../../core/i18n/language';
import type { ElementRefs } from '../dom/element-refs';
import { renderGearsList } from '../../components/gear-list';
import { syncComparisonInputs, applyComparisonVisibility } from './comparison-events';
import { syncEngineInputs } from './engine-events';
import { syncRoadLoadInputs } from './road-load-events';
import { applyUnitLabels, syncUnitToggle } from './unit-events';

/**
 * Bind the header share button.
 * @purpose Copy the current setup URL to the clipboard.
 * @param refs Cached DOM handles.
 * @return void
 */
export const bindShareEvents = (refs: ElementRefs): void => {
	refs.btnShare.addEventListener('click', () => {
		void copyShareUrl(refs);
	});
};

/**
 * Copy the shareable URL and show inline feedback.
 * @brief Falls back to prompt-less textarea copy when needed.
 * @param refs Cached DOM handles.
 * @return void
 */
const copyShareUrl = async (refs: ElementRefs): Promise<void> => {
	syncUrlHash();
	const url = buildShareUrl();
	const ok = await writeClipboard(url);
	refs.shareFeedback.textContent = ok ? t('share.copied') : t('share.failed');
	refs.shareFeedback.classList.remove('hidden');
	window.setTimeout(() => {
		refs.shareFeedback.classList.add('hidden');
	}, 2000);
};

/**
 * Write text via Clipboard API with textarea fallback.
 * @brief Support non-secure contexts where navigator.clipboard is missing.
 * @param text URL to copy.
 * @return True when the copy succeeded.
 */
const writeClipboard = async (text: string): Promise<boolean> => {
	try {
		if (navigator.clipboard?.writeText) {
			await navigator.clipboard.writeText(text);
			return true;
		}
	} catch {
		return fallbackCopy(text);
	}
	return fallbackCopy(text);
};

/**
 * Copy via a temporary hidden textarea.
 * @brief Legacy fallback for clipboard access.
 * @param text URL to copy.
 * @return True when execCommand succeeded.
 */
const fallbackCopy = (text: string): boolean => {
	try {
		const area = document.createElement('textarea');
		area.value = text;
		area.style.position = 'fixed';
		area.style.opacity = '0';
		document.body.appendChild(area);
		area.select();
		const ok = document.execCommand('copy');
		area.remove();
		return ok;
	} catch {
		return false;
	}
};

/**
 * Restore state from the URL hash on first load.
 * @brief Apply shared setups before the first render, unit and theme stay local.
 * @param refs Cached DOM handles.
 * @param render Full refresh callback.
 * @return void
 */
export const restoreFromUrl = (refs: ElementRefs, render: () => void): void => {
	const patch = decodeState(window.location.hash);
	if (!applySharedState(patch)) {
		return;
	}
	syncPrimaryInputs(refs);
	refs.comparisonToggle.checked = state.compareEnabled;
	syncComparisonInputs(refs);
	applyComparisonVisibility(refs);
	syncRoadLoadInputs(refs);
	syncEngineInputs(refs);
	syncUnitToggle(refs);
	applyUnitLabels(refs);
	renderGearsList(refs, () => render());
};

/**
 * Sync primary inputs from state.
 * @brief Keep DOM aligned after URL restore.
 * @param refs Cached DOM handles.
 * @return void
 */
const syncPrimaryInputs = (refs: ElementRefs): void => {
	refs.primaryTire.value = state.primaryTire;
	refs.primaryFd.value = String(state.primaryFd);
	refs.primaryRedline.value = String(state.primaryRedline);
	refs.graphMaxSpeed.value = String(state.maxGraphSpeed);
	refs.compGears.value = formatCompGears(state.compGears);
};
