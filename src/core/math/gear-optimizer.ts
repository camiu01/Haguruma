/**
 * @file gear-optimizer.ts
 * @brief Heuristic gearset solver constrained by Vmax and shift-drop limits.
 * @brief Anchors top gear on the target straight-line speed at the rev
 * @brief limiter, spaces the lower gears geometrically, then runs a bounded
 * @brief coordinate descent over 0.01 steps penalizing drops past the allowed
 * @brief maximum. The result is a starting proposal, not a measured optimum.
 */

/** Solver input driving one optimization pass. */
export interface OptimizerInput {
	/** Forward gear count, 2-8. */
	gearCount: number;
	/** Rev limiter in RPM. */
	redline: number;
	/** Tire rolling circumference in metres. */
	circM: number;
	/** Final drive ratio. */
	fd: number;
	/** Target top speed in km/h for the tallest gear. */
	targetTopSpeedKmh: number;
	/** Maximum allowed rpm drop per upshift, 0.05-0.6. */
	maxDrop: number;
}

/** Solver output: proposed ratios with per-shift diagnostics. */
export interface OptimizedGearset {
	/** Proposed ratios shortest-first. */
	ratios: number[];
	/** Rpm drop fraction per upshift. */
	drops: number[];
	/** Tallest-gear speed at the limiter in km/h. */
	topSpeedKmh: number;
	/** True when every shift respects maxDrop. */
	withinLimits: boolean;
}

/** Discrete search step for the coordinate descent. */
const SEARCH_STEP = 0.01;

/** Descent passes over the gear vector. */
const SEARCH_PASSES = 40;

/** Widest ratio the solver will propose. */
const RATIO_MAX = 6;

/** Tallest ratio the solver will propose. */
const RATIO_MIN = 0.4;

/**
 * @brief Validate one optimizer input.
 * @param input Candidate solver input.
 * @return True when every field sits inside its physical range.
 */
const validInput = (input: OptimizerInput): boolean => {
	return (
		Number.isInteger(input.gearCount) && input.gearCount >= 2 && input.gearCount <= 8 &&
		Number.isFinite(input.redline) && input.redline >= 1000 &&
		Number.isFinite(input.circM) && input.circM > 0 &&
		Number.isFinite(input.fd) && input.fd > 0 &&
		Number.isFinite(input.targetTopSpeedKmh) && input.targetTopSpeedKmh > 20 &&
		Number.isFinite(input.maxDrop) && input.maxDrop >= 0.05 && input.maxDrop <= 0.6
	);
};

/**
 * @brief Tallest-gear total ratio placing the target speed at the limiter.
 * @param input Validated solver input.
 * @return Total ratio (gear x fd) for the target Vmax.
 */
const topTotalRatio = (input: OptimizerInput): number => {
	return (input.redline * input.circM * 60) / (input.targetTopSpeedKmh * 1000);
};

/**
 * @brief Score one candidate gear vector.
 * @brief Penalizes drops past maxDrop, rewards tight spacing and closeness of
 * @brief the tallest-gear Vmax to the target.
 * @param ratios Candidate ratios shortest-first.
 * @param input Validated solver input.
 * @return Cost, lower is better.
 */
const scoreRatios = (ratios: number[], input: OptimizerInput): number => {
	let cost = 0;
	for (let idx = 0; idx < ratios.length - 1; idx += 1) {
		const drop = 1 - ratios[idx + 1] / ratios[idx];
		if (drop > input.maxDrop) {
			cost += (drop - input.maxDrop) * 100;
		}
		cost += Math.abs(drop - input.maxDrop * 0.8);
	}
	const topSpeed = (input.redline * input.circM * 60) / (ratios[ratios.length - 1] * input.fd * 1000);
	cost += Math.abs(topSpeed - input.targetTopSpeedKmh) / input.targetTopSpeedKmh;
	return cost;
};

/**
 * @brief Clamp one ratio into the solver search window.
 * @param ratio Candidate ratio.
 * @return Ratio within [RATIO_MIN, RATIO_MAX].
 */
const clampRatio = (ratio: number): number => {
	return Math.min(RATIO_MAX, Math.max(RATIO_MIN, ratio));
};

/**
 * @brief Run the heuristic gearset solver.
 * @param input Gear count, limiter, tire, fd, Vmax target and drop limit.
 * @return Proposed ratios with diagnostics, or null on invalid input.
 */
export const optimizeGearset = (input: OptimizerInput): OptimizedGearset | null => {
	if (!validInput(input)) {
		return null;
	}
	const topGear = clampRatio(topTotalRatio(input) / input.fd);
	const firstGear = clampRatio(topGear * (1 + input.maxDrop * 0.8) ** (input.gearCount - 1));
	const step = (firstGear / topGear) ** (1 / (input.gearCount - 1));
	let ratios: number[] = [];
	for (let idx = 0; idx < input.gearCount; idx += 1) {
		ratios.push(clampRatio(firstGear / step ** idx));
	}
	let best = scoreRatios(ratios, input);
	for (let pass = 0; pass < SEARCH_PASSES; pass += 1) {
		for (let idx = 0; idx < ratios.length; idx += 1) {
			for (const dir of [-1, 1]) {
				const trial = [...ratios];
				trial[idx] = clampRatio(trial[idx] + dir * SEARCH_STEP);
				const ordered = [...trial].sort((a, b) => b - a);
				const score = scoreRatios(ordered, input);
				if (score < best) {
					best = score;
					ratios = ordered;
				}
			}
		}
	}
	const rounded = ratios.map((ratio) => Math.round(ratio * 100) / 100);
	const drops = rounded.slice(1).map((ratio, idx) => Math.round((1 - ratio / rounded[idx]) * 1000) / 1000);
	const topSpeedKmh = Math.round(((input.redline * input.circM * 60) / (rounded[rounded.length - 1] * input.fd * 1000)) * 10) / 10;
	return {
		ratios: rounded,
		drops,
		topSpeedKmh,
		withinLimits: drops.every((drop) => drop <= input.maxDrop + 1e-9),
	};
};
