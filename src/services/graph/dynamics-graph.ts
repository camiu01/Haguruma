/**
 * @file dynamics-graph.ts
 * @brief Wheel-force and braking/deceleration plot primitives on the shared SVG host.
 */
import { state } from '../../core/state/app-state';
import { comparisonForceInput, primaryBrakingInput, primaryForceInput } from '../../core/state/dynamics-input';
import { forceLimitedSpeedKmh, forceReadoutAt, resistanceAt, type ForceProfileInput } from '../../core/math/force-profile';
import { simulateBraking, type BrakingResult } from '../../core/math/braking-simulation';
import { speedKmh, toDisplaySpeed } from '../../core/math/speed-math';
import { getUnitLabel } from '../../core/units/unit-utils';
import { t } from '../../core/i18n/language';
import { getGearColor } from '../../config/gear-colors';
import { buildPlotFrame } from './svg-frame';
import { getGraphStyle } from './graph-theme';
import { buildBackground } from './svg-axes';
import { dynamicsAxes, dynamicsX, dynamicsY } from './dynamics-axes';
import { group, polyline, prim, textPrim, type SvgPrim } from './svg-nodes';
import type { PlotFrame, SpeedUnit } from '../../core/models';

/** Cached brake profiles, shared by graph and tools. */
let brakeKey = '';
let brakeProfiles: [BrakingResult, BrakingResult] | null = null;

/**
 * @brief Memoize stopping telemetry for both requested starting speeds.
 * @return 100-0 and 200-0 km/h stopping profiles.
 */
export const currentBrakeProfiles = (): [BrakingResult, BrakingResult] => {
	const input = primaryBrakingInput();
	const key = JSON.stringify(input);
	if (key !== brakeKey || !brakeProfiles) {
		brakeKey = key;
		brakeProfiles = [simulateBraking(input, 100), simulateBraking(input, 200)];
	}
	return brakeProfiles;
};

/**
 * @brief Sample each gear only inside its measured engine-speed range.
 * @param input Vehicle force model.
 * @param maxSpeed Maximum plotted speed in display units.
 * @param unit Display speed unit.
 * @return Per-gear samples with speed and physical force readouts.
 */
export const sampleGearForces = (input: ForceProfileInput, maxSpeed: number, unit: SpeedUnit): ReturnType<typeof forceReadoutAt>[][] => {
	if (!input.curve || input.circM <= 0) return [];
	return input.gears.map((ratio, index) => {
		const samples: ReturnType<typeof forceReadoutAt>[] = [];
		for (let rpm = 1000; rpm <= input.curve!.redline; rpm += 100) {
			const speed = speedKmh(rpm, ratio, input.fd, input.circM);
			if (toDisplaySpeed(speed, unit) <= maxSpeed) samples.push(forceReadoutAt(input, index, speed));
		}
		return samples;
	});
};

/**
 * @brief Compose primary and dashed comparison force curves with grip and road resistance.
 * @param frame Force plot geometry, Y ceiling in newtons.
 * @param input Primary force model.
 * @param samples Per-gear primary samples.
 * @return Mountable wheel-force curves and margin overlays.
 */
const forceCurves = (frame: PlotFrame, input: ForceProfileInput, samples: ReturnType<typeof sampleGearForces>, compare = false): SvgPrim[] => {
	const nodes: SvgPrim[] = [];
	const style = getGraphStyle();
	for (let i = 0; i < samples.length; i += 1) {
		const coordinates = samples[i].map((s) => ({
			x: dynamicsX(frame, toDisplaySpeed(speedKmh(s.rpm, input.gears[i], input.fd, input.circM), state.unit)),
			y: dynamicsY(frame, s.driveN),
		}));
		nodes.push(polyline(coordinates, { stroke: compare ? style.compare : getGearColor(i), 'stroke-width': compare ? 1.5 : 2.5,
			'stroke-dasharray': compare ? '6 4' : '', [compare ? 'data-compare-force-gear' : 'data-force-gear']: i + 1 }));
		if (!compare && state.dynamics.tractionOverlay) {
			nodes.push(polyline(samples[i].map((s, j) => ({ x: coordinates[j].x, y: dynamicsY(frame, Math.max(0, s.marginN)) })),
				{ stroke: getGearColor(i), 'stroke-width': 1.5, 'stroke-dasharray': '3 4', 'data-traction-margin': i + 1 }));
		}
	}
	const road = [];
	const grip = [];
	for (let i = 0; i <= 100; i += 1) {
		const display = frame.maxSpeed * i / 100;
		const kmh = state.unit === 'mph' ? display * 1.609344 : display;
		road.push({ x: dynamicsX(frame, display), y: dynamicsY(frame, resistanceAt(input, kmh)) });
		grip.push({ x: dynamicsX(frame, display), y: dynamicsY(frame, forceReadoutAt(input, 0, kmh).gripN) });
	}
	nodes.push(polyline(road, { stroke: compare ? style.compare : style.aero, 'stroke-width': 2,
		'stroke-dasharray': compare ? '6 4' : '', [compare ? 'data-compare-road-resistance' : 'data-road-resistance']: '' }));
	if (state.graphLayers.gripLimit) nodes.push(polyline(grip, { stroke: compare ? style.gripCompare : style.grip,
		'stroke-width': 1.5, 'stroke-dasharray': '6 4' }));
	return nodes;
};

/**
 * @brief Build a force plot using newtons rather than RPM-scaled overlays.
 * @param width Host width.
 * @param height Host height.
 * @return Primitives for the force view.
 */
const forcePlot = (width: number, height: number): SvgPrim[] => {
	const input = primaryForceInput();
	const samples = sampleGearForces(input, state.maxGraphSpeed, state.unit);
	const compare = state.compareEnabled ? comparisonForceInput() : null;
	const compSamples = compare ? sampleGearForces(compare, state.maxGraphSpeed, state.unit) : [];
	let peak = 1000;
	for (const gear of samples) for (const sample of gear) peak = Math.max(peak, sample.driveN, sample.gripN);
	for (const gear of compSamples) for (const sample of gear) peak = Math.max(peak, sample.driveN, sample.gripN);
	const frame = buildPlotFrame(state.maxGraphSpeed, Math.ceil(peak * 1.1 / 1000) * 1000, width, height);
	const style = getGraphStyle();
	const nodes = [...buildBackground(frame, style), ...dynamicsAxes(frame, style, getUnitLabel(state.unit), t('dynamics.forceAxis'))];
	const clip = { class: 'graph-force', 'clip-path': `inset(${frame.paddingTop}px ${frame.paddingRight}px ${frame.paddingBottom}px ${frame.paddingLeft}px)` };
	const curves = forceCurves(frame, input, samples);
	if (compare) curves.push(...forceCurves(frame, compare, compSamples, true));
	nodes.push(group(clip, curves));
	nodes.push(...forceVmaxMarker(frame, input));
	nodes.push(textPrim({ x: frame.paddingLeft + 8, y: frame.paddingTop + 16, fill: style.aero, 'font-family': 'Share Tech Mono, monospace', 'font-size': 11 }, t('dynamics.resistance')));
	return nodes;
};

/**
 * @brief Mark the actual force/resistance crossing, rather than a nominal peak-power wall.
 * @param frame Plot geometry.
 * @param input Primary force model.
 * @return Vmax marker when it falls inside the plotted speed window.
 */
const forceVmaxMarker = (frame: PlotFrame, input: ForceProfileInput): SvgPrim[] => {
	const speed = forceLimitedSpeedKmh(input);
	if (speed === null) return [];
	const display = toDisplaySpeed(speed, state.unit);
	if (display > frame.maxSpeed) return [];
	const x = dynamicsX(frame, display);
	const y = dynamicsY(frame, Math.max(0, resistanceAt(input, speed)));
	const style = getGraphStyle();
	return [
		prim('line', { x1: x, x2: x, y1: frame.paddingTop, y2: frame.paddingTop + frame.plotHeight,
			stroke: style.aero, 'stroke-dasharray': '4 4', 'data-force-vmax': speed }),
		prim('circle', { cx: x, cy: y, r: 4, fill: style.background, stroke: style.aero }),
		textPrim({ x: x - 6, y: Math.max(frame.paddingTop + 32, y - 10), 'text-anchor': 'end',
			fill: style.aero, 'font-size': 11, 'font-family': 'Share Tech Mono, monospace' }, `Vmax ${display.toFixed(1)} ${getUnitLabel(state.unit)}`),
	];
};

/**
 * @brief Build stopping-speed and deceleration profiles on a distance axis.
 * @param width Host width.
 * @param height Host height.
 * @return 100-0 and 200-0 curves, plus dashed deceleration using the right axis.
 */
const brakingPlot = (width: number, height: number): SvgPrim[] => {
	const profiles = currentBrakeProfiles();
	const distance = Math.max(50, ...profiles.map((p) => p.distanceM ?? p.samples[p.samples.length - 1]?.distanceM ?? 0));
	const frame = buildPlotFrame(Math.ceil(distance * 1.1 / 10) * 10, toDisplaySpeed(220, state.unit), width, height);
	const style = getGraphStyle();
	const nodes = [...buildBackground(frame, style), ...dynamicsAxes(frame, style, t('dynamics.distanceAxis'), getUnitLabel(state.unit))];
	const peakDecel = Math.max(10, ...profiles.flatMap((p) => p.samples.map((s) => s.decelMps2))) * 1.1;
	for (let i = 0; i < profiles.length; i += 1) {
		const color = i === 0 ? style.grip : style.compare;
		nodes.push(polyline(profiles[i].samples.map((s) => ({ x: dynamicsX(frame, s.distanceM), y: dynamicsY(frame, toDisplaySpeed(s.speedKmh, state.unit)) })),
			{ stroke: color, 'stroke-width': 2.5, 'data-braking-speed': i === 0 ? 100 : 200 }));
		nodes.push(polyline(profiles[i].samples.map((s) => ({ x: dynamicsX(frame, s.distanceM), y: dynamicsY(frame, s.decelMps2 / peakDecel * frame.maxRpm) })),
			{ stroke: color, 'stroke-width': 1.5, 'stroke-dasharray': '4 4', 'data-braking-decel': i === 0 ? 100 : 200 }));
	}
	for (let i = 0; i <= 5; i += 1) {
		nodes.push(textPrim({ x: width - 4, y: dynamicsY(frame, frame.maxRpm * i / 5) + 4, fill: style.axisText, 'text-anchor': 'end',
			'font-size': 10, 'font-family': 'Share Tech Mono, monospace' }, (peakDecel * i / 5).toFixed(1)));
	}
	nodes.push(textPrim({ x: width - 4, y: 18, fill: style.axisText, 'text-anchor': 'end', 'font-size': 11 }, 'm/s²'));
	nodes.push(textPrim({ x: frame.paddingLeft + 8, y: frame.paddingTop + 16, fill: style.axisText, 'font-size': 11,
		'font-family': 'Share Tech Mono, monospace' }, t('dynamics.brakingLegend')));
	return nodes;
};

/**
 * @brief Compose the active alternate dynamics view.
 * @param width Measured host width.
 * @param height Measured host height.
 * @return Force or stopping-distance primitives.
 */
export const buildDynamicsGraph = (width: number, height: number): SvgPrim[] => {
	return state.dynamics.graphView === 'braking' ? brakingPlot(width, height) : forcePlot(width, height);
};
