/**
 * @file gear-table.ts
 * @brief Primary breakdown table: per-gear peaks, shift drops and drag/overdrive status.
 */
import { state } from '../core/state/app-state';
import { effectiveCircumferenceM, parseTire } from '../core/math/tire-math';
import { calculateSpeed, fromDisplaySpeed } from '../core/math/speed-math';
import { describeUpshift } from '../core/math/shift-math';
import {
	dynamicRadiusM,
	optimalShiftsForAll,
	type OptimalShift,
} from '../core/math/traction-math';
import { availableWheelKw, dragLimitedSpeedKmh, roadLoadPowerKw } from '../core/math/aero-math';
import { activeEngineCurve } from '../core/state/engine-curve';
import { formatPower, getUnitLabel } from '../core/units/unit-utils';
import { getGearColor } from '../config/gear-colors';
import { t } from '../core/i18n/language';
import type { ElementRefs } from '../services/dom/element-refs';
import {
	classifyGearVmax,
	formatGearAdvisory,
	type GearAdvisory,
	type GearStatusKey,
	type GearVmaxStatus,
	type WallProfile,
} from './gear-status';
import { renderCompareTable, updateComparisonInfo } from './compare-table';
import { renderKpis } from './kpi-strip';
import { primaryForceInput } from '../core/state/dynamics-input';
import { forceReadoutAt } from '../core/math/force-profile';
import { speedKmh } from '../core/math/speed-math';
import { wheelForceAt } from '../core/math/drive-force';

/** Colour token per badge key. */
const BADGE_CLASS: Record<GearStatusKey, string> = {
	'status.wall': 'text-neon-red',
	'status.overdrive': 'text-neon-yellow',
	'status.redline': 'text-neon-red',
};

/** Footnote dictionary keys rendered under the table. */
const FOOTNOTE_KEYS = ['table.formula', 'table.validated'] as const;

/**
 * Render the theoretical top-speed and shift-drop table.
 * @brief Summarize every gear peak, the RPM landing in the next gear and how each
 * @brief gear relates to the aerodynamic wall; drives the KPI strip as well.
 * @param refs Cached DOM handles.
 * @return void
 */
export const renderTable = (refs: ElementRefs): void => {
	const tire = parseTire(state.primaryTire);
	if (!tire) {
		renderKpis();
		return;
	}
	const circM = effectiveCircumferenceM(tire, state.rollingFactor);
	const profile = resolveWallProfile(circM);
	const shifts = optimalShiftsForAll(
		state.gears,
		state.primaryFd,
		circM,
		activeEngineCurve(),
		state.drivetrainEff,
		state.unit,
		state.dynamics.efficiencyMap ? state.runningGear.drivetrainLayout : undefined,
	);
	refs.breakdownBody.innerHTML = '';
	state.gears.forEach((gearRatio, idx) => {
		refs.breakdownBody.appendChild(buildTableRow(circM, gearRatio, idx, profile, shifts));
	});
	if (state.reverseRatio !== null && state.reverseRatio > 0) {
		refs.breakdownBody.appendChild(buildReverseRow(circM));
	}
	renderFootnote(refs);
	renderFdBadge();
	renderKpis();
	updateComparisonInfo(refs);
	renderCompareTable(refs, circM);
};

/**
 * @brief Show the overall (gearbox × final drive) ratio in the table header.
 * @return void
 */
const renderFdBadge = (): void => {
	const badge = document.getElementById('table-fd-badge');
	if (!badge) {
		return;
	}
	badge.textContent = `${t('table.totalRatio')} (FD ${state.primaryFd.toFixed(3)}:1)`;
};

/**
 * Solve the drag-limited top speed for the current aero setup.
 * @brief Wheel power is crank power through drivetrain efficiency.
 * @return Wall speed in km/h, or null when the aero layer is switched off.
 */
const resolveWallKmh = (): number | null => {
	if (!state.roadLoadEnabled) {
		return null;
	}
	return dragLimitedSpeedKmh(
		availableWheelKw(state.enginePowerKw, state.drivetrainEff),
		state.vehicleMassKg,
		state.dragCd,
		state.frontalAreaM2,
		state.rollingCrr,
		state.roadGradePercent,
	);
};

/**
 * Theoretical V-Max of one gear at the rev limiter.
 * @brief Mirrors the graph peak so the table and the strip agree.
 * @param gearRatio Selected gear ratio.
 * @param circM Effective rolling circumference in metres.
 * @return Theoretical V-Max in the active display unit.
 */
const theoreticalVmaxDisplay = (gearRatio: number, circM: number): number => {
	return calculateSpeed(state.primaryRedline, gearRatio, state.primaryFd, circM, state.unit);
};

/**
 * Locate the wall and the first gear that cannot stay below it.
 * @brief Gear sets are strictly decreasing, so the first gear past the wall is
 * @brief the only drag-limited one and every taller gear is an overdrive ratio.
 * @param circM Effective rolling circumference in metres.
 * @return Wall profile for the current render pass.
 */
const resolveWallProfile = (circM: number): WallProfile => {
	const wallKmh = resolveWallKmh();
	if (wallKmh === null || !(wallKmh > 0)) {
		return { wallKmh: null, firstOverWallIndex: null };
	}
	const overWall = (ratio: number): boolean => fromDisplaySpeed(theoreticalVmaxDisplay(ratio, circM), state.unit) > wallKmh;
	const index = state.gears.findIndex(overWall);
	return { wallKmh, firstOverWallIndex: index < 0 ? null : index };
};

/**
 * Build one table row for a gear.
 * @brief Isolate per-gear arithmetic from DOM code.
 * @param circM Effective rolling circumference in metres.
 * @param gearRatio Selected gear ratio.
 * @param idx Zero-based gear index.
 * @param profile Drag-wall classification for this render pass.
 * @param shifts Optimal shifts shared by every row of this render pass.
 * @return Table row element with nowrap numeric cells.
 */
const buildTableRow = (
	circM: number,
	gearRatio: number,
	idx: number,
	profile: WallProfile,
	shifts: OptimalShift[],
): HTMLElement => {
	const gearVmax = theoreticalVmaxDisplay(gearRatio, circM);
	const status = classifyGearVmax(idx, gearVmax, profile.wallKmh, profile.firstOverWallIndex, state.unit);
	const shift = shifts.find((entry) => entry.fromIndex === idx) ?? null;
	const advisory = formatGearAdvisory(shift?.shiftRpm ?? null, shift?.atRedline ?? false, status.ecoShift);
	const overallRatio = (gearRatio * state.primaryFd).toFixed(2);
	const { nextRpmDisplay, dropRpm } = describeShift(circM, idx);
	const powerDisplay = describeRoadLoad(gearVmax);
	const { wheelTorqueDisplay, forceDisplay } = describeTraction(circM, gearRatio);
	const tr = document.createElement('tr');
	tr.className = 'hover:bg-surface-subtle transition-colors';
	tr.innerHTML = `<td class='td td--lead font-semibold'><span class='inline-flex items-center gap-2 whitespace-nowrap'><span class='w-2 h-2 rounded-full shrink-0' style='background-color: ${getGearColor(idx)}'></span><span data-cell='gear'></span></span></td><td class='td font-semibold text-text-output'>${gearRatio.toFixed(2)}:1</td><td class='td text-text-dim hidden md:table-cell'>${overallRatio}:1</td><td class='td td--right font-bold text-text-output' data-cell='vmax'></td><td class='td td--right text-neon-cyan'>${nextRpmDisplay}</td><td class='td td--right text-text-muted' data-cell='drop'></td><td class='td td--right text-text-dim hidden md:table-cell'>${powerDisplay}</td><td class='td td--right text-text-output hidden md:table-cell'>${wheelTorqueDisplay}</td><td class='td td--right font-bold text-text-output hidden md:table-cell'>${forceDisplay}</td><td class='td td--right text-neon-purple' data-cell='advisory'></td>`;
	const label = tr.querySelector<HTMLElement>("[data-cell='gear']");
	if (label) {
		label.textContent = `${t('gear.prefix')} ${idx + 1}`;
	}
	fillVmaxCell(tr, status);
	fillDropCell(tr, dropRpm);
	fillAdvisoryCell(tr, advisory);
	const margin = document.createElement('td');
	margin.className = 'td td--right hidden md:table-cell';
	const reading = forceReadoutAt(primaryForceInput(), idx, speedKmh(state.peakTorqueRpm, gearRatio, state.primaryFd, circM));
	margin.textContent = `${reading.marginN > 0 ? '+' : ''}${Math.round(reading.marginN)}`;
	margin.title = t('dynamics.margin');
	if (reading.marginN > 0) margin.classList.add('text-neon-yellow');
	tr.insertBefore(margin, tr.lastElementChild);
	return tr;
};

/**
 * @brief Fill the V-Max cell, applying the drag-wall or overdrive presentation.
 * @param tr Row element carrying the empty V-Max hook.
 * @param status Classification for this gear.
 * @return void
 */
const fillVmaxCell = (tr: HTMLElement, status: GearVmaxStatus): void => {
	const cell = tr.querySelector<HTMLElement>("[data-cell='vmax']");
	if (!cell) {
		return;
	}
	const value = document.createElement('span');
	value.textContent = status.display.toFixed(1);
	if (status.overdrive) {
		value.className = 'line-through text-text-muted';
	}
	cell.appendChild(value);
	if (status.dragLimited) {
		cell.title = `${status.theoreticalDisplay.toFixed(1)} ${getUnitLabel(state.unit)}`;
	}
	if (status.badgeKey) {
		cell.appendChild(buildBadge(status.badgeKey));
	}
};

/**
 * @brief Fill the RPM-drop cell with the highlighted badge or a placeholder.
 * @brief The drop is a badge rather than plain text so the shift columns read
 * @brief apart at a glance; the top gear has no successor and gets an em dash.
 * @param tr Row element carrying the empty drop hook.
 * @param dropRpm Drop in rpm from the upshift, null when there is no next gear.
 * @return void
 */
const fillDropCell = (tr: HTMLElement, dropRpm: number | null): void => {
	const cell = tr.querySelector<HTMLElement>("[data-cell='drop']");
	if (!cell) {
		return;
	}
	if (dropRpm === null) {
		cell.textContent = '—';
		return;
	}
	const badge = document.createElement('span');
	badge.className = 'rounded-full font-mono fs-tiny font-bold text-accent-warning bg-accent-warning/10 px-2 py-0.5';
	badge.textContent = `-${Math.round(dropRpm)} rpm`;
	cell.appendChild(badge);
};

/**
 * @brief Fill the Shift Advisory cell with text and an optional badge.
 * @param tr Row element carrying the empty advisory hook.
 * @param advisory Advisory classification for this gear.
 * @return void
 */
const fillAdvisoryCell = (tr: HTMLElement, advisory: GearAdvisory): void => {
	const cell = tr.querySelector<HTMLElement>("[data-cell='advisory']");
	if (!cell) {
		return;
	}
	cell.textContent = advisory.text;
	if (advisory.eco) {
		cell.classList.add('text-neon-green');
	}
	if (advisory.badgeKey) {
		cell.appendChild(buildBadge(advisory.badgeKey));
	}
};

/**
 * @brief Build a status badge element.
 * @param key Dictionary key of the badge copy.
 * @return Span with the localized badge text.
 */
const buildBadge = (key: GearStatusKey): HTMLElement => {
	const badge = document.createElement('span');
	badge.className = `ml-1.5 inline-flex items-center rounded-full border border-border-hairline bg-surface-recessed px-2 py-0.5 font-mono fs-tiny font-bold uppercase tracking-wider ${BADGE_CLASS[key]}`;
	badge.textContent = t(key);
	return badge;
};

/**
 * Describe the secondary road-load power at a gear peak.
 * @brief Show required wheel power in the active power unit (kW or cv).
 * @param topSpeed Theoretical top speed in the active display unit.
 * @return Display string such as 45.2 kW, flagged when drag-limited.
 */
const describeRoadLoad = (topSpeed: number): string => {
	if (!state.roadLoadEnabled) {
		return '-';
	}
	const speedKmh = fromDisplaySpeed(topSpeed, state.unit);
	const kw = roadLoadPowerKw(
		speedKmh,
		state.vehicleMassKg,
		state.dragCd,
		state.frontalAreaM2,
		state.rollingCrr,
		state.roadGradePercent,
	);
	const base = formatPower(kw, state.powerUnit);
	const available = availableWheelKw(state.enginePowerKw, state.drivetrainEff);
	return kw > available ? `${base} ${t('table.dragLimited')}` : base;
};

/**
 * Describe the RPM landing in the next gear.
 * @brief Compute display strings for the shift columns.
 * @param circM Tire circumference in metres.
 * @param idx Zero-based gear index.
 * @return Next-RPM display string plus the raw drop in rpm, null in the top gear.
 */
const describeShift = (circM: number, idx: number): { nextRpmDisplay: string; dropRpm: number | null } => {
	if (idx >= state.gears.length - 1) {
		return { nextRpmDisplay: '-', dropRpm: null };
	}
	const step = describeUpshift(state.gears, idx, state.primaryRedline, state.primaryFd, circM, state.unit);
	if (!step) {
		return { nextRpmDisplay: '-', dropRpm: null };
	}
	return { nextRpmDisplay: `${Math.round(step.landingRpm)} rpm`, dropRpm: step.rpmDrop };
};

/**
 * Describe wheel torque and traction for one gear.
 * @brief Wheel torque and force share the same mapped transmission losses.
 * @param circM Effective rolling circumference in metres.
 * @param gearRatio Selected gear ratio.
 * @return Display strings for the wheel-torque and traction columns.
 */
const describeTraction = (circM: number, gearRatio: number): { wheelTorqueDisplay: string; forceDisplay: string } => {
	const curve = activeEngineCurve();
	if (!curve) {
		return { wheelTorqueDisplay: '-', forceDisplay: '-' };
	}
	const radius = dynamicRadiusM(circM);
	const force = wheelForceAt(state.peakTorqueRpm, gearRatio, state.primaryFd, radius,
		curve, state.drivetrainEff, state.runningGear, state.dynamics.efficiencyMap);
	return { wheelTorqueDisplay: `${Math.round(force * radius)} Nm`, forceDisplay: `${Math.round(force)} N` };
};

/**
 * Build the reverse-gear table row.
 * @brief Show R ratio, overall ratio, top speed and road-load power.
 * @param circM Tire circumference in metres.
 * @return Reverse table row element.
 */
const buildReverseRow = (circM: number): HTMLElement => {
	const ratio = state.reverseRatio ?? 0;
	const overallRatio = (ratio * state.primaryFd).toFixed(2);
	const topSpeed = theoreticalVmaxDisplay(ratio, circM);
	const powerDisplay = describeRoadLoad(topSpeed);
	const tr = document.createElement('tr');
	tr.className = 'hover:bg-surface-subtle transition-colors';
	tr.innerHTML = `<td class='td td--lead font-semibold'><span class='inline-flex items-center gap-2 whitespace-nowrap'><span class='w-2 h-2 rounded-full bg-text-muted shrink-0'></span><span data-cell='gear'></span></span></td><td class='td font-semibold text-text-output'>${ratio.toFixed(2)}:1</td><td class='td text-text-dim hidden md:table-cell'>${overallRatio}:1</td><td class='td td--right font-bold text-text-output'>${topSpeed.toFixed(1)}</td><td class='td td--right text-text-muted'>-</td><td class='td td--right text-text-muted'>—</td><td class='td td--right text-text-dim hidden md:table-cell'>${powerDisplay}</td><td class='td td--right text-text-muted hidden md:table-cell'>-</td><td class='td td--right text-text-muted hidden md:table-cell'>-</td><td class='td td--right text-text-muted'>-</td>`;
	const label = tr.querySelector<HTMLElement>("[data-cell='gear']");
	if (label) {
		label.textContent = t('gear.reverse');
	}
	const margin = document.createElement('td');
	margin.className = 'td td--right hidden md:table-cell';
	margin.textContent = '—';
	tr.insertBefore(margin, tr.lastElementChild);
	return tr;
};

/**
 * Render the engineering footnote under the breakdown table.
 *
 * The line is created on first render and only rewritten afterwards, so the
 * static shell needs no extra markup and no dictionary copy is interpolated
 * into HTML: both fragments are written with textContent.
 * @param refs Cached DOM handles.
 * @return void
 */
const renderFootnote = (refs: ElementRefs): void => {
	const table = refs.breakdownBody.closest('table');
	const host = table?.parentElement;
	if (!table || !host) {
		return;
	}
	const existing = document.getElementById('gear-table-footnote');
	const foot = existing ?? document.createElement('div');
	if (!existing) {
		foot.id = 'gear-table-footnote';
		foot.className = 'mt-2 pt-2 border-t border-border-hairline flex flex-wrap items-baseline gap-x-3 gap-y-1 font-mono fs-tiny text-text-muted';
		host.insertBefore(foot, table.nextSibling);
	}
	foot.textContent = '';
	for (const key of FOOTNOTE_KEYS) {
		const part = document.createElement('span');
		part.className = 'whitespace-nowrap';
		part.textContent = t(key);
		foot.appendChild(part);
	}
};
