/**
 * @file setup-matrix.ts
 * @brief Offline troubleshooting matrix: corner phase x handling issue to ranked fixes.
 */
import type { Lang } from '../i18n/dictionaries';

/** Corner phase where the symptom appears. */
export type CornerPhase = 'entry' | 'mid' | 'exit';

/** Handling symptom reported by the driver. */
export type HandlingIssue = 'understeer' | 'oversteer' | 'transfer' | 'bottoming';

/** Expected side-effect magnitude of a fix. */
export type Severity = 'low' | 'medium' | 'high';

/** Short English + Italian copy pair kept fully offline. */
export interface LocalizedText {
	/** English copy. */
	en: string;
	/** Italian copy. */
	it: string;
}

/** Single ranked adjustment proposal. */
export interface SetupFix {
	/** Priority order, 1 is tried first. */
	rank: number;
	/** What to change. */
	action: LocalizedText;
	/** Why it helps. */
	detail: LocalizedText;
	/** Side-effect magnitude. */
	severity: Severity;
	/** Compromise to watch, when present. */
	tradeoff?: LocalizedText;
}

/** Wizard matrix covering every phase x issue pair. */
export type SetupMatrix = Record<CornerPhase, Record<HandlingIssue, SetupFix[]>>;

/** Ordered phases for the wizard selects. */
export const PHASES: CornerPhase[] = ['entry', 'mid', 'exit'];

/** Ordered issues for the wizard selects. */
export const ISSUES: HandlingIssue[] = ['understeer', 'oversteer', 'transfer', 'bottoming'];

/**
 * @brief Ranked adjustment proposals for all 12 diagnostic combinations.
 * @return Static matrix, original wording, no external sources.
 */
export const SETUP_MATRIX: SetupMatrix = {
	entry: {
		understeer: [
			{
				rank: 1,
				action: { en: 'Move brake bias rearward 1-2%', it: 'Sposta la ripartizione frenante indietro dell\u20191-2%' },
				detail: { en: 'Frees the front axle so the car rotates on turn-in.', it: 'Libera l\u2019avantreno cos\u00ec l\u2019auto ruota in inserimento.' },
				severity: 'medium',
				tradeoff: { en: 'Rear gets nervous under trail-braking.', it: 'Il retrotreno diventa nervoso in trail-braking.' },
			},
			{
				rank: 2,
				action: { en: 'Soften front ARB one step', it: 'Ammorbidisci la barra antirollio anteriore di uno scatto' },
				detail: { en: 'Adds front mechanical grip at low steering angles.', it: 'Aumenta il grip meccanico anteriore ai piccoli angoli di sterzo.' },
				severity: 'medium',
				tradeoff: { en: 'Conflicts with high-speed aero platform support.', it: 'Contrasta con il supporto della piattaforma aero ad alta velocit\u00e0.' },
			},
			{
				rank: 3,
				action: { en: 'Reduce front low-speed rebound 1-2 clicks', it: 'Riduci l\u2019estensione lenta anteriore di 1-2 clic' },
				detail: { en: 'Speeds up pitch transfer and sharpens initial response.', it: 'Accelera il trasferimento di beccheggio e rende la risposta iniziale pi\u00f9 pronta.' },
				severity: 'low',
			},
		],
		oversteer: [
			{
				rank: 1,
				action: { en: 'Move brake bias forward 1-2%', it: 'Sposta la ripartizione frenante in avanti dell\u20191-2%' },
				detail: { en: 'Stabilises the rear axle under straight-line braking.', it: 'Stabilizza il retrotreno in frenata rettilinea.' },
				severity: 'medium',
				tradeoff: { en: 'Longer stops; front locks first if overdone.', it: 'Frenate pi\u00f9 lunghe; l\u2019anteriore blocca per primo se esageri.' },
			},
			{
				rank: 2,
				action: { en: 'Increase differential coast lock', it: 'Aumenta il bloccaggio del differenziale in rilascio' },
				detail: { en: 'Calms rear rotation off throttle and on the brakes.', it: 'Calma la rotazione del retrotreno in rilascio e in frenata.' },
				severity: 'medium',
				tradeoff: { en: 'Can push the nose wide at apex release.', it: 'Pu\u00f2 allargare il muso al rilascio in corda.' },
			},
			{
				rank: 3,
				action: { en: 'Stiffen front ARB / soften rear one step', it: 'Indurisci l\u2019ARB anteriore / ammorbidisci la posteriore di uno scatto' },
				detail: { en: 'Shifts roll stiffness forward for entry stability.', it: 'Sposta la rigidezza al rollio in avanti per stabilit\u00e0 in ingresso.' },
				severity: 'medium',
			},
		],
		transfer: [
			{
				rank: 1,
				action: { en: 'Add front low-speed compression, rear low-speed rebound', it: 'Aggiungi compressione lenta anteriore ed estensione lenta posteriore' },
				detail: { en: 'Slows pitch rate so load settles instead of oscillating.', it: 'Rallenta il beccheggio cos\u00ec il carico si stabilizza senza oscillare.' },
				severity: 'medium',
				tradeoff: { en: 'Slightly duller initial turn-in.', it: 'Inserimento iniziale un po\u2019 meno pronto.' },
			},
			{
				rank: 2,
				action: { en: 'Smooth the brake release', it: 'Rendi pi\u00f9 progressivo il rilascio del freno' },
				detail: { en: 'Separates pitch from steering input in the driver\u2019s hands.', it: 'Separa beccheggio e sterzo nelle mani del pilota.' },
				severity: 'low',
			},
			{
				rank: 3,
				action: { en: 'Raise front ride height 2-3 mm', it: 'Alza l\u2019altezza anteriore di 2-3 mm' },
				detail: { en: 'Restores bump travel eaten up under dive.', it: 'Ripristina la corsa assorbita in affondamento.' },
				severity: 'low',
			},
		],
		bottoming: [
			{
				rank: 1,
				action: { en: 'Raise front ride height 3-5 mm', it: 'Alza l\u2019altezza anteriore di 3-5 mm' },
				detail: { en: 'Guarantees suspension travel under maximum dive.', it: 'Garantisce la corsa sotto il massimo affondamento.' },
				severity: 'high',
				tradeoff: { en: 'Less front downforce and later turn-in bite.', it: 'Meno deportanza anteriore e inserimento meno deciso.' },
			},
			{
				rank: 2,
				action: { en: 'Stiffen front springs one step', it: 'Indurisci le molle anteriori di uno scatto' },
				detail: { en: 'Supports the platform when ride height is already legal-minimum.', it: 'Sostiene la piattaforma quando l\u2019altezza \u00e8 gi\u00e0 al minimo.' },
				severity: 'medium',
				tradeoff: { en: 'Harsher over kerbs and bumps.', it: 'Pi\u00f9 brusca su cordoli e sconnessioni.' },
			},
			{
				rank: 3,
				action: { en: 'Add front high-speed compression', it: 'Aggiungi compressione veloce anteriore' },
				detail: { en: 'Absorbs sharp braking-bump strikes without touching low-speed feel.', it: 'Assorbe i colpi secchi in frenata senza toccare la sensibilit\u00e0 lenta.' },
				severity: 'low',
			},
		],
	},
	mid: {
		understeer: [
			{
				rank: 1,
				action: { en: 'Soften front ARB one step', it: 'Ammorbidisci l\u2019ARB anteriore di uno scatto' },
				detail: { en: 'Increases front contact-patch load in steady state.', it: 'Aumenta il carico sull\u2019impronta anteriore in stazionario.' },
				severity: 'medium',
				tradeoff: { en: 'Hurts high-speed aero platform; watch rake stability.', it: 'Penalizza la piattaforma aero veloce; controlla la stabilit\u00e0 del rake.' },
			},
			{
				rank: 2,
				action: { en: 'Add front negative camber within tyre-temp window', it: 'Aggiungi camber negativo anteriore entro la finestra termica' },
				detail: { en: 'Straightens the loaded tyre for more camber thrust.', it: 'Raddrizza la gomma carica per pi\u00f9 spinta di camber.' },
				severity: 'medium',
				tradeoff: { en: 'Less straight-line braking footprint.', it: 'Meno impronta in frenata rettilinea.' },
			},
			{
				rank: 3,
				action: { en: 'Set hot pressures to target, front first', it: 'Porta le pressioni a caldo al target, prima l\u2019anteriore' },
				detail: { en: 'Recovers contact-patch shape before any spring change.', it: 'Recupera la forma dell\u2019impronta prima di toccare le molle.' },
				severity: 'low',
			},
		],
		oversteer: [
			{
				rank: 1,
				action: { en: 'Soften rear ARB / stiffen front one step', it: 'Ammorbidisci l\u2019ARB posteriore / indurisci l\u2019anteriore di uno scatto' },
				detail: { en: 'Moves steady-state balance toward the front.', it: 'Sposta il bilancio stazionario verso l\u2019anteriore.' },
				severity: 'medium',
			},
			{
				rank: 2,
				action: { en: 'Add small rear toe-in', it: 'Aggiungi una piccola convergenza posteriore' },
				detail: { en: 'Gives the rear axle straight-line reference stability.', it: 'D\u00e0 al retrotreno un riferimento stabile in rettilineo.' },
				severity: 'low',
				tradeoff: { en: 'Slight drag and slower rotation.', it: 'Leggera resistenza e rotazione pi\u00f9 lenta.' },
			},
			{
				rank: 3,
				action: { en: 'Shift aero balance forward (less rear wing / more front)', it: 'Sposta il bilancio aero in avanti (meno ala dietro / pi\u00f9 carico davanti)' },
				detail: { en: 'Fixes high-speed oversteer the mechanical balance cannot.', it: 'Corregge il sovrasterzo veloce che il meccanico non pu\u00f2.' },
				severity: 'medium',
				tradeoff: { en: 'Possible straight-line drag penalty.', it: 'Possibile penalit\u00e0 di resistenza in rettilineo.' },
			},
		],
		transfer: [
			{
				rank: 1,
				action: { en: 'Balance low-speed rebound front to rear', it: 'Bilancia l\u2019estensione lenta tra anteriore e posteriore' },
				detail: { en: 'Stops the diagonal rocking after the initial set.', it: 'Ferma il dondolio diagonale dopo l\u2019appoggio iniziale.' },
				severity: 'medium',
			},
			{
				rank: 2,
				action: { en: 'Equalise hot tyre pressures side to side', it: 'Uniforma le pressioni a caldo tra i lati' },
				detail: { en: 'Removes pressure-induced roll-stiffness asymmetry.', it: 'Elimina l\u2019asimmetria di rollio indotta dalle pressioni.' },
				severity: 'low',
			},
			{
				rank: 3,
				action: { en: 'Delay the apex, unwind earlier', it: 'Ritarda l\u2019apex e raddrizza prima lo sterzo' },
				detail: { en: 'Shortens the steady-state window the setup must hold.', it: 'Accorcia la finestra stazionaria che il setup deve tenere.' },
				severity: 'low',
			},
		],
		bottoming: [
			{
				rank: 1,
				action: { en: 'Raise ride height on both axles', it: 'Alza l\u2019altezza su entrambi gli assi' },
				detail: { en: 'Restores travel at peak lateral load.', it: 'Ripristina la corsa al massimo carico laterale.' },
				severity: 'high',
				tradeoff: { en: 'Higher centre of gravity, more roll.', it: 'Baricentro pi\u00f9 alto, pi\u00f9 rollio.' },
			},
			{
				rank: 2,
				action: { en: 'Stiffen springs one step', it: 'Indurisci le molle di uno scatto' },
				detail: { en: 'Holds the platform when height is fixed by rules.', it: 'Tiene la piattaforma quando l\u2019altezza \u00e8 fissata dal regolamento.' },
				severity: 'medium',
			},
			{
				rank: 3,
				action: { en: 'Reduce rake', it: 'Riduci il rake' },
				detail: { en: 'Levels the floor so sealing stays consistent.', it: 'Livella il fondo cos\u00ec la sigillatura resta costante.' },
				severity: 'low',
			},
		],
	},
	exit: {
		understeer: [
			{
				rank: 1,
				action: { en: 'Reduce differential accel lock', it: 'Riduci il bloccaggio del differenziale in tiro' },
				detail: { en: 'Lets the car rotate instead of pushing wide on power.', it: 'Lascia ruotare l\u2019auto invece di allargare in accelerazione.' },
				severity: 'medium',
				tradeoff: { en: 'Risk of inside wheelspin on corner exit.', it: 'Rischio di pattinamento della ruota interna in uscita.' },
			},
			{
				rank: 2,
				action: { en: 'Soften rear ARB one step', it: 'Ammorbidisci l\u2019ARB posteriore di uno scatto' },
				detail: { en: 'Adds rear mechanical grip as throttle opens.', it: 'Aggiunge grip meccanico posteriore mentre apri il gas.' },
				severity: 'medium',
			},
			{
				rank: 3,
				action: { en: 'Lower rear ride height / reduce rake', it: 'Abbassa l\u2019altezza posteriore / riduci il rake' },
				detail: { en: 'Cuts rear aero jacking that overloads the front.', it: 'Riduce il sollevamento aero posteriore che sovraccarica l\u2019anteriore.' },
				severity: 'low',
			},
		],
		oversteer: [
			{
				rank: 1,
				action: { en: 'Increase differential accel lock', it: 'Aumenta il bloccaggio del differenziale in tiro' },
				detail: { en: 'Ties the rear wheels together against snap rotation.', it: 'Lega le ruote posteriori contro la rotazione brusca.' },
				severity: 'medium',
				tradeoff: { en: 'Power push and extra tyre wear if overdone.', it: 'Sottosterzo in tiro e usura gomme se esageri.' },
			},
			{
				rank: 2,
				action: { en: 'Soften rear ARB one step', it: 'Ammorbidisci l\u2019ARB posteriore di uno scatto' },
				detail: { en: 'Cures snap caused by excessive rear roll stiffness.', it: 'Cura lo scatto causato da eccessiva rigidezza posteriore.' },
				severity: 'medium',
			},
			{
				rank: 3,
				action: { en: 'Add rear wing / move aero balance rearward', it: 'Aggiungi ala posteriore / sposta il bilancio indietro' },
				detail: { en: 'Plants high-speed exits the diff cannot fix.', it: 'Stabilizza le uscite veloci che il differenziale non pu\u00f2 curare.' },
				severity: 'medium',
				tradeoff: { en: 'Straight-line drag penalty.', it: 'Penalit\u00e0 di resistenza in rettilineo.' },
			},
		],
		transfer: [
			{
				rank: 1,
				action: { en: 'Add rear low-speed compression', it: 'Aggiungi compressione lenta posteriore' },
				detail: { en: 'Controls squat rate so the rear takes a clean set.', it: 'Controlla lo schiacciamento cos\u00ec il retrotreno si appoggia pulito.' },
				severity: 'medium',
			},
			{
				rank: 2,
				action: { en: 'Stiffen rear springs one step', it: 'Indurisci le molle posteriori di uno scatto' },
				detail: { en: 'Supports forward-drive load without topping the travel.', it: 'Sostiene il carico di trazione senza esaurire la corsa.' },
				severity: 'medium',
				tradeoff: { en: 'Less kerb compliance on exit kerbs.', it: 'Meno assorbimento sui cordoli in uscita.' },
			},
			{
				rank: 3,
				action: { en: 'Open the throttle more progressively', it: 'Apri il gas in modo pi\u00f9 progressivo' },
				detail: { en: 'Keeps pitch and steering inputs separated.', it: 'Tiene separati beccheggio e sterzo.' },
				severity: 'low',
			},
		],
		bottoming: [
			{
				rank: 1,
				action: { en: 'Raise rear ride height 3-5 mm', it: 'Alza l\u2019altezza posteriore di 3-5 mm' },
				detail: { en: 'Restores squat travel under full drive load.', it: 'Ripristina la corsa in schiacciamento sotto pieno carico.' },
				severity: 'high',
			},
			{
				rank: 2,
				action: { en: 'Add bump-stop support / packers', it: 'Aggiungi supporto dei tamponi / spessori' },
				detail: { en: 'Creates a controlled rising rate at the end of travel.', it: 'Crea una progressione controllata a fine corsa.' },
				severity: 'medium',
				tradeoff: { en: 'Abrupt feel if engagement is too sudden.', it: 'Sensazione brusca se l\u2019ingaggio \u00e8 troppo improvviso.' },
			},
			{
				rank: 3,
				action: { en: 'Stiffen rear springs one step', it: 'Indurisci le molle posteriori di uno scatto' },
				detail: { en: 'Reduces how deep the car sits into the stops.', it: 'Riduce quanto l\u2019auto affonda sui tamponi.' },
				severity: 'medium',
			},
		],
	},
};

/**
 * @brief Read fixes for a phase/issue pair in rank order.
 * @param phase Corner phase selected in the wizard.
 * @param issue Handling issue selected in the wizard.
 * @return Sorted copy of the matching fixes, empty when unknown.
 */
export const getFixes = (phase: CornerPhase, issue: HandlingIssue): SetupFix[] => {
	const byPhase = SETUP_MATRIX[phase];
	if (!byPhase) {
		return [];
	}
	const fixes = byPhase[issue];
	if (!fixes) {
		return [];
	}
	return [...fixes].sort((a, b) => a.rank - b.rank);
};

/**
 * @brief Pick the copy matching the active language.
 * @param text Localised English/Italian pair.
 * @param lang Active interface language.
 * @return Language-matched string.
 */
export const pickLang = (text: LocalizedText, lang: Lang): string => {
	return lang === 'it' ? text.it : text.en;
};
