/**
 * @file graph-layers.ts
 * @brief Dual-layer compositing: cached static axes plus dynamic curves.
 *
 * Grids, redline band and titles repaint only when the frame, unit, theme
 * or redline change; every keystroke otherwise blits the cached bitmap and
 * redraws just the traction curves, drops and markers on top.
 */
import { getTheme } from '../../core/theme/theme';
import type { PlotFrame, SpeedUnit } from '../../core/models';
import { drawAxisTitles, drawBackground, drawRedlineBand, drawRpmGrid, drawSpeedGrid } from './graph-axes';
import { getGraphStyle } from './graph-theme';

/** Inputs identifying one static bitmap. */
export interface StaticLayerKey {
	/** Backing-store width in device pixels. */
	width: number;
	/** Backing-store height in device pixels. */
	height: number;
	/** Right edge of the X axis. */
	maxSpeed: number;
	/** Top edge of the Y axis. */
	maxRpm: number;
	/** Display speed unit. */
	unit: SpeedUnit;
	/** Active UI theme. */
	theme: string;
	/** Primary rev limiter in RPM. */
	redline: number;
	minSpeed?: number;
	minRpm?: number;
	palette?: string;
}

/** Cached offscreen bitmap, null until the first paint. */
let cachedCanvas: HTMLCanvasElement | OffscreenCanvas | null = null;

/** Key of the cached bitmap, empty when nothing is cached. */
let cachedKey = '';

/**
 * @brief Prefer a usable offscreen surface, falling back on constructor/context failure.
 * @param width Backing width.
 * @param height Backing height.
 * @return Worker-ready bitmap where supported, otherwise a detached canvas.
 */
export const createStaticSurface = (width: number, height: number): HTMLCanvasElement | OffscreenCanvas => {
	if (typeof OffscreenCanvas !== 'undefined') {
		try {
			const off = new OffscreenCanvas(width, height);
			if (off.getContext('2d')) return off;
		} catch { /* Some embedded WebViews expose the constructor but cannot create a 2D context. */ }
	}
	const off = document.createElement('canvas');
	off.width = width; off.height = height;
	return off;
};

/**
 * @brief Build the cache key for one static bitmap.
 * @param key Static layer inputs.
 * @return Pipe-joined key string.
 */
export const buildStaticKey = (key: StaticLayerKey): string => {
	return [key.width, key.height, key.maxSpeed, key.maxRpm, key.unit, key.theme, key.redline, key.minSpeed ?? 0, key.minRpm ?? 0, key.palette ?? ''].join('|');
};

/**
 * @brief Drop the cached static bitmap.
 * @param none No parameters.
 * @return void
 */
export const invalidateStaticLayer = (): void => {
	cachedKey = '';
	cachedCanvas = null;
};

/**
 * @brief Paint grids, redline band and titles into the offscreen bitmap.
 * @param off Target offscreen canvas sized in device pixels.
 * @param frame Plot geometry in CSS pixels.
 * @param unit Display speed unit.
 * @param redline Primary rev limiter in RPM.
 * @return void
 */
const paintStaticLayer = (
	off: HTMLCanvasElement | OffscreenCanvas,
	frame: PlotFrame,
	unit: SpeedUnit,
	redline: number,
): void => {
	const offCtx = off.getContext('2d');
	if (!offCtx) {
		return;
	}
	const dpr = frame.width > 0 ? off.width / frame.width : 1;
	offCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
	drawBackground(offCtx as CanvasRenderingContext2D, frame);
	drawSpeedGrid(offCtx as CanvasRenderingContext2D, frame, unit);
	drawRpmGrid(offCtx as CanvasRenderingContext2D, frame);
	drawRedlineBand(offCtx as CanvasRenderingContext2D, frame, redline);
	drawAxisTitles(offCtx as CanvasRenderingContext2D, frame, unit);
};

/**
 * @brief Blit the cached static layer, repainting only on key changes.
 * @param ctx Visible canvas context (HiDPI transform already applied).
 * @param canvas Visible canvas element.
 * @param frame Plot geometry in CSS pixels.
 * @param unit Display speed unit.
 * @param redline Primary rev limiter in RPM.
 * @return void
 */
export const blitStaticLayer = (
	ctx: CanvasRenderingContext2D,
	canvas: HTMLCanvasElement,
	frame: PlotFrame,
	unit: SpeedUnit,
	redline: number,
): void => {
	const key = buildStaticKey({
		width: canvas.width,
		height: canvas.height,
		maxSpeed: frame.maxSpeed,
		maxRpm: frame.maxRpm,
		unit,
		theme: getTheme(),
		redline,
		minSpeed: frame.minSpeed,
		minRpm: frame.minRpm,
		palette: JSON.stringify(getGraphStyle()),
	});
	if (!cachedCanvas || cachedKey !== key) {
		const off = createStaticSurface(canvas.width, canvas.height);
		paintStaticLayer(off, frame, unit, redline);
		cachedCanvas = off;
		cachedKey = key;
	}
	ctx.drawImage(cachedCanvas, 0, 0, frame.width, frame.height);
};
