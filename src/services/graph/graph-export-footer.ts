/**
 * @file graph-export-footer.ts
 * @brief Shared metadata and safe XML text for graph exports.
 */
import { state } from '../../core/state/app-state';
import { getUnitLabel } from '../../core/units/unit-utils';
import { getLang } from '../../core/i18n/language';

/**
 * @brief Describe a graph without depending on a selected catalog entry.
 * @param preset Current selector label.
 * @param date Export date.
 * @return Human-readable metadata.
 */
export const graphExportMetadata = (preset: string, date: Date = new Date()): string => {
	const fd = new Intl.NumberFormat(getLang(), { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(state.primaryFd);
	const day = new Intl.DateTimeFormat(getLang(), { dateStyle: 'medium' }).format(date);
	return `${preset} · ${getUnitLabel(state.unit)} · ${state.primaryTire} · ${fd} FD · ${day}`;
};

/**
 * @brief Escape text inserted into an SVG document.
 * @param text Untrusted preset or metadata label.
 * @return XML-safe text.
 */
export const escapeSvgText = (text: string): string => {
	return text.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[char] ?? char));
};
