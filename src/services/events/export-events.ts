/**
 * @file export-events.ts
 * @brief Bind graph PNG/SVG/print actions plus sim drivetrain INI/JSON exchange.
 */
import { state } from '../../core/state/app-state';
import { t } from '../../core/i18n/language';
import { renderGearsList } from '../../components/gear-list';
import { syncUrlHash } from '../../core/share/share-utils';
import type { ElementRefs } from '../dom/element-refs';
import { exportGraphPng, exportGraphSvg } from '../graph/graph-export';
import {
	buildAssettoCorsaIni,
	buildBeamngJbeam,
	buildDrivetrainJson,
	buildTelemCsv,
	downloadTextFile,
	parseAssettoCorsaIni,
} from '../graph/drivetrain-export';

/**
 * @brief Wire export, print and drivetrain exchange buttons exactly once.
 * @param refs Cached DOM handles.
 * @param render Full refresh callback.
 * @return void
 */
export const bindExportEvents = (refs: ElementRefs, render: () => void): void => {
	refs.btnExportPng.addEventListener('click', () => exportGraphPng(refs));
	refs.btnExportSvg.addEventListener('click', () => exportGraphSvg(refs));
	refs.btnPrint.addEventListener('click', () => window.print());
	bindExportMenu(refs);
	refs.btnExportGo.addEventListener('click', () => {
		exportDrivetrainAs(refs.exportFormat.value);
	});
	refs.btnImportIni.addEventListener('click', () => {
		refs.drivetrainImportInput.click();
	});
	refs.drivetrainImportInput.addEventListener('change', () => {
		const file = refs.drivetrainImportInput.files?.[0];
		refs.drivetrainImportInput.value = '';
		if (!file) {
			return;
		}
		void readTextFile(file).then((text) => {
			applyDrivetrainIni(refs, text, render);
		});
	});
};

/**
 * @brief Wire the compact drivetrain export menu without changing legacy IDs.
 * @param refs Cached DOM handles containing the hidden selector and action.
 * @return void
 */
const bindExportMenu = (refs: ElementRefs): void => {
	const trigger = document.getElementById('btn-export-menu');
	const menu = document.getElementById('export-menu');
	const label = document.getElementById('export-menu-label');
	if (!(trigger instanceof HTMLButtonElement) || !menu || !label) {
		return;
	}
	trigger.addEventListener('click', () => toggleExportMenu(trigger, menu));
	menu.querySelectorAll<HTMLButtonElement>('[data-export-format]').forEach((option) => {
		option.addEventListener('click', () => {
			const format = option.dataset.exportFormat ?? 'ini';
			refs.exportFormat.value = format;
			label.textContent = `${t('export.go')} ${option.textContent?.trim() ?? format.toUpperCase()}`;
			toggleExportMenu(trigger, menu, false);
			refs.btnExportGo.click();
		});
	});
	document.addEventListener('click', (event) => {
		if (!menu.contains(event.target as Node) && !trigger.contains(event.target as Node)) {
			toggleExportMenu(trigger, menu, false);
		}
	});
};

/**
 * @brief Show or hide the export format menu and synchronize accessibility state.
 * @param trigger Menu trigger button.
 * @param menu Menu popover.
 * @param force Optional explicit open state.
 * @return void
 */
const toggleExportMenu = (trigger: HTMLButtonElement, menu: HTMLElement, force?: boolean): void => {
	const open = force ?? menu.classList.contains('hidden');
	menu.classList.toggle('hidden', !open);
	trigger.setAttribute('aria-expanded', String(open));
};

/**
 * @brief Snapshot the primary gears for drivetrain exchange.
 * @param none No parameters.
 * @return Export input with the live primary setup.
 */
const currentDrivetrain = () => {
	return { gears: [...state.gears], fd: state.primaryFd, reverseRatio: state.reverseRatio, label: 'Haguruma setup' };
};

/**
 * @brief Download the drivetrain exchange payload in the selected format.
 * @param format Select value: ini, json, jbeam, motec or aim.
 * @return void
 */
export const exportDrivetrainAs = (format: string): void => {
	const input = currentDrivetrain();
	if (format === 'json') {
		downloadTextFile(buildDrivetrainJson(input), 'haguruma-drivetrain.json', 'application/json');
		return;
	}
	if (format === 'jbeam') {
		downloadTextFile(buildBeamngJbeam(input), 'haguruma-transmission.jbeam', 'application/json');
		return;
	}
	if (format === 'motec') {
		downloadTextFile(buildTelemCsv(input, 'motec'), 'haguruma-gears-motec.csv', 'text/csv');
		return;
	}
	if (format === 'aim') {
		downloadTextFile(buildTelemCsv(input, 'aim'), 'haguruma-gears-aim.csv', 'text/csv');
		return;
	}
	downloadTextFile(buildAssettoCorsaIni(input), 'haguruma-drivetrain.ini', 'text/plain');
};

/**
 * @brief Read one text file without ever rejecting.
 * @param file File chosen from the hidden input.
 * @return Resolves with the file text, empty on read errors.
 */
const readTextFile = (file: File): Promise<string> => {
	return new Promise((resolve) => {
		const reader = new FileReader();
		reader.onload = () => resolve(String(reader.result ?? ''));
		reader.onerror = () => resolve('');
		reader.readAsText(file);
	});
};

/**
 * @brief Parse .ini text and apply the gears to the primary setup.
 * @param refs Cached DOM handles.
 * @param text Full .ini file contents.
 * @param render Full refresh callback.
 * @return void
 */
const applyDrivetrainIni = (refs: ElementRefs, text: string, render: () => void): void => {
	const parsed = parseAssettoCorsaIni(text);
	if (!parsed) {
		showDrivetrainStatus(refs, false, 0);
		return;
	}
	state.gears = [...parsed.gears];
	state.primaryFd = parsed.fd;
	state.reverseRatio = parsed.reverseRatio;
	refs.primaryFd.value = String(parsed.fd);
	renderGearsList(refs, () => render());
	syncUrlHash();
	render();
	showDrivetrainStatus(refs, true, parsed.gears.length);
};

/**
 * @brief Write the drivetrain import status line under the graph controls.
 * @param refs Cached DOM handles.
 * @param ok True on successful import.
 * @param count Gear count injected into the ok message.
 * @return void
 */
const showDrivetrainStatus = (refs: ElementRefs, ok: boolean, count: number): void => {
	refs.drivetrainStatus.classList.remove('hidden');
	refs.drivetrainStatus.textContent = ok
		? t('export.iniOk').replace('{n}', String(count))
		: t('export.iniError');
};
