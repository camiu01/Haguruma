/**
 * @file qr-svg.ts
 * @brief Minimal dependency-free QR Code generator (byte mode, EC level L).
 *
 * Encodes latin-1 text into versions 1-10 with a fixed mask 0 and renders a
 * standalone SVG string. Reed-Solomon, function patterns, zigzag placement
 * and format info follow the QR standard; multi-block versions interleave
 * data and parity codewords. Returns null when the text exceeds version 10-L
 * capacity (271 data bytes) or holds non-latin-1 characters.
 */

/** QR side length for a version: 21 + 4 x (version - 1). */
const sizeOf = (version: number): number => 21 + 4 * (version - 1);

/** Alignment pattern centers per version (empty for version 1). */
const ALIGN_AT: Record<number, number[]> = {
	2: [6, 18],
	3: [6, 22],
	4: [6, 26],
	5: [6, 30],
	6: [6, 34],
	7: [6, 22, 38],
	8: [6, 24, 42],
	9: [6, 26, 46],
	10: [6, 28, 50],
};

/** Remainder bits appended after interleaved codewords per version. */
const REMAINDER_BITS: Record<number, number> = { 1: 0, 2: 7, 3: 7, 4: 7, 5: 7, 6: 7, 7: 0, 8: 0, 9: 0, 10: 0 };

/** Version table: data codewords, parity codewords per block, data block sizes. */
interface VersionInfo {
	/** Total data codewords. */
	dataCw: number;
	/** Parity codewords per block. */
	ecCw: number;
	/** Data codewords per block (uneven for version 10). */
	blocks: number[];
}

/** Capacity table for EC level L, versions 1-10. */
const VERSIONS: VersionInfo[] = [
	{ dataCw: 19, ecCw: 7, blocks: [19] },
	{ dataCw: 34, ecCw: 10, blocks: [34] },
	{ dataCw: 55, ecCw: 15, blocks: [55] },
	{ dataCw: 80, ecCw: 20, blocks: [80] },
	{ dataCw: 108, ecCw: 26, blocks: [108] },
	{ dataCw: 136, ecCw: 18, blocks: [68, 68] },
	{ dataCw: 156, ecCw: 20, blocks: [78, 78] },
	{ dataCw: 194, ecCw: 24, blocks: [97, 97] },
	{ dataCw: 232, ecCw: 30, blocks: [116, 116] },
	{ dataCw: 274, ecCw: 18, blocks: [68, 68, 69, 69] },
];

/** Format bits for EC level L with mask 0 (111011111000100). */
const FORMAT_BITS = [1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 0, 0, 1, 0, 0];

/** Galois field tables for GF(256) with 0x11D. */
let expTable: number[] = [];
let logTable: number[] = [];

/**
 * @brief Build the GF(256) exponent and logarithm tables once.
 * @return void
 */
const buildGalois = (): void => {
	if (expTable.length > 0) {
		return;
	}
	expTable = new Array(512);
	logTable = new Array(256);
	let x = 1;
	for (let i = 0; i < 255; i += 1) {
		expTable[i] = x;
		logTable[x] = i;
		x <<= 1;
		if (x >= 256) {
			x ^= 0x11d;
		}
	}
	for (let i = 255; i < 512; i += 1) {
		expTable[i] = expTable[i - 255];
	}
};

/**
 * @brief Multiply two GF(256) values.
 * @param a First factor.
 * @param b Second factor.
 * @return Product in GF(256).
 */
const gfMul = (a: number, b: number): number => {
	if (a === 0 || b === 0) {
		return 0;
	}
	return expTable[logTable[a] + logTable[b]];
};

/**
 * @brief Reed-Solomon generator polynomial of the given degree.
 * @param degree Parity codeword count.
 * @return Coefficients highest-degree first, without the leading 1.
 */
const rsGenerator = (degree: number): number[] => {
	let poly: number[] = [1];
	for (let i = 0; i < degree; i += 1) {
		const next = new Array(poly.length + 1).fill(0);
		for (let j = 0; j < poly.length; j += 1) {
			next[j] ^= gfMul(poly[j], expTable[i]);
			next[j + 1] ^= poly[j];
		}
		poly = next;
	}
	return poly.slice(1);
};

/**
 * @brief Compute Reed-Solomon parity for one data block.
 * @param data Data codewords.
 * @param ecLen Parity length.
 * @return Parity codewords.
 */
const rsParity = (data: number[], ecLen: number): number[] => {
	const gen = rsGenerator(ecLen);
	const out = new Array(ecLen).fill(0);
	for (const byte of data) {
		const factor = byte ^ (out.shift() ?? 0);
		out.push(0);
		for (let i = 0; i < ecLen; i += 1) {
			out[i] ^= gfMul(gen[i], factor);
		}
	}
	return out;
};

/**
 * @brief Push a value as big-endian bits into a bit array.
 * @param bits Bit sink (0/1).
 * @param value Value to append.
 * @param count Bit count.
 * @return void
 */
const pushBits = (bits: number[], value: number, count: number): void => {
	for (let i = count - 1; i >= 0; i -= 1) {
		bits.push((value >>> i) & 1);
	}
};

/**
 * @brief Encode text bytes plus headers into padded data codewords.
 * @param bytes Latin-1 byte values.
 * @param version QR version (drives the count-indicator width).
 * @param dataCw Data codeword capacity.
 * @return Data codewords, exactly dataCw long.
 */
const encodeData = (bytes: number[], version: number, dataCw: number): number[] => {
	const bits: number[] = [];
	pushBits(bits, 0b0100, 4);
	pushBits(bits, bytes.length, version >= 10 ? 16 : 8);
	for (const b of bytes) {
		pushBits(bits, b, 8);
	}
	const capacity = dataCw * 8;
	const term = Math.min(4, capacity - bits.length);
	for (let i = 0; i < term; i += 1) {
		bits.push(0);
	}
	while (bits.length % 8 !== 0) {
		bits.push(0);
	}
	const out: number[] = [];
	for (let i = 0; i < bits.length; i += 8) {
		let byte = 0;
		for (let j = 0; j < 8; j += 1) {
			byte = (byte << 1) | bits[i + j];
		}
		out.push(byte);
	}
	let pad = 0xec;
	while (out.length < dataCw) {
		out.push(pad);
		pad = pad === 0xec ? 0x11 : 0xec;
	}
	return out;
};

/**
 * @brief Interleave data blocks, parities and remainder zeros.
 * @param blocks Data codewords per block.
 * @param ecLen Parity length per block.
 * @param remainder Zero bits appended at the end.
 * @return Final bit stream (0/1).
 */
const interleave = (blocks: number[][], ecLen: number, remainder: number): number[] => {
	const parts: number[] = [];
	const maxLen = Math.max(...blocks.map((b) => b.length));
	for (let i = 0; i < maxLen; i += 1) {
		for (const b of blocks) {
			if (i < b.length) {
				parts.push(b[i]);
			}
		}
	}
	const parities = blocks.map((b) => rsParity(b, ecLen));
	for (let i = 0; i < ecLen; i += 1) {
		for (const p of parities) {
			parts.push(p[i]);
		}
	}
	const bits: number[] = [];
	for (const byte of parts) {
		pushBits(bits, byte, 8);
	}
	for (let i = 0; i < remainder; i += 1) {
		bits.push(0);
	}
	return bits;
};

/**
 * @brief Writable module grid with function-pattern reservation.
 */
class QrGrid {
	/** Module darkness, row-major (-1 unset data slot). */
	cells: number[][];
	/** True where function patterns forbid data. */
	reserved: boolean[][];
	/** Grid side length. */
	size: number;

	/**
	 * @brief Allocate an empty grid for a version.
	 * @param version QR version.
	 */
	constructor(version: number) {
		this.size = sizeOf(version);
		this.cells = Array.from({ length: this.size }, () => new Array(this.size).fill(0));
		this.reserved = Array.from({ length: this.size }, () => new Array(this.size).fill(false));
	}

	/**
	 * @brief Set a module and reserve it as a function pattern.
	 * @param x Column.
	 * @param y Row.
	 * @param dark Module darkness (0/1).
	 * @return void
	 */
	setFn(x: number, y: number, dark: number): void {
		this.cells[y][x] = dark;
		this.reserved[y][x] = true;
	}
}

/**
 * @brief Paint one 7x7 finder plus its separator ring.
 * @param grid Target grid.
 * @param ox Left offset.
 * @param oy Top offset.
 * @return void
 */
const paintFinder = (grid: QrGrid, ox: number, oy: number): void => {
	for (let dy = -1; dy <= 7; dy += 1) {
		for (let dx = -1; dx <= 7; dx += 1) {
			const x = ox + dx;
			const y = oy + dy;
			if (x < 0 || y < 0 || x >= grid.size || y >= grid.size) {
				continue;
			}
			const edge = dx === -1 || dx === 7 || dy === -1 || dy === 7;
			const dark = !edge && (dx === 0 || dx === 6 || dy === 0 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4)) ? 1 : 0;
			grid.setFn(x, y, dark);
		}
	}
};

/**
 * @brief Paint timing strips, alignment patterns and the dark module.
 * @brief Alignment cells on the finder-corner grid slots are skipped.
 * @param grid Target grid.
 * @param version QR version.
 * @return void
 */
const paintHelpers = (grid: QrGrid, version: number): void => {
	for (let i = 8; i < grid.size - 8; i += 1) {
		const v = i % 2 === 0 ? 1 : 0;
		grid.setFn(6, i, v);
		grid.setFn(i, 6, v);
	}
	const pos = ALIGN_AT[version] ?? [];
	for (let i = 0; i < pos.length; i += 1) {
		for (let j = 0; j < pos.length; j += 1) {
			if ((i === 0 && j === 0) || (i === 0 && j === pos.length - 1) || (i === pos.length - 1 && j === 0)) {
				continue;
			}
			paintAlignment(grid, pos[j], pos[i]);
		}
	}
	grid.setFn(grid.size - 8, 8, 1);
};

/**
 * @brief Paint one 5x5 alignment pattern centered at (cx, cy).
 * @param grid Target grid.
 * @param cx Center column.
 * @param cy Center row.
 * @return void
 */
const paintAlignment = (grid: QrGrid, cx: number, cy: number): void => {
	for (let dy = -2; dy <= 2; dy += 1) {
		for (let dx = -2; dx <= 2; dx += 1) {
			grid.setFn(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) === 1 ? 0 : 1);
		}
	}
};

/**
 * @brief Paint both copies of the EC-L mask-0 format info.
 * @param grid Target grid.
 * @return void
 */
const paintFormat = (grid: QrGrid): void => {
	for (let i = 0; i <= 5; i += 1) {
		grid.setFn(8, i, FORMAT_BITS[i]);
	}
	grid.setFn(8, 7, FORMAT_BITS[6]);
	grid.setFn(8, 8, FORMAT_BITS[7]);
	grid.setFn(7, 8, FORMAT_BITS[8]);
	for (let i = 9; i < 15; i += 1) {
		grid.setFn(14 - i, 8, FORMAT_BITS[i]);
	}
	const n = grid.size;
	for (let i = 0; i < 8; i += 1) {
		grid.setFn(n - 1 - i, 8, FORMAT_BITS[i]);
	}
	for (let i = 8; i < 15; i += 1) {
		grid.setFn(8, n - 15 + i, FORMAT_BITS[i]);
	}
};

/**
 * @brief Place data bits in the standard vertical zigzag with mask 0.
 * @param grid Target grid with function patterns reserved.
 * @param bits Data bit stream.
 * @return void
 */
const placeData = (grid: QrGrid, bits: number[]): void => {
	let i = 0;
	for (let right = grid.size - 1; right >= 1; right -= 2) {
		const x = right === 6 ? 5 : right;
		const upward = ((right + 1) & 2) === 0;
		for (let y = 0; y < grid.size; y += 1) {
			for (let dx = 0; dx < 2; dx += 1) {
				const xx = x - dx;
				const yy = upward ? grid.size - 1 - y : y;
				if (grid.reserved[yy][xx] || i >= bits.length) {
					continue;
				}
				const mask = (xx + yy) % 2 === 0 ? 1 : 0;
				grid.cells[yy][xx] = bits[i] ^ mask;
				i += 1;
			}
		}
	}
};

/**
 * @brief Choose the smallest version holding the payload.
 * @param byteLen Payload byte count.
 * @return Version 1-10, or 0 when nothing fits.
 */
const pickVersion = (byteLen: number): number => {
	for (let v = 1; v <= 10; v += 1) {
		const need = 4 + (v >= 10 ? 16 : 8) + byteLen * 8;
		if (need <= VERSIONS[v - 1].dataCw * 8) {
			return v;
		}
	}
	return 0;
};

/**
 * @brief Render a text as a standalone QR Code SVG string.
 * @param text Latin-1 payload (typically the compressed share URL).
 * @param scale Pixels per module (quiet zone of 4 modules included).
 * @return SVG markup, or null when the payload does not fit version 10-L.
 */
export const qrSvg = (text: string, scale: number = 4): string => {
	if (typeof text !== 'string' || text.length === 0) {
		return '';
	}
	const bytes: number[] = [];
	for (const ch of text) {
		const code = ch.charCodeAt(0);
		if (code > 255) {
			return '';
		}
		bytes.push(code);
	}
	const version = pickVersion(bytes.length);
	if (version === 0) {
		return '';
	}
	buildGalois();
	const info = VERSIONS[version - 1];
	const data = encodeData(bytes, version, info.dataCw);
	const blocks: number[][] = [];
	let at = 0;
	for (const len of info.blocks) {
		blocks.push(data.slice(at, at + len));
		at += len;
	}
	const bits = interleave(blocks, info.ecCw, REMAINDER_BITS[version]);
	const grid = new QrGrid(version);
	const n = grid.size;
	paintFinder(grid, 0, 0);
	paintFinder(grid, n - 7, 0);
	paintFinder(grid, 0, n - 7);
	paintHelpers(grid, version);
	paintFormat(grid);
	placeData(grid, bits);
	const quiet = 4;
	const full = n + quiet * 2;
	const rects: string[] = [];
	for (let y = 0; y < n; y += 1) {
		for (let x = 0; x < n; x += 1) {
			if (grid.cells[y][x] === 1) {
				rects.push(`M${(x + quiet) * scale} ${(y + quiet) * scale}h${scale}v${scale}H${(x + quiet) * scale}Z`);
			}
		}
	}
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${full * scale} ${full * scale}" shape-rendering="crispEdges"><rect width="${full * scale}" height="${full * scale}" fill="#fff"/><path d="${rects.join(' ')}" fill="#000"/></svg>`;
};
