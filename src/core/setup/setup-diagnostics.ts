/**
 * @file setup-diagnostics.ts
 * @brief Heuristic pyrometer diagnosis and contradictory-adjustment warnings.
 */
import type { DictKey } from '../i18n/dictionaries';

export interface TireTemperatures { inner: number; center: number; outer: number }

/**
 * @brief Classify a tire's tread-temperature pattern, not a calibrated setup prescription.
 * @param tire Inner/center/outer temperatures in Celsius.
 * @return Localized diagnostic keys.
 */
export const diagnoseTire = (tire: TireTemperatures): DictKey[] => {
	if (![tire.inner, tire.center, tire.outer].every((value) => Number.isFinite(value) && value >= 0 && value <= 200)) {
		return ['lab.invalid'];
	}
	const results: DictKey[] = [];
	const shoulders = (tire.inner + tire.outer) / 2;
	if (tire.center - shoulders > 5) results.push('diag.pressureHigh');
	if (shoulders - tire.center > 5) results.push('diag.pressureLow');
	if (tire.inner - tire.outer > 12) results.push('diag.camberHigh');
	if (tire.outer - tire.inner > 8) results.push('diag.camberLow');
	return results.length > 0 ? results : ['diag.balanced'];
};

/**
 * @brief Flag axle temperature imbalance that can accompany unstable grip.
 * @param tires Four tires ordered FL, FR, RL, RR.
 * @return Diagnostic keys; empty if no large axle imbalance exists.
 */
export const diagnoseAxleTemperatures = (tires: TireTemperatures[]): DictKey[] => {
	if (tires.length !== 4 || tires.some((tire) => Object.values(tire).some((value) => !Number.isFinite(value) || value < 0 || value > 200))) return [];
	const mean = (tire: TireTemperatures): number => (tire.inner + tire.center + tire.outer) / 3;
	const front = (mean(tires[0]) + mean(tires[1])) / 2;
	const rear = (mean(tires[2]) + mean(tires[3])) / 2;
	if (rear - front > 15) return ['diag.rearHot'];
	if (front - rear > 15) return ['diag.frontHot'];
	return [];
};

export interface SetupAdjustment {
	axle: 'front' | 'rear';
	component: 'spring' | 'arb';
	direction: 'stiffer' | 'softer';
}

/**
 * @brief Warn when same-axle roll-stiffness changes pull in opposite directions.
 * @param changes Proposed spring and ARB adjustments.
 * @return Axles requiring a one-change-at-a-time review.
 */
export const conflictingAdjustments = (changes: SetupAdjustment[]): ('front' | 'rear')[] => {
	return (['front', 'rear'] as const).filter((axle) =>
		changes.some((a) => a.axle === axle && changes.some((b) => b.axle === axle && a.component !== b.component && a.direction !== b.direction)));
};
