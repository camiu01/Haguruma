# AGENTS.md — HAGURUMA

## Quick start
```bash
npm install
npm run dev              # vite dev server on :5173
npx tsc --noEmit         # typecheck
npm test                 # vitest run
npm run build            # tsc --noEmit; vite build
npm run preview          # vite preview (static host test)
```

## Architecture
- Single-page Vite + TypeScript app, **zero backend**.
- All state lives in `src/core/state/app-state.ts` (mutable singleton).
- Every refresh goes through `renderAll(refs)` in `src/views/render-all.ts`.
- Entrypoint: `src/main.ts` → `bootstrap()` on `DOMContentLoaded`.

## Directory layout
```
src/
  main.ts                         # bootstrap only
  core/
    models.ts                     # SpeedUnit, TireSpec, GearPreset, AppState, etc.
    math/                         # tire-math, speed-math, aero-math, traction-math, shift-math, accel-math, inertia-math, cruise-math, dynamics-math, dyno-csv (CSV parser + resampling), engine-curve-core (anchor/dyno engine curve), pyrometer-math (3-zone tread analysis)
    setup/                        # setup-matrix.ts (wizard data) + setup-guide-content.ts (handbook copy)
    state/app-state.ts            # defaultState + singleton
    state/engine-curve.ts         # active engine curve (anchors vs sanitized dyno points)
    units/unit-utils.ts           # getSpeedStep(), getUnitLabel(), getPowerUnitLabel(), formatPower(), getMaxRpm()
    i18n/                         # dictionary.en.ts + dictionary.it.ts + language.ts (applyI18n)
    share/share-utils.ts          # URL hash encode/decode (verbose keys, compact `c` token, curve, rg_/crg_ running gear)
    share/running-gear-share.ts   # rg_/crg_ encode/decode block + numeric param helper
    share/share-compact.ts        # Packed Base64URL full-state codec (v1) + legacy primary token, no dependencies
    share/qr-svg.ts               # Dependency-free QR encoder rendering an SVG for the share modal
  config/
    presets.ts                    # preset maps built from the catalog loader
    car-catalog.ts                # CarCatalogEntry model + import.meta.glob loader + validateCatalogEntry() contract
    cars/                         # one <id>.json per vehicle, drop-in to add (optional finalDrives[] must contain stock fd)
    diff-presets.ts               # Extensible LSD catalog (open, 1/1.5/2-way, custom, Torsen, spool, OS Giken, Cusco, KAAZ, Wavetrac, Quaife)
    drivetrain-eff.ts             # Default drivetrain efficiency lookup by FWD/RWD/AWD layout
    tire-compounds.ts             # Treadwear catalog (Eco 400TW → Slick) with grip gain per compound
    gear-colors.ts                # 8-color palette
    graph-constants.ts            # GRAPH_PADDING, GRAPH_STYLE_*, GRAPH_LIMITS
  services/
    dom/element-refs.ts           # Typed DOM handles (ElementRefs)
    dom/focus-trap.ts             # Tab trap helper for drawer and modal overlays
    graph/                        # svg-frame (geometry + projection), svg-defs, svg-axes, svg-curves, svg-shift-drops, svg-limits, svg-power, svg-nodes (prim model + mount), graph-scene (state → scene, composeNodes draw order), graph-renderer (renderGraph, bindGraphInteractions, toggleGraphExpand), graph-crosshair + crosshair-tooltip (snapping HUD + free tooltip), graph-theme, graph-export (PNG/SVG), drivetrain-export (sim INI/JSON/JBeam/CSV)
    events/                       # One binder per control group
  components/
    gear-list.ts                  # Editable gear rows + add/remove (ratio, overall, RPM drop)
    gear-table.ts                 # Primary breakdown table renderer
    gear-status.ts                # Pure WALL / OVERDRIVE / REDLINE classifiers (no DOM)
    kpi-strip.ts                  # 8-cell KPI strip + accel memo (renderKpis)
    setup-controls.ts             # Touch-first tire pills, FD/rev steppers, aero readout (prefix-parameterized A/B)
    header-bar.ts                 # Top bar chip + active-car label sync
    pyrometer-tool.ts             # 3-zone pyrometer calculator card
    compare-table.ts              # Secondary comparison rows + tire-delta caption + shift-delta panel
    running-gear-block.ts         # Shared primary/secondary running-gear builder, binder and sync (prefix-parameterized)
    preset-search.ts              # Searchable preset combobox (grouped dropdown)
    custom-car.ts                 # Save/load/export/import custom presets
    setup-guide.ts                # Setup shell injection + card assembly
    cruise-card.ts                # Tools card: cruise accordion + render only
    tire-size-tool.ts             # Tools card: stock vs plus-size comparator (own accordion + verdict pill)
    running-gear-readouts.ts      # Downforce + coast lock-up/downforce readouts
    card/                         # base Card + one file per specialized card + index.ts barrel
  views/render-all.ts             # renderGraph + renderTable + KPI/readout syncs
  styles/
    main.css                      # Hub only: @imports below, no rules
    tokens.css                    # Theme variables (dark/oled/light)
    base.css                      # Base elements, safe-area, scrollbars, small viewports
    drawer.css                    # Slide-over drawer + relocated header controls
    components.css                # Cards, accordions, tables, inputs, help-dot
    shell.css                     # Header controls, modal, preset combobox
    overrides.css                 # OLED + light Tailwind overrides
    setup-guide.css               # Wizard badges, feel cues, procedure steps
    telemetry.css                 # v0.6.0 feature: graph pills, HUD, tire pills, steppers, badges
    print.css                     # Print/PDF summary (window.print)
index.html                        # Shell layout; feature shells inject into mount points
capacitor.config.ts               # Native wrapper (webDir dist)
android/                          # Committed Capacitor scaffold (generated outputs ignored)
.github/workflows/build-apk.yml   # Manual + on-release workflow: web build + assembleDebug + versioned APK artifact/attachment
```

## Key conventions (must follow)
- **Tabs** for indentation (never spaces).
- **Single quotes** for strings; semicolons required.
- Every function needs a TSDoc block: `@brief`, `@param`, `@return`.
- Every file starts with `@file` + `@brief`.
- Feature modules must stay **under 400 lines**, functions **under 50 lines**.
- Exempt from the file cap: `index.html` (app shell), `styles/main.css` (import hub),
  and the dictionary system (`src/core/i18n/dictionaries.ts` wires the per-language
  `dictionary.en.ts` / `dictionary.it.ts` files and owns the `DictKey` union).
  New static markup belongs in component-owned `inject*Shell()` builders, not in `index.html`.
- Avoid nested conditionals deeper than 3 levels.
- One component per file in `components/card/` (base `Card`, specialized cards, `index.ts` barrel). Cards receive data via props/options, render with `textContent` only, and cause no side effects.
- Phone content order is controlled by responsive `order-*` utilities (graph + table first below `xl`); desktop order stays untouched.
- All comments, docs, and commit messages in **English**.
- Commits follow **Conventional Commits** (`feat:`, `fix:`, etc.).
- Do **not** add AI-slop comments like `// increment counter` above `i++`.

## Theme system
- `src/core/theme/theme.ts` — three themes: `'dark' | 'oled' | 'light'`.
- Toggle cycles dark → oled → light. Persisted in localStorage.
- CSS uses `[data-theme='dark']`, `[data-theme='oled']`, `[data-theme='light']` selectors.
- **Every Tailwind text/background/border class needs a light-mode override** in `overrides.css` (e.g. `[data-theme='light'] .text-gray-300 { color: #334155 !important; }`).
- New feature CSS goes in its own `styles/<feature>.css` module (theme tokens only) and is wired via `@import` in `main.css`, keeping hub order: tokens, base, drawer, components, shell, overrides, feature.
- Same for OLED: `bg-gauge/80`, `bg-gauge/50` need explicit OLED overrides.
- `document.documentElement.classList.toggle('dark', currentTheme !== 'light')` controls Tailwind dark mode.
- Graph has separate palettes per theme in `graph-theme.ts`.

## Graph render order (must maintain in renderGraph)
The plot is a declarative SVG rebuild: every render clears `#graph-svg` and remounts the primitives composed by `graph-scene.ts: composeNodes` (no bitmap cache, no HiDPI work). The viewBox is pinned to the measured host in CSS pixels (`graph-renderer.ts`), so text keeps its real size on every viewport; `svg-frame.ts: buildPlotFrame` scales the insets with the host width.
Draw order:
1. `<defs>` (`svg-defs.ts`: aero/wheelspin hatch, power gradient, plot clipPath)
2. Background, grid (+ fine 10-unit texture), speed/RPM ticks, redline band, comparison redline (`svg-axes.ts`)
3. Primary gear rays with aero-wall fade split, gear tags, reverse ray (`svg-curves.ts`)
4. Shift-drop connectors, markers and labels (`svg-shift-drops.ts`, layer-gated)
5. Aero-wall shading, line and callout (`svg-limits.ts`, drawn only when the wall is inside the plot)
6. Power envelope + right-hand power axis (`svg-power.ts`, layer-gated)
7. Comparison rays and comparison aero wall (`svg-curves.ts`, `svg-limits.ts`)
8. Grip limit curves + launch wheelspin bands (`svg-limits.ts`, layer-gated)
9. Axis titles (`svg-axes.ts`), then the crosshair group (`graph-crosshair.ts`)
Layer switches live in `state.graphLayers` (`core/models.ts`). The four `[data-graph-layer]` toolbar pills are bound in `graph-renderer.ts: bindGraphInteractions` (click → flip → `renderGraph`); the drawer's fine-grid and snap-HUD checkboxes are owned by `drawer-display-events.ts` and repaint through the full render. Exports (`graph-export.ts`) clone the live SVG and pin the live viewBox.

## Important DOM patterns
- `data-i18n` for text content → `applyI18n()` sets `el.textContent = t(key)`.
- `data-i18n-tip` for tooltip attributes → sets `title`, `data-tip`, `aria-label`.
- `data-i18n-ph` for placeholder attributes.
- All English copy lives in `dictionary.en.ts`, all Italian copy in `dictionary.it.ts` (compile-time parity). Data modules hold `DictKey` references and resolve via `t(key, lang)` — never inline user-facing strings.
- All static elements are resolved in `element-refs.ts` via `document.getElementById()`.
- Feature shells are injected by `inject*Shell(mount)` builders called in `bootstrap()` **before** `getElementRefs()`, so ids, `[data-accordion]` sections and `[data-i18n]` nodes exist for refs, accordion binding and `applyI18n()`.
- Accordions are never height-capped: `.section-content.open` is `max-height: none` and `services/dom/accordion-height.ts` mirrors `scrollHeight` into an inline value so the transition still animates. Heights self-heal via a document mutation observer, a resize observer on each open section's children and a `<details>` toggle hook; `renderAll()` also re-measures as its last step.
- **Do not put help-dot spans inside `data-i18n` elements** — `textContent` replacement strips children. Wrap the span in a separate parent.

## Custom car system
- Saved in localStorage key `haguruma-custom-presets` as a `{ schemaVersion, presets }` envelope (`CUSTOM_STORE_VERSION`, migrated by `migrateCustomStore()`).
- Preset dropdown prefix: `custom:` (constant `CUSTOM_PREFIX`).
- `custom-car.ts`: `readCustomForm()` validates 13 fields, returns `{name, preset}`.
- `applyPreset()` already handles `peakTorqueRpm`, `peakTorqueNm`, `peakPowerRpm` from `GearPreset`.
- Export downloads a `.json` file with the full `GearPreset`; Import reads a file, validates, and saves.

## Testing
- `vitest` framework, tests in `tests/` mirroring `src/`.
- Run single file: `npx vitest run tests/tire-math.test.ts`.
- Always run `npx tsc --noEmit` + `npm test` before committing.
- Coverage for the chassis/aero pass: `tests/dynamics-math.test.ts` (load transfer, friction circle, dyno taper, coast lock, compound gain), `tests/drivetrain-eff.test.ts`, `tests/dyno-csv.test.ts`, `tests/setup-matrix.test.ts`, `tests/brake-math.test.ts`, `tests/recovery-math.test.ts`, `tests/tire-compounds.test.ts`.
- Coverage for the physics/share/sim passes: `tests/engine-curve-akima.test.ts`, `tests/graph-svg.test.ts` (frame math, fade rule, envelope crossing, layer gating), `tests/pyrometer-math.test.ts`, `tests/kpi-strip.test.ts` (WALL/OVERDRIVE/ECO classifiers), `tests/share-compact.test.ts`, `tests/catalog-validation.test.ts`, `tests/drivetrain-export.test.ts`, `tests/presets.test.ts`, `tests/qr-svg.test.ts`, `tests/accel-math.test.ts` (splits + reaction), `tests/accordion-height.test.ts` (no height cap).

## Share/URL
- Full setup encoded in URL hash, restored on page load via `restoreFromUrl()`.
- Primary encoding is the packed Base64URL `c` token (`share-compact.ts` v1: primary, compare, road/engine, both running-gear blocks); verbose keys and legacy hashes still decode, dyno curves always use verbose.
- Uses `navigator.clipboard.writeText()` with textarea fallback.
- Running gear keys: geometry + `rg_df` (type) + `rg_db` (accel lock) + `rg_dc` (coast lock) + `rg_dm` (catalog model id). Unknown model ids are ignored (legacy-safe).
- Comparison keys are the `crg_` mirror of `rg_` (same ranges and enums).
- Custom dyno curve encoded as `curve=rpm:torque;rpm:torque;...` (decimal dot, capped at `MAX_CURVE_POINTS = 64`).
- `running-gear-share.ts` owns the `rg_`/`crg_` block, the numeric range table, and a `numParam` helper reused by the other decode groups.

## Differential catalog
- `src/config/diff-presets.ts` — append a row to `DIFF_PRESETS` to add models (id, i18n `labelKey`, physics `type`, `accLock`, `coastLock`).
- UI select values must stay in the catalog; `LSD_MODEL_IDS` gates the accel/coast lock inputs.
- Tests: `tests/diff-presets.test.ts` (order, range, i18n labels).

## Simulation KPIs
- `kpi-strip.ts: renderKpis()` keeps `#kpi-redline`, `#kpi-top-speed`, `#kpi-aero-wall`, `#kpi-grip`, `#kpi-0-100-time`, `#kpi-quarter`, `#kpi-trap`, `#kpi-wheel-power` in sync with state (never rely on static HTML defaults). `renderTable()` calls it internally.
- Accel KPIs memoize on a JSON key of physical inputs (`buildAccelKey`).
- km/h mode swaps the 0-100 cell value to `time0To100S`; mph mode swaps it to `t060mphS` (the dedicated 0-60 cell is gone, so copy and number always describe the same split). The quarter-mile cell keeps `quarterMileS` and swaps its label between `kpi.m400` and `kpi.quarterMile`; trap speed always renders in the active speed unit.

## Setup levels (Easy / Medium / Full)
- `SetupLevel = 'easy' | 'medium' | 'full'` on `AppState.setupLevel` (primary) and `AppState.compLevel` (comparison); persisted in `haguruma-setup-level` / `haguruma-comp-level`.
- `services/events/setup-level-events.ts` owns the gating maps: `SECTION_LEVELS` (per `[data-accordion]`), `ROW_LEVELS` (per element id), plus `COMP_SECTION_LEVELS` / `COMP_ROW_LEVELS`. Rank is `easy < medium < full`.
- Primary level gates **setup inputs only** — graph, tables, cruise and guides stay visible at every level. The comparison follows the primary level and can be lowered independently; its gear rows gate at `full`, engine/aero sections at `medium`.
- A level change must re-run `applySetupLevel()` + `applyCompLevel()` and then `renderAll(refs)`.

## Drawer navigation & Tools column
- Drawer nav scrolls the page to its section and closes: `data-view='primaryCar' | 'secondaryCar' | 'engine' | 'setup' | 'pyrometer' | 'presets'` plus the `#btn-my-cars` modal trigger.
- `mobile-drawer-events.ts` maps each view to a selector (`primaryCar → [data-accordion="primary"]`, `secondaryCar → compare`, `engine → engine`, `setup → #setup-guide-mount`, `tools → #cruise-mount`, `pyrometer → #pyrometer-mount`, `presets → #preset-anchor`); `openAccordionTree()` auto-opens collapsed ancestors. The header `#header-car-trigger` reuses `data-view='presets'`.
- Drawer display switches (`drawer-fine-grid`, `drawer-snap-hud`) toggle `state.graphLayers` and repaint; `drawer-display-events.ts` also owns the drawer export pipeline and footer close. `syncDrawerDisplay()` re-aligns the checkboxes on every render.
- The tools live in the left sidebar (`xl:col-span-4`) as four stacked mount points (`#cruise-mount`, `#tire-size-mount`, `#pyrometer-mount`, `#setup-guide-mount`) after the secondary-compare card; each tool card is self-contained (`inject*Shell()` builds its own `card` chrome and its own accordion header: `cruise`, `tiresize`, pyrometer, handbook/wizard). No tool creates another tool's mount. The right column (`xl:col-span-8`) holds only the graph and the gear-breakdown table.
- Setup controls are built by one prefix-parameterized module: `setup-controls.ts: injectSetupBaseBlock(host, prefix)` + `injectAeroReadout(host, prefix)` render the pills/steppers into `#setup-controls-mount` and `#comp-setup-controls-mount`; `syncSetupControls()` repaints both. Roots carry `data-setup-prefix='primary' | 'compare'` (the compare variant is styled amber in `telemetry.css`).
- Primary setup rows that also exist as static markup stay authoritative: `running-gear-block.ts` marks `tire` and `weight` as `EXTERNAL_SUFFIXES` so the injected grid skips them while binding/sync still resolve those ids.

## Car catalog labels
- `label` follows one convention: `<Model> (<N>-Speed[, <Type>], <FD> FD)` — e.g. `BMW M3 E36 3.2 (5-Speed, 3.15 FD)`. No prose descriptors ("Test", scenario names, bare years).
- FD is formatted to two decimals; gearbox type only when it is not a manual (`7-Speed DCT`, `8-Speed Auto`).

## Engine curve (anchors vs dyno CSV)
- `core/state/engine-curve.ts` returns the active curve: anchors by default, sanitized dyno points once a CSV is imported.
- `core/math/dyno-csv.ts` parses header / header-less torque or power rows. Supports `,`, `;`, `\t` delimiters and decimal commas; converts kgm → Nm and cv / hp → kW. Optional Gaussian pre-filter via `parseDynoCsv(text, { smooth: true })`.
- `core/math/engine-curve-core.ts` is the single source of truth for `engineTorqueAt`, `tractiveForceAt`, `optimalShift*`, and the dyno-tail taper past the last measured RPM. Dyno points interpolate with Akima (exact at nodes, segment-clamped; linear fallback on 2 points).

## Powertrain efficiency
- `config/drivetrain-eff.ts` maps FWD → 0.90, RWD → 0.85, AWD → 0.80. The layout selector and preset apply both write `state.drivetrainEff`.

## Chassis downforce & coast lockup
- `running-gear.readout` shows the live downforce at 200 km/h (`lift × area × ½·ρ·v²`) and the coast lock-up speed in the active gear.
- `core/math/dynamics-math.ts` exposes `engineBrakeForceAt`, `maxCoastForceAtSpeed`, and `criticalCoastLockupSpeed`, all using `differentialCoastBias`.

## v3
- `vite.config.ts` uses `base: './'` for GitHub Pages deployment.
- `tsconfig.json`: strict mode, `noEmit`, `moduleResolution: bundler`.
- Tailwind loaded via CDN (`cdn.tailwindcss.com`) with custom colors in `index.html`.