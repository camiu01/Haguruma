/**
 * @file share-golden.test.ts
 * @brief Golden URLs and stored-data fixtures frozen at v1.0.0.
 *
 * Shared links and saved cars outlive releases, so these literals must never
 * be edited to make a test pass. The encoder must still produce them byte for
 * byte (protocol immutability), and the decoder and store migration must keep
 * reading them in every later release (cross-version guarantee). A deliberate
 * format change needs a new version byte / schema version and a new fixture,
 * with the old ones kept.
 */
import { describe, expect, it } from 'vitest';
import { defaultState } from '../src/core/state/app-state';
import { decodeState, encodeState } from '../src/core/share/share-utils';
import { COMPACT_HASH_VERSION } from '../src/core/share/share-compact';
import { CUSTOM_STORE_VERSION, migrateCustomStore } from '../src/core/presets/custom-store';
import type { AppState } from '../src/core/models';
import storeV1 from './fixtures/custom-store-v1.json';

const GOLDEN = {
	base: 'c=AQLNNxAQBBwgASwGDfwIAgVkA-gDKgKoAADhLREPPBwgBLABLAfQBEwRlAcIGWQGDfwIAgVkA-gDKgKoBLABLAfQBLAETABVPAPPEZQHCBlkAAAAADQBwgoKBchuAAAZAP8jIAAAlgfQNDQBwgoKBchuAAAZAP8jIAAAlgfQNA',
	compare: 'c=AQPNNxAQBBwgASwGDfwIAgVkA-gDKgKoAADhLREPPBwgBLABLAfQBEwRlAcIGWQFDawINAV4A-gDIASwASwH0ASwBEwAVTwDzxGUBwgZZAAAAAA0AcIKCgXIbgAAGQD_IyAAAJYH0DQ0AcIKCgXIbgAAGQD_IyAAAJYH0DQ',
	dyno: 'tire=205%2F55R16&fd=4.1&rl=7200&g=3.58%2C2.05%2C1.38%2C1%2C0.81%2C0.68&max=300&cmp=0&ctire=225%2F45R17&cfd=3.9&cg=3.58%2C2.05%2C1.38%2C1%2C0.81%2C0.68&crl=7200&cmass=1200&ccd=0.3&carea=2&cpw=110&ctq=4500&ctqn=180&cpwr=6500&mass=1200&cd=0.3&area=2&crr=0.012&pw=110&eff=0.85&rle=1&grade=0&rf=0.975&tq=4500&tqn=180&pwr=6500&rot=0&sft=0&curve=2000%3A150.0%3B4500%3A190.0%3B7000%3A160.0&rg_wd=0.52&rg_cg=450&rg_wb=2570&rg_tw=1480&rg_mu=1.10&rg_lay=FWD&rg_df=open&rg_db=0.25&rg_dc=0.00&rg_tc=touring_300&rg_sf=35&rg_sr=32&rg_lat=0.00&rg_lc=0.15&rg_la=2.00&rg_ls=0.52&crg_wd=0.52&crg_cg=450&crg_wb=2570&crg_tw=1480&crg_mu=1.10&crg_lay=FWD&crg_df=open&crg_db=0.25&crg_dc=0.00&crg_tc=touring_300&crg_sf=35&crg_sr=32&crg_lat=0.00&crg_lc=0.15&crg_la=2.00&crg_ls=0.52',
} as const;

/**
 * @brief Deep copy of the default state.
 * @return Fresh mutable state.
 */
const clone = (): AppState => JSON.parse(JSON.stringify(defaultState)) as AppState;

/** States the golden URLs were generated from. */
const STATES: Record<keyof typeof GOLDEN, () => AppState> = {
	base: clone,
	compare: () => ({ ...clone(), compareEnabled: true, compFd: 3.9, compGears: [3.5, 2.1, 1.4, 1.0, 0.8] }),
	dyno: () => ({ ...clone(), torqueCurvePoints: [{ rpm: 2000, torqueNm: 150 }, { rpm: 4500, torqueNm: 190 }, { rpm: 7000, torqueNm: 160 }] }),
};

describe('share protocol v1 is immutable', () => {
	it('keeps the version byte at 1', () => {
		expect(COMPACT_HASH_VERSION).toBe(1);
	});

	for (const key of Object.keys(GOLDEN) as (keyof typeof GOLDEN)[]) {
		it(`encodes the ${key} state to the frozen URL`, () => {
			expect(encodeState(STATES[key]())).toBe(GOLDEN[key]);
		});
	}

	it('decodes the frozen URLs back to their states', () => {
		const compare = decodeState(GOLDEN.compare);
		expect(compare.compareEnabled).toBe(true);
		expect(compare.compFd).toBeCloseTo(3.9, 2);
		expect(compare.compGears).toEqual([3.5, 2.1, 1.4, 1.0, 0.8]);
		const dyno = decodeState(GOLDEN.dyno);
		expect(dyno.torqueCurvePoints).toEqual(STATES.dyno().torqueCurvePoints);
		expect(decodeState(GOLDEN.base).gears).toEqual(defaultState.gears);
	});

	it('ignores a payload with an unknown future version byte', () => {
		const future = GOLDEN.base.replace('c=AQ', 'c=Ag');
		expect(decodeState(future).gears).toBeUndefined();
	});
});

describe('custom store schema v1 is readable forever', () => {
	it('keeps the schema version at 1', () => {
		expect(CUSTOM_STORE_VERSION).toBe(1);
	});

	it('loads the frozen v1 envelope', () => {
		const presets = migrateCustomStore(storeV1);
		expect(Object.keys(presets)).toEqual(['track-miata']);
		expect(presets['track-miata'].gears).toEqual([3.136, 1.888, 1.33, 1.0, 0.814]);
		expect(presets['track-miata'].fd).toBe(4.3);
	});

	it('loads the frozen pre-envelope (v0) bare map', () => {
		const presets = migrateCustomStore(storeV1.presets);
		expect(presets['track-miata'].redline).toBe(7200);
	});
});