/**
 * @file crosshair-tooltip.ts
 * @brief Free per-gear hover readout shown next to the crosshair.
 *
 * The readout is the non-snapped companion of the HUD pill: it opens with the
 * hovered speed and engine speed, lists the RPM every primary (and comparison)
 * gear reaches there, flags over-rev rows, prints the wheel power the
 * drivetrain delivers at that speed and closes with the grip-limit verdict
 * (limit, per-wheel share, wheelspin). All text is written with `textContent`,
 * never markup.
 */
import { getGearColor } from '../../config/gear-colors';
import { t } from '../../core/i18n/language';
import { formatPower, getUnitLabel } from '../../core/units/unit-utils';
import { calculateRpm, fromDisplaySpeed } from '../../core/math/speed-math';
import { dynamicRadiusM, tractiveForceAt } from '../../core/math/traction-math';
import { maxDriveForceAtSpeed } from '../../core/math/dynamics-math';
import type { SpeedUnit } from '../../core/models';
import type { ElementRefs } from '../dom/element-refs';
import { clampNum } from './svg-frame';
import { clearChildren } from './svg-nodes';
import { wheelPowerAtSpeed } from './svg-power';
import type { CrosshairContext, CrosshairGrip } from './graph-crosshair';

/** Viewport anchor of the floating tooltip. */
export interface TooltipAnchor {
	/** Viewport X of the pointer or cursor. */
	clientX: number;
	/** Viewport Y of the pointer or cursor. */
	clientY: number;
}

/** First reachable gear of the cursor speed, used for the grip verdict. */
export interface GearHit {
	/** Engine speed of that gear at the cursor speed, in RPM. */
	rpm: number;
	/** Ratio of that gear. */
	ratio: number;
}

/** Grip-limit verdict at the cursor speed. */
export interface GripReadout {
	/** Friction limit on the driven axles, in newtons. */
	limitN: number;
	/** Per-wheel share of the limit, in newtons. */
	perWheelN: number;
	/** True when the engine already asks for more force than the tires hold. */
	isSpin: boolean;
}

/**
 * @brief Render the free per-gear readout beside the cursor.
 * @param refs Cached DOM handles (tooltip element plus the plot box).
 * @param context Current crosshair context.
 * @param speed Cursor speed in display units.
 * @param anchor Viewport position to float the tooltip next to.
 * @param rpm Engine speed under the cursor, in RPM.
 * @return void
 */
export const renderFreeTooltip = (
	refs: ElementRefs,
	context: CrosshairContext,
	speed: number,
	anchor: TooltipAnchor,
	rpm: number,
): void => {
	clearChildren(refs.graphTooltip);
	const host = refs.graphTooltip;
	host.appendChild(header(speed, rpm, getUnitLabel(context.unit)));
	const first = appendGearRows(host, context.gears, context.finalDrive, context.circM, context.unit, context.redline, speed, false);
	appendCompareSection(host, context, speed);
	appendPowerSection(host, context, speed);
	appendGripSection(host, context, speed, first);
	refs.graphTooltip.classList.remove('hidden');
	placeTooltip(refs, host, anchor);
};

/**
 * @brief Build the speed and engine-speed header line of the tooltip.
 * @param speed Cursor speed in display units.
 * @param rpm Engine speed under the cursor, in RPM.
 * @param unitLabel Localized speed unit.
 * @return Header element.
 */
const header = (speed: number, rpm: number, unitLabel: string): HTMLElement => {
	const el = document.createElement('div');
	el.className = 'font-bold fs-small border-b border-gray-700 pb-1 mb-1';
	el.textContent = `${speed.toFixed(1)} ${unitLabel} @ ${Math.round(rpm)} RPM`;
	return el;
};

/**
 * @brief Append one readout row per gear reachable at the cursor speed.
 * @param host Node receiving the rows (tooltip element or a fragment).
 * @param gears Gear ratios to evaluate.
 * @param finalDrive Differential ratio.
 * @param circM Rolling circumference in metres.
 * @param unit Active display unit of `speed`.
 * @param redline Rev limiter in RPM.
 * @param speed Cursor speed in display units.
 * @param secondary True for the dashed comparison gearset.
 * @return First reachable gear, null when no gear spins at this speed.
 */
const appendGearRows = (
	host: Node,
	gears: number[],
	finalDrive: number,
	circM: number,
	unit: SpeedUnit,
	redline: number,
	speed: number,
	secondary: boolean,
): GearHit | null => {
	let first: GearHit | null = null;
	for (let idx = 0; idx < gears.length; idx += 1) {
		const rpm = calculateRpm(speed, gears[idx], finalDrive, circM, unit);
		if (!Number.isFinite(rpm) || rpm > redline + 400) {
			continue;
		}
		if (!first && rpm > 0) {
			first = { rpm, ratio: gears[idx] };
		}
		host.appendChild(readoutRow(idx, rpm, redline, secondary));
	}
	return first;
};

/**
 * @brief Append the titled comparison section, skipped when it has no rows.
 * @param host Tooltip element receiving the section.
 * @param context Current crosshair context.
 * @param speed Cursor speed in display units.
 * @return void
 */
const appendCompareSection = (host: HTMLElement, context: CrosshairContext, speed: number): void => {
	const compare = context.compare;
	if (!compare) {
		return;
	}
	const rows = document.createDocumentFragment();
	appendGearRows(rows, compare.gears, compare.finalDrive, compare.circM, context.unit, compare.redline, speed, true);
	if (!rows.firstChild) {
		return;
	}
	const title = document.createElement('div');
	title.className = 'font-bold fs-tiny text-amber-400 border-t border-gray-700 mt-1 pt-1';
	title.textContent = t('compare.secondary');
	host.appendChild(title);
	host.appendChild(rows);
};

/**
 * @brief Append the wheel-power row at the cursor speed.
 * @brief Read from the same max-over-gears sample the power layer draws, so
 * @brief the row and the envelope can never disagree. Skipped while the
 * @brief engine curve is unusable.
 * @param host Tooltip element receiving the row.
 * @param context Current crosshair context.
 * @param speed Cursor speed in display units.
 * @return void
 */
const appendPowerSection = (host: HTMLElement, context: CrosshairContext, speed: number): void => {
	const kw = wheelPowerReadout(context, speed);
	if (kw === null) {
		return;
	}
	const row = document.createElement('div');
	row.className = 'flex justify-between gap-3 fs-tiny border-t border-gray-700 mt-1 pt-1';
	const label = document.createElement('span');
	label.className = 'text-violet-300';
	label.textContent = t('tooltip.power');
	const value = document.createElement('span');
	value.className = 'text-violet-200 font-bold';
	value.textContent = formatPower(kw, context.power.unit);
	row.append(label, value);
	host.appendChild(row);
};

/**
 * @brief Available wheel power of the primary slot at a speed.
 * @param context Current crosshair context.
 * @param speed Cursor speed in display units.
 * @return Wheel power in kilowatts, null when the inputs cannot produce one.
 */
export const wheelPowerReadout = (context: CrosshairContext, speed: number): number | null => {
	const { curve, eff } = context.grip;
	if (!curve || context.gears.length === 0 || !(context.circM > 0) || context.finalDrive <= 0) {
		return null;
	}
	const kmh = fromDisplaySpeed(speed, context.unit);
	return wheelPowerAtSpeed(kmh, context.gears, context.finalDrive, context.circM, curve, eff, context.power.capKw,
		context.grip.mapped ? context.grip.gear.drivetrainLayout : undefined);
};

/**
 * @brief Append the grip-limit verdict row, skipped without an engine curve.
 * @param host Tooltip element receiving the row.
 * @param context Current crosshair context.
 * @param speed Cursor speed in display units.
 * @param first First reachable primary gear, null when none.
 * @return void
 */
const appendGripSection = (host: HTMLElement, context: CrosshairContext, speed: number, first: GearHit | null): void => {
	const readout = gripReadout(context.grip, context.unit, context.circM, context.finalDrive, speed, first);
	if (!readout) {
		return;
	}
	const row = document.createElement('div');
	row.className = 'flex justify-between gap-3 fs-tiny border-t border-gray-700 mt-1 pt-1';
	const limit = document.createElement('span');
	limit.className = 'text-amber-300';
	limit.textContent = `${t('tooltip.grip')} ${Math.round(readout.limitN)} N · ${Math.round(readout.perWheelN)}${t('tooltip.gripPerWheel')}`;
	const verdict = document.createElement('span');
	verdict.textContent = readout.isSpin ? t('tooltip.gripSpin') : t('tooltip.gripOk');
	verdict.className = readout.isSpin ? 'text-rose-400 font-bold' : 'text-emerald-300';
	row.append(limit, verdict);
	host.appendChild(row);
};

/**
 * @brief Evaluate the tire limit and the wheelspin verdict at a speed.
 * @brief The demanded force comes from the first gear still under the limiter,
 * @brief mirroring the launch case the grip layer shades.
 * @param grip Grip inputs from the render context.
 * @param unit Active display unit of `speed`.
 * @param circM Primary rolling circumference in metres.
 * @param finalDrive Primary differential ratio.
 * @param speed Cursor speed in display units.
 * @param first First reachable primary gear, null when none.
 * @return Verdict object, null when the inputs cannot produce one.
 */
export const gripReadout = (
	grip: CrosshairGrip,
	unit: SpeedUnit,
	circM: number,
	finalDrive: number,
	speed: number,
	first: GearHit | null,
): GripReadout | null => {
	if (!grip.curve || !first || !(circM > 0) || finalDrive <= 0) {
		return null;
	}
	const radius = dynamicRadiusM(circM);
	if (!(radius > 0)) {
		return null;
	}
	const speedKmh = fromDisplaySpeed(speed, unit);
	const demandN = tractiveForceAt(first.rpm, first.ratio, finalDrive, radius, grip.curve, grip.eff,
		grip.mapped ? grip.gear.drivetrainLayout : undefined);
	return maxDriveForceAtSpeed(grip.gear, grip.massKg, speedKmh, demandN, 0);
};

/**
 * @brief Build one gear readout row.
 * @param idx Zero-based gear index.
 * @param rpm Engine speed at the cursor.
 * @param redline Rev limiter of that gearset.
 * @param secondary True for the comparison gearset.
 * @return Row element, over-rev values flagged and highlighted.
 */
const readoutRow = (idx: number, rpm: number, redline: number, secondary: boolean): HTMLElement => {
	const row = document.createElement('div');
	row.className = 'flex justify-between gap-3 fs-tiny';
	const name = document.createElement('span');
	name.textContent = `${t('gear.prefix')} ${idx + 1}${secondary ? "'" : ''}`;
	name.style.color = secondary ? '#fbbf24' : getGearColor(idx);
	const over = rpm > redline;
	const value = document.createElement('span');
	value.textContent = over ? `${Math.round(rpm)} RPM ${t('tooltip.over')}` : `${Math.round(rpm)} RPM`;
	if (over) {
		value.className = 'text-rose-400 font-bold';
	}
	row.append(name, value);
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
