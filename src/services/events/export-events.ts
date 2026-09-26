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
	buildDrivetrainJson,
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
	refs.btnExportPng.addEventListener('click', () => exportGraphPng(refs.canvas));
	refs.btnExportSvg.addEventListener('click', () => exportGraphSvg(refs.canvas));
	refs.btnPrint.addEventListener('click', () => window.print());
	refs.btnExportIni.addEventListener('click', () => {
		downloadTextFile(buildAssettoCorsaIni(currentDrivetrain()), 'haguruma-drivetrain.ini', 'text/plain');
	});
	refs.btnExportGearJson.addEventListener('click', () => {
		downloadTextFile(buildDrivetrainJson(currentDrivetrain()), 'haguruma-drivetrain.json', 'application/json');
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
 * @brief Snapshot the primary gears for drivetrain exchange.
 * @param none No parameters.
 * @return Export input with the live primary setup.
 */
const currentDrivetrain = () => {
	return { gears: [...state.gears], fd: state.primaryFd, reverseRatio: state.reverseRatio, label: 'Haguruma setup' };
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
