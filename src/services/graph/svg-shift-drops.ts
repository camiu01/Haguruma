/**
 * @file svg-shift-drops.ts
 * @brief Redline shift-drop connectors, landing markers and snap targets.
 *
 * The numbers come from `describeUpshift`, the same helper the shift table
 * uses, so the plot and the table can never disagree.
 */
import { GRAPH_STROKE, graphFontSize } from '../../config/graph-constants';
import { getGearColor } from '../../config/gear-colors';
import { describeUpshift } from '../../core/math/shift-math';
import type { PlotFrame, SpeedUnit } from '../../core/models';
import type { GraphPalette } from './graph-theme';
import { clampNum, toX, toY } from './svg-frame';
import { prim, textPrim, type SvgPrim } from './svg-nodes';

/** Label font stack shared with the rest of the interface. */
const FONT = 'Share Tech Mono, monospace';

/** One upshift point on the plot, also used as a crosshair snap target. */
export interface ShiftPoint {
	/** Zero-based index of the gear being left. */
	fromIndex: number;
	/** One-based gear being left. */
	fromGear: number;
	/** One-based gear being entered. */
	toGear: number;
	/** Shift speed at the limiter in display units. */
	speed: number;
	/** X of the connector in user units. */
	x: number;
	/** Y of the redline peak in user units. */
	redlineY: number;
	/** RPM reached in the next gear at that speed. */
	landingRpm: number;
	/** Y of the landing point in user units. */
	landingY: number;
	/** RPM lost in the shift. */
	rpmDrop: number;
	/** Color of the gear being left. */
	color: string;
}

/**
 * @brief Build every upshift point of the primary gearset.
 * @param frame Plot geometry and limits.
 * @param gears Gear ratios from first to top gear.
 * @param finalDrive Differential ratio.
 * @param circM Effective rolling circumference in metres.
 * @param redline Rev limiter in RPM.
 * @param unit Active display unit.
 * @return One point per valid upshift, skipping unusable pairs.
 */
export const buildShiftPoints = (
	frame: PlotFrame,
	gears: number[],
	finalDrive: number,
	circM: number,
	redline: number,
	unit: SpeedUnit,
): ShiftPoint[] => {
	const points: ShiftPoint[] = [];
	for (let idx = 0; idx < gears.length - 1; idx += 1) {
		const step = describeUpshift(gears, idx, redline, finalDrive, circM, unit);
		if (!step) {
			continue;
		}
		points.push({
			fromIndex: idx,
			fromGear: idx + 1,
			toGear: idx + 2,
			speed: step.topSpeed,
			x: toX(frame, step.topSpeed),
			redlineY: toY(frame, redline),
			landingRpm: step.landingRpm,
			landingY: toY(frame, clampNum(step.landingRpm, 0, frame.maxRpm)),
			rpmDrop: step.rpmDrop,
			color: getGearColor(idx),
		});
	}
	return points;
};

/**
 * @brief Build the connector, markers and drop label of one shift point.
 * @param point Shift point geometry.
 * @param style Active theme palette.
 * @return Primitive list for that connector.
 */
const buildOneDrop = (point: ShiftPoint, style: GraphPalette, frame: PlotFrame): SvgPrim[] => {
	const label = `${point.fromGear}\u2192${point.toGear} -${Math.round(point.rpmDrop)}`;
	return [
		prim('line', {
			x1: point.x,
			y1: point.redlineY,
			x2: point.x,
			y2: point.landingY,
			stroke: style.shiftDrop,
			'stroke-width': GRAPH_STROKE.connector,
			'stroke-dasharray': '3 4',
		}),
		prim('circle', { cx: point.x, cy: point.redlineY, r: GRAPH_STROKE.marker, fill: point.color }),
		prim('circle', {
			cx: point.x,
			cy: point.landingY,
			r: GRAPH_STROKE.marker - 0.6,
			fill: style.background,
			stroke: style.gripCompare,
			'stroke-width': GRAPH_STROKE.connector,
		}),
		textPrim(
			{
				x: point.x + 6,
				y: point.landingY + graphFontSize(frame.width, 'callout'),
				fill: style.shiftDrop,
				'font-size': graphFontSize(frame.width, 'callout'),
				'font-family': FONT,
				'text-anchor': 'start',
			},
			label,
		),
	];
};

/**
 * @brief Build the full shift-drop layer.
 * @param points Shift points from `buildShiftPoints`.
 * @param style Active theme palette.
 * @param frame Plot geometry used for responsive label sizing.
 * @return Mountable primitives, empty when the gearset has no upshift.
 */
export const buildShiftDropNodes = (points: ShiftPoint[], style: GraphPalette, frame: PlotFrame): SvgPrim[] => {
	const nodes: SvgPrim[] = [];
	for (const point of points) {
		nodes.push(...buildOneDrop(point, style, frame));
	}
	return nodes;
};

/**
 * @brief Find the shift point closest to a road speed on the X axis.
 * @param points Shift points from `buildShiftPoints`.
 * @param speed Probe speed in display units.
 * @return Nearest point, or null when no shift point exists.
 */
export const nearestShiftPoint = (points: ShiftPoint[], speed: number): ShiftPoint | null => {
	let best: ShiftPoint | null = null;
	let bestDistance = Number.POSITIVE_INFINITY;
	for (const point of points) {
		const distance = Math.abs(point.speed - speed);
		if (distance < bestDistance) {
			best = point;
			bestDistance = distance;
		}
	}
	return best;
};

/** Snapping window as a fraction of the plot speed range. */
export const SNAP_WINDOW = 0.025;

/**
 * @brief Resolve the crosshair snap target of a cursor speed.
 * Snapping only engages inside `SNAP_WINDOW` of the plot speed range, so the
 * cursor stays free in the middle of a gear and the HUD can show its "drag
 * over a shift point" hint.
 * @param points Shift points of the current render.
 * @param speed Cursor speed in display units.
 * @param maxSpeed Plot speed ceiling in display units.
 * @return Shift point inside the window, null when none is close enough.
 */
export const snapPointFor = (points: ShiftPoint[], speed: number, maxSpeed: number): ShiftPoint | null => {
	const point = nearestShiftPoint(points, speed);
	if (!point) {
		return null;
	}
	return Math.abs(point.speed - speed) <= maxSpeed * SNAP_WINDOW ? point : null;
};
