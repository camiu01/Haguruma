/**
 * @file crosshair-tooltip.ts
 * @brief Free per-gear hover readout shown next to the crosshair.
 *
 * The readout is the non-snapped companion of the HUD pill: it lists the
 * engine speed every primary (and comparison) gear reaches at the cursor
 * speed and floats beside the pointer. All text is written with
 * `textContent`.
 */
import { getGearColor } from '../../config/gear-colors';
import { t } from '../../core/i18n/language';
import { getUnitLabel } from '../../core/units/unit-utils';
import { calculateRpm } from '../../core/math/speed-math';
import type { SpeedUnit } from '../../core/models';
import type { ElementRefs } from '../dom/element-refs';
import { clampNum } from './svg-frame';
import { clearChildren } from './svg-nodes';
import type { CrosshairContext } from './graph-crosshair';

/** Viewport anchor of the floating tooltip. */
export interface TooltipAnchor {
	/** Viewport X of the pointer or cursor. */
	clientX: number;
	/** Viewport Y of the pointer or cursor. */
	clientY: number;
}

/**
 * @brief Render the free per-gear readout beside the cursor.
 * @param refs Cached DOM handles (tooltip element plus the plot box).
 * @param context Current crosshair context.
 * @param speed Cursor speed in display units.
 * @param anchor Viewport position to float the tooltip next to.
 * @return void
 */
export const renderFreeTooltip = (
	refs: ElementRefs,
	context: CrosshairContext,
	speed: number,
	anchor: TooltipAnchor,
): void => {
	clearChildren(refs.graphTooltip);
	refs.graphTooltip.appendChild(header(speed, getUnitLabel(context.unit)));
	appendGearRows(refs.graphTooltip, context, context.gears, context.finalDrive, context.circM, context.redline, speed, false);
	const compare = context.compare;
	if (compare) {
		appendGearRows(refs.graphTooltip, context, compare.gears, compare.finalDrive, compare.circM, compare.redline, speed, true);
	}
	refs.graphTooltip.classList.remove('hidden');
	placeTooltip(refs, refs.graphTooltip, anchor);
};

/**
 * @brief Build the speed header line of the tooltip.
 * @param speed Cursor speed in display units.
 * @param unitLabel Localized speed unit.
 * @return Header element.
 */
const header = (speed: number, unitLabel: string): HTMLElement => {
	const el = document.createElement('div');
	el.className = 'font-bold text-[0.6875rem] border-b border-gray-700 pb-1 mb-1';
	el.textContent = `${speed.toFixed(1)} ${unitLabel}`;
	return el;
};

/**
 * @brief Append one readout row per gear reachable at the cursor speed.
 * @param host Tooltip element receiving the rows.
 * @param context Current crosshair context (source of the display unit).
 * @param gears Gear ratios to evaluate.
 * @param finalDrive Differential ratio.
 * @param circM Rolling circumference in metres.
 * @param redline Rev limiter in RPM.
 * @param speed Cursor speed in display units.
 * @param secondary True for the dashed comparison gearset.
 * @return void
 */
const appendGearRows = (
	host: HTMLElement,
	context: CrosshairContext,
	gears: number[],
	finalDrive: number,
	circM: number,
	redline: number,
	speed: number,
	secondary: boolean,
): void => {
	const unit: SpeedUnit = context.unit;
	for (let idx = 0; idx < gears.length; idx += 1) {
		const rpm = calculateRpm(speed, gears[idx], finalDrive, circM, unit);
		if (!Number.isFinite(rpm) || rpm > redline + 400) {
			continue;
		}
		host.appendChild(readoutRow(idx, rpm, redline, secondary));
	}
};

/**
 * @brief Build one gear readout row.
 * @param idx Zero-based gear index.
 * @param rpm Engine speed at the cursor.
 * @param redline Rev limiter of that gearset.
 * @param secondary True for the comparison gearset.
 * @return Row element, over-rev values highlighted.
 */
const readoutRow = (idx: number, rpm: number, redline: number, secondary: boolean): HTMLElement => {
	const row = document.createElement('div');
	row.className = 'flex justify-between gap-3 text-[0.625rem]';
	const name = document.createElement('span');
	name.textContent = `${t('gear.prefix')} ${idx + 1}${secondary ? "'" : ''}`;
	name.style.color = secondary ? '#fbbf24' : getGearColor(idx);
	const value = document.createElement('span');
	value.textContent = `${Math.round(rpm)} RPM`;
	if (rpm > redline) {
		value.className = 'text-rose-400 font-bold';
	}
	row.appendChild(name);
	row.appendChild(value);
	return row;
};

/**
 * @brief Float the tooltip beside the pointer inside the plot box.
 * @param refs Cached DOM handles (source of the rendered SVG box).
 * @param el Tooltip element to position.
 * @param anchor Viewport anchor of the cursor.
 * @return void
 */
const placeTooltip = (refs: ElementRefs, el: HTMLElement, anchor: TooltipAnchor): void => {
	const rect = refs.graphSvg.getBoundingClientRect();
	const left = anchor.clientX - rect.left + 14;
	const top = anchor.clientY - rect.top - el.offsetHeight - 12;
	el.style.left = `${clampNum(left, 0, Math.max(0, rect.width - el.offsetWidth - 6))}px`;
	el.style.top = `${clampNum(top, 0, Math.max(0, rect.height - el.offsetHeight - 6))}px`;
};
