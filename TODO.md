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

### v0.6.0 milestone — Canvas interactivity & mobile refinement

Focus on visual responsiveness, touch ergonomics for portrait/landscape screens and rendering polish.

- [ ] OffscreenCanvas migration: move the cached static bitmap in `graph-layers.ts` from a detached canvas element to a pure `OffscreenCanvas` (worker-ready), keeping a single `drawImage` per frame `#graph` `#perf`
- [ ] Sub-pixel alignment on HiDPI: force half-pixel offsets (`Math.floor(v) + 0.5`) on 1px axes and grids in `canvas-setup.ts` to remove blur and uneven stroke widths `#graph` `#hidpi`
- [ ] Magnetic crosshair snapping: auto-snap along the X axis to the nearest gear curve with a contextual readout (rpm, km/h, N) in `graph-tooltip.ts` `#graph` `#ux`
- [ ] Pinch-to-zoom and multi-touch pan: touch gestures (`PointerEvents`) on the canvas to zoom into speed windows and scroll the RPM range, with instant double-tap reset `#graph` `#mobile`
- [ ] Dynamic CSS palette sync: `graph-theme.ts` reads custom properties via `getComputedStyle(document.documentElement)` so theme switches propagate to the canvas instantly with no reload `#theme`
- [ ] Color-coded gear badges in `comp-gear-grid.ts`: visually align the comparison table with the colored dots of the primary grid via `gear-colors.ts` `#ux` `#theme`
- [ ] Compact mobile landscape layout: `@media (max-height: 500px) and (orientation: landscape)` in `shell.css` / `drawer.css` to shrink the drawers and expand the canvas full-viewport for in-cabin use `#mobile` `#ux`
- [ ] Per-gear gradient fill: translucent vertical fill fading to zero toward the X axis in `graph-curves.ts` to highlight the useful power band and the rpm drop `#graph` `#ux`
- [ ] Keyboard-accessible tooltip: arrow-key navigation along the active curve, a focusable readout and an `aria-live` region so the graph is usable without a pointer `#a11y` `#graph`
- [ ] Zoom/pan window in the share URL: encode the visible speed window (`z_` keys) next to the existing compact token so a zoomed view can be shared and restored `#share` `#graph`
- [ ] Axis auto-fit: recompute `maxGraphSpeed` from the tallest gear's redline speed plus a configurable margin instead of relying on the manual value alone `#graph` `#ux`
- [ ] First-paint theme flash guard: apply the stored theme and language before first paint to remove the flash of the default theme on cold start `#theme` `#perf`
- [ ] Reduced-motion graph mode: gate any animated crosshair, marker or curve transition behind `prefers-reduced-motion` `#a11y` `#graph`
- [ ] Export footer option: optional legend/metadata strip (units, preset name, date) burned into the PNG/SVG export in `graph-export.ts` `#export` `#graph`

---

### v0.7.0 milestone — Vehicle dynamics & tractive force engine

Focus on tire physics evolution, wheel tractive-force curves and the dynamic vertical-load model.

- [ ] Dynamic tire radius from vertical load: combine static deflection and aerodynamic vertical load (downforce from `aero-math.ts`) with the existing centrifugal growth (`tireGrowthFactorAtSpeed`) in `tire-math.ts` `#physics` `#tires`
- [ ] Switchable tractive force graph view: commutable wheel-force mode ($F_x$ in N vs km/h) with per-gear curves and the total resistance parabola overlaid ($F_{\text{drag}} + F_{rr}$) for a visual Vmax `#graph` `#physics`
- [ ] Ghost-curve delta annotations: draw numeric rpm and speed delta callouts at the up-shift points while the COMP comparison curve is active `#graph` `#comparison`
- [ ] Calculated gear-drop recovery time: estimate in milliseconds the time needed to return to peak torque rpm after each upshift from the computed equivalent inertia `#physics` `#simulation`
- [ ] Dyno pre-filter Savitzky-Golay / median: add a spike and roller-noise filter before Akima interpolation in `dyno-csv.ts` `#engine` `#data`
- [ ] Dynamic offline asset eviction in `sw.js`: age-based expiration policy and automatic cleanup of cached car catalogs in the stale-while-revalidate cache `#pwa` `#offline`
- [ ] Live load transfer inside the accel solver: feed the instantaneous acceleration back into `maxDriveForceAtSpeed` (currently called with `accelMps2 = 0`) so grip and wheelspin respond to the real transfer `#physics` `#simulation`
- [ ] Rev-limiter and fuel-cut model: bounce/hard-cut behavior at the limiter plus per-gear shift time (synchro vs dog box) instead of one global value `#physics` `#simulation`
- [ ] Braking model with wheel lock and ABS: deceleration profile from mu, load transfer and optional ABS cycling, with a 100-0 km/h stopping-distance KPI `#physics` `#dynamics`
- [ ] Downshift and rev-match simulation: engine-braking deceleration and the rev-match blip so the solver can model a full lap-style sequence `#physics` `#simulation`
- [ ] Dense drivetrain efficiency map: replace the constant `eta` with a lookup verified against torque/load rather than the single layout default `#physics` `#powertrain`
- [ ] Traction margin readout: per-gear excess of wheel force over grip ($F_x - F_{\text{limit}}$) as a table column and optional graph overlay `#physics` `#ux`

---

### v0.8.0 milestone — Telemetry, multi-sim & heuristic solver

Focus on real-world data acquisition, advanced sim-racing compatibility and heuristic gear-ratio sizing.

- [ ] Reverse gear-ratio calculator from telemetry logs: parser for MoTeC, AiM, RaceChrono and OBD2 CSV (`engine_rpm`, `wheel_speed_kmh`) to recover the real ratios and detect clutch/tire slip `#telemetry` `#data`
- [ ] Gearset optimizer / heuristic solver: search engine (brute force over a discrete catalog or simulated annealing) to generate the optimal gear spacing constrained by straight-line Vmax and the maximum allowed drop `#physics` `#heuristic`
- [ ] Target-track gear-ratio presets: profiles for track archetypes (tight hairpins / fast straights) to calibrate 2nd and 3rd gear outside the torque dead spots `#physics` `#heuristic`
- [ ] Multi-sim exporter: extend `drivetrain-export.ts` with BeamNG (`.jbeam`) output and MoTeC / AiM Race Studio tabular CSV formats `#export` `#sim`
- [ ] Differential and aftermarket transmission variants: support the optional `drivetrain_options` key in car JSON with a dedicated selector in the drawer `#presets` `#config`
- [ ] Keep-screen-awake toggle: integrate `@capacitor/keep-awake` / `navigator.wakeLock` configurable from the UI for continuous track-side use on a mount `#android` `#ux`
- [ ] Inverse dyno from an acceleration log: derive the torque curve from a logged v(t) run plus known mass and gearing, then load it as a custom curve `#telemetry` `#engine`
- [ ] Phone-sensor performance timer: use device motion/GPS to measure 0-100 km/h and 1/4 mile and compare against the solver prediction `#telemetry` `#android`
- [ ] Session recorder and export: log runs locally and export them as CSV/JSON for MoTeC / AiM tooling `#telemetry` `#export`
- [ ] GPX track import: read a GPX file to seed the target-track gear presets with real corner and straight lengths `#telemetry` `#heuristic`
- [ ] Spec-sheet quick-add wizard: build a new preset from a few datasheet numbers (power, mass, tire, gears) with range validation `#presets` `#ux`
- [ ] Full-state backup bundle: export/import every persisted value (custom cars, units, theme, language) as a single JSON file `#data` `#pwa`

---

### v0.9.0 milestone — Diagnostic wizard & hardware integration

Focus on expanding setup guidance, smartphone hardware integration and formal data robustness.

- [ ] Interactive tire pyrometer analyzer: input UI for tread temperatures (inner/center/outer on all 4 wheels) with camber, pressure and drift-instability diagnosis `#setup` `#dynamics`
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
