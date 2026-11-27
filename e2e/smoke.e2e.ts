/**
 * @file smoke.e2e.ts
 * @brief Boot, render and CSP smoke test against the production build.
 *
 * Catches regressions the unit suite cannot see: a bootstrap exception, a
 * shell that never injects, an empty plot, or a Content Security Policy that
 * blocks the app's own scripts or styles.
 */
import { expect, test } from '@playwright/test';

test('boots, renders the plot and raises no console errors', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', (err) => errors.push(err.message));
	page.on('console', (msg) => {
		if (msg.type() === 'error') {
			errors.push(msg.text());
		}
	});
	await page.goto('/');
	await expect(page.locator('#graph-svg line').first()).toBeAttached();
	await expect(page.locator('#kpi-top-speed')).not.toBeEmpty();
	expect(errors.filter((e) => !e.includes('fonts.g'))).toEqual([]);
});

test('applies the stored theme before the app boots', async ({ page }) => {
	await page.addInitScript(() => localStorage.setItem('haguruma-theme', 'light'));
	await page.goto('/');
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
	await expect(page.locator('html')).not.toHaveClass(/\bdark\b/);
});

test('ships a Content Security Policy', async ({ page }) => {
	await page.goto('/');
	const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
	expect(csp).toContain("script-src 'self'");
	expect(csp).toContain("object-src 'none'");
});
