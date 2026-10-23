# TODO

Open work for Haguruma. Completed work is recorded in [CHANGELOG.md](CHANGELOG.md); this file no longer duplicates it.

**How status is read.** `[ ]` means the item is not closed. An item is closed only when its behavior is implemented, covered by the automated checks in [docs/testing.md](docs/testing.md), and verified in the running application — or on hardware, for platform-specific items. Unchecked items are grouped below into work that does not exist yet and work whose code is present but not yet verified and released.

Version files currently carry **0.5.1**. No milestone below is released.

## Open work

### v1.0.0 milestone — Production release & engine stability

Focus on API stability, conformance tests against real datasheets, accessibility and the production release.

- [ ] Ground truth test suite on official datasheets: regression tests with <0.5% tolerance on gears and speeds computed at 1000 rpm / limiter for Miata NA6, S2000 AP1 and E46 M3 against factory data `#tests` `#physics`
- [ ] Share protocol immutability: rigid version prefix in the Base64URL payloads (`share-compact.ts`) and a golden URL test suite to guarantee full backward compatibility `#share` `#tests`
- [ ] Transparent custom-store migration: full rehearsal of the saved `localStorage` settings migration with a locked `1.0.0` schema version against future field changes `#data` `#pwa`
- [ ] WCAG AA accessibility & keyboard navigation audit: verify all sliders, tab order, ARIA roles and color contrast across Light, Dark and OLED themes `#a11y` `#ux`
- [ ] Canvas visual regression test: automatic graphical snapshots in the CI test run to prevent visual drift on axes, fonts and color scales `#tests` `#ci`
- [ ] Release pipeline & signed Android APK: GitHub Actions automation with verified ProGuard/R8 (`proguard-rules.pro`) to produce release-signed APKs downloadable as GitHub assets `#infra` `#android`
- [ ] Engineering documentation & handbook schema: repository page or section formally documenting every physics and kinematic formula used `#docs`
- [ ] Automated changelog and versioning: generate release notes from Conventional Commits and bump the version in `package.json` on release `#infra` `#docs`
- [ ] End-to-end smoke test in CI: run the built app through `vite preview` with a headless browser to catch bootstrap, boot and render regressions `#tests` `#ci`
- [ ] Content Security Policy and privacy statement: strict CSP meta/headers and an explicit no-telemetry, offline-only data statement `#security` `#docs`
- [ ] Release-to-store pipeline: publish the signed APK/AAB to a Play Store internal track alongside the GitHub release asset `#android` `#infra`
- [ ] Accessibility conformance report: publish a short WCAG AA conformance note covering the audited themes and controls `#a11y` `#docs`
- [ ] Cross-version data guarantees: document and test the supported schema range for shared URLs and the custom store across every released major `#data` `#share`

## Implemented, awaiting verification and release

The items below have code in the working tree, but they are not closed. Each milestone's verification gap is stated before its items. Closing a milestone means running the full check set and confirming the behavior in the running application.

### v0.6.0 milestone — Canvas interactivity & mobile refinement

Focus on visual responsiveness, touch ergonomics for portrait and landscape screens, and rendering polish.

*Verification gap:* the graph interactions and layout changes have been exercised in an embedded browser at mobile and desktop viewports, but there is no automated visual regression coverage, and the canvas changes are not asserted beyond their pure helpers.

- [ ] OffscreenCanvas migration: move the cached static bitmap in `graph-layers.ts` from a detached canvas element to a pure `OffscreenCanvas` (worker-ready), keeping a single `drawImage` per frame `#graph` `#perf`
- [ ] Sub-pixel alignment on HiDPI: force half-pixel offsets (`Math.floor(v) + 0.5`) on 1px axes and grids in `canvas-setup.ts` to remove blur and uneven stroke widths `#graph` `#hidpi`
- [ ] Magnetic crosshair snapping: auto-snap along the X axis to the nearest gear curve with a contextual readout (rpm, km/h, N) in `graph-tooltip.ts` `#graph` `#ux`
- [ ] Pinch-to-zoom and multi-touch pan: touch gestures (`PointerEvents`) on the canvas to zoom into speed windows and scroll the RPM range, with instant double-tap reset `#graph` `#mobile`
- [ ] Dynamic CSS palette sync: `graph-theme.ts` reads custom properties via `getComputedStyle(document.documentElement)` so theme switches propagate to the canvas instantly with no reload `#theme`
- [ ] Color-coded gear badges in `comp-gear-grid.ts`: visually align the comparison table with the colored dots of the primary grid via `gear-colors.ts` `#ux` `#theme`
- [ ] Compact mobile landscape layout: `@media (max-height: 500px) and (orientation: landscape)` in `shell.css` / `drawer.css` to shrink the drawers and expand the canvas full-viewport for in-cabin use `#mobile` `#ux`
- [ ] Per-gear gradient fill: translucent vertical fill fading to zero toward the X axis in `graph-curves.ts` to highlight the useful power band and the rpm drop `#graph` `#ux`
- [ ] Keyboard-accessible tooltip: arrow-key navigation along the active curve, a focusable readout and an `aria-live` region so the graph is usable without a pointer `#a11y` `#graph`
- [ ] Zoom/pan window in the share URL: encode the visible speed window (`z_` keys) next to the existing compact token so a zoomed view can be shared and restored `#share` `#graph`
- [ ] Axis auto-fit: recompute `maxGraphSpeed` from the tallest gear's redline speed plus a configurable margin instead of relying on the manual value alone `#graph` `#ux`
- [ ] First-paint theme flash guard: apply the stored theme and language before first paint to remove the flash of the default theme on cold start `#theme` `#perf`
- [ ] Reduced-motion graph mode: gate any animated crosshair, marker or curve transition behind `prefers-reduced-motion` `#a11y` `#graph`
- [ ] Export footer option: optional legend/metadata strip (units, preset name, date) burned into the PNG/SVG export in `graph-export.ts` `#export` `#graph`

### v0.7.0 milestone — Vehicle dynamics & tractive force engine

Focus on tire physics evolution, wheel tractive-force curves and the dynamic vertical-load model.

*Verification gap:* the force view, limiter model, braking profiles, rev-match handling, AWD split and LSD preload have automated coverage in the release suites, but the interactive force view and the lap-style sequence have not been through a full visual and end-to-end pass, and the lap driver model is explicitly uncalibrated.

- [ ] Switchable tractive force graph view: commutable wheel-force mode ($F_x$ in N vs km/h) with per-gear curves and the total resistance parabola overlaid ($F_{\text{drag}} + F_{rr}$) for a visual Vmax `#graph` `#physics`
- [ ] Live load transfer inside the accel solver: feed the instantaneous acceleration back into `maxDriveForceAtSpeed` so grip and wheelspin respond to the real transfer `#physics` `#simulation`
- [ ] Rev-limiter and fuel-cut model: bounce/hard-cut behavior at the limiter plus per-gear shift time (synchro vs dog box) instead of one global value `#physics` `#simulation`
- [ ] Braking model with wheel lock and ABS: deceleration profile from mu, load transfer and optional ABS cycling, with a 100-0 km/h stopping-distance KPI `#physics` `#dynamics`
- [ ] Downshift and rev-match simulation: engine-braking deceleration and the rev-match blip so the solver can model a full lap-style sequence `#physics` `#simulation`
- [ ] Traction margin readout: per-gear excess of wheel force over grip ($F_x - F_{\text{limit}}$) as a table column and optional graph overlay `#physics` `#ux`
- [ ] Torque-vectoring and active center differential: variable AWD front/rear bias beyond the fixed split (DCCD/ACD style) with handbrake-disengage behavior on turn-in `#physics` `#dynamics`
- [ ] LSD clutch preload and breakaway torque: static preload parameter (Nm before plate slip) for mechanical clutch LSDs (KAAZ, Cusco, OS Giken) `#physics` `#dynamics`
- [ ] Apex speed to shift advisor: corner radius plus max lateral G give cornering speed and recommend holding the gear vs downshifting to avoid shifts mid-corner `#physics` `#simulation`

### v0.8.0 milestone — Telemetry, multi-sim & heuristic solver

Focus on real-world data acquisition, advanced sim-racing compatibility and heuristic gear-ratio sizing.

*Verification gap:* the telemetry parser, optimizer, GPX import, quick-add wizard and backup bundle have automated coverage. The vendor CSV shapes have not been verified against MoTeC or AiM tooling, the GPS timer and session recorder have not been exercised on a device, and the gear search is a constrained discrete search rather than a proven optimum.

- [ ] Reverse gear-ratio calculator from telemetry logs: parser for MoTeC, AiM, RaceChrono and OBD2 CSV (`engine_rpm`, `wheel_speed_kmh`) to recover the real ratios and detect clutch/tire slip `#telemetry` `#data`
- [ ] Gearset optimizer / heuristic solver: search engine (brute force over a discrete catalog or simulated annealing) to generate the optimal gear spacing constrained by straight-line Vmax and the maximum allowed drop `#physics` `#heuristic`
- [ ] Target-track gear-ratio presets: profiles for track archetypes (tight hairpins / fast straights) to calibrate 2nd and 3rd gear outside the torque dead spots `#physics` `#heuristic`
- [ ] Keep-screen-awake toggle: integrate `@capacitor/keep-awake` / `navigator.wakeLock` configurable from the UI for continuous track-side use on a mount `#android` `#ux`
- [ ] Inverse dyno from an acceleration log: derive the torque curve from a logged v(t) run plus known mass and gearing, then load it as a custom curve `#telemetry` `#engine`
- [ ] Phone-sensor performance timer: use device motion/GPS to measure 0-100 km/h and 1/4 mile and compare against the solver prediction `#telemetry` `#android`
- [ ] Session recorder and export: log runs locally and export them as CSV/JSON for MoTeC / AiM tooling `#telemetry` `#export`
- [ ] GPX track import: read a GPX file to seed the target-track gear presets with real corner and straight lengths `#telemetry` `#heuristic`
- [ ] Spec-sheet quick-add wizard: build a new preset from a few datasheet numbers (power, mass, tire, gears) with range validation `#presets` `#ux`
- [ ] Full-state backup bundle: export/import every persisted value (custom cars, units, theme, language) as a single JSON file `#data` `#pwa`
- [ ] Bulk preset import/export: one-click JSON/ZIP backup and restore of all browser-saved custom cars for device migration (preset-scoped companion to the full-state bundle) `#data` `#pwa`

### v0.9.0 milestone — Diagnostic wizard & hardware integration

Focus on expanding setup guidance, smartphone hardware integration and formal data robustness.

*Verification gap:* the pyrometer, conflict checker, haptics, safe-area work, property-based tests and bundle analyzer are implemented, with the sensitivity analyzer, catalog lint and matrix completeness test already covered by automated checks. The native features have not been verified on hardware, and the additional-language dictionaries have type-checked parity but have not been reviewed by a native speaker.

- [ ] Interactive tire pyrometer analyzer: input UI for tread temperatures (inner/center/outer on all 4 wheels) with camber, pressure and drift-instability diagnosis `#setup` `#dynamics`
- [ ] Setup conflict detector: detection of contradictory adjustments inside the setup matrix (e.g. stiffer rear ARB combined with softer springs) `#setup` `#dynamics`
- [ ] Android haptic feedback: subtle haptics via `@capacitor/haptics` while scrubbing the shift-rpm cursor and when saving custom vehicles `#android` `#ux`
- [ ] Edge-to-edge layout & safe areas: refine `env(safe-area-inset-*)` in `shell.css` for modern displays with notches and hidden system bars `#android` `#ux`
- [ ] Property-based testing with `fast-check`: automated math tests on `speed-math.ts` and `traction-math.ts` to validate monotonicity and prevent `NaN` or `Infinity` `#tests`
- [ ] Bundle size & visualizer analyzer: add `rollup-plugin-visualizer` to the Vite pipeline to monitor the PWA weight impact `#ci` `#perf`
- [ ] Extra languages with parity gate: add German / Spanish / French dictionaries and extend the EN/IT parity test to every locale `#i18n` `#tests`
