/**
 * @file graph-crosshair-context.ts
 * @brief Typed crosshair data and construction from primary/secondary physics state.
 */
import type { PlotFrame, PowerUnit, RunningGear, SpeedUnit } from '../../core/models';
import type { EngineCurve } from '../../core/math/engine-curve-core';
import type { ShiftPoint } from './svg-shift-drops';
import { state, defaultRunningGear } from '../../core/state/app-state';
import { activeEngineCurve } from '../../core/state/engine-curve';
import { availableWheelKw } from '../../core/math/aero-math';

export interface CrosshairCompare {
	gears: number[];
	finalDrive: number;
	circM: number;
	redline: number;
}

export interface CrosshairGrip {
	mapped?: boolean;
	gear: RunningGear;
	massKg: number;
	curve: EngineCurve | null;
	eff: number;
}

export interface CrosshairPower {
	capKw: number;
	unit: PowerUnit;
}

export interface CrosshairContext {
	frame: PlotFrame;
	points: ShiftPoint[];
	gears: number[];
	finalDrive: number;
	circM: number;
	redline: number;
	unit: SpeedUnit;
	snap: boolean;
	compare: CrosshairCompare | null;
	grip: CrosshairGrip;
	power: CrosshairPower;
}

/**
 * @brief Build the crosshair context using the same mapped wheel-power model as the plot.
 * @param frame Plot geometry.
 * @param points Shift-point snap targets.
 * @param circM Primary rolling circumference.
 * @param compare Secondary geometry when enabled.
 * @return Complete cursor context.
 */
export const buildCrosshairContext = (
	frame: PlotFrame, points: ShiftPoint[], circM: number, compare: CrosshairCompare | null,
): CrosshairContext => ({
	frame, points, circM, gears: state.gears, finalDrive: state.primaryFd,
	redline: state.primaryRedline, unit: state.unit, snap: state.graphLayers.snapHud, compare,
	grip: { gear: state.runningGear ?? defaultRunningGear, massKg: state.vehicleMassKg,
		curve: activeEngineCurve(), eff: state.drivetrainEff, mapped: state.dynamics.efficiencyMap },
	power: { capKw: availableWheelKw(state.enginePowerKw, state.drivetrainEff), unit: state.powerUnit },
});
