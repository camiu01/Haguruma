/**
 * @file graph-legend.ts
 * @brief Repaint the HTML legend swatches and layer pill dots from the SVG plot palette.
 * @brief Keeps the HTML furniture in sync with `graph-theme.ts` so every theme
 * @brief shows one consistent color for a given series.
 */

import { GEAR_COLORS } from '../../config/gear-colors';
import { getGraphStyle } from './graph-theme';
import type { GraphPalette } from './graph-theme';

/** Gradient standing in for the per-gear ray colors of the primary stack. */
export const GEAR_GRADIENT = `linear-gradient(90deg, ${GEAR_COLORS.join(', ')})`;

/**
 * @brief Map every `[data-graph-legend]` key to its palette color.
 * @param style Active plot palette.
 * @return Color per legend key; `primary` carries the gear gradient.
 */
export const legendSwatchColors = (style: GraphPalette): Record<string, string> => ({
	primary: GEAR_GRADIENT,
	compare: style.compare,
	shift: style.shiftDrop,
	drop: style.shiftDrop,
	aero: style.aero,
	grip: style.grip,
	power: style.power,
});

/**
 * @brief Map every `[data-graph-layer]` slug to its palette color.
 * @param style Active plot palette.
 * @return Color per lowercase layer slug.
 */
export const layerSwatchColors = (style: GraphPalette): Record<string, string> => ({
	shiftdrops: style.shiftDrop,
	aerowall: style.aero,
	griplimit: style.grip,
	powercurve: style.power,
});

/**
 * @brief Normalize a dataset value the same way the layer pills do.
 * @param raw Raw `data-*` value.
 * @return Lowercase alphanumeric slug (empty string when missing).
 */
const slug = (raw: string | undefined): string => (raw ?? '').replace(/[^a-z0-9]/gi, '').toLowerCase();

/**
 * @brief Drop the alpha channel so legend labels keep full text contrast.
 * @param color Any CSS color, optionally with an `rgba(…, alpha)` tail.
 * @return The same color at full opacity.
 */
const solidColor = (color: string): string => color.replace(/,\s*0?\.\d+\s*\)$/, ', 1)');

/**
 * @brief Paint one host's swatch (and label color) with the resolved palette color.
 * @param host Element carrying `data-graph-legend` or `data-graph-layer`.
 * @param color Palette color (or gradient) for that host.
 * @return void
 */
const paintHost = (host: HTMLElement, color: string): void => {
	const swatch = host.querySelector<HTMLElement>('[data-graph-swatch]');
	if (!swatch) {
		return;
	}
	if (swatch.dataset.swatch === 'border') {
		swatch.style.borderColor = color;
	} else {
		swatch.style.background = color;
	}
	if (host.dataset.graphLegend && host.dataset.graphLegend !== 'primary') {
		host.style.color = solidColor(color);
	}
};

/**
 * @brief Repaint every legend item and layer pill dot for the active theme.
 * @return void
 */
export const syncGraphSwatches = (): void => {
	const style = getGraphStyle();
	const legend = legendSwatchColors(style);
	const layers = layerSwatchColors(style);
	document.querySelectorAll<HTMLElement>('[data-graph-legend]').forEach((host) => {
		const color = legend[host.dataset.graphLegend ?? ''];
		if (color) {
			paintHost(host, color);
		}
	});
	document.querySelectorAll<HTMLElement>('[data-graph-layer]').forEach((host) => {
		const color = layers[slug(host.dataset.graphLayer)];
		if (color) {
			paintHost(host, color);
		}
	});
};
