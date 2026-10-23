/**
 * @file dynamics-settings.ts
 * @brief Optional v0.7 dynamics controls and backward-compatible defaults.
 */
export interface DynamicsSettings {
	/** Fuel cut strategy, with 150 RPM hysteresis for bounce mode. */
	limiter: 'hard' | 'bounce';
	/** Gearbox default delay when no per-gear override is supplied. */
	gearbox: 'synchro' | 'dog';
	/** Use the selected gearbox default instead of the legacy global delay. */
	useGearboxDefaults: boolean;
	/** Delay per departing gear, seconds; empty retains the legacy global delay. */
	shiftTimesS: number[];
	/** Use the normalized torque/load efficiency map. */
	efficiencyMap: boolean;
	/** Enable individual-wheel ABS modulation. */
	abs: boolean;
	/** Front hydraulic brake force share. */
	brakeFrontBias: number;
	/** Pedal demand, expressed as a multiple of vehicle weight. */
	brakeDemandG: number;
	/** Match engine RPM before engaging a downshift. */
	revMatch: boolean;
	/** Corner radius in metres for the apex advisor. */
	cornerRadiusM: number;
	/** Available sustained cornering acceleration in g. */
	cornerMaxG: number;
	/** One-based gear entering the corner. */
	approachGear: number;
	/** Initial speed for the timed lap sequence, always km/h. */
	sequenceSpeedKmh: number;
	/** CSV commands: seconds, one-based gear, throttle fraction, brake g. */
	sequenceCsv: string;
	/** Plot mode; braking has distance on X and road speed on Y. */
	graphView: 'rpm' | 'force' | 'braking';
	/** Overlay the positive excess force on the force plot. */
	tractionOverlay: boolean;
}

export const defaultDynamicsSettings: DynamicsSettings = {
	limiter: 'hard', gearbox: 'synchro', useGearboxDefaults: true, shiftTimesS: [], efficiencyMap: true,
	abs: true, brakeFrontBias: 0.65, brakeDemandG: 1.4, revMatch: true,
	cornerRadiusM: 50, cornerMaxG: 1, approachGear: 4, sequenceSpeedKmh: 100,
	sequenceCsv: '2,4,0,0\n2,3,0,0\n3,3,0,1.4\n3,2,0.7,0',
	graphView: 'rpm', tractionOverlay: false,
};
