/**
 * @file accordion-height.test.ts
 * @brief Regression tests for the accordion open-height sync (content clip fix).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { syncAccordionHeight, syncOpenAccordionHeights } from '../src/services/dom/accordion-height';

/**
 * Build a minimal content stub exposing only the properties the sync reads.
 * @param open Whether the section carries the `open` class.
 * @param height Reported scroll height in pixels.
 * @return Stub cast to HTMLElement.
 */
const stub = (open: boolean, height = 1842): HTMLElement =>
	({
		classList: {
			contains: (name: string): boolean => name === 'open' && open,
		},
		style: { maxHeight: '' },
		scrollHeight: height,
	}) as unknown as HTMLElement;

describe('syncAccordionHeight', () => {
	it('writes the content height on open sections', () => {
		const content = stub(true, 1842);
		syncAccordionHeight(content);
		expect(content.style.maxHeight).toBe('1842px');
	});
	it('clears the inline height on closed sections', () => {
		const content = stub(false, 1842);
		content.style.maxHeight = '1842px';
		syncAccordionHeight(content);
		expect(content.style.maxHeight).toBe('');
	});
});

describe('syncOpenAccordionHeights', () => {
	it('measures every open child of the given scope', () => {
		const tall = stub(true, 2400);
		const short = stub(true, 640);
		const closed = stub(false, 0);
		const root = {
			querySelectorAll: (): HTMLElement[] => [tall, short, closed],
		} as unknown as ParentNode;
		syncOpenAccordionHeights(root);
		expect(tall.style.maxHeight).toBe('2400px');
		expect(short.style.maxHeight).toBe('640px');
		expect(closed.style.maxHeight).toBe('');
	});
});

describe('accordion stylesheet', () => {
	const css = readFileSync(join(process.cwd(), 'src/styles/components.css'), 'utf8');

	it('leaves open sections unbounded so content is never clipped', () => {
		const openRule = css.match(/\.section-content\.open\s*\{([^}]*)\}/);
		expect(openRule).not.toBeNull();
		expect(openRule?.[1]).toContain('max-height: none');
	});
	it('keeps the collapsed state at zero height', () => {
		const closedRule = css.match(/\.section-content\s*\{([^}]*)\}/);
		expect(closedRule?.[1]).toContain('max-height: 0');
	});
	it('no longer carries the fixed 1600px cap', () => {
		expect(css).not.toContain('1600px');
		const guide = readFileSync(join(process.cwd(), 'src/styles/setup-guide.css'), 'utf8');
		expect(guide).not.toContain('8000px');
	});
});
