/**
 * @file a11y.e2e.ts
 * @brief WCAG 2.1 AA gate (axe-core) for every theme, plus keyboard reachability.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

for (const theme of ['dark', 'oled', 'light']) {
	test(`${theme} theme has no WCAG A/AA violations`, async ({ page }) => {
		await page.addInitScript((value) => localStorage.setItem('haguruma-theme', value), theme);
		await page.goto('/');
		await expect(page.locator('#graph-svg line').first()).toBeAttached();
		const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
		const summary = results.violations.map((v) => `${v.id} (${v.nodes.length}): ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
		expect(summary).toEqual([]);
	});
}

test('the plot is keyboard-focusable and announces the snap readout', async ({ page }) => {
	await page.goto('/');
	const plot = page.locator('#graph-svg');
	await plot.focus();
	await expect(plot).toBeFocused();
	await page.keyboard.press('ArrowRight');
	await expect(page.locator('#graph-hud')).toHaveAttribute('aria-live', 'polite');
	await expect(page.locator('#graph-hud')).not.toBeEmpty();
});
