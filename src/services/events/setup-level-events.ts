/**
 * @file setup-level-events.ts
 * @brief Easy/Medium/Full setup complexity gating setup inputs only.
 *
 * The primary level gates setup sections and rows (tires, ratios, limiter,
 * aero, engine, chassis); graph, table, cruise, guides and export always
 * stay visible. The comparison follows the primary level and can be lowered
 * independently (same detail or smaller), gating its running-gear rows.
 */
import { state } from '../../core/state/app-state';
import type { ElementRefs } from '../dom/element-refs';
import type { SetupLevel } from '../../core/models';

/** localStorage key for the persisted primary setup level. */
const LEVEL_KEY = 'haguruma-setup-level';

/** localStorage key for the persisted comparison level. */
const COMP_LEVEL_KEY = 'haguruma-comp-level';

/** Rank driving visibility (higher unlocks more). */
const RANK: Record<SetupLevel, number> = { easy: 0, medium: 1, full: 2 };

/** Minimum primary level per setup accordion section (hidden below it). */
const SECTION_LEVELS: Record<string, SetupLevel> = {
	gears: 'full',
	engine: 'medium',
	road: 'medium',
};

/** Minimum primary level per setup control row, keyed by input id. */
const ROW_LEVELS: Record<string, SetupLevel> = {
	'graph-max-speed': 'medium',
	'rg-tire': 'easy',
	'rg-layout': 'medium',
	'rg-latg': 'medium',
	'rg-diff': 'full',
	'rg-bias': 'full',
	'rg-coast': 'full',
	'rg-weight': 'full',
	'rg-cog': 'full',
	'rg-wheelbase': 'full',
	'rg-track': 'full',
	'rg-spring-f': 'full',
	'rg-spring-r': 'full',
	'rg-differentialPreloadNm': 'full',
	'rg-awdFrontShare': 'full',
	'rg-centerDiffLock': 'full',
	'rg-torqueVectoring': 'full',
	'rg-handbrakeDisengage': 'full',
	'rg-handbrakeApplied': 'full',
};

/** Minimum comparison level per secondary accordion section. */
const COMP_SECTION_LEVELS: Record<string, SetupLevel> = {
	'comp-engine': 'medium',
	'comp-aero': 'medium',
	'comp-gears': 'full',
};

/** Minimum comparison level per secondary control row, keyed by input id. */
const COMP_ROW_LEVELS: Record<string, SetupLevel> = {
	'comp-gears': 'full',
	'crg-layout': 'medium',
	'crg-tire': 'easy',
	'crg-latg': 'medium',
	'crg-lift': 'easy',
	'crg-lift-area': 'easy',
	'crg-lift-share': 'easy',
	'crg-diff': 'full',
	'crg-bias': 'full',
	'crg-coast': 'full',
	'crg-weight': 'full',
	'crg-cog': 'full',
	'crg-wheelbase': 'full',
	'crg-track': 'full',
	'crg-spring-f': 'full',
	'crg-spring-r': 'full',
	'crg-differentialPreloadNm': 'full',
	'crg-awdFrontShare': 'full',
	'crg-centerDiffLock': 'full',
	'crg-torqueVectoring': 'full',
	'crg-handbrakeDisengage': 'full',
	'crg-handbrakeApplied': 'full',
};

/**
 * @brief Parse a stored setup level, legacy-safe.
 * @param raw Raw localStorage value.
 * @return Stored level, or full when missing or unknown.
 */
const parseLevel = (raw: string | null): SetupLevel => {
	return raw === 'easy' || raw === 'medium' || raw === 'full' ? raw : 'full';
};

/**
 * @brief Load the persisted setup levels into state.
 * @brief Comparison level is clamped to the primary one.
 * @return Active primary setup level.
 */
export const initSetupLevel = (): SetupLevel => {
	try {
		state.setupLevel = parseLevel(window.localStorage.getItem(LEVEL_KEY));
		state.compLevel = parseLevel(window.localStorage.getItem(COMP_LEVEL_KEY));
	} catch {
		state.setupLevel = 'full';
		state.compLevel = 'full';
	}
	clampCompLevel();
	return state.setupLevel;
};

/**
 * @brief Clamp the comparison level to the primary one (same or smaller).
 * @brief Used only for stored values; live changes follow the primary level.
 * @return void
 */
const clampCompLevel = (): void => {
	if (RANK[state.compLevel] > RANK[state.setupLevel]) {
		state.compLevel = state.setupLevel;
		try {
			window.localStorage.setItem(COMP_LEVEL_KEY, state.compLevel);
		} catch {
			return;
		}
	}
};

/**
 * @brief Hide one control row below its minimum level.
 * @param id Input element id.
 * @param min Minimum level showing the row.
 * @param rank Active level rank.
 * @return void
 */
const applyRowLevel = (id: string, min: SetupLevel, rank: number): void => {
	const el = document.getElementById(id);
	const row = el?.closest('.col-span-2, .field-half') ?? el;
	if (row) {
		row.classList.toggle('hidden', RANK[min] > rank);
	}
};

/**
 * @brief Apply visibility for the active primary setup level.
 * @brief Sections hide wholesale, rows hide through their grid wrapper, and
 * @brief cards left with no visible accordion are hidden as well.
 * @return void
 */
export const applySetupLevel = (): void => {
	const rank = RANK[state.setupLevel] ?? RANK.full;
	for (const section of document.querySelectorAll<HTMLElement>('[data-accordion]')) {
		const min = SECTION_LEVELS[section.dataset.accordion ?? ''];
		if (!min) {
			continue;
		}
		section.classList.toggle('hidden', RANK[min] > rank);
	}
	for (const card of document.querySelectorAll<HTMLElement>('.card')) {
		const accordions = card.querySelectorAll('[data-accordion]');
		if (accordions.length > 0 && Array.from(accordions).every((a) => a.classList.contains('hidden'))) {
			card.classList.add('hidden');
			continue;
		}
		if (accordions.length > 0) {
			card.classList.remove('hidden');
		}
	}
	for (const [id, min] of Object.entries(ROW_LEVELS)) {
		applyRowLevel(id, min, rank);
	}
	applyCompLevel();
};

/**
 * @brief Apply visibility for the comparison detail level.
 * @brief Secondary sections and running-gear rows are gated.
 * @return void
 */
export const applyCompLevel = (): void => {
	const rank = RANK[state.compLevel] ?? RANK.full;
	for (const section of document.querySelectorAll<HTMLElement>('[data-accordion]')) {
		const min = COMP_SECTION_LEVELS[section.dataset.accordion ?? ''];
		if (min) {
			section.classList.toggle('hidden', RANK[min] > rank);
		}
	}
	for (const [id, min] of Object.entries(COMP_ROW_LEVELS)) {
		applyRowLevel(id, min, rank);
	}
};

/**
 * @brief Sync both level selects from state.
 * @brief Comparison options above the primary level are hidden.
 * @param refs Cached DOM handles.
 * @return void
 */
export const syncSetupLevel = (refs: ElementRefs): void => {
	refs.setupLevel.value = state.setupLevel;
	syncCompOptions(refs);
	refs.compLevel.value = state.compLevel;
};

/**
 * @brief Show only comparison levels up to the primary one.
 * @param refs Cached DOM handles.
 * @return void
 */
const syncCompOptions = (refs: ElementRefs): void => {
	const rank = RANK[state.setupLevel] ?? RANK.full;
	for (const option of Array.from(refs.compLevel.options)) {
		const hidden = (RANK[option.value as SetupLevel] ?? RANK.full) > rank;
		option.classList.toggle('hidden', hidden);
		option.disabled = hidden;
	}
};

/**
 * @brief Bind both level selectors with persistence.
 * @param refs Cached DOM handles.
 * @param render Full refresh callback.
 * @return void
 */
export const bindSetupLevelEvents = (refs: ElementRefs, render: () => void): void => {
	refs.setupLevel.addEventListener('change', (e) => {
		const v = (e.target as HTMLSelectElement).value;
		if (v !== 'easy' && v !== 'medium' && v !== 'full') {
			return;
		}
		state.setupLevel = v;
		state.compLevel = v;
		try {
			window.localStorage.setItem(LEVEL_KEY, v);
			window.localStorage.setItem(COMP_LEVEL_KEY, v);
		} catch {
			return;
		}
		syncSetupLevel(refs);
		render();
	});
	refs.compLevel.addEventListener('change', (e) => {
		const v = (e.target as HTMLSelectElement).value;
		if (v !== 'easy' && v !== 'medium' && v !== 'full') {
			return;
		}
		if (RANK[v] > (RANK[state.setupLevel] ?? RANK.full)) {
			syncSetupLevel(refs);
			return;
		}
		state.compLevel = v;
		try {
			window.localStorage.setItem(COMP_LEVEL_KEY, v);
		} catch {
			return;
		}
		render();
	});
};
