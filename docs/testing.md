# Testing

Haguruma is a pure client-side SPA with no backend: physics and codec modules are
unit-tested with Vitest, catalog JSON is linted as data, and one host-speed
benchmark guards the acceleration solver. There are no integration, browser or
end-to-end suites in the repository.

The suite lives in `tests/` and mirrors `src/`. Commands come from
`package.json`; the CI workflow is `.github/workflows/ci.yml`. For module layout
see [architecture.md](./architecture.md), for the relations under test see
[../MATH.md](../MATH.md), and for the pull-request process see
[../CONTRIBUTING.md](../CONTRIBUTING.md).

## Commands

| Command | What it checks |
|:--|:--|
| `npm test` | `vitest run` — the whole suite (all `tests/**/*.test.ts`) |
| `npx vitest run tests/<file>.test.ts` | One suite only |
| `npx tsc --noEmit` | TypeScript type checking of `src/` and `vite.config.ts` |
| `npm run lint:catalog` | Catalog contract plus raw-file data-quality lint |
| `npm run bench` | Warm acceleration benchmark and the isolated wall-clock gate |
| `npm run build` | `npx tsc --noEmit && npx vite build` (typecheck, then production bundle) |

### `npm test`

`package.json` defines `"test": "vitest run"`, so the suite runs once and exits
instead of watching. Vitest is configured through `vite.config.ts`; that file has
no `test` block, so the default Node environment applies. `jsdom` and `happy-dom`
are not dependencies, which means DOM-touching modules are exercised through
hand-built stubs (for example `tests/accordion-height.test.ts`,
`tests/graph-layers.test.ts`, `tests/performance-recorder.test.ts`) rather than a
real document. Run one file with `npx vitest run tests/tire-math.test.ts`.

### `npx tsc --noEmit`

`tsconfig.json` enables `strict`, `noEmit`, `moduleResolution: "bundler"`,
`isolatedModules`, `forceConsistentCasingInFileNames` and `skipLibCheck`, with
`lib: ["ES2020", "DOM", "DOM.Iterable"]`.

One detail worth knowing: `tsconfig.json` sets `"include": ["src",
"vite.config.ts"]`, so **the `tests/` directory is not part of the `tsc`
program**. A type error inside a test file is not reported by `npx tsc --noEmit`;
Vitest transpiles tests without type checking. Type safety of production code is
what this step guards.

### `npm run lint:catalog`

Runs two suites only: `tests/catalog-validation.test.ts` and
`tests/catalog-quality.test.ts`. See [Catalog data quality](#catalog-data-quality).

### `npm run bench`

Runs `vitest bench --run tests/accel-math.bench.ts --maxWorkers=1` followed by
`vitest run tests/accel-performance.test.ts --maxWorkers=1`. See
[The acceleration benchmark](#the-acceleration-benchmark).

### `npm run build`

`"build": "npx tsc --noEmit && npx vite build"` — the typecheck is part of the
build, so a type error fails it before Vite runs. `npm run build` does not run
`npm test`; CI runs them as separate steps.

## Test inventory

46 `.test.ts` files plus one benchmark file, with fixtures in
`tests/fixtures/` (`accel-benchmark.ts`, `efficiency-map.csv`).

### Physics and math (13 files)

| File | What it verifies |
|:--|:--|
| `accel-math.test.ts` | Forward-Euler acceleration solver: 0–100 and quarter-mile completion, determinism, monotonic response to mass, rotating mass, shift time and launch RPM, per-gear inertia, null metrics on invalid input, split ordering, reaction-time offset |
| `aero-math.test.ts` | `kmhToMs`, drag force growth with speed², textbook drag formula, rolling resistance scaling, speed-sensitive `Crr`, road-load power band, kW/cv conversions, available wheel power with drivetrain efficiency, drag-limited top-speed bisection (including descent and crawl cases) |
| `brake-math.test.ts` | Ideal front brake bias from load transfer at 1.2 G, rear-lock flag and `REAR_LOCK_SHARE`, `v²/2a` stopping distance with aero help and downhill penalty, guards returning 0/`Infinity` |
| `cruise-math.test.ts` | Highway check: gear selection at or above the RPM floor, RPM consistency with `rpmFromKmh`, power-deficit verdict, invalid-input nulls |
| `dynamics-math.test.ts` | Static axle loads, longitudinal and lateral transfer, per-wheel loads conserving total weight, Kamm friction circle, differential limits (open/spool/Torsen/clutch), wheelspin onset, coast/engine-braking lock-up, tire-compound grip gain |
| `engine-curve-akima.test.ts` | Akima interpolation over dyno nodes: in-place edit cache invalidation, exactness at nodes, no overshoot on monotone runs, smoothness across the peak, two-point linear fallback |
| `inertia-math.test.ts` | Equivalent rotating mass reflected through the total ratio, growth with a shorter first gear, launch mass from first gear, guards |
| `recovery-math.test.ts` | Gear-drop recovery time against a hand computation, monotonicity with residual force, `Infinity`/0 boundary behaviour |
| `shift-drops.test.ts` | Shift-drop peak visibility inside the plot, connector and landing-marker geometry, the guard that draws nothing when an upshift does not lose RPM or lands above the limiter, landing-RPM projection through a panned RPM window, per-pair landing-RPM and shift-speed deltas, coverage of every shared gear pair |
| `speed-math.test.ts` | SI speed/RPM round-trip, km/h to mph consistency, zero instead of `NaN` on bad geometry, reverse top speed of the Eclipse preset |
| `tire-math.test.ts` | Tire string parsing, circumference band, the ISO/ETRTO 0.975 rolling factor, load-sensitive dynamic radius, centrifugal growth and its cap |
| `traction-math.test.ts` | Torque/power round-trip through `KW_TO_NM`, peak anchors, droop past peak power, curve validation, tractive force scaling, optimal shift per gear pair, dyno-point curves and the rev limiter |
| `unit-utils.test.ts` | Speed step and unit labels, RPM ceiling rounding, kW/cv parsing and formatting |

### Dyno and measured data (2 files)

| File | What it verifies |
|:--|:--|
| `dyno-csv.test.ts` | CSV parsing across header/header-less files, `,`/`;`/tab delimiters and decimal commas, kgm/cv conversions, resampling to the point cap, derived peak anchors, Gaussian/Savitzky-Golay/median smoothing, invalid-row rejection |
| `efficiency-map.test.ts` | Measured efficiency maps: fractional-unit reading, rejection of blank/percentage cells, round-trip alongside the legacy compact share token, size and validity limits, effect on the acceleration model |

### Catalog, presets and configuration data (8 files)

| File | What it verifies |
|:--|:--|
| `catalog-validation.test.ts` | `validateCatalogEntry` accepts every shipped entry and rejects missing fields, rising gear ratios, unknown drivetrain enums, `finalDrives` without the stock fd, and malformed `drivetrainOptions` (gearsets, LSD ids, tire compound ids) |
| `catalog-quality.test.ts` | Lints every raw `src/config/cars/*.json` file, checks filename equals `id`, and reproduces the plausibility rules on a synthetic entry |
| `presets.test.ts` | 26 catalog vehicles, valid tires/ratios/redlines, short-to-tall gear ordering, road-load power data, reverse ratio on every preset, the Eclipse 1G GS hero values, valid running gear; plus unique catalog ids and non-empty labels |
| `diff-presets.test.ts` | Differential catalog order and composition, lock percentages inside [0, 1], i18n label resolution, legacy type mapping, `LSD_MODEL_IDS` gating of the lock inputs |
| `tire-compounds.test.ts` | Compound catalog order (Eco 400TW → Slick), descending treadwear with ascending grip gain inside sane bounds, i18n labels, neutral legacy default |
| `drivetrain-eff.test.ts` | FWD/RWD/AWD efficiency defaults stay distinct and inside the road-load input range |
| `quick-spec.test.ts` | Quick-spec presets produce a saveable, curve-valid setup, and reject malformed ratios, unsafe names (`__proto__`) and out-of-range datasheet values |
| `drivetrain-export.test.ts` | Assetto Corsa `.ini`, BeamNG `.jbeam`, MoTeC/AiM CSV and JSON export shapes, plus INI round-trip parsing and rejection of unusable input |

### Storage, share and persistence (3 files)

| File | What it verifies |
|:--|:--|
| `share-utils.test.ts` | Verbose URL hash encode/decode round-trips (primary, comparison, running gear, simulation keys, downforce, dyno curve), rejection of out-of-range values, legacy-safe decoding of older hashes, patch application into the live store |
| `share-compact.test.ts` | Packed Base64URL `c` token round-trips, is shorter than the verbose hash, packs the default state under 200 characters, rejects malformed tokens, falls back to verbose keys with a custom dyno curve |
| `custom-store.test.ts` | Gear list parsing, name slugification, storage fallback without a DOM, and migration of the versioned custom-preset envelope including legacy bare maps |

### Telemetry, GPS and session (2 files)

| File | What it verifies |
|:--|:--|
| `performance-recorder.test.ts` | GPS recorder lifecycle: saved sessions survive a stop without an armed watch, arming happens once, callbacks are discarded after stop, only speed/time/accuracy channels are kept, rolling starts and low-accuracy/stale/future fixes are rejected, recording stops across a missing GPS interval |
| `lap-sequence.test.ts` | Multi-phase lap sequences: bounded and fractional command validation, acceleration + upshift + braking + matched downshift integration, extra clutch spin-up drag on an unmatched downshift, refusal to downshift past the limiter, limiter hold, handbrake phases |

### UI, graph, setup and i18n (11 files)

| File | What it verifies |
|:--|:--|
| `canvas-setup.test.ts` | Linear `toX`/`toY` mapping to plot edges and mid-scale, including a non-zero window minimum |
| `graph-limits.test.ts` | Grip-curve normalization against the whole axis instead of the visible window, the curve staying inside the plot, and the same force projecting correctly onto a panned RPM window |
| `graph-layers.test.ts` | Static-layer cache key stability and invalidation (frame, limits, unit, theme, redline), OffscreenCanvas fallback, aero-wall shading range |
| `accordion-height.test.ts` | Open-height sync, clearing on close, recovery of a stale zero height, keeping the last height while unrendered, and the stylesheet no longer capping height at 1600 px |
| `theme-events.test.ts` | The pure theme cycle helper dark → oled → light → dark. The helper is exported and tested but is not bound to a control: the drawer OLED / Dark / Light segment calls `setTheme` directly |
| `gear-colors.test.ts` | 8-entry palette and wraparound colour lookup |
| `setup-matrix.test.ts` | Wizard matrix coverage (three phases × four issues), ranked fixes with resolvable copy in both languages, dictionary-key existence, the front-ARB/aero trade-off case, guide sections and the eight procedure steps |
| `setup-sensitivity.test.ts` | Signed finite-difference metrics for gearing and tire-size effects without mutating the setup |
| `compare-utils.test.ts` | Comparison gear parsing/formatting, top-speed derivation, aligned delta with `null` for mismatched gear counts |
| `i18n.test.ts` | Identical key sets and non-empty values across every language, known translations, `t()` default/override behaviour |
| `qr-svg.test.ts` | Dependency-free QR SVG: version scaling for share-URL lengths, rejection of empty/oversized/non-Latin-1 payloads |

### Platform contracts (2 files)

| File | What it verifies |
|:--|:--|
| `pwa-utils.test.ts` | Service-worker eligibility (secure flag, https, loopback, plain http rejection), standalone detection, cacheable-request rules |
| `android-manifest.test.ts` | `android/app/src/main/AndroidManifest.xml` declares coarse and fine location, no background location, GPS hardware not required, and a non-exported `FileProvider` |

### Release regression bundles (4 files)

These aggregate checks added for a release; they overlap the groups above and
cover modules that have no dedicated suite file.

| File | What it verifies |
|:--|:--|
| `release-physics.test.ts` | Advanced braking (`braking-simulation`), powertrain (`powertrain-math`), handbrake coupling, corner/downshift advice, setup diagnostics, plus the property-based checks below |
| `release-storage.test.ts` | Backup import/export safety (`backup-store`), advanced share extensions, GPS session parsing and the `performance-session` estimators |
| `release-telemetry.test.ts` | Telemetry CSV parsing and inverse-dyno (`telemetry-math`), the discrete gearset optimizer, GPX geometry (`gpx-track`) |
| `release-graph.test.ts` | Graph window transforms and sharing, auto-fit, snapping, SVG/PNG export geometry, escaping of untrusted SVG metadata |

## What the tests do and do not prove

The suite is a set of **unit and regression tests**: they assert the relations
the implementation intends (monotonicity, round-trips, guards, catalog ordering,
i18n parity, legacy-safe decoding) against values computed for those very
relations. That is a correctness net for the code, not validation of the physics
against independent measured vehicle data.

`MATH.md` §29 ("Assumptions and limitations") lists what the model deliberately
does not include — no Pacejka slip curve, no load-sensitive µ, no suspension
compliance, no turbo dynamics, no road curvature. No test can cover behaviour the
model does not implement.

A small number of checks do encode a documented external anchor. `MATH.md` §30
("Validation anchors") is the register, and these are the ones with a matching
test:

| Test | Anchor basis (`MATH.md` §30) |
|:--|:--|
| `tests/speed-math.test.ts` (`Eclipse reverse top speed`) | ≈ 61 km/h; the test accepts a 55–68 km/h band |
| `tests/aero-math.test.ts` (`dragLimitedSpeedKmh`) | Eclipse 1G 5th-gear Vmax 215–220 km/h (README anchor); the test is titled "near 215-225 kmh" and asserts 205 < limit < 235 km/h |
| `tests/tire-math.test.ts` (rolling factor) | ISO/ETRTO 0.975 factor |
| `tests/tire-math.test.ts` (loaded radius) | ≈ 0.976 × geometric circumference at 3433 N with the default 450000 N/m stiffness |
| `tests/tire-math.test.ts` (growth cap) | ×1.03 at 250 km/h, asserted to 4 decimals at 250 and 400 km/h |
| `tests/brake-math.test.ts` (`stoppingDistanceM`) | 100–0 km/h on µ 1.0, `v²/2a`. Note this test recomputes the same closed form, so it proves the implementation matches the formula, not an independently measured stop |
| `tests/presets.test.ts` (`Eclipse 1G GS hero preset`) | owner data: mass 1270 kg, Cd 0.29, frontal area 1.95 m², ratios and 3.083 reverse |

Everything else — including all of `dynamics-math.test.ts`, `dyno-csv.test.ts`,
`share-*.test.ts` and the release bundles — checks internal consistency. Treat
the physics numbers as a documented model, not as verified against a datasheet
corpus. `src/config/catalog-quality.ts` states the same caveat about itself.

## Property-based tests

`fast-check` 3.23.2 is a dev dependency. Exactly one file uses it:
`tests/release-physics.test.ts`, in the `physical properties` block, with
`numRuns: 300` per property.

1. **Speed/RPM round-trip.** For RPM in [500, 15000], total ratio in [0.4, 6],
   final drive in [1, 8] and circumference in [1, 3] m, `speedKmh` is finite,
   `rpmFromKmh(speedKmh(...))` returns the input RPM to 7 decimals, and speed
   grows with RPM.
2. **Tractive force.** For any ratio in [0.4, 5], `tractiveForceAt` at 4000 RPM
   is finite and increases with a taller total ratio.

## The acceleration benchmark

Two files, one workload. The shared input is `tests/fixtures/accel-benchmark.ts`:
a 1400 kg car, six gears, and a **64-point dense dyno curve**, run through
`simulateAcceleration` from `src/core/math/accel-math.ts` — curve validation,
shift-target calculation and the full Euler loop.

- `tests/accel-math.bench.ts` is a `vitest bench` workload
  (`time: 1500`, `warmupTime: 500`, `iterations: 100`) reporting the throughput
  of one complete run.
- `tests/accel-performance.test.ts` is the pass/fail gate. Its test is declared
  with `it.skipIf(...)`, so it is **skipped in the ordinary suite** and only
  executes when `npm_lifecycle_event` is `bench` or `HAGURUMA_PERF_GATE=1`. It
  warms up with 50 runs, then asserts the mean of 100 runs is **below 3 ms**.

`npm run bench` runs both with `--maxWorkers=1`, so the timing test is not
disturbed by parallel workers. CI runs `npm run bench` as a step of its own.

Caveats, stated in `README.md` as well:

- The 3 ms target is a wall-clock threshold, so it depends on the host, the
  Node/V8 version and competing load. It is a regression tripwire for this
  project's CI runner, not a universal performance guarantee, and not a
  statement about browser performance.
- No measured number is recorded in this document. The benchmark has not been
  run as part of writing it.

## Catalog data quality

Two layers guard the vehicle catalog.

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
| `actions/setup-node@v4` (`node-version: '24'`, `cache: npm`) | A Node release inside `package.json` `engines` (`^20.19.0 \|\| ^22.12.0 \|\| >=24.0.0`) |
| `npm ci` | Lockfile-installed dependencies |
| `npx tsc --noEmit` | Types in `src/` and `vite.config.ts` |
| `npm test` | The whole Vitest suite |
| `npm run lint:catalog` | Catalog contract plus raw-file data quality |
| `npm run bench` | Warm acceleration timing against the 3 ms mean gate |
| `npm run build` | The production bundle still builds |

`.github/workflows/cd.yml` (see [deployment.md](./deployment.md)) runs only
`npm ci` and `npm run build`; it does not run the suite.

## Manual checks

`CONTRIBUTING.md` documents a pre-pull-request checklist. These are procedures
to perform by hand; nothing in the repository records that they were run.

- `npx tsc --noEmit` — zero type errors.
- `npm test` — all Vitest suites pass.
- `npm run build && npm run preview` — manual smoke test of tire validation, the
  km/h / mph toggle, preset load, comparison, theme cycle, tooltip, gear
  add/remove.
- Verify light-mode overrides if new Tailwind colour classes were added.

## Coverage map

`MATH.md` §33 ("Test coverage map") is the per-suite map grouped by area, and it
is the authoritative list of what each suite pins. The tables above group the
same suites by domain; use §33 when you need the exact assertions behind a
particular physics relation.
