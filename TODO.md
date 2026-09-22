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

## Pending

### Simulation Engine

- [ ] Implement time-step numerical solver for 0-100 km/h and quarter mile #physics #simulation
- [ ] Add rotational inertia equivalent mass calculation based on gear reduction #physics
- [ ] Add shift time delay parameter with torque cut during gear changes #physics #simulation
- [ ] Calculate optimal shift points using wheel thrust intersection #physics #algorithm

### Powertrain

- [ ] Add drivetrain layout efficiency selector for FWD RWD and AWD #powertrain
- [ ] Implement traction limit clamp based on friction coefficient #powertrain #physics
- [ ] Support custom CSV import for dyno torque and power curves #engine #data

### Utility and Presets

- [ ] Implement highway cruising speed RPM and load checker #utility
- [ ] Expand presets database with verified factory vehicles #presets
- [ ] Implement chart export to PNG and SVG #export
- [ ] Add printable PDF summary generator #export