/**
 * @file performance-recorder.ts
 * @brief Bounded foreground GPS recording with cancellable callback generations.
 */
import type { PerformanceSample } from '../../core/math/performance-session';
import type { DictKey } from '../../core/i18n/dictionaries';

interface RecorderCallbacks {
	onSamples: (samples: PerformanceSample[]) => void;
	onStatus: (key: DictKey) => void;
	onStop: (samples: PerformanceSample[]) => void;
}

export class PerformanceRecorder {
	samples: PerformanceSample[] = [];
	private watch: number | null = null;
	private origin: number | null = null;
	private generation = 0;

	/**
	 * @brief Bind browser acquisition and UI-independent observers.
	 * @param geo Browser GPS source, undefined when unsupported.
	 * @param callbacks Result, status and stopped observers.
	 * @return Recorder.
	 */
	constructor(private geo: Geolocation | undefined, private callbacks: RecorderCallbacks) {}

	/**
	 * @brief Report whether a watch is currently armed.
	 * @return True while acquisition is active.
	 */
	get recording(): boolean { return this.watch !== null; }

	/**
	 * @brief Arm one new run without exposing location coordinates.
	 * @param none No parameters.
	 * @return True when GPS acquisition starts.
	 */
	start(): boolean {
		if (this.recording) return false;
		if (!this.geo) { this.callbacks.onStatus('hardware.unsupported'); return false; }
		this.samples = []; this.origin = null;
		const generation = ++this.generation;
		this.callbacks.onStatus('timer.waiting');
		try {
			this.watch = this.geo.watchPosition(
				(position) => { if (generation === this.generation) this.receive(position); },
				() => {
					if (generation !== this.generation) return;
					this.stop(); this.callbacks.onStatus('timer.permission');
				}, { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 });
			return true;
		} catch { this.callbacks.onStatus('timer.permission'); return false; }
	}

	/**
	 * @brief Cancel pending callbacks and notify once, preserving older saved runs.
	 * @param none No parameters.
	 * @return void
	 */
	stop(): void {
		if (this.watch === null) return;
		this.geo?.clearWatch(this.watch);
		this.watch = null; this.generation += 1;
		this.callbacks.onStop(this.samples);
	}

	/**
	 * @brief Gate GPS precision, standstill, time continuity and recording bounds.
	 * @param position Browser fix; coordinates are deliberately discarded.
	 * @return void
	 */
	private receive(position: GeolocationPosition): void {
		const { speed, accuracy } = position.coords;
		if (speed === null || !Number.isFinite(speed) || speed < 0 || speed * 3.6 > 500
			|| !Number.isFinite(position.timestamp) || Math.abs(Date.now() - position.timestamp) > 2000
			|| !Number.isFinite(accuracy) || accuracy < 0 || accuracy > 15) {
			this.callbacks.onStatus('timer.accuracy'); return;
		}
		if (!this.samples.length && speed * 3.6 > 1) { this.callbacks.onStatus('timer.standstill'); return; }
		this.origin ??= position.timestamp;
		const timeS = (position.timestamp - this.origin) / 1000;
		const last = this.samples[this.samples.length - 1];
		if (last && timeS <= last.timeS) return;
		if (last && timeS - last.timeS > 2) {
			this.stop(); this.callbacks.onStatus('timer.gap'); return;
		}
		if (timeS > 120) { this.stop(); return; }
		this.samples.push({ timeS, speedKmh: speed * 3.6, accuracyM: accuracy });
		this.callbacks.onSamples(this.samples);
		if (this.samples.length >= 5000 || timeS >= 120) this.stop();
	}
}
