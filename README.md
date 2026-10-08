# HAGURUMA

**Heuristic Application for Gear-ratio, Up-shift, & Redline Unit Mapping Architecture**

A client-side TypeScript SPA that plots engine RPM against vehicle speed for every gear, computes redline shift drops, estimates road-load physics (mass + aero drag + rolling resistance), and prescribes optimal shift points via tractive-force analysis.

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4.5-blue.svg)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5.2.0-purple.svg)](https://vitejs.dev/)
[![Vitest](https://img.shields.io/badge/Vitest-1.6.0-green.svg)](https://vitest.dev/)
[![PWA](https://img.shields.io/badge/PWA-ready-purple.svg)](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)

## What's new in 0.8.0

Stable release of the v0.8.0 milestone: telemetry, multi-sim and heuristic solver.

- **Telemetry gear check:** paste MoTeC / AiM / RaceChrono / OBD2 CSV rows
  (`engine_rpm`, `wheel_speed_kmh`) to recover the real ratios and flag
  clutch/tire slip; derive a torque curve from a single-gear pull and copy it
  as dyno CSV for the engine import.
- **Gear lab:** heuristic gearset solver (Vmax target + max shift drop, with
  apply-to-primary), hairpin/balanced/fast track archetypes sizing 2nd and 3rd
  off peak torque, and GPX lap import seeding corner/straight lengths.
- **Session & phone timer:** GPS standing-start splits (0-100, 0-60 mph,
  quarter mile + trap) compared against the solver, a local run log with
  CSV/JSON export for MoTeC/AiM, and a keep-screen-awake toggle for
  track-side mounts.
- **Data & presets:** spec-sheet quick-add wizard (power, mass, tire, gears)
  saving into My Cars, a full-state backup bundle (custom cars, units, theme,
  language, levels, sessions) and bulk preset import/export for migration.
- **Wheel fitment:** rim-channel calculator with balloon-to-stretch verdict
  for the tire-on-rim pairing, next to the tire-size check.

Heuristic outputs (solver proposals, inverse dyno, recovered ratios) are
starting estimates from logged or assumed data, not measured optima.
See [MATH.md](MATH.md) for assumptions and equations.

## Previously in 0.7.0

Stable release of the v0.7.0 milestone: vehicle dynamics and tractive-force engine.

- **Graph views:** switch between RPM/speed, per-gear wheel force/speed, and
  stopping speed/distance. The force view overlays road resistance, a force-based
  Vmax marker, optional traction excess, and dashed comparison curves. Braking
  shows 100–0 and 200–0 km/h profiles with deceleration on the right axis.
- **Live acceleration physics:** grip feeds instantaneous longitudinal transfer
  back into the Euler solver, including zero-grip states. Hard fuel cut or
  hysteretic limiter bounce, synchro/dog defaults and per-gear delays are selectable.
- **Dynamics tool:** ABS, brake bias/demand, stopping-distance KPIs, corner-radius
  apex advice and editable throttle/coast/brake/downshift sequences with rev matching.
  Sequence rows are `seconds, one-based gear, throttle (0–1), brake demand (g)`;
  total duration is limited to 60 seconds and over-rev downshifts are rejected.
- **Differentials:** mirrored axle preload, torque vectoring, adaptive AWD
  front/rear coupling and handbrake-disengage controls in both running-gear setups.
- **Mapped losses:** a bilinear RPM/torque-load efficiency map, normalized to the
  nominal efficiency input. This is an engineering approximation, **not a
  manufacturer-measured map**; disable it to retain constant-efficiency calculations.
- **Sharing and performance:** v0.7 controls use validated sidecar keys beside
  the unchanged v1 compact token. Frozen dyno curves reuse Akima coefficients.
  `npm run bench` measures anchors, 64-point dyno and active-AWD runs; a warm-median
  regression test guards the 3 ms target.

These estimates are intended for setup exploration, not safety-critical braking
predictions. See [MATH.md](MATH.md) for assumptions and equations.

## Previously in 0.6.0

**Power envelope.** The available-vs-required wheel-power layer now scales to the
wheel-power peak instead of the road-load demand, so the envelope fills the plot;
the kW axis lives in its own unclipped group (it used to be cut away by the plot
clip entirely), the crossing carries its drag-limited speed, the secondary car's
envelope runs dashed on the same scale, and the hover tooltip reports the wheel
power at the cursor from the very sample the curve is drawn from.

**Graph readouts.** The free hover tooltip grew a grip verdict row (tire limit,
per-wheel share, wheelspin flag) and a wheel-power row; shift-point snapping moved
into `svg-shift-drops.ts: snapPointFor()` with its own window constant and suite.

**Comparison parity.** The secondary running gear renders in the same two-column
grid as the primary card again (`#comp-rg-mount` is `display: contents`), with the
lateral-G slider back in its primary slot between rear spring and downforce.

**Shared chrome.** One recipe builds every card and accordion: `components/card/accordion-shell.ts`
exports `buildToolShell` / `buildAccordionSection` / `buildSectionHeader` / `buildChevron`,
and the cruise, tire-size, pyrometer and paddock tools delegate to it instead of
hand-rolling card, header and chevron markup. Headers moved to the `section-header` /
`section-head` / `section-dot` / `section-note` role classes, tables to the `.th` / `.td`
roles and inputs to `.field-*`; the retired `.accordion-header` alias is gone, locked by
`tests/accordion-chrome.test.ts`.

**Design system.** New `src/styles/controls.css` owns the type scale (`--fs-micro` →
`--fs-body` plus the `.fs-*` utilities), the field system (`.field-label`, `.field-input`
with its `--compact` / `--md` / `--tall` / `--upper` / `--center` / `--recessed`
modifiers, `.field-unit`, `.field-half`) and the button system (`.btn`, `.seg-btn` with
`.is-active`, `.text-btn`); segmented buttons flip a class instead of rebuilding their
class list. Fonts moved from Inter / JetBrains Mono to **Share Tech / Share Tech Mono**
(`index.html`, `tailwind.config.cjs`, theme tokens), and static markup moved out of
`index.html` into component-owned template modules.

**Legend sync.** `graph-legend.ts: syncGraphSwatches()` repaints the HTML legend swatches
and the layer pill dots from the live plot palette on every render, so legend and graph
cannot drift apart in any theme.

**QR sharing.** The share modal's QR renderer is a thin wrapper over the `qrcode` package
now (~430 hand-rolled encoder lines removed; EC level L, versions 1-10, path-based SVG).

The full checklist lives in [TODO.md](TODO.md).

## Features

- **RPM-vs-speed curves** — one per forward gear up to the rev limiter, with shift-drop connectors showing RPM landing in the next gear.
- **Reverse gear** — dashed gray `R` curve.
- **Tire parsing** — `205/55R16` → rolling circumference with instant validation.
- **Comparison overlay** — full secondary vehicle setup (tire, FD, gears, redline, mass, Cd, frontal area, power, torque/power anchors, running gear) as dashed curves with delta readout and its own grip curve.
- **Engine curve model** — peak torque RPM, peak torque Nm, peak power RPM with linear **torque interpolation** below peak torque (smooth real-world profile) and linear power interpolation above. Derived `kW @ torque peak` readout via `P = T × n × π / 30000`.
- **Road-load physics** — for every gear peak, computes wheel power required to hold speed against weight, aero drag, rolling resistance, and grade. Flags gears the engine cannot pull as `drag-limited`.
- **Drag-limited top speed** — bisection solver finds where required wheel power equals available power; marked with an `AERO` line on the graph. Handles steep downhill grades robustly.
- **Tractive force analysis** — engine torque → wheel force in Newtons per gear (`F = T × i_total × η / r_dyn`).
- **Optimal shift advisor** — per-gear-pair shift RPM based on force-curve crossing with anti-false-positive scanning (immune to turbo-lag oscillations at low RPM); appends `LIMIT` when the rev limiter is the optimal point.
- **Load transfer & grip model** — lateral load transfer per axle (full inner→outer transfer), Kamm friction circle, advanced differential catalog (open / LSD 1-way / 1.5-way / 2-way with accel+coast lock %, Torsen, spool), wheelspin detection, and proportional lateral force distribution based on instantaneous wheel load.
- **Downforce model** — lift coefficient, reference area and front/rear split inputs with a live downforce readout; downforce adds to vertical load for the friction-limited grip curve.
- **Coast / engine-braking model** — closed-throttle drag through the coast-side differential lock, with a per-gear coast lock-up speed readout (inside-wheel lockup under engine braking).
- **Dyno CSV import** — load a measured torque or power curve (comma/semicolon/tab, decimal comma, Nm/kgm, kW/cv/hp, header or header-less); the anchor model is replaced until you switch back.
- **Layout-mapped efficiency** — picking FWD/RWD/AWD in the running-gear card also sets the default drivetrain efficiency (0.90 / 0.85 / 0.80).
- **Acceleration solver** — fixed-step Euler simulation of 0-100 km/h and the quarter mile, including optional rotating inertia (per-gear when `I` values are set), shift torque cut, and launch clutch-slip `launchRpm`. Splits follow the display unit: 0-400 m / 0-160 in km/h mode, 60 ft / 0-60 mph / 1/4-mile trap speed in mph mode.
- **Highway cruising check** — required vs available wheel power and gear RPM at a chosen cruise speed.
- **Wheel-power envelope** — available (max over gears) vs required (road load) wheel power on a theme-aware kW axis, scaled to the wheel-power peak: the crossing marks the drag-limited speed, the secondary car's envelope runs dashed alongside on the same scale, and the hover tooltip reads the wheel power at the cursor speed.
- **Graph layer toggles & legend** — four toolbar pills (shift drops, aero wall, grip limit, power curve) bound to `state.graphLayers`, with the legend swatches and pill dots repainted from the live plot palette on every render (`graph-legend.ts`).
- **Hover tooltip** — free readout beside the crosshair: RPM per primary (and secondary) gear with over-rev flags, the wheel power at that speed, and the grip verdict (tire limit, per-wheel share, wheelspin).
- **Graph export** — PNG and SVG downloads rendered from the SVG plot; print stylesheet for PDF via the browser print dialog.
- **Sim & telemetry export** — one dropdown for Assetto Corsa `.ini`, drivetrain `.json`, BeamNG `.jbeam`, and tabular CSV for MoTeC / AiM Race Studio.
- **KPI strip** — 8 live cells: redline, top speed, aero wall, grip limit, wheel power, unit-aware 0-100/0-60 cell, quarter-mile/trap pair.
- **Brake bias & stopping distance** — ideal front/rear bias from deceleration load transfer with a rear-lock flag, plus `v²/2a` stopping distance with aero/grade correction (`brake-math.ts`).
- **Gear-drop recovery** — milliseconds to climb back to peak torque after each upshift from equivalent inertia (`recovery-math.ts`).
- **Tire size comparator** — stock vs plus-size diameters, speedometer error at 50/100/130 km/h, and gearing shift deltas, live-synced from primary/secondary state.
- **Tire compounds** — treadwear catalog (Eco 400TW → Slick) scaling road mu via grip gain.
- **Downforce integration** — aerodynamic downforce from lift coefficient and reference area, split front/rear, adds to vertical load for friction-limited grip.
- **Translation** — English and Italian, persisted. Uses `data-i18n` (text), `data-i18n-tip` (tooltip), `data-i18n-ph` (placeholder). All English copy lives in `dictionary.en.ts`, all Italian in `dictionary.it.ts`.
- **Setup troubleshooting wizard** — entry/mid/exit × understeer/oversteer/transfer/bottoming decision tree with ranked adjustments, severity badges and trade-off warnings.
- **Setup handbook** — offline feel-the-car cues (braking, mid-corner, exit, pyrometer reading) plus the 8-step systematic setup procedure, rendered from reusable `Card` components.
- **Android APK** — Capacitor wrapper; manual **Build APK** workflow assembles a debug APK artifact on demand.
- **Custom cars** — save/load complete setups (tire, FD, redline, gears, reverse, mass, Cd, area, power, torque curve anchors) to localStorage. Export/import JSON files.
- **Share via URL** — encodes all setup parameters into the URL hash (packed Base64URL `c` token with verbose fallback). One-click copy, plus an offline **QR code** modal for laptop-to-phone transfer.
- **Setup levels** — Easy / Medium / Full gating of setup inputs, persisted in localStorage; the comparison card follows the primary level and can be lowered independently.
- **PWA** — `manifest.webmanifest` with standalone display, maskable icons; service worker for offline asset caching.
- **Theme system** — three-way toggle: dark (default) → oled (pure black) → light (white). Persisted in localStorage. The SVG plot palette follows the theme through CSS tokens.
- **Mobile-first layout** — universal slide-over drawer (nav, units/language, export & data pipeline, display preferences, technical specs), 64px fixed header, 16/9 SVG cartesian plot with layer toggles and snapping crosshair HUD, horizontal-scroll tables with sticky first column, 44px touch targets, `visualViewport` keyboard-avoidance.
- **Touch-first setup controls** — tire geometry pills (width/aspect/rim), tactile final-drive and rev-limiter steppers with live circumference, diameter and 200 km/h aero drag readouts. The A/B comparison mirrors the same controls with amber accents, and the gear stack rows carry micro ±0.005 steppers with per-row overall-ratio readouts.
- **Breakdown table** — 11 columns including peak-torque traction excess (`wheel force − transferred grip`), per-gear WALL and OVERDRIVE flags plus ECO cruising advisories.
- **3-zone pyrometer calculator** — inner/middle/outer tread temperatures with camber and hot-pressure advisories (bar steps, clamped), inner-outer and center-edge spread readouts, and a cold/optimal/hot working-window verdict.
- **Tools** — cruising check, tire-size comparator, pyrometer, vehicle dynamics and the paddock setup guide.

## Physics engine

HAGURUMA uses strict SI discipline internally:

| Module | Key physics |
|---|---|
| `drive-force.ts`, `force-profile.ts` | Shared mapped force, self-consistent axle transfer, per-gear traction margin and force-based Vmax |
| `drivetrain-map.ts`, `powertrain-control.ts` | Bilinear loss map, limiter hysteresis and per-departing-gear interruption |
| `braking-simulation.ts` | Individual wheel budgets, combined service/engine braking, ABS cycling, sliding friction and stopping profiles |
| `lap-sequence.ts`, `corner-advisor.ts` | Downshift clutch impulse, rev-match blip, timed commands and apex gear advice |
| `tire-math.ts` | `205/55R16` parsing, loaded rolling circumference, centrifugal growth, load-sensitive dynamic radius |
| `engine-curve-core.ts` | Single source of truth for `engineTorqueAt` / `tractiveForceAt` / optimal shift; Akima interpolation over measured dyno nodes with linear fallback, dyno-tail taper |
| `traction-math.ts` | Engine torque from power anchors (`KW_TO_NM = 30000/π` ≈ 9549.3); linear torque interpolation below peak torque; tractive force `F = T × i × η / r_dyn`; optimal shift via force-curve crossing with backward scan |
| `dyno-csv.ts` | Dyno CSV parsing (header/header-less, `;`/`,`/tab, decimal comma, Nm/kgm, kW/cv/hp), resampling to 64 points, derived peak-torque/power anchors, Gaussian / Savitzky-Golay / median pre-filters |
| `speed-math.ts` | SI core `speedKmh` / `rpmFromKmh`; mph applied only at display boundary (`KMH_PER_MPH = 1.609344`) |
| `aero-math.ts` | Drag, rolling resistance, grade forces; drag-limited top-speed bisection; handles negative-grade power |
| `dynamics-math.ts` | Longitudinal & lateral load transfer (full per-axle lateral transfer, no 50% undercount); Kamm friction circle; differential torque bias; downforce from lift coefficients; proportional lateral force distribution (`Fy ∝ Fz`); coast/engine-braking force with coast-lock lockup scan; tire-compound grip gain (Eco 400TW → Slick) |
| `brake-math.ts` | Ideal front brake bias from deceleration load transfer with rear-lock flag; `v²/2a` stopping distance with aero/grade correction |
| `recovery-math.ts` | Gear-drop recovery time in ms from equivalent mass and residual wheel force |
| `shift-math.ts` | Kinematic landing RPM (`n_land = n_shift × i_next / i_curr`); direct ratio calculation eliminates conversion drift |
| `accel-math.ts` | Forward-Euler time-step solver for 0-100 and 1/4 mile; 60 ft / 0-60 mph / 0-160 splits plus trap speed and reaction offset; shift window; optional rotating mass and launch RPM |
| `inertia-math.ts` | Reflects engine/wheel moments of inertia through the current gear into an equivalent translational mass |
| `cruise-math.ts` | Highest gear with RPM ≥ floor, required/available wheel power, OK / high / over verdict |
| `pyrometer-math.ts` | 3-zone tread analysis: inner/outer and center/edge spreads, camber advice (±8 °C), pressure advice in 0.05 bar steps (0.30 bar cap, 1.0 bar hot floor), target ± 15 °C working window |

## Presets

| Preset | Tire | FD | Redline | Forward gears | Reverse | Power |
|:---|---|---|---|---|---|---|
| Mitsubishi Eclipse 1G GS (5-Speed) | `195/60R15` | `4.322` | `7000` | 3.363 / 1.947 / 1.285 / 0.939 / 0.756 | 3.083 | 110 kW |
| Mazda Miata NA (5-Speed) | `185/60R14` | `4.30` | `7200` | 3.136 / 1.888 / 1.330 / 1.000 / 0.814 | 3.758 | 85 kW |
| Honda S2000 AP1 (6-Speed) | `225/50R16` | `4.10` | `9000` | 3.133 / 2.045 / 1.481 / 1.161 / 0.971 / 0.811 | 2.800 | 177 kW |
| BMW M3 E46 (6-Speed) | `255/40R18` | `3.62` | `8000` | 4.23 / 2.53 / 1.67 / 1.23 / 1.00 / 0.83 | 3.75 | 252 kW |
| BMW M3 E36 3.2 (5-Speed) | `225/45R17` | `3.15` | `7600` | 4.23 / 2.53 / 1.67 / 1.23 / 1.00 | 3.68 | 236 kW |
| Volvo 240 Turbo (5-Speed) | `195/65R15` | `4.10` | `6000` | 3.67 / 2.17 / 1.37 / 1.00 / 0.79 | 3.55 | 114 kW |
| Toyota GR86 / BRZ (6-Speed) | `215/40R18` | `4.10` | `7500` | 3.626 / 2.188 / 1.541 / 1.213 / 1.000 / 0.767 | 3.438 | 168 kW |
| Porsche 911 GT3 991 (6-Speed) | `305/30R20` | `3.97` | `9000` | 3.75 / 2.38 / 1.72 / 1.34 / 1.11 / 0.96 | 3.42 | 349 kW |

The full catalog holds **26** factory/community vehicles under `src/config/cars/` (drop-in JSON; no registry edit). Labels follow a single convention — `<Model> (<N>-Speed[, <Type>], <FD> FD)` — so the gearbox and final drive are visible in the preset dropdown.

### Real-world anchor (Eclipse 1G GS)

5th gear tops out at **215–220 km/h at ~5,900–6,100 RPM** — past that point the 150 cv engine cannot beat air drag to reach the limiter. The app models this: the `AERO` line marks where required wheel power equals available power, and the 5th-gear row reads `drag-limited`.

## Run it

Prerequisites: Node.js 20+.

```bash
git clone https://github.com/camiu01/haguruma.git
cd haguruma
npm install
npm run dev      # vite dev server on :5173
```

Checks:

```bash
npx tsc --noEmit
npm test
npm run build   # tsc --noEmit; vite build
npm run preview
```

`vite.config.ts` uses `base: './'` — `dist/` works on any static host.

## Structure

```text
src/
  main.ts                        # bootstrap
  core/
    models.ts                    # shared types
    math/                        # tire, speed, aero, traction, shift, dynamics, accel, inertia, cruise,
                                 # brake, recovery, dyno-csv, engine-curve-core
    state/app-state.ts           # mutable singleton store
    state/engine-curve.ts        # active curve (anchors vs sanitized dyno points)
    units/unit-utils.ts          # kmh/mph + kW/cv helpers
    i18n/                        # dictionary.en.ts + dictionary.it.ts + language state
    setup/                       # wizard matrix + handbook copy (DictKey refs only)
    theme/theme.ts               # dark/oled/light toggle
    presets/custom-store.ts      # localStorage custom cars
    share/share-utils.ts         # verbose URL hash encode/decode
    share/share-compact.ts       # packed Base64URL full-state codec
    share/running-gear-share.ts  # rg_/crg_ block + numeric range table
    share/qr-svg.ts              # share-modal SVG QR (qrcode package, EC level L)
  config/                        # presets, glob catalog loader, cars/, diff-presets,
                                 # tire-compounds, drivetrain-eff, gear colors, graph constants
  services/
    dom/element-refs.ts          # typed DOM handles
    graph/                       # svg-frame geometry + projection, defs, axes, curves,
                                 # shift drops (+ snapPointFor), limits, power envelope,
                                 # prim mount, scene + renderer, crosshair + tooltip,
                                 # legend swatch sync, theme, export, drivetrain-export
    events/                      # one binder per control group
  components/                    # gear list, breakdown table, compare table, running-gear-block,
                                 # tire-size tool, custom car, cruise card, preset search
  components/card/               # base Card + accordion-shell recipe + one file per
                                 # specialized card + barrel
  templates/                     # static shell fragments injected by app-shell.ts
  views/render-all.ts            # single refresh entry
  styles/                        # main.css hub + tokens/base/drawer/components/controls/shell/
                                 # overrides/setup-guide/telemetry/print
capacitor.config.ts              # native wrapper (webDir dist)
android/                         # committed Capacitor scaffold
tests/                           # vitest suites mirroring src/
```

Conventions: tabs, single quotes, semicolons, TSDoc on every function, feature files <400 lines (shell/hub/dictionary exempt), functions <50 lines.

## Android APK

Actions tab → **Build APK** → Run workflow. The workflow typechecks, tests, builds the web app, syncs Capacitor and assembles `app-debug.apk` (JDK 17), uploaded as the `haguruma-debug-apk` artifact. Debug-signed for sideload testing only.

## License

Maintained by **Camiu** ([@camiu01](https://github.com/camiu01)). GPL-3.0-only — see [LICENSE](LICENSE).