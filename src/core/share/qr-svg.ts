/**
 * @file qr-svg.ts
 * @brief QR Code SVG renderer for the share modal, backed by the `qrcode` library.
 *
 * Encodes the payload in byte mode at EC level L (version chosen automatically,
 * capped at version 10 = 271 payload bytes) and renders a standalone SVG string
 * with a 4-module quiet zone. Returns an empty string when the payload is empty,
 * exceeds version 10-L capacity or holds non-latin-1 characters (share URLs are
 * ASCII, so the encoder never needs multi-byte handling).
 */
import { create, type QRCode } from 'qrcode';

/** Quiet zone width in modules on every side (ISO minimum). */
const QUIET = 4;

/** Maximum payload bytes for EC level L at version 10. */
const MAX_BYTES = 271;

/**
 * @brief Convert a payload to latin-1 bytes, rejecting unsupported input.
 * @param text Payload to encode.
 * @return Byte values, or null when the payload is empty or not latin-1.
 */
const toLatin1Bytes = (text: string): number[] | null => {
	if (typeof text !== 'string' || text.length === 0) {
		return null;
	}
	const bytes: number[] = [];
	for (const ch of text) {
		const code = ch.charCodeAt(0);
		if (code > 255) {
			return null;
		}
		bytes.push(code);
	}
	return bytes;
};

/**
 * @brief Render a text as a standalone QR Code SVG string.
 * @param text Latin-1 payload (typically the compressed share URL).
 * @param scale Pixels per module (quiet zone of 4 modules included).
 * @return SVG markup, or an empty string when the payload does not fit version 10-L.
 */
export const qrSvg = (text: string, scale: number = 4): string => {
	const bytes = toLatin1Bytes(text);
	if (bytes === null || bytes.length > MAX_BYTES) {
		return '';
	}
	let qr: QRCode;
	try {
		qr = create(text, { errorCorrectionLevel: 'L' });
	} catch {
		/* Encoder overflow is part of the public contract: no symbol, no SVG. */
		return '';
	}
	const n = qr.modules.size;
	const totalPx = (n + QUIET * 2) * scale;
	const rects: string[] = [];
	for (let y = 0; y < n; y += 1) {
		for (let x = 0; x < n; x += 1) {
			if (qr.modules.get(y, x) === 1) {
				rects.push(`M${(x + QUIET) * scale} ${(y + QUIET) * scale}h${scale}v${scale}H${(x + QUIET) * scale}Z`);
			}
		}
	}
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalPx} ${totalPx}" shape-rendering="crispEdges"><rect width="${totalPx}" height="${totalPx}" fill="#fff"/><path d="${rects.join(' ')}" fill="#000"/></svg>`;
};
