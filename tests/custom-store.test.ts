/**
 * @file custom-store.test.ts
 * @brief Unit tests for gear list parsing and custom preset storage fallback.
 */
import { describe, expect, it } from 'vitest';
import { CUSTOM_PREFIX, loadCustomPresets, parseGearsInput, slugify } from '../src/core/presets/custom-store';

describe('parseGearsInput', () => {
	it('parses comma separated ratios', () => {
		expect(parseGearsInput('3.363, 1.947, 0.756')).toEqual([3.363, 1.947, 0.756]);
	});
	it('accepts spaces and semicolons', () => {
		expect(parseGearsInput('3.363 1.947;0.756')).toEqual([3.363, 1.947, 0.756]);
	});
	it('rejects empty and non-positive input', () => {
		expect(parseGearsInput('')).toBeNull();
		expect(parseGearsInput('3.363, 0, 0.756')).toBeNull();
		expect(parseGearsInput('3.363, abc')).toBeNull();
	});
});

describe('slugify', () => {
	it('lowercases and dashes names', () => {
		expect(slugify('Eclipse 1G GS')).toBe('eclipse-1g-gs');
	});
	it('returns empty for unusable names', () => {
		expect(slugify('   ')).toBe('');
	});
});

describe('custom preset storage', () => {
	it('exposes the dropdown prefix', () => {
		expect(CUSTOM_PREFIX).toBe('custom:');
	});
	it('falls back to empty without a DOM', () => {
		expect(loadCustomPresets()).toEqual({});
	});
});
