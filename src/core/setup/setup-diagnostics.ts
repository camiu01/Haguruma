/**
 * @file setup-diagnostics.ts
 * @brief Cross-axle and contradictory-adjustment setup warnings.
 *
 * The per-tire tread pattern (pressure from center-versus-edge spread, camber
 * from inner-versus-outer spread) is owned by `pyrometer-math.ts` and is not
 * repeated here. This module covers the two checks that need more than one
 * tire or more than one proposed change: an axle running much hotter than the
 * other, and same-axle roll-stiffness changes that pull in opposite
 * directions.
 */
import type { DictKey } from '../i18n/dictionaries';

/** One tire's tread temperatures in Celsius, inner / center / outer. */
export interface TireTemperatures {
	/** Inner shoulder temperature in Celsius. */
	inner: number;
	/** Tread center temperature in Celsius. */
	center: number;
	/** Outer shoulder temperature in Celsius. */
	outer: number;
}

/** Axle temperature gap that is treated as an imbalance, in Celsius. */
export const AXLE_IMBALANCE_C = 15;

/** One proposed setup adjustment. */
export interface SetupAdjustment {
	/** Axle the change applies to. */
	axle: 'front' | 'rear';
	/** Component being changed. */
	component: 'spring' | 'arb';
	/** Direction of the change. */
	direction: 'stiffer' | 'softer';
}

/**
 * @brief Check one tire for plausible tread temperatures.
 * @param tire Tire to check.
 * @return True when every zone is a finite temperature in Celsius.
 */
const isUsable = (tire: TireTemperatures): boolean => {
	return [tire.inner, tire.center, tire.outer].every((value) => Number.isFinite(value) && value >= 0 && value <= 200);
};

/**
 * @brief Flag axle temperature imbalance that can accompany unstable grip.
 * @brief A hotter axle is usually the one doing more work, so a large gap is
 * @brief worth reviewing before changing springs or bars.
 * @param tires Four tires ordered FL, FR, RL, RR.
 * @return Diagnostic keys; empty when no large imbalance exists.
 */
export const diagnoseAxleTemperatures = (tires: TireTemperatures[]): DictKey[] => {
	if (tires.length !== 4 || tires.some((tire) => !isUsable(tire))) {
		return [];
	}
	const mean = (tire: TireTemperatures): number => (tire.inner + tire.center + tire.outer) / 3;
	const front = (mean(tires[0]) + mean(tires[1])) / 2;
	const rear = (mean(tires[2]) + mean(tires[3])) / 2;
	if (rear - front > AXLE_IMBALANCE_C) {
		return ['diag.rearHot'];
	}
	if (front - rear > AXLE_IMBALANCE_C) {
		return ['diag.frontHot'];
	}
	return [];
};

/**
 * @brief Warn when same-axle roll-stiffness changes pull in opposite directions.
 * @brief Stiffening a spring while softening the bar on the same axle makes the
 * @brief net effect unpredictable, so those axles are reported for a
 * @brief one-change-at-a-time review.
 * @param changes Proposed spring and bar adjustments.
 * @return Axles needing a review, front first, empty when the plan is coherent.
 */
export const conflictingAdjustments = (changes: SetupAdjustment[]): ('front' | 'rear')[] => {
	return (['front', 'rear'] as const).filter((axle) =>
		changes.some(
			(a) => a.axle === axle && changes.some((b) => b.axle === axle && a.component !== b.component && a.direction !== b.direction),
		),
	);
};
