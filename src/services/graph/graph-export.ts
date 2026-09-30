/**
 * @file graph-export.ts
 * @brief PNG raster and vector SVG download of the live SVG plot.
 *
 * Both exports serialize a clone of `#graph-svg`, so the live plot is never
 * mutated: the transient crosshair is stripped from the clone, the standalone
 * namespace and viewBox size are pinned, and any serialization or raster
 * failure is swallowed (the caller gets no error, the file just never lands).
 */
import { GRAPH_VIEWBOX } from '../../config/graph-constants';
import type { ElementRefs } from '../dom/element-refs';
import { SVG_NS } from './svg-nodes';

/** Download name of the vector export. */
const SVG_FILENAME = 'haguruma-graph.svg';

/** Download name of the raster export. */
const PNG_FILENAME = 'haguruma-graph.png';

/** Raster magnification of the PNG export. */
const PNG_SCALE = 2;

/**
 * @brief Trigger a browser download of a blob under a file name.
 * @param blob Payload to download.
 * @param filename Download file name.
 * @return void
 */
const downloadBlob = (blob: Blob, filename: string): void => {
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
};

/**
 * @brief Resolve the size the live plot was composed at.
 * @brief The render pass pins the viewBox to the measured host, so the export
 * @brief keeps the exact proportions of the on-screen plot.
 * @param svg Live plot root.
 * @return ViewBox width and height, static 16:9 fallback when unset.
 */
const viewBoxSize = (svg: SVGSVGElement): { width: number; height: number } => {
	const base = svg.viewBox.baseVal;
	if (base.width > 0 && base.height > 0) {
		return { width: base.width, height: base.height };
	}
	return { width: GRAPH_VIEWBOX.width, height: GRAPH_VIEWBOX.height };
};

/**
 * @brief Serialize the live plot as standalone SVG markup.
 * @brief The clone drops the transient crosshair and pins the viewBox size so
 * @brief the exported file is resolution-independent and complete.
 * @param svg Live plot root.
 * @return Markup string with an XML declaration, or null when serialization fails.
 */
export const serializeGraphSvg = (svg: SVGSVGElement): string | null => {
	try {
		const size = viewBoxSize(svg);
		const root = svg.cloneNode(true) as SVGSVGElement;
		root.querySelectorAll('.graph-crosshair').forEach((el) => el.remove());
		root.setAttribute('xmlns', SVG_NS);
		root.setAttribute('width', String(size.width));
		root.setAttribute('height', String(size.height));
		root.setAttribute('viewBox', `0 0 ${size.width} ${size.height}`);
		const markup = new XMLSerializer().serializeToString(root);
		return markup ? `<?xml version="1.0" encoding="UTF-8"?>\n${markup}` : null;
	} catch {
		return null;
	}
};

/**
 * @brief Draw a loaded SVG image onto an offscreen canvas and download it.
 * @brief Rasterizes at twice the live viewBox size for a crisp export.
 * @param image Image element holding the serialized plot.
 * @param size ViewBox size of the serialized plot.
 * @return void
 */
const rasterizeToPng = (image: HTMLImageElement, size: { width: number; height: number }): void => {
	try {
		const canvas = document.createElement('canvas');
		canvas.width = Math.round(size.width * PNG_SCALE);
		canvas.height = Math.round(size.height * PNG_SCALE);
		const ctx = canvas.getContext('2d');
		if (!ctx) {
			return;
		}
		ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
		canvas.toBlob((blob) => {
			if (blob) {
				downloadBlob(blob, PNG_FILENAME);
			}
		}, 'image/png');
	} catch {
		return;
	}
};

/**
 * @brief Export the live plot as a vector SVG file.
 * @param refs Cached DOM handles.
 * @return void
 */
export const exportGraphSvg = (refs: ElementRefs): void => {
	const markup = serializeGraphSvg(refs.graphSvg);
	if (!markup) {
		return;
	}
	downloadBlob(new Blob([markup], { type: 'image/svg+xml;charset=utf-8' }), SVG_FILENAME);
};

/**
 * @brief Export the live plot as a PNG file at twice the viewBox size.
 * @param refs Cached DOM handles.
 * @return void
 */
export const exportGraphPng = (refs: ElementRefs): void => {
	const size = viewBoxSize(refs.graphSvg);
	const markup = serializeGraphSvg(refs.graphSvg);
	if (!markup) {
		return;
	}
	const image = new Image();
	image.onload = () => rasterizeToPng(image, size);
	image.onerror = () => undefined;
	try {
		image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
	} catch {
		return;
	}
};
