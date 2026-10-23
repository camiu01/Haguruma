/**
 * @file braking-chart.ts
 * @brief Responsive stopping-distance profiles with a textual equivalent.
 */
import { simulateBraking, type BrakingInput, type BrakingResult } from '../core/math/braking-simulation';
import { toDisplaySpeed } from '../core/math/speed-math';
import { state } from '../core/state/app-state';
import { getUnitLabel } from '../core/units/unit-utils';
import { t } from '../core/i18n/language';
import { getGraphStyle } from '../services/graph/graph-theme';

/**
 * @brief Describe both reference stops without relying on color or canvas access.
 * @param results Reference stop profiles.
 * @return Localized stop distance and time, plus curve legend.
 */
const describeStops = (results: BrakingResult[]): string => {
	const fmt = new Intl.NumberFormat(document.documentElement.lang, { maximumFractionDigits: 1 });
	return results.map((stop, index) => {
		const speed = fmt.format(toDisplaySpeed(index === 0 ? 100 : 200, state.unit));
		return `${speed}–0 ${getUnitLabel(state.unit)}: ${stop.distanceM === null ? t('lab.noResult')
			: `${fmt.format(stop.distanceM)} m · ${fmt.format(stop.timeS!)} s`}`;
	}).join('\n') + '\n' + t('lab.brakingLegend');
};

/**
 * @brief Draw speed and deceleration on shared distance axes with distinct line styles.
 * @param canvas Responsive output surface.
 * @param results Reference profiles.
 * @return void
 */
const drawProfiles = (canvas: HTMLCanvasElement, results: BrakingResult[]): void => {
	if (!canvas.clientWidth || !results.length) return;
	const width = canvas.clientWidth;
	const height = 260;
	const dpr = Math.min(window.devicePixelRatio || 1, 2);
	canvas.width = Math.round(width * dpr); canvas.height = height * dpr;
	const ctx = canvas.getContext('2d');
	if (!ctx) return;
	ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	const style = getGraphStyle();
	ctx.fillStyle = style.background; ctx.fillRect(0, 0, width, height);
	const points = results.flatMap((result) => result.points);
	const maxDistance = Math.max(1, ...points.map((point) => point.distanceM));
	const maxDecel = Math.max(1, ...points.map((point) => point.decelMps2));
	const x = (distance: number): number => 44 + distance / maxDistance * (width - 88);
	const y = (fraction: number): number => 224 - fraction * 188;
	drawAxes(ctx, width, maxDistance, maxDecel, style.axisText, style.grid);
	results.forEach((result, index) => {
		ctx.strokeStyle = index === 0 ? style.redlineLine : style.compare;
		ctx.lineWidth = 2;
		for (const deceleration of [false, true]) {
			ctx.setLineDash(deceleration ? [5, 4] : []);
			ctx.beginPath();
			result.points.forEach((point, i) => {
				const py = y(deceleration ? point.decelMps2 / maxDecel : point.speedKmh / 200);
				if (i === 0) ctx.moveTo(x(point.distanceM), py); else ctx.lineTo(x(point.distanceM), py);
			});
			ctx.stroke();
		}
	});
	ctx.setLineDash([]);
};

/**
 * @brief Label distance, speed and deceleration scales in the active locale.
 * @param ctx Drawing context.
 * @param width Logical canvas width.
 * @param distance Full distance range in metres.
 * @param decel Full deceleration range in metres per second squared.
 * @param text Text color.
 * @param grid Grid color.
 * @return void
 */
const drawAxes = (ctx: CanvasRenderingContext2D, width: number, distance: number, decel: number, text: string, grid: string): void => {
	const fmt = new Intl.NumberFormat(document.documentElement.lang, { maximumFractionDigits: 1 });
	ctx.font = '12px sans-serif'; ctx.fillStyle = text;
	ctx.textAlign = 'left'; ctx.fillText(getUnitLabel(state.unit), 4, 18);
	ctx.textAlign = 'right'; ctx.fillText('m/s²', width - 4, 18);
	for (let index = 0; index <= 4; index++) {
		const fraction = index / 4;
		const y = Math.floor(224 - fraction * 188) + 0.5;
		ctx.strokeStyle = grid; ctx.lineWidth = 1;
		ctx.beginPath(); ctx.moveTo(44, y); ctx.lineTo(width - 44, y); ctx.stroke();
		ctx.textAlign = 'right'; ctx.fillText(fmt.format(toDisplaySpeed(fraction * 200, state.unit)), 39, y + 4);
		ctx.textAlign = 'left'; ctx.fillText(fmt.format(fraction * decel), width - 39, y + 4);
		const x = 44 + fraction * (width - 88);
		ctx.textAlign = 'center'; ctx.fillText(fmt.format(fraction * distance), x, 244);
	}
	ctx.textAlign = 'right'; ctx.fillText('m', width - 4, 244);
};

/**
 * @brief Mount an initially hidden chart, calculating profiles only on explicit action.
 * @param form Braking tool form.
 * @return Reference-stop calculation callback.
 */
export const mountBrakingChart = (form: HTMLFormElement): ((input: Omit<BrakingInput, 'speedKmh'>) => void) => {
	const figure = document.createElement('figure');
	figure.className = 'braking-chart'; figure.hidden = true;
	const canvas = document.createElement('canvas');
	canvas.setAttribute('role', 'img'); canvas.dataset.i18nTip = 'lab.braking';
	canvas.setAttribute('aria-label', t('lab.braking'));
	const caption = document.createElement('figcaption');
	caption.id = 'braking-profile-caption'; caption.setAttribute('aria-live', 'polite');
	canvas.setAttribute('aria-describedby', caption.id);
	figure.append(canvas, caption); form.append(figure);
	let results: BrakingResult[] = [];
	const redraw = (): void => {
		if (!results.length) return;
		caption.textContent = describeStops(results); drawProfiles(canvas, results);
	};
	new ResizeObserver(redraw).observe(canvas);
	new MutationObserver(redraw).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'lang'] });
	return (input) => {
		results = [100, 200].map((speedKmh) => simulateBraking({ ...input, speedKmh }));
		figure.hidden = false; redraw();
	};
};
