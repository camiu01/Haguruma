/**
 * @file shift-drops.test.ts
 * @brief Unit tests for shift-drop visibility helpers.
 */
import { describe, expect, it } from 'vitest';
import { drawSingleDrop, isPeakVisible } from '../src/services/graph/graph-shift-drops';
import { describeAllShiftDeltas, describeShiftDelta } from '../src/core/math/shift-math';
import type { PeakPoint, PlotFrame } from '../src/core/models';

/**
 * @brief Build a fixed frame fixture.
 * @return PlotFrame for visibility tests.
 */
const makeFrame = (): PlotFrame => ({
	width: 800,
	height: 500,
	paddingTop: 25,
	paddingRight: 30,
	paddingBottom: 40,
	paddingLeft: 55,
	plotWidth: 715,
	plotHeight: 435,
	maxSpeed: 300,
	maxRpm: 8000,
});

/**
 * @brief Build a peak point at a given X.
 * @param endX Canvas X coordinate.
 * @return PeakPoint fixture.
 */
const makePeak = (endX: number): PeakPoint => ({
	gear: 1,
	speed: 60,
	endX,
	endY: 100,
	ratio: 3.5,
	color: '#ef4444',
});

describe('isPeakVisible', () => {
	it('accepts peaks inside the plot', () => {
		expect(isPeakVisible(makeFrame(), makePeak(400))).toBe(true);
	});
	it('rejects peaks outside the plot', () => {
		expect(isPeakVisible(makeFrame(), makePeak(10))).toBe(false);
		expect(isPeakVisible(makeFrame(), makePeak(900))).toBe(false);
	});
});

/**
 * @brief Minimal canvas context recording drawing operations.
 * @return Stub context plus the op log and the recorded arc centers.
 */
const makeCtx = (): { ctx: CanvasRenderingContext2D; ops: string[]; arcs: number[][] } => {
	const ops: string[] = [];
	const arcs: number[][] = [];
	const record = (name: string) => (): void => {
		ops.push(name);
	};
	const ctx = {
		strokeStyle: '',
		fillStyle: '',
		lineWidth: 1,
		setLineDash: record('setLineDash'),
		beginPath: record('beginPath'),
		moveTo: record('moveTo'),
		lineTo: record('lineTo'),
		stroke: record('stroke'),
		fill: record('fill'),
		arc: (x: number, y: number, r: number): void => {
			ops.push('arc');
			arcs.push([x, y, r]);
		},
	} as unknown as CanvasRenderingContext2D;
	return { ctx, ops, arcs };
};

describe('drawSingleDrop', () => {
	it('draws the connector and landing marker below the peak', () => {
		const { ctx, ops, arcs } = makeCtx();
		drawSingleDrop(ctx, makeFrame(), makePeak(400), 6000);
		expect(ops).toContain('stroke');
		expect(arcs).toHaveLength(2);
		expect(arcs[0][0]).toBe(400);
		expect(arcs[0][1]).toBeCloseTo(25 + 435 - (6000 / 8000) * 435, 5);
		expect(arcs[1][1]).toBe(100);
	});
	it('draws nothing when the upshift does not lose rpm', () => {
		const { ctx, ops } = makeCtx();
		drawSingleDrop(ctx, makeFrame(), makePeak(400), 7000);
		expect(ops).toEqual([]);
	});
	it('draws nothing when the landing rpm exceeds the redline', () => {
		const { ctx, ops } = makeCtx();
		drawSingleDrop(ctx, makeFrame(), makePeak(400), 19228);
		expect(ops).toEqual([]);
	});
	it('projects the landing rpm through the panned viewport', () => {
		const { ctx, arcs } = makeCtx();
		const frame = { ...makeFrame(), minRpm: 2000, maxRpm: 7000 };
		drawSingleDrop(ctx, frame, makePeak(400), 5000);
		expect(arcs[0][1]).toBeCloseTo(25 + 435 - ((5000 - 2000) / 5000) * 435, 5);
	});
});

describe('describeShiftDelta', () => {
	it('compares landing rpm and shift speed of one pair', () => {
		const d = describeShiftDelta([3.58, 2.05], 0, 7000, 4.1, 1.935, [3.58, 2.0], 4.1, 1.935, 7000);
		expect(d).not.toBeNull();
		expect(d?.fromIndex).toBe(0);
		expect(d?.dShiftSpeed).toBeCloseTo(0, 6);
		expect(d?.dLandingRpm).not.toBe(0);
	});
	it('returns null on invalid pairs', () => {
		expect(describeShiftDelta([3.58], 0, 7000, 4.1, 1.935, [3.3, 2.0], 4.1, 1.935, 7000)).toBeNull();
		expect(describeShiftDelta([3.58, 2.05], 0, 0, 4.1, 1.935, [3.3, 2.0], 4.1, 1.935, 7000)).toBeNull();
	});
	it('covers every shared pair and skips nothing valid', () => {
		const all = describeAllShiftDeltas([3.58, 2.05, 1.38], 7000, 4.1, 1.935, [3.3, 2.0, 1.35], 4.1, 1.935, 7000);
		expect(all).toHaveLength(2);
		expect(all[0].fromIndex).toBe(0);
		expect(all[1].fromIndex).toBe(1);
		expect(describeAllShiftDeltas([], 7000, 4.1, 1.935, [3.3], 4.1, 1.935, 7000)).toEqual([]);
	});
});
