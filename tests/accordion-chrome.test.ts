/**
 * @file accordion-chrome.test.ts
 * @brief Guards the unified accordion header and table cell chrome.
 *
 * The header recipe lives in one builder (`card/accordion-shell.ts`) and one
 * set of role classes; these checks keep the static templates and the table
 * renderers from drifting back to bespoke utility clusters.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string): string => readFileSync(join(process.cwd(), path), 'utf8');

/** Every static template fragment shipped with the app shell. */
const templateFiles = readdirSync(join(process.cwd(), 'src/templates'))
	.filter((name) => name.endsWith('.html'))
	.map((name) => `src/templates/${name}`);

const templateText = templateFiles.map(read).join('\n');
const toolShells = [
	'src/components/setup-guide.ts',
	'src/components/cruise-card.ts',
	'src/components/tire-size-tool.ts',
	'src/components/pyrometer-shell.ts',
].map(read);

describe('accordion header chrome', () => {
	it('keeps the retired accordion-header alias out of the codebase', () => {
		const stray = [...templateText.matchAll(/(?<!data-)accordion-header/g)];
		expect(stray).toHaveLength(0);
	});

	it('pairs every static header with the section-header class', () => {
		const headers = templateText.split('\n').filter((line) => line.includes('data-accordion-header'));
		expect(headers.length).toBeGreaterThan(5);
		for (const header of headers) {
			expect(header).toContain('section-header');
		}
	});

	it('builds injected headers from the shared shell only', () => {
		for (const tool of toolShells) {
			expect(tool).toContain('buildToolShell');
			expect(tool).not.toContain("'section-header'");
			expect(tool).not.toContain('accordionHeader');
		}
		const shell = read('src/components/card/accordion-shell.ts');
		expect(shell).toContain("'section-header'");
		expect(shell).toContain('accordionHeader');
	});

	it('renders header dots and notes through their role classes', () => {
		expect(templateText).not.toContain('w-2 h-2 rounded-full');
		expect(templateText).toContain('section-dot');
		expect(templateText).toContain('section-note');
	});

	it('keeps setup among the flat card-level shell headers', () => {
		const css = read('src/styles/components.css');
		const shells = [...css.matchAll(/\[data-accordion='vehicle'\][\s\S]*?\{/g)];
		expect(shells).toHaveLength(3);
		for (const rule of shells) {
			expect(rule[0]).toContain("[data-accordion='setup']");
		}
	});
});

describe('table cell chrome', () => {
	it('uses the th role for every gear table header cell', () => {
		const analysis = read('src/templates/analysis.html');
		expect(analysis).not.toContain('pb-2 font-medium');
		for (const header of analysis.match(/<th class='[^']*'/g) ?? []) {
			expect(header).toMatch(/<th class='th( |')/);
		}
	});

	it('uses the td role for every rendered table cell', () => {
		const rows = [
			read('src/components/gear-table.ts'),
			read('src/components/compare-table.ts'),
		].join('\n');
		expect(rows).not.toMatch(/<td class='py-2/);
		for (const cell of rows.match(/<td class='[^']*'/g) ?? []) {
			expect(cell).toMatch(/<td class='td( |')/);
		}
	});
});
