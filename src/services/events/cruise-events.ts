/**
 * @file cruise-events.ts
 * @brief Bind the highway cruising speed input to a live re-check.
 */
import type { ElementRefs } from '../dom/element-refs';
import { renderCruise } from '../../components/cruise-card';

/**
 * @brief Bind the cruise speed input for live recomputation.
 * @param refs Cached DOM handles.
 * @return void
 */
export const bindCruiseEvents = (refs: ElementRefs): void => {
	refs.cruiseSpeed.addEventListener('input', () => renderCruise(refs));
};
