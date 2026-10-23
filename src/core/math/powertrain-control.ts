/**
 * @file powertrain-control.ts
 * @brief Fuel-cut hysteresis and per-gear transmission interruption.
 */
export interface LimiterState {
	/** True until engine speed falls below the bounce reset threshold. */
	cut: boolean;
}

/**
 * @brief Resolve limiter fuel cut; bounce resumes 150 RPM below the limit.
 * @param state Mutable limiter latch owned by a simulation.
 * @param rpm Wheel-implied RPM.
 * @param redline Fuel-cut threshold.
 * @param mode Hard cut or hysteretic bounce.
 * @return Torque multiplier, zero while fuel is cut.
 */
export const limiterMultiplier = (state: LimiterState, rpm: number, redline: number, mode: 'hard' | 'bounce' = 'hard'): number => {
	if (mode === 'hard') {
		state.cut = rpm >= redline;
	} else if (rpm >= redline) {
		state.cut = true;
	} else if (rpm <= redline - 150) {
		state.cut = false;
	}
	return state.cut ? 0 : 1;
};

/**
 * @brief Select delay for the departing gear with legacy global fallback.
 * @param gear Zero-based departing gear.
 * @param times Per-gear delays.
 * @param global Legacy delay, undefined selects the gearbox default.
 * @param gearbox Synchromesh or dog engagement.
 * @return Finite delay in [0, 3] seconds.
 */
export const gearShiftTimeS = (gear: number, times?: number[], global?: number, gearbox: 'synchro' | 'dog' = 'synchro'): number => {
	const override = times?.[gear];
	const value = Number.isFinite(override) ? override as number
		: Number.isFinite(global) ? global as number : gearbox === 'dog' ? 0.08 : 0.3;
	return Math.min(3, Math.max(0, value));
};
