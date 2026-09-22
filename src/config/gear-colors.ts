/**
 * Distinct color per gear curve and table row.
 * @purpose Keep gear identity consistent across graph and table.
 */
export const GEAR_COLORS: string[] = [
	'#ef4444',
	'#f97316',
	'#facc15',
	'#10b981',
	'#06b6d4',
	'#3b82f6',
	'#a855f7',
	'#ec4899',
];

/**
 * Resolve the display color for a gear index.
 * @purpose Wrap around the palette when more than 8 gears exist.
 * @param index Zero-based gear index.
 * @returns Hex color string.
 */
export const getGearColor = (index: number): string => {
	return GEAR_COLORS[index % GEAR_COLORS.length];
};
