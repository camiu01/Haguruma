/**
 * @file graph-renderer.ts
 * @brief Declarative rebuild of the 16:9 SVG plot and the layer-pill state.
 *
 * The plot is a pure function of the shared state: every call clears
 * `#graph-svg`, mounts the layer primitives composed by `graph-scene.ts` and
 * hands the crosshair its context. No measurement, no HiDPI work, no
 * offscreen cache, no canvas.
 */
import { state } from '../../core/state/app-state';
import { parseTire } from '../../core/math/tire-math';
import { t } from '../../core/i18n/language';
import type { DictKey } from '../../core/i18n/dictionaries';
import type { GraphLayerSettings } from '../../core/models';
import type { ElementRefs } from '../dom/element-refs';
import { buildSceneData, composeNodes } from './graph-scene';
import { bindCrosshair, clearCrosshair, clearCrosshairContext, mountCrosshair, setCrosshairContext } from './graph-crosshair';
import { syncGraphSwatches } from './graph-legend';
import { clearChildren, mountPrims } from './svg-nodes';
import { GRAPH_VIEWBOX } from '../../config/graph-constants';
import { buildDynamicsGraph } from './dynamics-graph';

/** Settings key behind each `[data-graph-layer]` button. */
const LAYER_SETTINGS: Record<string, keyof GraphLayerSettings> = {
	shiftdrops: 'shiftDrops',
	aerowall: 'aeroWall',
	griplimit: 'gripLimit',
	powercurve: 'powerCurve',
	finegrid: 'fineGrid',
	snaphud: 'snapHud',
};

/** Dictionary label used when a toolbar pill ships without its own copy. */
const LAYER_LABELS: Record<string, DictKey> = {
	shiftdrops: 'graph.toggleShiftDrops',
	aerowall: 'graph.toggleAeroWall',
	griplimit: 'graph.toggleGripLimit',
	powercurve: 'graph.togglePowerCurve',
};

/**
 * @brief Normalize a `data-graph-layer` value into a settings slug.
 * @param raw Raw attribute value.
 * @return Lowercase alphanumeric slug.
 */
const layerSlug = (raw: string | undefined): string => {
	return (raw ?? '').replace(/[^a-z0-9]/gi, '').toLowerCase();
};

/**
 * @brief Fill a pill label when the markup carries none.
 * @param btn Toolbar pill.
 * @param label Dictionary key of the layer name.
 * @return void
 */
const applyPillLabel = (btn: HTMLElement, label: DictKey | undefined): void => {
	if (!label || btn.hasAttribute('data-i18n') || (btn.textContent ?? '').trim() !== '') {
		return;
	}
	btn.textContent = t(label);
	btn.setAttribute('aria-label', t(label));
};

/**
 * @brief Reflect the active layer switches onto the toolbar pills.
 * @param refs Cached DOM handles.
 * @param layers Active layer switches.
 * @return void
 */
const syncLayerPills = (refs: ElementRefs, layers: GraphLayerSettings): void => {
	refs.graphLayerButtons.forEach((btn) => {
		const slug = layerSlug(btn.dataset.graphLayer);
		const key = LAYER_SETTINGS[slug];
		if (!key) {
			return;
		}
		const on = layers[key];
		btn.setAttribute('aria-pressed', String(on));
		btn.dataset.active = String(on);
		btn.classList.toggle('is-active', on);
		applyPillLabel(btn, LAYER_LABELS[slug]);
	});
};

/**
 * @brief Measure the plot host in CSS pixels for the viewBox of this pass.
 * @brief ViewBox units equal CSS pixels, so fonts keep their real size at
 * @brief every viewport and the plot never stretches on non-16:9 hosts.
 * @param refs Cached DOM handles.
 * @return Host size, or the static 16:9 fallback while the host is unmeasured.
 */
const measurePlotHost = (refs: ElementRefs): { width: number; height: number } => {
	const width = Math.round(refs.graphHost.clientWidth);
	const height = Math.round(refs.graphHost.clientHeight);
	if (width <= 0 || height <= 0) {
		return { width: GRAPH_VIEWBOX.width, height: GRAPH_VIEWBOX.height };
	}
	return { width, height };
};

/**
 * @brief Render the plot from the current state.
 * @brief Silently renders nothing when the primary tire is unparseable.
 * @param refs Cached DOM handles.
 * @return void
 */
export const renderGraph = (refs: ElementRefs): void => {
	syncLayerPills(refs, state.graphLayers);
	syncGraphSwatches();
	const tire = parseTire(state.primaryTire);
	if (!tire) {
		clearChildren(refs.graphSvg);
		clearCrosshairContext();
		clearCrosshair(refs);
		return;
	}
	const { width, height } = measurePlotHost(refs);
	refs.graphSvg.setAttribute('viewBox', `0 0 ${width} ${height}`);
	if (renderDynamicsGraph(refs, width, height)) return;
	const scene = buildSceneData(tire, width, height);
	clearChildren(refs.graphSvg);
	mountPrims(refs.graphSvg, composeNodes(scene));
	setCrosshairContext(scene.crosshair);
	mountCrosshair(refs);
};

/**
 * @brief Wire the toolbar layer pills to the shared layer switches.
 * @brief Each pill flips its switch and repaints the plot; the pressed state
 * @brief is re-synced from `state.graphLayers` on every render.
 * @param refs Cached DOM handles.
 * @return void
 */
const bindLayerPills = (refs: ElementRefs): void => {
	refs.graphLayerButtons.forEach((btn) => {
		const key = LAYER_SETTINGS[layerSlug(btn.dataset.graphLayer)];
		if (!key || btn.dataset.graphBound === '1') {
			return;
		}
		btn.dataset.graphBound = '1';
		btn.addEventListener('click', () => {
			const next: GraphLayerSettings = { ...state.graphLayers };
			next[key] = !next[key];
			state.graphLayers = next;
			renderGraph(refs);
		});
	});
};

/**
 * @brief Wire the crosshair pointer/keyboard interactions and the layer pills.
 * @param refs Cached DOM handles.
 * @return void
 */
export const bindGraphInteractions = (refs: ElementRefs): void => {
	bindCrosshair(refs);
	bindLayerPills(refs);
	const view = refs.graphView;
	view?.addEventListener('change', () => {
		const value = view.value;
		if (value !== 'rpm' && value !== 'force' && value !== 'braking') return;
		state.dynamics.graphView = value;
		renderGraph(refs);
	});
	refs.graphTractionOverlay.addEventListener('click', () => {
		state.dynamics.tractionOverlay = !state.dynamics.tractionOverlay;
		renderGraph(refs);
	});
};

/**
 * @brief Render alternate physical-unit plots and avoid misleading RPM crosshair readouts.
 * @param refs Cached graph handles.
 * @param width Plot width.
 * @param height Plot height.
 * @return True when the alternate view was rendered.
 */
const renderDynamicsGraph = (refs: ElementRefs, width: number, height: number): boolean => {
	const view = state.dynamics.graphView;
	const select = refs.graphView;
	if (select) select.value = view;
	const toggle = refs.graphTractionOverlay;
	toggle?.setAttribute('aria-pressed', String(state.dynamics.tractionOverlay));
	if (toggle) toggle.hidden = view !== 'force';
	const title = document.getElementById('graph-title');
	const legend = refs.graphSvg.closest('.graph-card')?.querySelector<HTMLElement>('.graph-legend');
	if (legend) legend.hidden = view !== 'rpm';
	for (const button of refs.graphLayerButtons) {
		const key = LAYER_SETTINGS[layerSlug(button.dataset.graphLayer)];
		button.hidden = view === 'braking' || (view === 'force' && key !== 'gripLimit');
	}
	if (title) {
		const key = view === 'force' ? 'dynamics.forceView' : view === 'braking' ? 'dynamics.brakingView' : 'graph.title';
		title.dataset.i18n = key;
		title.textContent = t(key);
	}
	if (view === 'rpm') return false;
	clearCrosshairContext();
	clearCrosshair(refs);
	clearChildren(refs.graphSvg);
	mountPrims(refs.graphSvg, buildDynamicsGraph(width, height));
	return true;
};

/**
 * @brief Toggle the fullscreen graph card and its button state.
 * @param refs Cached DOM handles.
 * @return void
 */
export const toggleGraphExpand = (refs: ElementRefs): void => {
	const card = refs.graphSvg.closest('.graph-card');
	if (!card) {
		return;
	}
	const open = !card.classList.contains('graph-fullscreen');
	card.classList.toggle('graph-fullscreen', open);
	refs.btnExpandGraph.setAttribute('aria-expanded', String(open));
	refs.btnExpandGraph.textContent = open ? t('graph.collapse') : t('graph.expand');
	const tip = open ? t('graph.collapseTip') : t('graph.expandTip');
	refs.btnExpandGraph.setAttribute('title', tip);
	refs.btnExpandGraph.setAttribute('data-tip', tip);
	refs.btnExpandGraph.setAttribute('aria-label', tip);
	document.body.style.overflow = open ? 'hidden' : '';
	renderGraph(refs);
};
