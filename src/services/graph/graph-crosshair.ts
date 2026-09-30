/**
 * @file graph-crosshair.ts
 * @brief Snapping crosshair: SVG marker pair, corner HUD pill and free tooltip.
 *
 * Pointer and keyboard move one shared cursor. With `snapHud` enabled the
 * marker and `#graph-hud` lock onto the nearest shift point (nearest by X
 * among the gear redline peaks) only while the cursor is inside a small
 * speed window around it; `#graph-tooltip` always carries the free per-gear
 * readout built from the raw cursor position, so it tracks the pointer even
 * while the marker is snapped. All text is written with `textContent`, never
 * markup.
 */
import { t } from '../../core/i18n/language';
import { getUnitLabel } from '../../core/units/unit-utils';
import type { PlotFrame, PowerUnit, RunningGear, SpeedUnit } from '../../core/models';
import type { EngineCurve } from '../../core/math/engine-curve-core';
import type { ElementRefs } from '../dom/element-refs';
import { clampNum, rpmAtY, speedAtX, toX } from './svg-frame';
import { snapPointFor, type ShiftPoint } from './svg-shift-drops';
import { appendPrim, clearChildren, prim } from './svg-nodes';
import { renderFreeTooltip } from './crosshair-tooltip';

/** Secondary overlay geometry used by the free tooltip readout. */
export interface CrosshairCompare {
	/** Secondary gear ratios. */
	gears: number[];
	/** Secondary differential ratio. */
	finalDrive: number;
	/** Secondary rolling circumference in metres. */
	circM: number;
	/** Secondary rev limiter in RPM. */
	redline: number;
}

/** Grip-limit inputs the free tooltip evaluates at the cursor speed. */
export interface CrosshairGrip {
	/** Running gear (compound, layout, LSD locks). */
	gear: RunningGear;
	/** Vehicle mass in kilograms. */
	massKg: number;
	/** Active engine curve, null when the inputs are unusable. */
	curve: EngineCurve | null;
	/** Drivetrain efficiency between 0 and 1. */
	eff: number;
}

/** Wheel-power inputs the free tooltip evaluates at the cursor speed. */
export interface CrosshairPower {
	/** Wheel-power budget in kilowatts (crank power times efficiency). */
	capKw: number;
	/** Active power display unit. */
	unit: PowerUnit;
}

/** Everything the crosshair needs from the current render pass. */
export interface CrosshairContext {
	/** Plot geometry and limits of the current frame. */
	frame: PlotFrame;
	/** Shift points of the primary gearset, the snap targets. */
	points: ShiftPoint[];
	/** Primary gear ratios. */
	gears: number[];
	/** Primary differential ratio. */
	finalDrive: number;
	/** Primary rolling circumference in metres. */
	circM: number;
	/** Primary rev limiter in RPM. */
	redline: number;
	/** Active display unit. */
	unit: SpeedUnit;
	/** True while the HUD snaps to shift points. */
	snap: boolean;
	/** Secondary overlay geometry, null when the comparison is hidden. */
	compare: CrosshairCompare | null;
	/** Grip-limit inputs for the tooltip wheelspin verdict. */
	grip: CrosshairGrip;
	/** Wheel-power inputs for the tooltip drivetrain readout. */
	power: CrosshairPower;
}

/** Live SVG handles of the crosshair marker. */
interface MarkerHandles {
	/** Vertical cursor line. */
	line: SVGElement;
	/** Head dot at the current engine speed. */
	head: SVGElement;
	/** Landing dot shown while snapped to a shift point. */
	landing: SVGElement;
}

/** Cursor position: speed in display units plus the viewport anchor. */
interface PointerState {
	/** Cursor speed derived from the pointer or the keyboard. */
	speed: number;
	/** Cursor Y in viewBox units, drives the free head dot. */
	userY: number;
	/** Viewport X used to anchor the floating tooltip. */
	clientX: number;
	/** Viewport Y used to anchor the floating tooltip. */
	clientY: number;
}

/** Current render context, replaced by every `renderGraph` pass. */
let context: CrosshairContext | null = null;

/** Mounted marker handles, null between renders. */
let handles: MarkerHandles | null = null;

/** Cursor position, null while the crosshair is hidden. */
let pointer: PointerState | null = null;

/** Index of the keyboard-selected shift point. */
let snapIndex = 0;

/** True once the pointer and keyboard bindings are attached. */
let bound = false;

/**
 * @brief Store the context of the current render.
 * @param next Context describing the freshly built plot.
 * @return void
 */
export const setCrosshairContext = (next: CrosshairContext): void => {
	context = next;
	snapIndex = clampNum(snapIndex, 0, Math.max(0, next.points.length - 1));
};

/**
 * @brief Forget the render context and drop the cursor position.
 * @param none No parameters.
 * @return void
 */
export const clearCrosshairContext = (): void => {
	context = null;
	handles = null;
	pointer = null;
};

/**
 * @brief Build the crosshair marker group inside the plot root.
 * @brief Called by every render pass after the layers were mounted.
 * @param refs Cached DOM handles (plot root and floating pills).
 * @return void
 */
export const mountCrosshair = (refs: ElementRefs): void => {
	const groupEl = appendPrim(refs.graphSvg, prim('g', { class: 'graph-crosshair' }));
	handles = {
		line: appendPrim(
			groupEl,
			prim('line', {
				x1: 0,
				y1: 0,
				x2: 0,
				y2: 0,
				stroke: '#94a3b8',
				'stroke-width': 1.6,
				'stroke-dasharray': '5 5',
				'stroke-opacity': 0.75,
			}),
		),
		head: appendPrim(groupEl, prim('circle', { cx: 0, cy: 0, r: 5, fill: '#e2e8f0', stroke: '#0f172a', 'stroke-width': 1.2 })),
		landing: appendPrim(groupEl, prim('circle', { cx: 0, cy: 0, r: 5.5, fill: 'none', stroke: '#ef4444', 'stroke-width': 2.4 })),
	};
	hideMarker();
	clearChildren(refs.graphHud);
	refs.graphHud.setAttribute('data-empty', 'true');
	refs.graphTooltip.classList.add('hidden');
	if (pointer) {
		drawCrosshair(refs);
	}
};

/**
 * @brief Hide the marker graphics without touching the pills.
 * @param none No parameters.
 * @return void
 */
const hideMarker = (): void => {
	if (!handles) {
		return;
	}
	handles.line.setAttribute('opacity', '0');
	handles.head.setAttribute('opacity', '0');
	handles.landing.setAttribute('opacity', '0');
};

/**
 * @brief Draw the vertical cursor and its dots for the current position.
 * @brief The marker and the HUD follow the snapped shift point when snapping
 * @brief is on; the floating tooltip always reads the raw cursor position so
 * @brief it never freezes on the gear-end value.
 * @param refs Cached DOM handles.
 * @return void
 */
const drawCrosshair = (refs: ElementRefs): void => {
	if (!context || !handles || !pointer) {
		return;
	}
	const { frame, snap } = context;
	const point = snap ? snapPointFor(context.points, pointer.speed, frame.maxSpeed) : null;
	const speed = point ? point.speed : pointer.speed;
	const x = toX(frame, speed);
	const top = frame.paddingTop;
	handles.line.setAttribute('x1', String(x));
	handles.line.setAttribute('x2', String(x));
	handles.line.setAttribute('y1', String(top));
	handles.line.setAttribute('y2', String(top + frame.plotHeight));
	handles.line.setAttribute('opacity', '0.75');
	handles.head.setAttribute('cx', String(x));
	const headY = point ? point.redlineY : clampNum(pointer.userY, top, top + frame.plotHeight);
	handles.head.setAttribute('cy', String(headY));
	handles.head.setAttribute('opacity', '1');
	handles.landing.setAttribute('cx', String(x));
	handles.landing.setAttribute('cy', String(point ? point.landingY : 0));
	handles.landing.setAttribute('opacity', point ? '1' : '0');
	if (point) {
		handles.landing.setAttribute('stroke', point.color);
	}
	updateHud(refs, speed, point);
	updateTooltip(refs, pointer.speed, clampNum(pointer.userY, top, top + frame.plotHeight));
};

/**
 * @brief Replace a pill's children with plain text lines.
 * @param el Pill element to refill.
 * @param lines Text plus emphasis class per line.
 * @return void
 */
const writeLines = (el: HTMLElement, lines: { text: string; cls: string }[]): void => {
	clearChildren(el);
	for (const line of lines) {
		const div = document.createElement('div');
		div.className = line.cls;
		div.textContent = line.text;
		el.appendChild(div);
	}
};

/**
 * @brief Refresh the corner HUD pill with the cursor readout.
 * @brief The pill is pinned by CSS; only its text and empty flag are managed.
 * @param refs Cached DOM handles.
 * @param speed Cursor speed in display units (snapped when applicable).
 * @param point Shift point under the cursor, null when not snapping.
 * @return void
 */
const updateHud = (refs: ElementRefs, speed: number, point: ShiftPoint | null): void => {
	if (!context) {
		return;
	}
	const unit = getUnitLabel(context.unit);
	const lines = [
		{ text: t('graph.snapTitle'), cls: 'font-bold fs-tiny tracking-wide text-cyan-400' },
		{ text: `${speed.toFixed(1)} ${unit}`, cls: 'fs-base font-semibold' },
	];
	lines.push(
		point
			? {
					text: `${t('graph.snapShift')} ${point.fromGear} \u2192 ${point.toGear} \u00b7 ${t('graph.snapLands')} ${Math.round(point.landingRpm)} RPM \u00b7 ${t('graph.snapDrop')} -${Math.round(point.rpmDrop)} RPM`,
					cls: 'fs-tiny opacity-90 whitespace-nowrap',
				}
			: { text: t('graph.snapEmpty'), cls: 'fs-tiny opacity-70' },
	);
	writeLines(refs.graphHud, lines);
	refs.graphHud.setAttribute('data-empty', 'false');
};

/**
 * @brief Refresh the free per-gear hover tooltip.
 * @brief `speed` and `y` are always the raw cursor values, never the snapped
 * @brief shift-point ones, so the readout tracks the pointer exactly.
 * @param refs Cached DOM handles.
 * @param speed Cursor speed in display units.
 * @param y Cursor Y in viewBox units, converted to the readout engine speed.
 * @return void
 */
const updateTooltip = (refs: ElementRefs, speed: number, y: number): void => {
	if (!context || !pointer) {
		return;
	}
	const rpm = rpmAtY(context.frame, y);
	renderFreeTooltip(refs, context, speed, { clientX: pointer.clientX, clientY: pointer.clientY }, rpm);
};

/**
 * @brief Move the crosshair to a client pointer position.
 * @param refs Cached DOM handles.
 * @param clientX Pointer X in viewport pixels.
 * @param clientY Pointer Y in viewport pixels.
 * @return void
 */
export const moveCrosshairTo = (refs: ElementRefs, clientX: number, clientY: number): void => {
	if (!context) {
		return;
	}
	const rect = refs.graphSvg.getBoundingClientRect();
	if (rect.width <= 0) {
		return;
	}
	const userX = ((clientX - rect.left) / rect.width) * context.frame.width;
	const userY = ((clientY - rect.top) / rect.height) * context.frame.height;
	const speed = clampNum(speedAtX(context.frame, userX), 0, context.frame.maxSpeed);
	pointer = { speed, userY, clientX, clientY };
	if (!context.snap) {
		snapIndex = nearestIndex(context.points, speed);
	}
	drawCrosshair(refs);
};

/**
 * @brief Index of the shift point nearest to a speed.
 * @param points Shift points of the current render.
 * @param speed Probe speed in display units.
 * @return Index in `points`, 0 when the list is empty.
 */
const nearestIndex = (points: ShiftPoint[], speed: number): number => {
	let best = 0;
	let bestDistance = Number.POSITIVE_INFINITY;
	for (let idx = 0; idx < points.length; idx += 1) {
		const distance = Math.abs(points[idx].speed - speed);
		if (distance < bestDistance) {
			best = idx;
			bestDistance = distance;
		}
	}
	return best;
};

/**
 * @brief Hide the crosshair, the HUD pill and the tooltip.
 * @param refs Cached DOM handles.
 * @return void
 */
export const clearCrosshair = (refs: ElementRefs): void => {
	pointer = null;
	hideMarker();
	clearChildren(refs.graphHud);
	refs.graphHud.setAttribute('data-empty', 'true');
	refs.graphTooltip.classList.add('hidden');
};

/**
 * @brief Step the crosshair to the neighbouring shift point.
 * @brief Keyboard stepping re-anchors the pointer to the marker position, so
 * @brief the floating tooltip stays attached to the visible cursor.
 * @param refs Cached DOM handles.
 * @param delta -1 for the previous point, +1 for the next one.
 * @return void
 */
export const stepCrosshair = (refs: ElementRefs, delta: number): void => {
	if (!context || context.points.length === 0) {
		return;
	}
	const rect = refs.graphSvg.getBoundingClientRect();
	snapIndex = clampNum(snapIndex + delta, 0, context.points.length - 1);
	const point = context.points[snapIndex];
	pointer = {
		speed: point.speed,
		userY: point.landingY,
		clientX: rect.left + (toX(context.frame, point.speed) / context.frame.width) * rect.width,
		clientY: rect.top + (point.landingY / context.frame.height) * rect.height,
	};
	drawCrosshair(refs);
};

/**
 * @brief Handle a keyboard event on the focused plot.
 * @param refs Cached DOM handles.
 * @param event Keydown event from the plot root.
 * @return void
 */
const onKeyDown = (refs: ElementRefs, event: KeyboardEvent): void => {
	if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
		event.preventDefault();
		stepCrosshair(refs, event.key === 'ArrowRight' ? 1 : -1);
		return;
	}
	if (event.key === 'Escape') {
		clearCrosshair(refs);
	}
};

/**
 * @brief Attach pointer and keyboard listeners to the plot root.
 * @brief Idempotent: repeated calls never stack a second listener set.
 * @param refs Cached DOM handles.
 * @return void
 */
export const bindCrosshair = (refs: ElementRefs): void => {
	if (bound) {
		return;
	}
	bound = true;
	refs.graphSvg.setAttribute('tabindex', '0');
	refs.graphSvg.addEventListener('pointermove', (event) => moveCrosshairTo(refs, event.clientX, event.clientY));
	refs.graphSvg.addEventListener('pointerdown', (event) => {
		refs.graphSvg.focus();
		moveCrosshairTo(refs, event.clientX, event.clientY);
	});
	refs.graphSvg.addEventListener('pointerleave', () => clearCrosshair(refs));
	refs.graphSvg.addEventListener('keydown', (event) => onKeyDown(refs, event));
	refs.graphSvg.addEventListener('blur', () => clearCrosshair(refs));
};
