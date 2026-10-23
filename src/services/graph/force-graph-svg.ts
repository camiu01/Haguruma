/**
 * @file force-graph-svg.ts
 * @brief Editable force-view export using the same window, scale and physics as canvas.
 */
import type { PlotFrame } from '../../core/models';
import { state } from '../../core/state/app-state';
import { fromDisplaySpeed } from '../../core/math/speed-math';
import { dragForce, rollingForceAtSpeed, gradeForce } from '../../core/math/aero-math';
import { maxDriveForceAtSpeed } from '../../core/math/dynamics-math';
import { getGearColor } from '../../config/gear-colors';
import { getUnitLabel } from '../../core/units/unit-utils';
import { t } from '../../core/i18n/language';
import { toX, toY } from './canvas-setup';
import { forceAxisFrame, forceGraphPoints } from './force-graph';
import { getGraphStyle } from './graph-theme';
import { escapeSvgText } from './graph-export-footer';

/**
 * @brief Serialize a sampled force series, breaking paths over unreachable ranges.
 * @param frame Force-axis geometry.
 * @param values Sample values or null for gaps.
 * @return SVG path data.
 */
const seriesPath = (frame: PlotFrame, values: (number | null)[]): string => {
	let started = false;
	const path: string[] = [];
	values.forEach((value, index) => {
		if (value === null) { started = false; return; }
		const speed = (frame.minSpeed ?? 0) + (frame.maxSpeed - (frame.minSpeed ?? 0)) * index / 160;
		path.push(`${started ? 'L' : 'M'}${toX(frame, speed).toFixed(2)},${toY(frame, value).toFixed(2)}`);
		started = true;
	});
	return path.join(' ');
};

/**
 * @brief Render a complete force-view SVG rather than silently exporting RPM.
 * @param base Plot geometry from the live canvas or export fallback.
 * @param speedGrid Prebuilt horizontal-unit grid.
 * @param metadata Optional escaped-at-boundary footer text.
 * @return Vector SVG with wheel force, grip and road resistance.
 */
export const buildForceGraphSvg = (base: PlotFrame, speedGrid: string, metadata: string): string => {
	const frame = forceAxisFrame(base);
	const style = getGraphStyle();
	const rows = Array.from({ length: 161 }, (_, index) => {
		const speed = (frame.minSpeed ?? 0) + (frame.maxSpeed - (frame.minSpeed ?? 0)) * index / 160;
		const kmh = fromDisplaySpeed(speed, state.unit);
		return { gears: forceGraphPoints(speed),
			grip: maxDriveForceAtSpeed(state.runningGear, state.vehicleMassKg, kmh, 0, 0).limitN,
			road: dragForce(kmh, state.dragCd, state.frontalAreaM2) + rollingForceAtSpeed(state.vehicleMassKg, state.rollingCrr, kmh)
				+ gradeForce(state.vehicleMassKg, state.roadGradePercent) };
	});
	const curves = state.gears.map((_, gear) =>
		`<path d='${seriesPath(frame, rows.map((row) => row.gears.find((point) => point.index === gear)?.forceN ?? null))}' stroke='${getGearColor(gear)}' />`).join('');
	const excess = state.showTractionMargin ? rows.slice(0, -1).map((row, index) => {
		const peak = Math.max(0, ...row.gears.map((point) => point.forceN));
		if (peak <= row.grip) return '';
		const speed = (frame.minSpeed ?? 0) + (frame.maxSpeed - (frame.minSpeed ?? 0)) * index / 160;
		const width = frame.plotWidth / 160;
		return `<rect x='${toX(frame, speed)}' y='${toY(frame, peak)}' width='${width}' height='${(peak - row.grip) / frame.maxRpm * frame.plotHeight}' />`;
	}).join('') : '';
	const ticks: string[] = [];
	const step = Math.max(1000, Math.ceil(frame.maxRpm / 6000) * 1000);
	for (let force = 0; force <= frame.maxRpm; force += step) {
		ticks.push(`<text x='${frame.paddingLeft - 8}' y='${toY(frame, force)}' text-anchor='end'>${force}</text>`);
	}
	const height = frame.height + (metadata ? 40 : 0);
	const title = escapeSvgText(`${t('graph.force')} (N) · ${getUnitLabel(state.unit)} · ${t('graph.forceLegend')}`);
	return `<svg xmlns='http://www.w3.org/2000/svg' width='${frame.width}' height='${height}' viewBox='0 0 ${frame.width} ${height}'>
<title>${title}</title><rect width='100%' height='100%' fill='${style.background}' />
<defs><clipPath id='plot'><rect x='${frame.paddingLeft}' y='${frame.paddingTop}' width='${frame.plotWidth}' height='${frame.plotHeight}' /></clipPath></defs>
${speedGrid}<g fill='${style.axisText}' font-size='10'>${ticks.join('')}<text x='${frame.paddingLeft}' y='15'>${title}</text></g>
<g data-layer='excess-force' clip-path='url(#plot)' fill='${style.redlineFill}'>${excess}</g>
<g clip-path='url(#plot)' fill='none' stroke-width='2'>${curves}
<path d='${seriesPath(frame, rows.map((row) => row.road))}' stroke='${style.axisText}' />
<path d='${seriesPath(frame, rows.map((row) => row.grip))}' stroke='${style.compare}' stroke-dasharray='5 4' /></g>
${metadata ? `<text x='12' y='${frame.height + 25}' fill='${style.axisText}' font-size='11'>${escapeSvgText(metadata)}</text>` : ''}</svg>`;
};
