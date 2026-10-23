/**
 * @file svg-nodes.ts
 * @brief Declarative SVG primitive model plus the single DOM mounting step.
 *
 * Every layer is built as plain data (`SvgPrim[]`) so all geometry, gating and
 * fading decisions stay pure functions testable without a DOM; one mount pass
 * turns the data into real SVG nodes whose text always goes through
 * `textContent`.
 */

/** Attribute bag of one SVG primitive (raw attribute names, string values). */
export type SvgAttrs = Record<string, string | number>;

/**
 * One SVG node described as data.
 * @brief Tag, attributes, optional text and optional children.
 */
export interface SvgPrim {
	/** SVG tag name, e.g. `line`, `rect`, `g`, `text`. */
	tag: string;
	/** Raw SVG attributes; numbers are stringified on mount. */
	attrs?: SvgAttrs;
	/** Text content, written with `textContent` (labels only). */
	text?: string;
	/** Nested primitives for grouping tags. */
	children?: SvgPrim[];
}

/** SVG namespace shared by every created node. */
export const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * @brief Describe one empty SVG node.
 * @param tag SVG tag name.
 * @param attrs Attribute bag, omitted when empty.
 * @return Primitive descriptor.
 */
export const prim = (tag: string, attrs?: SvgAttrs): SvgPrim => {
	return attrs ? { tag, attrs } : { tag };
};

/**
 * @brief Describe one text node.
 * @param attrs Attribute bag (position, fill, anchor).
 * @param value Label text.
 * @return Primitive descriptor carrying `value` as text content.
 */
export const textPrim = (attrs: SvgAttrs, value: string): SvgPrim => {
	return { tag: 'text', attrs, text: value };
};

/**
 * @brief Describe one group of primitives.
 * @param attrs Attribute bag (class, opacity, clip).
 * @param children Nested primitives.
 * @return Group primitive.
 */
export const group = (attrs: SvgAttrs, children: SvgPrim[]): SvgPrim => {
	return { tag: 'g', attrs, children };
};

/**
 * @brief Describe one polyline from interleaved coordinates.
 * @param points X/Y pairs in user units.
 * @param attrs Stroke attributes.
 * @return Polyline primitive, empty when fewer than two points exist.
 */
export const polyline = (points: { x: number; y: number }[], attrs: SvgAttrs): SvgPrim => {
	return prim('polyline', { ...attrs, points: pointsPath(points), fill: 'none' });
};

/**
 * @brief Describe one closed polygon from explicit coordinates.
 * @param points X/Y pairs in user units.
 * @param attrs Fill and stroke attributes.
 * @return Polygon primitive with the points serialized in user units.
 */
export const polygon = (points: { x: number; y: number }[], attrs: SvgAttrs): SvgPrim => {
	return prim('polygon', { ...attrs, points: pointsPath(points) });
};

/**
 * @brief Serialize coordinates into an SVG points attribute.
 * @param points X/Y pairs in user units.
 * @return Space-separated `x,y` list.
 */
const pointsPath = (points: { x: number; y: number }[]): string => {
	return points.map((p) => `${round(p.x)},${round(p.y)}`).join(' ');
};

/**
 * @brief Round an SVG coordinate to two decimals.
 * @param value Raw coordinate.
 * @return Rounded number, 0 when not finite.
 */
export const round = (value: number): number => {
	if (!Number.isFinite(value)) {
		return 0;
	}
	return Math.round(value * 100) / 100;
};

/**
 * @brief Create one SVG node from data.
 * @param node Primitive descriptor.
 * @return Detached SVG element.
 */
const toNode = (node: SvgPrim): SVGElement => {
	const el = document.createElementNS(SVG_NS, node.tag);
	if (node.attrs) {
		for (const [key, value] of Object.entries(node.attrs)) {
			el.setAttribute(key, String(value));
		}
	}
	if (node.text !== undefined) {
		el.textContent = node.text;
	}
	if (node.children) {
		for (const child of node.children) {
			el.appendChild(toNode(child));
		}
	}
	return el;
};

/**
 * @brief Mount primitives under one parent and return the created group.
 * @param parent Host element (the plot root or a layer group).
 * @param nodes Primitives to append.
 * @return The parent element, so calls can be chained.
 */
export const mountPrims = (parent: SVGElement, nodes: SvgPrim[]): SVGElement => {
	for (const node of nodes) {
		parent.appendChild(toNode(node));
	}
	return parent;
};

/**
 * @brief Append one primitive and return the created element.
 * @param parent Host element.
 * @param node Primitive descriptor.
 * @return Created SVG element, for live updates (crosshair handles).
 */
export const appendPrim = (parent: SVGElement, node: SvgPrim): SVGElement => {
	const el = toNode(node);
	parent.appendChild(el);
	return el;
};

/**
 * @brief Remove every child of an element without touching untracked state.
 * @param el Element to empty.
 * @return void
 */
export const clearChildren = (el: Element): void => {
	el.replaceChildren();
};
