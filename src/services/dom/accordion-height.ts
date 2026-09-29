/**
 * @file accordion-height.ts
 * @brief Dynamic max-height sync for collapsible accordion sections.
 */

/**
 * Mirror an open accordion's content height into an inline max-height.
 * @brief The stylesheet leaves open sections unbounded (`max-height: none`)
 * @brief so content can never be clipped; the inline pixel value exists only
 * @brief to keep the collapse/expand transition animatable. Closed sections
 * @brief drop the inline value and collapse to the stylesheet's zero height.
 * @param content Collapsible section body.
 * @return void
 */
export const syncAccordionHeight = (content: HTMLElement): void => {
	if (!content.classList.contains('open')) {
		content.style.maxHeight = '';
		return;
	}
	content.style.maxHeight = `${content.scrollHeight}px`;
};

/**
 * Re-sync every open accordion inside a scope.
 * @brief Called after renders, level gating, language switches and resizes,
 * @brief whenever inner content may have changed height.
 * @param root Scope to search, defaults to the whole document.
 * @return void
 */
export const syncOpenAccordionHeights = (root: ParentNode = document): void => {
	root.querySelectorAll<HTMLElement>('.section-content.open').forEach(syncAccordionHeight);
};
