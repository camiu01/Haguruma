/**
 * @file svg-curves.ts
 * @brief Gear rays (primary, comparison, reverse) with aero-wall fading.
 *
 * Every ray runs from the plot origin (0 speed, 0 RPM) to its redline peak;
 * once an aero wall is active the section past the wall is drawn dashed and
 * faded so unreachable gearing reads differently from usable gearing.
 */
import { GRAPH_STROKE, graphFontSize } from '../../config/graph-constants';
import { getGearColor } from '../../config/gear-colors';
import { t } from '../../core/i18n/language';
import type { PlotFrame, SpeedUnit } from '../../core/models';
import { clampNum, rpmForSpeed, speedForRpm, toX, toY } from './svg-frame';
import { prim, textPrim, type SvgPrim } from './svg-nodes';

/** Fraction along a ray where the gear tag is anchored. */
const TAG_T = 0.62;

/** Opacity of the unreachable tail of a ray cut by the aero wall. */
const FADE_OPACITY = 0.32;

/** Dash pattern of the faded tail. */
const FADE_DASH = '10 8';

/** Label font stack shared with the rest of the interface. */
const FONT = 'Share Tech Mono, monospace';

/** Geometry of one gear line on the plot. */
export interface GearRay {
	/** One-based gear number. */
	gear: number;
	/** Gear ratio used for this ray. */
	ratio: number;
	/** Stroke color, shared with the table row. */
	color: string;
	/** Redline top speed in display units. */
	topSpeed: number;
	/** X of the redline peak in user units. */
	endX: number;
	/** Y of the redline peak in user units. */
	endY: number;
	/** Wall crossing speed in display units, null when the ray stays reachable. */
	wallSpeed: number | null;
}

/** Shared inputs of every gear-ray builder. */
export interface RayInput {
	/** Plot geometry and limits. */
	frame: PlotFrame;
	/** Gear ratios from first to top gear. */
	gears: number[];
	/** Differential ratio. */
	finalDrive: number;
	/** Effective rolling circumference in metres. */
	circM: number;
	/** Rev limiter in RPM. */
	redline: number;
	/** Active display unit. */
	unit: SpeedUnit;
	/** Aero-wall speed in display units, null when no wall is drawn. */
	wallSpeed: number | null;
}

/**
 * @brief Compute the geometry of every primary gear ray.
 * @param input Frame, gearing, redline, unit and optional wall speed.
 * @return One ray per gear, tagged with its display color.
 */
export const buildGearRays = (input: RayInput): GearRay[] => {
	return input.gears.map((ratio, idx) => {
		const topSpeed = speedForRpm(input.redline, ratio, input.finalDrive, input.circM, input.unit);
		const wallSpeed =
			input.wallSpeed !== null && input.wallSpeed > 0 && input.wallSpeed < topSpeed ? input.wallSpeed : null;
		return {
			gear: idx + 1,
			ratio,
			color: getGearColor(idx),
			topSpeed,
			endX: toX(input.frame, topSpeed),
			endY: toY(input.frame, input.redline),
			wallSpeed,
		};
	});
};

/**
 * @brief Build the stroke primitives of one ray, split at the aero wall.
 * @param input Frame, gearing, redline and unit.
 * @param ray Ray geometry.
 * @return One solid segment, or a solid segment plus a faded tail.
 */
const raySegments = (input: RayInput, ray: GearRay): SvgPrim[] => {
	const x0 = toX(input.frame, 0);
	const y0 = toY(input.frame, 0);
	const solid = prim('line', {
		x1: x0,
		y1: y0,
		x2: ray.endX,
		y2: ray.endY,
		stroke: ray.color,
		'stroke-width': GRAPH_STROKE.ray,
		'stroke-linecap': 'round',
	});
	if (ray.wallSpeed === null) {
		return [solid];
	}
	const wallRpm = clampNum(rpmForSpeed(ray.wallSpeed, ray.ratio, input.finalDrive, input.circM, input.unit), 0, input.redline);
	const cutX = toX(input.frame, ray.wallSpeed);
	const cutY = toY(input.frame, wallRpm);
	return [
		prim('line', {
			x1: x0,
			y1: y0,
			x2: cutX,
			y2: cutY,
			stroke: ray.color,
			'stroke-width': GRAPH_STROKE.ray,
			'stroke-linecap': 'round',
		}),
		prim('line', {
			x1: cutX,
			y1: cutY,
			x2: ray.endX,
			y2: ray.endY,
			stroke: ray.color,
			'stroke-width': GRAPH_STROKE.rayFaded,
			'stroke-dasharray': FADE_DASH,
			'stroke-opacity': FADE_OPACITY,
		}),
	];
};

/**
 * @brief Build the gear tag of one ray.
 * @param frame Plot geometry and limits.
 * @param ray Ray geometry.
 * @param redline Rev limiter in RPM, anchors the tag height.
 * @param label Localized tag text.
 * @return Text primitive anchored two thirds along the ray.
 */
export const buildGearTag = (frame: PlotFrame, ray: GearRay, redline: number, label: string): SvgPrim => {
	return textPrim(
		{
			x: toX(frame, ray.topSpeed * TAG_T) + 10,
			y: toY(frame, redline * TAG_T) - 8,
			fill: ray.color,
			'font-size': graphFontSize(frame.width, 'tag'),
			'font-family': FONT,
			'text-anchor': 'start',
			'font-weight': 'bold',
		},
		label,
	);
};

/**
 * @brief Build the primary gear layer: solid rays, faded tails and gear tags.
 * @param input Frame, gearing, redline, unit and optional wall speed.
 * @return Ray geometry plus the mountable primitives.
 */
export const buildPrimaryLayer = (input: RayInput): { rays: GearRay[]; nodes: SvgPrim[] } => {
	const rays = buildGearRays(input);
	const nodes: SvgPrim[] = [];
	for (const ray of rays) {
		nodes.push(...raySegments(input, ray));
	}
	for (const ray of rays) {
		nodes.push(buildGearTag(input.frame, ray, input.redline, `${t('gear.prefix')} ${ray.gear}`));
	}
	return { rays, nodes };
};

/**
 * @brief Build the dashed secondary comparison rays and their tags.
 * @param input Frame, comparison gearing, redline, unit and wall speed.
 * @param color Overlay color, `null` to use the theme compare color.
 * @return Mountable primitives, empty when the comparison is unusable.
 */
export const buildCompareLayer = (input: RayInput, color: string): SvgPrim[] => {
	const nodes: SvgPrim[] = [];
	const x0 = toX(input.frame, 0);
	const y0 = toY(input.frame, 0);
	for (let idx = 0; idx < input.gears.length; idx += 1) {
		const ratio = input.gears[idx];
		const topSpeed = speedForRpm(input.redline, ratio, input.finalDrive, input.circM, input.unit);
		const endX = toX(input.frame, topSpeed);
		const endY = toY(input.frame, input.redline);
		nodes.push(
			prim('line', {
				x1: x0,
				y1: y0,
				x2: endX,
				y2: endY,
				stroke: color,
				'stroke-width': GRAPH_STROKE.rayFaded,
				'stroke-dasharray': '7 6',
				'stroke-opacity': 0.85,
			}),
		);
		nodes.push(
			textPrim(
				{
					x: toX(input.frame, topSpeed * 0.55) + 10,
					y: toY(input.frame, input.redline * 0.55) + 14,
					fill: color,
					'font-size': graphFontSize(input.frame.width, 'callout'),
					'font-family': FONT,
					'text-anchor': 'start',
					'fill-opacity': 0.9,
				},
				`${t('gear.prefix')} ${idx + 1}'`,
			),
		);
	}
	return nodes;
};

/**
 * @brief Build the reverse-gear ray.
 * @param input Frame, gearing, redline and unit.
 * @param reverseRatio Reverse gear ratio.
 * @return Mountable primitives for the dashed reverse ray and its tag.
 */
export const buildReverseLayer = (input: Omit<RayInput, 'gears' | 'wallSpeed'>, reverseRatio: number): SvgPrim[] => {
	const color = '#9ca3af';
	const topSpeed = speedForRpm(input.redline, reverseRatio, input.finalDrive, input.circM, input.unit);
	return [
		prim('line', {
			x1: toX(input.frame, 0),
			y1: toY(input.frame, 0),
			x2: toX(input.frame, topSpeed),
			y2: toY(input.frame, input.redline),
			stroke: color,
			'stroke-width': GRAPH_STROKE.limit,
			'stroke-dasharray': '8 6',
		}),
		textPrim(
			{
				x: toX(input.frame, topSpeed * 0.7) + 10,
				y: toY(input.frame, input.redline * 0.7) + 6,
				fill: color,
				'font-size': graphFontSize(input.frame.width, 'callout'),
				'font-family': FONT,
				'text-anchor': 'start',
			},
			t('gear.reverse'),
		),
	];
};
