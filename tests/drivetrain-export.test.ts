/**
 * @file drivetrain-export.test.ts
 * @brief Unit tests for the sim-racing drivetrain exporter.
 */
import { describe, expect, it } from 'vitest';
import { buildAssettoCorsaIni, buildDrivetrainJson, parseAssettoCorsaIni } from '../src/services/graph/drivetrain-export';

describe('buildAssettoCorsaIni', () => {
	it('emits one GEAR line per ratio plus final and count', () => {
		const ini = buildAssettoCorsaIni({ gears: [3.363, 1.947], fd: 4.322, reverseRatio: 3.083, label: 'Eclipse' });
		expect(ini).toContain('GEAR_1=3.363');
		expect(ini).toContain('GEAR_2=1.947');
		expect(ini).toContain('FINAL=4.322');
		expect(ini).toContain('REVERSE=3.083');
		expect(ini).toContain('COUNT=2');
	});
	it('omits reverse when null', () => {
		const ini = buildAssettoCorsaIni({ gears: [3.0], fd: 4.1, reverseRatio: null, label: 'x' });
		expect(ini).not.toContain('REVERSE');
	});
});

describe('buildDrivetrainJson', () => {
	it('round-trips gears and final drive', () => {
		const raw = buildDrivetrainJson({ gears: [3.363, 1.947], fd: 4.322, reverseRatio: null, label: 'Eclipse' });
		const parsed = JSON.parse(raw) as { gears: number[]; finalDrive: number };
		expect(parsed.gears).toEqual([3.363, 1.947]);
		expect(parsed.finalDrive).toBeCloseTo(4.322, 3);
	});
});

describe('parseAssettoCorsaIni', () => {
	it('round-trips an exported payload', () => {
		const ini = buildAssettoCorsaIni({ gears: [3.363, 1.947, 1.285], fd: 4.322, reverseRatio: 3.083, label: 'Eclipse' });
		const back = parseAssettoCorsaIni(ini);
		expect(back?.gears).toEqual([3.363, 1.947, 1.285]);
		expect(back?.fd).toBeCloseTo(4.322, 3);
		expect(back?.reverseRatio).toBeCloseTo(3.083, 3);
	});
	it('ignores sections, comments and unknown keys', () => {
		const back = parseAssettoCorsaIni('[GEARS]\n; comment\nGEAR_1=3.000\nGEAR_2=2.000\nFINAL=4.100\nCOUNT=2\nFOO=9\n');
		expect(back?.gears).toEqual([3.0, 2.0]);
		expect(back?.reverseRatio).toBeNull();
	});
	it('rejects missing final drive and empty gears', () => {
		expect(parseAssettoCorsaIni('')).toBeNull();
		expect(parseAssettoCorsaIni('[GEARS]\nGEAR_1=3.0\n')).toBeNull();
		expect(parseAssettoCorsaIni('[GEARS]\nFINAL=4.1\n')).toBeNull();
	});
});
