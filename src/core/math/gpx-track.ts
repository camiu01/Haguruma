/**
 * @file gpx-track.ts
 * @brief Offline GPX geometry for straight lengths and corner radii.
 */
export interface TrackPoint { lat: number; lon: number }

/**
 * @brief Great-circle distance for GPX coordinates.
 * @param a First coordinate.
 * @param b Second coordinate.
 * @return Distance in metres.
 */
export const trackDistanceM = (a: TrackPoint, b: TrackPoint): number => {
	const rad = Math.PI / 180;
	const h = Math.sin((b.lat - a.lat) * rad / 2) ** 2
		+ Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin((b.lon - a.lon) * rad / 2) ** 2;
	return 6371000 * 2 * Math.asin(Math.sqrt(Math.max(0, Math.min(1, h))));
};

/**
 * @brief Read trackpoints without executing XML or resolving external entities.
 * @param text GPX source, capped at 5 MB.
 * @return Valid bounded coordinates.
 */
export const parseGpxTrack = (text: string): TrackPoint[] => {
	if (text.length > 5_000_000 || /<!DOCTYPE|<!ENTITY/i.test(text)) return [];
	const points: TrackPoint[] = [];
	for (const match of text.matchAll(/<(?:\w+:)?trkpt\b([^>]*)>/g)) {
		const lat = Number(/\blat\s*=\s*['"]([^'"]+)['"]/.exec(match[1])?.[1].trim() || NaN);
		const lon = Number(/\blon\s*=\s*['"]([^'"]+)['"]/.exec(match[1])?.[1].trim() || NaN);
		if (Number.isFinite(lat) && Math.abs(lat) <= 90 && Number.isFinite(lon) && Math.abs(lon) <= 180) points.push({ lat, lon });
		if (points.length >= 50000) break;
	}
	return points;
};

/**
 * @brief Estimate a track archetype from sampled GPX bends.
 * @param points Ordered track coordinates.
 * @return Total length, longest sampled segment/straight and tightest corner radius.
 */
export const summarizeTrack = (points: TrackPoint[]): { lengthM: number; longestSegmentM: number; longestStraightM: number; minRadiusM: number | null } => {
	let lengthM = 0;
	let longestSegmentM = 0;
	let longestStraightM = 0;
	let straightM = 0;
	let straightTurn = 0;
	let minRadiusM = Infinity;
	for (let i = 1; i < points.length; i += 1) {
		const a = trackDistanceM(points[i - 1], points[i]);
		lengthM += a;
		longestSegmentM = Math.max(longestSegmentM, a);
		if (i < 2) { straightM = a; longestStraightM = a; continue; }
		const b = trackDistanceM(points[i - 2], points[i - 1]);
		const c = trackDistanceM(points[i - 2], points[i]);
		const s = (a + b + c) / 2;
		const area = Math.sqrt(Math.max(0, s * (s - a) * (s - b) * (s - c)));
		const turn = a > 0 && b > 0 ? Math.PI - Math.acos(Math.max(-1, Math.min(1, (a * a + b * b - c * c) / (2 * a * b)))) : 0;
		if (straightTurn + turn <= Math.PI / 36) { straightM += a; straightTurn += turn; }
		else { straightM = a; straightTurn = 0; }
		longestStraightM = Math.max(longestStraightM, straightM);
		if (area > 0.1 && Math.min(a, b) >= 5) minRadiusM = Math.min(minRadiusM, a * b * c / (4 * area));
	}
	return { lengthM, longestSegmentM, longestStraightM, minRadiusM: Number.isFinite(minRadiusM) ? minRadiusM : null };
};
