/**
 * @file graph-scene.ts
 * @brief Resolve the plot scene from state and compose the layer stack.
 *
 * One place turns shared state into plot geometry (frame, rays, shift points,
 * walls, grip curves, power envelope) and one place orders the resulting
 * primitives in the documented draw order.
 */
import { state, defaultRunningGear } from '../../core/state/app-state';
import { effectiveCircumferenceM, parseTire } from '../../core/math/tire-math';
import { availableWheelKw, dragLimitedSpeedKmh } from '../../core/math/aero-math';
import { rpmFromKmh, toDisplaySpeed } from '../../core/math/speed-math';
import { dynamicRadiusM, tractiveForceAt } from '../../core/math/traction-math';
import { maxDriveForceAtSpeed } from '../../core/math/dynamics-math';
import { activeEngineCurve } from '../../core/state/engine-curve';
import type { GraphLayerSettings, PlotFrame, SpeedUnit, TireSpec } from '../../core/models';
import { GRAPH_DEFS, buildDefs } from './svg-defs';
import { getGraphStyle, type GraphPalette } from './graph-theme';
import {
	buildAxisTitles,
	buildBackground,
	buildCompareRedline,
	buildGrid,
	buildPowerAxis,
	buildRedlineBand,
	buildRpmTicks,
	buildSpeedTicks,
} from './svg-axes';
import { buildPlotFrame, plotMaxRpm } from './svg-frame';
import { buildCompareLayer, buildPrimaryLayer, buildReverseLayer } from './svg-curves';
import { buildShiftDropNodes, buildShiftPoints, type ShiftPoint } from './svg-shift-drops';
import { buildForceSamples, buildGripNodes, buildSpinNodes, buildWallNodes, samplePeak, spinBands } from './svg-limits';
import { buildPowerNodes, buildComparePowerNodes, type PowerEnvelope } from './svg-power';
import { group, type SvgPrim } from './svg-nodes';
import type { CrosshairCompare, CrosshairContext } from './graph-crosshair';
import { buildCrosshairContext } from './graph-crosshair-context';
import { powerEnvelopes } from './graph-power-scene';

/** Everything one render pass needs to compose the plot. */
export interface SceneData {
	/** Plot geometry and limits. */
	frame: PlotFrame;
	/** Active theme palette. */
	style: GraphPalette;
	/** Active display unit. */
	unit: SpeedUnit;
	/** Active layer switches. */
	layers: GraphLayerSettings;
	/** Primary rays, gear tags and the reverse ray. */
	primaryNodes: SvgPrim[];
	/** Dashed comparison rays, null when the overlay is hidden. */
	compareNodes: SvgPrim[] | null;
	/** Grip limit curves and launch wheelspin shading. */
	gripNodes: SvgPrim[];
	/** Shift points, reused as crosshair snap targets. */
	points: ShiftPoint[];
	/** Primary aero-wall speed in display units, null when not drawn. */
	primaryWall: number | null;
	/** Comparison aero-wall speed in display units, null when not drawn. */
	compareWall: number | null;
	/** Available-versus-required power envelope, null when the layer is off. */
	envelope: PowerEnvelope | null;
	/** Secondary power envelope, null when the layer or the comparison is off. */
	compareEnvelope: PowerEnvelope | null;
	/** Context handed to the crosshair module. */
	crosshair: CrosshairContext;
}

/**
 * @brief Resolve a drag-limited speed for one power/aero slot.
 * @param frame Plot geometry and limits.
 * @param unit Active display unit.
 * @param powerKw Crank power in kilowatts for that slot.
 * @param massKg Vehicle mass in kilograms.
 * @param cd Drag coefficient.
 * @param area Frontal area in square metres.
 * @return Wall speed in display units, null when absent or outside the plot.
 */
const wallDisplay = (
	frame: PlotFrame,
	unit: SpeedUnit,
	powerKw: number,
	massKg: number,
	cd: number,
	area: number,
): number | null => {
	if (!state.roadLoadEnabled) {
		return null;
	}
	const kmh = dragLimitedSpeedKmh(
		availableWheelKw(powerKw, state.drivetrainEff),
		massKg,
		cd,
		area,
		state.rollingCrr,
		state.roadGradePercent,
	);
	const shown = toDisplaySpeed(kmh, unit);
	return shown > 0 && shown < frame.maxSpeed ? shown : null;
};

/**
 * @brief Resolve the primary and comparison wall speeds.
 * @param frame Plot geometry and limits.
 * @param unit Active display unit.
 * @param layers Active layer switches.
 * @return Primary and comparison wall speeds in display units.
 */
const resolveWalls = (
	frame: PlotFrame,
	unit: SpeedUnit,
	layers: GraphLayerSettings,
): { primary: number | null; compare: number | null } => {
	if (!layers.aeroWall) {
		return { primary: null, compare: null };
	}
	return {
		primary: wallDisplay(frame, unit, state.enginePowerKw, state.vehicleMassKg, state.dragCd, state.frontalAreaM2),
		compare: wallDisplay(frame, unit, state.compPowerKw, state.compMassKg, state.compCd, state.compFrontalAreaM2),
	};
};

/**
 * @brief Resolve the comparison overlay geometry.
 * @return Crosshair compare block plus its circumference, null when hidden.
 */
const compareGeometry = (): { crosshair: CrosshairCompare; circM: number } | null => {
	if (!state.compareEnabled || state.compFd <= 0 || state.compGears.length === 0) {
		return null;
	}
	const compTire = parseTire(state.compTire);
	if (!compTire) {
		return null;
	}
	const circM = effectiveCircumferenceM(compTire, state.rollingFactor);
	if (!(circM > 0)) {
		return null;
	}
	return {
		crosshair: { gears: state.compGears, finalDrive: state.compFd, circM, redline: state.compRedline },
		circM,
	};
};

/**
 * @brief Build the first-gear tractive-force function used for spin shading.
 * @param circM Primary rolling circumference in metres.
 * @return Force function in newtons from speed in km/h, null when unusable.
 */
const firstGearForceFn = (circM: number): ((vKmh: number) => number) | null => {
	const curve = activeEngineCurve();
	const radius = dynamicRadiusM(circM);
	if (!curve || radius <= 0 || state.gears.length === 0) {
		return null;
	}
	const first = state.gears[0];
	return (vKmh: number): number => {
		const rpm = rpmFromKmh(vKmh, first, state.primaryFd, circM);
		return tractiveForceAt(rpm, first, state.primaryFd, radius, curve, state.drivetrainEff);
	};
};

/**
 * @brief Build the grip-limit layer: launch wheelspin band plus limit curves.
 * @param frame Plot geometry and limits.
 * @param unit Active display unit.
 * @param style Active theme palette.
 * @param circM Primary rolling circumference in metres.
 * @return Mountable primitives for the grip layer.
 */
const gripLayerNodes = (frame: PlotFrame, unit: SpeedUnit, style: GraphPalette, circM: number): SvgPrim[] => {
	const rg = state.runningGear ?? defaultRunningGear;
	const gripFn = (vKmh: number): number => maxDriveForceAtSpeed(rg, state.vehicleMassKg, vKmh, 0, 0).limitN;
	const gearForce = firstGearForceFn(circM);
	const nodes: SvgPrim[] = gearForce ? buildSpinNodes(frame, spinBands(frame, unit, gripFn, gearForce)) : [];
	const samples = buildForceSamples(frame, unit, gripFn);
	nodes.push(...buildGripNodes(frame, unit, samples, samplePeak(samples), style.grip, true));
	if (state.compareEnabled) {
		const crg = state.compRunningGear ?? rg;
		const compGrip = (vKmh: number): number => maxDriveForceAtSpeed(crg, state.compMassKg, vKmh, 0, 0).limitN;
		const compSamples = buildForceSamples(frame, unit, compGrip);
		nodes.push(...buildGripNodes(frame, unit, compSamples, samplePeak(compSamples), style.gripCompare, false));
	}
	return nodes;
};

/**
 * @brief Assemble every input of one render pass from the shared state.
 * @brief Width and height come from the measured plot host, so the viewBox
 * @brief units match CSS pixels and text never scales down on small screens.
 * @param tire Validated primary tire, guarantees a drawable plot.
 * @param width ViewBox width in CSS pixels, defaults to the static width.
 * @param height ViewBox height in CSS pixels, defaults to the static height.
 * @return Scene data with prebuilt layer primitives.
 */
export const buildSceneData = (tire: TireSpec, width?: number, height?: number): SceneData => {
	const layers = state.graphLayers;
	const frame = buildPlotFrame(
		state.maxGraphSpeed,
		plotMaxRpm(state.primaryRedline, state.compRedline, state.compareEnabled),
		width,
		height,
	);
	const style = getGraphStyle();
	const unit = state.unit;
	const circM = effectiveCircumferenceM(tire, state.rollingFactor);
	const walls = resolveWalls(frame, unit, layers);
	const primaryNodes = primarySceneNodes(frame, circM, walls.primary);
	const compare = compareGeometry();
	const envelopes = powerEnvelopes(frame, unit, circM, compare ? compare.circM : null);
	const points = buildShiftPoints(frame, state.gears, state.primaryFd, circM, state.primaryRedline, unit);
	return {
		frame,
		style,
		unit,
		layers,
		primaryNodes,
		compareNodes: compare
			? buildCompareLayer(
					{
						frame,
						gears: state.compGears,
						finalDrive: state.compFd,
						circM: compare.circM,
						redline: state.compRedline,
						unit,
						wallSpeed: null,
					},
					style.compare,
				)
			: null,
		gripNodes: layers.gripLimit ? gripLayerNodes(frame, unit, style, circM) : [],
		points,
		primaryWall: walls.primary,
		compareWall: compare ? walls.compare : null,
		envelope: envelopes.primary,
		compareEnvelope: envelopes.compare,
		crosshair: buildCrosshairContext(frame, points, circM, compare?.crosshair ?? null),
	};
};

/**
 * @brief Build primary gear rays and the optional reverse ray.
 * @param frame Plot geometry.
 * @param circM Rolling circumference.
 * @param wallSpeed Visible aero wall in display units.
 * @return Mountable primary primitives.
 */
const primarySceneNodes = (frame: PlotFrame, circM: number, wallSpeed: number | null): SvgPrim[] => {
	const slot = { frame, gears: state.gears, finalDrive: state.primaryFd, circM,
		redline: state.primaryRedline, unit: state.unit, wallSpeed };
	const nodes = buildPrimaryLayer(slot).nodes;
	if (state.reverseRatio !== null && state.reverseRatio > 0) {
		nodes.push(...buildReverseLayer(slot, state.reverseRatio));
	}
	return nodes;
};

/**
 * @brief Compose the clip path reference shared by every data layer.
 * @return CSS `url()` reference to the plot clip.
 */
const clipRef = (): string => {
	return `url(#${GRAPH_DEFS.plotClip})`;
};

/**
 * @brief Compose the mountable layer list in the documented draw order.
 * @param scene Scene data from `buildSceneData`.
 * @return Ordered primitives for the plot root.
 */
export const composeNodes = (scene: SceneData): SvgPrim[] => {
	const { frame, style, unit, layers } = scene;
	const clip = clipRef();
	const nodes: SvgPrim[] = [
		...buildDefs(style, frame),
		...buildBackground(frame, style),
		group({ class: 'graph-grid', 'clip-path': clip }, buildGrid(frame, style, unit, layers.fineGrid)),
		...buildSpeedTicks(frame, style, unit),
		...buildRpmTicks(frame, style),
		...buildRedlineBand(frame, style, state.primaryRedline),
	];
	if (state.compareEnabled && state.compRedline !== state.primaryRedline) {
		nodes.push(...buildCompareRedline(frame, style, state.compRedline));
	}
	nodes.push(group({ class: 'graph-gears', 'clip-path': clip }, scene.primaryNodes));
	if (layers.shiftDrops) {
		nodes.push(group({ class: 'graph-shift-drops', 'clip-path': clip }, buildShiftDropNodes(scene.points, style, scene.frame)));
	}
	if (scene.primaryWall !== null) {
		nodes.push(group({ class: 'graph-aero', 'clip-path': clip }, buildWallNodes(frame, unit, style, scene.primaryWall, style.aero, true)));
	}
	if (scene.envelope) {
		const ceiling = Math.max(scene.envelope.maxKw, scene.compareEnvelope?.maxKw ?? 0);
		const powerNodes = buildPowerNodes(frame, unit, style, scene.envelope, state.powerUnit, ceiling);
		if (scene.compareEnvelope) {
			powerNodes.push(...buildComparePowerNodes(frame, unit, style, scene.compareEnvelope, ceiling));
		}
		nodes.push(group({ class: 'graph-power', 'clip-path': clip }, powerNodes));
		// The kW axis sits in the right inset: mounting it inside the clipped
		// group would cut every tick and label away.
		nodes.push(group({ class: 'graph-power-axis' }, buildPowerAxis(frame, style, ceiling, state.powerUnit)));
	}
	if (scene.compareNodes) {
		nodes.push(group({ class: 'graph-compare', 'clip-path': clip }, scene.compareNodes));
	}
	if (scene.compareWall !== null) {
		nodes.push(
			group({ class: 'graph-aero-compare', 'clip-path': clip }, buildWallNodes(frame, unit, style, scene.compareWall, style.compare, false)),
		);
	}
	if (layers.gripLimit) {
		nodes.push(group({ class: 'graph-grip', 'clip-path': clip }, scene.gripNodes));
	}
	nodes.push(...buildAxisTitles(frame, style, unit, layers.powerCurve ? state.powerUnit : null));
	return nodes;
};
