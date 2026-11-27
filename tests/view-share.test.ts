/**
 * @file view-share.test.ts
 * @brief Zoom window (`z` key) round trip and validation in the share hash.
 */
import { describe, expect, it } from 'vitest';
import { defaultState } from '../src/core/state/app-state';
import { decodeState, encodeState } from '../src/core/share/share-utils';
import { decodeViewParams } from '../src/core/share/view-share';
import type { AppState } from '../src/core/models';

/**
 * @brief Default state with an optional zoom window.
 * @param graphWindow Window to set, null for the full axis.
 * @return Fresh state.
 */
const withWindow = (graphWindow: AppState['graphWindow']): AppState => ({ ...(JSON.parse(JSON.stringify(defaultState)) as AppState), graphWindow });

describe('view-share', () => {
	it('omits the key while the plot shows the full axis', () => {
		expect(new URLSearchParams(encodeState(withWindow(null))).has('z')).toBe(false);
	});

	it('round-trips a zoomed window next to the compact token', () => {
		const w = { minKmh: 61.9, maxKmh: 268.1, minRpm: 1593.8, maxRpm: 6906.3 };
		const hash = encodeState(withWindow(w));
		expect(hash).toContain('c=');
		expect(decodeState(hash).graphWindow).toEqual(w);
	});

	it('ignores malformed or out-of-range windows', () => {
		for (const z of ['1:2:3', 'a:b:c:d', '100:50:0:7000', '0:900:0:7000', '0:200:5000:1000']) {
			expect(decodeViewParams(new URLSearchParams({ z }))).toEqual({});
		}
	});
});
