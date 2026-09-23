/**
 * @file setup-guide-content.ts
 * @brief Offline knowledge base: feel-the-car cues and systematic setup procedure.
 */
import type { Lang } from '../i18n/dictionaries';
import type { DictKey } from '../i18n/dictionaries';
import { t } from '../i18n/language';
import type { CornerPhase } from './setup-matrix';

/** One diagnostic bullet pointing at dictionary copy. */
export interface FeelCue {
	/** Dictionary key for the cue title. */
	titleKey: DictKey;
	/** Dictionary key for the recognition guidance. */
	bodyKey: DictKey;
}

/** Localisable feel content: heading plus diagnostic cues. */
export interface FeelContent {
	/** Dictionary key for the section heading. */
	titleKey: DictKey;
	/** Diagnostic cues. */
	cues: FeelCue[];
}

/** Feel-the-car section for one corner phase. */
export interface FeelSection extends FeelContent {
	/** Phase key. */
	phase: CornerPhase;
}

/** One step of the engineering setup sequence. */
export interface ProcedureStep {
	/** Step number, 1-based in execution order. */
	n: number;
	/** Dictionary key for the step title. */
	titleKey: DictKey;
	/** Dictionary key for the instruction. */
	bodyKey: DictKey;
}

/**
 * @brief Driver-feedback cues per corner phase, dictionary-backed.
 * @return Feel-the-car sections in phase order.
 */
export const FEEL_GUIDE: FeelSection[] = [
	{
		phase: 'entry',
		titleKey: 'setup.feel.entry.title',
		cues: [
			{ titleKey: 'setup.feel.entry.cue.1.title', bodyKey: 'setup.feel.entry.cue.1.body' },
			{ titleKey: 'setup.feel.entry.cue.2.title', bodyKey: 'setup.feel.entry.cue.2.body' },
			{ titleKey: 'setup.feel.entry.cue.3.title', bodyKey: 'setup.feel.entry.cue.3.body' },
		],
	},
	{
		phase: 'mid',
		titleKey: 'setup.feel.mid.title',
		cues: [
			{ titleKey: 'setup.feel.mid.cue.1.title', bodyKey: 'setup.feel.mid.cue.1.body' },
			{ titleKey: 'setup.feel.mid.cue.2.title', bodyKey: 'setup.feel.mid.cue.2.body' },
		],
	},
	{
		phase: 'exit',
		titleKey: 'setup.feel.exit.title',
		cues: [
			{ titleKey: 'setup.feel.exit.cue.1.title', bodyKey: 'setup.feel.exit.cue.1.body' },
			{ titleKey: 'setup.feel.exit.cue.2.title', bodyKey: 'setup.feel.exit.cue.2.body' },
		],
	},
];

/**
 * @brief Strict engineering order: change one parameter at a time.
 * @return Eight procedure steps in execution order.
 */
export const PROCEDURE_STEPS: ProcedureStep[] = [
	{ n: 1, titleKey: 'setup.proc.1.title', bodyKey: 'setup.proc.1.body' },
	{ n: 2, titleKey: 'setup.proc.2.title', bodyKey: 'setup.proc.2.body' },
	{ n: 3, titleKey: 'setup.proc.3.title', bodyKey: 'setup.proc.3.body' },
	{ n: 4, titleKey: 'setup.proc.4.title', bodyKey: 'setup.proc.4.body' },
	{ n: 5, titleKey: 'setup.proc.5.title', bodyKey: 'setup.proc.5.body' },
	{ n: 6, titleKey: 'setup.proc.6.title', bodyKey: 'setup.proc.6.body' },
	{ n: 7, titleKey: 'setup.proc.7.title', bodyKey: 'setup.proc.7.body' },
	{ n: 8, titleKey: 'setup.proc.8.title', bodyKey: 'setup.proc.8.body' },
];

/**
 * @brief Tyre temperature reading guidance for the pyrometer card.
 * @return Localisable title plus diagnostic cues.
 */
export const PYROMETER_GUIDE: FeelContent = {
	titleKey: 'setup.pyro.title',
	cues: [
		{ titleKey: 'setup.pyro.cue.1.title', bodyKey: 'setup.pyro.cue.1.body' },
		{ titleKey: 'setup.pyro.cue.2.title', bodyKey: 'setup.pyro.cue.2.body' },
		{ titleKey: 'setup.pyro.cue.3.title', bodyKey: 'setup.pyro.cue.3.body' },
	],
};

/**
 * @brief Resolve the feel section for a corner phase.
 * @param phase Corner phase to look up.
 * @return Matching feel section, never undefined.
 */
export const feelSectionFor = (phase: CornerPhase): FeelSection => {
	const section = FEEL_GUIDE.find((entry) => entry.phase === phase);
	if (!section) {
		throw new Error(`Unknown corner phase: ${phase}`);
	}
	return section;
};

/**
 * @brief Localise feel content for rendering.
 * @param section Feel content to localise.
 * @param lang Active interface language.
 * @return Title plus plain-string cues.
 */
export const localiseFeel = (section: FeelContent, lang: Lang): { title: string; cues: { title: string; body: string }[] } => {
	return {
		title: t(section.titleKey, lang),
		cues: section.cues.map((cue) => ({
			title: t(cue.titleKey, lang),
			body: t(cue.bodyKey, lang),
		})),
	};
};

/**
 * @brief Localise one procedure step for rendering.
 * @param step Procedure step to localise.
 * @param lang Active interface language.
 * @return Step number plus plain-string title and body.
 */
export const localiseStep = (step: ProcedureStep, lang: Lang): { n: number; title: string; body: string } => {
	return {
		n: step.n,
		title: t(step.titleKey, lang),
		body: t(step.bodyKey, lang),
	};
};
