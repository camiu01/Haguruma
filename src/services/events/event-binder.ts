import type { ElementRefs } from '../dom/element-refs';
import { bindLanguageEvents } from './language-events';
import { bindUnitEvents } from './unit-events';
import { bindPresetEvents } from './preset-events';import { bindPrimaryEvents } from './primary-events';
import { bindComparisonEvents, bindGearActions } from './comparison-events';
import { bindRoadLoadEvents } from './road-load-events';
import { bindEngineEvents } from './engine-events';
import { bindShareEvents } from './share-events';
import { bindThemeEvents } from './theme-events';
import { bindCustomCar } from '../../components/custom-car';
import { bindCanvasEvents } from './canvas-events';
import { bindDrawerEvents } from './mobile-drawer-events';
import { bindViewportEvents } from './viewport-events';
import { bindAccordionEvents } from './accordion-events';
import { bindMyCarsModalEvents } from './mycars-modal-events';

/**
 * Wire every UI interaction exactly once.
 * @purpose Split startup wiring into focused sub-binders.
 * @param refs Cached DOM handles.
 * @param render Full refresh callback.
 */
export const bindAllEvents = (refs: ElementRefs, render: () => void): void => {
	bindLanguageEvents(refs, render);
	bindUnitEvents(refs, render);
	bindPresetEvents(refs, render);
	bindPrimaryEvents(refs, render);
	bindComparisonEvents(refs, render);
	bindRoadLoadEvents(refs, render);
	bindEngineEvents(refs, render);
	bindShareEvents(refs);
	bindThemeEvents(refs, render);
	bindCustomCar(refs, render);
	bindGearActions(refs, render);
	bindCanvasEvents(refs);
	bindDrawerEvents(refs);
	bindViewportEvents(refs);
	bindAccordionEvents(refs);
	bindMyCarsModalEvents(refs);
};
