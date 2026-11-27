/**
 * @file graph-visual.test.ts
 * @brief Visual regression snapshots of the composed SVG plot scene.
 *
 * The plot is a declarative primitive tree, so serialising it per theme is a
 * deterministic, browser-free snapshot of axes, fonts, colors and draw order.
 * An intentional visual change is accepted with `npx vitest run -u`.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { parseTire } from '../src/core/math/tire-math';
import { state, defaultState } from '../src/core/state/app-state';
import { buildSceneData, composeNodes } from '../src/services/graph/graph-scene';
import { setTheme, type Theme } from '../src/core/theme/theme';
import type { SvgPrim } from '../src/services/graph/svg-nodes';

/**
 * @brief Serialise a primitive tree to compact SVG-like markup.
 * @param node Primitive to serialise.
 * @return Markup string with numbers rounded to 0.01.
 */
const serialise = (node: SvgPrim): string => {
	const attrs = Object.entries(node.attrs ?? {})
		.map(([key, value]) => `${key}="${typeof value === 'number' ? Math.round(value * 100) / 100 : value}"`)
		.join(' ');
	const inner = (node.children ?? []).map(serialise).join('') + (node.text ?? '');
	return `<${node.tag}${attrs ? ' ' + attrs : ''}>${inner}</${node.tag}>`;
};

describe('graph visual regression', () => {
	afterEach(() => {
		state.graphLayers = { ...defaultState.graphLayers };
		setTheme('dark');
	});

	const tire = parseTire(defaultState.primaryTire);

	for (const theme of ['dark', 'oled', 'light'] as Theme[]) {
		it(`keeps the ${theme} plot scene stable`, () => {
			setTheme(theme);
			state.graphLayers = { ...defaultState.graphLayers, shiftDrops: true, aeroWall: true, gripLimit: true, powerCurve: true };
			const nodes = composeNodes(buildSceneData(tire as NonNullable<typeof tire>));
			expect(nodes.map(serialise).join('\n')).toMatchSnapshot();
		});
	}
});
