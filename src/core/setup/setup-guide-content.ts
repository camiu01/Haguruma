/**
 * @file setup-guide-content.ts
 * @brief Offline knowledge base: feel-the-car cues and systematic setup procedure.
 */
import type { Lang } from '../i18n/dictionaries';
import type { CornerPhase } from './setup-matrix';
import type { LocalizedText } from './setup-matrix';

/** One diagnostic bullet inside a corner-phase section. */
export interface FeelCue {
	/** Short cue title. */
	title: LocalizedText;
	/** How to recognise it from the cockpit. */
	body: LocalizedText;
}

/** Feel-the-car section for one corner phase. */
export interface FeelSection {
	/** Phase key. */
	phase: CornerPhase;
	/** Section heading. */
	title: LocalizedText;
	/** Diagnostic cues. */
	cues: FeelCue[];
}

/** One step of the engineering setup sequence. */
export interface ProcedureStep {
	/** Step number, 1-based in execution order. */
	n: number;
	/** Step title. */
	title: LocalizedText;
	/** What to do and what good looks like. */
	body: LocalizedText;
}

/**
 * @brief Driver-feedback cues per corner phase, original wording.
 * @return Feel-the-car sections in phase order.
 */
export const FEEL_GUIDE: FeelSection[] = [
	{
		phase: 'entry',
		title: { en: 'Braking & Corner Entry', it: 'Frenata e ingresso curva' },
		cues: [
			{
				title: { en: 'Front lockup vs rear instability', it: 'Bloccaggio anteriore vs instabilit\u00e0 posteriore' },
				body: { en: 'Front bias too far forward: fronts lock with the wheel straight and the car sails wide. Too far rearward: the tail steps out the moment you trail the brake into steering.', it: 'Bias troppo avanti: l\u2019anteriore blocca a ruote dritte e l\u2019auto va dritta. Troppo indietro: la coda parte appena sfiori il freno in inserimento.' },
			},
			{
				title: { en: 'Engine braking vs coast-lock behaviour', it: 'Freno motore vs bloccaggio in rilascio' },
				body: { en: 'Harsh engine braking rotates the car even with zero brake pressure; coast lock that is too open lets the inside rear run free and feels the same at first. Test with a clean lift before touching the bias.', it: 'Un freno motore aggressivo fa ruotare l\u2019auto anche senza freno; un coast troppo aperto libera la posteriore interna e sembra uguale. Prova con un rilascio pulito prima di toccare il bias.' },
			},
			{
				title: { en: 'Pitch rate and turn-in crispness', it: 'Velocit\u00e0 di beccheggio e prontezza in inserimento' },
				body: { en: 'Slow low-speed rebound and bump make the nose dive late and lazily; the steering feels connected one instant too late. Two clicks change the transient more than a spring step here.', it: 'Estensione e compressione lente rendono l\u2019affondamento tardivo e pigro; lo sterzo si collega un istante dopo. Qui due clic contano pi\u00f9 di uno scatto di molla.' },
			},
		],
	},
	{
		phase: 'mid',
		title: { en: 'Mid-Corner (Apex / Steady State)', it: 'Corda (apex / stazionario)' },
		cues: [
			{
				title: { en: 'Low speed: mechanical grip balance', it: 'Bassa velocit\u00e0: bilancio meccanico' },
				body: { en: 'Hold constant steering and throttle: a widening nose is roll stiffness or camber biased to the rear; a tightening line is the opposite. Read inner-middle-outer temps before changing bars.', it: 'Tieni sterzo e gas costanti: il muso che allarga \u00e8 rollio o camber spostati dietro; la traiettoria che chiude \u00e8 l\u2019opposto. Leggi le temperature interno-centro-esterno prima di toccare le barre.' },
			},
			{
				title: { en: 'High speed: aero platform stability', it: 'Alta velocit\u00e0: stabilit\u00e0 della piattaforma aero' },
				body: { en: 'Balance that is fine in slow corners but drifts at speed is aero, not mechanical. Note whether the front (splitter) or rear (wing) lets go first, then check rake sensitivity in 2 mm steps.', it: 'Un bilancio ok nel lento che scappa nel veloce \u00e8 aero, non meccanico. Nota se cede prima l\u2019anteriore (splitter) o il posteriore (ala), poi verifica la sensibilit\u00e0 al rake a passi di 2 mm.' },
			},
		],
	},
	{
		phase: 'exit',
		title: { en: 'Corner Exit (On-Throttle)', it: 'Uscita (in accelerazione)' },
		cues: [
			{
				title: { en: 'Inside wheelspin vs power push vs snap', it: 'Pattinamento interno vs sottosterzo vs scatto in potenza' },
				body: { en: 'One spinning inside wheel with rising revs is accel lock too open. Both rears gripping while the nose runs wide is power understeer. A sudden rotation past the apex is lock too high or excess rear roll stiffness.', it: 'Una sola ruota interna che gira con giri in salita \u00e8 tiro troppo aperto. Entrambe le posteriori in presa col muso largo \u00e8 sottosterzo in potenza. Una rotazione improvvisa oltre l\u2019apex \u00e8 bloccaggio eccessivo o troppa rigidezza posteriore.' },
			},
			{
				title: { en: 'Rear squat and bump-stop engagement', it: 'Schiacciamento e ingaggio dei tamponi' },
				body: { en: 'A rear that sits down once and drives is healthy squat; a rear that hits, bounces and unloads the tyres is riding the stops. Distinguish with ride-height logging before stiffening springs.', it: 'Un retrotreno che si siede una volta e spinge \u00e8 sano; se tocca, rimbalza e scarica le gomme sei sui tamponi. Distingui con le altezze prima di indurire le molle.' },
			},
		],
	},
];

/**
 * @brief Strict engineering order: change one parameter at a time.
 * @return Eight procedure steps in execution order.
 */
export const PROCEDURE_STEPS: ProcedureStep[] = [
	{
		n: 1,
		title: { en: 'Base ride height & rake', it: 'Altezze base e rake' },
		body: { en: 'Set the aero baseline first: enough travel everywhere, no grounding, rake documented. Every later change assumes this platform.', it: 'Fissa prima la base aero: corsa sufficiente ovunque, nessun contatto, rake annotato. Ogni modifica successiva presuppone questa piattaforma.' },
	},
	{
		n: 2,
		title: { en: 'Tyre pressures & camber', it: 'Pressioni e camber' },
		body: { en: 'Target the ideal contact patch: hot pressures on target, uniform inner-middle-outer temperatures. Re-check after every spring or height change.', it: 'Cerca l\u2019impronta ideale: pressioni a caldo sul target, temperature interno-centro-esterno uniformi. Ricontrolla dopo ogni molla o altezza.' },
	},
	{
		n: 3,
		title: { en: 'Straight-line braking & bias', it: 'Frenata rettilinea e bias' },
		body: { en: 'Brake hard with minimal steering: the front should lock marginally before the rear and the car must hold a straight line.', it: 'Frena forte con poco sterzo: l\u2019anteriore deve bloccare di poco prima del posteriore e l\u2019auto deve restare dritta.' },
	},
	{
		n: 4,
		title: { en: 'Steady-state roll balance (ARBs)', it: 'Bilancio di rollio stazionario (ARB)' },
		body: { en: 'Tune mid-corner balance with anti-roll bars only. This isolates roll distribution from spring and damper effects.', it: 'Regola il bilancio in corda solo con le barre. Isoli la distribuzione del rollio da molle e ammortizzatori.' },
	},
	{
		n: 5,
		title: { en: 'Wheel rates / springs', it: 'Molleggio / molle' },
		body: { en: 'Support pitch and roll with springs and keep kerb compliance. Revisit ride height and camber afterwards.', it: 'Sostieni beccheggio e rollio con le molle tenendo l\u2019assorbimento dei cordoli. Poi rivisita altezze e camber.' },
	},
	{
		n: 6,
		title: { en: 'Dampers: low-speed then high-speed', it: 'Ammortizzatori: prima lenti poi veloci' },
		body: { en: 'Low-speed first for driver inputs and roll rate, then high-speed for bumps and kerb strikes. Never fix a spring problem with clicks alone.', it: 'Prima le lente per gli input del pilota e il rollio, poi le veloci per buche e cordoli. Mai curare un problema di molle solo coi clic.' },
	},
	{
		n: 7,
		title: { en: 'Differential: coast then power', it: 'Differenziale: prima rilascio poi tiro' },
		body: { en: 'Coast lock for off-throttle stability, power lock for on-throttle drive. Change one ramp at a time.', it: 'Bloccaggio in rilascio per la stabilit\u00e0, in tiro per la trazione. Cambia una rampa alla volta.' },
	},
	{
		n: 8,
		title: { en: 'Aerodynamic trim', it: 'Rifinitura aerodinamica' },
		body: { en: 'Fine-tune high-speed balance last: small wing or rake steps, watching the drag penalty on the straight.', it: 'Rifinisci il bilancio veloce per ultimo: piccoli passi di ala o rake, guardando la penalit\u00e0 di resistenza in rettilineo.' },
	},
];

/**
 * @brief Localise a feel section for rendering.
 * @param section Feel section to localise.
 * @param lang Active interface language.
 * @return Title plus plain-string cues.
 */
export const localiseFeel = (section: FeelSection, lang: Lang): { title: string; cues: { title: string; body: string }[] } => {
	return {
		title: lang === 'it' ? section.title.it : section.title.en,
		cues: section.cues.map((cue) => ({
			title: lang === 'it' ? cue.title.it : cue.title.en,
			body: lang === 'it' ? cue.body.it : cue.body.en,
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
		title: lang === 'it' ? step.title.it : step.title.en,
		body: lang === 'it' ? step.body.it : step.body.en,
	};
};
