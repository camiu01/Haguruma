/**
 * @file backup-tool.ts
 * @brief Shell injection for the backup and transfer card.
 * @brief Exports and imports the full-state bundle (custom cars, units,
 * @brief theme, language, levels, sessions) plus the preset-scoped bulk
 * @brief transfer for device migration.
 */
import { t } from '../core/i18n/language';
import { loadCustomPresets, saveCustomPreset } from '../core/presets/custom-store';
import {
	collectBackup,
	countValidPresets,
	downloadTextFile,
	exportPresetsBundle,
	parseBackup,
	parsePresetsBundle,
	readFileText,
	restoreBackup,
} from '../core/backup/state-backup';
import { buildToolShell } from './card/accordion-shell';

/**
 * @brief Inject the backup shell into its mount point.
 * @brief Runs in bootstrap before refs resolve so ids exist on first paint.
 * @param host Mount element hosting the card.
 * @return void
 */
export const injectBackupShell = (host: HTMLElement): void => {
	host.replaceChildren();
	host.appendChild(buildToolShell({
		id: 'databackup',
		title: 'data.title',
		note: 'data.note',
		body: buildBody(),
	}));
};

/**
 * @brief Build the accordion body: bundle rows plus bulk rows and status.
 * @return Body element ready to append to the section content.
 */
const buildBody = (): HTMLElement => {
	const body = document.createElement('div');
	body.className = 'flex flex-col gap-3';
	body.append(buildRow('data.export', 'data.import', 'data-file'));
	body.append(buildRow('data.bulkOut', 'data.bulkIn', 'data-bulk-file'));
	const status = document.createElement('div');
	status.id = 'data-status';
	status.className = 'font-mono fs-base text-text-dim';
	status.setAttribute('aria-live', 'polite');
	body.appendChild(status);
	return body;
};

/**
 * @brief Build one export button plus its file-import label.
 * @param exportKey i18n key for the export button.
 * @param importKey i18n key for the import label.
 * @param fileId File input id.
 * @return Row element.
 */
const buildRow = (exportKey: 'data.export' | 'data.bulkOut', importKey: 'data.import' | 'data.bulkIn', fileId: string): HTMLElement => {
	const row = document.createElement('div');
	row.className = 'flex items-center gap-2 flex-wrap';
	const out = document.createElement('button');
	out.type = 'button';
	out.className = 'btn btn--sm btn--mono';
	out.setAttribute('data-i18n', exportKey);
	out.textContent = t(exportKey);
	out.addEventListener('click', () => (fileId === 'data-file' ? exportBackup() : exportCars()));
	const label = document.createElement('label');
	label.className = 'btn btn--sm btn--mono';
	label.setAttribute('data-i18n', importKey);
	label.textContent = t(importKey);
	const input = document.createElement('input');
	input.type = 'file';
	input.id = fileId;
	input.accept = '.json';
	input.className = 'hidden';
	input.addEventListener('change', () => (fileId === 'data-file' ? importBackup(input) : importCars(input)));
	label.appendChild(input);
	label.addEventListener('click', () => input.click());
	row.append(out, label);
	return row;
};

/**
 * @brief Paint one status line.
 * @param key i18n key for the copy, or null for raw text.
 * @param text Raw text when key is null.
 * @param ok True for the green tint, false for red.
 * @return void
 */
const paintStatus = (key: 'data.done' | 'data.error' | null, text: string, ok: boolean): void => {
	const status = document.getElementById('data-status');
	if (!status) {
		return;
	}
	status.className = `font-mono fs-base ${ok ? 'text-neon-green' : 'text-neon-red'}`;
	if (key) {
		status.setAttribute('data-i18n', key);
		status.textContent = t(key);
	} else {
		status.removeAttribute('data-i18n');
		status.textContent = text;
	}
};

/**
 * @brief Download the full-state backup bundle.
 * @return void
 */
const exportBackup = (): void => {
	const stamp = new Date().toISOString().slice(0, 10);
	downloadTextFile(`haguruma-backup-${stamp}.json`, JSON.stringify(collectBackup(), null, 2));
};

/**
 * @brief Import a full-state backup bundle from a file input.
 * @param input File input holding the picked bundle.
 * @return void
 */
const importBackup = async (input: HTMLInputElement): Promise<void> => {
	const file = input.files?.[0];
	if (!file) {
		return;
	}
	try {
		const backup = parseBackup(await readFileText(file));
		if (!backup) {
			throw new Error('invalid bundle');
		}
		restoreBackup(backup);
		paintStatus('data.done', '', true);
	} catch {
		paintStatus('data.error', '', false);
	} finally {
		input.value = '';
	}
};

/**
 * @brief Download every saved custom car as one JSON bundle.
 * @return void
 */
const exportCars = (): void => {
	const stamp = new Date().toISOString().slice(0, 10);
	downloadTextFile(`haguruma-my-cars-${stamp}.json`, exportPresetsBundle(loadCustomPresets()));
};

/**
 * @brief Import a bulk custom-car bundle from a file input.
 * @param input File input holding the picked bundle.
 * @return void
 */
const importCars = async (input: HTMLInputElement): Promise<void> => {
	const file = input.files?.[0];
	if (!file) {
		return;
	}
	try {
		const presets = parsePresetsBundle(await readFileText(file));
		const count = countValidPresets(presets);
		if (count === 0) {
			throw new Error('no usable presets');
		}
		for (const [name, preset] of Object.entries(presets)) {
			saveCustomPreset(name, preset);
		}
		paintStatus(null, `${count} ${t('data.carsIn')}`, true);
	} catch {
		paintStatus('data.error', '', false);
	} finally {
		input.value = '';
	}
};
