/**
 * @file quick-add-tools.ts
 * @brief Review-before-save datasheet wizard using the existing tools visual system.
 */
import { presetFromQuickSpec } from '../core/presets/quick-spec';
import { loadCustomPresets, CUSTOM_STORE_VERSION } from '../core/presets/custom-store';
import { restoreStateBackup } from '../core/presets/backup-store';
import { toolSection, toolText, toolNumber, toolButton, toolOutput } from './tool-form';
import { t, getLang } from '../core/i18n/language';

/**
 * @brief Mount a validated spec-sheet preset builder without changing the active setup.
 * @param host Tools mount.
 * @param onSaved Refresh the garage and preset selectors after a successful save.
 * @return void
 */
export const injectQuickAddTools = (host: HTMLElement, onSaved: () => void): void => {
	const form = toolSection(host, 'quick.title');
	const name = toolText(form, 'quick-name', 'quick.name');
	const tire = toolText(form, 'quick-tire', 'primary.tire', '205/55R16');
	const gears = toolText(form, 'quick-gears', 'quick.gears', '3.5, 2.1, 1.4, 1, 0.8');
	const fd = toolNumber(form, 'quick-fd', 'primary.fd', 4.1, 1, 10, 0.001);
	const redline = toolNumber(form, 'quick-redline', 'primary.redline', 7000, 3000, 12000, 100);
	const mass = toolNumber(form, 'quick-mass', 'quick.mass', 1400, 300, 4000);
	const power = toolNumber(form, 'quick-power', 'quick.power', 150, 5, 1500, 0.1);
	const output = toolOutput(form);
	output.textContent = t('quick.caution');
	const read = () => presetFromQuickSpec({ name: name.value, tire: tire.value, gears: gears.value,
		fd: fd.valueAsNumber, redline: redline.valueAsNumber, massKg: mass.valueAsNumber, powerKw: power.valueAsNumber });
	let pending: ReturnType<typeof read> = null;
	toolButton(form, 'quick.review', () => {
		pending = read(); save.disabled = !pending;
		output.textContent = pending ? `${pending.name} · ${new Intl.NumberFormat(getLang()).format(pending.preset.powerKw!)} kW · ${pending.preset.massKg} kg\n${t('quick.caution')}` : t('quick.invalid');
		if (!pending) name.focus();
	});
	const save = toolButton(form, 'quick.save', () => {
		if (!pending || JSON.stringify(read()) !== JSON.stringify(pending)) { save.disabled = true; output.textContent = t('quick.invalid'); return; }
		const customs = loadCustomPresets();
		if (Object.prototype.hasOwnProperty.call(customs, pending.name) && !window.confirm(t('backup.garageConfirm'))) return;
		const presets = { ...customs, [pending.name]: pending.preset };
		const ok = restoreStateBackup(localStorage, { 'haguruma-custom-presets': JSON.stringify({ schemaVersion: CUSTOM_STORE_VERSION, presets }) });
		output.textContent = t(ok ? 'quick.saved' : 'backup.storageError');
		if (ok) { save.disabled = true; pending = null; onSaved(); }
	});
	save.disabled = true;
	form.addEventListener('input', () => { pending = null; save.disabled = true; });
};
