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
- **Engine curve model** — peak torque RPM, peak torque Nm, peak power RPM with linear interpolation and over-rev droop. Derived `kW @ torque peak` readout via `P = T × n / 9550`.
- **Road-load physics** — for every gear peak, computes wheel power required to hold speed against weight, aero drag, rolling resistance, and grade. Flags gears the engine cannot pull as `drag-limited`.
- **Drag-limited top speed** — bisection solver finds where required wheel power equals available power; marked with an `AERO` line on the graph.
- **Tractive force analysis** — engine torque → wheel force in Newtons per gear (`F = T × i_total × η / r_dyn`).
- **Optimal shift advisor** — per-gear-pair shift RPM based on force-curve crossing; appends `LIMIT` when the rev limiter is the optimal point.
- **Translation** — English and Italian, persisted. Uses `data-i18n` (text), `data-i18n-tip` (tooltip), `data-i18n-ph` (placeholder).
- **Custom cars** — save/load complete setups (tire, FD, redline, gears, reverse, mass, Cd, area, power, torque curve anchors) to localStorage. Export/import JSON files.
- **Share via URL** — encodes all setup parameters into the URL hash. One-click copy, paste to share.
- **PWA** — `manifest.webmanifest` with standalone display, maskable icons; service worker for offline asset caching.
- **Theme system** — three-way toggle: dark (default) → oled (pure black) → light (white). Persisted in localStorage. Graph canvas palette follows the theme.
- **Mobile-first layout** — slide-over drawer (lang/unit/theme/presets), compact header, 16/9 graph canvas, horizontal-scroll tables with sticky first column, 44px touch targets, `visualViewport` keyboard-avoidance.

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
    math/                        # tire, speed, aero, traction, shift
    state/app-state.ts           # mutable singleton store
    units/unit-utils.ts          # kmh/mph helpers
    i18n/                        # en/it dictionaries + language state
    theme/theme.ts               # dark/oled/light toggle
    presets/custom-store.ts      # localStorage custom cars
    share/share-utils.ts         # URL hash encode/decode
  config/                        # presets, gear colors, graph constants
  services/
    dom/element-refs.ts          # typed DOM handles
    graph/                       # canvas setup, axes, curves, drops, renderer, tooltip, theme
    events/                      # one binder per control group
  components/                    # gear list editor, breakdown table, custom car manager
  views/render-all.ts            # single refresh entry
  styles/main.css                # theme overrides, cards, drawer, scrollbars, help-dot
tests/                           # vitest suites mirroring src/
```

Conventions: tabs, single quotes, semicolons, TSDoc on every function, files <400 lines, functions <50 lines.

## License

Maintained by **Camiu** ([@camiu01](https://github.com/camiu01)). GPL-3.0-only — see [LICENSE](LICENSE).