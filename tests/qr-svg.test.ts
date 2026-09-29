/**
 * @file qr-svg.test.ts
 * @brief Unit tests for the dependency-free QR Code SVG generator.
 */
import { describe, expect, it } from 'vitest';
import { qrSvg } from '../src/core/share/qr-svg';

describe('qrSvg', () => {
	it('renders a version-1 code with the finder origin first', () => {
		const svg = qrSvg('HELLO');
		expect(svg.startsWith('<svg')).toBe(true);
		expect(svg.endsWith('</svg>')).toBe(true);
		expect(svg).toContain('viewBox="0 0 116 116"');
		expect(svg).toContain('M16 16h4v4H16Z');
	});
	it('is deterministic and input-sensitive', () => {
		expect(qrSvg('ABC')).toBe(qrSvg('ABC'));
		expect(qrSvg('ABC')).not.toBe(qrSvg('ABD'));
	});
	it('keeps timing intact and skips finder-corner alignments', () => {
		const svg = qrSvg('a'.repeat(25));
		expect(svg).toContain('viewBox="0 0 132 132"');
		expect(svg).toContain('M40 48h4v4H40Z');
		expect(svg).not.toContain('M40 52h4v4H40Z');
		expect(svg).toContain('M88 88h4v4H88Z');
		expect(svg).not.toContain('M40 88h4v4H88Z');
		expect(svg).not.toContain('M0 0h4v4H0Z');
	});
	it('scales to multi-block versions for share-URL lengths', () => {
		const url = `https://haguruma.app/#c=${'a'.repeat(170)}`;
		const svg = qrSvg(url);
		expect(svg.length).toBeGreaterThan(0);
		expect(svg).not.toContain('viewBox="0 0 116 116"');
	});
	it('rejects empty, oversized and non-latin-1 payloads', () => {
		expect(qrSvg('')).toBe('');
		expect(qrSvg('a'.repeat(300))).toBe('');
		expect(qrSvg('ciao 😀')).toBe('');
	});
});
