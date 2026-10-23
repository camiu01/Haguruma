# HAGURUMA — User Guide

HAGURUMA plots engine RPM against vehicle speed for every gear, computes the RPM you land on after each upshift, estimates road-load physics (mass, aero drag, rolling resistance, grade), and suggests shift points from tractive-force analysis.

It is a single-page app with no backend. Everything you enter stays in your browser (localStorage) unless you deliberately share a link or export a file.

**Every number the app shows is an estimate produced by the model documented in [`../MATH.md`](../MATH.md).** It is not measured data, not a certification and not a safety guarantee. Section [What the numbers do not tell you](#11-what-the-numbers-do-not-tell-you) lists the specific gaps.

Related: [`../MATH.md`](../MATH.md) (formulas, assumptions), [`./data-formats.md`](./data-formats.md) (file formats), [`./presets.md`](./presets.md) (vehicle catalog), [`./architecture.md`](./architecture.md) (code layout), [`./testing.md`](./testing.md), [`./deployment.md`](./deployment.md), [`./troubleshooting.md`](./troubleshooting.md).

---

## 1. Getting a vehicle in

### Load a preset

In the `Main Setup` card, use the vehicle selector (placeholder `Load Preset Vehicle...`). It is a searchable combobox: typing filters the visible labels (case- and accent-insensitively), options are grouped under `Factory` and `Community`, and `No cars found` appears when nothing matches. The catalog ships 26 vehicles — see [`./presets.md`](./presets.md).

Loading a preset replaces the whole primary setup (tire, final drive, redline, gears, reverse, mass, Cd, area, power, torque/power anchors, rotating mass, shift time, running gear, drivetrain efficiency) and clears any imported dyno curve.

### Add a custom car

`Manage my cars` (in `My Cars`) opens the garage modal. Fill the form and press `Save car`; the modal shows `No saved cars yet.` while empty and `Check the highlighted fields.` when validation fails.

| Field | Accepted |
|:--|:--|
| `Car name` | Required, non-empty |
| `Tire Spec (e.g. 205/55R16)` | Must parse, e.g. `225/45R17` |
| `Final Drive (Differential)` | Positive number |
| `Redline RPM` | Positive, at least 1000 |
| `Reverse (optional)` | Empty, or positive |
| `Gears (comma separated)` | Comma, space or semicolon separated positive ratios |
| `Vehicle Mass (kg)` | Positive number |
| `Drag Coefficient Cd` | Positive number |
| `Frontal Area (m²)` | Positive number |
| `Engine Power` | Positive, in the active power unit (kW or cv) |
| `Peak Torque RPM`, `Peak Torque (Nm)`, `Peak Power RPM` | Positive numbers |
| `Rotating mass (kg, optional)` | Empty or ≥ 0 |
| `Shift time (s, optional)` | Empty or 0–3 |

There is no decreasing-order or count check on save: anything the gear list accepts is stored. Invalid fields get a red border and nothing is written.

Saved cars live under the localStorage key `haguruma-custom-presets` and appear in the vehicle dropdown. Each saved row offers `Load` (into primary), `2nd` (into the secondary comparison), `Export` (downloads `<name>.json` with the full preset) and `Delete`. `Save car` also loads the entry into the active slot. The same modal offers `Import JSON`: one preset object or a name-keyed map. Invalid entries are skipped silently and valid ones are saved one by one; malformed JSON is only logged to the browser console and nothing is written. There is no size cap and no confirmation dialog — an incoming name overwrites the saved car of the same name.

### Quick-add from a spec sheet

`Tools` → `Spec-Sheet Quick Add` builds a preset without touching the active setup. Fill `Vehicle Name`, `Crank Power (kW)`, `Mass (kg)`, `Tire Spec (e.g. 205/55R16)`, `Forward Gear Ratios (comma-separated)`, `Final Drive (Differential)` and `Redline RPM`, then `Save to My Cars`. Validation requires a non-empty name, positive power, mass and final drive, redline ≥ 1000, a parsable tire, and at least 2 strictly decreasing ratios; failures show `Check the highlighted fields.` and success shows `Car saved to My Cars.`. The saved preset carries only those seven fields — torque anchors, Cd, frontal area and running gear are not set by the wizard.

### Final-drive variants and aftermarket drivetrain options

Two selects appear under `Final Drive (Differential)` only when the loaded preset provides the data: **final-drive variants** (`FD <x> : 1`, stock marked `(stock)`) and **aftermarket options** (`Stock setup`, `FD <x> : 1` entries, named close-ratio gearsets, catalog LSDs). Selecting one changes only that part and leaves the rest of the preset intact.

---

## 2. Primary setup inputs

### `Main Setup`

The tire block is three segmented numeric inputs — width (100–400), aspect (20–90 %) and rim (10–30) — not a free-text field. The row shows a validity dot and a geometry pill with the computed circumference and diameter in millimetres (`Circ: <n> mm`). A valid entry shows a green dot; an invalid entry shows a red dot plus `Invalid format (e.g. 225/45R17)` under the block. Invalid entries are ignored and the previous value is kept.

| Control | Accepted | Behaviour |
|:--|:--|:--|
| `Final Drive (Differential)` | > 0 | Applied live |
| `Rev limiter` | > 1000 | Applied live |
| `Graph Max Speed` | > 50, in the active speed unit | Right edge of the X axis; the zoom/pan window is kept and clamped into the new axis |

A field that silently does nothing is usually one of these guards, not a frozen UI.

### `Transmission Gears`

Each row is `Gear <n>` with a colour swatch and the overall ratio (`ratio × final drive`); rows have micro-stepper buttons and a remove button. Ratios apply live. The dashed `Rev R` row takes an optional reverse ratio; clearing it removes the reverse curve and table row. `Add Gear` appends 0.82× the previous ratio (minimum 0.5). At 8 forward gears the button disables and its tooltip reads `8 gear limit reached — remove one to add another`.

### `Engine Curve`

`Peak Torque RPM` (1000–12000), `Peak Torque (Nm)` (> 0), `Peak Power RPM` (1000–12000); `Power @ Torque Peak` is read-only.

`Import dyno CSV` accepts an optional header row (`rpm` / torque / power in any column order, English or Italian labels, Nm or kgm torque, kW or cv/hp/ps power) or header-less `rpm,torqueNm[,powerKw]` rows. Comma, semicolon and tab delimiters work; a decimal comma is accepted only with the semicolon delimiter; power-only files need a header row. Points are sanitized (RPM 500–15000, torque 5–5000 Nm) and resampled to 64 points. `Smooth raw dyno` applies a Gaussian pre-filter to raw roller data. Success shows `Dyno curve active: <n> points`, failure `Invalid CSV: need rows with rpm + torque Nm (or power kW/cv).` While a measured curve is active the three anchor inputs are disabled and `Back to anchors` appears; the import also overwrites `Engine Power` and the three anchors from the measured peaks. Full formats: [`./data-formats.md`](./data-formats.md).

### `Road Load (Secondary Physics)`

The header checkbox turns the road-load estimate on and off; when off, the fields dim and `Pwr Req` and `Aero Wall` show placeholders.

| Control | Accepted |
|:--|:--|
| `Vehicle Mass (kg)` | Positive (model range 500–3000) |
| `Drag Coefficient Cd` | Positive (model range 0.15–0.60) |
| `Frontal Area (m²)` | Positive (model range 1–4) |
| `Rolling Coeff Crr` | Positive (model range 0.005–0.030) |
| `Engine Power` | Positive in the active power unit; wheel power = power × efficiency |
| `Drivetrain Eff (0-1)` | Above 0 and at most 1; set by the drivetrain layout |
| `Road Grade (%)` | Any finite number, clamped to ±30; positive is uphill |
| `Tire Load Factor` | Any finite number, clamped to 0.90–1.00 (default 0.975) |
| `Rotating Mass (kg)` | ≥ 0, model range 0–500 |
| `Shift Time (s)` | ≥ 0, model range 0–3; torque cut per upshift in the acceleration solver |

### `Running Gear`

| Control | Values | Notes |
|:--|:--|:--|
| `Drivetrain layout` | `FWD` / `RWD` / `AWD` | Also sets `Drivetrain Eff`: FWD 0.90, RWD 0.85, AWD 0.80 |
| `Differential` | `Open`, `LSD 1-Way`, `LSD 1.5-Way`, `LSD 2-Way`, `LSD Custom`, `OS Giken Super Lock`, `Cusco MZ`, `KAAZ 2-Way`, `Torsen`, `Wavetrac ATB`, `Quaife ATB`, `Spool` | Selecting a model writes its accel/coast lock |
| `Tire compound` | `Eco 400TW`, `Touring 300TW`, `Sport 200TW`, `Semislick 100TW`, `Slick` | Scales road friction by a grip gain of 0.92 / 1.00 / 1.08 / 1.15 / 1.22 |
| `Accel lock`, `Coast lock` | 0–100 % | Active only for clutch-LSD catalog models; dimmed otherwise. Setting accel lock also stores the `lsd_custom` model |
| `Front weight` | 40–70 % | |
| `CoG height` | 300–700 mm | |
| `Wheelbase` | 2200–3300 mm | |
| `Track width` | 1300–1800 mm | |
| `Front spring`, `Rear spring` | 10–120 N/mm | |
| `Sustained lateral G` | Slider 0–1.30 G, step 0.05 | Your input, not solved from a corner |
| `Downforce CL` | 0–4 | Lift coefficient |
| `Downforce area (m²)` | 0.5–5 | |
| `Downforce front share` | 20–80 % | |
| `LSD preload` | 0–500 Nm at the axle | Clutch-LSD models only |
| `AWD front torque`, `Adaptive center coupling`, `Torque vectoring` | 0–100 % | AWD layouts only |
| `Center release on handbrake`, `Handbrake turn-in` | Checkboxes | AWD layouts only |

Two live readouts sit at the bottom: `Downforce @ 200 km/h` and `Coast lock-up` — the lowest lock-up speed across gears, shown with the gear it locks in (the first speed where closed-throttle engine braking exceeds the coast-lock grip of the driven axle).

**Road friction has no input in the UI.** `roadFrictionCoefficient` comes from the loaded preset or a share link and is then multiplied by the selected tire compound's grip gain.

---

## 3. `Enable Secondary Comparison`

Tick `Enable Secondary Comparison` to show a second vehicle as dotted curves; until then the fields are dimmed and the `Compare` legend entry is hidden.

The card mirrors the primary one: `Secondary Tire`, `Secondary Final Drive`, `Secondary Gears (comma separated)` (per-gear cells), `Secondary Redline RPM`, plus its own `Road Load (Secondary Physics)`, `Engine Curve` and `Running Gear (Secondary)` accordions with the same fields. `Start from primary setup` copies tire, final drive, gears, redline, mass, Cd, area, power, anchors and running gear into the secondary slot; `Load preset into compare...` loads a catalog or saved car there instead. `Δ vs primary` reports the tire circumference difference (`Circ: <n>mm (+x.x%)`); `Shift deltas Δn / Δv` lists per-gear shift-point differences. Invalid gears show `Check secondary gears (e.g. 3.58, 2.05, 1.38).` and are not applied.

The comparison also draws its own redline marker, its own dashed aero-wall label and its own grip curve. The KPI strip's acceleration cells stay primary-only.

---

## 4. Reading the results

### KPI strip

Always visible, recomputed on every render, never left at static defaults.

| Cell | Meaning |
|:---|:---|
| `Redline` | Configured rev limiter (RPM) |
| `Top Speed` | Top gear at the redline, in the active speed unit |
| `Aero Wall` | Speed where required wheel power equals available wheel power; `—` when road load is off |
| `Grip Limit` | Standstill friction-limited drive force, in newtons |
| Acceleration cells | km/h mode: `0-100 km/h`, `0-160 km/h`, `0-400 m`, `Trap`. mph mode: `60 ft`, `0-60 mph`, `1/4 mile`, `Trap`. The quarter-mile cell swaps its label between `1/4 mile` and `0-400 m` |
| `Wheel Power` | Available wheel power |

### `Gear Breakdown & Shift Drop at Redline`

Subtitle `Calculated Theoretical Peak`. One row per forward gear, plus a `Rev R` row when a reverse ratio is set.

| Column | Meaning |
|:---|:---|
| `Gear` | Colour-coded gear number |
| `Ratio` / `Overall` | Gear ratio, and gear ratio × final drive, both `: 1` |
| `Top Speed` | Speed at the redline in this gear, in the active unit |
| `Next Gear RPM` / `RPM Drop` | Engine speed after an upshift at the redline, and the RPM lost |
| `Pwr Req` | Required wheel power at this gear's peak; a `· drag-limited` suffix appears when it exceeds available wheel power |
| `Torque (Nm)` / `Traction (N)` | Engine torque and wheel force at the torque peak |
| `Excess` | Traction margin: wheel force minus grip at the torque peak, yellow and `+`-signed when the tire budget is exceeded |
| `Opt Shift` | Suggested shift RPM; `LIMIT` means the optimal point is the rev limiter |

With the comparison enabled, `Secondary (dashed)` adds `Gear`, `Ratio`, `Top Speed`, `Δ vs primary` and `Pwr Req`.

### Verdicts and markers

- `LIMIT` — shift at the redline, because the limiter is the optimal point for that gear pair.
- `· drag-limited` — the engine cannot reach that gear's redline speed against road load.
- `AERO WALL` / `Compare AERO WALL` lines — where required wheel power equals available power; the area right of them is shaded.
- `GRIP` curve — friction-limited drive force; shaded bands are speeds where engine force exceeds grip.
- `Coast lock-up` — the speed where engine braking overwhelms the coast-side differential lock.
- Tooltips flag over-rev values with `(OVER)`.

---

## 5. Graph

Title: `Engine RPM vs Vehicle Speed`.

**View modes.** The `Graph` select switches between `Engine RPM` (RPM on Y, one curve per forward gear, dashed `R` for reverse, red connectors for shift drops), `Wheel Force` (newtons on a self-scaling Y axis, plus total road resistance and the dashed grip curve) and `Braking` (distance on X, display speed on the left Y axis, deceleration in m/s² on the right). The traction-excess overlay toggle exists only in the force view. The map controls (zoom, fit) and the layer pills live in the RPM view only: in the force view only the grip pill stays, in the braking view the pills hide.

**Navigation.** Four icon buttons sit stacked in the top-right corner *inside* the canvas, in this order: fullscreen (corner brackets), fit (house), zoom in, zoom out. Every one of them carries a tooltip instead of a label.

| Action | Control |
|:--|:--|
| Zoom in / out | The magnifier icons in the in-canvas stack, the mouse wheel, or `+` / `-` with the plot focused (RPM view only) |
| Pan | Drag on the canvas with touch, pen or mouse (RPM view only) |
| Reset | The fit (house) icon, or `Home` / `0` with the plot focused; at full view it is a no-op |
| Fullscreen | The corner-bracket icon in the in-canvas stack, which toggles a fullscreen overlay |
| Keyboard | Left / right arrows step the crosshair between shift points; `Escape` clears the crosshair |

There is no separate reset button: the fit action covers it.

**Readout.** Hovering or tapping shows a tooltip with the speed and RPM, every reachable gear's RPM at that speed, the secondary vehicle's gears when enabled, wheel power at the cursor and a grip line (`Grip` or `Wheelspin`). A crosshair snaps to the nearest curve (auto-snap switch in the drawer) and a free tooltip follows the cursor. An `aria-live` output below the graph announces the same information as text, including when no gear reaches that speed below the limiter. The canvas is focusable, has `role="img"` and is described by the help text and the readout.

**Fullscreen and export.** The fullscreen icon in the in-canvas stack toggles a fullscreen overlay. Export controls sit in the graph header, grouped by what they produce: `Graph` for the plot itself and `Drivetrain` for the gear data.

| Control | Output |
|:--|:--|
| `PNG` | Raster export at twice the viewBox size |
| `SVG` | Vector export (crosshair stripped, standalone namespace) |
| `Print / PDF` | Browser print dialog; a print stylesheet produces the summary |
| Format select + `Export` | `INI` (Assetto Corsa `drivetrain.ini`), `JSON`, `JBeam` (BeamNG transmission), `MoTeC` CSV, `AiM` Race Studio CSV |
| `Import INI` | Reads an Assetto Corsa file back into the primary setup with the drivetrain export controls, replacing gears, final drive and reverse, and reports `Imported <n> gears from INI` or `Could not parse drivetrain.ini` |

---

## 6. Vehicle dynamics card

The Dynamics card holds the v0.7 simulation settings, three auto-computed readouts and the lap-sequence input. Everything re-renders live; there are no calculate buttons.

**Settings.** Rev limiter (`hard` fuel cut or `bounce` with 150 rpm hysteresis), gearbox (`synchro` 0.30 s or `dog` 0.08 s defaults, optional per-gear `shiftTimesS` list with at most 8 values of 0–3 s), torque/load efficiency-map toggle, ABS toggle, front brake share (0–1), brake demand in g (0–3), downshift rev matching, corner radius (1–1000 m), maximum lateral g (0.05–3), approach gear (1–8) and sequence start speed (0–500 km/h). Non-default values travel in the share URL as `d_*` sidecars.

**Readouts.** `100–0 km/h` and `200–0 km/h` stopping distance and time from the live chassis and brake settings (locked-wheel counts appended when a lock is predicted), plus apex speed with a pre-corner gear recommendation (`Downshift`/`Upshift`/`Hold gear`).

**Lap sequence.** A textarea of four comma-separated values per line — `duration_s,gear,throttle,brake_g` — up to 32 rows and 4000 characters, at most 60 s per phase and 60 s summed. An unsafe downshift (wheel-implied RPM past the redline) or any malformed line shows `Invalid sequence or unsafe downshift (over-rev).` A valid run reports final time, distance and speed with the rev-match blip and any coast lock-up. Rev matching is a global toggle applied to every command, not a per-row flag.

---

## 7. Tools

The `Tools` card holds cruise and tire-size accordions followed by one collapsible card per tool. Nothing here mutates the setup silently — results are readouts, and only the labeled apply buttons write back.

**`Highway Cruising Check`** — `Cruise speed` (defaults to 130 when empty or invalid) reports the chosen gear, RPM, `Engine load` percentage, required vs available wheel power (`<required> / <available>`) and a verdict: `OK`, `High RPM` or `Power deficit`.

**`Tire size check`** — `Stock size` vs `New size` (both track the primary and secondary tires). Shows diameter, sidewall and circumference in millimetres, a size bar, a verdict pill (`Good match` at |Δ| ≤ 1.5 %, `Near limit (±3%)` up to 3 %, `Out of range` beyond), the speedometer error at 50 / 100 / 130 as `indicated→actual`, and `Gearing change` with `shorter` or `longer`. Invalid input shows `Invalid tire format`.

**`Wheel channel & fitment`** — tire size plus rim channel. Shows the ideal channel, the accepted rim window, the tire window for the entered rim, the rim/tire ratio, and a balloon-to-stretch verdict pill with advice. Invalid input shows `Invalid tire or rim`.

**`Telemetry gear check`** — paste telemetry CSV rows (rpm + speed columns, optional time column) and a speed trace (`time,speed` rows) with the pull gear. Reports each recovered gear (ratio, sample count, slip share, amber above 5 %) and the inverse-dyno torque points; `Copy dyno CSV` puts an `rpm,torque_Nm` CSV on the clipboard for the engine import. Unusable input shows `No usable rpm/speed rows.`

**`Gear lab & tracks`** — `Gear count` (2–8), `Target top speed` (above 20 km/h), `Max shift drop` (0.05–0.6 as a fraction), track archetype (`Tight hairpins`, `Balanced circuit`, `Fast straights`) and an optional GPX track file (no size cap, at least 3 points). `Solve gearset` prints candidate ratios, the resulting top speed and an `Over the drop limit` warning when a shift exceeds the cap; `Apply to primary` writes the proposal into the primary gear set. The archetype row advises 2nd/3rd ratios with corner speeds. A GPX import reports straight and corner counts; `Seed from GPX` sets the Vmax field to the longest straight × 1.1 (review it — it is a heuristic, not a measured speed). Invalid input shows `Check solver inputs.`

**`Session & phone timer`** — `Start GPS timer` samples `navigator.geolocation` speed with a live readout; without geolocation it prints `GPS unavailable here.` and never starts. `Stop` scores the attempt: 0–100 km/h, 0–60 mph and 1/4-mile splits next to the solver prediction. Name the run, `Save run` logs it with the active preset label, and the runs list offers per-run delete plus `Runs CSV` / `Runs JSON` dated exports. `Keep screen awake` holds a wake lock while supported and silently stays off otherwise. Fixes with null, non-finite or negative speed are dropped; anything else is scored as-is.

**`Spec-sheet quick add`** — the form from section 1; `Save to My Cars` validates and reports `Check the highlighted fields.` or `Car saved to My Cars.`

**`Backup & transfer`** — `Export full backup` downloads a dated `haguruma-backup-<date>.json`; `Import backup` applies it directly (`Invalid backup file.` on rejection). `Export My Cars` / `Import cars` move the preset bundle, reporting how many cars were imported.

**`Tire pyrometer (3-zone)`** — one tire: inner / center / outer temperatures, target hot temperature and hot pressure. Everything updates live: camber advice (more/less negative, balanced), pressure advice with the correction in bar, inner-outer and center-edge spreads, and a cold/optimal/hot window pill. Guidance only — compare equal-condition hot readings.

**`Setup guide`** — the troubleshooting wizard (corner phase × understeer/oversteer/transfer/bottoming → ranked fixes with severity badges and trade-offs) plus the offline handbook: how-to-feel-the-car cues for entry, mid-corner and exit, the pyrometer reading guide, and the 8-step systematic procedure. All copy ships with the app in every language.

---

## 8. Setup levels

The `Main Setup` header has a `Level` select: `Easy`, `Medium`, `Full`. It gates **setup inputs only** — graph, tables, cruise check, tools and guides stay visible at every level.

| Level | Adds |
|:--|:--|
| `Easy` | Tire, final drive, redline, tire compound, downforce (`CL`, area, front share) |
| `Medium` | `Graph Max Speed`, drivetrain layout, sustained lateral G, `Road Load`, `Engine Curve` |
| `Full` | Gear-ratio section, differential model and locks, weight distribution, CoG height, wheelbase, track width, spring rates, preload / AWD / vectoring / handbrake fields |

The comparison card has its own `Level` select, limited to the primary level or lower. Its gear rows require `Full`; its `Road Load` and `Engine Curve` sections require `Medium`. Changing the primary level also sets the comparison level; lowering the comparison afterwards is independent. Both are persisted (`haguruma-setup-level`, `haguruma-comp-level`). Cards whose every accordion is hidden are hidden as well.

---

## 9. Preferences

Open the drawer with the hamburger button. The drawer is a slide-over on every viewport: hamburger, backdrop and close button toggle it, focus moves to the close button on open and back on close, `Tab` is trapped inside while open and `Escape` closes it. Navigation buttons scroll to each section (primary and secondary car, engine, setup guide, tools, pyrometer, presets), auto-open collapsed ancestors and close the drawer. It also holds a `My Cars` entry that opens the garage modal. `Settings` holds:

| Preference | Options | Persisted as |
|:--|:--|:--|
| `Language` | `EN`, `IT`, `DE`, `ES`, `FR` | `haguruma-lang` |
| `Units` (speed) | `km/h`, `mph` | `haguruma-unit` |
| `Units` (power) | `kW`, `cv` | `haguruma-power-unit` |
| `Theme` | `OLED`, `Dark`, `Light` | `haguruma-theme` |

Switching to `mph` changes the default graph maximum from 300 to 180 and swaps the acceleration KPI cells; switching back restores 300. Switching power unit re-expresses every power field (engine power, secondary power, custom-car power, `Power @ Torque Peak`). `Dark` is the default, `OLED` is pure black and `Light` is white; the graph palette follows the theme. Unit and theme are **not** carried in share links, so a shared setup opens in the recipient's own units and theme.

The drawer also holds `Share setup` (`Share`, `QR`), `Simulation` switches (`Road Load`, `Secondary Comparison`) that mirror the in-card checkboxes, the display switches (fine grid, snap HUD), garage export/import buttons and the technical specs.

---

## 10. Saving and sharing

**Share a link.** `Share` copies a URL encoding the whole setup into the hash and shows `Link copied!` (or `Copy failed`). `QR` opens the `Scan to load setup` modal (`Point a phone camera at the code to open this setup.`); a setup too large for a QR code shows `Setup too large for a QR code`, and the link still works. The hash uses a packed Base64URL `c` token as the primary encoding; when a setup cannot be packed (for example a custom dyno curve) verbose keys are used instead, including `curve=rpm:torque;rpm:torque;...`. Legacy hashes still decode. Opening a link applies the setup fields before the first render. The address bar is kept in sync as you change the setup.

**Garage import/export.** `Data` → `Export` downloads `haguruma-garage.json` with every saved car. `Import JSON` merges a validated file: each valid entry is stored (an incoming name overwrites the saved car of the same name), invalid entries are skipped, and no confirmation dialog appears. Malformed JSON is only logged to the browser console and nothing is written. A garage export and a full backup are different files: the garage file carries cars only, the backup carries the allowlisted localStorage keys.

**What each action replaces.**

| Action | Effect |
|:--|:--|
| Load a preset | Replaces the entire primary setup; clears any imported dyno curve |
| `Start from primary setup` | Replaces the secondary setup only |
| `Save car` | Writes to the local garage and loads the entry into the active slot |
| `Import JSON` (garage) | Merges cars; overwrites only matching names, no confirmation |
| `Import backup` (Tools → Local Backup) | Direct apply, no preview: writes each allowlisted key present in the file; a manual reload may be needed before every restored preference shows |
| `Apply to primary` (Gear lab) | Replaces primary gear ratios |
| Open a share link | Replaces the setup fields in the link; unit and theme stay local |

---

## 11. Worked examples

All numbers below are **illustrative**: they come from the model for the stated inputs, not from a measured vehicle. Re-run them with your own data.

### Example 1 — compare two final drives

1. Load `BMW M3 E36 3.2 (5-Speed, 3.15 FD)` from the vehicle selector.
2. Tick `Enable Secondary Comparison`, then press `Start from primary setup`.
3. Change `Secondary Final Drive` from `3.15` to `3.91`.
4. Compare the dashed curves and the `Δ vs primary` column.

Every gear's `Top Speed` falls and every `Next Gear RPM` rises, because the same engine speed now produces a lower road speed; `Shift deltas Δn / Δv` quantifies the change per gear. Shorter gearing costs top-gear redline speed while raising the RPM at any given road speed by a similar amount.

### Example 2 — plus-size a tire

1. Open `Tools` → `Tire size check`.
2. Set `Stock size` to `205/55R16` and `New size` to `225/45R17` (the tool tracks the primary and secondary tires, so editing those directly works too).

For this pair the parser returns Ø 631.9 mm versus Ø 634.3 mm, a circumference delta of about +0.4 %, and the verdict `Good match`. The speedometer row reads `100→100.4`, and `Gearing change` reports `-0.4% longer` (a taller tire makes the gearing numerically longer). These figures are tire-string arithmetic, so they are exact for the format — but they say nothing about whether the tire physically fits the car.

### Example 3 — read a 100–0 stop

1. Open the Dynamics card.
2. Set `Front brake share` to `0.65` and `Brake demand` to `1.4 g`.
3. Read the `100–0 km/h stopping distance` readout, then toggle ABS off and on.

The output line reads `<distance> m · <time> s`, with `· Locked wheels: <n>` when a lock is predicted. As a sanity reference, [`../MATH.md`](../MATH.md) documents the `v²/2a` anchor of about 39.3 m for a 100–0 km/h stop at μ 1.0. Raising the front bias or lowering grip lengthens the stop and increases the chance of a lock warning.

---

## 12. What the numbers do not tell you

The model is deliberately quasi-static and low-order. [`../MATH.md`](../MATH.md) §21 lists the omissions; the ones that change decisions most often are:

- **Tires** are a single friction coefficient in a Kamm circle. No slip curve, no load sensitivity of μ, no pressure, temperature, wear or relaxation length, so grip is symmetric and rate-independent.
- **Load transfer** is quasi-static: no suspension compliance, roll stiffness, anti-dive/squat, ride height or transient damping. Wheel loads are clamped at zero, so wheel lift is a zero load, not a lift event.
- **Lateral acceleration** is your input, not a solved corner.
- **Aero** is steady-state `C_L A` and `C_d A`; no pitch or rake effect, no ground effect, no wind.
- **Differentials** use a static bias model on top of a constant clutch preload; there is no ramp-angle curve, viscous coupling, plate wear or temperature hysteresis, and the AWD centre is a fixed share or an ideal active lock.
- **Engines** are quasi-static torque curves: no turbo spool, intake transients or thermal derate. The limiter is a torque factor with a hard cut or a timed bounce window.
- **Driveline** shifts are a torque cut over a fixed engagement window; the only slip models are the launch hold and the unmatched-downshift spin-up in the lap sequence.
- **Road** grade is constant; there is no curvature, banking or surface change over distance.

Practical consequences: treat the app as a comparison tool. Comparing two setups through the same model is meaningful; reading an absolute number as a prediction is not. The pyrometer is heuristic guidance, not a calibrated track result. The sensitivity math (`setup-sensitivity.ts`) has no UI panel — it is covered by tests, not by a tool. GPS results are indicative and depend on phone hardware.

If something does not behave as this guide describes, see [`./troubleshooting.md`](./troubleshooting.md). If a number looks wrong, check the input ranges in [`../MATH.md`](../MATH.md) §18 and the format rules in [`./data-formats.md`](./data-formats.md) first.
