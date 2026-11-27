/**
 * @file pyrometer-axle-math.ts
 * @brief Four-corner pyrometer analysis: per-corner camber plus chassis balance.
 *
 * The single-tire 3-zone rules (`pyrometer-math.ts`) still decide camber and
 * pressure per corner. This module adds what only a full set of readings can
 * show: which axle and which side the car overworks, and whether a hot rear
 * axle points at oversteer / drift instability. Thresholds are engineering
 * heuristics, not manufacturer data.
 */
import { camberAdvice, pressureAdvice, type CamberAdvice, type PressureAdvice } from './pyrometer-math';

/** Inner / centre / outer tread temperatures of one tire, in °C. */
export interface CornerTemps {
	inner: number;
	center: number;
	outer: number;
}

/** The four corners of the car. */
export type Corner = 'fl' | 'fr' | 'rl' | 'rr';

/** Readings for all four corners. */
export type CornerSet = Record<Corner, CornerTemps>;

/** Axle balance verdict. */
export type AxleBalance = 'front-hot' | 'rear-hot' | 'balanced';

/** Side balance verdict. */
export type SideBalance = 'left-hot' | 'right-hot' | 'balanced';

/** Full four-corner diagnosis. */
export interface AxleDiagnosis {
	/** Per-corner camber and pressure advice. */
	corners: Record<Corner, { camber: CamberAdvice; pressure: PressureAdvice }>;
	/** Rear mean minus front mean, °C. */
	frontRearDeltaC: number;
	/** Right mean minus left mean, °C. */
	leftRightDeltaC: number;
	/** Which axle runs hotter beyond the tolerance. */
	axle: AxleBalance;
	/** Which side runs hotter beyond the tolerance. */
	side: SideBalance;
	/** Hot rear axle with the outer rear edges hotter than the fronts: oversteer / drift risk. */
	driftRisk: boolean;
}

/** Axle or side temperature gap that counts as an imbalance, °C. */
export const BALANCE_TOLERANCE_C = 8;

/** Corner order used by the UI grid and the diagnosis. */
export const CORNERS: Corner[] =['fl', 'fr', 'rl', 'rr'];

/**
 * @brief Mean tread temperature of one tire.
 * @param t Three-zone readings.
 * @return Mean in °C.
 */
export const cornerMean = (t: CornerTemps): number => (t.inner + t.center + t.outer) / 3;

/**
 * @brief Classify a signed gap against the balance tolerance.
 * @param delta Signed gap in °C.
 * @param tolerance Dead band in °C.
 * @return -1, 0 or 1.
 */
const sign = (delta: number, tolerance: number): number => (Math.abs(delta) <= tolerance ? 0 : Math.sign(delta));

/**
 * @brief Diagnose all four corners and the chassis balance.
 * @param set Readings for all four corners.
 * @param hotPressureBar Hot pressure used for every corner's pressure advice.
 * @param tolerance Axle/side dead band in °C.
 * @return Per-corner advice plus axle, side and drift verdicts.
 */
export const diagnoseAxles = (set: CornerSet, hotPressureBar: number, tolerance = BALANCE_TOLERANCE_C): AxleDiagnosis => {
	const mean = (a: Corner, b: Corner): number => (cornerMean(set[a]) + cornerMean(set[b])) / 2;
	const frontRearDeltaC = mean('rl', 'rr') - mean('fl', 'fr');
	const leftRightDeltaC = mean('fr', 'rr') - mean('fl', 'rl');
	const axleSign = sign(frontRearDeltaC, tolerance);
	const sideSign = sign(leftRightDeltaC, tolerance);
	const rearOuter = (set.rl.outer + set.rr.outer) / 2;
	const frontOuter = (set.fl.outer + set.fr.outer) / 2;
	const corners = {} as AxleDiagnosis['corners'];
	for (const c of CORNERS) {
		const t = set[c];
		corners[c] = { camber: camberAdvice(t.inner, t.outer), pressure: pressureAdvice(t.center, t.inner, t.outer, hotPressureBar) };
	}
	return {
		corners,
		frontRearDeltaC,
		leftRightDeltaC,
		axle: axleSign > 0 ? 'rear-hot' : axleSign < 0 ? 'front-hot' : 'balanced',
		side: sideSign > 0 ? 'right-hot' : sideSign < 0 ? 'left-hot' : 'balanced',
		driftRisk: axleSign > 0 && rearOuter > frontOuter,
	};
};
