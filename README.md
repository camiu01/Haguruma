# Haguruma

Haguruma is a browser-based gearing and road-load calculator for cars. You describe a vehicle — tire size, gear ratios, final drive, rev limiter, engine curve, mass, aero and chassis — and it shows what those numbers do: engine RPM against road speed in every gear, where each upshift lands, which gear is drag-limited, how much of the tire's grip the engine can actually use, and how long a 0–100 km/h or quarter-mile run takes.

It is built for enthusiasts, sim racers, amateur track drivers and tuners who want to understand a setup change before trying it. It runs entirely in the browser: no backend, no account, no upload.

**Every number it produces is a model estimate.** The physics is a documented set of simplifications, not a validated vehicle simulation. Treat the output as a way to compare setups, not as a prediction of what a specific car will do.

**HAGURUMA** expands to *Heuristic Application for Gear-ratio, Up-shift, & Redline Unit Mapping Architecture*.

[![License: GPL-3.0-only](https://img.shields.io/badge/license-GPL--3.0--only-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4.5-3178c6.svg)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-7.3.7-646cff.svg)](https://vite.dev/)
[![Tests](https://img.shields.io/badge/tests-vitest-6da35d.svg)](https://vitest.dev/)

[What it does](#what-it-does) · [See it in action](#see-it-in-action) · [Requirements](#requirements) · [Build and run](#build-and-run) · [Controls](#controls-and-everyday-use) · [Configuration](#configuration) · [Architecture](#architecture) · [Limitations](#limitations-and-troubleshooting) · [Development](#development) · [Documentation index](docs/README.md)

## What it does

The repository version is **0.5.1**. The working tree also contains unreleased work that targets the 0.6.0–0.9.0 milestones described in [TODO.md](TODO.md); that work is present in the source but is not part of a tagged release, so treat it as in development.

| Feature | Observable behavior |
| --- | --- |
| Gearing analysis | Per-gear RPM-vs-speed curves up to the rev limiter, with shift-drop connectors showing the landing RPM in the next gear, plus a reverse curve. |
| Shift advisor | A shift RPM per gear pair where the wheel-force curves cross, or `LIMIT` when the rev limiter is the best available point. |
| Road load and top speed | Required versus available wheel power per gear, `drag-limited` flags, and an `AERO` marker at the drag-limited top speed. |
| Grip and chassis | Load transfer, a Kamm friction circle, differential models with accel/coast lock, wheelspin onset per gear, downforce and a coast lock-up readout. |
| Acceleration | 0–100 km/h and quarter-mile solver with rotating inertia, shift torque cut and a launch RPM, plus unit-aware splits and trap speed. |
| Braking | Ideal front brake bias with a rear-lock warning, a stopping-distance result, and 100–0 / 200–0 speed and deceleration profiles. |
| Comparison | A full second vehicle overlaid as dashed curves with tire deltas, shift deltas and its own grip curve. |
| Vehicle data | 26 catalog presets, custom cars saved locally, and a spec-sheet wizard for entering a car from a few numbers. |
| Trackside tools | Braking, corner/apex gearing, a lap-style pedal and shift sequence, an efficiency map, a gearset search, telemetry analysis, a tire-size comparator, a cruise check, a pyrometer, an adjustment-conflict checker and a signed sensitivity chart. |
| Data exchange | Dyno CSV import, telemetry CSV import with ratio recovery and an inverse torque estimate, GPX track import, and Assetto Corsa / BeamNG / drivetrain JSON / tabular CSV exports. |
| Sharing | The full setup encoded in the URL hash, a QR modal for laptop-to-phone transfer, and a local full-state backup file. |
| Preferences | Five interface languages, km/h or mph, kW or cv, and three themes selected from the drawer. |
| Platforms | Installable PWA with offline caching, and a Capacitor Android wrapper built as a debug APK. |

### Available in the source

Implemented in this repository and covered by the automated suites described in [docs/testing.md](docs/testing.md): the gearing model, the shift advisor, road-load and drag-limited top speed, load transfer and grip, the acceleration solver, braking estimates, the comparison card, presets and custom cars, the tools listed above, the import and export formats, URL sharing and QR, the backup bundle, localization, themes and the PWA shell.

### Experimental and incompletely validated

These are implemented and usable, but their results rest on assumptions that have not been checked against measured data, or on platform behavior that has not been exercised on hardware:

- **Lap-style sequence** — the driver model for unmatched downshifts assumes a fixed engine inertia and a fixed clutch-engagement time. It is an indicative longitudinal integration, not a lap-time prediction.
- **Dense efficiency map** — the lookup works, but any map you supply is your own data; no factory calibration ships with the project.
- **Telemetry and inverse dyno** — ratio recovery and the inverse torque estimate depend on clean, full-throttle, steady-gear logs. The vendor CSV shapes are produced by this project and have not been verified against MoTeC or AiM tooling.
- **GPX track import** — corner and straight targets are geometry seeds derived from fixed assumptions, not measured track data.
- **GPS performance timer** — phone GPS is not a certified instrument, and no measured accuracy is claimed.
- **Android features** — the wrapper, screen wake lock, native haptics and the manifest permissions are documented from source; they have not been verified on a physical device in this repository.
- **All chassis, tire, aero and differential models** — see the assumptions list in [MATH.md](MATH.md).

### Planned or deferred

Open items are tracked in [TODO.md](TODO.md). They are concentrated in the 1.0.0 milestone: a ground-truth regression suite against published datasheets, a frozen share-protocol version, a rehearsed custom-store migration, a WCAG AA audit and conformance note, canvas visual-regression tests, a release-signed APK pipeline, a formal formula handbook, automated changelog generation, an end-to-end smoke test, a content-security policy and privacy statement, and store publication. Nothing in that list is promised here.

## See it in action

These screenshots come from this repository's own dev server with the catalog's default car loaded. The numbers shown are the illustrative preset data the app ships with, not measurements from a real vehicle.

![The main view: KPI strip, primary setup and the RPM-versus-speed graph](docs/assets/app-desktop-dark.png)

The main view in the dark theme: the KPI strip, the primary setup card, and the graph with its per-gear curves, shift-drop connectors and the drag-limited `AERO` marker.

![The trackside tools, each a collapsible section](docs/assets/app-tools-dark.png)

The trackside tools. Each one is a collapsible section sharing the same header as every other accordion in the app.

![The same view in the light theme](docs/assets/app-desktop-light.png)

The light theme. The OLED theme is the third option in the drawer segment.

<img src="docs/assets/app-mobile-dark.png" alt="The app at a phone viewport, with the drawer navigation" width="320">

On a phone the graph and the table come first, and the drawer holds the navigation.

## Requirements

| Use case | Requirement |
| --- | --- |
| Using the hosted build | A current browser with canvas and `localStorage`. No install required; installing as a PWA adds offline caching. |
| Local development | Node.js `^20.19.0 \|\| ^22.12.0 \|\| >=24.0.0` (declared in `package.json` → `engines`). |
| Optional native build | Node.js as above, a JDK, and the Android SDK. See [docs/deployment.md](docs/deployment.md). |

## Build and run

The commands below are the scripts declared in `package.json` and run from the repository root.

1. **Prerequisites** — install Node.js `^20.19.0`, `^22.12.0` or `>=24.0.0`.
2. **Clone**
   ```bash
   git clone https://github.com/camiu01/Haguruma.git
   cd Haguruma
   ```
3. **Install dependencies** — this project uses npm with the committed `package-lock.json`:
   ```bash
   npm install
   ```
4. **Run locally** — the dev server listens on port 5173:
   ```bash
   npm run dev
   ```
5. **Build and preview** — `build` runs the type check first, then bundles into `dist/`:
   ```bash
   npm run build
   npm run preview
   ```

For the Android build and for hosting details, see [docs/deployment.md](docs/deployment.md).

## Controls and everyday use

The main workflow is: load or enter a vehicle, adjust the inputs you care about, read the table and the graph, and optionally compare a second setup.

| Action | Result |
| --- | --- |
| Pick a preset in the vehicle selector | Tire, final drive, rev limiter, gears, mass, aero and engine anchors are filled in and the graph and table redraw. |
| Type a tire size such as `205/55R16` | The rolling circumference is derived and shown; an unparsable string is flagged instead of silently accepted. |
| Edit gear ratios, final drive or rev limiter | Curves, shift points, top speed and grip limits all recompute. |
| Load a dyno CSV | The anchor engine curve is replaced by the measured points until you switch back. |
| Change drivetrain layout | The default drivetrain efficiency follows the layout (FWD 0.90, RWD 0.85, AWD 0.80). |
| Enable the comparison card | A second vehicle is overlaid as dashed curves with tire and shift deltas. |
| Drag, pinch or use the keyboard on the graph | The visible speed/RPM window zooms and pans; a double-tap, `Home` or `Escape` restores the full view. |
| Hover or tap the graph | A crosshair readout shows speed, RPM and force at that point, with a keyboard-accessible equivalent. |
| Switch to the force view | Wheel force in newtons is plotted per gear against road speed, with total road resistance overlaid. |
| Choose a setup level | Easy, Medium or Full gates which inputs are visible without hiding the results. |
| Export the graph or the drivetrain | PNG, SVG, a printed summary, or an Assetto Corsa / BeamNG / JSON / CSV file. |
| Share the setup | A link containing the whole setup is copied, or shown as a QR code for a phone. |
| Change language, units or theme | The interface updates immediately and the choice persists. |

Units are handled at the display boundary only: the model runs in SI internally. The speed axis is in km/h or mph, power in kW or cv, and torque in Nm.

The full walkthrough of every panel and tool is in [docs/user-guide.md](docs/user-guide.md).

## Configuration

| Option | Available configuration |
| --- | --- |
| Language | English, Italian, German, Spanish or French. Persisted under `haguruma-lang`. |
| Speed unit | km/h or mph. Persisted under `haguruma-unit`. |
| Power unit | kW or cv. Persisted under `haguruma-power-unit`; the model always stores kW. |
| Theme | dark, oled or light. Persisted under `haguruma-theme` and applied before first paint. |
| Setup level | easy, medium or full for the main setup, under `haguruma-setup-level`; the comparison has its own `haguruma-comp-level`. |
| Comparison | Enable or disable the secondary vehicle card. |
| Saved vehicles | Custom presets in `haguruma-custom-presets`. |
| Saved run | The last local GPS performance session in `haguruma-performance-session`. |
| Backup | Export or import a single JSON file covering the persisted keys above. |
| Build base path | `base: './'` in `vite.config.ts`, so `dist/` can be served from a sub-path. |
| Build report | `rollup-plugin-visualizer` writes `dist/bundle-report.html` on every build. |
| Type checking | Strict TypeScript in `tsconfig.json` with `noEmit`. |

Source constants such as the simulation time step are model parameters, not user settings; they are listed in [MATH.md](MATH.md).

## Architecture

| Module | Responsibility |
| --- | --- |
| `src/main.ts` | Bootstrap: inject shells, resolve DOM handles, restore preferences, bind events, first paint. |
| `src/core/models.ts` | Shared types and the shape of `AppState`. |
| `src/core/state/app-state.ts` | The single mutable state singleton. |
| `src/core/math/` | All pure physics and calculation modules. |
| `src/core/units/unit-utils.ts` | Unit labels, axis steps and display conversion. |
| `src/core/share/` | URL-hash codecs, the packed token and the QR payload. |
| `src/core/presets/` | Custom-car store, backup bundle, quick-spec builder, saved session. |
| `src/core/setup/` | Diagnostic matrix and handbook copy. |
| `src/config/` | Vehicle catalog loader and JSON files, differential catalog, tire compounds, palettes, graph constants. |
| `src/services/graph/` | Canvas setup, axes, curves, layers, tooltip, theme palettes, force view, export. |
| `src/services/events/` | One binder per control group. |
| `src/components/` | Feature shells and the card components that render tables and panels. |
| `src/views/render-all.ts` | The single refresh entry point. |
| `src/styles/` | CSS hub plus per-feature modules driven by theme tokens. |

The implemented flow is one-directional: user input updates the state singleton, `renderAll(refs)` recomputes derived values, and the table, KPI strip and canvas are repainted. All physics stays inside `src/core/math/`, and unit conversion happens only when a value is displayed. The full structure, module boundaries and extension guides are in [docs/architecture.md](docs/architecture.md); the formulas are in [MATH.md](MATH.md).

## Limitations and troubleshooting

| Symptom / limitation | Checks and boundary |
| --- | --- |
| Results look different from another tool | Confirm the speed unit, the power unit, the active engine curve (anchors versus imported dyno) and the running-gear inputs. The models are documented approximations, not the same solver another tool uses. |
| A gear reads `drag-limited` | This is the model saying available wheel power cannot beat road load in that gear, not an error. |
| A shift shows `LIMIT` | The rev limiter, not a force crossing, is the best shift point for that pair. |
| A tool reports invalid input | The offending field is flagged; each parser also rejects malformed files rather than partially importing them. |
| An imported file is refused | Every importer enforces a size, row and format bound. See [docs/data-formats.md](docs/data-formats.md). |
| A curve disappears after zooming | The graph keeps an independent speed/RPM window; reset or fit the view. |
| Stale interface after a new deploy | The service worker caches the app shell. Reload, and read the cache/update notes in [docs/troubleshooting.md](docs/troubleshooting.md) before clearing site data, because clearing it also removes your saved cars and preferences. |
| GPS, wake lock or haptics unavailable | These are optional platform features that need permission, a secure context, or the native wrapper. |
| Native behavior unverified | No Android device or emulator is present in this repository, so native features are documented from source. |

Model limitations, unsupported cases and the assumptions behind every number are listed in [MATH.md](MATH.md). Practical diagnostics are in [docs/troubleshooting.md](docs/troubleshooting.md).

## Development

| Command | What it checks |
| --- | --- |
| `npm run dev` | Starts the Vite dev server on port 5173. |
| `npx tsc --noEmit` | Strict type checking across `src` and `vite.config.ts`. |
| `npm test` | Runs the whole Vitest suite. |
| `npm run lint:catalog` | Validates the raw vehicle catalog files, gear spread and engine-anchor plausibility. |
| `npm run bench` | Runs the acceleration benchmark plus an isolated warmed-mean timing gate. Wall-clock results depend on the host. |
| `npm run build` | Type check, then a production bundle into `dist/`. |
| `npm run preview` | Serves the built output for a local check. |
| `npm run androidAPP` | Builds, syncs Capacitor and assembles a debug APK. |

Contributions follow the conventions in [CONTRIBUTING.md](CONTRIBUTING.md) and [AGENTS.md](AGENTS.md). Supporting documentation:

| Document | Contents |
| --- | --- |
| [docs/README.md](docs/README.md) | Documentation index and reading paths. |
| [docs/user-guide.md](docs/user-guide.md) | Every panel, tool and workflow. |
| [MATH.md](MATH.md) | Formulas, constants, assumptions and validation anchors. |
| [docs/data-formats.md](docs/data-formats.md) | Import and export formats, with examples and limits. |
| [docs/presets.md](docs/presets.md) | The vehicle catalog and its provenance. |
| [docs/architecture.md](docs/architecture.md) | Structure, module responsibilities and how to extend. |
| [docs/testing.md](docs/testing.md) | Test categories, benchmarks and CI checks. |
| [docs/deployment.md](docs/deployment.md) | Hosting, PWA, offline behavior and Android. |
| [docs/troubleshooting.md](docs/troubleshooting.md) | Diagnostics and recovery. |
| [CHANGELOG.md](CHANGELOG.md) | Completed work, grouped by milestone. |
| [TODO.md](TODO.md) | Open work only. |

## Credits and license

Maintained by **Camiu** ([@camiu01](https://github.com/camiu01)).

Licensed under **GPL-3.0-only** — see [LICENSE](LICENSE). The license text is unmodified. No third-party notices are bundled beyond the dependency licenses recorded in `package-lock.json`.
