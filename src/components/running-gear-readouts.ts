/**
 * @file running-gear-readouts.ts
 * @brief Live readouts under the running-gear card: downforce and coast lockup.
 */
import { state } from '../core/state/app-state';
import { effectiveCircumferenceM, parseTire } from '../core/math/tire-math';
import { activeEngineCurve } from '../core/state/engine-curve';
import { criticalCoastLockupSpeed, downforceN } from '../core/math/dynamics-math';
import { getUnitLabel } from '../core/units/unit-utils';

/** Reference speed for the downforce readout in km/h. */
const DOWNFORCE_REF_KMH = 200;

/**
 * @brief Refresh every running-gear readout from current state.
 * @brief Called from the render entry so preset, share and inputs stay live.
 * @param none No parameters, reads the shared store.
 * @return void
 */
export const updateRunningGearReadouts = (): void => {
	updateDownforceReadout();
	updateCoastLockupReadout();
};

/**
 * @brief Write the downforce value at the reference speed.
 * @brief Uses the primary lift coefficient and reference area inputs.
 * @return void
 */
const updateDownforceReadout = (): void => {
	const el = document.getElementById('rg-downforce-val');
	if (!el) {
		return;
	}
	const rg = state.runningGear;
	const n = downforceN(rg.liftCoefficient ?? 0, rg.liftReferenceAreaM2 ?? 0, DOWNFORCE_REF_KMH);
	el.textContent = `${Math.round(n).toLocaleString('en-US')} N`;
};

/**
 * @brief Write the lowest engine-braking lockup speed across gears.
 * @brief First speed where closed-throttle drag exceeds the coast-lock grip
 * of the driven axle in any gear; em-dash when no gear ever locks.
 * @return void
 */
const updateCoastLockupReadout = (): void => {
	const el = document.getElementById('rg-coast-val');
	if (!el) {
		return;
	}
	const tire = parseTire(state.primaryTire);
	const curve = activeEngineCurve();
	if (!tire || !curve || state.gears.length === 0) {
		el.textContent = '—';
		return;
	}
	const speeds = criticalCoastLockupSpeed(
		state.gears,
		state.primaryFd,
		effectiveCircumferenceM(tire, state.rollingFactor),
		curve,
		state.drivetrainEff,
		state.runningGear,
		state.vehicleMassKg,
		state.unit,
	);
	let best: number | null = null;
	let bestGear = 0;
	speeds.forEach((v, idx) => {
		if (v !== null && (best === null || v < best)) {
			best = v;
			bestGear = idx + 1;
		}
	});
	el.textContent = best === null ? '—' : `${(best as number).toFixed(0)} ${getUnitLabel(state.unit)} (G${bestGear})`;
};
