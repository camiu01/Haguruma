/**
 * @file graph-gestures.ts
 * @brief Pointer, wheel and keyboard navigation of the RPM plot viewport.
 *
 * The plot has no pan or zoom layer of its own: every gesture writes
 * `state.graphWindow` and repaints through `renderGraph`, so the axes, the
 * curves and the crosshair all stay consistent with one source of truth. A
 * pointer drag only starts moving the window after a small slop, which keeps
 * the crosshair usable with the same gesture.
 *
 * The window is bounded by the axis, so a drag can only reveal what is off
 * screen: while the whole axis is visible there is nothing to pan to and only
 * zooming in creates room. Dragging past the edge simply stops at the edge.
 */
import { state } from '../../core/state/app-state';
import type { GraphWindow, PlotFrame } from '../../core/models';
import type { ElementRefs } from '../dom/element-refs';
import { renderGraph } from './graph-renderer';
import { clampWindow, fullWindow, isFullWindow, panWindow, VIEW_LIMITS, zoomWindow } from './graph-viewport';
import { buildPlotFrame, clampNum, plotMaxRpm, rpmAtY, speedAtX } from './svg-frame';

/** Pointer travel in viewport pixels before a press becomes a pan. */
const DRAG_SLOP_PX = 3;

/** Wheel zoom factor applied per wheel notch. */
const WHEEL_STEP = 1.12;

/** Multiplier applied by the zoom-in button. */
export const ZOOM_IN_FACTOR = 1 / VIEW_LIMITS.step;

/** Multiplier applied by the zoom-out button. */
export const ZOOM_OUT_FACTOR = VIEW_LIMITS.step;

/** True once the pointer and wheel bindings are attached. */
let bound = false;

/** Press position and the window captured when the drag started. */
interface DragState {
	clientX: number;
	clientY: number;
	window: GraphWindow;
	moved: boolean;
	pointerId: number;
}

/** Live drag, null while no button is held. */
let drag: DragState | null = null;

/** Pending repaint frame, 0 while no repaint is scheduled. */
let paintFrame = 0;

/**
 * @brief Coalesce the repaints of one gesture into the next animation frame.
 * @brief A pointer drag fires far more often than the screen refreshes, and
 * @brief every repaint rebuilds the whole SVG, so the gesture only schedules
 * @brief one paint per frame.
 * @param refs Cached DOM handles.
 * @return void
 */
const scheduleRender = (refs: ElementRefs): void => {
	if (paintFrame !== 0) {
		return;
	}
	paintFrame = window.requestAnimationFrame(() => {
		paintFrame = 0;
		renderGraph(refs);
	});
};

/**
 * @brief Resolve the axis ceilings of the current plot.
 * @return Speed ceiling in display units and RPM ceiling.
 */
export const currentAxisCeilings = (): { maxSpeed: number; maxRpm: number } => {
	return {
		maxSpeed: state.maxGraphSpeed,
		maxRpm: plotMaxRpm(state.primaryRedline, state.compRedline, state.compareEnabled),
	};
};

/**
 * @brief Read the active window, materialized when the plot is unzoomed.
 * @return Window covering the current axis.
 */
const activeWindow = (): GraphWindow => {
	const { maxSpeed, maxRpm } = currentAxisCeilings();
	return state.graphWindow ? clampWindow(state.graphWindow, maxSpeed, maxRpm) : fullWindow(maxSpeed, maxRpm);
};

/**
 * @brief Build the frame the plot is currently composed with.
 * @brief Reading the size from the live viewBox keeps the gesture math exactly
 * @brief equal to the render math, insets included.
 * @return Live plot frame, null while the plot has no measurable viewBox.
 */
const liveFrame = (): PlotFrame | null => {
	const svg = document.getElementById('graph-svg');
	if (!(svg instanceof SVGSVGElement)) {
		return null;
	}
	const box = svg.viewBox.baseVal;
	if (!(box.width > 0) || !(box.height > 0)) {
		return null;
	}
	const { maxSpeed, maxRpm } = currentAxisCeilings();
	return buildPlotFrame(maxSpeed, maxRpm, box.width, box.height, state.graphWindow ?? undefined);
};

/**
 * @brief Store a window, collapsing the full axis back to null.
 * @param next Window to store.
 * @return void
 */
const storeWindow = (next: GraphWindow): void => {
	const { maxSpeed, maxRpm } = currentAxisCeilings();
	const clamped = clampWindow(next, maxSpeed, maxRpm);
	state.graphWindow = isFullWindow(clamped, maxSpeed, maxRpm) ? null : clamped;
};

/**
 * @brief Zoom the plot by one step around its centre.
 * @param refs Cached DOM handles.
 * @param factor Multiplier below 1 to zoom in, above 1 to zoom out.
 * @return void
 */
export const zoomGraph = (refs: ElementRefs, factor: number): void => {
	const { maxSpeed, maxRpm } = currentAxisCeilings();
	storeWindow(zoomWindow(activeWindow(), factor, maxSpeed, maxRpm));
	renderGraph(refs);
};

/**
 * @brief Drop the zoom and the pan, restoring the full axis.
 * @param refs Cached DOM handles.
 * @return void
 */
export const resetGraphWindow = (refs: ElementRefs): void => {
	if (!state.graphWindow) {
		return;
	}
	state.graphWindow = null;
	renderGraph(refs);
};

/**
 * @brief Translate the window by a viewport pixel delta.
 * @brief Pixel deltas are scaled by the drawable band, so a drag moves the
 * @brief plot under the finger at every host size and zoom level.
 * @param window Window to move.
 * @param frame Frame the plot is composed with.
 * @param dx Pixels dragged to the right.
 * @param dy Pixels dragged down.
 * @return Panned window.
 */
const panByPixels = (window: GraphWindow, frame: PlotFrame, dx: number, dy: number): GraphWindow => {
	const { maxSpeed, maxRpm } = currentAxisCeilings();
	const kmhPerPx = frame.plotWidth > 0 ? (window.maxKmh - window.minKmh) / frame.plotWidth : 0;
	const rpmPerPx = frame.plotHeight > 0 ? (window.maxRpm - window.minRpm) / frame.plotHeight : 0;
	return panWindow(window, -dx * kmhPerPx, dy * rpmPerPx, maxSpeed, maxRpm);
};

/**
 * @brief Handle one wheel event on the plot.
 * @brief The zoom is anchored on the pointer, so the value under the cursor
 * @brief stays under the cursor while the window shrinks.
 * @param refs Cached DOM handles.
 * @param event Wheel event from the plot.
 * @return void
 */
const onWheel = (refs: ElementRefs, event: WheelEvent): void => {
	event.preventDefault();
	const frame = liveFrame();
	const rect = refs.graphSvg.getBoundingClientRect();
	if (!frame || rect.width <= 0 || rect.height <= 0) {
		return;
	}
	const userX = ((event.clientX - rect.left) / rect.width) * frame.width;
	const userY = ((event.clientY - rect.top) / rect.height) * frame.height;
	const anchor = {
		speed: clampNum(speedAtX(frame, userX), frame.window.minKmh, frame.window.maxKmh),
		rpm: clampNum(rpmAtY(frame, userY), frame.window.minRpm, frame.window.maxRpm),
	};
	const { maxSpeed, maxRpm } = currentAxisCeilings();
	const factor = event.deltaY < 0 ? 1 / WHEEL_STEP : WHEEL_STEP;
	storeWindow(zoomWindow(frame.window, factor, maxSpeed, maxRpm, anchor));
	renderGraph(refs);
};

/**
 * @brief Handle a pointer press on the plot.
 * @brief The plot is rebuilt on every pan frame, which destroys the child node
 * @brief under the pointer and makes the browser fire a `pointerleave` on the
 * @brief plot itself. Capturing the pointer keeps every move of the gesture
 * @brief routed to the plot, so the drag survives its own repaints. Capture is
 * @brief best-effort: when the browser refuses it the drag still runs, it just
 * @brief ends if the pointer leaves the plot.
 * @param refs Cached DOM handles.
 * @param event Pointer event from the plot.
 * @return void
 */
const onPointerDown = (refs: ElementRefs, event: PointerEvent): void => {
	if (event.button !== 0) {
		return;
	}
	drag = { clientX: event.clientX, clientY: event.clientY, window: activeWindow(), moved: false, pointerId: event.pointerId };
	try {
		refs.graphSvg.setPointerCapture(event.pointerId);
	} catch {
		// Capture is an enhancement, not a requirement for panning.
	}
};

/**
 * @brief Pan the window while the pointer is held past the slop.
 * @param refs Cached DOM handles.
 * @param event Pointer event from the plot.
 * @return void
 */
const onPointerMove = (refs: ElementRefs, event: PointerEvent): void => {
	if (!drag || event.pointerId !== drag.pointerId) {
		return;
	}
	const dx = event.clientX - drag.clientX;
	const dy = event.clientY - drag.clientY;
	if (!drag.moved && Math.hypot(dx, dy) < DRAG_SLOP_PX) {
		return;
	}
	const frame = liveFrame();
	if (!frame) {
		return;
	}
	drag.moved = true;
	storeWindow(panByPixels(drag.window, frame, dx, dy));
	scheduleRender(refs);
};

/**
 * @brief End a drag gesture and release the pointer capture.
 * @param refs Cached DOM handles.
 * @param event Pointer event that ended the gesture.
 * @return void
 */
const onPointerUp = (refs: ElementRefs, event: PointerEvent): void => {
	if (!drag || event.pointerId !== drag.pointerId) {
		return;
	}
	drag = null;
	if (refs.graphSvg.hasPointerCapture(event.pointerId)) {
		refs.graphSvg.releasePointerCapture(event.pointerId);
	}
};

/**
 * @brief Handle keyboard navigation of the plot viewport.
 * @brief The crosshair owns the arrow keys, so navigation uses the keys the
 * @brief crosshair leaves free.
 * @param refs Cached DOM handles.
 * @param event Keydown event from the plot.
 * @return void
 */
const onKeyDown = (refs: ElementRefs, event: KeyboardEvent): void => {
	if (event.key === '+' || event.key === '=') {
		event.preventDefault();
		zoomGraph(refs, ZOOM_IN_FACTOR);
		return;
	}
	if (event.key === '-' || event.key === '_') {
		event.preventDefault();
		zoomGraph(refs, ZOOM_OUT_FACTOR);
		return;
	}
	if (event.key === 'Home' || event.key === '0') {
		event.preventDefault();
		resetGraphWindow(refs);
	}
};

/**
 * @brief Attach wheel, pointer and keyboard navigation to the plot root.
 * @brief Idempotent: repeated calls never stack a second listener set. A
 * @brief gesture never ends on `pointerleave`, because the repaint itself
 * @brief triggers one; only a real pointer release ends it.
 * @param refs Cached DOM handles.
 * @return void
 */
export const bindGraphGestures = (refs: ElementRefs): void => {
	if (bound) {
		return;
	}
	bound = true;
	refs.graphSvg.addEventListener('wheel', (event) => onWheel(refs, event), { passive: false });
	refs.graphSvg.addEventListener('pointerdown', (event) => onPointerDown(refs, event));
	refs.graphSvg.addEventListener('pointermove', (event) => onPointerMove(refs, event));
	refs.graphSvg.addEventListener('pointerup', (event) => onPointerUp(refs, event));
	refs.graphSvg.addEventListener('pointercancel', (event) => onPointerUp(refs, event));
	refs.graphSvg.addEventListener('keydown', (event) => onKeyDown(refs, event));
};
