/**
 * @file drawer-utils-events.ts
 * @brief Drawer theme segment, simulation switches and JSON transfer buttons.
 */
import type { ElementRefs } from '../dom/element-refs';
import { getTheme, setTheme, parseTheme } from '../../core/theme/theme';
import { isPreset, loadCustomPresets, saveCustomPreset } from '../../core/presets/custom-store';
import { refreshPresetOptions } from './preset-events';
import { renderCustomList } from '../../components/custom-car';
import type { GearPreset } from '../../core/models';

/**
 * Bind drawer-only utility controls.
 * @brief Theme segment, sim switches and JSON export/import live outside element-refs.
 * @param refs Cached DOM handles.
 * @param render Full refresh callback.
 * @return void
 */
export const bindDrawerUtilsEvents = (refs: ElementRefs, render: () => void): void => {
	bindThemeSegment(render);
	bindSimSwitches(refs);
	bindJsonButtons(refs, render);
	syncThemeSegment();
};

/**
 * Apply the active theme to drawer segment pressed state.
 * @brief Keep OLED / Dark / Light buttons truthful after header toggle.
 * @return void
 */
export const syncThemeSegment = (): void => {
	const active = getTheme();
	document.querySelectorAll<HTMLButtonElement>('[data-set-theme]').forEach((btn) => {
		btn.setAttribute('aria-pressed', String(btn.dataset.setTheme === active));
	});
};

/**
 * Wire the drawer theme segment buttons.
 * @brief Direct set (no cycle) for explicit OLED / Dark / Light choice.
 * @param render Full refresh callback.
 * @return void
 */
const bindThemeSegment = (render: () => void): void => {
	document.querySelectorAll<HTMLButtonElement>('[data-set-theme]').forEach((btn) => {
		btn.addEventListener('click', () => {
			const next = parseTheme(btn.dataset.setTheme ?? null);
			if (!next) {
				return;
			}
			setTheme(next);
			syncThemeSegment();
			render();
		});
	});
};

/**
 * Mirror road-load and comparison checkboxes into drawer switches.
 * @brief Clicking a switch forwards to the real checkbox change pipeline.
 * @param refs Cached DOM handles.
 * @return void
 */
const bindSimSwitches = (refs: ElementRefs): void => {
	const pairs: { id: string; input: HTMLInputElement }[] = [
		{ id: 'roadload-toggle', input: refs.roadLoadToggle },
		{ id: 'comparison-toggle', input: refs.comparisonToggle },
	];
	const sync = (): void => {
		pairs.forEach(({ id, input }) => {
			const btn = document.querySelector<HTMLButtonElement>(`[data-drawer-sim='${id}']`);
			btn?.setAttribute('aria-checked', String(input.checked));
		});
	};
	pairs.forEach(({ id, input }) => {
		const btn = document.querySelector<HTMLButtonElement>(`[data-drawer-sim='${id}']`);
		btn?.addEventListener('click', () => {
			input.click();
		});
		input.addEventListener('change', sync);
	});
	sync();
};

/**
 * Wire JSON export / import buttons (drawer and modal).
 * @brief Export dumps every custom preset; import validates and saves each entry.
 * @param refs Cached DOM handles.
 * @param render Full refresh callback.
 * @return void
 */
const bindJsonButtons = (refs: ElementRefs, render: () => void): void => {
	document.getElementById('btn-drawer-export')?.addEventListener('click', () => {
		exportCustomPresets();
	});
	document.getElementById('btn-drawer-import')?.addEventListener('click', () => {
		refs.customImportInput.click();
	});
	refs.btnImportCustom.addEventListener('click', () => {
		refs.customImportInput.click();
	});
	refs.customImportInput.addEventListener('change', () => {
		void importCustomPresets(refs, render);
	});
};

/**
 * Download all custom presets as a single JSON file.
 * @brief Name-keyed GearPreset map matching localStorage shape.
 * @return void
 */
const exportCustomPresets = (): void => {
	const data = loadCustomPresets();
	const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = 'haguruma-garage.json';
	a.click();
	URL.revokeObjectURL(url);
};

/**
 * Read the selected file and persist valid presets.
 * @brief Accepts a single GearPreset or a name-keyed map; skips invalid entries.
 * @param refs Cached DOM handles.
 * @param render Full refresh callback.
 * @return Resolves after storage refresh.
 */
const importCustomPresets = async (refs: ElementRefs, render: () => void): Promise<void> => {
	const file = refs.customImportInput.files?.[0];
	if (!file) {
		return;
	}
	try {
		const text = await file.text();
		const parsed: unknown = JSON.parse(text);
		const incoming = collectPresets(parsed, file.name);
		for (const [name, preset] of incoming) {
			saveCustomPreset(name, preset);
		}
		if (incoming.size > 0) {
			refreshPresetOptions(refs);
			renderCustomList(refs, render);
			render();
		}
	} catch (err) {
		console.error('Preset import failed.', err);
	} finally {
		refs.customImportInput.value = '';
	}
};

/**
 * Normalize imported JSON into name-preset pairs.
 * @brief Supports a bare GearPreset or a name-keyed object map.
 * @param data Parsed file content.
 * @param fileName Fallback name for a bare preset object.
 * @return Valid entries only.
 */
const collectPresets = (data: unknown, fileName: string): Map<string, GearPreset> => {
	const out = new Map<string, GearPreset>();
	if (isPreset(data)) {
		const fallback = fileName.replace(/\.json$/i, '').slice(0, 40) || 'Imported car';
		out.set(fallback, data);
		return out;
	}
	if (typeof data === 'object' && data !== null) {
		for (const [name, value] of Object.entries(data as Record<string, unknown>)) {
			if (isPreset(value)) {
				out.set(name.slice(0, 40), value);
			}
		}
	}
	return out;
};
