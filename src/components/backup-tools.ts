/**
 * @file backup-tools.ts
 * @brief Local JSON backup and explicit restore controls.
 */
import { exportStateBackup, parseStateBackup, restoreStateBackup } from '../core/presets/backup-store';
import { downloadTextFile } from '../services/graph/drivetrain-export';
import { toolSection, toolButton, toolOutput } from './tool-form';
import { t } from '../core/i18n/language';
import { setHapticsEnabled, setScreenAwake } from '../services/hardware/device-feedback';

/**
 * @brief Add backup import with a preview-before-apply step.
 * @param host Tools mount.
 * @return void
 */
export const injectBackupTools = (host: HTMLElement): void => {
	const form = toolSection(host, 'backup.title');
	const output = toolOutput(form);
	toolButton(form, 'backup.export', () => {
		try { downloadTextFile(exportStateBackup(localStorage), 'haguruma-backup.json', 'application/json'); }
		catch { output.textContent = t('backup.storageError'); }
	});
	const label = document.createElement('label');
	const text = document.createElement('span');
	text.dataset.i18n = 'backup.file';
	text.textContent = t('backup.file');
	const input = document.createElement('input');
	input.type = 'file'; input.accept = '.json,application/json'; input.name = 'backup';
	label.append(text, input);
	form.append(label);
	let pending: Record<string, string> | null = null;
	const apply = toolButton(form, 'backup.apply', () => {
		if (!pending) return;
		const ok = restoreStateBackup(localStorage, pending);
		output.textContent = t(ok ? 'backup.restored' : 'backup.storageError');
		apply.disabled = true;
		pending = null;
	});
	apply.disabled = true;
	input.addEventListener('change', () => {
		const file = input.files?.[0];
		pending = null; apply.disabled = true;
		if (!file || file.size > 2_000_000) { output.textContent = t('backup.invalid'); return; }
		void file.text().then((value) => {
			pending = parseStateBackup(value);
			apply.disabled = !pending;
			output.textContent = t(pending ? 'backup.preview' : 'backup.invalid');
		}).catch(() => { output.textContent = t('backup.invalid'); });
	});
};

/**
 * @brief Mount explicit screen-awake and haptics actions.
 * @param host Tools mount.
 * @return void
 */
export const injectHardwareTools = (host: HTMLElement): void => {
	const form = toolSection(host, 'hardware.title');
	const output = toolOutput(form);
	let awake = false;
	let haptics = false;
	const wakeButton = toolButton(form, 'hardware.awake', () => {
		wakeButton.disabled = true;
		void setScreenAwake(!awake).then((ok) => {
			if (ok) awake = !awake;
			wakeButton.setAttribute('aria-pressed', String(awake));
			output.textContent = t(ok ? awake ? 'hardware.awakeOn' : 'hardware.awakeOff' : 'hardware.unsupported');
		}).finally(() => { wakeButton.disabled = false; });
	});
	wakeButton.setAttribute('aria-pressed', 'false');
	const hapticButton = toolButton(form, 'hardware.haptics', () => {
		haptics = !haptics;
		setHapticsEnabled(haptics);
		hapticButton.setAttribute('aria-pressed', String(haptics));
	});
	hapticButton.setAttribute('aria-pressed', 'false');
	document.addEventListener('visibilitychange', () => {
		if (document.hidden && awake) {
			void setScreenAwake(false);
			awake = false;
			wakeButton.setAttribute('aria-pressed', 'false');
		}
	});
};
