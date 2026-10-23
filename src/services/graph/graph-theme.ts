/**
 * @file graph-theme.ts
 * @brief Resolve canvas palette from the active UI theme.
 */
import { GRAPH_STYLE, GRAPH_STYLE_LIGHT, GRAPH_STYLE_OLED } from '../../config/graph-constants';
import { getTheme } from '../../core/theme/theme';

/**
 * Canvas palette shared by axes, curves and markers.
 * @brief Structural type so dark, OLED and light palettes stay interchangeable.
 */
export interface GraphPalette {
	/** Grid line color. */
	grid: string;
	/** Axis tick text color. */
	axisText: string;
	/** Over-rev band fill. */
	redlineFill: string;
	/** Rev limiter line. */
	redlineLine: string;
	/** Shift-drop connector. */
	shiftDrop: string;
	/** Comparison overlay. */
	compare: string;
	/** Plot background. */
	background: string;
}

/**
 * @brief Get the canvas style for the active theme.
 * @return Palette with background, grid and axis colors.
 */
export const getGraphStyle = (): GraphPalette => {
	const theme = getTheme();
	const fallback = theme === 'light' ? GRAPH_STYLE_LIGHT : theme === 'oled' ? GRAPH_STYLE_OLED : GRAPH_STYLE;
	if (typeof document === 'undefined' || typeof getComputedStyle === 'undefined') {
		return fallback;
	}
	const css = getComputedStyle(document.documentElement);
	const read = (name: string, value: string): string => css.getPropertyValue(name).trim() || value;
	return {
		background: read('--bg-canvas', fallback.background),
		grid: read('--border', fallback.grid),
		axisText: read('--text-dim', fallback.axisText),
		redlineFill: read('--accent-red-overlay', fallback.redlineFill),
		redlineLine: read('--accent-red', fallback.redlineLine),
		shiftDrop: read('--accent-red', fallback.shiftDrop),
		compare: read('--accent-yellow', fallback.compare),
	};
};
