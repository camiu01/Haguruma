/**
 * @file graph-controls.ts
 * @brief Component-owned graph navigation and export controls.
 */

/** @brief Inline icons for the map-style navigation buttons. */
const ICON = {
	zoomIn: "<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' aria-hidden='true'><circle cx='11' cy='11' r='7'/><path d='M11 8v6M8 11h6'/><path d='M20 20l-4-4'/></svg>",
	zoomOut: "<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' aria-hidden='true'><circle cx='11' cy='11' r='7'/><path d='M8 11h6'/><path d='M20 20l-4-4'/></svg>",
	fullscreen: "<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' aria-hidden='true'><path d='M3 9V3h6'/><path d='M21 9V3h-6'/><path d='M3 15v6h6'/><path d='M21 15v6h-6'/></svg>",
	fit: "<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'><path d='M3 11l9-8 9 8'/><path d='M5.5 9.5V20h13V9.5'/></svg>",
};

/**
 * @brief Insert controls before DOM refs and translations are resolved.
 * @brief Navigation floats over the canvas as map-style icon buttons; the mode,
 * @brief margin and export options stay in the bar above it. Panning itself is a
 * @brief drag on the canvas, so no direction buttons are rendered and the stack
 * @brief is ordered fullscreen, fit, zoom in, zoom out. Labels come from
 * @brief data-i18n-tip so the buttons carry no visible text.
 * @param mount Graph wrapper containing the canvas.
 * @return void
 */
export const injectGraphControlsShell = (mount: HTMLElement): void => {
	mount.insertAdjacentHTML('beforebegin', `
		<div class='graph-controls'>
			<label><span data-i18n='graph.mode'></span><select id='graph-mode' name='graph-mode'>
				<option value='rpm' data-i18n='graph.rpm'></option>
				<option value='force' data-i18n='graph.force'></option>
			</select></label>
			<label><span data-i18n='graph.margin'></span>
				<input id='graph-fit-margin' name='graph-margin' autocomplete='off' inputmode='decimal' type='number' min='0' max='50' step='5' value='10' /> %
			</label>
			<label><input id='graph-export-footer' name='export-footer' type='checkbox' /><span data-i18n='graph.footer'></span></label>
			<label><input id='graph-traction-margin' name='traction-margin' type='checkbox' /><span data-i18n='graph.tractionMargin'></span></label>
		</div>
		<p id='graph-help' class='graph-help' data-i18n='graph.help'></p>`);
	mount.insertAdjacentHTML('afterend', `<output id='graph-readout' class='graph-readout' tabindex='0' aria-live='polite' aria-atomic='true'></output>`);
	mount.insertAdjacentHTML('beforeend', `
		<div class='graph-overlay'>
			<button type='button' class='graph-btn' id='btn-expand-graph' data-i18n-tip='graph.expandTip' aria-expanded='false'>${ICON.fullscreen}</button>
			<button type='button' class='graph-btn' id='graph-fit' data-i18n-tip='graph.fit'>${ICON.fit}</button>
			<button type='button' class='graph-btn' id='graph-zoom-in' data-i18n-tip='graph.zoomIn'>${ICON.zoomIn}</button>
			<button type='button' class='graph-btn' id='graph-zoom-out' data-i18n-tip='graph.zoomOut'>${ICON.zoomOut}</button>
		</div>
		<span id='graph-crosshair' class='graph-crosshair' hidden aria-hidden='true'></span>`);
};
