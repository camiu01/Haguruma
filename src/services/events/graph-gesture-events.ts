/**
 * @file graph-gesture-events.ts
 * @brief Pointer pinch/pan, double-tap reset and keyboard graph navigation.
 */
import { state } from '../../core/state/app-state';
import { syncUrlHash } from '../../core/share/share-utils';
import { t } from '../../core/i18n/language';
import type { ElementRefs } from '../dom/element-refs';
import { buildPlotFrame } from '../graph/canvas-setup';
import { currentGraphWindow, fittedGraphSpeed, transformGraphWindow } from '../graph/graph-viewport';
import { drawGraph } from '../graph/graph-renderer';
import { handleCanvasPointer } from '../graph/graph-tooltip';

type Point = { clientX: number; clientY: number };

/** Single-pointer press that becomes a pan once it leaves the tap slop. */
type Press = { id: number; x: number; y: number; panning: boolean };

/** Pixel movement before a press counts as a drag rather than a tap. */
const DRAG_SLOP = 3;

/**
 * @brief Reset the view and remove stale interaction output.
 * @param refs Cached DOM handles.
 * @return void
 */
const reset = (refs: ElementRefs): void => {
	state.graphWindow = undefined;
	refs.tooltip.classList.add('hidden');
	refs.graphCrosshair.hidden = true;
	refs.graphReadout.textContent = '';
	drawGraph(refs);
	syncUrlHash();
};

/**
 * @brief Bind explicit zoom, fit and reset controls.
 * @param refs Cached DOM handles.
 * @return void
 */
const bindControls = (refs: ElementRefs): void => {
	refs.graphTractionMargin.addEventListener('change', () => {
		state.showTractionMargin = refs.graphTractionMargin.checked;
		drawGraph(refs);
		syncUrlHash();
	});
	refs.graphMode.addEventListener('change', () => {
		state.graphMode = refs.graphMode.value === 'force' ? 'force' : 'rpm';
		reset(refs);
	});
	for (const [button, factor] of [[refs.graphZoomIn, 0.8], [refs.graphZoomOut, 1.25]] as const) {
		button.addEventListener('click', () => {
			state.graphWindow = transformGraphWindow(currentGraphWindow(), factor);
			drawGraph(refs);
			syncUrlHash();
		});
	}
	refs.graphFit.addEventListener('click', () => {
		state.maxGraphSpeed = fittedGraphSpeed(Number(refs.graphFitMargin.value) / 100);
		refs.graphMaxSpeed.value = String(state.maxGraphSpeed);
		reset(refs);
	});
};

/**
 * @brief Pan through a drag or modified arrow keys.
 * @param refs Graph controls.
 * @param dx Fractional horizontal offset.
 * @param dy Fractional RPM offset, ignored in the auto-scaled force view.
 * @param sync Write the new window to the URL hash, false during a live drag.
 * @return void
 */
const panView = (refs: ElementRefs, dx: number, dy: number, sync = true): void => {
	state.graphWindow = transformGraphWindow(currentGraphWindow(), 1, 0.5, 0.5, dx, state.graphMode === 'force' ? 0 : dy);
	drawGraph(refs);
	if (sync) {
		syncUrlHash();
	}
};

/**
 * @brief Pan the view from a drag, the way a map moves under the pointer.
 * @brief Dragging right reveals lower speeds; the vertical direction matches the
 * @brief pan buttons and stays locked in the force view.
 * @param refs Cached DOM handles.
 * @param press Active press, updated with the latest pan origin.
 * @param event Current pointer position.
 * @return True once the press pans, false while it is still inside the tap slop.
 */
const dragPan = (refs: ElementRefs, press: Press, event: PointerEvent): boolean => {
	const dxPx = event.clientX - press.x;
	const dyPx = event.clientY - press.y;
	if (!press.panning && Math.hypot(dxPx, dyPx) < DRAG_SLOP) {
		return false;
	}
	const frame = buildPlotFrame(refs.canvas, state.maxGraphSpeed, currentGraphWindow().maxRpm);
	if (!frame) {
		return false;
	}
	press.panning = true;
	press.x = event.clientX;
	press.y = event.clientY;
	// The hash syncs on pointerup, so a live drag stays cheap.
	panView(refs, -dxPx / frame.plotWidth, dyPx / frame.plotHeight, false);
	refs.tooltip.classList.add('hidden');
	refs.graphCrosshair.hidden = true;
	return true;
};

/**
 * @brief Calculate two-pointer distance and midpoint.
 * @param points Active captured pointers.
 * @return Midpoint and distance, null with fewer than two pointers.
 */
const pinch = (points: Map<number, Point>): { x: number; y: number; distance: number } | null => {
	const [a, b] = [...points.values()];
	return a && b ? { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2, distance: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) } : null;
};

/**
 * @brief Apply an anchored two-pointer transform.
 * @param refs Cached DOM handles.
 * @param before Previous pinch geometry.
 * @param after Current pinch geometry.
 * @return void
 */
const movePinch = (refs: ElementRefs, before: NonNullable<ReturnType<typeof pinch>>, after: NonNullable<ReturnType<typeof pinch>>): void => {
	const rect = refs.canvas.getBoundingClientRect();
	const frame = buildPlotFrame(refs.canvas, state.maxGraphSpeed, currentGraphWindow().maxRpm);
	if (!frame || before.distance < 1 || after.distance < 1) {
		return;
	}
	state.graphWindow = transformGraphWindow(currentGraphWindow(), before.distance / after.distance,
		(before.x - rect.left - frame.paddingLeft) / frame.plotWidth,
		1 - (before.y - rect.top - frame.paddingTop) / frame.plotHeight,
		(before.x - after.x) / frame.plotWidth, (after.y - before.y) / frame.plotHeight);
	refs.tooltip.classList.add('hidden');
	refs.graphCrosshair.hidden = true;
	drawGraph(refs);
};

/**
 * @brief Bind touch-safe pointer capture and release.
 * @param refs Cached DOM handles.
 * @return void
 */
const bindPointers = (refs: ElementRefs): void => {
	const points = new Map<number, Point>();
	let press: Press | null = null;
	let lastTap = 0;
	refs.canvas.addEventListener('pointerdown', (event) => {
		const now = Date.now();
		if (event.pointerType === 'touch' && points.size === 0 && now - lastTap < 300) {
			reset(refs);
			lastTap = 0;
			return;
		}
		lastTap = points.size === 0 ? now : 0;
		points.set(event.pointerId, event);
		refs.canvas.setPointerCapture(event.pointerId);
		press = points.size === 1 ? { id: event.pointerId, x: event.clientX, y: event.clientY, panning: false } : null;
		handleCanvasPointer(event, refs);
	});
	refs.canvas.addEventListener('pointermove', (event) => {
		const before = pinch(points);
		if (points.has(event.pointerId)) {
			points.set(event.pointerId, event);
		}
		const after = pinch(points);
		if (before && after) {
			// A second pointer takes over for pinch zoom, never for a pan.
			press = null;
			movePinch(refs, before, after);
			return;
		}
		if (press?.id === event.pointerId && dragPan(refs, press, event)) {
			return;
		}
		if (event.pointerType === 'mouse' || points.size === 1) {
			handleCanvasPointer(event, refs);
		}
	});
	for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) {
		refs.canvas.addEventListener(name, (event) => {
			const id = (event as PointerEvent).pointerId;
			points.delete(id);
			if (press?.id === id) {
				press = null;
			}
			syncUrlHash();
		});
	}
	refs.canvas.addEventListener('dblclick', () => reset(refs));
	refs.canvas.addEventListener('pointerleave', () => {
		if (points.size) return;
		refs.tooltip.classList.add('hidden'); refs.graphCrosshair.hidden = true;
	});
};

/**
 * @brief Navigate a selected curve using arrows without trapping Tab.
 * @param refs Cached DOM handles.
 * @return void
 */
const bindKeyboard = (refs: ElementRefs): void => {
	let x = 0.5;
	let y = 0.5;
	refs.canvas.tabIndex = 0;
	refs.canvas.setAttribute('role', 'img');
	refs.canvas.setAttribute('aria-describedby', 'graph-help graph-readout');
	refs.canvas.setAttribute('data-i18n-tip', 'graph.title');
	refs.canvas.setAttribute('aria-label', t('graph.title'));
	refs.canvas.addEventListener('keydown', (event) => {
		if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'Escape'].includes(event.key)) {
			return;
		}
		event.preventDefault();
		if (event.shiftKey && event.key.startsWith('Arrow')) {
			panView(refs, event.key === 'ArrowRight' ? 0.15 : event.key === 'ArrowLeft' ? -0.15 : 0,
				event.key === 'ArrowUp' ? 0.15 : event.key === 'ArrowDown' ? -0.15 : 0);
			return;
		}
		if (event.key === 'Home' || event.key === 'Escape') {
			reset(refs);
			return;
		}
		x = Math.max(0, Math.min(1, x + (event.key === 'ArrowRight' ? 0.02 : event.key === 'ArrowLeft' ? -0.02 : 0)));
		y = Math.max(0, Math.min(1, y + (event.key === 'ArrowDown' ? 0.1 : event.key === 'ArrowUp' ? -0.1 : 0)));
		const rect = refs.canvas.getBoundingClientRect();
		const frame = buildPlotFrame(refs.canvas, state.maxGraphSpeed, currentGraphWindow().maxRpm);
		if (frame) {
			handleCanvasPointer({ clientX: rect.left + frame.paddingLeft + x * frame.plotWidth,
				clientY: rect.top + frame.paddingTop + y * frame.plotHeight }, refs);
		}
	});
};

/**
 * @brief Bind graph navigation once during bootstrap.
 * @param refs Cached DOM handles.
 * @return void
 */
export const bindGraphGestures = (refs: ElementRefs): void => {
	bindControls(refs);
	bindPointers(refs);
	bindKeyboard(refs);
	document.addEventListener('pointerdown', (event) => {
		if (event.target !== refs.canvas) {
			refs.tooltip.classList.add('hidden');
			refs.graphCrosshair.hidden = true;
		}
	});
};
