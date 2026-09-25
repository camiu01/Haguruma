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
- [x] JSON car catalog with factory + community presets (`car-catalog.json`)
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
- [x] Extensible differential catalog `config/diff-presets.ts` (open, 1-way, 1.5-way, 2-way, custom, Torsen, spool) #dynamics
- [x] Accel + coast lock percentage inputs for advanced LSD models; share keys `rg_dm`/`rg_dc` #share
- [x] `diff-presets.test.ts` catalog + i18n label coverage #tests

### Powertrain, Chassis & Comparison (this pass)

- [x] Default drivetrain efficiency mapped to layout selection: FWD 0.90 / RWD 0.85 / AWD 0.80 (`config/drivetrain-eff.ts`, fired by the layout selector and preset apply) #powertrain
- [x] Custom CSV import for dyno torque and power curves: `core/math/dyno-csv.ts` parser (header or header-less, `;`/`,`/tab, decimal comma, Nm/kgm, kW/cv/hp), torque-point engine model in `traction-math.ts`, share key `curve`, anchor inputs lock while active, EN/IT status line #engine #data
- [x] Downforce inputs exposed in the running-gear UI: lift coefficient, reference area, front share + live downforce readout at 200 km/h; share keys `rg_lc`/`rg_la`/`rg_ls` (+ `crg_` mirror) #aero #physics
- [x] Secondary comparison running-gear UI: `crg-*` controls (layout, diff + locks, weight, geometry, springs, downforce, lateral G) driving the dashed COMP grip curve; synced on copy-primary, preset load and URL restore #comparison
- [x] Coast-lock fraction used in a coast/engine-braking model: `engineBrakeForceAt`, `maxCoastForceAtSpeed`, `criticalCoastLockupSpeed` + "Coast lock-up" readout in the running-gear card (+ `dynamics-math` tests) #dynamics

## Pending

(none — every tracked task is shipped above)

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
