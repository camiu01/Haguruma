/**
 * @file graph-svg.test.ts
 * @brief Pure-function tests for the SVG plot engine (no DOM anywhere).
 *
 * Covers the frame projections, the speed step per unit, the aero-wall fade
 * rule of the gear rays, the power-envelope crossing against
 * `dragLimitedSpeedKmh` and the layer-visibility gating of the composed scene.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { getMaxRpm, getSpeedStep } from '../src/core/units/unit-utils';
import { dragLimitedSpeedKmh, roadLoadPowerKw } from '../src/core/math/aero-math';
import { parseTire } from '../src/core/math/tire-math';
import { state, defaultState } from '../src/core/state/app-state';
import { getGraphStyle } from '../src/services/graph/graph-theme';
import { axisSpeedStep, buildPlotFrame, plotMaxRpm, rpmAtY, speedAtX, toX, toY } from '../src/services/graph/svg-frame';
import { buildSpeedTicks } from '../src/services/graph/svg-axes';
import { buildGearRays, buildPrimaryLayer } from '../src/services/graph/svg-curves';
import { buildPowerEnvelope, crossingSpeedKmh } from '../src/services/graph/svg-power';
import { buildSceneData, composeNodes } from '../src/services/graph/graph-scene';
import type { SvgPrim } from '../src/services/graph/svg-nodes';
import type { PlotFrame, SpeedUnit } from '../src/core/models';

/** Plot frame used by the pure geometry tests. */
const makeFrame = (maxSpeed: number = 300, maxRpm: number = 8000): PlotFrame => {
	return buildPlotFrame(maxSpeed, maxRpm);
};

/** Rolling circumference of the default 205/55R16 tire. */
const CIRC_M = 1.9362;

/** Default road-load inputs matching the shared state defaults. */
const ROAD = { mass: 1200, cd: 0.3, area: 2.0, crr: 0.012, grade: 0 };

/**
 * @brief Flatten a primitive tree into one list.
 * @param nodes Primitive list, possibly nested.
 * @return Every primitive including nested children.
 */
const flatten = (nodes: SvgPrim[]): SvgPrim[] => {
	const out: SvgPrim[] = [];
	for (const node of nodes) {
		out.push(node);
		if (node.children) {
			out.push(...flatten(node.children));
		}
	}
	return out;
};

/**
 * @brief Collect groups carrying one class name.
 * @param nodes Primitive list.
 * @param cls Group class to match.
 * @return Matching group primitives.
 */
const groupsByClass = (nodes: SvgPrim[], cls: string): SvgPrim[] => {
	return flatten(nodes).filter((node) => node.tag === 'g' && node.attrs?.class === cls);
};

/** Set one layer switch for the duration of a test. */
const setLayer = (key: keyof typeof defaultState.graphLayers, value: boolean): void => {
	state.graphLayers = { ...defaultState.graphLayers, [key]: value };
};

afterEach(() => {
	state.graphLayers = { ...defaultState.graphLayers };
});

describe('plot frame', () => {
	it('uses the ceiling of getMaxRpm for the Y axis', () => {
		const frame = makeFrame(300, getMaxRpm(7200));
		expect(frame.maxRpm).toBe(getMaxRpm(7200));
		expect(getMaxRpm(7200)).toBe(8500);
		expect(getMaxRpm(8300)).toBe(9500);
		expect(plotMaxRpm(7200, 7000, false)).toBe(8500);
		expect(plotMaxRpm(7200, 8300, true)).toBe(9500);
		expect(plotMaxRpm(7200, 8300, false)).toBe(8500);
	});

	it('maps the X axis corners to the padding', () => {
		const frame = makeFrame();
		expect(toX(frame, 0)).toBe(frame.paddingLeft);
		expect(toX(frame, frame.maxSpeed)).toBeCloseTo(frame.paddingLeft + frame.plotWidth, 6);
	});

	it('round-trips speeds and RPM through the projections', () => {
		const frame = makeFrame();
		expect(speedAtX(frame, toX(frame, 147.8))).toBeCloseTo(147.8, 6);
		expect(rpmAtY(frame, toY(frame, 5217))).toBeCloseTo(5217, 6);
		expect(toY(frame, 0)).toBeCloseTo(frame.paddingTop + frame.plotHeight, 6);
		expect(toY(frame, frame.maxRpm)).toBeCloseTo(frame.paddingTop, 6);
	});

	it('uses the unit-specific speed step for the grid and ticks', () => {
		expect(getSpeedStep('kmh')).toBe(50);
		expect(getSpeedStep('mph')).toBe(25);
		expect(axisSpeedStep('kmh')).toBe(50);
		expect(axisSpeedStep('mph')).toBe(25);
		const style = getGraphStyle();
		expect(buildSpeedTicks(makeFrame(300, 8000), style, 'kmh')).toHaveLength(7);
		expect(buildSpeedTicks(makeFrame(300, 8000), style, 'mph')).toHaveLength(13);
	});
});

describe('gear rays and the aero wall fade', () => {
	const baseInput = {
		frame: makeFrame(),
		gears: [3.58, 0.68],
		finalDrive: 4.1,
		circM: CIRC_M,
		redline: 7200,
		unit: 'kmh' as SpeedUnit,
	};

	it('marks a ray as cut when the wall is below its redline speed', () => {
		const whole = buildGearRays({ ...baseInput, wallSpeed: null });
		const wall = whole[0].topSpeed / 2;
		const rays = buildGearRays({ ...baseInput, wallSpeed: wall });
		expect(whole[1].topSpeed).toBeGreaterThan(wall);
		expect(rays.every((ray) => ray.wallSpeed === wall)).toBe(true);
	});

	it('leaves rays whole when there is no wall or the wall is beyond them', () => {
		expect(buildGearRays({ ...baseInput, wallSpeed: null }).every((ray) => ray.wallSpeed === null)).toBe(true);
		const above = buildGearRays({ ...baseInput, wallSpeed: 500 });
		expect(above.every((ray) => ray.wallSpeed === null)).toBe(true);
	});

	it('draws one solid segment plus one faded tail per cut ray', () => {
		const whole = buildGearRays({ ...baseInput, wallSpeed: null });
		const cut = buildPrimaryLayer({ ...baseInput, wallSpeed: whole[0].topSpeed / 2 });
		const cutLines = flatten(cut.nodes).filter((node) => node.tag === 'line');
		const faded = cutLines.filter((node) => node.attrs?.['stroke-dasharray'] !== undefined);
		expect(cutLines).toHaveLength(4);
		expect(faded).toHaveLength(2);
		const intact = buildPrimaryLayer({ ...baseInput, wallSpeed: null });
		expect(flatten(intact.nodes).filter((node) => node.tag === 'line')).toHaveLength(2);
	});
});

describe('power envelope crossing', () => {
	it('agrees with dragLimitedSpeedKmh on a constant power plateau', () => {
		const capKw = 110 * 0.85;
		const crossing = crossingSpeedKmh(
			() => capKw,
			(v) => roadLoadPowerKw(v, ROAD.mass, ROAD.cd, ROAD.area, ROAD.crr, ROAD.grade),
			600,
		);
		const reference = dragLimitedSpeedKmh(capKw, ROAD.mass, ROAD.cd, ROAD.area, ROAD.crr, ROAD.grade);
		expect(crossing).not.toBeNull();
		expect(Math.abs((crossing as number) - reference)).toBeLessThan(1);
	});

	it('places the sampled envelope crossing on the aero wall of the same setup', () => {
		const frame = makeFrame();
		const envelope = buildPowerEnvelope({
			frame,
			unit: 'kmh',
			gears: state.gears,
			finalDrive: state.primaryFd,
			circM: CIRC_M,
			curve: { redline: 7200, peakTorqueRpm: 4500, peakTorqueNm: 180, peakPowerRpm: 6500, peakPowerKw: 110, points: null },
			eff: state.drivetrainEff,
			capKw: 110 * state.drivetrainEff,
			massKg: ROAD.mass,
			dragCd: ROAD.cd,
			frontalAreaM2: ROAD.area,
			crr: ROAD.crr,
			gradePercent: ROAD.grade,
		});
		const reference = dragLimitedSpeedKmh(110 * state.drivetrainEff, ROAD.mass, ROAD.cd, ROAD.area, ROAD.crr, ROAD.grade);
		expect(envelope.available.length).toBeGreaterThan(10);
		expect(envelope.crossingKmh).not.toBeNull();
		expect(Math.abs((envelope.crossingKmh as number) - reference)).toBeLessThan(15);
		expect(envelope.maxKw).toBeGreaterThan(0);
	});

	it('returns no crossing when availability never covers the demand', () => {
		expect(crossingSpeedKmh(() => 30, () => 50, 600)).toBeNull();
		expect(crossingSpeedKmh(() => 30, () => 50, 0)).toBeNull();
	});
});

describe('layer visibility gating', () => {
	const tire = parseTire(defaultState.primaryTire);

	it('omits every optional layer group when the switches are off', () => {
		state.graphLayers = { ...defaultState.graphLayers, shiftDrops: false, aeroWall: false, gripLimit: false, powerCurve: false };
		const nodes = composeNodes(buildSceneData(tire as NonNullable<typeof tire>));
		expect(groupsByClass(nodes, 'graph-shift-drops')).toHaveLength(0);
		expect(groupsByClass(nodes, 'graph-aero')).toHaveLength(0);
		expect(groupsByClass(nodes, 'graph-grip')).toHaveLength(0);
		expect(groupsByClass(nodes, 'graph-power')).toHaveLength(0);
		expect(flatten(nodes).some((node) => node.attrs?.['fill'] === 'url(#hg-spin-hatch)')).toBe(false);
	});

	it('emits nodes for every layer that is switched on', () => {
		state.graphLayers = { ...defaultState.graphLayers, shiftDrops: true, aeroWall: true, gripLimit: true, powerCurve: true };
		const nodes = composeNodes(buildSceneData(tire as NonNullable<typeof tire>));
		for (const cls of ['graph-shift-drops', 'graph-aero', 'graph-grip', 'graph-power']) {
			const group = groupsByClass(nodes, cls);
			expect(group).toHaveLength(1);
			expect(group[0].children?.length ?? 0).toBeGreaterThan(0);
		}
	});

	it('keeps the power axis off while the curve layer is disabled', () => {
		setLayer('powerCurve', false);
		const nodes = composeNodes(buildSceneData(tire as NonNullable<typeof tire>));
		const axisTitles = flatten(nodes).filter((node) => node.tag === 'text' && node.text === 'WHEEL POWER (kW)');
		expect(axisTitles).toHaveLength(0);
		setLayer('powerCurve', true);
		const withPower = composeNodes(buildSceneData(tire as NonNullable<typeof tire>));
		expect(flatten(withPower).some((node) => node.tag === 'text' && node.text === 'WHEEL POWER (kW)')).toBe(true);
	});

	it('drops the fine grid texture when the switch is off', () => {
		setLayer('fineGrid', true);
		const fine = flatten(composeNodes(buildSceneData(tire as NonNullable<typeof tire>))).filter(
			(node) => node.tag === 'path' && typeof node.attrs?.d === 'string',
		);
		expect(fine.length).toBe(1);
		setLayer('fineGrid', false);
		const coarse = flatten(composeNodes(buildSceneData(tire as NonNullable<typeof tire>))).filter(
			(node) => node.tag === 'path' && typeof node.attrs?.d === 'string',
		);
		expect(coarse.length).toBe(0);
	});
});
