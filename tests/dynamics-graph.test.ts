/**
 * @file dynamics-graph.test.ts
 * @brief Physical-unit force profiles and SVG stopping-distance plots.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { defaultState, state } from '../src/core/state/app-state';
import { primaryForceInput } from '../src/core/state/dynamics-input';
import { forceLimitedSpeedKmh, forceReadoutAt, resistanceAt } from '../src/core/math/force-profile';
import { speedKmh } from '../src/core/math/speed-math';
import { buildDynamicsGraph, sampleGearForces } from '../src/services/graph/dynamics-graph';
import type { SvgPrim } from '../src/services/graph/svg-nodes';

/**
 * @brief Flatten nested SVG primitives for semantic assertions.
 * @param nodes Layer tree.
 * @return All descendants including groups.
 */
const flatten = (nodes: SvgPrim[]): SvgPrim[] => nodes.flatMap((n) => [n, ...flatten(n.children ?? [])]);

afterEach(() => {
	state.dynamics = { ...defaultState.dynamics, shiftTimesS: [] };
	state.unit = 'kmh';
	state.compareEnabled = defaultState.compareEnabled;
});

describe('physical force plot', () => {
	it('draws a separate colored curve per gear, road resistance and optional margin', () => {
		state.dynamics.graphView = 'force';
		state.dynamics.tractionOverlay = true;
		const nodes = flatten(buildDynamicsGraph(1000, 560));
		expect(nodes.filter((n) => n.attrs?.['data-force-gear'])).toHaveLength(state.gears.length);
		expect(nodes.filter((n) => n.attrs?.['data-traction-margin'])).toHaveLength(state.gears.length);
		expect(nodes.some((n) => n.attrs?.['data-road-resistance'] !== undefined)).toBe(true);
		expect(nodes.some((n) => n.text?.includes('(N)'))).toBe(true);
	});
	it('converts speed only at the display boundary and clips samples to the speed window', () => {
		const input = primaryForceInput();
		const metric = sampleGearForces(input, 160.9344, 'kmh');
		const imperial = sampleGearForces(input, 100, 'mph');
		expect(metric).toEqual(imperial);
		const readout = forceReadoutAt(input, 0, 30);
		expect(readout.marginN).toBeCloseTo(readout.driveN - readout.gripN, 8);
		expect(resistanceAt(input, 200)).toBeGreaterThan(resistanceAt(input, 100));
	});
	it('does not expose engine torque above the rev limiter or below idle', () => {
		const input = primaryForceInput();
		expect(forceReadoutAt(input, 0, 400).driveN).toBe(0);
		expect(forceReadoutAt(input, 0, 0).driveN).toBe(0);
	});
	it('marks force-based Vmax and bounds it by the highest gear limiter', () => {
		state.dynamics.graphView = 'force';
		const input = primaryForceInput();
		const vmax = forceLimitedSpeedKmh(input)!;
		expect(vmax).toBeGreaterThan(100);
		expect(vmax).toBeLessThanOrEqual(speedKmh(input.curve!.redline, input.gears.at(-1)!, input.fd, input.circM));
		const nodes = flatten(buildDynamicsGraph(1000, 560));
		expect(nodes.some((n) => n.attrs?.['data-force-vmax'] === vmax)).toBe(true);
		const noLoads = { ...input, cd: 0, crr: 0, grade: 0 };
		expect(forceLimitedSpeedKmh(noLoads)).toBeCloseTo(speedKmh(input.curve!.redline, input.gears.at(-1)!, input.fd, input.circM), 8);
	});
	it('adds independent dashed comparison force curves only when enabled', () => {
		state.dynamics.graphView = 'force';
		state.compareEnabled = true;
		const nodes = flatten(buildDynamicsGraph(1000, 560));
		const comparison = nodes.filter((n) => n.attrs?.['data-compare-force-gear']);
		expect(comparison).toHaveLength(state.compGears.length);
		expect(comparison.every((n) => n.attrs?.['stroke-dasharray'] === '6 4')).toBe(true);
	});
	it('draws both stopping-speed curves and deceleration on a distance axis', () => {
		state.dynamics.graphView = 'braking';
		const nodes = flatten(buildDynamicsGraph(1000, 560));
		expect(nodes.filter((n) => n.attrs?.['data-braking-speed'])).toHaveLength(2);
		expect(nodes.filter((n) => n.attrs?.['data-braking-decel'])).toHaveLength(2);
		expect(nodes.some((n) => n.text === 'Distance (m)' || n.text === 'Distanza (m)')).toBe(true);
		expect(nodes.some((n) => n.text === 'm/s²')).toBe(true);
	});
});
