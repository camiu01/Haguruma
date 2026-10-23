/**
 * @file crosshair-tooltip.test.ts
 * @brief Pure readout tests for the free graph hover tooltip.
 *
 * `gripReadout` answers what the tires can hold at the cursor speed and
 * whether the first reachable gear already asks for more force than that;
 * `wheelPowerReadout` reports the wheel power the drivetrain makes there from
 * the same max-over-gears sample the power layer draws.
 */
import { describe, expect, it } from 'vitest';
import { defaultRunningGear, defaultState } from '../src/core/state/app-state';
import { activeEngineCurve } from '../src/core/state/engine-curve';
import { availableWheelKw } from '../src/core/math/aero-math';
import { calculateSpeed } from '../src/core/math/speed-math';
import { effectiveCircumferenceM, parseTire } from '../src/core/math/tire-math';
import { buildPlotFrame } from '../src/services/graph/svg-frame';
import { gripReadout, wheelPowerReadout, type GearHit } from '../src/services/graph/crosshair-tooltip';
import type { CrosshairContext, CrosshairGrip } from '../src/services/graph/graph-crosshair';

/** First reachable gear used by the reachable-gear cases. */
const REACHABLE: GearHit = { rpm: 4000, ratio: 1 };

/** Grip inputs built on the default chassis and a valid engine curve. */
const gripInputs = (patch: Partial<CrosshairGrip> = {}): CrosshairGrip => ({
	gear: defaultRunningGear,
	massKg: 1300,
	curve: activeEngineCurve(),
	eff: 0.85,
	...patch,
});

/** Rolling circumference of the default tire. */
const tire = parseTire(defaultState.primaryTire);
const circM = effectiveCircumferenceM(tire as NonNullable<typeof tire>, defaultState.rollingFactor);

/** Speed at which the default top gear sits on its peak-power anchor. */
const peakPowerSpeed = calculateSpeed(
	6500,
	defaultState.gears[defaultState.gears.length - 1],
	defaultState.primaryFd,
	circM,
	'kmh',
);

/** Crosshair context of the default setup, overridable per power case. */
const contextInputs = (patch: Partial<CrosshairContext> = {}): CrosshairContext => ({
	frame: buildPlotFrame(300, 8000),
	points: [],
	gears: defaultState.gears,
	finalDrive: defaultState.primaryFd,
	circM,
	redline: defaultState.primaryRedline,
	unit: 'kmh',
	snap: false,
	compare: null,
	grip: {
		gear: defaultRunningGear,
		massKg: defaultState.vehicleMassKg,
		curve: { redline: 7200, peakTorqueRpm: 4500, peakTorqueNm: 180, peakPowerRpm: 6500, peakPowerKw: 110, points: null },
		eff: defaultState.drivetrainEff,
	},
	power: { capKw: availableWheelKw(110, defaultState.drivetrainEff), unit: 'kw' },
	...patch,
});

describe('gripReadout', () => {
	it('returns null without an engine curve', () => {
		expect(gripReadout(gripInputs({ curve: null }), 'kmh', 2, 3.5, 100, REACHABLE)).toBeNull();
	});

	it('returns null without a reachable gear', () => {
		expect(gripReadout(gripInputs(), 'kmh', 2, 3.5, 100, null)).toBeNull();
	});

	it('returns null with unusable driveline geometry', () => {
		expect(gripReadout(gripInputs(), 'kmh', 0, 3.5, 100, REACHABLE)).toBeNull();
		expect(gripReadout(gripInputs(), 'kmh', 2, 0, 100, REACHABLE)).toBeNull();
	});

	it('splits the limit across the driven wheels', () => {
		const readout = gripReadout(gripInputs(), 'kmh', 2, 3.5, 100, REACHABLE);
		expect(readout).not.toBeNull();
		expect(readout?.limitN).toBeGreaterThan(0);
		expect(readout?.perWheelN).toBeCloseTo((readout?.limitN ?? 0) / 2, 6);
	});

	it('flags wheelspin only when the gear demand exceeds the limit', () => {
		const modest = gripReadout(gripInputs(), 'kmh', 2, 3.5, 100, { rpm: 4000, ratio: 1 });
		const aggressive = gripReadout(gripInputs(), 'kmh', 2, 3.5, 100, { rpm: 4000, ratio: 10 });
		expect(modest?.isSpin).toBe(false);
		expect(aggressive?.isSpin).toBe(true);
	});

	it('follows the display unit when converting the cursor speed', () => {
		const kmh = gripReadout(gripInputs(), 'kmh', 2, 3.5, 100, REACHABLE);
		const mph = gripReadout(gripInputs(), 'mph', 2, 3.5, 100, REACHABLE);
		expect(kmh?.limitN).toBeGreaterThan(0);
		expect(mph?.limitN).toBeGreaterThan(0);
		expect(mph?.limitN).not.toBe(kmh?.limitN);
	});
});

describe('wheelPowerReadout', () => {
	it('reports the wheel-power budget at the peak-power speed', () => {
		const kw = wheelPowerReadout(contextInputs(), peakPowerSpeed);
		expect(kw).not.toBeNull();
		expect(kw as number).toBeCloseTo(availableWheelKw(110, defaultState.drivetrainEff), 1);
	});

	it('keeps the declared budget as a hard ceiling', () => {
		const capped = contextInputs({ power: { capKw: 50, unit: 'kw' } });
		expect(wheelPowerReadout(capped, peakPowerSpeed)).toBeCloseTo(50, 1);
	});

	it('reads zero at standstill', () => {
		expect(wheelPowerReadout(contextInputs(), 0)).toBe(0);
	});

	it('returns null without an engine curve', () => {
		const withoutCurve = contextInputs({ grip: { ...contextInputs().grip, curve: null } });
		expect(wheelPowerReadout(withoutCurve, peakPowerSpeed)).toBeNull();
	});
});
