/**
 * @file graph-constants.ts
 * @brief Canvas layout and style constants for the RPM graph.
 *
 * Centralizes the magic numbers behind plotting geometry and gear limits.
 */
export const GRAPH_PADDING = {
	top: 25,
	right: 30,
	bottom: 40,
	left: 55,
} as const;

export const GRAPH_STYLE = {
	grid: '#1e2430',
	axisText: '#64748b',
	redlineFill: 'rgba(239, 68, 68, 0.08)',
	redlineLine: 'rgba(239, 68, 68, 0.8)',
	shiftDrop: 'rgba(239, 68, 68, 0.6)',
	compare: '#fbbf24',
	background: '#0c0e12',
} as const;

export const GRAPH_STYLE_LIGHT = {
	grid: '#e2e8f0',
	axisText: '#64748b',
	redlineFill: 'rgba(239, 68, 68, 0.08)',
	redlineLine: 'rgba(239, 68, 68, 0.8)',
	shiftDrop: 'rgba(239, 68, 68, 0.6)',
	compare: '#d97706',
	background: '#ffffff',
} as const;

export const GRAPH_STYLE_OLED = {
	grid: '#27272a',
	axisText: '#a1a1aa',
	redlineFill: 'rgba(239, 68, 68, 0.10)',
	redlineLine: 'rgba(239, 68, 68, 0.9)',
	shiftDrop: 'rgba(239, 68, 68, 0.7)',
	compare: '#fbbf24',
	background: '#000000',
} as const;

export const GRAPH_LIMITS = {
	maxGears: 8,
	minGearRatio: 0.4,
	maxGearRatio: 6.0,
	rpmStep: 1000,
} as const;
