/**
 * @file element-refs.ts
 * @brief Typed access to all static DOM nodes.
 */
export interface ElementRefs {
	primaryTire: HTMLInputElement;
	primaryFd: HTMLInputElement;
	primaryRedline: HTMLInputElement;
	graphMaxSpeed: HTMLInputElement;
	gearsContainer: HTMLElement;
	btnAddGear: HTMLButtonElement;
	unitKmh: HTMLButtonElement;
	unitMph: HTMLButtonElement;
	powerUnitGroup: HTMLElement;
	powerUnitKw: HTMLButtonElement;
	powerUnitCv: HTMLButtonElement;
	themeToggle: HTMLButtonElement;
	btnMenu: HTMLButtonElement;
	mobileDrawer: HTMLElement;
	mobileDrawerBackdrop: HTMLElement;
	mobileDrawerClose: HTMLButtonElement;
	drawerLangHost: HTMLElement;
	drawerUnitHost: HTMLElement;
	drawerPresetHost: HTMLElement;
	langGroup: HTMLElement;
	unitGroup: HTMLElement;
	langEn: HTMLButtonElement;
	langIt: HTMLButtonElement;
	presetSelector: HTMLSelectElement;
	primaryCirc: HTMLElement;
	tireDot: HTMLElement;
	tireError: HTMLElement;
	comparisonToggle: HTMLInputElement;
	comparisonFields: HTMLElement;
	compTire: HTMLInputElement;
	compFd: HTMLInputElement;
	compGears: HTMLInputElement;
	compRedline: HTMLInputElement;
	compMass: HTMLInputElement;
	compCd: HTMLInputElement;
	compArea: HTMLInputElement;
	compPower: HTMLInputElement;
	compTorqueRpm: HTMLInputElement;
	compTorque: HTMLInputElement;
	compPowerRpm: HTMLInputElement;
	btnCopyPrimary: HTMLButtonElement;
	btnLoadPresetComp: HTMLSelectElement;
	compError: HTMLElement;
	compCircInfo: HTMLElement;
	compLegend: HTMLElement;
	roadLoadToggle: HTMLInputElement;
	roadLoadFields: HTMLElement;
	massInput: HTMLInputElement;
	cdInput: HTMLInputElement;
	areaInput: HTMLInputElement;
	crrInput: HTMLInputElement;
	powerInput: HTMLInputElement;
	effInput: HTMLInputElement;
	gradeInput: HTMLInputElement;
	rollFactorInput: HTMLInputElement;
	rotMassInput: HTMLInputElement;
	shiftTimeInput: HTMLInputElement;
	torqueRpmInput: HTMLInputElement;
	torqueInput: HTMLInputElement;
	powerRpmInput: HTMLInputElement;
	powerAtDisplay: HTMLInputElement;
	customName: HTMLInputElement;
	customTire: HTMLInputElement;
	customFd: HTMLInputElement;
	customRedline: HTMLInputElement;
	customGears: HTMLInputElement;
	customReverse: HTMLInputElement;
	customMass: HTMLInputElement;
	customCd: HTMLInputElement;
	customArea: HTMLInputElement;
	customPower: HTMLInputElement;
	customTorqueRpm: HTMLInputElement;
	customTorque: HTMLInputElement;
	customPowerRpm: HTMLInputElement;
	customRotMass: HTMLInputElement;
	customShiftTime: HTMLInputElement;
	btnSaveCustom: HTMLButtonElement;
	btnImportCustom: HTMLButtonElement;
	customImportInput: HTMLInputElement;
	customList: HTMLElement;
	customError: HTMLElement;
	canvas: HTMLCanvasElement;
	ctx: CanvasRenderingContext2D;
	tooltip: HTMLElement;
	breakdownBody: HTMLElement;
	compareBody: HTMLElement;
	compareWrap: HTMLElement;
	btnShare: HTMLButtonElement;
	shareFab: HTMLButtonElement;
	shareFeedback: HTMLElement;
	unitLabels: NodeListOf<HTMLElement>;
	powerUnitLabels: NodeListOf<HTMLElement>;
	btnMyCars: HTMLButtonElement;
	myCarsModal: HTMLElement;
	myCarsModalBackdrop: HTMLElement;
	myCarsModalClose: HTMLButtonElement;
	rgLayout: HTMLSelectElement;
	rgDiff: HTMLSelectElement;
	rgBias: HTMLInputElement;
	rgCoast: HTMLInputElement;
	rgWeight: HTMLInputElement;
	rgCog: HTMLInputElement;
	rgWheelbase: HTMLInputElement;
	rgTrack: HTMLInputElement;
	rgSpringF: HTMLInputElement;
	rgSpringR: HTMLInputElement;
	rgLatg: HTMLInputElement;
	rgLatgVal: HTMLElement;
	rgAccordion: HTMLElement;
	setupPhase: HTMLSelectElement;
	setupIssue: HTMLSelectElement;
	setupResult: HTMLElement;
	setupFeel: HTMLElement;
	setupProcedure: HTMLElement;
	btnExportPng: HTMLButtonElement;
	btnExportSvg: HTMLButtonElement;
	btnPrint: HTMLButtonElement;
	cruiseSpeed: HTMLInputElement;
	cruiseResult: HTMLElement;
}

/**
 * Resolve and validate every required element.
 * @brief Fail fast when the HTML shell is out of sync.
 * @param none No parameters.
 * @return Fully typed element handles.
 */
export const getElementRefs = (): ElementRefs => {
	const get = <T extends HTMLElement>(id: string): T => {
		const el = document.getElementById(id);
		if (!el) {
			throw new Error(`Missing required element: ${id}`);
		}
		return el as T;
	};
	const canvas = get<HTMLCanvasElement>('graph-canvas');
	const ctx = canvas.getContext('2d');
	if (!ctx) {
		throw new Error('Canvas 2D context unavailable');
	}
	return {
		primaryTire: get<HTMLInputElement>('primary-tire'),
		primaryFd: get<HTMLInputElement>('primary-fd'),
		primaryRedline: get<HTMLInputElement>('primary-redline'),
		graphMaxSpeed: get<HTMLInputElement>('graph-max-speed'),
		gearsContainer: get<HTMLElement>('gears-container'),
		btnAddGear: get<HTMLButtonElement>('btn-add-gear'),
		unitKmh: get<HTMLButtonElement>('unit-kmh'),
		unitMph: get<HTMLButtonElement>('unit-mph'),
		powerUnitGroup: get<HTMLElement>('power-unit-group'),
		powerUnitKw: get<HTMLButtonElement>('power-unit-kw'),
		powerUnitCv: get<HTMLButtonElement>('power-unit-cv'),
		themeToggle: get<HTMLButtonElement>('theme-toggle'),
		btnMenu: get<HTMLButtonElement>('btn-menu'),
		mobileDrawer: get<HTMLElement>('mobile-drawer'),
		mobileDrawerBackdrop: get<HTMLElement>('mobile-drawer-backdrop'),
		mobileDrawerClose: get<HTMLButtonElement>('mobile-drawer-close'),
		drawerLangHost: get<HTMLElement>('drawer-lang-host'),
		drawerUnitHost: get<HTMLElement>('drawer-unit-host'),
		drawerPresetHost: get<HTMLElement>('drawer-preset-host'),
		langGroup: get<HTMLElement>('lang-group'),
		unitGroup: get<HTMLElement>('unit-group'),
		langEn: get<HTMLButtonElement>('lang-en'),
		langIt: get<HTMLButtonElement>('lang-it'),
		presetSelector: get<HTMLSelectElement>('preset-selector'),
		primaryCirc: get<HTMLElement>('primary-circ-display'),
		tireDot: get<HTMLElement>('tire-valid-indicator'),
		tireError: get<HTMLElement>('tire-error'),
		comparisonToggle: get<HTMLInputElement>('comparison-toggle'),
		comparisonFields: get<HTMLElement>('comparison-fields'),
		compTire: get<HTMLInputElement>('comp-tire'),
		compFd: get<HTMLInputElement>('comp-fd'),
		compGears: get<HTMLInputElement>('comp-gears'),
		compRedline: get<HTMLInputElement>('comp-redline'),
		compMass: get<HTMLInputElement>('comp-mass'),
		compCd: get<HTMLInputElement>('comp-cd'),
		compArea: get<HTMLInputElement>('comp-area'),
		compPower: get<HTMLInputElement>('comp-power'),
		compTorqueRpm: get<HTMLInputElement>('comp-torque-rpm'),
		compTorque: get<HTMLInputElement>('comp-torque'),
		compPowerRpm: get<HTMLInputElement>('comp-power-rpm'),
		btnCopyPrimary: get<HTMLButtonElement>('btn-copy-primary'),
		btnLoadPresetComp: get<HTMLSelectElement>('comp-preset-selector'),
		compError: get<HTMLElement>('comp-error'),
		compCircInfo: get<HTMLElement>('comp-circ-info'),
		compLegend: get<HTMLElement>('comp-legend-indicator'),
		roadLoadToggle: get<HTMLInputElement>('roadload-toggle'),
		roadLoadFields: get<HTMLElement>('roadload-fields'),
		massInput: get<HTMLInputElement>('roadload-mass'),
		cdInput: get<HTMLInputElement>('roadload-cd'),
		areaInput: get<HTMLInputElement>('roadload-area'),
		crrInput: get<HTMLInputElement>('roadload-crr'),
		powerInput: get<HTMLInputElement>('roadload-power'),
		effInput: get<HTMLInputElement>('roadload-eff'),
		gradeInput: get<HTMLInputElement>('roadload-grade'),
		rollFactorInput: get<HTMLInputElement>('roadload-rollfactor'),
		rotMassInput: get<HTMLInputElement>('roadload-rot-mass'),
		shiftTimeInput: get<HTMLInputElement>('roadload-shift-time'),
		torqueRpmInput: get<HTMLInputElement>('engine-torque-rpm'),
		torqueInput: get<HTMLInputElement>('engine-torque'),
		powerRpmInput: get<HTMLInputElement>('engine-power-rpm'),
		powerAtDisplay: get<HTMLInputElement>('engine-power-at'),
		customName: get<HTMLInputElement>('custom-name'),
		customTire: get<HTMLInputElement>('custom-tire'),
		customFd: get<HTMLInputElement>('custom-fd'),
		customRedline: get<HTMLInputElement>('custom-redline'),
		customGears: get<HTMLInputElement>('custom-gears'),
		customReverse: get<HTMLInputElement>('custom-reverse'),
		customMass: get<HTMLInputElement>('custom-mass'),
		customCd: get<HTMLInputElement>('custom-cd'),
		customArea: get<HTMLInputElement>('custom-area'),
		customPower: get<HTMLInputElement>('custom-power'),
		customTorqueRpm: get<HTMLInputElement>('custom-torque-rpm'),
		customTorque: get<HTMLInputElement>('custom-torque'),
		customPowerRpm: get<HTMLInputElement>('custom-power-rpm'),
		customRotMass: get<HTMLInputElement>('custom-rot-mass'),
		customShiftTime: get<HTMLInputElement>('custom-shift-time'),
		btnSaveCustom: get<HTMLButtonElement>('btn-save-custom'),
		btnImportCustom: get<HTMLButtonElement>('btn-import-custom'),
		customImportInput: get<HTMLInputElement>('custom-import-input'),
		customList: get<HTMLElement>('custom-list'),
		customError: get<HTMLElement>('custom-error'),
		canvas,
		ctx,
		tooltip: get<HTMLElement>('canvas-tooltip'),
		breakdownBody: get<HTMLElement>('gear-breakdown-body'),
		compareBody: get<HTMLElement>('compare-breakdown-body'),
		compareWrap: get<HTMLElement>('compare-table-wrap'),
		btnShare: get<HTMLButtonElement>('btn-share'),
		shareFab: get<HTMLButtonElement>('share-fab'),
		shareFeedback: get<HTMLElement>('share-feedback'),
		unitLabels: document.querySelectorAll('.unit-label'),
		powerUnitLabels: document.querySelectorAll('.power-unit-label'),
		btnMyCars: get<HTMLButtonElement>('btn-my-cars'),
		myCarsModal: get<HTMLElement>('mycars-modal'),
		myCarsModalBackdrop: get<HTMLElement>('mycars-modal-backdrop'),
		myCarsModalClose: get<HTMLButtonElement>('mycars-modal-close'),
		rgLayout: get<HTMLSelectElement>('rg-layout'),
		rgDiff: get<HTMLSelectElement>('rg-diff'),
		rgBias: get<HTMLInputElement>('rg-bias'),
		rgCoast: get<HTMLInputElement>('rg-coast'),
		rgWeight: get<HTMLInputElement>('rg-weight'),
		rgCog: get<HTMLInputElement>('rg-cog'),
		rgWheelbase: get<HTMLInputElement>('rg-wheelbase'),
		rgTrack: get<HTMLInputElement>('rg-track'),
		rgSpringF: get<HTMLInputElement>('rg-spring-f'),
		rgSpringR: get<HTMLInputElement>('rg-spring-r'),
		rgLatg: get<HTMLInputElement>('rg-latg'),
		rgLatgVal: get<HTMLElement>('rg-latg-val'),
		rgAccordion: get<HTMLElement>('running-gear-accordion'),
		setupPhase: get<HTMLSelectElement>('setup-phase'),
		setupIssue: get<HTMLSelectElement>('setup-issue'),
		setupResult: get<HTMLElement>('setup-result'),
		setupFeel: get<HTMLElement>('setup-feel'),
		setupProcedure: get<HTMLElement>('setup-procedure'),
		btnExportPng: get<HTMLButtonElement>('btn-export-png'),
		btnExportSvg: get<HTMLButtonElement>('btn-export-svg'),
		btnPrint: get<HTMLButtonElement>('btn-print'),
		cruiseSpeed: get<HTMLInputElement>('cruise-speed'),
		cruiseResult: get<HTMLElement>('cruise-result'),
	};
};
