/**
 * @file graph-export.ts
 * @brief PNG snapshot and vector SVG serialization of the gear graph.
 *
 * PNG reuses the live canvas bitmap. SVG rebuilds the same layer order
 * (background, grid, redline, gear curves, shift drops) as vector geometry
 * so the export stays editable and resolution-independent.
 */

import { state } from '../../core/state/app-state';
import { effectiveCircumferenceM, parseTire } from '../../core/math/tire-math';
import { calculateRpm, calculateSpeed } from '../../core/math/speed-math';
import { getGearColor } from '../../config/gear-colors';
import { getSpeedStep, getMaxRpm, getUnitLabel } from '../../core/units/unit-utils';
import { GRAPH_PADDING, GRAPH_LIMITS } from '../../config/graph-constants';
import { getGraphStyle, type GraphPalette } from './graph-theme';
import type { PlotFrame, SpeedUnit } from '../../core/models';
import { toDisplaySpeed } from '../../core/math/speed-math';
import { toX, toY } from './canvas-setup';
import { escapeSvgText } from './graph-export-footer';
import { buildForceGraphSvg } from './force-graph-svg';

/** Fallback canvas size when getBoundingClientRect reports zero. */
const FALLBACK_SIZE = { width: 800, height: 450 };

/**
 * @brief Trigger a browser download of a blob under a file name.
 * @param blob Payload to download.
 * @param filename Download file name.
 * @return void
 */
const downloadBlob = (blob: Blob, filename: string): void => {
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
};

/**
 * @brief Export the live graph canvas as a PNG file.
 * @param canvas Graph canvas element.
 * @return void
 */
export const exportGraphPng = (canvas: HTMLCanvasElement, metadata = ''): void => {
	const target = metadata ? document.createElement('canvas') : canvas;
	if (metadata) {
		target.width = canvas.width;
		target.height = canvas.height + 64;
		const ctx = target.getContext('2d');
		if (!ctx) {
			return;
		}
		ctx.fillStyle = getGraphStyle().background;
		ctx.fillRect(0, 0, target.width, target.height);
		ctx.drawImage(canvas, 0, 0);
		ctx.fillStyle = getGraphStyle().axisText;
		ctx.font = '18px sans-serif';
		ctx.fillText(metadata, 12, canvas.height + 38, target.width - 24);
	}
	target.toBlob((blob) => {
		if (blob) {
			downloadBlob(blob, 'haguruma-graph.png');
		}
	}, 'image/png');
};

/**
 * @brief Resolve the drawable frame for SVG export from the live canvas.
 * @param canvas Graph canvas element.
 * @return PlotFrame.
 */
const buildFrame = (canvas: HTMLCanvasElement): PlotFrame => {
	const rect = canvas.getBoundingClientRect();
	const width = rect.width > 0 ? rect.width : FALLBACK_SIZE.width;
	const height = rect.height > 0 ? rect.height : FALLBACK_SIZE.height;
	const redline = state.compareEnabled ? Math.max(state.primaryRedline, state.compRedline) : state.primaryRedline;
	return {
		width,
		height,
		paddingTop: GRAPH_PADDING.top,
		paddingRight: GRAPH_PADDING.right,
		paddingBottom: GRAPH_PADDING.bottom,
		paddingLeft: GRAPH_PADDING.left,
		plotWidth: width - GRAPH_PADDING.left - GRAPH_PADDING.right,
		plotHeight: height - GRAPH_PADDING.top - GRAPH_PADDING.bottom,
		maxSpeed: state.maxGraphSpeed,
		maxRpm: getMaxRpm(redline),
		...(state.graphWindow ? {
			minSpeed: toDisplaySpeed(state.graphWindow.minKmh, state.unit),
			maxSpeed: toDisplaySpeed(state.graphWindow.maxKmh, state.unit),
			minRpm: state.graphWindow.minRpm, maxRpm: state.graphWindow.maxRpm,
		} : {}),
	};
};

/**
 * @brief Serialize speed-grid lines and labels as SVG markup.
 * @param frame Plot frame.
 * @param style Graph color palette.
 * @param unit Active speed unit.
 * @return SVG markup string for the speed grid.
 */
const svgSpeedGrid = (frame: PlotFrame, style: GraphPalette, unit: SpeedUnit): string => {
	const step = getSpeedStep(unit);
	const parts: string[] = [];
	for (let s = Math.ceil((frame.minSpeed ?? 0) / step) * step; s <= frame.maxSpeed; s += step) {
		const x = toX(frame, s).toFixed(1);
		parts.push(
			`<line x1='${x}' y1='${frame.paddingTop}' x2='${x}' y2='${frame.paddingTop + frame.plotHeight}' stroke='${style.grid}' stroke-width='1' />`,
		);
		parts.push(
			`<text x='${x}' y='${frame.paddingTop + frame.plotHeight + 14}' fill='${style.axisText}' font-size='10' text-anchor='middle'>${s}</text>`,
		);
	}
	return parts.join('');
};

/**
 * @brief Serialize RPM-grid lines and labels as SVG markup.
 * @param frame Plot frame.
 * @param style Graph color palette.
 * @return SVG markup string for the RPM grid.
 */
const svgRpmGrid = (frame: PlotFrame, style: GraphPalette): string => {
	const parts: string[] = [];
	for (let r = Math.max(GRAPH_LIMITS.rpmStep, Math.ceil((frame.minRpm ?? 0) / GRAPH_LIMITS.rpmStep) * GRAPH_LIMITS.rpmStep); r <= frame.maxRpm; r += GRAPH_LIMITS.rpmStep) {
		const y = toY(frame, r).toFixed(1);
		parts.push(
			`<line x1='${frame.paddingLeft}' y1='${y}' x2='${frame.paddingLeft + frame.plotWidth}' y2='${y}' stroke='${style.grid}' stroke-width='1' />`,
		);
		parts.push(
			`<text x='${frame.paddingLeft - 6}' y='${Number(y) + 3}' fill='${style.axisText}' font-size='10' text-anchor='end'>${r}</text>`,
		);
	}
	return parts.join('');
};

/**
 * @brief Serialize one gear curve as a straight SVG line from 0 to redline.
 * @param frame Plot frame.
 * @param circM Rolling circumference in metres.
 * @param gearRatio Gear ratio.
 * @param fd Differential ratio.
 * @param redline Rev limiter in RPM.
 * @param idx Zero-based gear index for color lookup.
 * @return SVG line markup.
 */
const svgGearLine = (
	frame: PlotFrame,
	circM: number,
	gearRatio: number,
	fd: number,
	redline: number,
	idx: number,
): string => {
	const topSpeed = calculateSpeed(redline, gearRatio, fd, circM, state.unit);
	const x1 = toX(frame, 0).toFixed(1);
	const y1 = toY(frame, 0).toFixed(1);
	const x2 = toX(frame, topSpeed).toFixed(1);
	const y2 = toY(frame, redline).toFixed(1);
	return `<line x1='${x1}' y1='${y1}' x2='${x2}' y2='${y2}' stroke='${getGearColor(idx)}' stroke-width='2' />`;
};

/**
 * @brief Serialize shift-drop connectors at each gear peak.
 * @param frame Plot frame.
 * @param circM Rolling circumference in metres.
 * @param redline Rev limiter in RPM.
 * @param style Graph color palette.
 * @return SVG markup for every redline-to-landing drop line.
 */
const svgShiftDrops = (frame: PlotFrame, circM: number, redline: number, style: GraphPalette): string => {
	const parts: string[] = [];
	for (let i = 0; i < state.gears.length - 1; i += 1) {
		const top = calculateSpeed(redline, state.gears[i], state.primaryFd, circM, state.unit);
		const landing = calculateRpm(top, state.gears[i + 1], state.primaryFd, circM, state.unit);
		const x = toX(frame, top).toFixed(1);
		parts.push(
			`<line x1='${x}' y1='${toY(frame, redline).toFixed(1)}' x2='${x}' y2='${toY(frame, landing).toFixed(1)}' stroke='${style.shiftDrop}' stroke-width='1.5' stroke-dasharray='4 3' />`,
		);
	}
	return parts.join('');
};

/**
 * @brief Build a full vector SVG document mirroring the live graph.
 * @param canvas Graph canvas used for sizing.
 * @return SVG markup string, or null when the tire is invalid.
 */
export const buildGraphSvg = (canvas: HTMLCanvasElement, metadata = ''): string | null => {
	const tire = parseTire(state.primaryTire);
	if (!tire) {
		return null;
	}
	const frame = buildFrame(canvas);
	if (state.graphMode === 'force') {
		return buildForceGraphSvg(frame, svgSpeedGrid(frame, getGraphStyle(), state.unit), metadata);
	}
	const circM = effectiveCircumferenceM(tire, state.rollingFactor);
	const style = getGraphStyle();
	const redline = state.primaryRedline;
	const gearLines = state.gears.map((g, i) => svgGearLine(frame, circM, g, state.primaryFd, redline, i)).join('');
	const redY = Math.max(frame.paddingTop, Math.min(frame.paddingTop + frame.plotHeight, toY(frame, redline))).toFixed(1);
	const label = getUnitLabel(state.unit);
	const title = `HAGURUMA - ${state.primaryTire} · ${state.primaryFd.toFixed(2)} FD · ${redline} RPM`;
	return [
		`<svg xmlns='http://www.w3.org/2000/svg' width='${frame.width}' height='${frame.height + (metadata ? 40 : 0)}' viewBox='0 0 ${frame.width} ${frame.height + (metadata ? 40 : 0)}'>`,
		`<rect width='${frame.width}' height='${frame.height + (metadata ? 40 : 0)}' fill='${style.background}' />`,
		`<defs><clipPath id='plot'><rect x='${frame.paddingLeft}' y='${frame.paddingTop}' width='${frame.plotWidth}' height='${frame.plotHeight}' /></clipPath></defs>`,
		svgSpeedGrid(frame, style, state.unit),
		svgRpmGrid(frame, style),
		`<rect x='${frame.paddingLeft}' y='${frame.paddingTop}' width='${frame.plotWidth}' height='${Math.max(0, Number(redY) - frame.paddingTop)}' fill='${style.redlineFill}' />`,
		`<line x1='${frame.paddingLeft}' y1='${redY}' x2='${frame.paddingLeft + frame.plotWidth}' y2='${redY}' stroke='${style.redlineLine}' stroke-width='1.5' stroke-dasharray='6 4' />`,
		`<g clip-path='url(#plot)'>${gearLines}`,
		svgShiftDrops(frame, circM, redline, style),
		`</g>`,
		`<text x='${frame.paddingLeft}' y='${frame.height - 8}' fill='${style.axisText}' font-size='11'>${label}</text>`,
		`<text x='${frame.paddingLeft + frame.plotWidth}' y='${frame.height - 8}' fill='${style.axisText}' font-size='11' text-anchor='end'>${title}</text>`,
		metadata ? `<text x='12' y='${frame.height + 25}' fill='${style.axisText}' font-size='11'>${escapeSvgText(metadata)}</text>` : '',
		`</svg>`,
	].join('');
};

/**
 * @brief Export the graph as a vector SVG file.
 * @param canvas Graph canvas used for sizing.
 * @return void
 */
export const exportGraphSvg = (canvas: HTMLCanvasElement, metadata = ''): void => {
	const svg = buildGraphSvg(canvas, metadata);
	if (!svg) {
		return;
	}
	downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), 'haguruma-graph.svg');
};
