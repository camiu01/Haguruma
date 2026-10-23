/**
 * @file tool-form.ts
 * @brief Accessible controls for component-owned trackside tools.
 */
import type { DictKey } from '../core/i18n/dictionaries';
import { t } from '../core/i18n/language';

/**
 * @brief Accent order cycled across tool headers so no two neighbours repeat.
 * @brief The app's semantic accents are already taken by the setup sections, so
 * @brief the tools simply walk the palette in injection order.
 */
const TOOL_DOTS = ['bg-neon-cyan', 'bg-neon-green', 'bg-neon-orange', 'bg-neon-yellow', 'bg-neon-purple', 'bg-neon-blue', 'bg-neon-red'];

/** Next accent to hand out; only ever touched during shell construction. */
let toolDotIndex = 0;

/**
 * @brief Build the accordion chevron shared with the app section headers.
 * @brief `details.accordion:not([open])` rotates it in CSS, no script needed.
 * @return SVG chevron icon.
 */
const toolChevron = (): SVGSVGElement => {
	const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
	svg.setAttribute('class', 'chevron');
	svg.setAttribute('data-chevron', '');
	svg.setAttribute('viewBox', '0 0 24 24');
	svg.setAttribute('fill', 'none');
	svg.setAttribute('stroke', 'currentColor');
	svg.setAttribute('stroke-width', '2');
	svg.setAttribute('aria-hidden', 'true');
	const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
	poly.setAttribute('points', '6 9 12 15 18 9');
	svg.appendChild(poly);
	return svg;
};

/**
 * @brief Create an independently collapsible tool section.
 * @brief Mirrors the shell accordions: `summary.section-header` carrying the
 * @brief accent dot, the title and the chevron.
 * @param host Mount point.
 * @param title Localized heading key.
 * @return Form used to scope component controls.
 */
export const toolSection = (host: HTMLElement, title: DictKey): HTMLFormElement => {
	const details = document.createElement('details');
	details.className = 'accordion track-tool';
	const summary = document.createElement('summary');
	summary.className = 'section-header';
	const heading = document.createElement('div');
	heading.className = 'flex items-center gap-2';
	const dot = document.createElement('span');
	dot.className = `w-2 h-2 rounded-full ${TOOL_DOTS[toolDotIndex++ % TOOL_DOTS.length]}`;
	const label = document.createElement('span');
	label.className = 'text-sm font-semibold text-text-main';
	label.dataset.i18n = title;
	label.textContent = t(title);
	heading.append(dot, label);
	summary.append(heading, toolChevron());
	const form = document.createElement('form');
	form.autocomplete = 'off';
	form.addEventListener('submit', (event) => event.preventDefault());
	details.append(summary, form);
	host.append(details);
	return form;
};

/**
 * @brief Add a named number field with a wrapping label and bounds.
 * @param form Component-owned form.
 * @param name Field name.
 * @param key Translated label.
 * @param value Default value.
 * @param min Minimum.
 * @param max Maximum.
 * @param step Step increment.
 * @return Input handle.
 */
export const toolNumber = (form: HTMLElement, name: string, key: DictKey, value: number, min: number, max: number, step = 1): HTMLInputElement => {
	const label = document.createElement('label');
	const text = document.createElement('span');
	text.dataset.i18n = key;
	text.textContent = t(key);
	const input = document.createElement('input');
	input.name = name;
	input.type = 'number';
	input.inputMode = 'decimal';
	input.autocomplete = 'off';
	input.value = String(value);
	input.min = String(min);
	input.max = String(max);
	input.step = String(step);
	label.append(text, input);
	form.append(label);
	return input;
};

/**
 * @brief Add a localized action button.
 * @param form Component form.
 * @param key Button label.
 * @param action Click callback.
 * @return Button handle.
 */
export const toolButton = (form: HTMLElement, key: DictKey, action: () => void): HTMLButtonElement => {
	const button = document.createElement('button');
	button.type = 'button';
	button.dataset.i18n = key;
	button.textContent = t(key);
	button.addEventListener('click', action);
	form.append(button);
	return button;
};

/**
 * @brief Add a live result output.
 * @param form Component form.
 * @return Output handle.
 */
export const toolOutput = (form: HTMLFormElement): HTMLOutputElement => {
	const output = document.createElement('output');
	output.setAttribute('aria-live', 'polite');
	output.setAttribute('aria-atomic', 'true');
	form.append(output);
	return output;
};

/**
 * @brief Add a labeled bounded text field without password-manager autocomplete.
 * @param form Component-owned form.
 * @param name Field name.
 * @param key Translation key.
 * @param value Initial value.
 * @return Text input.
 */
export const toolText = (form: HTMLFormElement, name: string, key: DictKey, value = ''): HTMLInputElement => {
	const label = document.createElement('label');
	const caption = document.createElement('span');
	caption.dataset.i18n = key; caption.textContent = t(key);
	const input = document.createElement('input');
	input.type = 'text'; input.name = name; input.value = value;
	input.autocomplete = 'off'; input.spellcheck = false; input.maxLength = 120;
	label.append(caption, input); form.append(label);
	return input;
};

/**
 * @brief Read a bounded valid numeric field, rejecting empty input.
 * @param input Field to validate.
 * @return Finite number or null, with accessible invalid state.
 */
export const toolValue = (input: HTMLInputElement): number | null => {
	const valid = input.value.trim() !== '' && input.checkValidity() && Number.isFinite(input.valueAsNumber);
	input.setAttribute('aria-invalid', String(!valid));
	if (!valid) input.focus();
	return valid ? input.valueAsNumber : null;
};

/**
 * @brief Group related controls and their actions under an accessible legend.
 * @param form Owning form.
 * @param key Localized group name.
 * @return Fieldset for the related controls.
 */
export const toolGroup = (form: HTMLFormElement, key: DictKey): HTMLFieldSetElement => {
	const group = document.createElement('fieldset');
	const legend = document.createElement('legend');
	legend.dataset.i18n = key; legend.textContent = t(key);
	group.append(legend); form.append(group);
	return group;
};
