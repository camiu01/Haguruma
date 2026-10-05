/**
 * @file svg-power.ts
 * @brief Available-versus-required wheel-power envelope for the plot.
 *
 * The available curve samples the maximum wheel power any gear can deliver at
 * a road speed (`tractiveForceAt`), the required curve samples the road-load
 * demand (`roadLoadPowerKw`). Their crossing is solved here and is the same
 * speed `dragLimitedSpeedKmh` returns for the aero-wall line, so the power
 * label and the wall label can never disagree.
 *
 * The right-hand axis ceiling follows the available peak, so the envelope uses
 * the full plot height; the road-load curve is free to leave the plot through
 * the top, where the plot clip cuts it.
 */
import { GRAPH_DEFS } from './svg-defs';
import { GRAPH_STROKE, graphFontSize } from '../../config/graph-constants';
import { roadLoadPowerKw } from '../../core/math/aero-math';
import { dynamicRadiusM, tractiveForceAt, type EngineCurve } from '../../core/math/traction-math';
import { rpmFromKmh, toDisplaySpeed } from '../../core/math/speed-math';
import { formatPower, getUnitLabel } from '../../core/units/unit-utils';
import { t } from '../../core/i18n/language';
import type { DrivetrainLayout, PlotFrame, PowerUnit, SpeedUnit } from '../../core/models';
import type { GraphPalette } from './graph-theme';
import { clampNum, maxSpeedKmh, toPowerY, toX } from './svg-frame';
import { polygon, polyline, prim, textPrim, type SvgPrim } from './svg-nodes';
import { crossingSpeedKmh } from './power-crossing';
export { crossingSpeedKmh } from './power-crossing';

/** Label font stack shared with the rest of the interface. */
const FONT = 'Share Tech Mono, monospace';

/** Headroom factor applied to the wheel-power peak before rounding the ceiling. */
const CEILING_HEADROOM = 1.05;

/** One sample of a power-versus-speed curve. */
export interface PowerSample {
	/** Vehicle speed in km/h. */
	vKmh: number;
	/** Power in kilowatts. */
	kw: number;
}

/** Inputs of the available-versus-required wheel-power envelope. */
export interface PowerEnvelopeInput {
	/** Optional layout enabling torque/load-sensitive losses. */
	mappedLayout?: DrivetrainLayout;
	/** Plot geometry and limits. */
	frame: PlotFrame;
	/** Active display unit. */
	unit: SpeedUnit;
	/** Primary gearset. */
	gears: number[];
	/** Differential ratio. */
	finalDrive: number;
	/** Effective rolling circumference in metres. */
	circM: number;
	/** Validated engine curve, null when the anchors are unusable. */
	curve: EngineCurve | null;
	/** Drivetrain efficiency between 0 and 1. */
	eff: number;
	/** Declared wheel-power budget in kilowatts; caps the envelope. */
	capKw: number;
	/** Vehicle mass in kilograms. */
	massKg: number;
	/** Drag coefficient. */
	dragCd: number;
	/** Frontal area in square metres. */
	frontalAreaM2: number;
	/** Rolling-resistance coefficient. */
	crr: number;
	/** Road grade in percent. */
	gradePercent: number;
}

/** Sampled power envelope with its axis ceiling and crossing speed. */
export interface PowerEnvelope {
	/** Maximum wheel power across all gears at each speed. */
	available: PowerSample[];
	/** Road-load power requirement at each speed. */
	required: PowerSample[];
	/** Right-hand axis ceiling in kilowatts, sized from the available peak. */
	maxKw: number;
	/** Speed where requirement overtakes availability in km/h, null when they never cross. */
	crossingKmh: number | null;
}

/**
 * @brief Round a power ceiling up to a readable grid value.
 * @param kw Raw ceiling in kilowatts.
 * @return Ceiling on a 25 kW grid, at least 25 kW.
 */
const niceCeiling = (kw: number): number => {
	if (!Number.isFinite(kw) || kw <= 25) {
		return 25;
	}
	return Math.ceil(kw / 25) * 25;
};

/**
 * @brief Sample the maximum wheel power any gear delivers at a speed.
 * @brief Single source of truth for the drawn envelope and the crosshair
 * @brief readout, so the tooltip can never disagree with the curve.
 * @param vKmh Road speed in km/h.
 * @param gears Gear ratios of the slot.
 * @param finalDrive Differential ratio of the slot.
 * @param circM Rolling circumference in metres.
 * @param curve Active engine curve, null when the anchors are unusable.
 * @param eff Drivetrain efficiency between 0 and 1.
 * @param capKw Declared wheel-power budget in kilowatts; caps the result.
 * @param mappedLayout Optional layout enabling torque/load-sensitive losses.
 * @return Wheel power in kilowatts at that speed, 0 when nothing is usable.
 */
export const wheelPowerAtSpeed = (
	vKmh: number,
	gears: number[],
	finalDrive: number,
	circM: number,
	curve: EngineCurve | null,
	eff: number,
	capKw: number = Number.POSITIVE_INFINITY,
	mappedLayout?: DrivetrainLayout,
): number => {
	const radius = dynamicRadiusM(circM);
	if (!curve || radius <= 0 || vKmh <= 0 || gears.length === 0) {
		return 0;
	}
	let best = 0;
	for (const gear of gears) {
		const rpm = rpmFromKmh(vKmh, gear, finalDrive, circM);
		const force = tractiveForceAt(rpm, gear, finalDrive, radius, curve, eff, mappedLayout);
		const kw = (force * (vKmh / 3.6)) / 1000;
		if (kw > best) {
			best = kw;
		}
	}
	return Number.isFinite(capKw) && capKw > 0 ? Math.min(best, capKw) : best;
};

/**
 * @brief Build the available-versus-required wheel-power envelope.
 * @brief The available curve is capped at the declared wheel-power budget so
 * @brief the crossing lands on the aero-wall line instead of drifting from it
 * @brief when the torque curve peaks above `enginePowerKw`. The axis ceiling
 * @brief follows the available peak, so the envelope uses the full plot
 * @brief height; the road-load curve is free to run off the top of the plot,
 * @brief where the plot clip cuts it, because only the crossing matters.
 * @param input Envelope inputs (frame, gearing, engine, road load).
 * @return Sampled envelope with its ceiling and crossing speed.
 */
export const buildPowerEnvelope = (input: PowerEnvelopeInput): PowerEnvelope => {
	const radius = dynamicRadiusM(input.circM);
	const top = maxSpeedKmh(input.frame, input.unit);
	const cap = Number.isFinite(input.capKw) && input.capKw > 0 ? input.capKw : Number.POSITIVE_INFINITY;
	const curve = input.curve;
	const usable = curve !== null && radius > 0 && input.gears.length > 0;
	const availableKwAt = (vKmh: number): number => {
		return wheelPowerAtSpeed(vKmh, input.gears, input.finalDrive, input.circM, curve, input.eff, cap, input.mappedLayout);
	};
	const requiredKwAt = (vKmh: number): number => {
		return roadLoadPowerKw(vKmh, input.massKg, input.dragCd, input.frontalAreaM2, input.crr, input.gradePercent);
	};
	const available: PowerSample[] = [];
	const required: PowerSample[] = [];
	let peakKw = 0;
	for (let v = 0; v <= top + 1e-6; v += 2) {
		const avail = availableKwAt(v);
		const req = requiredKwAt(v);
		available.push({ vKmh: v, kw: avail });
		required.push({ vKmh: v, kw: req });
		peakKw = Math.max(peakKw, avail);
	}
	return {
		available,
		required,
		maxKw: niceCeiling(peakKw * CEILING_HEADROOM),
		crossingKmh: usable ? crossingSpeedKmh(availableKwAt, requiredKwAt, top) : null,
	};
};

/**
 * @brief Read the sample nearest to a speed.
 * @param samples Sampled curve, never empty.
 * @param vKmh Probe speed in km/h.
 * @return Power in kilowatts at the nearest sample.
 */
const kwNear = (samples: PowerSample[], vKmh: number): number => {
	let best = samples[0];
	for (const sample of samples) {
		if (Math.abs(sample.vKmh - vKmh) < Math.abs(best.vKmh - vKmh)) {
			best = sample;
		}
	}
	return best.kw;
};

/**
 * @brief Build the peak wheel-power tag of the available curve.
 * @brief The tag keeps its text inside the drawable band by flipping its
 * @brief anchor near the plot edges.
 * @param frame Plot geometry and limits.
 * @param unit Active display unit.
 * @param style Active theme palette.
 * @param env Envelope from `buildPowerEnvelope`.
 * @param powerUnit Active power display unit.
 * @param ceilingKw Right-hand axis ceiling in kilowatts.
 * @return Single tag primitive.
 */
const buildPeakTag = (
	frame: PlotFrame,
	unit: SpeedUnit,
	style: GraphPalette,
	env: PowerEnvelope,
	powerUnit: PowerUnit,
	ceilingKw: number,
): SvgPrim[] => {
	const peak = env.available.reduce((best, sample) => (sample.kw > best.kw ? sample : best), env.available[0]);
	const x = toX(frame, toDisplaySpeed(peak.vKmh, unit));
	const edge = graphFontSize(frame.width, 'callout') * 4;
	const anchor = x > frame.paddingLeft + frame.plotWidth - edge ? 'end' : x < frame.paddingLeft + edge ? 'start' : 'middle';
	return [
		textPrim(
			{
				x: clampNum(x, frame.paddingLeft + 4, frame.paddingLeft + frame.plotWidth - 4),
				y: Math.max(frame.paddingTop + graphFontSize(frame.width, 'callout'), toPowerY(frame, peak.kw, ceilingKw) - 10),
				fill: style.power,
				'font-size': graphFontSize(frame.width, 'callout'),
				'font-family': FONT,
				'text-anchor': anchor,
			},
			`${t('graph.powerTag')} ${formatPower(peak.kw, powerUnit)}`,
		),
	];
};

/**
 * @brief Build the crossing marker and its drag-limited speed label.
 * @brief The marker keeps the aero color so it reads as the point where the
 * @brief wall cuts the envelope; the label repeats the speed right there,
 * @brief where the aero callout at the top of the plot cannot be read.
 * @param frame Plot geometry and limits.
 * @param unit Active display unit.
 * @param style Active theme palette.
 * @param env Envelope from `buildPowerEnvelope`.
 * @param ceilingKw Right-hand axis ceiling in kilowatts.
 * @return Marker and label primitives, empty when the curves never cross.
 */
const buildCrossingNodes = (
	frame: PlotFrame,
	unit: SpeedUnit,
	style: GraphPalette,
	env: PowerEnvelope,
	ceilingKw: number,
): SvgPrim[] => {
	if (env.crossingKmh === null) {
		return [];
	}
	const cx = toX(frame, toDisplaySpeed(env.crossingKmh, unit));
	const cy = toPowerY(frame, kwNear(env.required, env.crossingKmh), ceilingKw);
	const anchorEnd = cx > frame.paddingLeft + frame.plotWidth * 0.3;
	return [
		prim('circle', { cx, cy, r: GRAPH_STROKE.marker - 0.6, fill: style.aero }),
		textPrim(
			{
				x: anchorEnd ? cx - 8 : cx + 8,
				y: cy + graphFontSize(frame.width, 'callout') + 4,
				fill: style.aero,
				'font-size': graphFontSize(frame.width, 'callout'),
				'font-family': FONT,
				'text-anchor': anchorEnd ? 'end' : 'start',
			},
			`${Math.round(toDisplaySpeed(env.crossingKmh, unit))} ${getUnitLabel(unit)}`,
		),
	];
};

/**
 * @brief Build the power-envelope layer: filled area, both curves and markers.
 * @param frame Plot geometry and limits.
 * @param unit Active display unit.
 * @param style Active theme palette.
 * @param env Envelope from `buildPowerEnvelope`.
 * @param powerUnit Active power display unit.
 * @param ceilingKw Shared right-hand axis ceiling, defaults to the envelope one.
 * @return Mountable primitives, empty when the envelope has no samples.
 */
export const buildPowerNodes = (
	frame: PlotFrame,
	unit: SpeedUnit,
	style: GraphPalette,
	env: PowerEnvelope,
	powerUnit: PowerUnit,
	ceilingKw: number = env.maxKw,
): SvgPrim[] => {
	if (env.available.length < 2 || env.required.length < 2) {
		return [];
	}
	const toPoints = (samples: PowerSample[]): { x: number; y: number }[] => {
		return samples.map((sample) => ({ x: toX(frame, toDisplaySpeed(sample.vKmh, unit)), y: toPowerY(frame, sample.kw, ceilingKw) }));
	};
	const availPoints = toPoints(env.available);
	const reqPoints = toPoints(env.required);
	const bottom = frame.paddingTop + frame.plotHeight;
	return [
		polygon([...availPoints, { x: availPoints[availPoints.length - 1].x, y: bottom }, { x: availPoints[0].x, y: bottom }], {
			fill: `url(#${GRAPH_DEFS.powerFill})`,
		}),
		polyline(availPoints, { stroke: style.power, 'stroke-width': GRAPH_STROKE.limit }),
		polyline(reqPoints, { stroke: style.powerLoad, 'stroke-width': GRAPH_STROKE.limit, 'stroke-dasharray': '8 6' }),
		...buildPeakTag(frame, unit, style, env, powerUnit, ceilingKw),
		...buildCrossingNodes(frame, unit, style, env, ceilingKw),
	];
};

/**
 * @brief Build the dashed comparison power envelope of the secondary slot.
 * @brief Projected on the shared right-hand scale and drawn without an area
 * @brief fill, so the primary envelope stays the readable one.
 * @param frame Plot geometry and limits.
 * @param unit Active display unit.
 * @param style Active theme palette.
 * @param env Secondary envelope from `buildPowerEnvelope`.
 * @param ceilingKw Shared right-hand axis ceiling in kilowatts.
 * @return Mountable primitives, empty when the envelope has no samples.
 */
export const buildComparePowerNodes = (
	frame: PlotFrame,
	unit: SpeedUnit,
	style: GraphPalette,
	env: PowerEnvelope,
	ceilingKw: number,
): SvgPrim[] => {
	if (env.available.length < 2) {
		return [];
	}
	const points = env.available.map((sample) => ({
		x: toX(frame, toDisplaySpeed(sample.vKmh, unit)),
		y: toPowerY(frame, sample.kw, ceilingKw),
	}));
	const nodes: SvgPrim[] = [polyline(points, { stroke: style.compare, 'stroke-width': GRAPH_STROKE.limit, 'stroke-dasharray': '8 6' })];
	if (env.crossingKmh !== null) {
		nodes.push(
			prim('circle', {
				cx: toX(frame, toDisplaySpeed(env.crossingKmh, unit)),
				cy: toPowerY(frame, kwNear(env.available, env.crossingKmh), ceilingKw),
				r: GRAPH_STROKE.marker - 1.2,
				fill: 'none',
				stroke: style.compare,
				'stroke-width': 1.6,
			}),
		);
	}
	return nodes;
};
