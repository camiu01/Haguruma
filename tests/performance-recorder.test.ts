/**
 * @file performance-recorder.test.ts
 * @brief GPS lifecycle gates and stale-callback privacy regression checks.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PerformanceRecorder } from '../src/services/hardware/performance-recorder';

afterEach(() => vi.restoreAllMocks());

/**
 * @brief Create a deterministic GPS watch and observer harness.
 * @param none No parameters.
 * @return Recorder, watch callbacks and observer spies.
 */
const harness = () => {
	const callbacks: PositionCallback[] = [];
	const clearWatch = vi.fn();
	const geo: Geolocation = {
		getCurrentPosition: vi.fn(), clearWatch,
		watchPosition: (callback) => { callbacks.push(callback); return callbacks.length; },
	};
	const observers = { onSamples: vi.fn(), onStatus: vi.fn(), onStop: vi.fn() };
	return { recorder: new PerformanceRecorder(geo, observers), callbacks, clearWatch, ...observers };
};

/**
 * @brief Construct a complete browser GPS fix, including unwanted coordinates.
 * @param timestamp Milliseconds.
 * @param speed Metres per second.
 * @param accuracy Metres.
 * @return Mock browser fix.
 */
const fix = (timestamp: number, speed = 0, accuracy = 5): GeolocationPosition => ({
	timestamp, coords: { speed, accuracy, latitude: 45, longitude: 9, altitude: null, altitudeAccuracy: null, heading: null,
		toJSON: () => ({}) }, toJSON: () => ({}),
});

describe('performance recorder lifecycle', () => {
	it('does not erase a saved session when stopped without an armed watch', () => {
		const h = harness();
		h.recorder.stop();
		expect(h.onStop).not.toHaveBeenCalled();
	});
	it('arms only once and discards callbacks after stop or rearm', () => {
		const h = harness();
		expect(h.recorder.start()).toBe(true);
		expect(h.recorder.start()).toBe(false);
		h.recorder.stop();
		h.callbacks[0](fix(Date.now()));
		expect(h.recorder.samples).toEqual([]);
		h.recorder.start();
		h.callbacks[0](fix(Date.now()));
		expect(h.recorder.samples).toEqual([]);
		expect(h.clearWatch).toHaveBeenCalledWith(1);
	});
	it('retains only speed, time and accuracy channels', () => {
		const h = harness();
		h.recorder.start();
		h.callbacks[0](fix(Date.now()));
		expect(h.recorder.samples).toEqual([{ timeS: 0, speedKmh: 0, accuracyM: 5 }]);
	});
	it('rejects rolling starts, low accuracy, stale and future fixes', () => {
		const h = harness();
		h.recorder.start();
		const now = Date.now();
		for (const position of [fix(now, 10), fix(now, 0, 30), fix(now - 3000), fix(now + 3000)]) h.callbacks[0](position);
		expect(h.recorder.samples).toEqual([]);
	});
	it('stops rather than interpolating across a missing GPS interval', () => {
		const h = harness();
		vi.spyOn(Date, 'now').mockReturnValue(10000);
		h.recorder.start();
		h.callbacks[0](fix(10000));
		vi.spyOn(Date, 'now').mockReturnValue(14000);
		h.callbacks[0](fix(14000, 1));
		expect(h.recorder.recording).toBe(false);
		expect(h.onStatus).toHaveBeenLastCalledWith('timer.gap');
		expect(h.onStop).toHaveBeenCalledTimes(1);
	});
});
