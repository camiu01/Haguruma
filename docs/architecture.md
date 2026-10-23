# Architecture

This document describes the code that exists. It covers the directory layout, what each module owns, how a change flows from an input to the screen, and where to add new behavior. The mandatory coding conventions live in [../AGENTS.md](../AGENTS.md), and the physics lives in [../MATH.md](../MATH.md).

## Shape of the application

Haguruma is a single-page Vite and TypeScript application with no backend. One mutable state object holds everything the user has configured. A single refresh function recomputes the derived values and repaints the plot, the tables and the KPI strip.

```
user input -> services/events/* binder -> core/state/app-state.ts
           -> views/render-all.ts (renderAll)
           -> core/math/* (derived values) + services/graph/* (SVG plot)
           -> components/* (tables, cards, tool panels)
```

Consequences worth knowing before you edit anything:

- **The state is a singleton.** Modules import `state` directly; there is no store, no reducer and no subscription. Persisting a value means writing it to `localStorage` explicitly.
- **There is one refresh entry point.** `renderAll(refs)` in `src/views/render-all.ts` is called after any state change. A new derived value belongs there or in a component it calls, not in an event handler.
- **Physics is pure and isolated.** Everything in `src/core/math/` takes plain values and returns plain values. It never touches the DOM, never reads the state singleton and never throws.
- **The plot is a declarative rebuild, not a canvas.** `renderGraph` clears `#graph-svg` and mounts fresh nodes on every pass; there is no bitmap cache and no HiDPI path.
- **Units are converted at the display boundary only.** The model runs in SI. See [Unit boundaries](#unit-boundaries).

## Directory layout

```text
src/
  main.ts                          # bootstrap: inject shells, refs, preferences, events, first paint
  core/
    models.ts                      # shared types: SpeedUnit, TireSpec, GearPreset, AppState, GraphLayerSettings, ...
    debounce.ts                    # shared debounce helper
    compare/compare-utils.ts       # comparison deltas and formatting helpers
    math/                          # all pure physics and calculation modules (34 files, see the module table)
    state/app-state.ts             # defaultState + the mutable singleton
    state/engine-curve.ts          # active curve: anchors by default, sanitized dyno points once imported
    state/dynamics-input.ts        # primary/secondary simulation input builders shared by solver and table
    state/dynamics-settings.ts     # v0.7 dynamics settings shape (limiter, gearbox, ABS, sequence, graph view)
    units/unit-utils.ts            # unit labels, axis steps, kW/cv conversion, persistence
    i18n/                          # dictionaries.ts + dictionary.en/it/de/es/fr.ts + language.ts
    setup/                         # setup-matrix.ts (wizard), setup-guide-content.ts (handbook), setup-diagnostics.ts
    theme/theme.ts                 # theme selection (dark / oled / light) and persistence
    presets/                       # custom-store, backup-store, performance-store, quick-spec
    backup/state-backup.ts         # full-state bundle + bulk custom-preset transfer (used by backup-tool)
    telemetry/session-store.ts     # session-run log with CSV/JSON exports (used by session-tool)
    share/                         # share-utils (verbose + legacy), share-compact (packed token),
                                   # running-gear-share (rg_/crg_), dynamics-share (d_*), curve-share, qr-svg
    pwa/pwa-utils.ts               # install prompt and service-worker helpers
  config/
    presets.ts                     # preset maps built from the catalog loader
    car-catalog.ts                 # CarCatalogEntry contract + import.meta.glob loader + validateCatalogEntry
    catalog-quality.ts             # data-quality lint for raw catalog files
    cars/                          # one <id>.json per vehicle (26 files); drop-in, no registry edit
    diff-presets.ts                # differential catalog (open, clutch LSD variants, Torsen, spool, aftermarket)
    drivetrain-eff.ts              # default efficiency by layout (FWD / RWD / AWD)
    tire-compounds.ts              # treadwear catalog with a grip gain per compound
    gear-colors.ts                 # 8-colour gear palette
    graph-constants.ts             # GRAPH_PADDING, GRAPH_STYLE_*, GRAPH_VIEWBOX, GRAPH_LIMITS
  services/
    dom/element-refs.ts            # typed DOM handles (ElementRefs)
    dom/focus-trap.ts              # tab trap for the drawer and modal
    dom/accordion-height.ts        # keeps open accordions uncapped but animatable
    graph/                         # SVG plot engine (see the graph module table)
    events/                        # 28 binders, aggregated by event-binder.ts
    wake-lock.ts                   # navigator.wakeLock wrapper used by the session tool
  components/                      # feature shells, tools, table builders
    card/                          # base Card + accordion-shell recipe + one file per specialized card + index.ts
  templates/                       # static HTML fragments (header, drawer, tools, modals, ...) injected by app-shell.ts
  views/render-all.ts              # the single refresh entry point
  styles/                          # main.css hub + tokens/base/drawer/components/controls/shell/overrides/
                                   # setup-guide/telemetry/print/dynamics/graph-interaction modules
index.html                         # shell layout; feature shells inject into mount points
capacitor.config.ts                # native wrapper (webDir: dist)
android/                           # committed Capacitor scaffold; generated outputs are ignored
tests/                             # vitest suites mirroring src/, plus dynamics-fixtures.ts and the benchmark
```

## Module responsibilities

### Calculation modules (`core/math/`)

| Module | Responsibility |
| --- | --- |
| `tire-math.ts` | Tire-string parsing, geometric and loaded rolling circumference, centrifugal growth. |
| `speed-math.ts` | SI speed/RPM core and the display-unit wrappers. |
| `engine-curve-core.ts` | Single source of truth for the engine curve: validation, anchor model, Akima interpolation over measured points, `engineTorqueAt`, `tractiveForceAt`, optimal shift search, dyno-tail taper. |
| `dyno-csv.ts` | Dyno CSV parsing, unit conversion, smoothing filters, resampling to `MAX_CURVE_POINTS = 64`. |
| `traction-math.ts` | Tractive force, dynamic radius, optimal shift points; re-exports the curve surface. |
| `shift-math.ts` | Kinematic landing RPM, drop percentages, verdicts and primary/comparison shift deltas. |
| `aero-math.ts` | Drag, speed-sensitive rolling resistance, grade force, road-load power, drag-limited top speed. |
| `dynamics-math.ts` | Axle and wheel loads, load transfer, downforce, Kamm limit, differential limit, wheelspin and coast lock-up onset, engine-braking force. |
| `inertia-math.ts` | Equivalent rotating mass reflected through the engaged gear. |
| `accel-math.ts` | The forward-Euler acceleration solver, its splits and the `SimInput` contract. |
| `accel-step.ts` | Mutable per-run gear/limiter state so no application state is written by the solver. |
| `cruise-math.ts` | Cruising gear selection and engine load verdict. |
| `brake-math.ts` | Ideal brake bias and the closed-form stopping distance. |
| `recovery-math.ts` | Gear-drop recovery time after an upshift. |
| `braking-simulation.ts` | Per-wheel ABS/lock time-step integration, combined service/engine-braking demand and stopping profiles. |
| `lap-sequence.ts` | Bounded pedal/gear sequence integration with explicit rev-match transients; rejects over-rev commands. |
| `corner-advisor.ts` | Apex gear advice and downshift rev-match advice. |
| `drive-force.ts` / `force-profile.ts` | Shared wheel force and transfer feedback between the solver, the table and the force graph. |
| `powertrain-math.ts` | Efficiency-map lookup and the rev-limiter torque factor. |
| `powertrain-control.ts` | Limiter hysteresis (hard cut vs bounce) and per-departing-gear interruption timing. |
| `drivetrain-map.ts` | Bilinear RPM/load efficiency map, normalized to the nominal drivetrain efficiency. |
| `efficiency-map.ts` | Validation and parsing of an imported RPM/load/efficiency map CSV. |
| `active-differential.ts` | Preload, torque-vectoring and adaptive AWD coupling contributions. |
| `gear-optimizer.ts` | Discrete gearset and final-drive search with optional track targets. |
| `gpx-track.ts` | GPX parsing and the straight/corner summary used to seed optimizer targets. |
| `telemetry-math.ts` | Telemetry CSV normalization, ratio clustering/recovery (20,000-sample cap). |
| `inverse-dyno.ts` | Torque recovery from a single-gear acceleration trace. |
| `timer-math.ts` | Phone speed-series splits (0-100, 0-60 mph, quarter mile). |
| `fitment-math.ts` | Rim-channel sizing and the balloon-to-stretch fitment verdict. |
| `pyrometer-math.ts` | 3-zone tread analysis: camber and hot-pressure advice, working-window verdict. |
| `track-gear.ts` | Track-archetype gear advice sizing 2nd/3rd off peak torque. |
| `setup-sensitivity.ts` | Signed finite-difference sensitivity of top speed, first shift and 0-100 to setup changes. |
| `performance-session.ts` | GPS-speed split estimation with freshness/accuracy gates plus a speed-only CSV export. |

Two calculation modules are currently **not reachable from the UI**: `efficiency-map.ts` (import parser with no control that calls it) and `performance-session.ts` / `core/presets/performance-store.ts` (validation for the legacy `haguruma-performance-session` key, which nothing writes anymore). Neither is exercised by the application, and neither has a test suite of its own.

### The SVG plot (`services/graph/`)

| Module | Responsibility |
| --- | --- |
| `svg-frame.ts` | Plot geometry: insets scaled with the host width, axis projection helpers. |
| `graph-renderer.ts` | `renderGraph`: measures the host, pins the viewBox, mounts the scene, binds layer pills, viewport buttons and the view selector. |
| `graph-scene.ts` | Pure state → scene pass: resolves walls, gears and layers, then `composeNodes` returns the draw list in order. |
| `svg-defs.ts`, `svg-axes.ts`, `svg-curves.ts`, `svg-shift-drops.ts`, `svg-limits.ts`, `svg-power.ts`, `svg-nodes.ts` | Layer primitives (definitions, grid/ticks/redline, gear rays, shift drops, aero wall/grip limits, power envelope, node mounting). |
| `graph-viewport.ts` | The bounded zoom/pan window (`GraphWindow`) with axis clamps and anchored zoom. |
| `graph-gestures.ts` | Wheel zoom, drag pan, keyboard navigation and the zoom/fit buttons — active only in the RPM view. |
| `graph-crosshair.ts`, `graph-crosshair-context.ts`, `crosshair-tooltip.ts` | Snapping crosshair, per-view context and the free hover tooltip rows. |
| `graph-legend.ts` | Repaints HTML legend swatches and layer-pill dots from the live palette. |
| `graph-power-scene.ts`, `power-crossing.ts` | Mapped power envelopes and the available/required crossing marker. |
| `dynamics-graph.ts`, `dynamics-axes.ts` | The force and braking views rendered on the same host. |
| `graph-theme.ts` | Per-theme plot palettes read from the theme state. |
| `graph-export.ts`, `graph-export-footer.ts` | PNG/SVG download of a clone of the live SVG plus the optional metadata caption. |
| `drivetrain-export.ts` | Assetto Corsa `.ini`, drivetrain `.json`, BeamNG `.jbeam` and MoTeC/AiM CSV builders plus the `.ini` parser. |

The fixed draw order is documented in [../AGENTS.md](../AGENTS.md) ("Graph render order"): defs, background/grid/ticks, primary rays, shift drops, aero wall, power envelope and its unclipped axis, comparison rays, grip limits, axis titles, crosshair. Layer switches live in `state.graphLayers`.

### Services, components and views

| Module | Responsibility |
| --- | --- |
| `services/dom/element-refs.ts` | Resolves every static element once into a typed handle object. |
| `services/events/event-binder.ts` | Calls each binder in order; the single wiring point for controls. |
| `services/events/*.ts` | One binder per control group (engine, primary, comparison, running gear, units, language, theme, share, export, drawer, setup level, PWA, ...); reads input, writes state, calls `render()`. |
| `services/wake-lock.ts` | Feature-detected screen wake lock for track-side use. |
| `components/app-shell.ts` | Injects the `templates/*.html` fragments (header, drawer, tools, modals) before DOM refs and translations resolve. |
| `components/card/` | `base-card.ts` (data-in, markup-out, no side effects) plus `accordion-shell.ts`, which builds every card, section header and chevron in the app. |
| `components/` (tables and readouts) | `gear-list.ts`, `gear-table.ts`, `gear-status.ts`, `compare-table.ts`, `kpi-strip.ts`, `header-bar.ts`, `running-gear-*`, `setup-*`, `dynamics-*`, `metric-fields.ts`. |
| `components/` (tools) | `cruise-card.ts`, `tire-size-tool.ts`, `fitment-tool.ts`, `telemetry-tool.ts`, `gear-lab-tool.ts`, `session-tool.ts`, `spec-wizard-tool.ts`, `backup-tool.ts`, `pyrometer-tool.ts` / `pyrometer-shell.ts`, `dynamics-tool.ts`, `setup-guide.ts`, `preset-search.ts`, `custom-car.ts`, `active-diff-controls.ts`. |
| `views/render-all.ts` | The single refresh: plot, tables, KPI strip, readouts, then accordion re-measurement. |
| `styles/main.css` | Import hub only; it contains no rules. |

## Data flow

1. **Bootstrap.** `src/main.ts` injects the feature shells (component `inject*Shell()` builders plus `templates/*.html` fragments), resolves `ElementRefs`, restores language, units, theme and setup level, binds events, restores any state in the URL hash, then calls `renderAll`.
2. **Input.** A binder in `services/events/` reads the control, validates it, writes the relevant `state` fields, and calls the `render` callback it was given.
3. **Derivation.** `renderAll` recomputes everything derived from the state. Expensive results such as the acceleration KPIs are memoized on a key built from the physical inputs.
4. **Presentation.** Tables and cards are rebuilt with `textContent`; the plot is recomposed from the state; the KPI strip is synchronized.

Shells are injected before `getElementRefs()` so that ids, accordion sections and `data-i18n` nodes exist in time for ref resolution, accordion binding and translation. New static markup belongs in a component-owned `inject*Shell()` builder or a `templates/*.html` fragment, not in `index.html`.

## Unit boundaries

The model stores and computes in SI: Nm, kW, N, km/h, m, s. Imperial or alternative display units are applied only when a value is formatted or parsed for display.

| Concern | Where it is handled |
| --- | --- |
| Speed display (km/h, mph) | `core/units/unit-utils.ts` plus `speed-math.ts` display wrappers. |
| Power display (kW, cv) | `core/units/unit-utils.ts`; the state always stores kW. |
| Axis steps and RPM ceiling | `core/units/unit-utils.ts`. |
| Internal scans | Call the SI core (`speedKmh`, `rpmFromKmh`) directly, never the display wrappers. |

## Persistence and sharing

| Concern | Key or artifact | Implemented in |
| --- | --- | --- |
| Language | `haguruma-lang` | `core/i18n/language.ts` |
| Theme | `haguruma-theme` | `core/theme/theme.ts` |
| Speed unit | `haguruma-unit` | `core/units/unit-utils.ts` |
| Power unit | `haguruma-power-unit` | `core/units/unit-utils.ts` |
| Setup levels | `haguruma-setup-level`, `haguruma-comp-level` | `services/events/setup-level-events.ts` |
| Custom cars | `haguruma-custom-presets` | `core/presets/custom-store.ts` |
| Session log | `haguruma-sessions` | `core/telemetry/session-store.ts` |
| Full-state backup | `haguruma-backup-<YYYY-MM-DD>.json` (file) | `core/backup/state-backup.ts` + `components/backup-tool.ts` |
| Bulk car transfer | `haguruma-my-cars-<YYYY-MM-DD>.json` (file) | same module, `exportPresetsBundle` / `parsePresetsBundle` |
| Garage export | `haguruma-garage.json` (file) | `services/events/drawer-utils-events.ts` |
| Share link | URL hash: packed `c` token, verbose keys, `rg_`/`crg_` blocks, `d_*` sidecars, legacy hashes | `core/share/` |

`core/presets/backup-store.ts` is a second, stricter backup implementation (allowlisted keys including `haguruma-performance-session`, 2 MB text cap, transactional restore with rollback). It shares no code with `core/backup/state-backup.ts`, and no current UI control calls it; treat it as legacy until the two paths are merged.

The share codec and the backup bundle both validate on read and ignore or reject unknown content rather than trusting it. Details and exact field lists are in [data-formats.md](data-formats.md).

**Input caps.** File pickers do not all pre-check `file.size`; the hard limits live in the importers and parsers that need them: 1 MB for a drivetrain `.ini` (`MAX_DRIVETRAIN_INI_BYTES` in `services/events/export-events.ts`), 2 MB for a backup/garage JSON (`core/presets/backup-store.ts`), 1 MB and 5,000 samples for a stored performance session (`core/presets/performance-store.ts`), 50 kB for an efficiency-map CSV (`core/math/efficiency-map.ts`), 64 points after any dyno import (`MAX_CURVE_POINTS`), 20,000 rows per telemetry pass (`TELEMETRY_MAX_SAMPLES`), and 271 bytes for a QR payload (version 10 at EC level L).

## Localization

One file per language under `core/i18n/` (`en`, `it`, `de`, `es`, `fr`), all shaped as `Record<DictKey, string>` so a missing key is a compile error. `DictKey` is owned by `dictionary.en.ts` and the set is wired in `dictionaries.ts`. Feature code never contains user-facing strings: it references a key and resolves it through `t(key, lang)`.

Markup uses three attributes, applied by `applyI18n()`: `data-i18n` for text, `data-i18n-tip` for tooltips (which also sets `title` and `aria-label`), and `data-i18n-ph` for placeholders. Help-dot spans must not be nested inside a `data-i18n` element, because the text replacement strips children.

## Theming

Three themes (`dark`, `oled`, `light`) are selected by a `data-theme` attribute on the root element, with the Tailwind `dark` class toggled alongside. Every Tailwind colour class needs an explicit light-mode override in `styles/overrides.css`, and translucent `bg-gauge/*` variants need OLED overrides. Feature CSS lives in its own module and uses theme tokens only. The plot keeps its own palette per theme in `services/graph/graph-theme.ts`, and `graph-legend.ts` repaints the HTML legend from that palette on every render, so legend and plot cannot drift apart.

## How to extend

### Add a calculation

1. Create `core/math/<name>-math.ts` with a `@file` and `@brief` header.
2. Validate inputs and return a neutral value (`0`, `null` or a null-result object) instead of throwing. Never propagate `NaN` or `Infinity`.
3. Keep SI inside and convert units only at the boundary.
4. Give every function a TSDoc block with `@brief`, `@param` and `@return`.
5. Add a mirror suite at `tests/<name>-math.test.ts`, and add a row to the module table in [../MATH.md](../MATH.md).

### Add a UI control

1. Add the markup in the owning component's `inject*Shell()` builder, or in the relevant tool component.
2. Resolve it in `services/dom/element-refs.ts` if it is a static shell element.
3. Bind it in the matching `services/events/` binder: validate, write state, call `render()`.
4. Use `data-i18n`, `data-i18n-tip` or `data-i18n-ph` for any user-facing string, and add the keys to every dictionary.
5. If the value is persisted or shared, extend the relevant codec and its tests.

### Add a vehicle preset

Drop a JSON file into `src/config/cars/` and satisfy the `CarCatalogEntry` contract. There is no registry to edit. Steps and the full schema are in [presets.md](presets.md).

### Add a translation

Create `core/i18n/dictionary.<lang>.ts` typed as `Record<DictKey, string>`, register it in `dictionaries.ts` (the `Lang` union, the exported map, and the order list), add a selector button with its `ElementRefs` entry, and extend the parity test. See [testing.md](testing.md) for the checks that guard key parity.

### Add a graph layer

1. Create a leaf module `services/graph/graph-<layer>.ts` exporting one focused function.
2. Insert it in `graph-scene.ts` / `graph-renderer.ts` at the correct position of the documented paint order.
3. Add a toggle only if the layer should be user-switchable (`state.graphLayers` plus a `[data-graph-layer]` pill or a drawer switch), and cover any pure logic with tests.

### Add a differential model

Append one row to `DIFF_PRESETS` in `config/diff-presets.ts`, add its label keys to every dictionary, and cover it in `tests/diff-presets.test.ts`. Keep the `id` stable: it is persisted in the running-gear state and in the share hash.

### Add an import or export format

Add the builder or parser next to its peers, validate strictly on import, and document the fields, limits and rejection behavior in [data-formats.md](data-formats.md). Do not claim interoperability with an external tool unless it has been verified against that tool.

Where a picker reads a file, cap it before parsing: check the file size in the handler **and** enforce a text or row cap inside the parser, so neither the UI nor the parser has to trust the other. The existing bounds are listed under [Input caps](#input-caps).
