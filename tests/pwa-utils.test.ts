/**
 * @file pwa-utils.test.ts
 * @brief Unit tests for pure PWA environment helpers.
 */
import { describe, expect, it } from 'vitest';
import { isCacheableRequest, isSecureContext, isStandalone } from '../src/core/pwa/pwa-utils';

describe('isSecureContext', () => {
	it('trusts the browser secure flag', () => {
		expect(isSecureContext('http:', 'example.com', true)).toBe(true);
	});
	it('trusts https origins', () => {
		expect(isSecureContext('https:', 'example.com', false)).toBe(true);
	});
	it('trusts loopback hosts', () => {
		expect(isSecureContext('http:', 'localhost', false)).toBe(true);
		expect(isSecureContext('http:', '127.0.0.1', false)).toBe(true);
	});
	it('rejects plain http on remote hosts', () => {
		expect(isSecureContext('http:', 'example.com', false)).toBe(false);
	});
});

describe('isStandalone', () => {
	it('detects standalone display mode', () => {
		expect(isStandalone(true, false)).toBe(true);
	});
	it('detects iOS navigator standalone', () => {
		expect(isStandalone(false, true)).toBe(true);
	});
	it('returns false inside a regular tab', () => {
		expect(isStandalone(false, false)).toBe(false);
	});
});

describe('isCacheableRequest', () => {
	it('allows GET http(s) requests', () => {
		expect(isCacheableRequest('GET', 'https://example.com/app.js')).toBe(true);
	});
	it('rejects non-GET methods', () => {
		expect(isCacheableRequest('POST', 'https://example.com/api')).toBe(false);
	});
	it('rejects non-http schemes', () => {
		expect(isCacheableRequest('GET', 'chrome-extension://abc/app.js')).toBe(false);
	});
});
