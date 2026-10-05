/**
 * @file graph-legend.test.ts
 * @brief Palette-mapping tests for the HTML legend swatches and layer pill dots.
 *
 * Verifies that every legend and layer key resolves to the same color the SVG
 * plot draws for that series, in every theme palette, and that the primary
 * entry carries the shared gear-color gradient.
 */
import { describe, expect, it } from 'vitest';
import { GEAR_COLORS } from '../src/config/gear-colors';
import { GRAPH_STYLE, GRAPH_STYLE_LIGHT, GRAPH_STYLE_OLED } from '../src/config/graph-constants';
import { GEAR_GRADIENT, layerSwatchColors, legendSwatchColors } from '../src/services/graph/graph-legend';

describe('legendSwatchColors', () => {
	it('maps every legend key to the drawn palette color', () => {
		const colors = legendSwatchColors(GRAPH_STYLE);
		expect(Object.keys(colors).sort()).toEqual(['aero', 'compare', 'drop', 'grip', 'power', 'primary', 'shift']);
		expect(colors.compare).toBe(GRAPH_STYLE.compare);
		expect(colors.shift).toBe(GRAPH_STYLE.shiftDrop);
		expect(colors.drop).toBe(GRAPH_STYLE.shiftDrop);
		expect(colors.aero).toBe(GRAPH_STYLE.aero);
		expect(colors.grip).toBe(GRAPH_STYLE.grip);
		expect(colors.power).toBe(GRAPH_STYLE.power);
	});

	it('renders the primary entry as the shared gear gradient', () => {
		const colors = legendSwatchColors(GRAPH_STYLE);
		expect(colors.primary).toBe(GEAR_GRADIENT);
		expect(colors.primary).toContain(GEAR_COLORS[0]);
		expect(colors.primary).toContain(GEAR_COLORS[GEAR_COLORS.length - 1]);
	});

	it('follows the light and OLED palettes', () => {
		expect(legendSwatchColors(GRAPH_STYLE_LIGHT).aero).toBe(GRAPH_STYLE_LIGHT.aero);
		expect(legendSwatchColors(GRAPH_STYLE_LIGHT).power).toBe(GRAPH_STYLE_LIGHT.power);
		expect(legendSwatchColors(GRAPH_STYLE_OLED).power).toBe(GRAPH_STYLE_OLED.power);
		expect(legendSwatchColors(GRAPH_STYLE_LIGHT).aero).not.toBe(GRAPH_STYLE.aero);
	});
});

describe('layerSwatchColors', () => {
	it('maps every layer pill slug to its palette color', () => {
		const colors = layerSwatchColors(GRAPH_STYLE);
		expect(Object.keys(colors).sort()).toEqual(['aerowall', 'griplimit', 'powercurve', 'shiftdrops']);
		expect(colors.shiftdrops).toBe(GRAPH_STYLE.shiftDrop);
		expect(colors.aerowall).toBe(GRAPH_STYLE.aero);
		expect(colors.griplimit).toBe(GRAPH_STYLE.grip);
		expect(colors.powercurve).toBe(GRAPH_STYLE.power);
	});
});
