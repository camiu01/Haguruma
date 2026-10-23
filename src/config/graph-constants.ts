/**
 * @file graph-constants.ts
 * @brief SVG plot geometry, per-theme palettes and gear limits for the RPM graph.
 *
 * Geometry lives in SVG user units of the fixed 16:9 viewBox shared with the
 * static `#graph-svg` markup, so every layer builds on the same coordinate
 * system with no measurement step.
 */

/** Plot inset in SVG user units (top room for callouts, right for the power axis). */
export const GRAPH_PADDING = {
	top: 34,
	right: 74,
	bottom: 48,
	left: 62,
} as const;

/** Fixed 16:9 viewBox of `#graph-svg`; every layer uses these units. */
export const GRAPH_VIEWBOX = {
	width: 1000,
	height: 562.5,
} as const;

export const GRAPH_STYLE = {
	grid: '#1e2430',
	gridFine: '#151a23',
	axisText: '#64748b',
	redlineFill: 'rgba(239, 68, 68, 0.08)',
	redlineLine: 'rgba(239, 68, 68, 0.8)',
	shiftDrop: 'rgba(239, 68, 68, 0.6)',
	compare: '#fbbf24',
	background: '#0c0e12',
	aero: '#38bdf8',
	aeroFill: 'rgba(56, 189, 248, 0.06)',
	grip: '#f59e0b',
	gripCompare: '#ef4444',
	power: '#a78bfa',
	powerLoad: '#f472b6',
	spinFill: 'rgba(239, 68, 68, 0.10)',
} as const;

export const GRAPH_STYLE_LIGHT = {
	grid: '#e2e8f0',
	gridFine: '#f1f5f9',
	axisText: '#64748b',
	redlineFill: 'rgba(239, 68, 68, 0.08)',
	redlineLine: 'rgba(239, 68, 68, 0.8)',
	shiftDrop: 'rgba(217, 119, 6, 0.55)',
	compare: '#d97706',
	background: '#ffffff',
	aero: '#0284c7',
	aeroFill: 'rgba(2, 132, 199, 0.06)',
	grip: '#b45309',
	gripCompare: '#dc2626',
	power: '#7c3aed',
	powerLoad: '#db2777',
	spinFill: 'rgba(220, 38, 38, 0.10)',
} as const;

export const GRAPH_STYLE_OLED = {
	grid: '#27272a',
	gridFine: '#18181b',
	axisText: '#a1a1aa',
	redlineFill: 'rgba(239, 68, 68, 0.10)',
	redlineLine: 'rgba(239, 68, 68, 0.9)',
	shiftDrop: 'rgba(239, 68, 68, 0.7)',
	compare: '#fbbf24',
	background: '#000000',
	aero: '#38bdf8',
	aeroFill: 'rgba(56, 189, 248, 0.08)',
	grip: '#f59e0b',
	gripCompare: '#ef4444',
	power: '#c4b5fd',
	powerLoad: '#f9a8d4',
	spinFill: 'rgba(239, 68, 68, 0.12)',
} as const;

/** Stroke widths in SVG user units, shared by every plot layer. */
export const GRAPH_STROKE = {
	/** Coarse grid line. */
	grid: 1.1,
	/** Fine background texture line. */
	fineGrid: 0.6,
	/** Axis baseline. */
	axis: 1.6,
	/** Solid gear ray. */
	ray: 3.4,
	/** Faded ray section past the aero wall. */
	rayFaded: 2.4,
	/** Grip and power limit curves. */
	limit: 2.2,
	/** Aero-wall marker line. */
	wall: 2.6,
	/** Shift-drop connector. */
	connector: 1.8,
	/** Marker dot radius. */
	marker: 4.4,
} as const;

/** Base font sizes in rem-equivalent units at the reference viewport width. */
const GRAPH_FONT_REM = {
	/** Axis tick labels. */
	axis: 0.75,
	/** Axis titles. */
	title: 0.8125,
	/** Gear and callout tags. */
	tag: 0.75,
	/** Annotation labels. */
	callout: 0.6875,
} as const;

/** Graph label roles supported by the responsive font calculator. */
export type GraphFontRole = keyof typeof GRAPH_FONT_REM;

/**
 * @brief Resolve responsive SVG text size from the measured plot viewport.
 * @param width Plot width in CSS pixels.
 * @param role Semantic graph text role.
 * @return Font size in SVG user units, clamped for mobile readability.
 */
export const graphFontSize = (width: number, role: GraphFontRole): number => {
	const remPixels = GRAPH_FONT_REM[role] * 16;
	const viewportScale = Math.max(0.92, Math.min(1.15, width / 900));
	return Number((remPixels * viewportScale).toFixed(2));
};

export const GRAPH_LIMITS = {
	maxGears: 8,
	minGearRatio: 0.4,
	maxGearRatio: 6.0,
	rpmStep: 1000,
	/** Cell size of the fine background grid texture in user units. */
	fineGridStep: 10,
} as const;
