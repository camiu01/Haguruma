/**
 * @file pyrometer-events.ts
 * @brief Bind the 3-zone pyrometer fields to a live diagnostic re-render.
 */
import { bindPyrometerEvents as bindToolInputs, renderPyrometer } from '../../components/pyrometer-tool';

/**
 * @brief Wire the pyrometer card so every edit repaints its readouts.
 * @brief The card owns its own readings, so an edit only repaints the card:
 * @brief the app-wide refresh offered by the shared binder is deliberately not
 * @brief called, which keeps keystrokes from re-drawing the graph and tables.
 * @param _appRender App-wide render callback, unused by this self-contained card.
 * @return void
 */
export const bindPyrometerEvents = (_appRender?: () => void): void => {
	bindToolInputs(renderPyrometer);
	renderPyrometer();
};
