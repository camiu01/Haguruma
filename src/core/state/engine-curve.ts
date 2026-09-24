/**
 * @file engine-curve.ts
 * @brief Build the validated engine curve from the shared state.
 */
import { state } from './app-state';
import { validateCurve, type EngineCurve } from '../math/engine-curve-core';

/**
 * @brief Assemble the active engine curve from state anchors or dyno points.
 * @brief One construction point for every consumer (table, graph, tooltip,
 * @brief cruise, acceleration solver) so custom CSV curves propagate.
 * @return Validated curve, or null when the anchors are unusable.
 */
export const activeEngineCurve = (): EngineCurve | null => {
	return validateCurve({
		redline: state.primaryRedline,
		peakTorqueRpm: state.peakTorqueRpm,
		peakTorqueNm: state.peakTorqueNm,
		peakPowerRpm: state.peakPowerRpm,
		peakPowerKw: state.enginePowerKw,
		points: state.torqueCurvePoints,
	});
};
