/**
 * @file graph-theme.ts
 * @brief Resolve the SVG plot palette from the active UI theme.
 */
import { GRAPH_STYLE, GRAPH_STYLE_LIGHT, GRAPH_STYLE_OLED } from '../../config/graph-constants';
import { getTheme } from '../../core/theme/theme';

/**
 * Plot palette shared by axes, curves, limits and markers.
 * @brief Structural type so dark, OLED and light palettes stay interchangeable.
 */
export interface GraphPalette {
	/** Coarse grid line color. */
	grid: string;
	/** Fine background grid texture color. */
	gridFine: string;
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
	/** Aero-wall line and callout. */
	aero: string;
	/** Aero-wall unreachable-region fill. */
	aeroFill: string;
	/** Grip-limit curve. */
	grip: string;
	/** Comparison grip-limit curve. */
	gripCompare: string;
	/** Available wheel-power envelope. */
	power: string;
	/** Road-load requirement curve. */
	powerLoad: string;
	/** Wheelspin shading. */
	spinFill: string;
}

/**
 * @brief Get the plot palette for the active theme.
 * @return Palette with background, grid, limit and envelope colors.
 */
export const getGraphStyle = (): GraphPalette => {
	const theme = getTheme();
	if (theme === 'light') {
		return GRAPH_STYLE_LIGHT;
	}
	if (theme === 'oled') {
		return GRAPH_STYLE_OLED;
	}
	return GRAPH_STYLE;
};
