/**
 * @file share-compact.ts
 * @brief Packed Base64URL codec for ultra-compact share links (no dependencies).
 *
 * Binary layout (big-endian): tire width/aspect/rim (3B), fd x100 (2B),
 * redline (2B), gear count (1B), gears x1000 (2B each, max 8), reverse x1000 (2B, 0 = null).
 */
import { parseTire } from '../math/tire-math';

export interface CompactSetup {
	/** Tire string like 205/55R16. */
	tire: string;
	/** Final drive ratio. */
	fd: number;
	/** Rev limiter in RPM. */
	redline: number;
	/** Forward gear ratios. */
	gears: number[];
	/** Reverse ratio, null when unset. */
	reverseRatio: number | null;
}

/** Maximum gears carried by the compact payload. */
export const COMPACT_MAX_GEARS = 8;

/**
 * @brief Encode bytes as Base64URL.
 * @param bytes Raw bytes.
 * @return Base64URL string without padding.
 */
const toBase64Url = (bytes: Uint8Array): string => {
	let bin = '';
	for (const b of bytes) {
		bin += String.fromCharCode(b);
	}
	const b64 = typeof Buffer !== 'undefined' ? Buffer.from(bin, 'binary').toString('base64') : btoa(bin);
	return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

/**
 * @brief Decode a Base64URL string back to bytes.
 * @param code Base64URL payload.
 * @return Raw bytes, or null when malformed.
 */
const fromBase64Url = (code: string): Uint8Array | null => {
	if (!code || !/^[A-Za-z0-9_-]+$/.test(code)) {
		return null;
	}
	try {
		let b64 = code.replace(/-/g, '+').replace(/_/g, '/');
		while (b64.length % 4 !== 0) {
			b64 += '=';
		}
		const bin = typeof Buffer !== 'undefined' ? Buffer.from(b64, 'base64').toString('binary') : atob(b64);
		const out = new Uint8Array(bin.length);
		for (let i = 0; i < bin.length; i += 1) {
			out[i] = bin.charCodeAt(i);
		}
		return out;
	} catch {
		return null;
	}
};

/**
 * @brief Encode a primary setup into a compact token.
 * @param setup Tire, final drive, redline, gears and reverse.
 * @return Compact token, or null when inputs are invalid.
 */
export const encodeCompactSetup = (setup: CompactSetup): string | null => {
	const tire = parseTire(setup.tire);
	if (!tire || setup.gears.length === 0 || setup.gears.length > COMPACT_MAX_GEARS) {
		return null;
	}
	if (!(setup.fd >= 1 && setup.fd <= 10) || !(setup.redline >= 3000 && setup.redline <= 12000)) {
		return null;
	}
	const bytes = new Uint8Array(10 + setup.gears.length * 2);
	const view = new DataView(bytes.buffer);
	view.setUint8(0, Math.min(255, Math.round(tire.width)));
	view.setUint8(1, Math.min(99, Math.round(tire.aspect)));
	view.setUint8(2, Math.min(99, Math.round(tire.rimInch)));
	view.setUint16(3, Math.round(setup.fd * 100));
	view.setUint16(5, Math.round(setup.redline));
	view.setUint8(7, setup.gears.length);
	setup.gears.forEach((g, i) => {
		view.setUint16(8 + i * 2, Math.round(g * 1000));
	});
	const revOffset = 8 + setup.gears.length * 2;
	view.setUint16(revOffset, setup.reverseRatio === null ? 0 : Math.round(setup.reverseRatio * 1000));
	return toBase64Url(bytes.slice(0, revOffset + 2));
};

/**
 * @brief Decode a compact token back to a primary setup.
 * @param code Compact token from encodeCompactSetup.
 * @return Setup fields, or null when malformed.
 */
export const decodeCompactSetup = (code: string): CompactSetup | null => {
	const bytes = fromBase64Url(code);
	if (!bytes || bytes.length < 10) {
		return null;
	}
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	const count = view.getUint8(7);
	if (count === 0 || count > COMPACT_MAX_GEARS || bytes.length !== 10 + count * 2) {
		return null;
	}
	const gears: number[] = [];
	for (let i = 0; i < count; i += 1) {
		gears.push(view.getUint16(8 + i * 2) / 1000);
	}
	const revRaw = view.getUint16(8 + count * 2);
	const tire = `${view.getUint8(0)}/${view.getUint8(1)}R${view.getUint8(2)}`;
	if (!parseTire(tire)) {
		return null;
	}
	return {
		tire,
		fd: view.getUint16(3) / 100,
		redline: view.getUint16(5),
		gears,
		reverseRatio: revRaw === 0 ? null : revRaw / 1000,
	};
};
