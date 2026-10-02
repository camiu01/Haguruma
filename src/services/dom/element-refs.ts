/**
 * @file element-refs.ts
 * @brief Typed access to all static DOM nodes.
 */
export interface ElementRefs {
	primaryTire: HTMLInputElement;
	primaryFd: HTMLInputElement;
	primaryFdVariant: HTMLSelectElement;
	drivetrainOptVariant: HTMLSelectElement;
	primaryRedline: HTMLInputElement;
	graphMaxSpeed: HTMLInputElement;
	gearsContainer: HTMLElement;
	btnAddGear: HTMLButtonElement;
	unitKmh: HTMLButtonElement;
	unitMph: HTMLButtonElement;
	powerUnitGroup: HTMLElement;
	powerUnitKw: HTMLButtonElement;
	powerUnitCv: HTMLButtonElement;
	btnMenu: HTMLButtonElement;
	mobileDrawer: HTMLElement;
	mobileDrawerBackdrop: HTMLElement;
	mobileDrawerClose: HTMLButtonElement;
	langGroup: HTMLElement;
	unitGroup: HTMLElement;
	langEn: HTMLButtonElement;
	langIt: HTMLButtonElement;
	presetSelector: HTMLSelectElement;
	setupLevel: HTMLSelectElement;
	compLevel: HTMLSelectElement;
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
	btnImportCsv: HTMLButtonElement;
	csvImportInput: HTMLInputElement;
	csvSmoothInput: HTMLInputElement;
	btnClearCsv: HTMLButtonElement;
	csvStatus: HTMLElement;
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
	graphHost: HTMLElement;
	graphView: HTMLSelectElement;
	graphTractionOverlay: HTMLButtonElement;
	graphSvg: SVGSVGElement;
	graphHud: HTMLElement;
	graphTooltip: HTMLElement;
	graphLayerToggles: HTMLElement;
	graphLayerButtons: NodeListOf<HTMLElement>;
	tooltip: HTMLElement;
	breakdownBody: HTMLElement;
	compareBody: HTMLElement;
	compareWrap: HTMLElement;
	btnShare: HTMLButtonElement;
	shareFab: HTMLButtonElement;
	btnQr: HTMLButtonElement;
	qrModal: HTMLElement;
	qrModalBackdrop: HTMLElement;
	qrModalClose: HTMLButtonElement;
	qrImage: HTMLElement;
	shareFeedback: HTMLElement;
	unitLabels: NodeListOf<HTMLElement>;
	powerUnitLabels: NodeListOf<HTMLElement>;
	btnMyCars: HTMLButtonElement;
	myCarsModal: HTMLElement;
	myCarsModalBackdrop: HTMLElement;
	myCarsModalClose: HTMLButtonElement;
	rgLayout: HTMLSelectElement;
	rgDiff: HTMLSelectElement;
	rgTire: HTMLSelectElement;
	rgBias: HTMLInputElement;
	rgCoast: HTMLInputElement;
	rgWeight: HTMLInputElement;
	rgCog: HTMLInputElement;
	rgWheelbase: HTMLInputElement;
	rgTrack: HTMLInputElement;
	rgSpringF: HTMLInputElement;
	rgSpringR: HTMLInputElement;
	rgLift: HTMLInputElement;
	rgLiftArea: HTMLInputElement;
	rgLiftShare: HTMLInputElement;
	rgLatg: HTMLInputElement;
	rgLatgVal: HTMLElement;
	rgAccordion: HTMLElement;
	setupPhase: HTMLSelectElement;
	setupIssue: HTMLSelectElement;
	setupResult: HTMLElement;
	setupFeel: HTMLElement;
	setupProcedure: HTMLElement;
	btnExportPng: HTMLButtonElement;
	btnExpandGraph: HTMLButtonElement;
	btnExportSvg: HTMLButtonElement;
	btnPrint: HTMLButtonElement;
	exportFormat: HTMLSelectElement;
	btnExportGo: HTMLButtonElement;
	btnImportIni: HTMLButtonElement;
	drivetrainImportInput: HTMLInputElement;
	drivetrainStatus: HTMLElement;
	cruiseSpeed: HTMLInputElement;
	cruiseResult: HTMLElement;
}

/** Collection refs are queried separately from the exhaustive static-id map. */
type CollectionKey = 'graphLayerButtons' | 'unitLabels' | 'powerUnitLabels';
type StaticRefs = Omit<ElementRefs, CollectionKey>;

/** Compile-time exhaustive mapping, with one resolver instead of repeated casts. */
const REF_IDS: Record<keyof StaticRefs, string> = {
	graphView: 'graph-view',
	graphTractionOverlay: 'graph-traction-overlay',
	primaryTire: 'primary-tire',
	primaryFd: 'primary-fd',
	primaryFdVariant: 'primary-fd-variant',
	drivetrainOptVariant: 'drivetrain-opt-variant',
	primaryRedline: 'primary-redline',
	graphMaxSpeed: 'graph-max-speed',
	gearsContainer: 'gears-container',
	btnAddGear: 'btn-add-gear',
	unitKmh: 'unit-kmh',
	unitMph: 'unit-mph',
	powerUnitGroup: 'power-unit-group',
	powerUnitKw: 'power-unit-kw',
	powerUnitCv: 'power-unit-cv',
	btnMenu: 'btn-menu',
	mobileDrawer: 'mobile-drawer',
	mobileDrawerBackdrop: 'mobile-drawer-backdrop',
	mobileDrawerClose: 'mobile-drawer-close',
	langGroup: 'lang-group',
	unitGroup: 'unit-group',
	langEn: 'lang-en',
	langIt: 'lang-it',
	presetSelector: 'preset-selector',
	setupLevel: 'setup-level',
	compLevel: 'comp-level',
	primaryCirc: 'primary-circ-display',
	tireDot: 'tire-valid-indicator',
	tireError: 'tire-error',
	comparisonToggle: 'comparison-toggle',
	comparisonFields: 'comparison-fields',
	compTire: 'comp-tire',
	compFd: 'comp-fd',
	compGears: 'comp-gears',
	compRedline: 'comp-redline',
	compMass: 'comp-mass',
	compCd: 'comp-cd',
	compArea: 'comp-area',
	compPower: 'comp-power',
	compTorqueRpm: 'comp-torque-rpm',
	compTorque: 'comp-torque',
	compPowerRpm: 'comp-power-rpm',
	btnCopyPrimary: 'btn-copy-primary',
	btnLoadPresetComp: 'comp-preset-selector',
	compError: 'comp-error',
	compCircInfo: 'comp-circ-info',
	compLegend: 'comp-legend-indicator',
	roadLoadToggle: 'roadload-toggle',
	roadLoadFields: 'roadload-fields',
	massInput: 'roadload-mass',
	cdInput: 'roadload-cd',
	areaInput: 'roadload-area',
	crrInput: 'roadload-crr',
	powerInput: 'roadload-power',
	effInput: 'roadload-eff',
	gradeInput: 'roadload-grade',
	rollFactorInput: 'roadload-rollfactor',
	rotMassInput: 'roadload-rot-mass',
	shiftTimeInput: 'roadload-shift-time',
	torqueRpmInput: 'engine-torque-rpm',
	torqueInput: 'engine-torque',
	powerRpmInput: 'engine-power-rpm',
	powerAtDisplay: 'engine-power-at',
	btnImportCsv: 'btn-import-csv',
	csvImportInput: 'engine-csv-input',
	csvSmoothInput: 'engine-csv-smooth',
	btnClearCsv: 'btn-clear-csv',
	csvStatus: 'engine-csv-status',
	customName: 'custom-name',
	customTire: 'custom-tire',
	customFd: 'custom-fd',
	customRedline: 'custom-redline',
	customGears: 'custom-gears',
	customReverse: 'custom-reverse',
	customMass: 'custom-mass',
	customCd: 'custom-cd',
	customArea: 'custom-area',
	customPower: 'custom-power',
	customTorqueRpm: 'custom-torque-rpm',
	customTorque: 'custom-torque',
	customPowerRpm: 'custom-power-rpm',
	customRotMass: 'custom-rot-mass',
	customShiftTime: 'custom-shift-time',
	btnSaveCustom: 'btn-save-custom',
	btnImportCustom: 'btn-import-custom',
	customImportInput: 'custom-import-input',
	customList: 'custom-list',
	customError: 'custom-error',
	graphHost: 'graph-host',
	graphSvg: 'graph-svg',
	graphHud: 'graph-hud',
	graphTooltip: 'graph-tooltip',
	graphLayerToggles: 'graph-layer-toggles',
	tooltip: 'graph-tooltip',
	breakdownBody: 'gear-breakdown-body',
	compareBody: 'compare-breakdown-body',
	compareWrap: 'compare-table-wrap',
	btnShare: 'btn-share',
	shareFab: 'share-fab',
	btnQr: 'btn-qr',
	qrModal: 'qr-modal',
	qrModalBackdrop: 'qr-modal-backdrop',
	qrModalClose: 'qr-modal-close',
	qrImage: 'qr-image',
	shareFeedback: 'share-feedback',
	btnMyCars: 'btn-my-cars',
	myCarsModal: 'mycars-modal',
	myCarsModalBackdrop: 'mycars-modal-backdrop',
	myCarsModalClose: 'mycars-modal-close',
	rgLayout: 'rg-layout',
	rgDiff: 'rg-diff',
	rgTire: 'rg-tire',
	rgBias: 'rg-bias',
	rgCoast: 'rg-coast',
	rgWeight: 'rg-weight',
	rgCog: 'rg-cog',
	rgWheelbase: 'rg-wheelbase',
	rgTrack: 'rg-track',
	rgSpringF: 'rg-spring-f',
	rgSpringR: 'rg-spring-r',
	rgLift: 'rg-lift',
	rgLiftArea: 'rg-lift-area',
	rgLiftShare: 'rg-lift-share',
	rgLatg: 'rg-latg',
	rgLatgVal: 'rg-latg-val',
	rgAccordion: 'running-gear-accordion',
	setupPhase: 'setup-phase',
	setupIssue: 'setup-issue',
	setupResult: 'setup-result',
	setupFeel: 'setup-feel',
	setupProcedure: 'setup-procedure',
	btnExportPng: 'btn-export-png',
	btnExpandGraph: 'btn-expand-graph',
	btnExportSvg: 'btn-export-svg',
	btnPrint: 'btn-print',
	exportFormat: 'export-format',
	btnExportGo: 'btn-export-go',
	btnImportIni: 'btn-import-ini',
	drivetrainImportInput: 'drivetrain-import-input',
	drivetrainStatus: 'drivetrain-status',
	cruiseSpeed: 'cruise-speed',
	cruiseResult: 'cruise-result',
};

/**
 * @brief Resolve every static id and fail fast on missing shell elements.
 * @return Typed static handles.
 */
const resolveStaticRefs = (): StaticRefs => {
	const refs: Record<string, Element> = {};
	for (const [key, id] of Object.entries(REF_IDS)) {
		const element = document.getElementById(id);
		if (!element) throw new Error(`Missing required element: ${id}`);
		refs[key] = element;
	}
	return refs as unknown as StaticRefs;
};

/**
 * @brief Resolve static and collection handles after every feature shell exists.
 * @return Fully typed element handles.
 */
export const getElementRefs = (): ElementRefs => ({
	...resolveStaticRefs(),
	graphLayerButtons: document.querySelectorAll<HTMLElement>('[data-graph-layer]'),
	unitLabels: document.querySelectorAll<HTMLElement>('.unit-label'),
	powerUnitLabels: document.querySelectorAll<HTMLElement>('.power-unit-label'),
});