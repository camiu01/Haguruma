/**
 * @file graph-limits.test.ts
 * @brief Unit tests for the grip-limit curve normalization.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { drawGripCurve } from '../src/services/graph/graph-limits';
import { toX } from '../src/services/graph/canvas-setup';
import type { PlotFrame } from '../src/core/models';
import { state } from '../src/core/state/app-state';
import { getMaxRpm } from '../src/core/units/unit-utils';

/**
 * @brief Plot frame fixture with an optional visible speed window.
 * @param minSpeed Left edge of the visible window, or undefined for the full axis.
 * @param maxSpeed Right edge of the visible window.
 * @return Fixed PlotFrame.
 */
const makeFrame = (minSpeed: number | undefined, maxSpeed: number): PlotFrame => ({
	width: 800,
	height: 450,
	paddingTop: 25,
	paddingRight: 30,
	paddingBottom: 40,
	paddingLeft: 55,
	plotWidth: 715,
	plotHeight: 385,
	maxSpeed,
	maxRpm: getMaxRpm(state.compareEnabled ? Math.max(state.primaryRedline, state.compRedline) : state.primaryRedline),
	...(minSpeed === undefined ? {} : { minSpeed }),
});

/**
 * @brief Force curve with its peak near 20 km/h, outside a zoomed window.
 * @param v Speed in km/h.
 * @return Force in newtons.
 */
const peakyForce = (v: number): number => 1000 + 4000 * Math.exp(-((v - 20) ** 2) / 200);

/**
 * @brief Minimal canvas context recording the polyline vertices.
 * @return Stub context plus the recorded points.
 */
const makeCtx = (): { ctx: CanvasRenderingContext2D; points: number[][] } => {
	const points: number[][] = [];
	const noop = (): void => {};
	const ctx = {
		save: noop,
		restore: noop,
		strokeStyle: '',
		fillStyle: '',
		lineWidth: 1,
		globalAlpha: 1,
		font: '',
		textAlign: 'left',
		setLineDash: noop,
		beginPath: noop,
		closePath: noop,
		stroke: noop,
		fill: noop,
		fillText: noop,
		moveTo: (x: number, y: number): void => {
			points.push([x, y]);
		},
		lineTo: (x: number, y: number): void => {
			points.push([x, y]);
		},
	} as unknown as CanvasRenderingContext2D;
	return { ctx, points };
};

/**
 * @brief Read the curve Y at one speed.
 * @param points Recorded polyline vertices.
 * @param frame Frame the curve was drawn with.
 * @param speed Speed to look up, in display units.
 * @return Canvas Y, or NaN when the speed is not on the polyline.
 */
const yAt = (points: number[][], frame: PlotFrame, speed: number): number => {
	const target = toX(frame, speed);
	const hit = points.find((p) => Math.abs(p[0] - target) < 1e-6);
	return hit ? hit[1] : Number.NaN;
};

describe('drawGripCurve', () => {
	const originalMaxSpeed = state.maxGraphSpeed;
	beforeEach(() => {
		state.maxGraphSpeed = 300;
	});
	afterEach(() => {
		state.maxGraphSpeed = originalMaxSpeed;
	});
	it('normalizes against the whole axis, not the visible window', () => {
		const full = makeCtx();
		const zoomed = makeCtx();
		drawGripCurve(full.ctx, makeFrame(undefined, 300), peakyForce, '#22c55e', true);
		drawGripCurve(zoomed.ctx, makeFrame(150, 300), peakyForce, '#22c55e', true);
		const fullY = yAt(full.points, makeFrame(undefined, 300), 150);
		const zoomedY = yAt(zoomed.points, makeFrame(150, 300), 150);
		expect(Number.isFinite(fullY)).toBe(true);
		expect(Number.isFinite(zoomedY)).toBe(true);
		expect(zoomedY).toBeCloseTo(fullY, 6);
	});
	it('keeps the curve inside the plot and strokes it once', () => {
		const { ctx, points } = makeCtx();
		const frame = makeFrame(undefined, 300);
		drawGripCurve(ctx, frame, peakyForce, '#22c55e', false);
		expect(points).toHaveLength(61);
		for (const [, y] of points) {
			expect(y).toBeGreaterThanOrEqual(frame.paddingTop);
			expect(y).toBeLessThanOrEqual(frame.paddingTop + frame.plotHeight);
		}
	});
	it('projects the same force onto the panned RPM window', () => {
		const full = makeCtx();
		const panned = makeCtx();
		const frame = makeFrame(undefined, 300);
		const window = { ...frame, minRpm: 2000, maxRpm: 7000 };
		drawGripCurve(full.ctx, frame, peakyForce, '#22c55e');
		drawGripCurve(panned.ctx, window, peakyForce, '#22c55e');
		const fullY = yAt(full.points, frame, 150);
		const redline = state.compareEnabled ? Math.max(state.primaryRedline, state.compRedline) : state.primaryRedline;
		const rpm = ((frame.paddingTop + frame.plotHeight - fullY) / frame.plotHeight) * getMaxRpm(redline);
		expect(yAt(panned.points, window, 150)).toBeCloseTo(frame.paddingTop + frame.plotHeight - ((rpm - 2000) / 5000) * frame.plotHeight, 6);
	});
});
