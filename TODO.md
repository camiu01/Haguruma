# TODO

Development task management for the Haguruma vehicle dynamics simulator.

## Done

- [x] Mobile hamburger menu + left slide-over drawer (lang/unit/theme/presets)
- [x] Slide-over drawer: focus trap, Escape/backdrop close, scroll lock, focus restore
- [x] Share trigger as icon-only in header on mobile + FAB
- [x] Header compact: brand nowrap, flex-nowrap, pill groups hide on mobile
- [x] 44–48px touch targets, stacked labels, 16px inputs (no iOS zoom)
- [x] HiDPI canvas (`devicePixelRatio` capped at 2)
- [x] `visualViewport` resize debounced + keyboard scroll-into-view
- [x] ResizeObserver canvas auto-redraw
- [x] Touch/pointer tooltip (tap-to-pin, dismiss on outside tap)
- [x] manifest.webmanifest with standalone display, 192/512 maskable icons
- [x] Service worker with offline-first app shell caching
- [x] BeforeInstallPrompt deferred (button removed from UI, SW kept)
- [x] Card system: border 1px, radius 12px, shadow 0 1px 3px, padding 16px
- [x] Light theme: page #F8FAFC, card #FFFFFF, border #E2E8F0, labels #64748B, outputs #0F172A
- [x] OLED theme: pure black backgrounds, brightness-filtered accents
- [x] Inter body + JetBrains Mono tabular-nums for numbers
- [x] Table horizontal scroll with sticky first column (primary + compare)
- [x] Secondary comparison collapsible card with full vehicle physics (mass, Cd, area, power, torque/power anchors)
- [x] Road Load card renamed "Resistenze", grouped under secondary physics
- [x] Gears extracted into own "Rapporti del cambio" card
- [x] Removed sticky from graph card
- [x] Removed Install button from all viewports
- [x] Italian i18n parity (dictionary keys EN=IT)
- [x] Light/OLED overrides for every Tailwind text/bg/border class
- [x] RunningGear chassis model: weight distribution, CoG height, wheelbase, track, road friction, drivetrain layout (FWD/RWD/AWD), differential (open/clutch LSD/Torsen/spool) + bias, spring rates, lateral g
- [x] Running-gear accordion UI with input sync, EN/IT i18n and preset application
- [x] `dynamics-math.ts`: longitudinal/lateral load transfer, per-wheel loads, Kamm friction circle, differential torque bias, downforce, friction-limited drive force, critical wheelspin speed (+ `tests/dynamics-math.test.ts`)
- [x] Grip-limit curve and wheelspin shading overlays on the graph (`graph-limits.ts`)
- [x] Gear table: wheelspin recovery speed column, min wheel-load column, standstill grip KPI
- [x] Optimal shift points via wheel thrust intersection with anti-false-positive scanning
- [x] Traction limit clamp from friction coefficient (Kamm circle + differential bias + wheelspin scan)
- [x] SI refactor: `speed-math` SI core (`speedKmh`/`rpmFromKmh`), mph applied only at display boundary; exact `KW_TO_NM = 30000/π`; linear torque interpolation below peak torque; kinematic landing RPM `n_land = n_shift × i_next / i_curr`
- [x] Drag-limited top-speed bisection robust on steep downhill (negative grade) road loads
- [x] Share URL encodes running gear (`rg_`/`crg_` keys); legacy hashes still decode
- [x] Every preset ships a validated `runningGear`; custom presets migrate to defaults
- [x] Debounced viewport/resize handling via `core/debounce.ts`
- [x] Event binder split: `running-gear-events`, `drawer-utils-events`, `comp-gear-grid`
- [x] Row/table hover uses theme `surface-input` token instead of `gauge`
- [x] Build script fails on type errors (`npx tsc --noEmit && npx vite build`)
- [x] README physics-engine module table (traction/speed/aero/dynamics/shift)

## Pending

### Simulation Engine

- [ ] Implement time-step numerical solver for 0-100 km/h and quarter mile #physics #simulation
- [ ] Add rotational inertia equivalent mass calculation based on gear reduction #physics
- [ ] Add shift time delay parameter with torque cut during gear changes #physics #simulation

### Powertrain

- [ ] Map default drivetrain efficiency to FWD/RWD/AWD layout selection (layout selector already done) #powertrain
- [ ] Support custom CSV import for dyno torque and power curves #engine #data

### Chassis & Grip

- [ ] Expose downforce inputs in running-gear UI: lift coefficient, reference area, front share (model fields already exist) #aero #physics
- [ ] Secondary comparison running-gear parameters (state + URL keys exist, no UI yet) #comparison

### Utility and Presets

- [ ] Implement highway cruising speed RPM and load checker #utility
- [ ] Expand presets database with verified factory vehicles #presets
- [ ] Implement chart export to PNG and SVG #export
- [ ] Add printable PDF summary generator #export
