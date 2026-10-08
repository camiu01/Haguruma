/**
 * @file gpx-track.ts
 * @brief Dependency-free GPX parsing with corner/straight summaries.
 * @brief Reads trkpt latitude/longitude/elevation triples with plain regex
 * @brief (no DOM parser, so it also runs in tests), rebuilds the centre-line
 * @brief distance, splits it into straights and corners by heading stability
 * @brief and reports the longest straights plus corner lengths used to seed
 * @brief the target-track gear presets.
 */

/** One GPX track point. */
export interface GpxPoint {
	/** Latitude in decimal degrees. */
	lat: number;
	/** Longitude in decimal degrees. */
	lon: number;
	/** Elevation in metres. */
	ele: number;
}

/** Straight segment of the centre line. */
export interface TrackStraight {
	/** Distance from lap start in metres. */
	startM: number;
	/** Segment length in metres. */
	lengthM: number;
}

/** Corner segment of the centre line. */
export interface TrackCorner {
	/** Distance of the corner midpoint from lap start in metres. */
	apexM: number;
	/** Segment length in metres. */
	lengthM: number;
}

/** Track summary seeding the gear presets. */
export interface TrackSummary {
	/** Total centre-line length in metres. */
	totalM: number;
	/** Straights sorted longest-first. */
	straights: TrackStraight[];
	/** Corners in track order. */
	corners: TrackCorner[];
	/** Longest straight in metres, 0 when empty. */
	longestStraightM: number;
}

/** Mean Earth radius in metres. */
const EARTH_RADIUS_M = 6371000;

/** Heading change per metre marking a corner (about 1.1 deg per 20 m). */
const CORNER_CURVATURE = 0.001;

/** Segments shorter than this merge into their neighbour. */
const MIN_SEGMENT_M = 25;

/**
 * @brief Haversine distance between two coordinates.
 * @param a First point.
 * @param b Second point.
 * @return Distance in metres.
 */
const haversineM = (a: GpxPoint, b: GpxPoint): number => {
	const toRad = (deg: number): number => (deg * Math.PI) / 180;
	const dLat = toRad(b.lat - a.lat);
	const dLon = toRad(b.lon - a.lon);
	const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
	return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
};

/**
 * @brief Bearing from one point to the next.
 * @param a First point.
 * @param b Second point.
 * @return Bearing in radians, 0 pointing north.
 */
const bearing = (a: GpxPoint, b: GpxPoint): number => {
	const toRad = (deg: number): number => (deg * Math.PI) / 180;
	const dLon = toRad(b.lon - a.lon);
	const y = Math.sin(dLon) * Math.cos(toRad(b.lat));
	const x = Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
		Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(dLon);
	return Math.atan2(y, x);
};

/**
 * @brief Parse GPX track points with plain regex.
 * @param text Raw GPX file text.
 * @return Point list in file order, or null when no valid points exist.
 */
export const parseGpx = (text: string): GpxPoint[] | null => {
	if (!text || typeof text !== 'string') {
		return null;
	}
	const out: GpxPoint[] = [];
	const pointRegex = /<trkpt[^>]*lat="([^"]+)"[^>]*lon="([^"]+)"[^>]*>([\s\S]*?)<\/trkpt>/g;
	let match = pointRegex.exec(text);
	while (match) {
		const lat = parseFloat(match[1]);
		const lon = parseFloat(match[2]);
		const eleMatch = match[3].match(/<ele>([^<]+)<\/ele>/);
		const ele = eleMatch ? parseFloat(eleMatch[1]) : 0;
		if (Number.isFinite(lat) && Number.isFinite(lon)) {
			out.push({ lat, lon, ele: Number.isFinite(ele) ? ele : 0 });
		}
		match = pointRegex.exec(text);
	}
	return out.length >= 2 ? out : null;
};

/**
 * @brief Summarize a point list into straights and corners.
 * @param points GPX track points in order.
 * @return Track summary, or null when the list is too short.
 */
export const summarizeTrack = (points: GpxPoint[]): TrackSummary | null => {
	if (!Array.isArray(points) || points.length < 3) {
		return null;
	}
	const dist: number[] = [0];
	for (let idx = 1; idx < points.length; idx += 1) {
		dist.push(dist[idx - 1] + haversineM(points[idx - 1], points[idx]));
	}
	const totalM = dist[dist.length - 1];
	if (!(totalM > 0)) {
		return null;
	}
	const cornerFlags: boolean[] = [false];
	for (let idx = 1; idx < points.length - 1; idx += 1) {
		const step = Math.max(1, dist[idx + 1] - dist[idx - 1]);
		let turn = Math.abs(bearing(points[idx - 1], points[idx]) - bearing(points[idx], points[idx + 1]));
		if (turn > Math.PI) {
			turn = 2 * Math.PI - turn;
		}
		cornerFlags.push(turn / step > CORNER_CURVATURE);
	}
	cornerFlags.push(false);
	const straights: TrackStraight[] = [];
	const corners: TrackCorner[] = [];
	let start = 0;
	let corner = cornerFlags[0];
	const flush = (end: number): void => {
		const length = dist[end] - dist[start];
		if (length < MIN_SEGMENT_M) {
			return;
		}
		if (corner) {
			corners.push({ apexM: Math.round((dist[start] + dist[end]) / 2), lengthM: Math.round(length) });
		} else {
			straights.push({ startM: Math.round(dist[start]), lengthM: Math.round(length) });
		}
	};
	for (let idx = 1; idx < cornerFlags.length; idx += 1) {
		if (cornerFlags[idx] !== corner) {
			flush(idx);
			start = idx;
			corner = cornerFlags[idx];
		}
	}
	flush(cornerFlags.length - 1);
	straights.sort((a, b) => b.lengthM - a.lengthM);
	return {
		totalM: Math.round(totalM),
		straights,
		corners,
		longestStraightM: straights.length > 0 ? straights[0].lengthM : 0,
	};
};
