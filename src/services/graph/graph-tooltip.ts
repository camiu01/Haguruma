import { state } from '../../core/state/app-state';
import { effectiveCircumferenceM, parseTire } from '../../core/math/tire-math';
import { calculateRpm, fromDisplaySpeed } from '../../core/math/speed-math';
import { dynamicRadiusM, tractiveForceAt, validateCurve } from '../../core/math/traction-math';
import { maxDriveForceAtSpeed } from '../../core/math/dynamics-math';
import { defaultRunningGear } from '../../core/state/app-state';
import { getMaxRpm } from '../../core/units/unit-utils';
import { getGearColor } from '../../config/gear-colors';
import { t } from '../../core/i18n/language';
import type { ElementRefs } from '../dom/element-refs';
import { buildPlotFrame } from './canvas-setup';

/**
 * Handle pointer or touch positions on the graph canvas.
 * @brief Shared core used by mouse hover and touch taps.
 * @param point Client coordinates of the pointer or touch.
 * @param refs Cached DOM handles.
 * @return void
 */
export const handleCanvasPointer = (
	point: { clientX: number; clientY: number },
	refs: ElementRefs,
): void => {
	const rect = refs.canvas.getBoundingClientRect();
	const mouseX = point.clientX - rect.left;
	const mouseY = point.clientY - rect.top;
	const topRedline = state.compareEnabled ? Math.max(state.primaryRedline, state.compRedline) : state.primaryRedline;
	const maxRpm = getMaxRpm(topRedline);
	const frame = buildPlotFrame(refs.canvas, state.maxGraphSpeed, maxRpm);
	if (!frame) {
		return;
	}
	if (isOutsidePlot(frame, mouseX, mouseY)) {
		refs.tooltip.classList.add('hidden');
		return;
	}
	const hoveredSpeed = ((mouseX - frame.paddingLeft) / frame.plotWidth) * frame.maxSpeed;
	const hoveredRpm = ((frame.paddingTop + frame.plotHeight - mouseY) / frame.plotHeight) * frame.maxRpm;
	renderTooltip(refs, hoveredSpeed, hoveredRpm, mouseX, mouseY);
};

/**
 * Handle mouse movement over the graph canvas.
 * @brief Mouse wrapper around the shared pointer core.
 * @param event Mouse event from the canvas listener.
 * @param refs Cached DOM handles.
 * @return void
 */
export const handleCanvasHover = (event: MouseEvent, refs: ElementRefs): void => {
	handleCanvasPointer(event, refs);
};

/**
 * Check whether the pointer left the plot area.
 * @purpose Hide the tooltip outside valid coordinates.
 */
const isOutsidePlot = (
	frame: { paddingLeft: number; paddingTop: number; plotWidth: number; plotHeight: number },
	mouseX: number,
	mouseY: number,
): boolean => {
	return (
		mouseX < frame.paddingLeft ||
		mouseX > frame.paddingLeft + frame.plotWidth ||
		mouseY < frame.paddingTop ||
		mouseY > frame.paddingTop + frame.plotHeight
	);
};

/**
 * Build tooltip HTML for every reachable gear.
 * @purpose Centralize string templating for hover readout.
 */
const renderTooltip = (
	refs: ElementRefs,
	speed: number,
	rpm: number,
	mouseX: number,
	mouseY: number,
): void => {
	const primaryTire = parseTire(state.primaryTire);
	if (!primaryTire) {
		return;
	}
	const circM = effectiveCircumferenceM(primaryTire, state.rollingFactor);
	let content = `<div class='font-bold border-b border-gray-700 pb-1 mb-1 text-red-400'>${Math.round(speed)} ${state.unit} @ ${Math.round(rpm)} RPM</div>`;
	state.gears.forEach((gearRatio, idx) => {
		const rpmAtSpeed = calculateRpm(speed, gearRatio, state.primaryFd, circM, state.unit);
		if (rpmAtSpeed <= state.primaryRedline + 400) {
			content += buildRow(idx, rpmAtSpeed, false);
		}
	});
	if (state.compareEnabled) {
		content += buildCompareSection(speed);
	}
	content += buildGripSection(speed, circM);
	refs.tooltip.innerHTML = content;
	refs.tooltip.style.left = `${mouseX}px`;
	refs.tooltip.style.top = `${mouseY}px`;
	refs.tooltip.classList.remove('hidden');
};

/**
 * Build one tooltip row for a single gear.
 * @purpose Highlight over-rev values in rose.
 */
const buildRow = (idx: number, rpmAtSpeed: number, isCompare: boolean): string => {
	const limit = isCompare ? state.compRedline : state.primaryRedline;
	const isOver = rpmAtSpeed > limit;
	const color = isCompare ? '#fbbf24' : getGearColor(idx);
	const suffix = isCompare ? '\'' : '';
	const cls = isOver ? 'text-rose-400 font-bold' : 'text-gray-200';
	const over = isOver ? t('tooltip.over') : '';
	return `<div class='flex justify-between items-center gap-3 text-[10px]'><span style='color: ${color}'>${t('gear.prefix')} ${idx + 1}${suffix}:</span><span class='${cls}'>${Math.round(rpmAtSpeed)} RPM ${over}</span></div>`;
};

/**
 * Build the grip-limit section for the hovered speed.
 * @brief Compare 1st reachable gear force against the friction limit.
 * @param speed Hovered speed in display units.
 * @param circM Primary rolling circumference in metres.
 * @return HTML fragment, empty when inputs are invalid.
 */
const buildGripSection = (speed: number, circM: number): string => {
	const rg = state.runningGear ?? defaultRunningGear;
	const curve = validateCurve({
		redline: state.primaryRedline,
		peakTorqueRpm: state.peakTorqueRpm,
		peakTorqueNm: state.peakTorqueNm,
		peakPowerRpm: state.peakPowerRpm,
		peakPowerKw: state.enginePowerKw,
	});
	if (!curve || state.gears.length === 0) {
		return '';
	}
	const radius = dynamicRadiusM(circM);
	const speedKmh = fromDisplaySpeed(speed, state.unit);
	let engineForce = 0;
	for (const gear of state.gears) {
		const rpm = calculateRpm(speed, gear, state.primaryFd, circM, state.unit);
		if (rpm > 0 && rpm <= state.primaryRedline + 400) {
			engineForce = tractiveForceAt(rpm, gear, state.primaryFd, radius, curve, state.drivetrainEff);
			break;
		}
	}
	const grip = maxDriveForceAtSpeed(rg, state.vehicleMassKg, speedKmh, engineForce, 0);
	const cls = grip.isSpin ? 'text-rose-400 font-bold' : 'text-emerald-300';
	const label = grip.isSpin ? 'Wheelspin' : 'Grip';
	return `<div class='flex justify-between items-center gap-3 text-[10px] mt-1 border-t border-gray-700 pt-1'><span class='text-amber-300'>GRIP ${Math.round(grip.limitN)} N · ${Math.round(grip.perWheelN)}/wheel</span><span class='${cls}'>${label}</span></div>`;
};

/**
 * Build the dashed secondary section of the tooltip.
 * @brief List compare RPMs at the hovered speed.
 * @param speed Hovered speed in display units.
 * @return HTML fragment, empty when the secondary tire is invalid.
 */
const buildCompareSection = (speed: number): string => {
	const compTire = parseTire(state.compTire);
	if (!compTire || state.compGears.length === 0) {
		return '';
	}
	const compCircM = effectiveCircumferenceM(compTire, state.rollingFactor);
	let section = `<div class='font-bold border-b border-gray-700 pb-1 mb-1 mt-2 text-amber-400 text-[10px]'>${t('compare.secondary')}</div>`;
	state.compGears.forEach((gearRatio, idx) => {
		const rpmAtSpeed = calculateRpm(speed, gearRatio, state.compFd, compCircM, state.unit);
		if (rpmAtSpeed <= state.compRedline + 400) {
			section += buildRow(idx, rpmAtSpeed, true);
		}
	});
	return section;
};
