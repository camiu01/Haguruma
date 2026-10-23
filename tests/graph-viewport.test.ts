/**
 * @file graph-viewport.test.ts
 * @brief Pure-function tests for the bounded zoom and pan window of the plot.
 *
 * Covers the clamp rules (floor spans and axis ceilings), anchored zooming,
 * panning, the identity check and the projection round-trip through a window,
 * plus the two projection regressions: the grip curve stays anchored to the
 * RPM axis and a shift drop with no landing height is not drawn.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { state, defaultState } from '../src/core/state/app-state';
import {
	clampWindow,
	fullWindow,
	isFullWindow,
	panWindow,
	VIEW_LIMITS,
	windowFraction,
	zoomWindow,
} from '../src/services/graph/graph-viewport';
import { buildPlotFrame, rpmAtY, speedAtX, toX, toY } from '../src/services/graph/svg-frame';
import { buildRpmTicks, buildSpeedTicks } from '../src/services/graph/svg-axes';
import { buildGripNodes, gripCurveY } from '../src/services/graph/svg-limits';
import { buildShiftDropNodes, buildShiftPoints } from '../src/services/graph/svg-shift-drops';
import { getGraphStyle } from '../src/services/graph/graph-theme';
import { getMaxRpm } from '../src/core/units/unit-utils';
import type { GraphWindow } from '../src/core/models';

/** Axis ceilings used by most tests: 300 km/h and the default 7200 RPM limiter. */
const MAX_KMH = 300;
const MAX_RPM = getMaxRpm(7200);

/** Rolling circumference of the default 205/55R16 tire. */
const CIRC_M = 1.9362;

/**
 * @brief Build a frame with an explicit visible window.
 * @param window Visible sub-window.
 * @return Plot frame carrying that window.
 */
const frameWith = (window: GraphWindow) => buildPlotFrame(MAX_KMH, MAX_RPM, undefined, undefined, window);

afterEach(() => {
	state.graphWindow = null;
	state.graphLayers = { ...defaultState.graphLayers };
});

describe('window clamping', () => {
	it('builds the full axis as the identity window', () => {
		expect(fullWindow(MAX_KMH, MAX_RPM)).toEqual({ minKmh: 0, maxKmh: MAX_KMH, minRpm: 0, maxRpm: MAX_RPM });
		expect(isFullWindow(fullWindow(MAX_KMH, MAX_RPM), MAX_KMH, MAX_RPM)).toBe(true);
		expect(isFullWindow({ minKmh: 10, maxKmh: MAX_KMH, minRpm: 0, maxRpm: MAX_RPM }, MAX_KMH, MAX_RPM)).toBe(false);
	});

	it('keeps a window inside the axis instead of running past the ceiling', () => {
		const window = clampWindow({ minKmh: 280, maxKmh: 400, minRpm: 7000, maxRpm: 12000 }, MAX_KMH, MAX_RPM);
		expect(window.maxKmh).toBe(MAX_KMH);
		expect(window.maxRpm).toBe(MAX_RPM);
		expect(window.minKmh).toBeGreaterThanOrEqual(0);
		expect(window.minRpm).toBeGreaterThanOrEqual(0);
	});

	it('never shrinks a span below the readable floor', () => {
		const window = clampWindow({ minKmh: 100, maxKmh: 100.5, minRpm: 3000, maxRpm: 3010 }, MAX_KMH, MAX_RPM);
		expect(window.maxKmh - window.minKmh).toBeCloseTo(VIEW_LIMITS.minSpanKmh, 6);
		expect(window.maxRpm - window.minRpm).toBeCloseTo(VIEW_LIMITS.minSpanRpm, 6);
	});

	it('recovers from an inverted window', () => {
		const window = clampWindow({ minKmh: 200, maxKmh: 50, minRpm: 8000, maxRpm: 2000 }, MAX_KMH, MAX_RPM);
		expect(window.maxKmh).toBeGreaterThan(window.minKmh);
		expect(window.maxRpm).toBeGreaterThan(window.minRpm);
	});
});

describe('zooming and panning', () => {
	it('shrinks both axes by the zoom factor', () => {
		const zoomed = zoomWindow(fullWindow(MAX_KMH, MAX_RPM), 0.5, MAX_KMH, MAX_RPM);
		expect(zoomed.maxKmh - zoomed.minKmh).toBeCloseTo(MAX_KMH / 2, 6);
		expect(zoomed.maxRpm - zoomed.minRpm).toBeCloseTo(MAX_RPM / 2, 6);
	});

	it('keeps the anchor value under the cursor', () => {
		const zoomed = zoomWindow(fullWindow(MAX_KMH, MAX_RPM), 0.5, MAX_KMH, MAX_RPM, { speed: 200, rpm: 6000 });
		const speedFraction = windowFraction(200, zoomed.minKmh, zoomed.maxKmh);
		const rpmFraction = windowFraction(6000, zoomed.minRpm, zoomed.maxRpm);
		expect(speedFraction).toBeCloseTo(200 / MAX_KMH, 6);
		expect(rpmFraction).toBeCloseTo(6000 / MAX_RPM, 6);
	});

	it('zooms out no further than the full axis', () => {
		const zoomed = zoomWindow(fullWindow(MAX_KMH, MAX_RPM), 4, MAX_KMH, MAX_RPM);
		expect(isFullWindow(zoomed, MAX_KMH, MAX_RPM)).toBe(true);
	});

	it('pans without leaving the axis', () => {
		const zoomed = zoomWindow(fullWindow(MAX_KMH, MAX_RPM), 0.5, MAX_KMH, MAX_RPM);
		const panned = panWindow(zoomed, 500, 5000, MAX_KMH, MAX_RPM);
		expect(panned.maxKmh).toBe(MAX_KMH);
		expect(panned.maxRpm).toBe(MAX_RPM);
		expect(panned.maxKmh - panned.minKmh).toBeCloseTo(zoomed.maxKmh - zoomed.minKmh, 6);
	});

	it('ignores a non-finite zoom factor and offset', () => {
		const base = fullWindow(MAX_KMH, MAX_RPM);
		expect(zoomWindow(base, Number.NaN, MAX_KMH, MAX_RPM)).toEqual(base);
		expect(panWindow(base, Number.NaN, Number.NaN, MAX_KMH, MAX_RPM)).toEqual(base);
	});
});

describe('projections through a window', () => {
	const window: GraphWindow = { minKmh: 100, maxKmh: 200, minRpm: 3000, maxRpm: 7000 };

	it('maps the window corners to the padding', () => {
		const frame = frameWith(window);
		expect(toX(frame, 100)).toBeCloseTo(frame.paddingLeft, 6);
		expect(toX(frame, 200)).toBeCloseTo(frame.paddingLeft + frame.plotWidth, 6);
		expect(toY(frame, 3000)).toBeCloseTo(frame.paddingTop + frame.plotHeight, 6);
		expect(toY(frame, 7000)).toBeCloseTo(frame.paddingTop, 6);
	});

	it('round-trips values inside the window', () => {
		const frame = frameWith(window);
		expect(speedAtX(frame, toX(frame, 147.8))).toBeCloseTo(147.8, 6);
		expect(rpmAtY(frame, toY(frame, 5217))).toBeCloseTo(5217, 6);
	});

	it('sanitizes a window that exceeds the frame axis', () => {
		const frame = buildPlotFrame(MAX_KMH, MAX_RPM, undefined, undefined, { minKmh: -50, maxKmh: 900, minRpm: -1, maxRpm: 90000 });
		expect(frame.window.minKmh).toBe(0);
		expect(frame.window.maxKmh).toBe(MAX_KMH);
		expect(frame.window.maxRpm).toBe(MAX_RPM);
	});

	it('falls back to the full axis without a window', () => {
		const frame = buildPlotFrame(MAX_KMH, MAX_RPM);
		expect(isFullWindow(frame.window, MAX_KMH, MAX_RPM)).toBe(true);
	});
});

describe('grip curve projection', () => {
	const window: GraphWindow = { minKmh: 100, maxKmh: 200, minRpm: 3000, maxRpm: 7000 };

	it('projects grip against the full RPM axis while zoomed', () => {
		const frame = frameWith(window);
		const peakY = gripCurveY(frame, 1000, 1000);
		const zeroY = gripCurveY(frame, 0, 1000);
		expect(peakY).toBeCloseTo(toY(frame, MAX_RPM), 6);
		expect(zeroY).toBeCloseTo(toY(frame, 0), 6);
	});

	it('keeps the same implied engine speed under different zoom windows', () => {
		const narrow = frameWith({ minKmh: 0, maxKmh: 300, minRpm: 0, maxRpm: 3500 });
		const wide = frameWith({ minKmh: 0, maxKmh: 300, minRpm: 0, maxRpm: 7000 });
		expect(rpmAtY(narrow, gripCurveY(narrow, 1000, 1000))).toBeCloseTo(MAX_RPM, 6);
		expect(rpmAtY(wide, gripCurveY(wide, 1000, 1000))).toBeCloseTo(MAX_RPM, 6);
		expect(rpmAtY(narrow, gripCurveY(narrow, 500, 1000))).toBeCloseTo(MAX_RPM / 2, 6);
	});

	it('draws a polyline when the samples are usable', () => {
		const frame = frameWith(window);
		const nodes = buildGripNodes(
			frame,
			'kmh',
			[
				{ vKmh: 100, limitN: 4000 },
				{ vKmh: 150, limitN: 3000 },
				{ vKmh: 200, limitN: 2000 },
			],
			4000,
			getGraphStyle().grip,
			true,
		);
		expect(nodes.some((node) => node.tag === 'polyline')).toBe(true);
	});
});

describe('axis ticks under zoom', () => {
	it('keeps the unit step on the full axis', () => {
		const frame = frameWith(fullWindow(MAX_KMH, MAX_RPM));
		expect(buildSpeedTicks(frame, getGraphStyle(), 'kmh')).toHaveLength(7);
		expect(buildSpeedTicks(frame, getGraphStyle(), 'mph')).toHaveLength(13);
	});

	it('refines the step when the window is too narrow for the unit step', () => {
		const frame = frameWith({ minKmh: 75, maxKmh: 148, minRpm: 0, maxRpm: MAX_RPM });
		const ticks = buildSpeedTicks(frame, getGraphStyle(), 'kmh');
		expect(ticks.length).toBeGreaterThanOrEqual(4);
		// The refined step stays a readable multiple: 10 km/h over a 73 km/h span.
		expect(ticks.map((tick) => tick.text)).toEqual(['80', '90', '100', '110', '120', '130', '140']);
	});

	it('refines the engine-speed step when zoomed in', () => {
		const frame = frameWith({ minKmh: 0, maxKmh: MAX_KMH, minRpm: 6000, maxRpm: 8000 });
		const ticks = buildRpmTicks(frame, getGraphStyle());
		expect(ticks.length).toBeGreaterThanOrEqual(4);
	});

	it('always emits at least one tick at the floor span', () => {
		const frame = frameWith({ minKmh: 100, maxKmh: 105, minRpm: 3000, maxRpm: 3250 });
		expect(buildSpeedTicks(frame, getGraphStyle(), 'kmh').length).toBeGreaterThanOrEqual(1);
		expect(buildRpmTicks(frame, getGraphStyle()).length).toBeGreaterThanOrEqual(1);
	});
});

describe('shift-drop markers', () => {
	it('skips a point whose landing speed reaches the limiter', () => {
		const frame = frameWith({ minKmh: 0, maxKmh: MAX_KMH, minRpm: 0, maxRpm: MAX_RPM });
		const nodes = buildShiftDropNodes(
			[
				{
					fromIndex: 0,
					fromGear: 1,
					toGear: 2,
					speed: 60,
					x: 200,
					redlineY: 100,
					landingRpm: 7200,
					landingY: 100,
					rpmDrop: 0,
					color: '#ef4444',
				},
			],
			getGraphStyle(),
			frame,
		);
		expect(nodes).toHaveLength(0);
	});

	it('draws the connector, both markers and the label for a real drop', () => {
		const frame = frameWith({ minKmh: 0, maxKmh: MAX_KMH, minRpm: 0, maxRpm: MAX_RPM });
		const nodes = buildShiftDropNodes(
			[
				{
					fromIndex: 0,
					fromGear: 1,
					toGear: 2,
					speed: 60,
					x: 200,
					redlineY: 100,
					landingRpm: 4300,
					landingY: 180,
					rpmDrop: 2900,
					color: '#ef4444',
				},
			],
			getGraphStyle(),
			frame,
		);
		expect(nodes.filter((node) => node.tag === 'line')).toHaveLength(1);
		expect(nodes.filter((node) => node.tag === 'circle')).toHaveLength(2);
		expect(nodes.filter((node) => node.tag === 'text')).toHaveLength(1);
	});

	it('builds the shift points of the default gearset on a windowed frame', () => {
		const frame = frameWith({ minKmh: 0, maxKmh: MAX_KMH, minRpm: 0, maxRpm: MAX_RPM });
		const points = buildShiftPoints(frame, state.gears, state.primaryFd, CIRC_M, state.primaryRedline, 'kmh');
		expect(points.length).toBe(state.gears.length - 1);
		for (const point of points) {
			expect(point.landingY).toBeGreaterThan(point.redlineY);
		}
	});
});
