# AGENTS.md — HAGURUMA

Instructions for agents and contributors working in this repository. The narrative architecture lives in [docs/architecture.md](docs/architecture.md); the physics lives in [MATH.md](MATH.md); the documentation map is in [docs/README.md](docs/README.md).

## Quick start
```bash
npm install
npm run dev              # vite dev server on :5173
npx tsc --noEmit         # typecheck
npm test                 # vitest run
npm run build            # tsc --noEmit; vite build
npm run preview          # vite preview (static host test)
```

## Architecture in one paragraph
Single-page Vite + TypeScript app, **zero backend**. All state lives in `src/core/state/app-state.ts` (mutable singleton). Every refresh goes through `renderAll(refs)` in `src/views/render-all.ts`. Entry point: `src/main.ts` → `bootstrap()` on `DOMContentLoaded`. Physics is pure and isolated in `src/core/math/`; units are converted only at the display boundary. The full directory layout, module responsibilities, data flow and extension guides are in [docs/architecture.md](docs/architecture.md).

## Documentation map
| Document | Owns |
| --- | --- |
| [README.md](README.md) | Feature overview, requirements, commands, entry point |
| [docs/README.md](docs/README.md) | Documentation index and reading paths |
| [docs/user-guide.md](docs/user-guide.md) | Every panel, tool and workflow |
| [MATH.md](MATH.md) | Formulas, constants, assumptions, validation anchors |
| [docs/data-formats.md](docs/data-formats.md) | Import and export formats |
| [docs/presets.md](docs/presets.md) | Vehicle catalog and provenance |
| [docs/architecture.md](docs/architecture.md) | Structure, modules, how to extend |
| [docs/testing.md](docs/testing.md) | Test categories, benchmarks, CI |
| [docs/deployment.md](docs/deployment.md) | Hosting, PWA, offline, Android |
| [docs/troubleshooting.md](docs/troubleshooting.md) | Diagnostics and recovery |
| [CHANGELOG.md](CHANGELOG.md) | Completed work |
| [TODO.md](TODO.md) | Open work |

Keep each topic in its canonical document. Update the owning document rather than restating it elsewhere.

## Key conventions (must follow)
- **Tabs** for indentation (never spaces).
- **Single quotes** for strings; semicolons required.
- Every function needs a TSDoc block: `@brief`, `@param`, `@return`.
- Every file starts with `@file` + `@brief`.
- Feature modules must stay **under 400 lines**, functions **under 50 lines**.
- Exempt from the file cap: `index.html` (app shell), `styles/main.css` (import hub), and the dictionary system (`src/core/i18n/dictionaries.ts` wires the per-language `dictionary.*.ts` files and owns the `DictKey` union).
  New static markup belongs in component-owned `inject*Shell()` builders, not in `index.html`.
- Avoid nested conditionals deeper than 3 levels.
- One component per file in `components/card/` (base `Card`, specialized cards, `index.ts` barrel). Cards receive data via props/options, render with `textContent` only, and cause no side effects.
- Phone content order is controlled by responsive `order-*` utilities (graph + table first below `xl`); desktop order stays untouched.
- All comments, docs, and commit messages in **English**.
- Commits follow **Conventional Commits** (`feat:`, `fix:`, etc.).
- Do **not** add AI-slop comments like `// increment counter` above `i++`.

## Theme system
- `src/core/theme/theme.ts` — three themes: `'dark' | 'oled' | 'light'`.
- The drawer OLED / Dark / Light segment sets the theme directly (`drawer-utils-events.ts`); `nextTheme()` in `theme-events.ts` is retained but not bound to a control. Persisted in localStorage.
- CSS uses `[data-theme='dark']`, `[data-theme='oled']`, `[data-theme='light']` selectors.
- **Every Tailwind text/background/border class needs a light-mode override** in `overrides.css` (e.g. `[data-theme='light'] .text-gray-300 { color: #334155 !important; }`).
- New feature CSS goes in its own `styles/<feature>.css` module (theme tokens only) and is wired via `@import` in `main.css`, keeping hub order: tokens, base, drawer, components, shell, overrides, feature.
- Same for OLED: `bg-gauge/80`, `bg-gauge/50` need explicit OLED overrides.
- `document.documentElement.classList.toggle('dark', currentTheme !== 'light')` controls Tailwind dark mode.
- Graph has separate palettes per theme in `graph-theme.ts`.

## Graph layer order (must maintain in drawGraph)
Static layer, cached in `graph-layers.ts` (repaint only when frame/unit/theme/redline change):
1. Background (`graph-axes.ts: drawBackground`)
2. Grid, redline band, labels, titles (`graph-axes.ts: drawSpeedGrid, drawRpmGrid, drawRedlineBand, drawAxisTitles`)
Dynamic layer, redrawn every render on top of the blitted bitmap:
3. Primary curves + shift drops + markers (`graph-curves.ts`, `graph-shift-drops.ts`)
4. Aero-wall shading + limits (`shadeAeroWall`, `drawAeroLimit`)
5. Comparison curves + shift drops (if enabled, dashed style)
6. Grip limits (`graph-limits.ts`)

## Important DOM patterns
- `data-i18n` for text content → `applyI18n()` sets `el.textContent = t(key)`.
- `data-i18n-tip` for tooltip attributes → sets `title`, `data-tip`, `aria-label`.
- `data-i18n-ph` for placeholder attributes.
- All English copy lives in `dictionary.en.ts`; `dictionary.it.ts`, `dictionary.de.ts`, `dictionary.es.ts` and `dictionary.fr.ts` mirror the same keys with compile-time parity (`Record<DictKey, string>`). Data modules hold `DictKey` references and resolve via `t(key, lang)` — never inline user-facing strings.
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
- Categories, benchmark behavior and the CI steps are documented in [docs/testing.md](docs/testing.md). Do not restate the test inventory here; extend that document instead.

## Share/URL
- Full setup encoded in URL hash, restored on page load via `restoreFromUrl()`.
- Primary encoding is the packed Base64URL `c` token (`share-compact.ts` v1: primary, compare, road/engine, both running-gear blocks); verbose keys and legacy hashes still decode, dyno curves always use verbose.
- Uses `navigator.clipboard.writeText()` with textarea fallback.
- Running gear keys: geometry + `rg_df` (type) + `rg_db` (accel lock) + `rg_dc` (coast lock) + `rg_dm` (catalog model id). Unknown model ids are ignored (legacy-safe).
- Comparison keys are the `crg_` mirror of `rg_` (same ranges and enums).
- Custom dyno curve encoded as `curve=rpm:torque;rpm:torque;...` (decimal dot, capped at `MAX_CURVE_POINTS = 64`).
- `running-gear-share.ts` owns the `rg_`/`crg_` block, the numeric range table, and a `numParam` helper reused by the other decode groups.
- Field-by-field detail is in [docs/data-formats.md](docs/data-formats.md).

## Differential catalog
- `src/config/diff-presets.ts` — append a row to `DIFF_PRESETS` to add models (id, i18n `labelKey`, physics `type`, `accLock`, `coastLock`).
- UI select values must stay in the catalog; `LSD_MODEL_IDS` gates the accel/coast lock inputs.
- Tests: `tests/diff-presets.test.ts` (order, range, i18n labels).

## Simulation KPIs
- `renderTable()` → `updateSummaryKpis()` keeps `#kpi-redline`, `#kpi-top-speed`, `#kpi-aero-wall` in sync with state (never rely on static HTML defaults).
- Accel KPIs memoize on a JSON key of physical inputs (`buildAccelKey`).
- `updateAccelKpis()` calls `applyKpiUnits()`: km/h mode shows 0-100 / 0-160 / 0-400 m, mph mode shows 60 ft / 0-60 mph / 1/4 mile. The quarter-mile cell swaps its label between `kpi.m400` and `kpi.quarterMile`; trap speed always renders in the active speed unit.

## Setup levels (Easy / Medium / Full)
- `SetupLevel = 'easy' | 'medium' | 'full'` on `AppState.setupLevel` (primary) and `AppState.compLevel` (comparison); persisted in `haguruma-setup-level` / `haguruma-comp-level`.
- `services/events/setup-level-events.ts` owns the gating maps: `SECTION_LEVELS` (per `[data-accordion]`), `ROW_LEVELS` (per element id), plus `COMP_SECTION_LEVELS` / `COMP_ROW_LEVELS`. Rank is `easy < medium < full`.
- Primary level gates **setup inputs only** — graph, tables, cruise and guides stay visible at every level. The comparison follows the primary level and can be lowered independently; its gear rows gate at `full`, engine/aero sections at `medium`.
- A level change must re-run `applySetupLevel()` + `applyCompLevel()` and then `renderAll(refs)`.

## Drawer navigation & Tools card
- Drawer nav has four entries only: Primary Car, Secondary Car, Tools, Setup (`data-view='primaryCar' | 'secondaryCar' | 'tools' | 'setup'`).
- `mobile-drawer-events.ts` maps each view to an accordion selector (`primaryCar → [data-accordion="primary"]`, `secondaryCar → compare`, `tools → cruise`, `setup → setup`); `openAccordionTree()` auto-opens collapsed ancestors.
- The Tools card (`cruise-card.ts`) holds two sibling accordions: `data-accordion="cruise"` (cruising check) and `data-accordion="tiresize"` (tire-size comparator with its own verdict pill). Both share the standard section-header/chevron markup.

## Car catalog labels
- `label` follows one convention: `<Model> (<N>-Speed[, <Type>], <FD> FD)` — e.g. `BMW M3 E36 3.2 (5-Speed, 3.15 FD)`. No prose descriptors ("Test", scenario names, bare years).
- FD is formatted to two decimals; gearbox type only when it is not a manual (`7-Speed DCT`, `8-Speed Auto`).
- The catalog contract, provenance caveats and the full table are in [docs/presets.md](docs/presets.md).

## Engine curve (anchors vs dyno CSV)
- `core/state/engine-curve.ts` returns the active curve: anchors by default, sanitized dyno points once a CSV is imported.
- `core/math/dyno-csv.ts` parses header / header-less torque or power rows. Supports `,`, `;`, `\t` delimiters and decimal commas; converts kgm → Nm and cv / hp → kW. Optional Gaussian pre-filter via `parseDynoCsv(text, { smooth: true })`.
- `core/math/engine-curve-core.ts` is the single source of truth for `engineTorqueAt`, `tractiveForceAt`, `optimalShift*`, and the dyno-tail taper past the last measured RPM. Dyno points interpolate with Akima (exact at nodes, segment-clamped; linear fallback on 2 points).
- Accepted columns, limits and rejection behavior are in [docs/data-formats.md](docs/data-formats.md).

## Powertrain efficiency
- `config/drivetrain-eff.ts` maps FWD → 0.90, RWD → 0.85, AWD → 0.80. The layout selector and preset apply both write `state.drivetrainEff`.
- An imported efficiency map overrides the constant when present; the lookup and its fallback are described in [MATH.md](MATH.md).

## Chassis downforce & coast lockup
- `running-gear.readout` shows the live downforce at 200 km/h (`lift × area × ½·ρ·v²`) and the coast lock-up speed in the active gear.
- `core/math/dynamics-math.ts` exposes `engineBrakeForceAt`, `maxCoastForceAtSpeed`, and `criticalCoastLockupSpeed`, all using `differentialCoastBias`.

## Build configuration
- `vite.config.ts` uses `base: './'` for GitHub Pages deployment, and `rollup-plugin-visualizer` writes `dist/bundle-report.html` on every build.
- `tsconfig.json`: strict mode, `noEmit`, `moduleResolution: bundler`.
- Tailwind loaded via CDN (`cdn.tailwindcss.com`) with custom colors in `index.html`.
- Hosting, PWA, offline caching and the Android workflow are documented in [docs/deployment.md](docs/deployment.md).
