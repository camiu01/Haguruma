/**
 * @file graph-layers.test.ts
 * @brief Unit tests for dual-layer cache keys and aero-wall shading.
 */
import { describe, expect, it } from 'vitest';
import { buildStaticKey, type StaticLayerKey } from '../src/services/graph/graph-layers';
import { shadeAeroWall } from '../src/services/graph/graph-axes';
import { toX } from '../src/services/graph/canvas-setup';
import type { PlotFrame } from '../src/core/models';

/**
 * @brief Base static key fixture.
 * @return Fixed StaticLayerKey.
 */
const makeKey = (): StaticLayerKey => ({
	width: 1600,
	height: 900,
	maxSpeed: 300,
	maxRpm: 8000,
	unit: 'kmh',
	theme: 'dark',
	redline: 7200,
});

/**
 * @brief Plot frame fixture matching the static key.
 * @return Fixed PlotFrame.
 */
const makeFrame = (): PlotFrame => ({
	width: 800,
	height: 450,
	paddingTop: 25,
	paddingRight: 30,
	paddingBottom: 40,
	paddingLeft: 55,
	plotWidth: 715,
	plotHeight: 385,
	maxSpeed: 300,
	maxRpm: 8000,
});

/**
 * @brief Minimal canvas context recording fillRect calls.
 * @return Stub context with a call log.
 */
const makeCtx = (): { ctx: CanvasRenderingContext2D; calls: number[][] } => {
	const calls: number[][] = [];
	const ctx = {
		set fillStyle(_v: string) {},
		fillRect: (x: number, y: number, w: number, h: number): void => {
			calls.push([x, y, w, h]);
		},
	} as unknown as CanvasRenderingContext2D;
	return { ctx, calls };
};

describe('buildStaticKey', () => {
	it('is stable for identical inputs', () => {
		expect(buildStaticKey(makeKey())).toBe(buildStaticKey(makeKey()));
	});
	it('changes with frame size, limits, unit, theme and redline', () => {
		const base = buildStaticKey(makeKey());
		expect(buildStaticKey({ ...makeKey(), width: 800 })).not.toBe(base);
		expect(buildStaticKey({ ...makeKey(), maxSpeed: 250 })).not.toBe(base);
		expect(buildStaticKey({ ...makeKey(), maxRpm: 9000 })).not.toBe(base);
		expect(buildStaticKey({ ...makeKey(), unit: 'mph' })).not.toBe(base);
		expect(buildStaticKey({ ...makeKey(), theme: 'light' })).not.toBe(base);
		expect(buildStaticKey({ ...makeKey(), redline: 8000 })).not.toBe(base);
	});
});

describe('shadeAeroWall', () => {
	it('shades from the limit to the right edge', () => {
		const { ctx, calls } = makeCtx();
		shadeAeroWall(ctx, makeFrame(), 200, 'kmh');
		expect(calls).toHaveLength(1);
		expect(calls[0][0]).toBeCloseTo(toX(makeFrame(), 200), 5);
		expect(calls[0][2]).toBeCloseTo(770 - toX(makeFrame(), 200), 5);
	});
	it('skips out-of-range limits', () => {
		const { ctx, calls } = makeCtx();
		shadeAeroWall(ctx, makeFrame(), 0, 'kmh');
		shadeAeroWall(ctx, makeFrame(), 400, 'kmh');
		expect(calls).toHaveLength(0);
	});
});
