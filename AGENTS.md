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
    math/                         # tire-math, speed-math, aero-math, traction-math, shift-math, accel-math, inertia-math, cruise-math, dynamics-math, dyno-csv (CSV parser + resampling), engine-curve-core (anchor/dyno engine curve)
    setup/                        # setup-matrix.ts (wizard data) + setup-guide-content.ts (handbook copy)
    state/app-state.ts            # defaultState + singleton
    state/engine-curve.ts         # active engine curve (anchors vs sanitized dyno points)
    units/unit-utils.ts           # getSpeedStep(), getUnitLabel(), getPowerUnitLabel(), formatPower(), getMaxRpm()
    i18n/                         # dictionary.en.ts + dictionary.it.ts + language.ts (applyI18n)
    share/share-utils.ts          # URL hash encode/decode (incl. rg_, crg_, curve, rg_dm / rg_dc diff keys)
    share/running-gear-share.ts   # rg_/crg_ encode/decode block + numeric param helper
  config/
    presets.ts                    # preset maps built from the catalog loader
    car-catalog.ts                # CarCatalogEntry model + import.meta.glob loader
    cars/                         # one <id>.json per vehicle, drop-in to add
    diff-presets.ts               # Extensible LSD catalog (open, 1/1.5/2-way, custom, Torsen, spool)
    drivetrain-eff.ts             # Default drivetrain efficiency lookup by FWD/RWD/AWD layout
    gear-colors.ts                # 8-color palette
    graph-constants.ts            # GRAPH_PADDING, GRAPH_STYLE_*, GRAPH_LIMITS
  services/
    dom/element-refs.ts           # Typed DOM handles (ElementRefs)
    graph/                        # canvas-setup, graph-axes, graph-curves, graph-shift-drops, graph-renderer, graph-tooltip, graph-theme, graph-export
    events/                       # One binder per control group
  components/
    gear-list.ts                  # Editable gear rows + add/remove
    gear-table.ts                 # Primary breakdown table + KPI strip + accel memo
    compare-table.ts              # Secondary comparison rows + tire-delta caption
    custom-car.ts                 # Save/load/export/import custom presets
    setup-guide.ts                # Setup shell injection + card assembly
    cruise-card.ts                # Highway cruising shell + render
    running-gear-readouts.ts      # Downforce + coast lock-up/downforce readouts
    card/                         # base Card + one file per specialized card + index.ts barrel
  views/render-all.ts             # resizeCanvas + drawGraph + renderTable + renderCruise
  styles/
    main.css                      # Hub only: @imports below, no rules
    tokens.css                    # Theme variables (dark/oled/light)
    base.css                      # Base elements, safe-area, scrollbars, small viewports
    drawer.css                    # Slide-over drawer + relocated header controls
    components.css                # Cards, accordions, tables, inputs, help-dot
    shell.css                     # Header controls, modal, preset combobox
    overrides.css                 # OLED + light Tailwind overrides
    setup-guide.css               # Wizard badges, feel cues, procedure steps
    print.css                     # Print/PDF summary (window.print)
index.html                        # Shell layout; feature shells inject into mount points
capacitor.config.ts               # Native wrapper (webDir dist)
android/                          # Committed Capacitor scaffold (generated outputs ignored)
.github/workflows/build-apk.yml   # Manual workflow: web build + assembleDebug + APK artifact
```

## Key conventions (must follow)
- **Tabs** for indentation (never spaces).
- **Single quotes** for strings; semicolons required.
- Every function needs a TSDoc block: `@brief`, `@param`, `@return`.
- Every file starts with `@file` + `@brief`.
- Feature modules must stay **under 400 lines**, functions **under 50 lines**.
- Exempt from the file cap: `index.html` (app shell), `styles/main.css` (import hub),
  and the dictionary system (`src/core/i18n/dictionaries.ts` holds every language in one file).
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

## Graph layer order (must maintain in drawGraph)
1. Background (`graph-axes.ts: drawBackground`)
2. Grid, redline band, labels (`graph-axes.ts: drawGrid, drawRedlineBand, drawLabels`)
3. Primary curves + shift drops + markers (`graph-curves.ts`, `graph-shift-drops.ts`)
4. Comparison curves + shift drops (if enabled, dashed style)
5. Titles + legend (`graph-axes.ts`)

## Important DOM patterns
- `data-i18n` for text content → `applyI18n()` sets `el.textContent = t(key)`.
- `data-i18n-tip` for tooltip attributes → sets `title`, `data-tip`, `aria-label`.
- `data-i18n-ph` for placeholder attributes.
- All English copy lives in `dictionary.en.ts`, all Italian copy in `dictionary.it.ts` (compile-time parity). Data modules hold `DictKey` references and resolve via `t(key, lang)` — never inline user-facing strings.
- All static elements are resolved in `element-refs.ts` via `document.getElementById()`.
- Feature shells are injected by `inject*Shell(mount)` builders called in `bootstrap()` **before** `getElementRefs()`, so ids, `[data-accordion]` sections and `[data-i18n]` nodes exist for refs, accordion binding and `applyI18n()`.
- **Do not put help-dot spans inside `data-i18n` elements** — `textContent` replacement strips children. Wrap the span in a separate parent.

## Custom car system
- Saved in localStorage key `haguruma-custom-presets`.
- Preset dropdown prefix: `custom:` (constant `CUSTOM_PREFIX`).
- `custom-car.ts`: `readCustomForm()` validates 13 fields, returns `{name, preset}`.
- `applyPreset()` already handles `peakTorqueRpm`, `peakTorqueNm`, `peakPowerRpm` from `GearPreset`.
- Export downloads a `.json` file with the full `GearPreset`; Import reads a file, validates, and saves.

## Testing
- `vitest` framework, tests in `tests/` mirroring `src/`.
- Run single file: `npx vitest run tests/tire-math.test.ts`.
- Always run `npx tsc --noEmit` + `npm test` before committing.
- Coverage for the chassis/aero pass: `tests/dynamics-math.test.ts` (load transfer, friction circle, dyno taper, coast lock), `tests/drivetrain-eff.test.ts`, `tests/dyno-csv.test.ts`, `tests/setup-matrix.test.ts`.

## Share/URL
- Full setup encoded in URL hash, restored on page load via `restoreFromUrl()`.
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
- `renderTable()` → `updateSummaryKpis()` keeps `#kpi-redline`, `#kpi-top-speed`, `#kpi-aero-wall` in sync with state (never rely on static HTML defaults).
- Accel KPIs memoize on a JSON key of physical inputs (`buildAccelKey`).

## Engine curve (anchors vs dyno CSV)
- `core/state/engine-curve.ts` returns the active curve: anchors by default, sanitized dyno points once a CSV is imported.
- `core/math/dyno-csv.ts` parses header / header-less torque or power rows. Supports `,`, `;`, `\t` delimiters and decimal commas; converts kgm → Nm and cv / hp → kW.
- `core/math/engine-curve-core.ts` is the single source of truth for `engineTorqueAt`, `tractiveForceAt`, `optimalShift*`, and the dyno-tail taper past the last measured RPM.

## Powertrain efficiency
- `config/drivetrain-eff.ts` maps FWD → 0.90, RWD → 0.85, AWD → 0.80. The layout selector and preset apply both write `state.drivetrainEff`.

## Chassis downforce & coast lockup
- `running-gear.readout` shows the live downforce at 200 km/h (`lift × area × ½·ρ·v²`) and the coast lock-up speed in the active gear.
- `core/math/dynamics-math.ts` exposes `engineBrakeForceAt`, `maxCoastForceAtSpeed`, and `criticalCoastLockupSpeed`, all using `differentialCoastBias`.

## v3
- `vite.config.ts` uses `base: './'` for GitHub Pages deployment.
- `tsconfig.json`: strict mode, `noEmit`, `moduleResolution: bundler`.
- Tailwind loaded via CDN (`cdn.tailwindcss.com`) with custom colors in `index.html`.