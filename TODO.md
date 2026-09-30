# TODO

Development task management for the Haguruma vehicle dynamics simulator.

## Done

- [x] Setup troubleshooting wizard + handbook view (Entry/Mid/Exit/Pyrometer/Procedure cards)
- [x] Card component system (`components/card/`: base `Card`, one file per card, barrel)
- [x] Per-vehicle catalog (`config/cars/<id>.json` + `import.meta.glob` loader, `CarCatalogEntry`)
- [x] Per-language dictionaries (`dictionary.en.ts` / `dictionary.it.ts`, compile-time parity)
- [x] Capacitor Android scaffold + manual Build APK workflow (debug artifact)

- [x] Mobile hamburger menu + left slide-over drawer (lang/unit/theme/presets)
- [x] Slide-over drawer: focus trap, Escape/backdrop close, scroll lock, focus restore
- [x] Share trigger as icon-only in header on mobile + FAB
- [x] Header compact: brand nowrap, flex-nowrap, pill groups hide on mobile
- [x] 44–48px touch targets, stacked labels, 16px inputs (no iOS zoom)
- [x] HiDPI canvas (`devicePixelRatio` capped at 2)
- [x] `visualViewport` resize debounced + keyboard scroll-into-view
- [x] ResizeObserver canvas auto-redraw
- [x] Touch/pointer tooltip (tap-to-pin, dismiss on outside tap)
- [x] manifest.webmanifest with standalone display, 192/512 maskable icons
- [x] Service worker with offline-first app shell caching
- [x] BeforeInstallPrompt deferred (button removed from UI, SW kept)
- [x] Card system: border 1px, radius 12px, shadow 0 1px 3px, padding 16px
- [x] Light theme: page #F8FAFC, card #FFFFFF, border #E2E8F0, labels #64748B, outputs #0F172A
- [x] OLED theme: pure black backgrounds, brightness-filtered accents
- [x] Inter body + JetBrains Mono tabular-nums for numbers
- [x] Table horizontal scroll with sticky first column (primary + compare)
- [x] Secondary comparison collapsible card with full vehicle physics (mass, Cd, area, power, torque/power anchors)
- [x] Road Load card renamed "Resistenze", grouped under secondary physics
- [x] Gears extracted into own "Rapporti del cambio" card
- [x] Removed sticky from graph card
- [x] Removed Install button from all viewports
- [x] Italian i18n parity (dictionary keys EN=IT)
- [x] Light/OLED overrides for every Tailwind text/bg/border class
- [x] RunningGear chassis model: weight distribution, CoG height, wheelbase, track, road friction, drivetrain layout (FWD/RWD/AWD), differential (open/clutch LSD/Torsen/spool) + bias, spring rates, lateral g
- [x] Running-gear accordion UI with input sync, EN/IT i18n and preset application
- [x] `dynamics-math.ts`: longitudinal/lateral load transfer, per-wheel loads, Kamm friction circle, differential torque bias, downforce, friction-limited drive force, critical wheelspin speed (+ `tests/dynamics-math.test.ts`)
- [x] Grip-limit curve and wheelspin shading overlays on the graph (`graph-limits.ts`)
- [x] Gear table: wheelspin recovery speed column, min wheel-load column, standstill grip KPI
- [x] Optimal shift points via wheel thrust intersection with anti-false-positive scanning
- [x] Traction limit clamp from friction coefficient (Kamm circle + differential bias + wheelspin scan)
- [x] SI refactor: `speed-math` SI core (`speedKmh`/`rpmFromKmh`), mph applied only at display boundary; exact `KW_TO_NM = 30000/π`; linear torque interpolation below peak torque; kinematic landing RPM `n_land = n_shift × i_next / i_curr`
- [x] Drag-limited top-speed bisection robust on steep downhill (negative grade) road loads
- [x] Share URL encodes running gear (`rg_`/`crg_` keys); legacy hashes still decode
- [x] Every preset ships a validated `runningGear`; custom presets migrate to defaults
- [x] Debounced viewport/resize handling via `core/debounce.ts`
- [x] Event binder split: `running-gear-events`, `drawer-utils-events`, `comp-gear-grid`
- [x] Row/table hover uses theme `surface-input` token instead of `gauge`
- [x] Build script fails on type errors (`npx tsc --noEmit && npx vite build`)
- [x] README physics-engine module table (traction/speed/aero/dynamics/shift)
- [x] JSON car catalog with factory + community presets (`src/config/cars/*.json` + `car-catalog.ts` glob loader)
- [x] Searchable preset combobox with grouped dropdown (`preset-search.ts`)

### Simulation Engine

- [x] Time-step numerical solver for 0-100 km/h and quarter mile (`accel-math.ts`, forward Euler dt=0.01s) #physics #simulation
- [x] Rotational inertia equivalent mass per engaged gear (`inertia-math.ts`, optional engine/wheel `I` with static fallback) #physics
- [x] Shift-time delay parameter with torque cut during gear changes (`shiftTimeS`) #physics #simulation
- [x] Optional `launchRpm` clutch-slip hold so launch torque does not collapse to idle #physics
- [x] KPI strip: 0-100 s and 1/4 mile cells with memoized solver; grip/redline/top-speed/aero-wall refreshed every render #ux

### Utility and Presets

- [x] Highway cruising speed RPM and load checker (`cruise-math.ts` + `cruise-card.ts`) #utility
- [x] Expand presets database: +6 factory vehicles (Civic FK8, Golf GTI Mk7, M2 Competition, GR Supra A90, 350Z, Alpine A110) #presets
- [x] Chart export to PNG and SVG (`graph-export.ts`) #export
- [x] Printable PDF summary via `window.print()` + `styles/print.css` #export
- [x] KPI strip live updates: redline, top speed, aero wall no longer stuck on HTML defaults #ux
- [x] Power display unit toggle kW / cv (header + drawer, localStorage, labels + inputs convert; physics stays kW) #units

### Presets & Differential (this pass)

- [x] BMW M3 E36 3.2 preset (`e36_m3`) #presets
- [x] Volvo 240 Turbo preset (`volvo_240`) #presets
- [x] Extensible differential catalog `config/diff-presets.ts` (open, 1-way, 1.5-way, 2-way, custom, Torsen, spool, OS Giken, Cusco MZ, KAAZ 2-Way, Wavetrac, Quaife) #dynamics
- [x] Accel + coast lock percentage inputs for advanced LSD models; share keys `rg_dm`/`rg_dc` #share
- [x] `diff-presets.test.ts` catalog + i18n label coverage #tests

### Powertrain, Chassis & Comparison (this pass)

- [x] Default drivetrain efficiency mapped to layout selection: FWD 0.90 / RWD 0.85 / AWD 0.80 (`config/drivetrain-eff.ts`, fired by the layout selector and preset apply) #powertrain
- [x] Custom CSV import for dyno torque and power curves: `core/math/dyno-csv.ts` parser (header or header-less, `;`/`,`/tab, decimal comma, Nm/kgm, kW/cv/hp), torque-point engine model in `traction-math.ts`, share key `curve`, anchor inputs lock while active, EN/IT status line #engine #data
- [x] Downforce inputs exposed in the running-gear UI: lift coefficient, reference area, front share + live downforce readout at 200 km/h; share keys `rg_lc`/`rg_la`/`rg_ls` (+ `crg_` mirror) #aero #physics
- [x] Secondary comparison running-gear UI: `crg-*` controls (layout, diff + locks, weight, geometry, springs, downforce, lateral G) driving the dashed COMP grip curve; synced on copy-primary, preset load and URL restore #comparison
- [x] Coast-lock fraction used in a coast/engine-braking model: `engineBrakeForceAt`, `maxCoastForceAtSpeed`, `criticalCoastLockupSpeed` + "Coast lock-up" readout in the running-gear card (+ `dynamics-math` tests) #dynamics

### Previously shipped but untracked

- [x] Custom-car save/load/export/import system (`custom-store.ts` localStorage `haguruma-custom-presets`, `CUSTOM_PREFIX='custom:'`, `readCustomForm()` 13-field validation + my-cars modal) #presets #data
- [x] Editable gear list with add/remove rows plus reverse-gear input (`gear-list.ts`) #ux
- [x] Comparison tire-delta caption (`Circ: {mm} ({sign}%)` in `compare-table.ts`) #comparison #ux
- [x] Full 26-preset catalog (AE86, GR86, E46 M3, S2000 AP1, RX-7 FB, 930 Turbo, GT3, TVR Griffith, Sierra Cosworth, Samurai, Viper, Uno Turbo, Miata NA6, R5 GT Turbo, Eclipse 1G, Focus RS, MR2 SW20, Caterham 160 and more) #presets
- [x] Language persistence + DOM i18n system (`language.ts` `haguruma-lang`, `applyI18n()` for `data-i18n/ph/tip`) #i18n
- [x] Theme toggle cycle dark -> oled -> light with localStorage persist + Tailwind `dark` class hook (`theme.ts`) #theme #ux
- [x] Speed/power unit system (kmh/mph `getSpeedStep()`/`getUnitLabel()`, kW/cv `formatPower()`, `haguruma-unit` persist) #units
- [x] Share hardening: `MAX_CURVE_POINTS=64` cap + sanitize/resample on decode, shared `rg_`/`crg_` numeric range table + `numParam` helper (`running-gear-share.ts`) #share
- [x] Active engine curve selector (anchors vs sanitized dyno points) with dyno-tail taper past last measured RPM (`engine-curve.ts`, `engine-curve-core.ts`) #engine #physics
- [x] Graph layer order + titles/legend, reverse-gear curve, per-theme palettes and `GRAPH_PADDING/STYLE/LIMITS` constants (`graph-renderer.ts`, `graph-theme.ts`, `graph-constants.ts`) #ux #theme
- [x] Full event-binder split (primary, comparison, comp-running-gear, engine, preset, share, theme, language, unit, export, cruise, road-load, canvas, viewport, accordion, mycars-modal, pwa, drawer) #ux
- [x] 8-color gear palette with wrap-around past 8 gears (`gear-colors.ts`) #ux #theme
- [x] Live running-gear readouts module (downforce at 200 km/h + coast lock-up speed via `running-gear-readouts.ts`) #dynamics #ux
- [x] Deploy/infra: `vite base './'` for Pages, strict `tsconfig`, Capacitor `appId`, CI typecheck+tests, CD Pages deploy, PWA manifest + icons (`vite.config.ts`, `ci.yml`, `cd.yml`) #infra #pwa
- [x] Extended test coverage (28 files: accel, inertia, tire, speed, aero, traction, cruise, shift-drops, share-utils, share-compact, unit-utils, i18n, custom-store, setup-matrix, presets, catalog-validation, drivetrain-export, engine-curve-akima, graph-layers and more) #tests

## Pending

### v0.5.0 milestone — Physics Polish & Dynamic Chassis Convergence (in development, last release 0.4.0)

Docs consolidation, physics polish, chassis convergence and trackside utilities batch. Version files already carry 0.5.0; tag the release when green.

- [x] Rename `Math.md` -> `MATH.md` via `git mv` (history preserved, 730 physics lines intact, title self-reference updated) #docs
- [x] Reference sweep: no remaining `Math.md` / `math reference` pointers in `src/`, `tests/`, `*.md`, `index.html`, `.github/`, `vite.config.ts` #docs
- [x] Dead-code / build-artifact cleanup: tracked `.probe` leftover removed; `dist/` and `node_modules/` confirmed untracked via `.gitignore`; `android/` scaffold and `public/` PWA assets untouched #hygiene
- [x] Style conformance audit: tabs, single quotes, semicolons, `@file`+`@brief` headers, TSDoc on functions, zero `noUnusedLocals`/`noUnusedParameters` findings, no stray `console.log` #style
- [x] Version bump 0.4.0 -> 0.5.0 in `package.json`, `package-lock.json` and `android/app/build.gradle` (`versionName`, `versionCode` 4 -> 5); locked dep versions pinned, no upgrades #release
- [x] Verification green: `npx tsc --noEmit` clean + full vitest suite passing #tests

- [x] Brake-bias calculator from deceleration load transfer: ideal front/rear bias % at high decel (e.g. 1.2G) from dynamic axle loads and wheelbase; flag rear-lock trail-braking instability vs early front lock (entry understeer) `#physics` `#dynamics`
- [x] Accel run split breakdown: reaction time, 60 ft (0-18 m), 0-60 mph and 0-160 km/h splits plus quarter-mile trap speed on top of the 0-100 / 1/4-mile KPIs `#physics` `#simulation`
- [x] Tire-size comparison micro-tool: speedometer error and rolling-circumference delta % versus the homologated stock size when plus-sizing rims or sidewalls `#tires` `#ux`
- [x] Tire compound catalog (`tire-compounds.ts`): treadwear-rated rubber (Eco 400TW, Touring 300TW, Sport 200TW, Semislick 100TW, Slick) scaling road mu via grip gain; `rg_tc`/`crg_tc` share keys plus primary and COMP selects `#physics` `#tires`
- [x] QR code sharing modal: dependency-free SVG QR encoding the compressed setup URL for instant laptop-to-phone transfer trackside with no network or chat `#share` `#ux`
- [x] Allocation-free canvas loop: audit `drawGraph()` and `renderAll()` for per-frame array/object allocations on pointer events, reuse preallocated coordinate buffers to avoid GC micro-stutter on low-end phones `#graph` `#perf`
- [x] Dynamic tire radius from vertical load (`tire-math.ts`): fold static-deflection squash plus aero downforce (`aero-math.ts`) into the dynamic radius alongside centrifugal growth (`tireGrowthFactorAtSpeed`) `#physics` `#tires`
- [x] Calculated gear-drop recovery time (`accel-math.ts`): estimate in milliseconds the time to climb back to peak-torque rpm after each upshift from the equivalent rotating inertia and residual wheel power `#physics` `#simulation`
- [x] Dyno smoothing filter upgrade (`dyno-csv.ts`): configurable Savitzky-Golay or median pre-filter next to the Gaussian option to reject ignition spikes and roller transients before Akima interpolation `#engine` `#data`
- [x] Ghost-curve delta annotations as a DOM panel (`compare-table.ts` `#comp-shift-deltas` from `shift-math.ts` `describeAllShiftDeltas`), canvas stays curve-only `#graph` `#comparison`
- [x] Drivetrain options schema (`car-catalog.ts`, `config/cars/*.json`): optional `drivetrain_options` key (alternate final drives, close-ratio gearsets, optional LSDs) selectable from a dropdown without overwriting the base preset `#presets` `#config`
- [x] Multi-sim and telemetry export expansion (`drivetrain-export.ts`): BeamNG (`.jbeam`) template plus tabular CSV for MoTeC / AiM Race Studio next to the Assetto Corsa export `#export` `#sim`
- [x] Dynamic offline asset eviction (`public/sw.js`): max-age expiry policy with automatic cleanup of stale JSON files and catalogs in the stale-while-revalidate cache `#pwa` `#offline`
- [x] Drivetrain export dropdown: single `export-format` select + Export button replacing the five INI/JSON/JBeam/MoTeC/AiM buttons in the graph card `#export` `#ux`
- [x] Tire-size comparator redesign: diameters, delta pill with thresholds, relative-size bar, speedo check at 50/100/130 and gearing shift readout `#tires` `#ux`
- [x] Settings live in the drawer: language, units/power, theme and share/QR rows in dedicated drawer sections `#ux` `#mobile`
- [x] Setup split and rename: wizard card retitled Setup/Assetto, feel/procedure handbook moved to a separate `data-accordion="handbook"` card with `nav.handbook` entry `#setup` `#ux`
- [x] Comparison preset search: `btnLoadPresetComp` enhanced with the same searchable combobox as the primary selector (full-width variant) `#ux` `#presets`
- [x] Desktop slide-over drawer: hamburger visible on every viewport, header controls relocate into the drawer on open and restore on close `#ux` `#mobile`
- [x] My Cars in the drawer: `btn-drawer-mycars` entry closes the drawer and forwards to the My Cars modal `#ux` `#mobile`
- [x] Topbar cleanup: header controls (language, units, preset search, theme, share/QR) moved permanently into the drawer Garage/Settings/Share sections `#ux`
- [x] Merged Assetto card: wizard and handbook accordions under one `merged-card` with h2 title, like Vehicle Setup `#setup` `#ux`
- [x] Hidden table scrollbars: `.table-scroll` keeps swipe scrolling with `scrollbar-width: none` `#ux`
- [x] Tire-size mount integration: comparator renders as a plain section inside the vehicle card, no nested card frame `#tires` `#ux`
- [x] Tire comparator moved into the comparison card next to the tire delta, live-synced from primary/secondary state `#tires` `#comparison` `#ux`
- [x] Setup levels Easy/Medium/Full: level selector in the Vehicle Setup header gating sections and rows, persisted in localStorage `#ux`
- [x] Comparison gated to Full, wizard visible from Easy, emptied cards auto-hidden (no empty frames) `#ux`
- [x] Split levels: primary level gates setup inputs only (graph/table/cruise/guides always visible), comparison follows it and can be lowered independently `#ux`
- [x] Tools heading above the cruise and tire utilities `#ux`
- [x] Secondary mirrors primary levels: comp gears Full, comp engine/aero Medium `#ux`
- [x] Main Setup card collapsible with single divider, nav auto-opens collapsed ancestors `#ux`
- [x] Fixed gear tables: secondary columns hidden below md, no horizontal scroll on phones `#ux`
- [x] Clearer names: Main Setup / Base Setup (EN), Setup principale / Setup base (IT) `#ux` `#i18n`
- [x] Gear ratios gated to Full, tire compound pinned to Easy `#ux`
- [x] Car search moved under Main Setup; Topbar controls live permanently in the drawer `#ux`
- [x] Tire comparator moved into the cruise card as a utilities group `#tires` `#ux`
- [x] Unified running-gear block: primary and secondary setups built/bound/synced from one module (`running-gear-block.ts`), static crg markup removed `#comparison` `#ux`
- [x] Drawer nav reduced to Primary Car, Secondary Car, Tools, Setup `#ux`
- [x] Tools card with cruise and tire-size accordions like the other cards `#ux`
- [x] Tire-size comparator gets its own accordion: header, verdict pill and independent open/close, uncoupled from the cruising check `#ux` `#tires`
- [x] KPI acceleration cells follow the display unit: 0-100 / 0-160 / 0-400 m in km/h mode, 60 ft / 0-60 mph / 1/4 mile in mph mode with a swapping cell label `#ux` `#units`
- [x] Catalog labels unified: all 26 preset labels follow `<Model> (<N>-Speed[, <Type>], <FD> FD)` — scenario descriptors and bare years dropped `#presets` `#i18n`
- [x] README refresh: features (setup levels, QR share, sim/telemetry export, brake/recovery math, tire tools), physics table (`tire-math`, `engine-curve-core`), structure tree and preset labels `#docs`
- [x] AGENTS refresh: shared running-gear block, Tools card, drawer nav, setup levels, catalog label convention, unit-aware KPIs `#docs`
- [x] Fix clipped Main Setup body on large-font devices: open accordions are unbounded (`max-height: none`) and re-measured via `accordion-height.ts` sync on render/level/toggle/resize instead of a fixed 1600px cap `#bug` `#ux`
- [x] Accordion height self-heals: `<details>` toggle hook, document mutation observer and resize observer on section children re-measure open sections, so late web-font swaps, reopened details and injected rows never leave the downforce/coast readouts clipped `#bug` `#ux`
- [x] Patch bump 0.5.0 -> 0.5.1 (`package.json`, `package-lock.json`, `build.gradle` `versionName` + `versionCode` 5 -> 6) for the accordion clip fixes `#release`

---

### v0.6.0 milestone — Cinematic workbench redesign (SVG plot)

Focus on the v0.6.0 visual overhaul: SVG cartesian plot, universal drawer, 8-cell KPI strip, pyrometer and touch-first setup controls.

- [x] SVG cartesian plot engine: canvas stack replaced by declarative SVG layers (`svg-frame`, `svg-defs`, `svg-axes`, `svg-curves`, `svg-shift-drops`, `svg-limits`, `svg-power`, `svg-nodes`, `graph-scene.ts`, `graph-crosshair.ts`, `crosshair-tooltip.ts`); host-measured viewBox keeps fonts at CSS-pixel size and the plot undistorted on every viewport `#graph` `#ux`
- [x] Graph layer toggles: four toolbar pills (shift drops, aero wall, grip limit, power curve) bound to `state.graphLayers` with pressed-state sync on every render `#graph` `#ux`
- [x] Magnetic crosshair snapping: pointer/keyboard crosshair snaps to the nearest shift point with gear, landing RPM and drop telemetry in the corner HUD pill plus a free per-gear hover tooltip; drawer fine-grid and snap-HUD switches `#graph` `#ux`
- [x] Aero-wall fade split: gear rays cut solid at the drag-limited wall, dashed (`10 8`, 0.32) past it; wall shading, callout and amber comparison wall `#graph` `#physics`
- [x] Power envelope layer: available-vs-required wheel-power curves with right-hand power axis; the envelope crossing lands on the same wall speed as the aero-wall line `#graph` `#physics`
- [x] Theme palettes follow the SVG engine: per-theme palettes in `graph-theme.ts` repaint instantly on theme change with no reload `#theme`
- [x] 64px fixed header: MENU & NAV trigger, HG badge, solver dot, subtitle, unit/level chip and active-car trigger jumping to the preset anchor `#ux`
- [x] Universal drawer: workspace nav (workbench, A/B comparison, dyno, paddock, presets), unit and language segments, export & data pipeline (PNG/SVG/INI/JSON/JBeam/MoTeC quick actions), display preferences and technical specs, footer close `#ux` `#export`
- [x] 8-cell KPI strip: redline, top speed, aero wall, grip limit, unit-aware 0-100/0-60 cell, quarter-mile + trap speed, wheel power; logic split into `kpi-strip.ts` with pure classifiers in `gear-status.ts` `#ux`
- [x] Touch-first setup controls: tire geometry pills (width/aspect/rim), 44px final-drive and rev-limiter steppers, live circumference/diameter readouts and a 200 km/h aero drag readout `#ux` `#mobile`
- [x] Gear stack readouts: per-row overall ratio and RPM-drop landing next to each editable gear ratio `#ux`
- [x] Breakdown table verdicts: WALL (wall speed shown), OVERDRIVE (struck-through theoretical) and ECO cruising advisories, plus the speed formula and SAE J1263 coastdown footnotes under the table `#ux` `#physics`
- [x] 3-zone pyrometer calculator: inner/middle/outer tread temperatures with camber and hot-pressure advisories (0.05 bar steps, 0.30 bar and 1.0 bar clamps), spread readouts and a cold/optimal/hot working-window verdict `#setup` `#ux`
- [x] v0.6.0 design tokens + `telemetry.css`: surface-recessed, canvas-plot, border-hairline, focus-ring, accent-kinematic/aero/warning/compare and gear-1..8 palette in all three themes; graph pills, tire pills, steppers and status badges `#theme` `#ux`
- [x] Release bump 0.5.1 -> 0.6.0 (`package.json`, `package-lock.json`, `build.gradle` `versionName` + `versionCode` 6 -> 7) `#release`

Deferred (canvas-era sketches now carried on the SVG engine):

- [ ] Pinch-to-zoom and multi-touch pan: touch gestures (`PointerEvents`) on the plot to zoom into speed windows and scroll the RPM range, with instant double-tap reset `#graph` `#mobile`
- [ ] Color-coded gear badges in the comparison table: visually align the comparison rows with the colored dots of the primary gear stack via `gear-colors.ts` `#ux` `#theme`
- [ ] Compact mobile landscape layout: `@media (max-height: 500px) and (orientation: landscape)` in `shell.css` / `drawer.css` to shrink the drawers and expand the plot full-viewport for in-cabin use `#mobile` `#ux`
- [ ] Per-gear gradient fill: translucent vertical fill fading to zero toward the X axis to highlight the useful power band and the rpm drop `#graph` `#ux`
- [ ] Keyboard-accessible tooltip readout: `aria-live` region so the snapping HUD is announced without a pointer `#a11y` `#graph`
- [ ] Zoom/pan window in the share URL: encode the visible speed window (`z_` keys) next to the existing compact token so a zoomed view can be shared and restored `#share` `#graph`
- [ ] Axis auto-fit: recompute `maxGraphSpeed` from the tallest gear's redline speed plus a configurable margin instead of relying on the manual value alone `#graph` `#ux`
- [ ] First-paint theme flash guard: apply the stored theme and language before first paint to remove the flash of the default theme on cold start `#theme` `#perf`
- [ ] Reduced-motion graph mode: gate any animated crosshair, marker or curve transition behind `prefers-reduced-motion` `#a11y` `#graph`
- [ ] Export footer option: optional legend/metadata strip (units, preset name, date) burned into the PNG/SVG export in `graph-export.ts` `#export` `#graph`

---

### v0.6.0 design system, chrome recipe & graph readouts

- [x] New `src/styles/controls.css` owns the type scale (`--fs-micro` → `--fs-body`, `.fs-*` utilities), the field system (`.field-label`, `.field-input` with `--compact` / `--md` / `--tall` / `--upper` / `--center` / `--recessed`, `.field-unit`, `.field-half`) and the button system (`.btn`, `.seg-btn` + `.is-active`, `.text-btn`); `main.css` stays an import hub `#theme` `#ux`
- [x] Segmented buttons flip `.is-active` through `classList.toggle` instead of rebuilding `className` (`language-events.ts`, `unit-events.ts`); language/unit theme overrides for the old button groups dropped `#ux`
- [x] `components/card/accordion-shell.ts` (new) exports `buildToolShell` / `buildAccordionSection` / `buildSectionHeader` / `buildChevron`; `setup-shell-card.ts` and `handbook-shell-card.ts` deleted and cruise, tire-size, pyrometer and paddock tools now delegate to the shared recipe `#ux`
- [x] Role classes replace inline utility clusters: `.section-header`, `.section-head` (`--end`), `.section-dot`, `.section-note`, `.section-title`, tables `.th` / `.th--right` / `.th--lead` and `.td` / `.td--right` / `.td--tight` / `.td--lead`, dropdown `.menu-item`, drawer `.drawer-nav-row` / `.drawer-export-btn`, tools `.tools-stack`, card `.card--stack`; retired `.accordion-header` alias `#ux`
- [x] Paddock guide restructured into two nested sections (setup wizard + manual handbook) built from the same accordion recipe `#ux`
- [x] Typography swap: Inter + JetBrains Mono → **Share Tech / Share Tech Mono** in `index.html`, `tailwind.config.cjs`, `tokens.css` and the SVG plot font constants; static markup moved out of `index.html` into component-owned template modules `#theme`
- [x] Legend sync: `graph-legend.ts` (new) exports `GEAR_GRADIENT`, `legendSwatchColors()`, `layerSwatchColors()` and `syncGraphSwatches()`, called from `renderGraph` so legend swatches and layer pill dots follow the live palette in every theme `#graph` `#ux`
- [x] Snapping extracted to `svg-shift-drops.ts: snapPointFor()` with its own `SNAP_WINDOW`; the free hover tooltip gained the grip verdict row (`tooltip.grip` + per-wheel share + wheelspin flag) `#graph` `#physics`
- [x] QR sharing: `share/qr-svg.ts` reduced from a hand-rolled encoder to a thin `qrcode` wrapper (EC level L, versions 1-10, latin-1 guard, path-based SVG); `qrcode` 1.5.4 + `@types/qrcode` added `#share` `#perf`
- [x] Coverage added: `tests/accordion-chrome.test.ts` (chrome recipe), `tests/graph-legend.test.ts` (legend/pill palette per theme), `tests/crosshair-snap.test.ts` (`snapPointFor` window), `tests/crosshair-tooltip.test.ts` (grip verdict + wheel-power readout) `#tests`
- [x] Docs: README "What's new in 0.6.0" + structure refresh, AGENTS.md chrome/graph/testing sections, MATH.md §23.1 `#docs`

---

### v0.6.0 polish pass — comparison layout parity & power-layer readability

- [x] Secondary running gear back in two columns: `#comp-rg-mount` is `display: contents`, so the injected `.field-half` rows join the primary's `grid-cols-2`; the lateral-G slider returns to its primary slot (`running-gear-block.ts` `LATG_AFTER`, between rear spring and downforce) `#ux` `#graph`
- [x] kW axis visible at last: `buildPowerAxis` moved out of the plot-clipped group into its own unclipped `graph-power-axis` group, because its ticks and labels live in the right inset where the clip cut every one of them away `#graph` `#ux`
- [x] Power axis ceiling sized from the available wheel-power peak (5 % headroom, 25 kW grid) instead of the road-load demand, which was squashing the envelope into the bottom third of the plot; the demand curve may leave the plot through the top, where the clip cuts it `#graph` `#physics`
- [x] Crossing annotation: the drag-limited speed is labelled at the envelope crossing marker, next to the wall it belongs to `#graph`
- [x] Secondary power envelope: the comparison car's available wheel power is drawn dashed on the shared kW scale (`buildComparePowerNodes`, new `compEngineCurve()` anchors), with its own open-circle crossing marker `#graph` `#physics`
- [x] Hover tooltip wheel-power row: one `wheelPowerAtSpeed()` sample shared by the drawn envelope and the tooltip row (`tooltip.power`, `CrosshairPower` context), so readout and curve can never disagree `#graph` `#physics`
- [x] Coverage: `tests/graph-svg.test.ts` (ceiling rule, unclipped axis group, comparison envelope, crossing label) and `tests/crosshair-tooltip.test.ts` (wheel-power readout: budget, cap, standstill, missing curve) `#tests`
- [x] Docs: MATH.md §23.1 (power-envelope geometry) + test-map rows, README feature bullet, AGENTS.md draw order `#docs`

---

### v0.6.1 milestone — Setup consolidation & tools grid (critical refactor)

Removes the duplicated legacy setup fields, mirrors the touch-first controls into the A/B comparison and gives every tool its own card.

- [x] Setup A consolidated: pill/stepper controls replace the text fields instead of stacking above them; legacy tire/FD/redline inputs stay as hidden state carriers for presets, share and refs `#ux` `#mobile`
- [x] Accordion 1 "Setup Base & Drivetrain": tire geometry pills, circumference readout, final-drive and rev-limiter steppers, max-speed field and the nested gear stack with micro ±0.005 steppers `#ux`
- [x] Accordion 2 "Chassis, Aero & Grip": tire compound, 2x2 mass/Cd/area/Crr matrix, axle weight-split bar with live readout, advanced load inputs and the injected 200 km/h aero drag readout `#ux` `#physics`
- [x] Setup B mirror: the comparison card reuses the same builder with `data-setup-prefix='compare'`, amber accents and a mirrored gear stack writing the secondary ratio CSV `#ux`
- [x] Tools grid: cruise check, plus-size tire delta, 3-zone pyrometer and paddock wizard as four self-contained cards in a dedicated section `#ux`
- [x] Breakdown table trimmed to 10 columns (gear, ratio, overall, v-max, next-gear RPM, RPM drop badge, power required, wheel torque, tractive force, shift advisory) plus the overall-ratio header badge `#ux`
- [x] `running-gear-block.ts` marks the tire and weight rows as external so the static accordion inputs own those ids `#ux`

---

### v0.7.0 milestone — Vehicle dynamics & tractive force engine

Focus on tire physics evolution, wheel tractive-force curves and the dynamic vertical-load model.

- [ ] Switchable tractive force graph view: commutable wheel-force mode ($F_x$ in N vs km/h) with per-gear curves and the total resistance parabola overlaid ($F_{\text{drag}} + F_{rr}$) for a visual Vmax `#graph` `#physics`
- [ ] Live load transfer inside the accel solver: feed the instantaneous acceleration back into `maxDriveForceAtSpeed` (currently called with `accelMps2 = 0`) so grip and wheelspin respond to the real transfer `#physics` `#simulation`
- [ ] Rev-limiter and fuel-cut model: bounce/hard-cut behavior at the limiter plus per-gear shift time (synchro vs dog box) instead of one global value `#physics` `#simulation`
- [ ] Braking model with wheel lock and ABS: deceleration profile from mu, load transfer and optional ABS cycling, with a 100-0 km/h stopping-distance KPI `#physics` `#dynamics`
- [ ] Downshift and rev-match simulation: engine-braking deceleration and the rev-match blip so the solver can model a full lap-style sequence `#physics` `#simulation`
- [ ] Dense drivetrain efficiency map: replace the constant `eta` with a lookup verified against torque/load rather than the single layout default `#physics` `#powertrain`
- [ ] Traction margin readout: per-gear excess of wheel force over grip ($F_x - F_{\text{limit}}$) as a table column and optional graph overlay `#physics` `#ux`
- [ ] Braking distance and deceleration overlay: 100-0 and 200-0 km/h stopping curves on the canvas corrected by road mu plus the aero drag contribution `#graph` `#physics`
- [ ] Torque-vectoring and active center differential: variable AWD front/rear bias beyond the fixed split (DCCD/ACD style) with handbrake-disengage behavior on turn-in `#physics` `#dynamics`
- [ ] LSD clutch preload and breakaway torque: static preload parameter (Nm before plate slip) for mechanical clutch LSDs (KAAZ, Cusco, OS Giken) `#physics` `#dynamics`
- [ ] Apex speed to shift advisor: corner radius plus max lateral G give cornering speed and recommend holding the gear vs downshifting to avoid shifts mid-corner `#physics` `#simulation`
- [ ] Accel solver benchmark suite: vitest bench on the `accel-math.ts` Euler loop (dt=0.01s) guarding sub-3ms runs even with 64-point dyno curves `#tests` `#perf`

---

### v0.8.0 milestone — Telemetry, multi-sim & heuristic solver

Focus on real-world data acquisition, advanced sim-racing compatibility and heuristic gear-ratio sizing.

- [ ] Reverse gear-ratio calculator from telemetry logs: parser for MoTeC, AiM, RaceChrono and OBD2 CSV (`engine_rpm`, `wheel_speed_kmh`) to recover the real ratios and detect clutch/tire slip `#telemetry` `#data`
- [ ] Gearset optimizer / heuristic solver: search engine (brute force over a discrete catalog or simulated annealing) to generate the optimal gear spacing constrained by straight-line Vmax and the maximum allowed drop `#physics` `#heuristic`
- [ ] Target-track gear-ratio presets: profiles for track archetypes (tight hairpins / fast straights) to calibrate 2nd and 3rd gear outside the torque dead spots `#physics` `#heuristic`
- [ ] Keep-screen-awake toggle: integrate `@capacitor/keep-awake` / `navigator.wakeLock` configurable from the UI for continuous track-side use on a mount `#android` `#ux`
- [ ] Inverse dyno from an acceleration log: derive the torque curve from a logged v(t) run plus known mass and gearing, then load it as a custom curve `#telemetry` `#engine`
- [ ] Phone-sensor performance timer: use device motion/GPS to measure 0-100 km/h and 1/4 mile and compare against the solver prediction `#telemetry` `#android`
- [ ] Session recorder and export: log runs locally and export them as CSV/JSON for MoTeC / AiM tooling `#telemetry` `#export`
- [ ] GPX track import: read a GPX file to seed the target-track gear presets with real corner and straight lengths `#telemetry` `#heuristic`
- [ ] Spec-sheet quick-add wizard: build a new preset from a few datasheet numbers (power, mass, tire, gears) with range validation `#presets` `#ux`
- [ ] Full-state backup bundle: export/import every persisted value (custom cars, units, theme, language) as a single JSON file `#data` `#pwa`
- [ ] Bulk preset import/export: one-click JSON/ZIP backup and restore of all browser-saved custom cars for device migration (preset-scoped companion to the full-state bundle) `#data` `#pwa`

---

### v0.9.0 milestone — Diagnostic wizard & hardware integration

Focus on expanding setup guidance, smartphone hardware integration and formal data robustness.

- [ ] Interactive tire pyrometer analyzer: input UI for tread temperatures (inner/center/outer on all 4 wheels) with camber, pressure and drift-instability diagnosis (single-tire 3-zone calculator shipped in v0.6.0) `#setup` `#dynamics`
- [ ] Setup conflict detector: detection of contradictory adjustments inside the setup matrix (e.g. stiffer rear ARB combined with softer springs) `#setup` `#dynamics`
- [ ] Android haptic feedback: subtle haptics via `@capacitor/haptics` while scrubbing the shift-rpm cursor and when saving custom vehicles `#android` `#ux`
- [ ] Edge-to-edge layout & safe areas: refine `env(safe-area-inset-*)` in `shell.css` for modern displays with notches and hidden system bars `#android` `#ux`
- [ ] Property-based testing with `fast-check`: automated math tests on `speed-math.ts` and `traction-math.ts` to validate monotonicity and prevent `NaN` or `Infinity` `#tests`
- [ ] Bundle size & visualizer analyzer: add `rollup-plugin-visualizer` to the Vite pipeline to monitor the PWA weight impact `#ci` `#perf`
- [ ] Setup sensitivity analyzer: rank which inputs (gear ratios, FD, tire, mass, grip) move the shift points and top speed the most, shown as a tornado chart `#setup` `#ux`
- [ ] Extra languages with parity gate: add German / Spanish / French dictionaries and extend the EN/IT parity test to every locale `#i18n` `#tests`
- [ ] Preset data-quality lint: report physically implausible catalog values (gear spread, mass, power vs torque anchors) in CI `#presets` `#tests`
- [ ] Diagnostic matrix completeness test: assert every phase x issue combination has ranked fixes with EN/IT copy `#setup` `#tests`

---

### v1.0.0 milestone — Production release & engine stability

Focus on API stability, conformance tests against real datasheets, accessibility and the production release.

- [ ] Ground truth test suite on official datasheets: regression tests with <0.5% tolerance on gears and speeds computed at 1000 rpm / limiter for Miata NA6, S2000 AP1 and E46 M3 against factory data `#tests` `#physics`
- [ ] Share protocol immutability: rigid version prefix in the Base64URL payloads (`share-compact.ts`) and a golden URL test suite to guarantee full backward compatibility `#share` `#tests`
- [ ] Transparent custom-store migration: full rehearsal of the saved `localStorage` settings migration with a locked `1.0.0` schema version against future field changes `#data` `#pwa`
- [ ] WCAG AA accessibility & keyboard navigation audit: verify all sliders, tab order, ARIA roles and color contrast across Light, Dark and OLED themes `#a11y` `#ux`
- [ ] Canvas visual regression test: automatic graphical snapshots in the CI test run to prevent visual drift on axes, fonts and color scales `#tests` `#ci`
- [ ] Release pipeline & signed Android APK: GitHub Actions automation with verified ProGuard/R8 (`proguard-rules.pro`) to produce release-signed APKs downloadable as GitHub assets `#infra` `#android`
- [ ] Engineering documentation & handbook schema: repository page or section formally documenting every physics and kinematic formula used `#docs`
- [ ] Automated changelog and versioning: generate release notes from Conventional Commits and bump the version in `package.json` on release `#infra` `#docs`
- [ ] End-to-end smoke test in CI: run the built app through `vite preview` with a headless browser to catch bootstrap, boot and render regressions `#tests` `#ci`
- [ ] Content Security Policy and privacy statement: strict CSP meta/headers and an explicit no-telemetry, offline-only data statement `#security` `#docs`
- [ ] Release-to-store pipeline: publish the signed APK/AAB to a Play Store internal track alongside the GitHub release asset `#android` `#infra`
- [ ] Accessibility conformance report: publish a short WCAG AA conformance note covering the audited themes and controls `#a11y` `#docs`
- [ ] Cross-version data guarantees: document and test the supported schema range for shared URLs and the custom store across every released major `#data` `#share`


### UX & Accessibility pass

- [x] Graph tooltip clamped inside the canvas box (no more off-screen clipping) #ux
- [x] Real Tab focus trap in the mobile drawer and My Cars modal (`dom/focus-trap.ts`) #a11y #ux
- [x] Accordion headers work with keyboard (tabindex, role=button, Enter/Space, aria-expanded) #a11y
- [x] Screen-reader labels on gear ratio inputs and the preset search combobox #a11y
- [x] `prefers-reduced-motion` gate, visible `:focus-visible` rings, tap-highlight/overscroll guards, legible placeholders #a11y #ux

### Physics & Engine Math (`src/core/math/`)

- [x] Speed-sensitive rolling resistance: `aero-math.ts` `Crr(v) = Crr0 * (1 + v/160)` via `rollingCrrAtSpeed()`/`rollingForceAtSpeed()`, wired into `roadLoadPowerKw()`, `dragLimitedSpeedKmh()` and the `accel-math.ts` solver #physics
- [x] Dynamic tire growth: `tire-math.ts` `tireGrowthFactorAtSpeed()` (quadratic, capped +3% at 250 km/h) + `dynamicCircumferenceM()`; static load squash stays on the rolling factor #physics #tires
- [x] Advanced dyno interpolation: Akima local cubic Hermite in `engine-curve-core.ts` (`torqueAtRpm()` exact at nodes, segment-clamped, linear fallback on 2 points) + `tests/engine-curve-akima.test.ts` #engine #physics
- [x] Raw dyno smoothing option: Gaussian `[1,4,6,4,1]/16` pre-filter `smoothTorquePoints()` in `dyno-csv.ts`, opt-in via `parseDynoCsv(text, { smooth })` + engine-card checkbox (`engine-events.ts`), EN/IT keys #engine #data

### Graph Engine & Visualization (`src/services/graph/`)

- [x] Dual-layer canvas architecture: `graph-layers.ts` offscreen static bitmap (background, grids, redline band, titles) keyed on frame/unit/theme/redline, blitted in `drawGraph()` with dynamic curves/drops/markers on top #ux #perf
- [x] Wheel force vs road-speed overlay: aero-wall shading past the drag-limited Vmax (`shadeAeroWall()` in `graph-axes.ts`, primary + COMP) so limiter-bound vs friction-bound top speed reads visually #ux #physics
- [x] Graph fullscreen overlay: Expand button in the graph header toggles a fixed overlay card (ResizeObserver repaints, Escape closes, EN/IT keys) #ux

### Presets, Config & Data Integrity (`src/config/cars/`)

- [x] Preset validation test (`tests/presets.test.ts`): required fields, strictly decreasing gears (`i1 > i2 > ... > in`), sane ranges, reverse ratio + `runningGear` enums on all 26 presets #presets #tests
- [x] Strict catalog contract shared by loader and CI: `validateCatalogEntry()` in `car-catalog.ts` (required fields, decreasing gears, physical ranges, drivetrain enums) + `tests/catalog-validation.test.ts`; zero-dep instead of a Zod package #presets #tests
- [x] Multiple final-drive variants: optional `finalDrives` on `GearPreset` (must contain stock `fd`), Miata NA6 / AE86 / S2000 option lists, FD variant select under the primary input (`preset-events.ts` `syncFdVariants()`), validator + tests #presets #ux

### Sharing, Storage & PWA (`src/core/share/`, `src/core/state/`, `android/`)

- [x] URL state compression: full-state packed Base64URL codec in `share-compact.ts` (v1: primary, compare, road/engine, both running-gear blocks, ~170 chars vs ~700 verbose) with legacy-safe `c` param decode in `share-utils.ts`, verbose fallback on dyno curves, no new dependencies #share #ux
- [x] Custom-preset storage migration: `CUSTOM_STORE_VERSION` envelope in `custom-store.ts`, pure `migrateCustomStore()` accepting v1 / legacy bare maps and rejecting corrupt or future payloads #data #pwa
- [x] Stale-while-revalidate preset caching: `sw.js` serves same-origin GET assets stale-while-revalidate with a 60-entry cap (navigations stay network-first), cache bumped to `haguruma-v2` #pwa #offline

### Sim & Motorsport Export (`src/services/events/`)

- [x] Sim-racing drivetrain exchange wired to the UI: `drivetrain-export.ts` `buildAssettoCorsaIni()`/`buildDrivetrainJson()`/`parseAssettoCorsaIni()`, INI+JSON export in the graph card plus INI file import inside the My Cars modal (`export-events.ts`), EN/IT keys, `tests/drivetrain-export.test.ts` #export #sim

### Setup Troubleshooting Matrix / Wizard (interactive diagnostic tool)

- [x] Add `CornerPhase` (`entry` | `mid` | `exit`) + `HandlingIssue` (`understeer` | `oversteer` | `transfer` | `bottoming`) types in `src/core/setup/setup-matrix.ts` #setup
- [x] Cover all 12 phase x issue combinations in `SETUP_MATRIX`, each with 2-4 ranked `SetupFix` entries (`rank`, `severity`, action + trade-off) #setup
- [x] Render severity tags (`low` | `medium` | `high`) as badges; trade-off warnings must render in a warning style (e.g. front ARB softening vs high-speed aero demand, rear spring stiffening vs kerb compliance) #setup #ux
- [x] Wizard UI: two `<select>` controls (phase, issue) driving a ranked results list; selection lives in `AppState.setupGuide`, result list re-renders on change with no persistence or logging #setup
- [x] Wire wizard into EN/IT dictionaries (`setup.*` chrome keys) and re-render on language switch via `applyI18n()` + guide renderer #setup #i18n
- [x] Expose wizard in drawer nav (`data-view='setup'`) and mobile bottom tabs so it is reachable on phone viewports #setup #mobile

### Racecar Setup Knowledge Base & Guide View ("Tips & Tricks: Feel the Car & Setup Procedure")

- [x] Add `data-accordion='setup'` guide card: Section A "How to Feel the Car" (Entry / Mid / Exit diagnostic cues), Section B "Systematic Setup Procedure" (8 ordered steps) #setup
- [x] Entry cues: brake-bias lockup (front lock vs rear trail instability) vs engine-braking vs diff coast lock; pitch rate vs low-speed rebound/bump and turn-in crispness #setup #dynamics
- [x] Mid cues: low-speed mechanical balance (roll-stiffness distribution, front/rear ARB, camber thrust, contact patch) vs high-speed aero platform (splitter/wing balance, rake sensitivity) #setup #dynamics
- [x] Exit cues: inside wheelspin (diff accel lock too open) vs power understeer / snap-oversteer (lock too high, excess rear roll stiffness); rear squat, bump-stop engagement, forward traction #setup #dynamics
- [x] Procedure order (one change at a time): 1 ride height & rake, 2 pressures & camber, 3 braking & bias, 4 ARB roll balance, 5 springs, 6 dampers (low/high speed), 7 differential (coast/power), 8 aero trim #setup
- [x] All guide copy bundled offline in `src/core/setup/setup-matrix.ts` + `src/core/setup/setup-guide-content.ts` as `LocalizedText` EN/IT pairs (no external sites, images, or fetch); chrome strings via `dictionaries.ts` #setup #i18n
- [x] Style with theme tokens (`var(--bg-*)`, `var(--text-*)`, neon accents) reusing already-overridden Tailwind classes so dark/oled/light all work without new overrides #setup #theme
