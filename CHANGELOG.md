# Changelog

Completed work, grouped by milestone. Entries record what was implemented and why; they are not release announcements.

Git tags record the released milestones: `v0.2.0`, `v0.3.0`, `v0.4.0`, `v0.5.0`, `v0.5.1`, `v0.6.0`, `v0.7.0-alpha.1`, `v.0.7.0` and `v0.8.0` (plus a `backup/local-0.6-0.9-pass` backup tag). `package.json` currently reports **0.9.0**, while `android/app/build.gradle` still carries `versionName "0.8.0"` with `versionCode 11` — the native version lags the web version. The 0.5.x sections below shipped as `v0.5.0` / `v0.5.1`; the closing "Milestone items and their current state" section records which planned items are in the tree and which are not.

For work that is still open, see [TODO.md](TODO.md). For what each capability does, see [README.md](README.md) and [docs/](docs/README.md).

## 0.5.x development (released as v0.5.0 / v0.5.1)

### Physics polish and chassis convergence (0.5.0 milestone)

Docs consolidation, physics polish, chassis convergence and trackside utilities.

- Renamed `Math.md` to `MATH.md` with `git mv`, preserving history, keeping the 730-line physics reference intact and updating the title self-reference.
- Reference sweep: no remaining `Math.md` or `math reference` pointers in `src/`, `tests/`, `*.md`, `index.html`, `.github/` or `vite.config.ts`.
- Dead-code and build-artifact cleanup: removed a tracked `.probe` leftover; confirmed `dist/` and `node_modules/` are untracked through `.gitignore`; left the `android/` scaffold and `public/` PWA assets untouched.
- Style conformance audit: tabs, single quotes, semicolons, `@file` and `@brief` headers, TSDoc on functions, no `noUnusedLocals` or `noUnusedParameters` findings, no stray `console.log`.
- Version bump 0.4.0 → 0.5.0 in `package.json`, `package-lock.json` and `android/app/build.gradle` (`versionName`, `versionCode` 4 → 5); locked dependency versions pinned with no upgrades.
- Verification: `npx tsc --noEmit` clean and the full Vitest suite passing.
- Brake-bias calculator from deceleration load transfer: ideal front/rear bias percentage at high deceleration from dynamic axle loads and wheelbase, flagging rear-lock trail-braking instability against early front lock.
- Accel run split breakdown: reaction time, 60 ft, 0–60 mph and 0–160 km/h splits plus quarter-mile trap speed on top of the 0–100 and 1/4-mile KPIs.
- Tire-size comparison micro-tool: speedometer error and rolling-circumference delta percentage versus the stock size when plus-sizing.
- Tire compound catalog (`tire-compounds.ts`): treadwear-rated rubber (Eco 400TW, Touring 300TW, Sport 200TW, Semislick 100TW, Slick) scaling road mu through a grip gain, with `rg_tc` / `crg_tc` share keys and both selects.
- QR code sharing modal: dependency-free SVG QR encoding the compressed setup URL for laptop-to-phone transfer without a network.
- Allocation-free canvas loop: audited `drawGraph()` and `renderAll()` for per-frame allocations on pointer events and reused preallocated coordinate buffers.
- Dynamic tire radius from vertical load (`tire-math.ts`): static-deflection squash plus aero downforce folded into the dynamic radius alongside centrifugal growth. See the correction note in [MATH.md](MATH.md) about which radius the traction path actually uses.
- Calculated gear-drop recovery time: milliseconds to climb back to peak-torque RPM after each upshift from the equivalent rotating inertia and residual wheel power.
- Dyno smoothing filter upgrade (`dyno-csv.ts`): configurable Savitzky-Golay or median pre-filter next to the Gaussian option.
- Ghost-curve delta annotations as a DOM panel (`#comp-shift-deltas` from `shift-math.ts` `describeAllShiftDeltas`); the canvas stays curve-only.
- Drivetrain options schema (`car-catalog.ts`, `config/cars/*.json`): optional `drivetrain_options` (alternate final drives, close-ratio gearsets, optional LSDs) selectable from a dropdown without overwriting the base preset.
- Multi-sim and telemetry export expansion (`drivetrain-export.ts`): BeamNG `.jbeam` template plus tabular CSV for MoTeC and AiM Race Studio alongside the Assetto Corsa export.
- Dynamic offline asset eviction (`public/sw.js`): max-age expiry with automatic cleanup of stale JSON files and catalogs in the stale-while-revalidate cache.
- Drivetrain export dropdown: a single format select plus an Export button replacing the five per-format buttons in the graph card.
- Tire-size comparator redesign: diameters, a delta pill with thresholds, a relative-size bar, a speedometer check at 50/100/130 and a gearing shift readout.
- Settings live in the drawer: language, units and power, theme, and share/QR rows in dedicated drawer sections.
- Setup split and rename: the wizard card retitled, and the feel/procedure handbook moved to its own `data-accordion="handbook"` card with a `nav.handbook` entry.
- Comparison preset search: `btnLoadPresetComp` gained the same searchable combobox as the primary selector, in a full-width variant.
- Desktop slide-over drawer: the hamburger is visible on every viewport, and header controls relocate into the drawer on open and restore on close.
- My Cars in the drawer: a `btn-drawer-mycars` entry closes the drawer and forwards to the My Cars modal.
- Topbar cleanup: header controls moved permanently into the drawer garage, settings and share sections.
- Merged setup card: wizard and handbook accordions under one titled card.
- Hidden table scrollbars: `.table-scroll` keeps swipe scrolling with `scrollbar-width: none`.
- Tire-size mount integration: the comparator renders as a plain section inside the vehicle card with no nested card frame.
- Tire comparator moved into the comparison card next to the tire delta, live-synced from primary and secondary state.
- Setup levels Easy / Medium / Full: a level selector gating sections and rows, persisted in `localStorage`.
- Comparison gated to Full, wizard visible from Easy, and emptied cards auto-hidden so no empty frames remain.
- Split levels: the primary level gates setup inputs only while the graph, tables, cruise and guides stay visible; the comparison follows it and can be lowered independently.
- Tools heading above the cruise and tire utilities.
- Secondary mirrors primary levels: comparison gears at Full, comparison engine and aero at Medium.
- Main Setup card collapsible with a single divider; drawer navigation auto-opens collapsed ancestors.
- Fixed gear tables: secondary columns hidden below `md`, no horizontal scroll on phones.
- Clearer names: Main Setup / Base Setup in English, Setup principale / Setup base in Italian.
- Gear ratios gated to Full, tire compound pinned to Easy.
- Car search moved under Main Setup; topbar controls live permanently in the drawer.
- Tire comparator moved into the cruise card as a utilities group.
- Unified running-gear block: primary and secondary setups built, bound and synced from one module (`running-gear-block.ts`), with the static comparison markup removed.
- Drawer navigation reduced to Primary Car, Secondary Car, Tools and Setup.
- Tools card with cruise and tire-size accordions, matching the other cards.
- Tire-size comparator given its own accordion with a header, verdict pill and independent open/close, uncoupled from the cruising check.
- KPI acceleration cells follow the display unit: 0–100 / 0–160 / 0–400 m in km/h mode, 60 ft / 0–60 mph / 1/4 mile in mph mode, with a swapping cell label.
- Catalog labels unified: all preset labels follow `<Model> (<N>-Speed[, <Type>], <FD> FD)`.
- Documentation refresh: README features, physics table, structure tree and preset labels; AGENTS conventions for the shared running-gear block, Tools card, drawer navigation, setup levels and unit-aware KPIs.
- Fixed the clipped Main Setup body on large-font devices: open accordions are unbounded (`max-height: none`) and re-measured through `accordion-height.ts` instead of a fixed cap.
- Accordion height self-heals: a `<details>` toggle hook, a document mutation observer and a resize observer on section children re-measure open sections.
- Patch bump 0.5.0 → 0.5.1 (`package.json`, `package-lock.json`, `build.gradle` `versionName` and `versionCode` 5 → 6) for the accordion clip fixes.

### Interface consistency and graph interaction

- The 13 trackside tool sections rebuilt on the app accordion: `toolSection()` now emits `details.accordion.track-tool` with the shared `section-header`, chevron and card padding, so tools and setup cards read as one component family.
- Fixed the inverted accordion chevron: `details.accordion:not([open])` became `details.accordion[open]`, so an expanded section shows the upward icon in all three accordion families.
- Seven-colour rotation for the tool dots (`TOOL_DOTS` in `tool-form.ts`): neighbouring tools never repeat a colour.
- Graph controls retyped at 12 px semibold with a bordered header row, matching the table card; the global 44 px touch-target and 16 px iOS-zoom guards were left untouched.
- Graph navigation moved inside the canvas as a map-style icon stack (fullscreen, fit, zoom in, zoom out). The four pan buttons and Reset view were removed along with their refs, CSS and i18n strings.
- Drag-to-pan on the canvas: 3 px slop before a press becomes a pan, hash sync deferred to release, click-to-inspect preserved, vertical pan locked in the force view.
- Export chips split into labelled Graph and Drivetrain groups with a divider, and the row wraps instead of overflowing the card on phones.
- Fixed the grip curve and the shift-drop markers drifting while panning and zooming. Two causes: the grip peak was normalized against the visible speed window instead of the whole axis, and both overlays computed their Y from `paddingTop + plotHeight - ratio * plotHeight`, which ignores the window's `minRpm`. They now normalize against `state.maxGraphSpeed` and project through `toY`, so a given force or landing RPM lands on the same screen pixel at any zoom level.
- Fixed the shift-drop marker drawn above the limiter line: `drawSingleDrop` returns early when the upshift does not lose rpm, which only happens with a non-descending gear list.
- Regression tests for both fixes: the coverage now lives in `tests/graph-viewport.test.ts` (window clamping, the grip curve projected against the full RPM axis while zoomed, and shift-drop markers on a windowed frame) and `tests/shift-drops.test.ts` (`isPeakVisible` and `describeShiftDelta`); the earlier `graph-limits` and `canvas-setup` suites were retired when the graph moved to SVG and their assertions folded into those files.
- Docs and screenshots: `docs/user-guide.md` navigation and export paragraphs updated, the `graph.help` string rewritten in all five languages, and a README section with desktop, tools, light-theme and mobile captures.

### Simulation engine

- Time-step numerical solver for 0–100 km/h and the quarter mile (`accel-math.ts`, forward Euler `dt = 0.01` s).
- Rotational inertia equivalent mass per engaged gear (`inertia-math.ts`, optional engine and wheel inertia with a static fallback).
- Shift-time delay parameter with a torque cut during gear changes (`shiftTimeS`).
- Optional `launchRpm` clutch-slip hold so launch torque does not collapse to idle.
- KPI strip: 0–100 and 1/4-mile cells with a memoized solver; grip, redline, top speed and aero wall refreshed every render.

### Utility and presets

- Highway cruising speed RPM and load checker (`cruise-math.ts` and `cruise-card.ts`).
- Six additional factory vehicles: Civic FK8, Golf GTI Mk7, M2 Competition, GR Supra A90, 350Z and Alpine A110.
- Chart export to PNG and SVG (`graph-export.ts`).
- Printable PDF summary through `window.print()` and `styles/print.css`.
- KPI strip live updates: redline, top speed and aero wall no longer stuck on the static HTML defaults.
- Power display unit toggle kW / cv, persisted, converting labels and inputs while the physics stays in kW.

### Presets and differential

- BMW M3 E36 3.2 preset (`e36_m3`) and Volvo 240 Turbo preset (`volvo_240`).
- Extensible differential catalog (`config/diff-presets.ts`): open, 1-way, 1.5-way, 2-way, custom, Torsen, spool, OS Giken, Cusco MZ, KAAZ 2-Way, Wavetrac and Quaife.
- Accel and coast lock percentage inputs for the advanced LSD models, with share keys `rg_dm` and `rg_dc`.
- `diff-presets.test.ts` covering catalog order and i18n labels.

### Powertrain, chassis and comparison

- Default drivetrain efficiency mapped to the layout selection: FWD 0.90 / RWD 0.85 / AWD 0.80 (`config/drivetrain-eff.ts`), fired by the layout selector and by preset apply.
- Custom CSV import for dyno torque and power curves (`core/math/dyno-csv.ts`): header or header-less, `;` / `,` / tab, decimal comma, Nm/kgm, kW/cv/hp; a torque-point engine model in `traction-math.ts`; the `curve` share key; anchor inputs locked while active.
- Downforce inputs exposed in the running-gear UI: lift coefficient, reference area and front share, plus a live downforce readout at 200 km/h and share keys `rg_lc` / `rg_la` / `rg_ls` with the `crg_` mirror.
- Secondary comparison running-gear UI: `crg-*` controls driving the dashed comparison grip curve, synced on copy-primary, preset load and URL restore.
- Coast-lock fraction used in a coast and engine-braking model: `engineBrakeForceAt`, `maxCoastForceAtSpeed` and `criticalCoastLockupSpeed`, with a coast lock-up readout in the running-gear card.

### Previously shipped but untracked

- Custom-car save, load, export and import system (`custom-store.ts`, `localStorage` key `haguruma-custom-presets`, `CUSTOM_PREFIX = 'custom:'`, `readCustomForm()` field validation and the My Cars modal).
- Editable gear list with add/remove rows plus a reverse-gear input (`gear-list.ts`).
- Comparison tire-delta caption in `compare-table.ts`.
- Full 26-vehicle catalog under `src/config/cars/`.
- Language persistence and the DOM i18n system (`language.ts`, `haguruma-lang`, `applyI18n()` for `data-i18n`, `data-i18n-ph` and `data-i18n-tip`).
- Theme toggle cycle dark → oled → light with `localStorage` persistence and the Tailwind `dark` class hook (`theme.ts`).
- Speed and power unit system (km/h and mph through `getSpeedStep()` / `getUnitLabel()`, kW and cv through `formatPower()`, persisted under `haguruma-unit`).
- Share hardening: a `MAX_CURVE_POINTS = 64` cap with sanitize and resample on decode, plus a shared `rg_` / `crg_` numeric range table and a `numParam` helper (`running-gear-share.ts`).
- Active engine curve selector (anchors versus sanitized dyno points) with a dyno-tail taper past the last measured RPM (`engine-curve.ts`, `engine-curve-core.ts`).
- Graph layer order with titles and a legend, a reverse-gear curve, per-theme palettes and the `GRAPH_PADDING` / `GRAPH_STYLE` / `GRAPH_LIMITS` constants.
- Full event-binder split across primary, comparison, comparison running gear, engine, preset, share, theme, language, unit, export, cruise, road load, canvas, viewport, accordion, My Cars modal, PWA and drawer.
- Eight-colour gear palette with wrap-around past eight gears (`gear-colors.ts`).
- Live running-gear readouts module: downforce at 200 km/h and coast lock-up speed (`running-gear-readouts.ts`).
- Deploy and infrastructure: relative Vite base for Pages, strict `tsconfig`, Capacitor `appId`, CI typecheck and tests, CD Pages deploy, and the PWA manifest and icons.
- Extended test coverage across acceleration, inertia, tire, speed, aero, traction, cruise, shift drops, share, units, i18n, custom store, setup matrix, presets, catalog validation, drivetrain export, engine-curve Akima and graph layers.

### UX and accessibility

- Graph tooltip clamped inside the canvas box.
- Real Tab focus trap in the mobile drawer and the My Cars modal (`dom/focus-trap.ts`).
- Accordion headers work with the keyboard (tabindex, `role="button"`, Enter and Space, `aria-expanded`).
- Screen-reader labels on gear-ratio inputs and the preset search combobox.
- `prefers-reduced-motion` gate, visible `:focus-visible` rings, tap-highlight and overscroll guards, and legible placeholders.

### Physics and engine math

- Speed-sensitive rolling resistance: `Crr(v) = Crr0 · (1 + v/160)` in `aero-math.ts`, wired into `roadLoadPowerKw()`, `dragLimitedSpeedKmh()` and the `accel-math.ts` solver.
- Dynamic tire growth: `tireGrowthFactorAtSpeed()` (quadratic, capped at +3% near 250 km/h) plus `dynamicCircumferenceM()`.
- Advanced dyno interpolation: Akima local cubic Hermite in `engine-curve-core.ts`, exact at nodes, segment-clamped, with a linear fallback on two points, covered by `tests/engine-curve-akima.test.ts`.
- Raw dyno smoothing option: the Gaussian `[1,4,6,4,1]/16` pre-filter in `dyno-csv.ts`, opt-in through `parseDynoCsv(text, { smooth })` and an engine-card checkbox.

### Graph engine and visualization

- Dual-layer canvas architecture: the offscreen static bitmap in `graph-layers.ts` keyed on frame, unit, theme and redline, blitted in `drawGraph()` with the dynamic curves, drops and markers on top.
- Wheel force versus road-speed overlay: aero-wall shading past the drag-limited Vmax for both setups, so a limiter-bound top speed reads differently from a friction-bound one.
- Graph fullscreen overlay: an Expand button toggling a fixed overlay card, with `ResizeObserver` repaints and Escape to close.

### Presets, config and data integrity

- Preset validation test (`tests/presets.test.ts`): required fields, strictly decreasing gears, sane ranges, reverse ratio and `runningGear` enums on every preset.
- Strict catalog contract shared by the loader and CI: `validateCatalogEntry()` in `car-catalog.ts`, plus `tests/catalog-validation.test.ts`.
- Multiple final-drive variants: optional `finalDrives` on a preset that must contain the stock `fd`, with FD variant selects under the primary input (`preset-events.ts` `syncFdVariants()`).

### Sharing, storage and PWA

- URL state compression: the full-state packed Base64URL codec in `share-compact.ts` (v1, roughly 170 characters against roughly 700 for the verbose form) with legacy-safe `c` parameter decoding in `share-utils.ts` and a verbose fallback whenever a dyno curve is present.
- Custom-preset storage migration: the `CUSTOM_STORE_VERSION` envelope in `custom-store.ts` with a pure `migrateCustomStore()` accepting v1 and legacy bare maps while rejecting corrupt or future payloads.
- Stale-while-revalidate preset caching in `sw.js` for same-origin GET assets with a capped entry count, while navigations stay network-first.

### Sim and motorsport export

- Sim-racing drivetrain exchange wired to the UI: `buildAssettoCorsaIni()`, `buildDrivetrainJson()` and `parseAssettoCorsaIni()` in `drivetrain-export.ts`, with INI and JSON export in the graph card and INI import inside the My Cars modal, covered by `tests/drivetrain-export.test.ts`.

### Setup troubleshooting matrix and wizard

- `CornerPhase` (`entry` / `mid` / `exit`) and `HandlingIssue` (`understeer` / `oversteer` / `transfer` / `bottoming`) types in `src/core/setup/setup-matrix.ts`.
- All twelve phase × issue combinations covered, each with two to four ranked `SetupFix` entries carrying a rank, a severity, an action and a trade-off.
- Severity tags rendered as badges, with trade-off warnings in a warning style.
- Wizard UI: two selects driving a ranked results list, with the selection held in state and no persistence or logging.
- Wizard wired into the dictionaries and re-rendered on a language switch.
- Wizard exposed in the drawer navigation and the mobile bottom tabs.

### Racecar setup knowledge base and guide view

- A `data-accordion="setup"` guide card with "How to Feel the Car" (entry, mid and exit diagnostic cues) and the systematic setup procedure as eight ordered steps.
- Entry cues covering brake-bias lockup against engine braking and diff coast lock, plus pitch rate against rebound and turn-in crispness.
- Mid cues covering low-speed mechanical balance against the high-speed aero platform.
- Exit cues covering inside wheelspin, power understeer and snap oversteer, plus rear squat and forward traction.
- Procedure order: ride height and rake, pressures and camber, braking and bias, ARB roll balance, springs, dampers, differential, aero trim.
- All guide copy bundled offline as localized pairs, with chrome strings in the dictionaries and styling built on theme tokens.

### Milestone items and their current state

These bullets restate the milestone scope; where the working tree diverges from the original plan, the actual state is noted. `v0.7.0` and `v0.8.0` were tagged; the `v0.9.0` items below are not.

- **0.7.0** — Drivetrain efficiency map. What ships is a **built-in normalized RPM/load loss map** (`EFFICIENCY_MAP` in `src/core/math/drivetrain-map.ts`, bilinear interpolation calibrated to the nominal efficiency, with a layout sensitivity factor), used by the shift and force paths when the Dynamics "Torque/load efficiency map" toggle is on; the toggle travels in the share URL as `d_efficiencyMap`. The strict CSV import for user-measured samples (`src/core/math/efficiency-map.ts`) and the IDW interpolation (`mappedEfficiency` in `powertrain-math.ts`) exist but have **no UI control wired to them**. The map is an engineering assumption, not manufacturer data.
- **0.7.0** — Braking distance and deceleration overlay: responsive 100–0 and 200–0 km/h stopping profiles with speed and deceleration axes, road mu, load transfer, aero drag, an ABS choice and accessible distance and time equivalents.
- **0.7.0** — Accel solver benchmark suite: a Vitest bench over the `accel-math.ts` Euler loop, with `npm run bench` adding an isolated warmed-mean timing assertion.
- **0.9.0** — Setup sensitivity analyzer: the math exists (`src/core/math/setup-sensitivity.ts`, signed ±5 % perturbations of gear ratios, final drive, tire, mass and grip, ranked by largest relative change, covered by `tests/setup-sensitivity.test.ts`), but **no UI panel plots it yet**.
- **0.9.0** — Preset data-quality lint: `src/config/catalog-quality.ts` plausibility rules with raw-file coverage in `tests/catalog-quality.test.ts`, which runs in the CI test job.
- **0.9.0** — Diagnostic matrix completeness test: `tests/setup-matrix.test.ts` asserts every phase × issue combination carries ranked fixes and localized copy.

## Tagged milestones after 0.5.1

Summarised from the tagged commits; the repository keeps no per-release notes for these, so the commit subjects are the record.

- **v0.6.0** (`259035a`, merged via PR #1 `release/0.6.0`) — design system, shared component chrome and power-layer readability; the surrounding window (`3c09089`) is where the graph renderer moved from canvas to SVG.
- **v0.7.0-alpha.1** (`303dcfd`) — vehicle dynamics suite: braking simulation, lap sequence, corner advisor and the mirrored active-differential controls.
- **v0.7.0** (`6877a10`) — release finalisation plus MATH.md GitHub math-rendering fixes.
- **v0.8.0** (`323c2b0`) — telemetry gear check, inverse dyno, gear lab with GPX import, session timer and log, backup/transfer tools; the same window unified the trackside tools with the app chrome (`85e990f`), moved viewport controls into the plot with drag-to-pan (`9825a63`), mounted the tool shells (`b70af6e`) and added this documentation set with README screenshots (`560f024`).

## 0.9.0 (unreleased)

The `v0.9.0` work sits at HEAD (`909e9be`, "restore 0.9.0 setup tools, stabilize the grip layer and move viewport controls into the plot") and is not tagged yet. The milestone bullets under "Milestone items already completed in the working tree" below record the planned scope; the setup tools, grip-layer stabilisation and in-plot viewport controls from the commit are part of it.

## Earlier releases

The repository does not record per-release detail for 0.4.0 and earlier. Use the git history for that period.
