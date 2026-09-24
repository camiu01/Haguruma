/**
 * @file models.ts
 * @brief Shared domain models for HAGURUMA.
 */
import type { CornerPhase, HandlingIssue } from './setup/setup-matrix';

/** Supported speed display units. */
export type SpeedUnit = 'kmh' | 'mph';

/** Supported power display units (metric horsepower vs kilowatts). */
export type PowerUnit = 'kw' | 'cv';

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

/** Driven axle layout. */
export type DrivetrainLayout = 'FWD' | 'RWD' | 'AWD';

/** Differential behaviour model. */
export type DifferentialType = 'open' | 'clutch_lsd' | 'torsen' | 'spool';

/**
 * Chassis and running-gear parameters for load-transfer physics.
 * @brief Weight distribution, geometry, grip and suspension inputs.
 */
export interface RunningGear {
	/** Front static weight share, range [0.3, 0.7]. */
	frontWeightDistribution: number;
	/** Center-of-gravity height in mm, range [200, 800]. */
	centerOfGravityHeightMm: number;
	/** Wheelbase in mm, range [2000, 3500]. */
	wheelbaseMm: number;
	/** Track width in mm, range [1200, 1800]. */
	trackWidthMm: number;
	/** Road friction coefficient, range [0.5, 1.6]. */
	roadFrictionCoefficient: number;
	/** Driven axle layout. */
	drivetrainLayout: DrivetrainLayout;
	/** Differential behaviour model. */
	differentialType: DifferentialType;
	/** Clutch LSD lock bias (accel side), range [0, 1] (0 open-like, 1 spool-like). */
	differentialBias: number;
	/** Coast/release-side lock strength for advanced LSD models, range [0, 1]. */
	differentialCoastBias?: number;
	/** Catalog id from diff-presets (open, lsd_1way, lsd_1_5way, lsd_2way, …). */
	differentialModelId?: string;
	/** Front spring rate per corner in N/mm, range [10, 120]. */
	springRateFrontNmm: number;
	/** Rear spring rate per corner in N/mm, range [10, 120]. */
	springRateRearNmm: number;
	/** Sustained lateral acceleration in g, range [0, 2]. */
	lateralG: number;
	/** Downforce lift coefficient (dimensionless, e.g. 0.15 road, 1.2 aero). */
	liftCoefficient?: number;
	/** Reference area for downforce in square metres (defaults to drag area). */
	liftReferenceAreaM2?: number;
	/** Downforce front share, range [0, 1] (defaults to front weight share). */
	downforceFrontShare?: number;
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
	/** Equivalent rotating driveline mass in kilograms (accel solver). */
	rotatingMassKg?: number;
	/** Torque-interruption duration per upshift in seconds (accel solver). */
	shiftTimeS?: number;
	/** Chassis and running-gear parameters for load-transfer physics. */
	runningGear?: RunningGear;
}

/**
 * Wizard selection for the setup troubleshooting matrix.
 * @brief Phase + issue pair driving the ranked fix list.
 */
export interface SetupGuideSelection {
	/** Corner phase selected in the wizard. */
	phase: CornerPhase;
	/** Handling issue selected in the wizard. */
	issue: HandlingIssue;
}

/**
 * Global mutable UI state, kept in a single store object.
 * @brief Single source of truth shared by all renderers.
 */
export interface AppState {
	/** Active display unit. */
	unit: SpeedUnit;
	/** Active power display unit (state stores kW). */
	powerUnit: PowerUnit;
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
	/** Secondary vehicle mass in kilograms for road-load estimates. */
	compMassKg: number;
	/** Secondary aerodynamic drag coefficient. */
	compCd: number;
	/** Secondary frontal area in square metres. */
	compFrontalAreaM2: number;
	/** Secondary engine crank power in kilowatts. */
	compPowerKw: number;
	/** Secondary RPM of peak engine torque. */
	compPeakTorqueRpm: number;
	/** Secondary peak engine torque in Nm. */
	compPeakTorqueNm: number;
	/** Secondary RPM of peak engine power. */
	compPeakPowerRpm: number;
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
	/** Equivalent rotating driveline mass in kilograms (accel solver). */
	rotatingMassKg: number;
	/** Torque-interruption duration per upshift in seconds (accel solver). */
	shiftTimeS: number;
	/** Primary chassis and running-gear parameters. */
	runningGear: RunningGear;
	/** Secondary chassis and running-gear parameters. */
	compRunningGear: RunningGear;
	/** Setup wizard selection (phase + issue). */
	setupGuide: SetupGuideSelection;
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
