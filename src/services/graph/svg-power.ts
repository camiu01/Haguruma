/**
 * @file svg-power.ts
 * @brief Available-versus-required wheel-power envelope for the plot.
 *
 * The available curve samples the maximum wheel power any gear can deliver at
 * a road speed (`tractiveForceAt`), the required curve samples the road-load
 * demand (`roadLoadPowerKw`). Their crossing is solved here and is the same
 * speed `dragLimitedSpeedKmh` returns for the aero-wall line, so the power
 * label and the wall label can never disagree.
 */
import { GRAPH_DEFS } from './svg-defs';
import { GRAPH_STROKE, graphFontSize } from '../../config/graph-constants';
import { roadLoadPowerKw } from '../../core/math/aero-math';
import { dynamicRadiusM, tractiveForceAt, type EngineCurve } from '../../core/math/traction-math';
import { rpmFromKmh, toDisplaySpeed } from '../../core/math/speed-math';
import { formatPower } from '../../core/units/unit-utils';
import { t } from '../../core/i18n/language';
import type { PlotFrame, PowerUnit, SpeedUnit } from '../../core/models';
import type { GraphPalette } from './graph-theme';
import { maxSpeedKmh, toPowerY, toX } from './svg-frame';
import { polygon, polyline, prim, textPrim, type SvgPrim } from './svg-nodes';

/** Label font stack shared with the rest of the interface. */
const FONT = 'JetBrains Mono, monospace';

/** One sample of a power-versus-speed curve. */
export interface PowerSample {
	/** Vehicle speed in km/h. */
	vKmh: number;
	/** Power in kilowatts. */
	kw: number;
}

/** Inputs of the available-versus-required wheel-power envelope. */
export interface PowerEnvelopeInput {
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
	/** Right-hand axis ceiling in kilowatts. */
	maxKw: number;
	/** Speed where requirement overtakes availability in km/h, null when they never cross. */
	crossingKmh: number | null;
}

/**
 * @brief Bisect the first downward crossing of two power curves.
 * @param loKmh Lower bracket in km/h (available at or above required).
 * @param hiKmh Upper bracket in km/h (required above available).
 * @param gapAt Signed gap (available minus required) at a speed.
 * @return Crossing speed in km/h, midpoint after 22 halvings.
 */
const bisectCrossing = (loKmh: number, hiKmh: number, gapAt: (vKmh: number) => number): number => {
	let lo = loKmh;
	let hi = hiKmh;
	for (let i = 0; i < 22; i += 1) {
		const mid = (lo + hi) / 2;
		if (gapAt(mid) >= 0) {
			lo = mid;
		} else {
			hi = mid;
		}
	}
	return (lo + hi) / 2;
};

/**
 * @brief Solve the speed where required power overtakes available power.
 * @param availableKwAt Available wheel power in kW at a speed in km/h.
 * @param requiredKwAt Required road-load power in kW at a speed in km/h.
 * @param hiKmh Upper scan bound in km/h.
 * @param stepKmh Scan step in km/h.
 * @return Crossing speed in km/h, or null when the curves never cross.
 */
export const crossingSpeedKmh = (
	availableKwAt: (vKmh: number) => number,
	requiredKwAt: (vKmh: number) => number,
	hiKmh: number,
	stepKmh: number = 2,
): number | null => {
	if (!Number.isFinite(hiKmh) || hiKmh <= 0 || !(stepKmh > 0)) {
		return null;
	}
	const gapAt = (v: number): number => availableKwAt(v) - requiredKwAt(v);
	if (gapAt(0) < 0) {
		return null;
	}
	let lo = 0;
	for (let v = stepKmh; v <= hiKmh + 1e-6; v += stepKmh) {
		if (gapAt(v) < 0) {
			return bisectCrossing(lo, v, gapAt);
		}
		lo = v;
	}
	return null;
};

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
 * @brief Build the available-versus-required wheel-power envelope.
 * @brief The available curve is capped at the declared wheel-power budget so
 * @brief the crossing lands on the aero-wall line instead of drifting from it
 * @brief when the torque curve peaks above `enginePowerKw`.
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
		if (curve === null || radius <= 0 || vKmh <= 0) {
			return 0;
		}
		let best = 0;
		for (const gear of input.gears) {
			const rpm = rpmFromKmh(vKmh, gear, input.finalDrive, input.circM);
			const force = tractiveForceAt(rpm, gear, input.finalDrive, radius, curve, input.eff);
			const kw = (force * (vKmh / 3.6)) / 1000;
			if (kw > best) {
				best = kw;
			}
		}
		return Math.min(best, cap);
	};
	const requiredKwAt = (vKmh: number): number => {
		return roadLoadPowerKw(vKmh, input.massKg, input.dragCd, input.frontalAreaM2, input.crr, input.gradePercent);
	};
	const available: PowerSample[] = [];
	const required: PowerSample[] = [];
	let maxKw = 0;
	for (let v = 0; v <= top + 1e-6; v += 2) {
		const avail = availableKwAt(v);
		const req = requiredKwAt(v);
		available.push({ vKmh: v, kw: avail });
		required.push({ vKmh: v, kw: req });
		maxKw = Math.max(maxKw, avail, req);
	}
	return {
		available,
		required,
		maxKw: niceCeiling(maxKw),
		crossingKmh: usable ? crossingSpeedKmh(availableKwAt, requiredKwAt, top) : null,
	};
};

/**
 * @brief Interpolate the road-load power at the envelope crossing.
 * @param env Envelope from `buildPowerEnvelope`.
 * @param crossingKmh Crossing speed in km/h.
 * @return Required power in kilowatts at the nearest sample.
 */
const requiredKwAtCrossing = (env: PowerEnvelope, crossingKmh: number): number => {
	let best = env.required[0];
	for (const sample of env.required) {
		if (Math.abs(sample.vKmh - crossingKmh) < Math.abs(best.vKmh - crossingKmh)) {
			best = sample;
		}
	}
	return best.kw;
};

/**
 * @brief Build the power-envelope layer: filled area, both curves and markers.
 * @param frame Plot geometry and limits.
 * @param unit Active display unit.
 * @param style Active theme palette.
 * @param env Envelope from `buildPowerEnvelope`.
 * @param powerUnit Active power display unit.
 * @return Mountable primitives, empty when the envelope has no samples.
 */
export const buildPowerNodes = (
	frame: PlotFrame,
	unit: SpeedUnit,
	style: GraphPalette,
	env: PowerEnvelope,
	powerUnit: PowerUnit,
): SvgPrim[] => {
	if (env.available.length < 2 || env.required.length < 2) {
		return [];
	}
	const toPoints = (samples: PowerSample[]): { x: number; y: number }[] => {
		return samples.map((sample) => ({ x: toX(frame, toDisplaySpeed(sample.vKmh, unit)), y: toPowerY(frame, sample.kw, env.maxKw) }));
	};
	const availPoints = toPoints(env.available);
	const reqPoints = toPoints(env.required);
	const bottom = frame.paddingTop + frame.plotHeight;
	const nodes: SvgPrim[] = [
		polygon([...availPoints, { x: availPoints[availPoints.length - 1].x, y: bottom }, { x: availPoints[0].x, y: bottom }], {
			fill: `url(#${GRAPH_DEFS.powerFill})`,
		}),
		polyline(availPoints, { stroke: style.power, 'stroke-width': GRAPH_STROKE.limit }),
		polyline(reqPoints, { stroke: style.powerLoad, 'stroke-width': GRAPH_STROKE.limit, 'stroke-dasharray': '8 6' }),
	];
	const peak = env.available.reduce((best, sample) => (sample.kw > best.kw ? sample : best), env.available[0]);
	nodes.push(
		textPrim(
			{
				x: toX(frame, toDisplaySpeed(peak.vKmh, unit)),
				y: Math.max(frame.paddingTop + graphFontSize(frame.width, 'callout'), toPowerY(frame, peak.kw, env.maxKw) - 10),
				fill: style.power,
				'font-size': graphFontSize(frame.width, 'callout'),
				'font-family': FONT,
				'text-anchor': 'middle',
			},
			`${t('graph.powerTag')} ${formatPower(peak.kw, powerUnit)}`,
		),
	);
	if (env.crossingKmh !== null) {
		nodes.push(
			prim('circle', {
				cx: toX(frame, toDisplaySpeed(env.crossingKmh, unit)),
				cy: toPowerY(frame, requiredKwAtCrossing(env, env.crossingKmh), env.maxKw),
				r: GRAPH_STROKE.marker - 0.6,
				fill: style.aero,
			}),
		);
	}
	return nodes;
};
