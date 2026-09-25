/**
 * @file comp-running-gear-events.ts
 * @brief Bind secondary comparison running-gear inputs to compRunningGear.
 *
 * Everything written here drives the dashed COMP grip curve on the graph
 * (comp mass + comp running gear); the primary drivetrain efficiency input
 * is intentionally untouched because the comparison shares it.
 */
import { state } from '../../core/state/app-state';
import type { DrivetrainLayout, RunningGear } from '../../core/models';
import { DIFF_PRESETS, LSD_MODEL_IDS, modelIdFromType } from '../../config/diff-presets';
import { applyDiffModelTo, bindNum } from './running-gear-events';
import type { ElementRefs } from '../dom/element-refs';

/**
 * Comparison running-gear DOM handles resolved by id.
 * @brief Static crg-* controls inside the comparison card.
 */
interface CompRgRefs {
	layout: HTMLSelectElement;
	diff: HTMLSelectElement;
	bias: HTMLInputElement;
	coast: HTMLInputElement;
	weight: HTMLInputElement;
	cog: HTMLInputElement;
	wheelbase: HTMLInputElement;
	track: HTMLInputElement;
	springF: HTMLInputElement;
	springR: HTMLInputElement;
	lift: HTMLInputElement;
	liftArea: HTMLInputElement;
	liftShare: HTMLInputElement;
	latg: HTMLInputElement;
	latgVal: HTMLElement;
}

/**
 * @brief Resolve the static crg-* controls, failing fast like element-refs.
 * @return Typed handles for every comparison running-gear input.
 */
const getCompRgRefs = (): CompRgRefs => {
	const get = <T extends HTMLElement>(id: string): T => {
		const el = document.getElementById(id);
		if (!el) {
			throw new Error(`Missing required element: ${id}`);
		}
		return el as T;
	};
	return {
		layout: get<HTMLSelectElement>('crg-layout'),
		diff: get<HTMLSelectElement>('crg-diff'),
		bias: get<HTMLInputElement>('crg-bias'),
		coast: get<HTMLInputElement>('crg-coast'),
		weight: get<HTMLInputElement>('crg-weight'),
		cog: get<HTMLInputElement>('crg-cog'),
		wheelbase: get<HTMLInputElement>('crg-wheelbase'),
		track: get<HTMLInputElement>('crg-track'),
		springF: get<HTMLInputElement>('crg-spring-f'),
		springR: get<HTMLInputElement>('crg-spring-r'),
		lift: get<HTMLInputElement>('crg-lift'),
		liftArea: get<HTMLInputElement>('crg-lift-area'),
		liftShare: get<HTMLInputElement>('crg-lift-share'),
		latg: get<HTMLInputElement>('crg-latg'),
		latgVal: get<HTMLElement>('crg-latg-val'),
	};
};

/**
 * @brief Show lock inputs only for clutch-LSD catalog models.
 * @param els Comparison running-gear handles.
 * @return void
 */
const applyCompRgVisibility = (els: CompRgRefs): void => {
	const biasWrap = document.getElementById('crg-bias-wrap');
	const coastWrap = document.getElementById('crg-coast-wrap');
	const active = LSD_MODEL_IDS.has(els.diff.value);
	for (const wrap of [biasWrap, coastWrap]) {
		if (!wrap) continue;
		wrap.classList.toggle('opacity-40', !active);
		wrap.classList.toggle('pointer-events-none', !active);
	}
};

/**
 * @brief Write accel/coast lock percentages into the comparison inputs.
 * @param els Comparison running-gear handles.
 * @return void
 */
const syncCompLockInputs = (els: CompRgRefs): void => {
	els.bias.value = String(Math.round(state.compRunningGear.differentialBias * 100));
	els.coast.value = String(Math.round((state.compRunningGear.differentialCoastBias ?? 0) * 100));
};

/**
 * @brief Bind the comparison running-gear selects, numbers and slider.
 * @param _refs Cached DOM handles (kept for binder signature consistency).
 * @param render Full refresh callback.
 * @return void
 */
export const bindCompRunningGearEvents = (_refs: ElementRefs, render: () => void): void => {
	const els = getCompRgRefs();
	els.layout.addEventListener('change', (e) => {
		const v = (e.target as HTMLSelectElement).value;
		if (v === 'FWD' || v === 'RWD' || v === 'AWD') {
			state.compRunningGear.drivetrainLayout = v as DrivetrainLayout;
			render();
		}
	});
	els.diff.addEventListener('change', (e) => {
		const v = (e.target as HTMLSelectElement).value;
		if (DIFF_PRESETS.some((p) => p.id === v)) {
			applyDiffModelTo(state.compRunningGear, v);
			applyCompRgVisibility(els);
			syncCompLockInputs(els);
			render();
		}
	});
	bindNum(els.bias, 0, 100, (v) => {
		state.compRunningGear.differentialBias = v / 100;
		state.compRunningGear.differentialModelId = state.compRunningGear.differentialModelId || 'lsd_custom';
	}, render);
	bindNum(els.coast, 0, 100, (v) => {
		state.compRunningGear.differentialCoastBias = v / 100;
	}, render);
	bindNum(els.weight, 40, 70, (v) => { state.compRunningGear.frontWeightDistribution = v / 100; }, render);
	bindNum(els.cog, 300, 700, (v) => { state.compRunningGear.centerOfGravityHeightMm = v; }, render);
	bindNum(els.wheelbase, 2200, 3300, (v) => { state.compRunningGear.wheelbaseMm = v; }, render);
	bindNum(els.track, 1300, 1800, (v) => { state.compRunningGear.trackWidthMm = v; }, render);
	bindNum(els.springF, 10, 120, (v) => { state.compRunningGear.springRateFrontNmm = v; }, render);
	bindNum(els.springR, 10, 120, (v) => { state.compRunningGear.springRateRearNmm = v; }, render);
	bindNum(els.lift, 0, 4, (v) => { state.compRunningGear.liftCoefficient = v; }, render);
	bindNum(els.liftArea, 0.5, 5, (v) => { state.compRunningGear.liftReferenceAreaM2 = v; }, render);
	bindNum(els.liftShare, 20, 80, (v) => { state.compRunningGear.downforceFrontShare = v / 100; }, render);
	els.latg.addEventListener('input', (e) => {
		const v = parseFloat((e.target as HTMLInputElement).value);
		if (!Number.isFinite(v)) return;
		state.compRunningGear.lateralG = Math.min(1.3, Math.max(0, v));
		els.latgVal.textContent = `${state.compRunningGear.lateralG.toFixed(2)} G`;
		render();
	});
};

/**
 * @brief Sync comparison running-gear controls from compRunningGear state.
 * @brief Called after copy-primary, preset load and URL restore.
 * @return void
 */
export const syncCompRunningGearInputs = (): void => {
	let els: CompRgRefs;
	try {
		els = getCompRgRefs();
	} catch {
		return;
	}
	const rg: RunningGear = state.compRunningGear;
	els.layout.value = rg.drivetrainLayout;
	els.diff.value = rg.differentialModelId ?? modelIdFromType(rg.differentialType);
	if (!DIFF_PRESETS.some((p) => p.id === els.diff.value)) {
		els.diff.value = modelIdFromType(rg.differentialType);
	}
	rg.differentialModelId = els.diff.value;
	syncCompLockInputs(els);
	els.weight.value = String(rg.frontWeightDistribution * 100);
	els.cog.value = String(rg.centerOfGravityHeightMm);
	els.wheelbase.value = String(rg.wheelbaseMm);
	els.track.value = String(rg.trackWidthMm);
	els.springF.value = String(rg.springRateFrontNmm);
	els.springR.value = String(rg.springRateRearNmm);
	els.lift.value = String(rg.liftCoefficient ?? 0.15);
	els.liftArea.value = String(rg.liftReferenceAreaM2 ?? 2);
	els.liftShare.value = String(Math.round((rg.downforceFrontShare ?? rg.frontWeightDistribution) * 100));
	els.latg.value = String(rg.lateralG);
	els.latgVal.textContent = `${rg.lateralG.toFixed(2)} G`;
	applyCompRgVisibility(els);
};
