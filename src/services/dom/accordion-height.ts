/**
 * @file accordion-height.ts
 * @brief Dynamic max-height sync for collapsible accordion sections.
 */

/** Pending animation frame used to coalesce height syncs. */
let pendingFrame: number | null = null;

/** Shared observer re-measuring open sections when their content resizes. */
let resizeObserver: ResizeObserver | null = null;

/**
 * Mirror an open accordion's content height into an inline max-height.
 * @brief The stylesheet leaves open sections unbounded (`max-height: none`)
 * @brief so content can never be clipped; the inline pixel value exists only
 * @brief to keep the collapse/expand transition animatable. Closed sections
 * @brief drop the inline value and collapse to the stylesheet's zero height.
 * @brief Unrendered sections are skipped so a hidden ancestor never freezes
 * @brief the height at zero and later hides visible content.
 * @param content Collapsible section body.
 * @return void
 */
export const syncAccordionHeight = (content: HTMLElement): void => {
	if (!content.classList.contains('open')) {
		content.style.maxHeight = '';
		unobserveSection(content);
		return;
	}
	if (content.getClientRects().length === 0 || content.scrollHeight === 0) {
		return;
	}
	content.style.maxHeight = `${content.scrollHeight}px`;
};

/**
 * Stop watching a closed section and its children.
 * @param content Collapsible section body leaving the open state.
 * @return void
 */
const unobserveSection = (content: HTMLElement): void => {
	if (!resizeObserver) {
		return;
	}
	resizeObserver.unobserve(content);
	for (const child of Array.from(content.children)) {
		resizeObserver.unobserve(child);
	}
};

/**
 * Re-sync every open accordion inside a scope.
 * @brief Called after renders, level gating, language switches and resizes,
 * @brief whenever inner content may have changed height. Each pass also (re)
 * @brief observes the section and its children so text reflow from late web
 * @brief font swaps resizes the box and schedules another measurement.
 * @param root Scope to search, defaults to the whole document.
 * @return void
 */
export const syncOpenAccordionHeights = (root: ParentNode = document): void => {
	const open = root.querySelectorAll<HTMLElement>('.section-content.open');
	open.forEach(syncAccordionHeight);
	observeOpenSections(open);
};

/**
 * Watch open sections and their children for size changes.
 * @brief Fonts, wrappers and injected rows change height without any DOM
 * @brief mutation, so a resize observer is the only reliable signal. Re-seeing
 * @brief the same box size does not re-fire, which keeps the loop stable.
 * @param sections Open sections to keep under observation.
 * @return void
 */
const observeOpenSections = (sections: Iterable<HTMLElement>): void => {
	if (typeof window === 'undefined' || !('ResizeObserver' in window)) {
		return;
	}
	if (!resizeObserver) {
		resizeObserver = new ResizeObserver(() => scheduleAccordionSync());
	}
	for (const section of sections) {
		resizeObserver.observe(section);
		for (const child of Array.from(section.children)) {
			resizeObserver.observe(child);
		}
	}
};

/**
 * Schedule a coalesced height sync on the next animation frame.
 * @brief Many text writes per render collapse into a single measurement pass.
 * @return void
 */
const scheduleAccordionSync = (): void => {
	if (pendingFrame !== null) {
		return;
	}
	pendingFrame = window.requestAnimationFrame(() => {
		pendingFrame = null;
		syncOpenAccordionHeights();
	});
};

/**
 * Watch the document for content changes that grow an open accordion.
 * @brief Safety net for mutations that bypass `renderAll()` (details toggles,
 * @brief late shell injections, gear rows, language rewrites). Only child and
 * @brief character data mutations are observed, so writing the inline
 * @brief `max-height` never re-triggers the observer.
 * @param root Subtree to observe, defaults to the document body.
 * @return void
 */
export const observeAccordionHeights = (root: ParentNode = document.body): void => {
	const insideOpen = (node: Node): boolean => {
		const el = node instanceof Element ? node : node.parentElement;
		return el?.closest('.section-content.open') !== null && el !== null;
	};
	new MutationObserver((mutations) => {
		for (const mutation of mutations) {
			if (mutation.type === 'childList') {
				const added = Array.from(mutation.addedNodes).some(
					(node) => node instanceof Element && node.querySelector('.section-content.open'),
				);
				if (added || insideOpen(mutation.target)) {
					scheduleAccordionSync();
					return;
				}
				continue;
			}
			if (insideOpen(mutation.target)) {
				scheduleAccordionSync();
				return;
			}
		}
	}).observe(root, { subtree: true, childList: true, characterData: true });
};
