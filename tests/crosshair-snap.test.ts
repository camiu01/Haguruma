/**
 * @file crosshair-snap.test.ts
 * @brief Snap-window tests for the crosshair shift-point lock.
 *
 * The marker and the HUD only follow a shift point while the cursor is close
 * to it; away from every point the cursor stays free and the tooltip keeps
 * tracking the pointer.
 */
import { describe, expect, it } from 'vitest';
import { defaultState } from '../src/core/state/app-state';
import { effectiveCircumferenceM, parseTire } from '../src/core/math/tire-math';
import { buildPlotFrame } from '../src/services/graph/svg-frame';
import { buildShiftPoints, snapPointFor, type ShiftPoint } from '../src/services/graph/svg-shift-drops';

/** Plot frame and upshift points of the default five-speed setup. */
const frame = buildPlotFrame(300, 8000);
const tire = parseTire(defaultState.primaryTire);
const circM = effectiveCircumferenceM(tire as NonNullable<typeof tire>, defaultState.rollingFactor);
const points: ShiftPoint[] = buildShiftPoints(
	frame,
	defaultState.gears,
	defaultState.primaryFd,
	circM,
	defaultState.primaryRedline,
	'kmh',
);

describe('snapPointFor', () => {
	it('builds at least two shift points from the default setup', () => {
		expect(points.length).toBeGreaterThan(1);
	});

	it('returns null when there is nothing to snap to', () => {
		expect(snapPointFor([], 120, frame.maxSpeed)).toBeNull();
	});

	it('locks onto the point under the cursor', () => {
		const target = points[0];
		expect(snapPointFor(points, target.speed, frame.maxSpeed)?.speed).toBeCloseTo(target.speed, 6);
	});

	it('locks while the cursor is inside the snapping window', () => {
		const target = points[0];
		const near = target.speed + frame.maxSpeed * 0.02;
		expect(snapPointFor(points, near, frame.maxSpeed)).not.toBeNull();
	});

	it('stays free outside the snapping window', () => {
		const target = points[0];
		const far = target.speed - frame.maxSpeed * 0.1;
		expect(snapPointFor(points, far, frame.maxSpeed)).toBeNull();
	});
});
