/**
 * @file curve-share.ts
 * @brief Bounded verbose dyno-curve serialization shared by legacy and compact URLs.
 */
import { sanitizeTorquePoints } from '../math/engine-curve-core';
import { MAX_CURVE_POINTS, resampleTorquePoints } from '../math/dyno-csv';
import type { TorqueCurvePoint } from '../models';

/**
 * @brief Serialize dyno points as rpm:torque pairs joined by semicolons.
 * @param points Sanitized torque points.
 * @return Compact decimal-dot curve string.
 */
export const encodeCurvePoints = (points: TorqueCurvePoint[]): string => {
	return points.map((p) => `${Math.round(p.rpm)}:${p.torqueNm.toFixed(1)}`).join(';');
};

/**
 * @brief Decode and resample verbose dyno curves to the supported point cap.
 * @param raw RPM/torque pairs.
 * @return Sanitized points, null for unusable input.
 */
export const decodeCurvePoints = (raw: string): TorqueCurvePoint[] | null => {
	const points: TorqueCurvePoint[] = [];
	for (const pair of raw.split(';')) {
		const cells = pair.split(':');
		if (cells.length !== 2) continue;
		const rpm = Number(cells[0]);
		const torqueNm = Number(cells[1]);
		if (Number.isFinite(rpm) && Number.isFinite(torqueNm)) points.push({ rpm, torqueNm });
	}
	const sanitized = sanitizeTorquePoints(points);
	return sanitized ? resampleTorquePoints(sanitized, MAX_CURVE_POINTS) : null;
};
