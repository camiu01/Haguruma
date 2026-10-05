/**
 * @file drivetrain-map.ts
 * @brief Bilinear load/RPM loss map calibrated to a user's nominal efficiency.
 */
import type { DrivetrainLayout } from '../models';

/** Normalized operating points, not manufacturer-measured efficiency data. */
export const EFFICIENCY_RPM_AXIS = [0, 0.25, 0.5, 0.75, 1];
export const EFFICIENCY_LOAD_AXIS = [0, 0.25, 0.5, 0.75, 1];
/** Relative efficiency multipliers: rows are RPM, columns are torque load. */
export const EFFICIENCY_MAP = [
	[0.84, 0.94, 0.98, 1, 1],
	[0.82, 0.93, 0.98, 1, 1],
	[0.79, 0.92, 0.97, 0.995, 1],
	[0.75, 0.89, 0.95, 0.98, 0.99],
	[0.70, 0.85, 0.92, 0.96, 0.98],
];

/**
 * @brief Interpolate losses against normalized engine speed and torque load.
 * @param nominal User-calibrated full-load efficiency.
 * @param rpm Engine speed.
 * @param redline Engine speed normalization.
 * @param torqueNm Delivered crank torque.
 * @param referenceTorqueNm Rated peak torque.
 * @param layout Driven axle layout, affecting parasitic loss sensitivity.
 * @return Efficiency in [0, 1], or zero for invalid required inputs.
 */
export const drivetrainEfficiencyAt = (
	nominal: number, rpm: number, redline: number, torqueNm: number,
	referenceTorqueNm: number, layout: DrivetrainLayout = 'RWD',
): number => {
	if (![nominal, rpm, redline, torqueNm, referenceTorqueNm].every(Number.isFinite)
		|| nominal <= 0 || redline <= 0 || referenceTorqueNm <= 0 || rpm < 0 || torqueNm < 0) return 0;
	const x = Math.min(1, rpm / redline) * 4;
	const y = Math.min(1, torqueNm / referenceTorqueNm) * 4;
	const i = Math.min(3, Math.floor(x));
	const j = Math.min(3, Math.floor(y));
	const a = EFFICIENCY_MAP[i][j] * (1 - y + j) + EFFICIENCY_MAP[i][j + 1] * (y - j);
	const b = EFFICIENCY_MAP[i + 1][j] * (1 - y + j) + EFFICIENCY_MAP[i + 1][j + 1] * (y - j);
	const multiplier = a * (1 - x + i) + b * (x - i);
	const sensitivity = layout === 'AWD' ? 1.2 : layout === 'FWD' ? 0.85 : 1;
	return Math.max(0, Math.min(1, nominal * (1 - (1 - multiplier) * sensitivity)));
};
