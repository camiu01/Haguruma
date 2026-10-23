/**
 * @file release-graph.test.ts
 * @brief Regression checks for window transforms, sharing, snapping and exports.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { defaultState, state } from '../src/core/state/app-state';
import { transformGraphWindow, fittedGraphSpeed } from '../src/services/graph/graph-viewport';
import { encodeState, decodeState } from '../src/core/share/share-utils';
import { alignPixel, toX, toY } from '../src/services/graph/canvas-setup';
import { nearestGraphGear } from '../src/services/graph/graph-snap';
import { escapeSvgText } from '../src/services/graph/graph-export-footer';
import { buildGraphSvg } from '../src/services/graph/graph-export';

afterEach(() => Object.assign(state, defaultState, { graphWindow: undefined, graphMode: undefined }));

describe('graph windows', () => {
	const w = { minKmh: 0, maxKmh: 300, minRpm: 0, maxRpm: 8000 };
	it('zooms about the anchor without changing its world position', () => {
		expect(transformGraphWindow(w, 0.5)).toEqual({ minKmh: 75, maxKmh: 225, minRpm: 2000, maxRpm: 6000 });
	});
	it('bounds pan and minimum spans', () => {
		const tiny = transformGraphWindow(w, 0.00001, 0, 0, -100, -100);
		expect(tiny).toEqual({ minKmh: 0, maxKmh: 5, minRpm: 0, maxRpm: 250 });
		const far = transformGraphWindow(w, 1, 0.5, 0.5, 100, 100);
		expect(far.maxKmh).toBe(2000);
		expect(far.maxRpm).toBe(30000);
	});
	it('ignores invalid transforms', () => {
		expect(transformGraphWindow(w, NaN)).toEqual(w);
		expect(transformGraphWindow(w, -1)).toEqual(w);
	});
	it('preserves SI window bounds alongside a packed setup token', () => {
		const encoded = encodeState({ ...defaultState, graphWindow: w });
		expect(encoded).toContain('c=');
		expect(decodeState(encoded).graphWindow).toEqual(w);
	});
	it('rejects partial, nonfinite and inverted URL windows', () => {
		for (const hash of ['z_min=0', 'z_min=0&z_max=NaN&z_rmin=0&z_rmax=8000',
			'z_min=100&z_max=50&z_rmin=0&z_rmax=8000', 'z_min=&z_max=300&z_rmin=0&z_rmax=8000']) {
			expect(decodeState(hash).graphWindow).toBeUndefined();
		}
	});
	it('auto fits the longest gear and respects an extra margin', () => {
		expect(fittedGraphSpeed(0.2)).toBeGreaterThan(fittedGraphSpeed(0));
		expect(Number.isFinite(fittedGraphSpeed(NaN))).toBe(true);
	});
});

describe('graph geometry and output', () => {
	it('exports the selected force view with force units, road resistance and grip', () => {
		state.graphMode = 'force';
		const canvas = { getBoundingClientRect: () => ({ width: 800, height: 450 }) } as HTMLCanvasElement;
		const svg = buildGraphSvg(canvas, '<local setup>');
		expect(svg).toContain('(N)');
		expect(svg).not.toContain('7000 RPM');
		expect(svg).toContain("stroke-dasharray='5 4'");
		expect(svg).toContain('&lt;local setup&gt;');
		expect(svg).not.toMatch(/NaN|Infinity/);
	});
	it('exports optional excess-force shading as clipped vector geometry', () => {
		state.graphMode = 'force'; state.showTractionMargin = true;
		state.runningGear = { ...state.runningGear, roadFrictionCoefficient: 0.1 };
		const canvas = { getBoundingClientRect: () => ({ width: 800, height: 450 }) } as HTMLCanvasElement;
		const svg = buildGraphSvg(canvas);
		expect(svg).toMatch(/data-layer='excess-force'[^>]*><rect/);
		expect(svg).not.toMatch(/NaN|Infinity/);
	});
	it('maps lower and upper viewport bounds to the plot edges', () => {
		const frame = { width: 800, height: 450, paddingLeft: 55, paddingRight: 30, paddingTop: 25, paddingBottom: 40,
			plotWidth: 715, plotHeight: 385, minSpeed: 100, maxSpeed: 200, minRpm: 2000, maxRpm: 6000 };
		expect(toX(frame, 100)).toBe(55);
		expect(toX(frame, 200)).toBe(770);
		expect(toY(frame, 2000)).toBe(410);
		expect(toY(frame, 6000)).toBe(25);
	});
	it('aligns grid strokes in physical pixels at fractional DPR', () => {
		for (const dpr of [1, 1.25, 1.5, 2]) expect(alignPixel(51.3, dpr) * dpr % 1).toBeCloseTo(0.5);
	});
	it('selects a reachable curve and rejects unreachable road speeds', () => {
		expect(nearestGraphGear(50, 3000)).not.toBeNull();
		expect(nearestGraphGear(2000, 3000)).toBeNull();
	});
	it('escapes untrusted SVG metadata', () => {
		expect(escapeSvgText('<car & "setup">')).toBe('&lt;car &amp; &quot;setup&quot;&gt;');
	});
});
