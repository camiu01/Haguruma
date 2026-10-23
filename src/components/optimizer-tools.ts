/**
 * @file optimizer-tools.ts
 * @brief Track archetypes, GPX geometry and preview-before-apply gear optimization.
 */
import { state } from '../core/state/app-state';
import { parseTire, effectiveCircumferenceM } from '../core/math/tire-math';
import { TRACK_PROFILES, gearsetCandidates, optimizeGearset } from '../core/math/gear-optimizer';
import { parseGpxTrack, summarizeTrack } from '../core/math/gpx-track';
import { toolSection, toolNumber, toolButton, toolOutput, toolValue } from './tool-form';
import { t } from '../core/i18n/language';
import type { DictKey } from '../core/i18n/dictionaries';
import { activeEngineCurve } from '../core/state/engine-curve';

/**
 * @brief Mount a bounded discrete search, keeping suggestions separate from state.
 * @param host Tools mount.
 * @param apply Apply new gears/final drive and refresh the existing controls.
 * @return void
 */
export const injectOptimizerTools = (host: HTMLElement, apply: (gears: number[], fd: number) => void): void => {
	const form = toolSection(host, 'optimizer.title');
	const target = toolNumber(form, 'target-speed', 'optimizer.target', 240, 60, 500);
	const drop = toolNumber(form, 'max-drop', 'optimizer.drop', 35, 5, 60);
	const corner2 = toolNumber(form, 'corner-2', 'optimizer.corner2', 80, 10, 300);
	const corner3 = toolNumber(form, 'corner-3', 'optimizer.corner3', 120, 10, 300);
	for (const profile of Object.keys(TRACK_PROFILES) as (keyof typeof TRACK_PROFILES)[]) {
		toolButton(form, `optimizer.${profile}` as DictKey, () => {
			target.value = String(TRACK_PROFILES[profile].targetKmh);
			drop.value = String(Math.round((1 - TRACK_PROFILES[profile].minimumLandingFraction) * 100));
			corner2.value = String(TRACK_PROFILES[profile].cornerSpeedsKmh[0]);
			corner3.value = String(TRACK_PROFILES[profile].cornerSpeedsKmh[1]);
			target.dispatchEvent(new Event('input', { bubbles: true }));
		});
	}
	const output = toolOutput(form);
	let suggestion: ReturnType<typeof optimizeGearset> = null;
	const accept = toolButton(form, 'optimizer.apply', () => {
		if (suggestion) apply(suggestion.gears, suggestion.fd);
		accept.disabled = true;
		suggestion = null;
	});
	accept.disabled = true;
	form.addEventListener('input', () => { suggestion = null; accept.disabled = true; });
	toolButton(form, 'optimizer.search', () => {
		const v = toolValue(target);
		const d = toolValue(drop);
		const tire = parseTire(state.primaryTire);
		const corners = [toolValue(corner2), toolValue(corner3)];
		const curve = activeEngineCurve();
		if (v === null || d === null || corners.some((speed) => speed === null) || !tire || !curve) { output.textContent = t('lab.invalid'); return; }
		suggestion = optimizeGearset(gearsetCandidates(state.gears[0], state.gears.length),
			[state.primaryFd * 0.9, state.primaryFd, state.primaryFd * 1.1], effectiveCircumferenceM(tire, state.rollingFactor),
			state.primaryRedline, v, d / 100, { cornerSpeedsKmh: [corners[0]!, corners[1]!], curve });
		accept.disabled = !suggestion;
		output.textContent = suggestion ? `${suggestion.gears.join(' / ')}\nFD ${suggestion.fd.toFixed(3)} · ${suggestion.topKmh.toFixed(1)} km/h\n${t('optimizer.caution')}` : t('lab.noResult');
	});
	mountGpx(form, target, [corner2, corner3], output);
};

/**
 * @brief Seed an approximate target speed from local GPX corner geometry.
 * @param form Optimizer form.
 * @param target Target speed field.
 * @param corners Second/third-gear corner speed fields.
 * @param output Status output.
 * @return void
 */
const mountGpx = (form: HTMLFormElement, target: HTMLInputElement, corners: HTMLInputElement[], output: HTMLOutputElement): void => {
	let request = 0;
	const label = document.createElement('label');
	const caption = document.createElement('span');
	caption.dataset.i18n = 'optimizer.gpx'; caption.textContent = t('optimizer.gpx');
	const input = document.createElement('input');
	input.type = 'file'; input.name = 'gpx'; input.accept = '.gpx,application/gpx+xml';
	label.append(caption, input); form.append(label);
	input.addEventListener('change', () => {
		target.dispatchEvent(new Event('input', { bubbles: true }));
		const current = ++request;
		const file = input.files?.[0];
		if (!file || file.size > 5_000_000) { output.textContent = t('lab.invalid'); return; }
		void file.text().then((text) => {
			if (current !== request) return;
			const points = parseGpxTrack(text);
			if (points.length < 3) { output.textContent = t('lab.invalid'); return; }
			const summary = summarizeTrack(points);
			const profile = summary.minRadiusM !== null && summary.minRadiusM < 35 ? 'tight'
				: summary.minRadiusM !== null && summary.minRadiusM > 100 ? 'fast' : 'balanced';
			target.value = String(summary.longestStraightM > 800 ? 300 : summary.longestStraightM > 350 ? 240 : 180);
			const apex = summary.minRadiusM === null ? TRACK_PROFILES[profile].cornerSpeedsKmh[0]
				: Math.max(20, Math.min(200, Math.sqrt(summary.minRadiusM * 0.8 * 9.81) * 3.6));
			corners[0].value = String(Math.round(apex));
			corners[1].value = String(Math.round(Math.min(300, apex * 1.5)));
			target.dispatchEvent(new Event('input', { bubbles: true }));
			const fmt = new Intl.NumberFormat(document.documentElement.lang, { maximumFractionDigits: 1 });
			output.textContent = `${fmt.format(summary.lengthM / 1000)} km · ${t(`optimizer.${profile}`)}\n${t('optimizer.straight')}: ${fmt.format(summary.longestStraightM)} m\n${t('optimizer.gpxCaution')}`;
		}).catch(() => { if (current === request) output.textContent = t('lab.invalid'); });
	});
	form.addEventListener('input', (event) => { if (event.target !== input) request += 1; });
};
