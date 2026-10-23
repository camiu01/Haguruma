/**
 * @file traction-margin.ts
 * @brief Per-gear excess force at peak torque for the breakdown table.
 */
import { state } from '../core/state/app-state';
import { activeEngineCurve } from '../core/state/engine-curve';
import { speedKmh } from '../core/math/speed-math';
import { dynamicRadiusM, tractiveForceAt } from '../core/math/traction-math';
import { maxDriveForceAtSpeed } from '../core/math/dynamics-math';
import { t } from '../core/i18n/language';
import { mappedEfficiency } from '../core/math/powertrain-math';

/**
 * @brief Add the owned column heading once during shell construction.
 * @param none No parameters.
 * @return void
 */
export const injectTractionMarginHeading = (): void => {
	const row = document.getElementById('gear-breakdown-body')?.closest('table')?.tHead?.rows[0];
	if (!row) return;
	const header = document.createElement('th');
	header.className = 'traction-margin';
	header.scope = 'col';
	header.dataset.i18n = 'graph.tractionMargin';
	header.textContent = t('graph.tractionMargin');
	row.append(header);
};

/**
 * @brief Append wheel force minus grip at peak torque, positive means excess.
 * @param row Table row.
 * @param ratio Forward gear ratio, null for reverse.
 * @param circM Effective circumference.
 * @return void
 */
export const appendTractionMargin = (row: HTMLElement, ratio: number | null, circM: number): void => {
	const cell = document.createElement('td');
	cell.className = 'traction-margin';
	const curve = activeEngineCurve();
	if (ratio === null || !curve) {
		cell.textContent = '—';
	} else {
		const speed = speedKmh(curve.peakTorqueRpm, ratio, state.primaryFd, circM);
		const efficiency = mappedEfficiency(state.simulation?.efficiencyMap, curve.peakTorqueRpm, 1, state.drivetrainEff);
		const force = tractiveForceAt(curve.peakTorqueRpm, ratio, state.primaryFd, dynamicRadiusM(circM), curve, efficiency);
		const limit = maxDriveForceAtSpeed(state.runningGear, state.vehicleMassKg, speed, force, 0).limitN;
		const excess = Math.round(force - limit);
		cell.textContent = `${excess >= 0 ? '+' : ''}${excess} N`;
	}
	row.append(cell);
};
