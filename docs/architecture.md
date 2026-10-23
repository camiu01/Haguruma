# Architecture

This document describes the code that exists. It covers the directory layout, what each module owns, how a change flows from an input to the screen, and where to add new behavior. The mandatory coding conventions live in [../AGENTS.md](../AGENTS.md), and the physics lives in [../MATH.md](../MATH.md).

## Shape of the application

Haguruma is a single-page Vite and TypeScript application with no backend. One mutable state object holds everything the user has configured. A single refresh function recomputes the derived values and repaints the table, the KPI strip and the canvas.

```
user input -> services/events/* binder -> core/state/app-state.ts
           -> views/render-all.ts (renderAll)
           -> core/math/* (derived values) + services/graph/* (canvas)
           -> components/* (tables, cards, tool panels)
```

Consequences worth knowing before you edit anything:

- **The state is a singleton.** Modules import `state` directly; there is no store, no reducer and no subscription. Persisting a value means writing it to `localStorage` explicitly.
- **There is one refresh entry point.** `renderAll(refs)` in `src/views/render-all.ts` is called after any state change. A new derived value belongs there or in a component it calls, not in an event handler.
- **Physics is pure and isolated.** Everything in `src/core/math/` takes plain values and returns plain values. It never touches the DOM, never reads the state singleton and never throws.
- **Units are converted at the display boundary only.** The model runs in SI. See [Unit boundaries](#unit-boundaries).

## Directory layout

```text
src/
  main.ts                          # bootstrap: inject shells, refs, preferences, events, first paint
  core/
    models.ts                      # shared types: SpeedUnit, TireSpec, GearPreset, AppState, SimInput, ...
    debounce.ts                    # shared debounce helper
    compare/compare-utils.ts       # comparison deltas and formatting helpers
    math/                          # all pure physics and calculation modules (see the module table)
    state/app-state.ts             # defaultState + the mutable singleton
    state/engine-curve.ts          # active curve: anchors by default, sanitized dyno points once imported
    units/unit-utils.ts            # unit labels, axis steps, kW/cv conversion, persistence
    i18n/                          # dictionaries.ts + dictionary.en/it/de/es/fr.ts + language.ts
    setup/                         # setup-matrix.ts (wizard), setup-guide-content.ts (handbook), setup-diagnostics.ts
    theme/theme.ts                 # theme selection (dark / oled / light) and persistence
    presets/                       # custom-store, backup-store, performance-store, quick-spec, simulation-settings
    share/                         # share-utils (verbose + legacy), share-compact (packed token),
                                   # running-gear-share (rg_/crg_), advanced-share, graph-window-share, qr-svg
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
    graph-constants.ts             # GRAPH_PADDING, GRAPH_STYLE_*, GRAPH_LIMITS
  services/
    dom/element-refs.ts            # typed DOM handles (ElementRefs)
    dom/focus-trap.ts              # tab trap for the drawer and modal
    dom/accordion-height.ts        # keeps open accordions uncapped but animatable
    graph/                         # canvas setup, axes, curves, shift drops, layers, limits, tooltip,
                                   # theme palettes, viewport, snap, force view, export, export footer,
                                   # drivetrain export
    events/                        # one binder per control group, plus event-binder.ts as the aggregator
    hardware/device-feedback.ts    # opt-in haptics and screen wake lock
    hardware/performance-recorder.ts # foreground GPS run recorder
  components/                      # feature shells, tools panels and table builders
    card/                          # base Card + one file per specialized card + index.ts barrel
  views/render-all.ts              # the single refresh entry point
  styles/                          # main.css hub + tokens/base/drawer/components/shell/overrides/
                                   # setup-guide/print/graph-interaction/track-tools modules
index.html                         # shell layout; feature shells inject into mount points
capacitor.config.ts                # native wrapper (webDir: dist)
android/                           # committed Capacitor scaffold; generated outputs are ignored
tests/                             # vitest suites mirroring src/, plus fixtures and the benchmark
```

## Module responsibilities

### Calculation modules

| Module | Responsibility |
| --- | --- |
| `core/math/tire-math.ts` | Tire-string parsing, geometric and loaded rolling circumference, centrifugal growth. |
| `core/math/speed-math.ts` | SI speed/RPM core and the display-unit wrappers. |
| `core/math/engine-curve-core.ts` | The single source of truth for the engine curve: validation, anchor model, Akima interpolation over measured points, shift-point search. |
| `core/math/dyno-csv.ts` | Dyno CSV parsing, unit conversion, smoothing filters, resampling to the share-point cap. |
| `core/math/traction-math.ts` | Tractive force, dynamic radius, optimal shift points; re-exports the curve surface. |
| `core/math/shift-math.ts` | Kinematic landing RPM, drop percentages, verdicts, ghost-curve deltas. |
| `core/math/aero-math.ts` | Drag, speed-sensitive rolling resistance, grade force, road-load power, drag-limited top speed. |
| `core/math/dynamics-math.ts` | Axle and wheel loads, load transfer, downforce, Kamm limit, differential limit, wheelspin and coast lock-up onset. |
| `core/math/inertia-math.ts` | Equivalent rotating mass reflected through the engaged gear. |
| `core/math/accel-math.ts` | The forward-Euler acceleration solver and its splits. |
| `core/math/cruise-math.ts` | Cruising gear selection and engine load verdict. |
| `core/math/brake-math.ts` | Ideal brake bias and the closed-form stopping distance. |
| `core/math/recovery-math.ts` | Gear-drop recovery time after an upshift. |
| `core/math/braking-simulation.ts` | Time-step braking profiles with load transfer, aero, grade and an ABS approximation; also exports the shared tire-force helper. |
| `core/math/powertrain-math.ts` | Efficiency-map lookup and the rev-limiter torque factor. |
| `core/math/efficiency-map.ts` | Validation and parsing of the RPM/load/efficiency map. |
| `core/math/handbrake-math.ts` | Rear handbrake force and the combination of service, coast and handbrake braking. |
| `core/math/lap-sequence.ts` | Bounded pedal/gear sequence integration with explicit rev-match transients. |
| `core/math/corner-advisor.ts` | Apex gear advice and downshift rev-match advice. |
| `core/math/gear-optimizer.ts` | Discrete gearset and final-drive search with optional track targets. |
| `core/math/gpx-track.ts` | GPX parsing and the straight/corner summary used to seed optimizer targets. |
| `core/math/telemetry-math.ts` | Telemetry CSV normalization, ratio recovery and the inverse torque estimate. |
| `core/math/setup-sensitivity.ts` | Signed finite-difference sensitivity of the main metrics to setup changes. |
| `core/math/performance-session.ts` | Derives run metrics from a recorded GPS session and exports them. |

### Services, components and views

| Module | Responsibility |
| --- | --- |
| `services/dom/element-refs.ts` | Resolves every static element once into a typed handle object. |
| `services/events/event-binder.ts` | Calls each binder in order; the single wiring point for controls. |
| `services/events/*.ts` | One binder per control group; reads input, writes state, calls `render()`. |
| `services/graph/graph-renderer.ts` | Owns the paint order of the graph (see the layer order note below). |
| `services/graph/graph-layers.ts` | Caches the static bitmap (background, grids, redline band, titles). |
| `services/graph/graph-viewport.ts` | The bounded zoom/pan window and redline-based axis fitting. |
| `services/graph/graph-snap.ts` | Magnetic crosshair snapping to the nearest curve. |
| `services/graph/graph-export-footer.ts` | The optional metadata caption burned into the PNG and SVG exports. |
| `services/graph/force-graph.ts` | The wheel-force view and its SVG export variant. |
| `services/graph/drivetrain-export.ts` | Assetto Corsa INI, drivetrain JSON, BeamNG Jbeam and tabular CSV builders. |
| `services/events/graph-gesture-events.ts` | Pointer pan, pinch, double-tap reset, keyboard navigation and the in-canvas buttons. |
| `components/app-shells.ts` | Injects every feature shell before DOM refs and translations resolve. |
| `components/graph-controls.ts` | Builds the in-canvas icon stack (fullscreen, fit, zoom in, zoom out). |
| `components/tool-form.ts` | The shared form primitives used by every tool panel. |
| `components/card/` | Data-in, markup-out cards; no side effects. |
| `views/render-all.ts` | The single refresh: resize canvas, draw graph, render tables and cruise. |
| `styles/main.css` | Import hub only; it contains no rules. |

The graph paint order is fixed and documented in [../AGENTS.md](../AGENTS.md): cached static bitmap, then primary curves and shift drops, aero-wall shading, comparison curves, and grip limits.

## Data flow

1. **Bootstrap.** `src/main.ts` injects the feature shells, resolves `ElementRefs`, restores language, units, theme and setup level, binds events, restores any state in the URL hash, then calls `renderAll`.
2. **Input.** A binder in `services/events/` reads the control, validates it, writes the relevant `state` fields, and calls the `render` callback it was given.
3. **Derivation.** `renderAll` recomputes everything derived from the state. Expensive results such as the acceleration KPIs are memoized on a key built from the physical inputs.
4. **Presentation.** Tables and cards are rebuilt with `textContent`; the canvas is redrawn from the state; the KPI strip is synchronized.

Shells are injected before `getElementRefs()` so that ids, accordion sections and `data-i18n` nodes exist in time for ref resolution, accordion binding and translation. New static markup belongs in a component-owned `inject*Shell()` builder, not in `index.html`.

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
| Saved GPS run | `haguruma-performance-session` | `core/presets/performance-store.ts` |
| Full-state backup | One JSON file covering the keys above | `core/presets/backup-store.ts` |
| Share link | URL hash: packed token, verbose keys, or the legacy token | `core/share/` |

The share codec and the backup bundle both validate on read and ignore or reject unknown content rather than trusting it. Details and exact field lists are in [data-formats.md](data-formats.md).

## Localization

One file per language under `core/i18n/`, all shaped as `Record<DictKey, string>` so a missing key is a compile error. `DictKey` is owned by `dictionary.en.ts`. Feature code never contains user-facing strings: it references a key and resolves it through `t(key, lang)`.

Markup uses three attributes, applied by `applyI18n()`: `data-i18n` for text, `data-i18n-tip` for tooltips (which also sets `title` and `aria-label`), and `data-i18n-ph` for placeholders. Help-dot spans must not be nested inside a `data-i18n` element, because the text replacement strips children.

## Theming

Three themes (`dark`, `oled`, `light`) are selected by a `data-theme` attribute on the root element, with the Tailwind `dark` class toggled alongside. Every Tailwind colour class needs an explicit light-mode override in `styles/overrides.css`, and translucent `bg-gauge/*` variants need OLED overrides. Feature CSS lives in its own module and uses theme tokens only. The graph keeps its own palette per theme in `services/graph/graph-theme.ts`, read from the computed style so a theme switch repaints the canvas without a reload.

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
2. Insert it in `graph-renderer.ts` at the correct position in the documented paint order.
3. Add tests for any pure logic.

### Add a differential model

Append one row to `DIFF_PRESETS` in `config/diff-presets.ts`, add its label keys to every dictionary, and cover it in `tests/diff-presets.test.ts`. Keep the `id` stable: it is persisted in the running-gear state and in the share hash.

### Add an import or export format

Add the builder or parser next to its peers, validate strictly on import, and document the fields, limits and rejection behavior in [data-formats.md](data-formats.md). Do not claim interoperability with an external tool unless it has been verified against that tool.

Every file picker checks `file.size` against a bound before reading the file, and the parser enforces its own row or character cap as well: the two guards are independent, so neither the UI nor the parser has to trust the other. The current bounds are 5 MB for a dyno CSV, 10 MB for a telemetry CSV, 5 MB for a GPX track, 50 kB for an efficiency map, 2 MB for a backup bundle and 1 MB for a `drivetrain.ini`.
