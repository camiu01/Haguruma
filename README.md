# HAGURUMA

**Heuristic Application for Gear-ratio, Up-shift, & Redline Unit Mapping Architecture**

A client-side TypeScript SPA that plots engine RPM against vehicle speed for every gear, computes redline shift drops, estimates road-load physics (mass + aero drag + rolling resistance), and prescribes optimal shift points via tractive-force analysis.

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4.5-blue.svg)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5.2.0-purple.svg)](https://vitejs.dev/)
[![Vitest](https://img.shields.io/badge/Vitest-1.6.0-green.svg)](https://vitest.dev/)
[![PWA](https://img.shields.io/badge/PWA-ready-purple.svg)](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)

## Features

- **RPM-vs-speed curves** — one per forward gear up to the rev limiter, with shift-drop connectors showing RPM landing in the next gear.
- **Reverse gear** — dashed gray `R` curve.
- **Tire parsing** — `205/55R16` → rolling circumference with instant validation.
- **Comparison overlay** — full secondary vehicle setup (tire, FD, gears, redline, mass, Cd, frontal area, power, torque/power anchors) as dashed curves with delta readout.
- **Engine curve model** — peak torque RPM, peak torque Nm, peak power RPM with linear **torque interpolation** below peak torque (smooth real-world profile) and linear power interpolation above. Derived `kW @ torque peak` readout via `P = T × n × π / 30000`.
- **Road-load physics** — for every gear peak, computes wheel power required to hold speed against weight, aero drag, rolling resistance, and grade. Flags gears the engine cannot pull as `drag-limited`.
- **Drag-limited top speed** — bisection solver finds where required wheel power equals available power; marked with an `AERO` line on the graph. Handles steep downhill grades robustly.
- **Tractive force analysis** — engine torque → wheel force in Newtons per gear (`F = T × i_total × η / r_dyn`).
- **Optimal shift advisor** — per-gear-pair shift RPM based on force-curve crossing with anti-false-positive scanning (immune to turbo-lag oscillations at low RPM); appends `LIMIT` when the rev limiter is the optimal point.
- **Load transfer & grip model** — lateral load transfer per axle (full inner→outer transfer), Kamm friction circle, differential torque bias (open/clutch LSD/Torsen/spool), wheelspin detection, and proportional lateral force distribution based on instantaneous wheel load.
- **Downforce integration** — aerodynamic downforce from lift coefficient and reference area, split front/rear, adds to vertical load for friction-limited grip.
- **Translation** — English and Italian, persisted. Uses `data-i18n` (text), `data-i18n-tip` (tooltip), `data-i18n-ph` (placeholder). All English copy lives in `dictionary.en.ts`, all Italian in `dictionary.it.ts`.
- **Setup troubleshooting wizard** — entry/mid/exit × understeer/oversteer/transfer/bottoming decision tree with ranked adjustments, severity badges and trade-off warnings.
- **Setup handbook** — offline feel-the-car cues (braking, mid-corner, exit, pyrometer reading) plus the 8-step systematic setup procedure, rendered from reusable `Card` components.
- **Android APK** — Capacitor wrapper; manual **Build APK** workflow assembles a debug APK artifact on demand.
- **Custom cars** — save/load complete setups (tire, FD, redline, gears, reverse, mass, Cd, area, power, torque curve anchors) to localStorage. Export/import JSON files.
- **Share via URL** — encodes all setup parameters into the URL hash. One-click copy, paste to share.
- **PWA** — `manifest.webmanifest` with standalone display, maskable icons; service worker for offline asset caching.
- **Theme system** — three-way toggle: dark (default) → oled (pure black) → light (white). Persisted in localStorage. Graph canvas palette follows the theme.
- **Mobile-first layout** — slide-over drawer (lang/unit/presets/settings), compact header, 16/9 graph canvas, horizontal-scroll tables with sticky first column, 44px touch targets, `visualViewport` keyboard-avoidance.

## Physics engine

HAGURUMA uses strict SI discipline internally:

| Module | Key physics |
|---|---|
| `traction-math.ts` | Engine torque from power anchors (`KW_TO_NM = 30000/π` ≈ 9549.3); linear torque interpolation below peak torque; tractive force `F = T × i × η / r_dyn`; optimal shift via force-curve crossing with backward scan |
| `speed-math.ts` | SI core `speedKmh` / `rpmFromKmh`; mph applied only at display boundary (`KMH_PER_MPH = 1.609344`) |
| `aero-math.ts` | Drag, rolling resistance, grade forces; drag-limited top-speed bisection; handles negative-grade power |
| `dynamics-math.ts` | Longitudinal & lateral load transfer (full per-axle lateral transfer, no 50% undercount); Kamm friction circle; differential torque bias; downforce from lift coefficients; proportional lateral force distribution (`Fy ∝ Fz`) |
| `shift-math.ts` | Kinematic landing RPM (`n_land = n_shift × i_next / i_curr`); direct ratio calculation eliminates conversion drift |

## Presets

| Preset | Tire | FD | Redline | Forward gears | Reverse | Power |
|:---|---|---|---|---|---|---|
| Mitsubishi Eclipse 1G GS (5MT) | `195/60R15` | `4.322` | `7000` | 3.363 / 1.947 / 1.285 / 0.939 / 0.756 | 3.083 | 110 kW |
| Mazda Miata NA (5MT) | `185/60R14` | `4.30` | `7200` | 3.136 / 1.888 / 1.330 / 1.000 / 0.814 | 3.758 | 85 kW |
| Honda S2000 AP1 (6MT) | `225/50R16` | `4.10` | `9000` | 3.133 / 2.045 / 1.481 / 1.161 / 0.971 / 0.811 | 2.800 | 177 kW |
| BMW M3 E46 (6MT) | `255/40R18` | `3.62` | `8000` | 4.23 / 2.53 / 1.67 / 1.23 / 1.00 / 0.83 | 3.75 | 252 kW |
| Toyota GR86 / BRZ (6MT) | `215/40R18` | `4.10` | `7500` | 3.626 / 2.188 / 1.541 / 1.213 / 1.000 / 0.767 | 3.438 | 168 kW |
| Porsche 911 GT3 991 (6MT) | `305/30R20` | `3.97` | `9000` | 3.75 / 2.38 / 1.72 / 1.34 / 1.11 / 0.96 | 3.42 | 349 kW |

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
    math/                        # tire, speed, aero, traction, shift, dynamics
    state/app-state.ts           # mutable singleton store
    units/unit-utils.ts          # kmh/mph helpers
    i18n/                        # dictionary.en.ts + dictionary.it.ts + language state
    setup/                       # wizard matrix + handbook copy (DictKey refs only)
    theme/theme.ts               # dark/oled/light toggle
    presets/custom-store.ts      # localStorage custom cars
    share/share-utils.ts         # URL hash encode/decode
  config/                        # presets, glob catalog loader, cars/, gear colors, graph constants
  services/
    dom/element-refs.ts          # typed DOM handles
    graph/                       # canvas setup, axes, curves, drops, renderer, tooltip, theme
    events/                      # one binder per control group
  components/                    # gear list editor, breakdown table, custom car manager
  components/card/               # base Card + one file per specialized card + barrel
  views/render-all.ts            # single refresh entry
  styles/                        # main.css hub + tokens/base/drawer/components/shell/overrides/setup-guide
capacitor.config.ts              # native wrapper (webDir dist)
android/                         # committed Capacitor scaffold
tests/                           # vitest suites mirroring src/
```

Conventions: tabs, single quotes, semicolons, TSDoc on every function, feature files <400 lines (shell/hub/dictionary exempt), functions <50 lines.

## Android APK

Actions tab → **Build APK** → Run workflow. The workflow typechecks, tests, builds the web app, syncs Capacitor and assembles `app-debug.apk` (JDK 17), uploaded as the `haguruma-debug-apk` artifact. Debug-signed for sideload testing only.

## License

Maintained by **Camiu** ([@camiu01](https://github.com/camiu01)). GPL-3.0-only — see [LICENSE](LICENSE).