/**
 * @file pyrometer-math.ts
 * @brief Pure 3-zone tire pyrometer diagnostics: camber and hot-pressure advice.
 * @brief Temperatures are °C and pressures bar. Every spread is a signed °C
 * @brief delta where a positive value means the first named zone is hotter.
 */

/** Default tolerance in °C on the inner minus outer spread before camber is touched. */
export const CAMBER_TOLERANCE_C = 8;

/** Default tolerance in °C on the center minus edges spread before pressure is touched. */
export const PRESSURE_TOLERANCE_C = 6;

/** Hot-pressure change carried by one correction step, in bar. */
export const PRESSURE_STEP_BAR = 0.05;

/** Largest hot-pressure correction the tool will suggest, in bar. */
export const MAX_PRESSURE_STEP_BAR = 0.3;

/** Number of steps that saturates a correction at MAX_PRESSURE_STEP_BAR. */
export const MAX_PRESSURE_STEPS = 6;

/** Lowest hot pressure the tool will recommend bleeding down to, in bar. */
export const MIN_HOT_PRESSURE_BAR = 1;

/** Default half width of the working window around the target temperature, in °C. */
export const WINDOW_TOLERANCE_C = 15;

/** Camber verdict derived from the inner minus outer tread spread. */
export type CamberAdvice = 'more-negative' | 'less-negative' | 'balanced';

/** Pressure verdict plus the bar correction that should be applied. */
export interface PressureAdvice {
	/** Direction of the correction, 'balanced' when the centre is inside tolerance. */
	action: 'raise' | 'lower' | 'balanced';
	/** Absolute correction magnitude in bar, 0 when balanced. */
	deltaBar: number;
}

/** Working-window verdict derived from the three-zone mean temperature. */
export type WindowVerdict = 'cold' | 'optimal' | 'hot';

/**
 * @brief Signed tread spread between the two edges of the contact patch.
 * @brief Unit: °C. Sign: positive when the inner edge runs hotter.
 * @param innerC Inner edge tread temperature in °C.
 * @param outerC Outer edge tread temperature in °C.
 * @return innerC minus outerC in °C, positive for a hot inside shoulder.
 */
export const innerOuterSpread = (innerC: number, outerC: number): number => {
	return innerC - outerC;
};

/**
 * @brief Signed spread between the tread centre and the mean of the two edges.
 * @brief Unit: °C. Sign: positive when the centre is hotter than both edges.
 * @param centerC Centre tread temperature in °C.
 * @param innerC Inner edge tread temperature in °C.
 * @param outerC Outer edge tread temperature in °C.
 * @return centerC minus the edge mean in °C, positive for a hot centre.
 */
export const centerEdgeSpread = (centerC: number, innerC: number, outerC: number): number => {
	return centerC - (innerC + outerC) / 2;
};

/**
 * @brief Camber verdict from the inner minus outer tread spread.
 * @brief Unit: °C in, enum out. A hot inner edge means the tire already runs
 * @brief too much negative camber, so some must come back out; a hot outer
 * @brief edge wants more negative camber. The tolerance edges count as even.
 * @param innerC Inner edge tread temperature in °C.
 * @param outerC Outer edge tread temperature in °C.
 * @param toleranceC Absolute °C spread accepted as even, defaults to 8 °C.
 * @return 'less-negative' for a hot inner edge, 'more-negative' for a hot outer edge, 'balanced' inside the tolerance.
 */
export const camberAdvice = (
	innerC: number,
	outerC: number,
	toleranceC: number = CAMBER_TOLERANCE_C,
): CamberAdvice => {
	const spread = innerOuterSpread(innerC, outerC);
	if (spread > toleranceC) {
		return 'less-negative';
	}
	if (spread < -toleranceC) {
		return 'more-negative';
	}
	return 'balanced';
};

/**
 * @brief Hot-pressure verdict from the centre minus edges spread.
 * @brief Unit: °C in, bar out. A hot centre means the tire is over-inflated
 * @brief and wants less pressure, a cool centre means it is under-inflated and
 * @brief wants more. The correction grows one PRESSURE_STEP_BAR step per °C of
 * @brief deviation past the tolerance, saturates at MAX_PRESSURE_STEP_BAR and
 * @brief never bleeds the hot pressure below MIN_HOT_PRESSURE_BAR.
 * @param centerC Centre tread temperature in °C.
 * @param innerC Inner edge tread temperature in °C.
 * @param outerC Outer edge tread temperature in °C.
 * @param hotPressureBar Hot pressure currently set in the tire, in bar.
 * @param toleranceC Absolute °C spread accepted as even, defaults to 6 °C.
 * @return Action plus the absolute correction magnitude in bar, 0 when even.
 */
export const pressureAdvice = (
	centerC: number,
	innerC: number,
	outerC: number,
	hotPressureBar: number,
	toleranceC: number = PRESSURE_TOLERANCE_C,
): PressureAdvice => {
	const spread = centerEdgeSpread(centerC, innerC, outerC);
	const excessC = Math.abs(spread) - toleranceC;
	if (excessC <= 0) {
		return { action: 'balanced', deltaBar: 0 };
	}
	const action: PressureAdvice['action'] = spread > 0 ? 'lower' : 'raise';
	const wanted = Math.min(MAX_PRESSURE_STEPS, Math.max(1, Math.round(excessC)));
	const steps = action === 'lower' ? Math.min(wanted, bleedHeadroom(hotPressureBar)) : wanted;
	if (steps === 0) {
		return { action: 'balanced', deltaBar: 0 };
	}
	return { action, deltaBar: Number((steps * PRESSURE_STEP_BAR).toFixed(2)) };
};

/**
 * @brief Count the 0.05 bar steps a hot tire can still bleed down.
 * @brief Unit: bar in, step count out. The floor keeps the recommended hot
 * @brief pressure at or above MIN_HOT_PRESSURE_BAR.
 * @param hotPressureBar Hot pressure currently set in the tire, in bar.
 * @return Whole number of steps available before the pressure floor.
 */
const bleedHeadroom = (hotPressureBar: number): number => {
	return Math.floor(Math.max(0, hotPressureBar - MIN_HOT_PRESSURE_BAR) / PRESSURE_STEP_BAR);
};

/**
 * @brief Working-window verdict from the mean of the three tread zones.
 * @brief Unit: °C. The window spans targetC plus or minus windowC and both
 * @brief boundaries count as inside it.
 * @param innerC Inner edge tread temperature in °C.
 * @param centerC Centre tread temperature in °C.
 * @param outerC Outer edge tread temperature in °C.
 * @param targetC Target hot tread temperature in °C.
 * @param windowC Half width of the accepted window in °C, defaults to 15 °C.
 * @return 'cold' below the window, 'hot' above it, 'optimal' inside it.
 */
export const windowVerdict = (
	innerC: number,
	centerC: number,
	outerC: number,
	targetC: number,
	windowC: number = WINDOW_TOLERANCE_C,
): WindowVerdict => {
	const meanC = (innerC + centerC + outerC) / 3;
	if (meanC < targetC - windowC) {
		return 'cold';
	}
	if (meanC > targetC + windowC) {
		return 'hot';
	}
	return 'optimal';
};
