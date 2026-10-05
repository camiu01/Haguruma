/**
 * @file app-shell.ts
 * @brief Compose the static application shell from focused HTML modules.
 */
import headerHtml from '../templates/header.html?raw';
import kpiStripHtml from '../templates/kpi-strip.html?raw';
import drawerHtml from '../templates/drawer.html?raw';
import primarySetupHtml from '../templates/primary-setup.html?raw';
import comparisonHtml from '../templates/comparison.html?raw';
import toolsHtml from '../templates/tools.html?raw';
import analysisHtml from '../templates/analysis.html?raw';
import qrModalHtml from '../templates/qr-modal.html?raw';
import myCarsModalHtml from '../templates/mycars-modal.html?raw';
import footerHtml from '../templates/footer.html?raw';

/**
 * @brief Inject every static shell before component mounts and DOM refs resolve.
 * @param mount Root node reserved by index.html.
 * @return void
 */
export const injectAppShell = (mount: HTMLElement): void => {
	const template = document.createElement('template');
	template.innerHTML = [
		headerHtml,
		kpiStripHtml,
		drawerHtml,
		buildWorkspace(),
		qrModalHtml,
		myCarsModalHtml,
		footerHtml,
	].join('\n');
	mount.replaceWith(template.content);
};

/**
 * @brief Compose the two-column workspace from its declarative shell modules.
 * @return Complete main workspace markup.
 */
const buildWorkspace = (): string => {
	return `
		<main class='app-layout'>
			<section class='workspace-sidebar custom-scroll'>
				${primarySetupHtml}
				${comparisonHtml}
				${toolsHtml}
			</section>
			${analysisHtml}
		</main>
	`;
};
