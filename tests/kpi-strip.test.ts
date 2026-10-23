/**
 * @file kpi-strip.test.ts
 * @brief Pure tests for the KPI strip classifiers: wall/overdrive flags and shift advisories.
 */
import { describe, expect, it } from 'vitest';
import { classifyGearVmax, formatGearAdvisory } from '../src/components/gear-status';
import { t } from '../src/core/i18n/language';

/** Wall speed used by the classification fixtures (km/h). */
const WALL_KMH = 280;

/** Index of the first gear whose theoretical V-Max passes the wall. */
const FIRST_OVER_WALL = 3;

describe('classifyGearVmax', () => {
	it('keeps a gear below the wall clean', () => {
		const status = classifyGearVmax(0, 62.4, WALL_KMH, FIRST_OVER_WALL, 'kmh');
		expect(status.dragLimited).toBe(false);
		expect(status.overdrive).toBe(false);
		expect(status.badgeKey).toBeNull();
		expect(status.ecoShift).toBe(false);
		expect(status.display).toBeCloseTo(62.4, 5);
		expect(status.theoreticalDisplay).toBeCloseTo(62.4, 5);
	});

	it('flags the first gear past the wall as drag-limited and shows the wall speed', () => {
		const status = classifyGearVmax(FIRST_OVER_WALL, 305.2, WALL_KMH, FIRST_OVER_WALL, 'kmh');
		expect(status.dragLimited).toBe(true);
		expect(status.overdrive).toBe(false);
		expect(status.badgeKey).toBe('status.wall');
		expect(status.ecoShift).toBe(false);
		expect(status.display).toBeCloseTo(WALL_KMH, 5);
		expect(status.theoreticalDisplay).toBeCloseTo(305.2, 5);
	});

	it('flags a taller gear past the wall as overdrive and keeps the theoretical value', () => {
		const status = classifyGearVmax(FIRST_OVER_WALL + 1, 342.8, WALL_KMH, FIRST_OVER_WALL, 'kmh');
		expect(status.overdrive).toBe(true);
		expect(status.dragLimited).toBe(false);
		expect(status.badgeKey).toBe('status.overdrive');
		expect(status.ecoShift).toBe(true);
		expect(status.display).toBeCloseTo(342.8, 5);
	});

	it('expresses the wall speed in the active display unit', () => {
		const status = classifyGearVmax(FIRST_OVER_WALL, 190, WALL_KMH, FIRST_OVER_WALL, 'mph');
		expect(status.display).toBeCloseTo(WALL_KMH / 1.609344, 4);
		expect(status.badgeKey).toBe('status.wall');
	});

	it('falls back to plain theoretical values when the aero layer is disabled', () => {
		const below = classifyGearVmax(1, 120.5, null, null, 'kmh');
		const above = classifyGearVmax(FIRST_OVER_WALL + 1, 342.8, null, null, 'kmh');
		expect(below.badgeKey).toBeNull();
		expect(below.ecoShift).toBe(false);
		expect(above.badgeKey).toBeNull();
		expect(above.overdrive).toBe(false);
		expect(above.ecoShift).toBe(false);
		expect(above.display).toBeCloseTo(342.8, 5);
	});

	it('leaves every gear clean when no gear reaches the wall', () => {
		const status = classifyGearVmax(2, 210, WALL_KMH, null, 'kmh');
		expect(status.badgeKey).toBeNull();
		expect(status.display).toBeCloseTo(210, 5);
	});
});

describe('formatGearAdvisory', () => {
	it('keeps a plain RPM target when the optimal shift is below the limiter', () => {
		const advisory = formatGearAdvisory(6500, false, false);
		expect(advisory.text).toBe('6500 rpm');
		expect(advisory.badgeKey).toBeNull();
		expect(advisory.eco).toBe(false);
	});

	it('badges an optimal shift that already sits on the limiter', () => {
		const advisory = formatGearAdvisory(7200, true, false);
		expect(advisory.text).toBe('7200 LIMIT');
		expect(advisory.badgeKey).toBe('status.redline');
		expect(advisory.eco).toBe(false);
	});

	it('replaces the RPM number with the eco verdict for overdrive gears', () => {
		const advisory = formatGearAdvisory(7200, true, true);
		expect(advisory.text).toBe(t('status.eco'));
		expect(advisory.eco).toBe(true);
		expect(advisory.badgeKey).toBeNull();
	});

	it('renders a dash when there is no shift point', () => {
		const advisory = formatGearAdvisory(null, false, false);
		expect(advisory.text).toBe('-');
		expect(advisory.badgeKey).toBeNull();
	});
});
