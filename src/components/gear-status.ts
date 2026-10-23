/**
 * @file gear-status.ts
 * @brief Pure drag-wall and shift-advisory classification for the breakdown table.
 */
import { toDisplaySpeed } from '../core/math/speed-math';
import { t } from '../core/i18n/language';
import type { SpeedUnit } from '../core/models';

/** Badge dictionary keys rendered on the V-Max and Shift Advisory cells. */
export type GearStatusKey = 'status.wall' | 'status.overdrive' | 'status.redline';

/** Drag-wall classification shared by every row of one render pass. */
export interface WallProfile {
	/** Drag-limited speed in km/h, null when the aero layer is off or unsolvable. */
	wallKmh: number | null;
	/** Lowest gear index whose theoretical V-Max exceeds the wall, null when none. */
	firstOverWallIndex: number | null;
}

/** V-Max cell classification for one gear. */
export interface GearVmaxStatus {
	/** Theoretical V-Max in the active display unit. */
	theoreticalDisplay: number;
	/** Value rendered in the V-Max cell (the wall speed for the drag-limited gear). */
	display: number;
	/** True for the first gear past the wall: the wall caps its real top speed. */
	dragLimited: boolean;
	/** True for every taller gear past the wall: it can never pull to its peak. */
	overdrive: boolean;
	/** Badge key for the V-Max cell, null when the gear is clean. */
	badgeKey: 'status.wall' | 'status.overdrive' | null;
	/** True when the Shift Advisory must read the eco verdict instead of an RPM. */
	ecoShift: boolean;
}

/** Shift Advisory classification for one gear. */
export interface GearAdvisory {
	/** Text rendered in the Shift Advisory cell. */
	text: string;
	/** Badge key shown next to the text, null when the advisory is plain. */
	badgeKey: 'status.redline' | null;
	/** True when the advisory is the eco verdict rather than an RPM target. */
	eco: boolean;
}

/**
 * Classify how one gear relates to the aerodynamic wall.
 *
 * Badge rule: the wall comes from dragLimitedSpeedKmh(availableWheelKw(...), ...)
 * and only when the aero layer is enabled. `firstOverWallIndex` is the lowest
 * gear whose theoretical V-Max exceeds that wall (gear sets are strictly
 * decreasing, so every taller gear does too). That first gear is drag-limited:
 * its cell shows the wall speed plus a `status.wall` badge, and the caller puts
 * the theoretical value in the cell `title`. Every taller gear is an overdrive
 * ratio — struck through and badged `status.overdrive`, with `status.eco` as its
 * Shift Advisory. Gears below the wall, and every gear when the wall is unknown
 * (aero layer off, or an unparseable tire reached renderTable), stay clean.
 * @param index Zero-based gear index of the row being rendered.
 * @param theoreticalDisplay Theoretical V-Max in the active display unit.
 * @param wallKmh Drag-limited speed in km/h, null when no wall applies.
 * @param firstOverWallIndex Lowest gear index past the wall, null when none.
 * @param unit Active display unit, used to express the wall speed.
 * @return Classification for the V-Max cell and the shift advisory.
 */
export const classifyGearVmax = (
	index: number,
	theoreticalDisplay: number,
	wallKmh: number | null,
	firstOverWallIndex: number | null,
	unit: SpeedUnit,
): GearVmaxStatus => {
	const clean: GearVmaxStatus = {
		theoreticalDisplay,
		display: theoreticalDisplay,
		dragLimited: false,
		overdrive: false,
		badgeKey: null,
		ecoShift: false,
	};
	if (wallKmh === null || firstOverWallIndex === null || index < firstOverWallIndex) {
		return clean;
	}
	if (index === firstOverWallIndex) {
		return { ...clean, display: toDisplaySpeed(wallKmh, unit), dragLimited: true, badgeKey: 'status.wall' };
	}
	return { ...clean, overdrive: true, badgeKey: 'status.overdrive', ecoShift: true };
};

/**
 * Format the Shift Advisory cell of one gear.
 * @brief Gears below the wall keep the optimal-shift RPM, flagged REDLINE when the
 * @brief optimal shift already sits on the limiter; overdrive gears read ECO instead.
 * @param shiftRpm Optimal shift RPM for this gear, null for the top gear or an invalid curve.
 * @param atRedline True when the optimal shift already hits the rev limiter.
 * @param ecoShift True when the gear is an overdrive ratio past the wall.
 * @return Advisory text plus the badge to render next to it.
 */
export const formatGearAdvisory = (
	shiftRpm: number | null,
	atRedline: boolean,
	ecoShift: boolean,
): GearAdvisory => {
	if (ecoShift) {
		return { text: t('status.eco'), badgeKey: null, eco: true };
	}
	if (shiftRpm === null) {
		return { text: '-', badgeKey: null, eco: false };
	}
	if (atRedline) {
		return { text: `${Math.round(shiftRpm)} LIMIT`, badgeKey: 'status.redline', eco: false };
	}
	return { text: `${Math.round(shiftRpm)} rpm`, badgeKey: null, eco: false };
};
