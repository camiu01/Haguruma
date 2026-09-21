/**
 * @file theme-events.test.ts
 * @brief Unit tests for the single theme toggle cycle helper.
 */
import { describe, expect, it } from 'vitest';
import { nextTheme } from '../src/services/events/theme-events';

describe('nextTheme', () => {
	it('cycles dark -> oled -> light -> dark', () => {
		expect(nextTheme('dark')).toBe('oled');
		expect(nextTheme('oled')).toBe('light');
		expect(nextTheme('light')).toBe('dark');
	});
});
