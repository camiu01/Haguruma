# Testing

Haguruma is a pure client-side SPA with no backend: physics, codec and
presentation modules are unit-tested with Vitest, the vehicle catalog is
checked as data, and one warm-run timing guard keeps the acceleration solver
from regressing. There are no integration, browser or end-to-end suites in the
repository.

The suite lives in `tests/` and mirrors `src/`. Commands come from
`package.json`; the CI workflow is `.github/workflows/ci.yml`. For module layout
see [architecture.md](./architecture.md), for the relations under test see
[../MATH.md](../MATH.md), and for the pull-request process see
[../CONTRIBUTING.md](../CONTRIBUTING.md).

All statements below come from the repository files cited inline, except the
verification record, which comes from an executed run.

**Verification record.** On **2026-10-23**, at commit `5b51077` ("docs: align
documentation with v0.9.0 implementation", with only uncommitted documentation
edits in the tree), `npx tsc --noEmit` passed and `npm test` passed with
**58 test files and 513 tests**. The static file count can be re-checked with
`ls tests/*.test.ts | wc -l`; the test count requires a run — re-run the
commands in [Commands](#commands) to verify against a newer tree.

## Commands

| Command | What it checks |
|:--|:--|
| `npm test` | `vitest run` — the whole suite (all `tests/**/*.test.ts`) |
| `npx vitest run tests/<file>.test.ts` | One suite only |
| `npx tsc --noEmit` | TypeScript type checking of `src/` and `vite.config.ts` |
| `npm run bench` | `vitest bench --run` — the acceleration benchmark workload |
| `npm run build` | `npx tsc --noEmit && npx vite build` (typecheck, then production bundle) |

There is **no lint script**: the catalog checks are ordinary suites
(`tests/catalog-validation.test.ts`, `tests/catalog-quality.test.ts`) and run
with `npm test`.

### `npm test`

`package.json` defines `"test": "vitest run"`, so the suite runs once and exits
instead of watching. Vitest is configured through `vite.config.ts`; that file
has no `test` block, so the default Node environment applies. `jsdom` and
`happy-dom` are not dependencies, which means DOM-touching modules are exercised
through hand-built stubs (for example `tests/accordion-height.test.ts`,
`tests/accordion-chrome.test.ts`, `tests/theme-events.test.ts`) rather than a
real document. Run one file with `npx vitest run tests/tire-math.test.ts`.

The suite also includes the performance guard
`tests/accel-performance.test.ts`, which runs unconditionally — it is not
gated behind a separate command (see
[The acceleration timing guard](#the-acceleration-timing-guard)).

### `npx tsc --noEmit`

`tsconfig.json` enables `strict`, `noEmit`, `moduleResolution: "bundler"`,
`isolatedModules`, `forceConsistentCasingInFileNames` and `skipLibCheck`, with
`lib: ["ES2020", "DOM", "DOM.Iterable"]`.

One detail worth knowing: `tsconfig.json` sets `"include": ["src",
"vite.config.ts"]`, so **the `tests/` directory is not part of the `tsc`
program**. A type error inside a test file is not reported by
`npx tsc --noEmit`; Vitest transpiles tests without type checking. Type safety
of production code is what this step guards.

### `npm run bench`

`"bench": "vitest bench --run"` — runs every `tests/**/*.bench.ts` file
(currently `tests/accel-math.bench.ts`: anchor curve, 64-point Akima dyno and
active-AWD runs) once and exits. It reports timings; it does not assert them.

### `npm run build`

`"build": "npx tsc --noEmit && npx vite build"` — the typecheck is part of the
build, so a type error fails it before Vite runs. `npm run build` does not run
`npm test`; CI runs them as separate steps.

## Test inventory

58 `.test.ts` files plus one benchmark file (`tests/accel-math.bench.ts`).
Shared inputs live in `tests/dynamics-fixtures.ts` (the `dynamicsInput()`
builder used by the solver, benchmark and timing guard) and
`tests/fixtures/accel-benchmark.ts` (used by `tests/setup-sensitivity.test.ts`).

### Physics and math (17 files)

| File | What it verifies |
|:--|:--|
| `accel-math.test.ts` | Forward-Euler acceleration solver: 0–100 and quarter-mile completion, determinism, monotonic response to mass, rotating mass, shift time and launch RPM, per-gear inertia, null metrics on invalid input, split ordering, reaction-time offset |
| `aero-math.test.ts` | `kmhToMs`, drag force growth with speed², textbook drag formula, rolling resistance scaling, speed-sensitive `Crr`, road-load power band, kW/cv conversions, available wheel power with drivetrain efficiency, drag-limited top-speed bisection (including descent and crawl cases) |
| `brake-math.test.ts` | Ideal front brake bias from load transfer at 1.2 G, rear-lock flag and `REAR_LOCK_SHARE`, `v²/2a` stopping distance with aero help and downhill penalty, guards returning 0/`Infinity` |
| `braking-simulation.test.ts` | Stopping profiles from the per-wheel solver, wheel-lock and ABS cycling, combined service/engine braking demand and signed road-load behaviour |
| `cruise-math.test.ts` | Highway check: gear selection at or above the RPM floor, RPM consistency with `rpmFromKmh`, power-deficit verdict, invalid-input nulls |
| `dynamics-math.test.ts` | Static axle loads, longitudinal and lateral transfer, per-wheel loads conserving total weight, Kamm friction circle, differential limits (open/spool/Torsen/clutch), wheelspin onset, coast/engine-braking lock-up, tire-compound grip gain |
| `engine-curve-akima.test.ts` | Akima interpolation over dyno nodes: in-place edit cache invalidation, exactness at nodes, no overshoot on monotone runs, smoothness across the peak, two-point linear fallback |
| `inertia-math.test.ts` | Equivalent rotating mass reflected through the total ratio, growth with a shorter first gear, launch mass from first gear, guards |
| `lap-sequence.test.ts` | Downshift validation (over-rev refusal), rev matching, bounded/fractional sequence commands, limiter hold, handbrake phases and corner/apex gear advice |
| `recovery-math.test.ts` | Gear-drop recovery time against a hand computation, monotonicity with residual force, `Infinity`/0 boundary behaviour |
| `setup-diagnostics.test.ts` | Cross-axle temperature imbalance (`AXLE_IMBALANCE_C`) verdicts and contradictory same-axle spring/ARB adjustments |
| `setup-sensitivity.test.ts` | Signed finite-difference metrics for gearing, final drive, tire size, mass and grip without mutating the setup |
| `speed-math.test.ts` | SI speed/RPM round-trip, km/h to mph consistency, zero instead of `NaN` on bad geometry, reverse top speed of the Eclipse preset |
| `tire-math.test.ts` | Tire string parsing, circumference band, the ISO/ETRTO 0.975 rolling factor, load-sensitive dynamic radius, centrifugal growth and its cap |
| `traction-math.test.ts` | Torque/power round-trip through `KW_TO_NM`, peak anchors, droop past peak power, curve validation, tractive force scaling, optimal shift per gear pair, dyno-point curves and the rev limiter |
| `unit-utils.test.ts` | Speed step and unit labels, RPM ceiling rounding, kW/cv parsing and formatting |
| `vehicle-dynamics.test.ts` | Fuel-cut and limiter behaviour, transfer feedback between solver and force profile, mapped (bilinear) efficiency and active-differential regression |

### Measurement and tool math (9 files)

| File | What it verifies |
|:--|:--|
| `dyno-csv.test.ts` | CSV parsing across header/header-less files, `,`/`;`/tab delimiters and decimal commas, kgm/cv conversions, resampling to the point cap, derived peak anchors, Gaussian/Savitzky-Golay/median smoothing, invalid-row rejection |
| `fitment-math.test.ts` | Rim-channel sizing and the balloon-to-stretch fitment verdict |
| `gear-optimizer.test.ts` | Heuristic gearset solver: final-drive/gear proposals against a Vmax target and shift-drop budget |
| `gpx-track.test.ts` | GPX parsing and corner/straight track summaries used by the gear lab |
| `inverse-dyno.test.ts` | Torque recovery from a single-gear acceleration trace |
| `pyrometer-math.test.ts` | 3-zone tread analysis: camber advice from inner/outer spread, hot-pressure advice in 0.05 bar steps, working-window verdict |
| `telemetry-math.test.ts` | Telemetry CSV parsing (`parseTelemetryCsv`), gear-ratio clustering/recovery and sample caps |
| `timer-math.test.ts` | Phone speed-series split extraction (0-100, 0-60 mph, quarter mile) |
| `track-gear.test.ts` | Track-archetype gear advice sizing 2nd/3rd off peak torque |

### Catalog, presets and configuration data (7 files)

| File | What it verifies |
|:--|:--|
| `catalog-validation.test.ts` | `validateCatalogEntry` accepts every shipped entry and rejects missing fields, rising gear ratios, unknown drivetrain enums, `finalDrives` without the stock fd, and malformed `drivetrainOptions` (gearsets, LSD ids, tire compound ids) |
| `catalog-quality.test.ts` | Lints every raw `src/config/cars/*.json` file, checks filename equals `id`, and reproduces the plausibility rules on a synthetic entry |
| `presets.test.ts` | 26 catalog vehicles, valid tires/ratios/redlines, short-to-tall gear ordering, road-load power data, reverse ratio on every preset, the Eclipse 1G GS hero values, valid running gear; plus unique catalog ids and non-empty labels |
| `diff-presets.test.ts` | Differential catalog order and composition, lock percentages inside [0, 1], i18n label resolution, legacy type mapping, `LSD_MODEL_IDS` gating of the lock inputs |
| `tire-compounds.test.ts` | Compound catalog order (Eco 400TW → Slick), descending treadwear with ascending grip gain inside sane bounds, i18n labels, neutral legacy default |
| `drivetrain-eff.test.ts` | FWD/RWD/AWD efficiency defaults stay distinct and inside the road-load input range |
| `gear-colors.test.ts` | 8-entry palette and wraparound colour lookup |

### Share, storage and export (6 files)

| File | What it verifies |
|:--|:--|
| `share-utils.test.ts` | Verbose URL hash encode/decode round-trips (primary, comparison, running gear, simulation keys, downforce, dyno curve), rejection of out-of-range values, legacy-safe decoding of older hashes, patch application into the live store |
| `share-compact.test.ts` | Packed Base64URL `c` token round-trips, is shorter than the verbose hash, packs the default state under 200 characters, rejects malformed tokens, falls back to verbose keys with a custom dyno curve |
| `dynamics-share.test.ts` | The `d_*` dynamics sidecars and `rg_`/`crg_` extras append without touching the frozen v1 compact payload, and invalid values are ignored |
| `custom-store.test.ts` | Gear list parsing, name slugification, storage fallback without a DOM, and migration of the versioned custom-preset envelope including legacy bare maps |
| `session-backup.test.ts` | Session-log CSV/JSON export shape and full-state backup parse/validate/restore safety |
| `drivetrain-export.test.ts` | Assetto Corsa `.ini`, BeamNG `.jbeam`, MoTeC/AiM CSV and JSON export shapes, plus INI round-trip parsing and rejection of unusable input |

### Graph, UI, setup and i18n (16 files)

| File | What it verifies |
|:--|:--|
| `graph-svg.test.ts` | Pure-function tests for the SVG plot engine: frame geometry and projection, fade rule, envelope crossing and ceiling, unclipped power axis, comparison envelope, layer gating (no DOM anywhere) |
| `graph-viewport.test.ts` | Bounded zoom and pan window: clamping into axis limits, minimum spans, anchored zoom and pan offsets |
| `dynamics-graph.test.ts` | Physical-unit force profiles and SVG stopping-distance plots for the alternate graph views |
| `graph-legend.test.ts` | Palette mapping for the HTML legend swatches and layer-pill dots (`syncGraphSwatches`) |
| `shift-drops.test.ts` | Shift-drop peak visibility inside the plot, connector and landing-marker geometry, the guard that draws nothing when an upshift does not lose RPM or lands above the limiter, landing-RPM projection through a panned RPM window, per-pair landing-RPM and shift-speed deltas |
| `crosshair-snap.test.ts` | Snap-window tests for the crosshair shift-point lock |
| `crosshair-tooltip.test.ts` | Pure readout rows of the free hover tooltip: per-gear RPM with over-rev flags, wheel power and the grip verdict |
| `kpi-strip.test.ts` | KPI strip classifiers: WALL / OVERDRIVE / ECO flags and shift advisories |
| `compare-utils.test.ts` | Dual-setup comparison helpers: gear parsing/formatting, top-speed derivation, aligned delta with `null` for mismatched gear counts |
| `compare-gear-stack.test.ts` | Pure helpers of the prefix-parameterized primary/secondary gear stacks |
| `accordion-height.test.ts` | Open-height sync, clearing on close, recovery of a stale zero height, keeping the last height while unrendered, and the stylesheet no longer capping height |
| `accordion-chrome.test.ts` | The shared accordion recipe: no retired `accordion-header` alias, headers carry `section-header`, tool modules delegate to `buildToolShell`, table cells use the `.th`/`.td` role classes |
| `setup-matrix.test.ts` | Wizard matrix coverage (three phases × four issues), ranked fixes with resolvable copy in every language, dictionary-key existence, the front-ARB/aero trade-off case, guide sections and the eight procedure steps |
| `i18n.test.ts` | Identical key sets and non-empty values across every language, known translations, `t()` default/override behaviour |
| `theme-events.test.ts` | The pure theme cycle helper dark → oled → light → dark. The helper is exported and tested but is not bound to a control: the drawer OLED / Dark / Light segment calls `setTheme` directly |
| `qr-svg.test.ts` | Share-modal QR rendering (`src/core/share/qr-svg.ts` over the `qrcode` package): empty and oversized payloads rejected, non-latin-1 rejected, version-10/EC-L capacity honoured and the emitted SVG markup checked |

### Platform and performance (3 files)

| File | What it verifies |
|:--|:--|
| `pwa-utils.test.ts` | Service-worker eligibility (secure flag, https, loopback, plain http rejection), standalone detection, cacheable-request rules |
| `android-manifest.test.ts` | `android/app/src/main/AndroidManifest.xml` declares coarse and fine location, no background location, GPS hardware not required, and a non-exported `FileProvider` |
| `accel-performance.test.ts` | Warm-median timing guard for a 64-point dyno run (see below) |

## What the tests do and do not prove

The suite is a set of **unit and regression tests**: they assert the relations
the implementation intends (monotonicity, round-trips, guards, catalog ordering,
i18n parity, legacy-safe decoding) against values computed for those very
relations. That is a correctness net for the code, not validation of the physics
against independent measured vehicle data.

`MATH.md` §21 ("Assumptions and limitations") lists what the model deliberately
does not include — no Pacejka slip curve, no load-sensitive µ, no suspension
compliance, no turbo dynamics, no road curvature. No test can cover behaviour the
model does not implement.

A small number of checks do encode a documented external anchor. `MATH.md` §22
("Validation anchors") is the register, and these are the ones with a matching
test:

| Test | Anchor basis (`MATH.md` §22) |
|:--|:--|
| `tests/speed-math.test.ts` (`Eclipse reverse top speed`) | ≈ 61 km/h; the test accepts a 55–68 km/h band |
| `tests/aero-math.test.ts` (`dragLimitedSpeedKmh`) | Eclipse 1G 5th-gear Vmax 215–220 km/h (README anchor); the test is titled "near 215-225 kmh" and asserts 205 < limit < 235 km/h |
| `tests/tire-math.test.ts` (rolling factor) | ISO/ETRTO 0.975 factor |
| `tests/tire-math.test.ts` (loaded radius) | ≈ 0.976 × geometric circumference at 3433 N with the default 450000 N/m stiffness |
| `tests/tire-math.test.ts` (growth cap) | ×1.03 at 250 km/h, asserted to 4 decimals at 250 and 400 km/h |
| `tests/brake-math.test.ts` (`stoppingDistanceM`) | 100–0 km/h on µ 1.0, `v²/2a`. Note this test recomputes the same closed form, so it proves the implementation matches the formula, not an independently measured stop |
| `tests/presets.test.ts` (`Eclipse 1G GS hero preset`) | owner data: mass 1270 kg, Cd 0.29, frontal area 1.95 m², ratios and 3.083 reverse |

Everything else — including all of `dynamics-math.test.ts`, `dyno-csv.test.ts`
and `share-*.test.ts` — checks internal consistency. Treat the physics numbers
as a documented model, not as verified against a datasheet corpus.
`src/config/catalog-quality.ts` states the same caveat about itself.

There are **no property-based tests**: `fast-check` is not a dependency of the
repository, and no suite imports it.

## The acceleration timing guard

Two files, one workload. The shared input comes from `tests/dynamics-fixtures.ts`
(`dynamicsInput()`): a car with a **64-point dense dyno curve**, run through
`simulateAcceleration` from `src/core/math/accel-math.ts` — curve validation,
shift-target calculation and the full Euler loop.

- `tests/accel-math.bench.ts` is a `vitest bench` workload reporting the
  throughput of one complete run for three cases: anchor curve with live
  transfer, 64-point Akima dyno, and 64-point dyno with active AWD. It reports
  timings and asserts nothing; run it with `npm run bench`.
- `tests/accel-performance.test.ts` is the pass/fail gate and runs inside the
  ordinary `npm test` suite (no `skipIf`). For each of RWD and AWD it warms up
  with 30 runs, measures 31 more, and asserts that the **median** run stays
  under `BUDGET_MS = 6` (8 ms when the `CI` variable is set, because shared
  runners are slower and noisier). The comment in the file describes it as a
  blow-up detector rather than a micro-benchmark: a warm 64-point run costs
  roughly 2.5–4 ms on ordinary hardware.

Caveats:

- The budget is a wall-clock threshold, so it depends on the host, the
  Node/V8 version and competing load. It is a regression tripwire, not a
  universal performance guarantee, and not a statement about browser
  performance.
- The label inside `tests/accel-math.bench.ts` still says "target: mean <3 ms";
  that text predates the current median-based budget and does not gate anything.

## Catalog data quality

Two layers guard the vehicle catalog; both are plain suites inside
`npm test`.

**Contract validation** — `src/config/car-catalog.ts` defines
`validateCatalogEntry()` (structure, strictly decreasing ratios, `finalDrives`
containing the stock fd, `drivetrainOptions` shapes and catalog-id references)
and `isCatalogEntry()`. The loader at the bottom of that file globs
`./cars/*.json` eagerly and **silently drops** anything failing `isCatalogEntry`,
so a broken file would otherwise disappear from the UI without an error.
`tests/catalog-validation.test.ts` asserts every surviving entry validates and
that synthetic broken entries are rejected.

**Raw-file lint** — `tests/catalog-quality.test.ts` globs
`../src/config/cars/*.json` directly instead of reading the loader output, so a
file the loader filtered out still fails the suite, and it asserts the filename
matches the entry `id`. `src/config/catalog-quality.ts` supplies the rules:
numeric ranges (`massKg` 300–4000, `powerKw` 10–1500, `fd` 1–10, `redline`
3000–15000, `peakTorqueNm` 10–2500), parseable tire spec, 2–10 forward gears,
overall spread 1.5–12, per-gear ratio 0.25–8, no gear losing more than 65 % of
RPM on upshift, engine anchors ordered `500 ≤ peakTorqueRpm ≤ peakPowerRpm ≤
redline`, and claimed peak power/torque consistent within 8 %.

This is a plausibility lint. As the module header says, it is "not a substitute
for datasheet validation".

## Continuous integration

`.github/workflows/ci.yml` — job `verify` on `ubuntu-latest`, triggered by
pushes to `main` and pull requests targeting `main`. Steps, in order:

| Step | Guards |
|:--|:--|
| `actions/checkout@v4` | Source availability |
| `actions/setup-node@v4` (`node-version: '20'`, `cache: npm`) | A Node release matching the workflow line; `package.json` declares no `engines` field |
| `npm ci` | Lockfile-installed dependencies |
| `npx tsc --noEmit` | Types in `src/` and `vite.config.ts` |
| `npm test` | The whole Vitest suite, timing guard included |
| `npm run build` | The production bundle still builds (typecheck runs again inside the script) |

There is no lint step and no bench step: the catalog checks are part of
`npm test`, and the benchmark is an on-demand command.

`.github/workflows/cd.yml` (see [deployment.md](./deployment.md)) runs
`npm ci` and `npm run build` on Node 20 and publishes `dist/` to GitHub Pages;
it does not run the suite.

`.github/workflows/build-apk.yml` (manual or release-triggered) runs `npm ci`
and `npm run build`, then assembles the debug APK with JDK 21 and Android SDK
`platforms;android-35` + `build-tools;35.0.0`. **It does not run `npm test`** —
the APK path trusts CI to have passed.

## Manual checks

`CONTRIBUTING.md` documents a pre-pull-request checklist. These are procedures
to perform by hand; nothing in the repository records that they were run.

- `npx tsc --noEmit` — zero type errors.
- `npm test` — all Vitest suites pass.
- `npm run build && npm run preview` — manual smoke test of tire validation, the
  km/h / mph toggle, preset load, comparison, theme selection, tooltip, gear
  add/remove.
- Verify light-mode overrides if new Tailwind colour classes were added.

## Coverage map

`MATH.md` §25 ("Test coverage map") is the per-suite map grouped by area, and it
is the authoritative list of what each suite pins. The tables above group the
same suites by domain; use §25 when you need the exact assertions behind a
particular physics relation.
