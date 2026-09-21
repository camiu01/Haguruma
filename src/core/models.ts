/**
 * @file models.ts
 * @brief Shared domain models for HAGURUMA.
 */

/** Supported speed display units. */
export type SpeedUnit = 'kmh' | 'mph';

/**
 * Parsed tire dimensions and derived circumference.
 * @brief Physical tire geometry used by speed formulas.
 */
export interface TireSpec {
	/** Section width in millimetres. */
	width: number;
	/** Sidewall height as percent of width. */
	aspect: number;
	/** Rim diameter in inches. */
	rimInch: number;
	/** Overall diameter in millimetres. */
	diameterMm: number;
	/** Rolling circumference in millimetres. */
	circumferenceMm: number;
	/** Rolling circumference in metres. */
	circumferenceM: number;
}

/**
 * Vehicle preset selectable from the header dropdown.
 * @brief Realistic starting point for tire, final drive and gears.
 */
export interface GearPreset {
	/** Tire spec string, e.g. 205/55R16. */
	tire: string;
	/** Differential ratio. */
	fd: number;
	/** Rev limiter in RPM. */
	redline: number;
	/** Forward gear ratios from first to top gear. */
	gears: number[];
	/** Reverse gear ratio, excluded from the graph curves. */
	reverseRatio?: number;
	/** Curb mass in kilograms used for road-load estimates. */
	massKg?: number;
	/** Aerodynamic drag coefficient. */
	dragCd?: number;
	/** Frontal area in square metres. */
	frontalAreaM2?: number;
	/** Engine crank power in kilowatts used for the drag limit. */
	powerKw?: number;
	/** RPM of peak engine torque. */
	peakTorqueRpm?: number;
	/** Peak engine torque in Nm. */
	peakTorqueNm?: number;
	/** RPM of peak engine power. */
	peakPowerRpm?: number;
}

/**
 * Global mutable UI state, kept in a single store object.
 * @brief Single source of truth shared by all renderers.
 */
export interface AppState {
	/** Active display unit. */
	unit: SpeedUnit;
	/** Primary tire spec string. */
	primaryTire: string;
	/** Primary differential ratio. */
	primaryFd: number;
	/** Primary rev limiter. */
	primaryRedline: number;
	/** Right edge of the graph X axis. */
	maxGraphSpeed: number;
	/** Gear ratios from first to top gear. */
	gears: number[];
	/** Reverse gear ratio, or null when unset. */
	reverseRatio: number | null;
	/** Whether the secondary overlay is visible. */
	compareEnabled: boolean;
	/** Secondary tire spec string. */
	compTire: string;
	/** Secondary differential ratio. */
	compFd: number;
	/** Secondary gear ratios from first to top gear. */
	compGears: number[];
	/** Secondary rev limiter. */
	compRedline: number;
	/** Whether the secondary road-load column is visible. */
	roadLoadEnabled: boolean;
	/** Vehicle mass in kilograms for rolling resistance. */
	vehicleMassKg: number;
	/** Aerodynamic drag coefficient. */
	dragCd: number;
	/** Frontal area in square metres. */
	frontalAreaM2: number;
	/** Rolling-resistance coefficient. */
	rollingCrr: number;
	/** Engine crank power in kilowatts (e.g. 110 for 150 cv). */
	enginePowerKw: number;
	/** Drivetrain efficiency between 0 and 1. */
	drivetrainEff: number;
	/** Road slope in percent (+uphill, -downhill) for grade resistance. */
	roadGradePercent: number;
	/** Loaded rolling-circumference factor (ISO/ETRTO ~0.975). */
	rollingFactor: number;
	/** RPM of peak engine torque (power-curve anchor). */
	peakTorqueRpm: number;
	/** Peak engine torque in Nm (power-curve anchor). */
	peakTorqueNm: number;
	/** RPM of peak engine power (power-curve anchor). */
	peakPowerRpm: number;
}

/**
 * Canvas plot area in CSS pixels.
 * @brief Pixel geometry plus data limits for coordinate mapping.
 */
export interface PlotFrame {
	/** Full canvas width in CSS pixels. */
	width: number;
	/** Full canvas height in CSS pixels. */
	height: number;
	/** Top padding for the redline label. */
	paddingTop: number;
	/** Right padding for the last tick. */
	paddingRight: number;
	/** Bottom padding for X labels. */
	paddingBottom: number;
	/** Left padding for Y labels. */
	paddingLeft: number;
	/** Drawable width between paddings. */
	plotWidth: number;
	/** Drawable height between paddings. */
	plotHeight: number;
	/** Right edge of the X axis in display units. */
	maxSpeed: number;
	/** Top edge of the Y axis in RPM. */
	maxRpm: number;
}

/**
 * Redline peak point of a single gear curve.
 * @brief Anchor for shift-drop connectors and markers.
 */
export interface PeakPoint {
	/** One-based gear number. */
	gear: number;
	/** Theoretical top speed at redline. */
	speed: number;
	/** Canvas X of the redline peak. */
	endX: number;
	/** Canvas Y of the redline peak. */
	endY: number;
	/** Gear ratio used for this curve. */
	ratio: number;
	/** Display color shared with table row. */
	color: string;
}
