/**
 * @file graph-power-scene.ts
 * @brief Shared primary and secondary power-envelope construction from state.
 */
import { state } from '../../core/state/app-state';
import { activeEngineCurve, compEngineCurve } from '../../core/state/engine-curve';
import { availableWheelKw } from '../../core/math/aero-math';
import type { PlotFrame, SpeedUnit } from '../../core/models';
import { buildPowerEnvelope, type PowerEnvelope } from './svg-power';
import { primaryForceInput, comparisonForceInput } from '../../core/state/dynamics-input';

/**
 * @brief Sample one vehicle's power envelope with independent running-gear layout.
 * @param frame Plot geometry.
 * @param unit Speed display unit.
 * @param circM Rolling circumference.
 * @param secondary Select the comparison vehicle.
 * @return Available/required power samples and their crossing.
 */
const powerEnvelopeFor = (frame: PlotFrame, unit: SpeedUnit, circM: number, secondary: boolean): PowerEnvelope => {
	const slot = secondary ? comparisonForceInput() : primaryForceInput();
	return buildPowerEnvelope({
		frame, unit, circM, gears: slot?.gears ?? [], finalDrive: slot?.fd ?? 0,
		curve: secondary ? compEngineCurve() : activeEngineCurve(), eff: state.drivetrainEff,
		mappedLayout: state.dynamics.efficiencyMap ? slot?.runningGear.drivetrainLayout : undefined,
		capKw: availableWheelKw(secondary ? state.compPowerKw : state.enginePowerKw, state.drivetrainEff),
		massKg: slot?.massKg ?? 0, dragCd: slot?.cd ?? 0, frontalAreaM2: slot?.areaM2 ?? 0,
		crr: state.rollingCrr, gradePercent: state.roadGradePercent,
	});
};

/**
 * @brief Sample both power envelopes only while the layer is enabled.
 * @param frame Plot geometry.
 * @param unit Speed display unit.
 * @param circM Primary rolling circumference.
 * @param compareCircM Secondary circumference, null when comparison is hidden.
 * @return Primary and comparison power envelopes.
 */
export const powerEnvelopes = (
	frame: PlotFrame, unit: SpeedUnit, circM: number, compareCircM: number | null,
): { primary: PowerEnvelope | null; compare: PowerEnvelope | null } => {
	if (!state.graphLayers.powerCurve) return { primary: null, compare: null };
	return { primary: powerEnvelopeFor(frame, unit, circM, false),
		compare: compareCircM === null ? null : powerEnvelopeFor(frame, unit, compareCircM, true) };
};
