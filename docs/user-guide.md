# HAGURUMA — User Guide

HAGURUMA plots engine RPM against vehicle speed for every gear, computes the RPM you land on after each upshift, estimates road-load physics (mass, aero drag, rolling resistance, grade), and suggests shift points from tractive-force analysis.

It is a single-page app with no backend. Everything you enter stays in your browser (localStorage) unless you deliberately share a link or export a file.

**Every number the app shows is an estimate produced by the model documented in [`../MATH.md`](../MATH.md).** It is not measured data, not a certification and not a safety guarantee. Section [What the numbers do not tell you](#what-the-numbers-do-not-tell-you) lists the specific gaps.

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
| `Car name` | Required, max 40 characters |
| `Tire Spec (e.g. 205/55R16)` | Must parse, e.g. `225/45R17` |
| `Final Drive (Differential)` | Positive, input range 1.0–10.0 |
| `Redline RPM` | ≥ 1000, input range 3000–12000 |
| `Reverse (optional)` | Empty, or positive (input range 1.0–6.0) |
| `Gears (comma separated)` | Comma, space or semicolon separated positive ratios |
| `Vehicle Mass (kg)` | Positive, input range 500–3000 |
| `Drag Coefficient Cd` | Positive, input range 0.15–0.60 |
| `Frontal Area (m²)` | Positive, input range 1.0–4.0 |
| `Engine Power` | Positive, in the active power unit (kW or cv) |
| `Peak Torque RPM`, `Peak Torque (Nm)`, `Peak Power RPM` | Positive numbers |
| `Rotating mass (kg, optional)` | Empty or ≥ 0 |
| `Shift time (s, optional)` | Empty or 0–3 |

Saved cars live under the localStorage key `haguruma-custom-presets` and appear in the vehicle dropdown. Each saved row offers `Load` (into primary), `2nd` (into the secondary comparison), `Export` (downloads `<name>.json` with the full preset) and `Delete`. `Save car` also applies the entry to the primary slot. The same modal offers `Import JSON` (one preset, a name-keyed map, or a versioned garage envelope; max 2 MB) and `Import INI` (Assetto Corsa `drivetrain.ini` — gears, final drive and reverse only).

### Quick-add from a spec sheet

`Tools` → `Spec-Sheet Quick Add` builds a preset without touching the active setup. Fill `Vehicle Name`, `Tire Spec (e.g. 205/55R16)`, `Forward Gear Ratios (comma-separated)`, `Final Drive (Differential)`, `Redline RPM`, `Mass (kg)`, `Crank Power (kW)`, then `Review Preset` and `Save Reviewed Preset`. Validation requires a name, a valid tire, 2–8 decreasing ratios, FD 1–10, 3000–12000 RPM, 300–4000 kg and 5–1500 kW. Missing values (torque anchors, chassis layout, Cd, frontal area) are filled with documented estimates, so review them after loading.

### Final-drive variants and aftermarket drivetrain options

Two selects appear under `Final Drive (Differential)` only when the loaded preset provides the data: **final-drive variants** (`4.30 : 1`, stock marked `(stock)`) and **aftermarket options** (`Stock setup`, `FD <x> : 1`, named close-ratio gearsets, catalog LSDs). Selecting one changes only that part and leaves the rest of the preset intact.

---

## 2. Primary setup inputs

### `Primary Setup`

| Control | Accepted | Behaviour |
|:--|:--|:--|
| `Tire Spec (e.g. 205/55R16)` | `NNN/NNR NN`, e.g. `205/55R16`; the `R` is optional, width 3 digits, aspect 2 digits, rim 2 digits | Valid input shows a green dot and updates `Circ: <n> mm`; invalid shows a red dot and `Invalid format (e.g. 225/45R17)`. Invalid text stays in the field but is not applied |
| `Final Drive (Differential)` | > 0 (input range 1.0–10.0) | Applied live |
| `Redline RPM` | > 1000 (input range 3000–12000) | Applied live |
| `Graph Max Speed` | > 50 (input range 100–500), in the active speed unit | Right edge of the X axis; resets zoom/pan |

### `Transmission Gears`

Each row is `Gear <n>` with a colour swatch and `: 1`. Ratios apply live. The dashed `Rev R` row takes an optional reverse ratio; clearing it removes the reverse curve and table row. `Add Gear` appends 0.82× the previous ratio (minimum 0.5). At 8 forward gears the button disables and reads `8 gear limit reached — remove one to add another`.

### `Engine Curve`

`Peak Torque RPM` (1000–12000), `Peak Torque (Nm)` (> 0), `Peak Power RPM` (1000–12000); `Power @ Torque Peak` is read-only.

`Import dyno CSV` accepts an optional header row (`rpm` / torque / power in any column order, English or Italian labels, Nm or kgm torque, kW or cv/hp power) or header-less `rpm,torqueNm[,powerKw]` rows. Comma, semicolon and tab delimiters work; decimal commas are accepted; power-only files need a header row. Points are sanitized (RPM 500–15000, torque 5–5000 Nm) and resampled to 64 points. `Smooth raw dyno` applies a Gaussian pre-filter to raw roller data. Success shows `Dyno curve active: <n> points`, failure `Invalid CSV: need rows with rpm + torque Nm (or power kW/cv).` While a measured curve is active the three anchor inputs are disabled and `Back to anchors` appears; the import also overwrites `Engine Power` and the three anchors from the measured peaks. Full formats: [`./data-formats.md`](./data-formats.md).

### `Road Load (Secondary Physics)`

The header checkbox turns the road-load estimate on and off; when off, the fields dim and `Pwr Req` and `Aero Wall` show placeholders.

| Control | Accepted |
|:--|:--|
| `Vehicle Mass (kg)` | > 0 (input range 500–3000) |
| `Drag Coefficient Cd` | > 0 (input range 0.15–0.60) |
| `Frontal Area (m²)` | > 0 (input range 1.0–4.0) |
| `Rolling Coeff Crr` | > 0 (input range 0.005–0.030) |
| `Engine Power` | > 0 in the active power unit (input range 30–700); wheel power = power × efficiency |
| `Drivetrain Eff (0-1)` | > 0 and ≤ 1 (input range 0.70–1.00); set by the drivetrain layout |
| `Road Grade (%)` | Any finite number, clamped to ±30; positive is uphill |
| `Tire Load Factor` | Any finite number, clamped to 0.90–1.00 (default 0.975) |
| `Rotating Mass (kg)` | ≥ 0, capped at 500 |
| `Shift Time (s)` | ≥ 0, capped at 3; torque cut per upshift in the acceleration solver |

### `Running Gear`

| Control | Values | Notes |
|:--|:--|:--|
| `Drivetrain layout` | `FWD` / `RWD` / `AWD` | Also sets `Drivetrain Eff`: FWD 0.90, RWD 0.85, AWD 0.80 |
| `Differential` | `Open`, `LSD 1-Way`, `LSD 1.5-Way`, `LSD 2-Way`, `LSD Custom`, `OS Giken Super Lock`, `Cusco MZ`, `KAAZ 2-Way`, `Torsen`, `Wavetrac ATB`, `Quaife ATB`, `Spool` | Selecting a model writes its accel/coast lock |
| `Tire compound` | `Eco 400TW`, `Touring 300TW`, `Sport 200TW`, `Semislick 100TW`, `Slick` | Scales road friction by a grip gain of 0.92 / 1.00 / 1.08 / 1.15 / 1.22 |
| `Accel lock`, `Coast lock` | 0–100 % | Active only for clutch-LSD catalog models; dimmed otherwise |
| `Front weight` | 40–70 % | |
| `CoG height` | 300–700 mm | |
| `Wheelbase` | 2200–3300 mm | |
| `Track width` | 1300–1800 mm | |
| `Front spring`, `Rear spring` | 10–120 N/mm | |
| `Sustained lateral G` | Slider 0–1.30 G, step 0.05 | Your input, not solved from a corner |
| `Downforce CL` | 0–4 | Lift coefficient |
| `Downforce area (m²)` | 0.5–5 | |
| `Downforce front share` | 20–80 % | |

Two live readouts sit at the bottom: `Downforce @ 200 km/h` and `Coast lock-up` (the first speed where closed-throttle engine braking exceeds the coast-lock grip of the driven axle).

**Road friction has no input in the UI.** `roadFrictionCoefficient` comes from the loaded preset or a share link and is then multiplied by the selected tire compound's grip gain.

---

## 3. `Enable Secondary Comparison`

Tick `Enable Secondary Comparison` to show a second vehicle as dotted curves; until then the fields are dimmed and the `Compare` legend entry is hidden.

The card mirrors the primary one: `Secondary Tire`, `Secondary Final Drive`, `Secondary Gears (comma separated)` (per-gear cells), `Secondary Redline RPM`, plus its own `Road Load (Secondary Physics)`, `Engine Curve` and `Running Gear (Secondary)` accordions with the same fields. `Start from primary setup` copies tire, final drive, gears, redline, mass, Cd, area, power, anchors and running gear into the secondary slot; `Load preset into compare...` loads a catalog or saved car there instead. `Δ vs primary` reports the tire circumference difference; `Shift deltas Δn / Δv` lists per-gear shift-point differences. Invalid gears show `Check secondary gears (e.g. 3.58, 2.05, 1.38).` and are not applied.

The comparison also draws its own redline marker, its own dashed limit (`COMP AERO <speed>`) and its own grip curve. The KPI strip's acceleration cells stay primary-only.

---

## 4. Reading the results

### KPI strip

Always visible, recomputed on every render, never left at static defaults.

| Cell | Meaning |
|:--|:--|
| `Redline` | Configured rev limiter (RPM) |
| `Top Speed` | Top gear at the redline, in the active speed unit |
| `Aero Wall` | Speed where required wheel power equals available wheel power; `—` when road load is off |
| `Grip Limit` | Standstill friction-limited drive force, in newtons |
| Acceleration cells | km/h mode: `0-100 km/h`, `0-160 km/h`, `0-400 m`, `Trap`. mph mode: `60 ft`, `0-60 mph`, `1/4 mile`, `Trap`. The quarter-mile cell swaps its label between `1/4 mile` and `0-400 m` |

### `Gear Breakdown & Shift Drop at Redline`

Subtitle `Calculated Theoretical Peak`. One row per forward gear, plus a `Rev R` row when a reverse ratio is set.

| Column | Meaning |
|:--|:--|
| `Gear` | Colour-coded gear number |
| `Ratio` / `Overall` | Gear ratio, and gear ratio × final drive, both `: 1` |
| `Top Speed` | Speed at the redline in this gear, in the active unit |
| `Next Gear RPM` / `RPM Drop` | Engine speed after an upshift at the redline, and the RPM lost |
| `Pwr Req` | Required wheel power at this gear's peak; a `· drag-limited` suffix appears when it exceeds available wheel power |
| `Torque (Nm)` / `Traction (N)` | Engine torque and wheel force at the torque peak |
| `Opt Shift` | Suggested shift RPM; `LIMIT` means the optimal point is the rev limiter |
| `Spin Δ` | Speed at which wheelspin begins in that gear, or `-` |
| `Min Wheel` | Lightest wheel load in newtons at standstill |
| `Excess Force at Torque Peak` | Traction margin: wheel force minus grip at the torque peak. Positive (`+`) means the tire budget is exceeded |

With the comparison enabled, `Secondary (dashed)` adds `Gear`, `Ratio`, `Top Speed`, `Δ vs primary` and `Pwr Req`.

### Verdicts and markers

- `LIMIT` — shift at the redline, because the limiter is the optimal point for that gear pair.
- `· drag-limited` — the engine cannot reach that gear's redline speed against road load.
- `AERO` / `COMP AERO` lines — where required wheel power equals available power; the area right of them is shaded.
- `GRIP` curve — friction-limited drive force; shaded bands are speeds where engine force exceeds grip.
- `Coast lock-up` — the speed where engine braking overwhelms the coast-side differential lock.
- Tooltips flag over-rev values with `(OVER)`.

---

## 5. Graph

Title: `Engine RPM vs Vehicle Speed`.

**View modes.** The `Graph` select switches between `Engine RPM` (RPM on Y, one curve per forward gear, dashed grey `R` for reverse, red connectors for shift drops) and `Wheel Force` (newtons on a self-scaling Y axis, plus total road resistance and the dashed grip curve; legend `Gray: road resistance · dashed: grip`). Switching resets the view.

**Navigation.** Four icon buttons sit stacked in the top-right corner *inside* the canvas, in this order: fullscreen (corner brackets), fit (house), zoom in, zoom out. Every one of them carries a tooltip instead of a label.

| Action | Control |
|:--|:--|
| Zoom in / out | The magnifier icons in the in-canvas stack |
| Pan | Drag on the canvas with touch, pen or mouse, or `Shift` + arrows (vertical pan is locked in the force view) |
| Reset | Double-tap on touch, or `Home` / `Escape` with the canvas focused |
| Fit | The house icon in the in-canvas stack, with a `Margin` percentage (0–50, step 5) in the header: sets the X axis to cover every redline speed plus the margin |
| Fullscreen | The corner-bracket icon in the in-canvas stack, or `Escape` to leave |
| Pinch | Two-finger pinch on touch devices |
| Keyboard | Arrow keys move the crosshair; `Shift` + arrows pan |

There is no separate `Reset view` button: the fit action covers it.

**Readout.** Hovering or tapping shows a tooltip with the speed and RPM, every reachable gear's RPM at that speed, the secondary vehicle's gears when enabled, and a grip line (`GRIP <n> N · <n>/wheel`, with `Grip` or `Wheelspin`). A crosshair snaps to the nearest curve. An `aria-live` output below the graph announces the same information as text, e.g. `G3 · 82.0 km/h · 3120 RPM · 4210 N`, prefixed with `Secondary (dashed) ·` when the snapped curve belongs to the comparison; when nothing reaches that speed it reads `No gear reaches this speed below the limiter.` The canvas is focusable, has `role="img"` and is described by the help text and the readout.

**Fullscreen and export.** The fullscreen icon in the in-canvas stack (or `Escape`) toggles a fullscreen overlay. Export controls sit in the graph header, grouped by what they produce: `Graph` for the plot itself and `Drivetrain` for the gear data.

| Control | Output |
|:--|:--|
| `PNG` | Raster canvas image |
| `SVG` | Vector export |
| `Print / PDF` | Browser print dialog; a print stylesheet produces the summary |
| Format select + `Export` | `INI` (Assetto Corsa `drivetrain.ini`), `JSON`, `JBeam` (BeamNG transmission), `MoTeC` CSV, `AiM` Race Studio CSV |

The `Export metadata` checkbox adds a caption such as `Mazda Miata NA (5-Speed, 4.30 FD) · km/h · 185/60R14 · 4.30 FD · <date>` to PNG and SVG exports. `Import INI` (garage modal) reads an Assetto Corsa file back into the primary setup, replacing gears, final drive and reverse, and reports `Imported <n> gears from INI` or `Could not parse drivetrain.ini`.

---

## 6. Tools

The `Tools` card holds two accordions (`Highway Cruising Check`, `Tire size check`) followed by one collapsible section per tool.

**`Highway Cruising Check`** — `Cruise speed` (30–400) reports the chosen gear, RPM, `Engine load` percentage, required/available wheel power and a verdict: `OK`, `High RPM` or `Power deficit`.

**`Tire size check`** — `Stock size` vs `New size`. Shows diameter, sidewall and circumference in millimetres, a size bar, a verdict pill (`Good match` at |Δ| ≤ 1.5 %, `Near limit (±3%)` up to 3 %, `Out of range` beyond), the speedometer error at 50 / 100 / 130 as `indicated→actual`, and `Gearing change` with `shorter` or `longer`. Invalid input shows `Invalid tire format`.

**`Braking Simulation`** — `Speed (km/h)` (1–400), `Front Brake Bias (%)` (0–100), then `Calculate With ABS` or `Calculate Without ABS`. Output is `<distance> m · <time> s`, with ` · Wheel-lock risk` appended when a lock is predicted, or `No feasible result for this setup.` The chart plots `100–0` and `200–0` profiles in the active unit with speed and deceleration traces and a textual caption.

**`Apex Gear & Rev Matching`** — `Corner Radius (m)`, `Lateral Acceleration (g)`, `Speed (km/h)`, `Current Gear`, `Target Gear`, then `Calculate`. Output: `Apex: <speed> km/h · G<n> · <rpm> RPM` and `Rev-match target: <rpm> RPM (+<blip>) · <decel> m/s²`, with ` · Wheel-lock risk` when marginal. An unsafe downshift reports `Downshift unavailable: check the gears and avoid exceeding the limiter.`

**`Lap-Style Pedal & Shift Sequence`** — a text area of CSV phases:

```text
duration_s,gear,throttle,brake,rev_match
2,3,1,0,1
2,4,1,0,1
2,4,0,0.7,1
2,3,0,0,1
```

An optional sixth column adds a handbrake demand. Limits: 1–60 phases, each 0.01–60 s, at most 180 s total, existing gears only, pedals 0–1, `rev_match` 0 or 1. The result summarizes final time, distance and speed plus one line per shift; `Export Simulated Sequence CSV` writes `haguruma-sequence.csv` (`time_s,distance_m,speed_kmh,engine_rpm,gear,accel_mps2`).

**`Tire Pyrometer`** — `Front Left`, `Front Right`, `Rear Left`, `Rear Right`, each with `Inner (°C)`, `Center (°C)`, `Outer (°C)` (0–200), then `Calculate`. Diagnoses include `Hot center: check for excessive pressure`, `Cool center: check for insufficient pressure`, `Hot inner edge: check excessive negative camber`, `Hot outer edge: check camber and cornering load`, `No large tread-temperature imbalance`, plus axle messages such as `Rear tires much hotter: check rear slip and exit stability`. Guidance only; compare equal-condition hot readings.

**`Setup Conflict Check`** — checkboxes for `Front`/`Rear` × `Spring`/`Anti-roll Bar` × `Stiffer`/`Softer`, then `Calculate`. Opposing same-axle spring/ARB changes trigger the conflict warning; otherwise `No opposing spring/ARB adjustments selected.`

**`Setup Sensitivity (+5%)`** — `Calculate` raises each input by 5 % independently and reports `Top Speed Δ`, `Shift RPM Δ` and `0–100 Time Δ` for `Gear Ratios`, `Final Drive`, `Tire Circumference`, `Mass` and `Road Grip`, as a signed bar chart plus a table with a separate scale per column. A lower acceleration time is faster; the effects are estimates, not calibrated track results.

**`Local Backup`** — `Export Full Backup` downloads `haguruma-backup.json`. `Backup JSON File` (max 2 MB) plus `Replace Saved Values With This Backup` applies a file after validation. Applying replaces **only the keys present in the file** (garage, language, theme, speed unit, power unit, setup levels, last GPS session); everything else stays. Preferences need a reload (`Backup restored. Reload the app to apply the restored preferences.`). Invalid files report `Invalid backup. Choose a Haguruma JSON backup smaller than 2 MB.`; storage failures roll the write back.

**`Device Settings`** — `Toggle Keep Screen Awake` requests a wake lock until you leave the app, reporting `This device could not enable screen awake. Check permissions and power-saving settings.` if refused. `Toggle Native Haptics` enables or disables haptic feedback.

**`GPS Performance Estimate`** — closed-course use only, with a passenger operating the device. `Arm New GPS Run` starts from standstill and snapshots the current simulation; `Stop & Save Locally` ends and stores the run (speed samples only, never positions); `Load Last Local Run`, `Export Run CSV` (`haguruma-run.csv`) and `Export Run JSON` (`haguruma-run.json`) work on the last run. Guards: GPS accuracy 15 m or better, start below 1 km/h, samples more than 2 s apart stop recording, automatic stop at 120 s or 5000 samples, and stopping when the tab is hidden. The result compares `Indicative GPS result` with `Simulation` for 0–100 and the quarter mile.

**`Telemetry CSV & Inverse Dyno`** — a CSV with time, engine RPM and wheel speed (an optional gear column improves the result), up to 10 MB. Common MoTeC, AiM, RaceChrono and OBD2 channel names are recognized. With at least 3 usable samples it reports the sample count and, per detected gear, the recovered ratio, sample count and ratio-outlier share; outliers indicate slip or noisy data, not a confirmed fault. `Use Acceleration Log as Estimated Dyno` derives a torque curve from a steady-gear full-throttle pull and applies it as the active curve (resampled to 64 points), or reports `No usable steady-gear acceleration. Include the gear column and a full-throttle run on a known grade.` Applying a curve writes it into the share URL.

**`Gearset Search & Track Profile`** — inputs `Straight-Line Target (km/h)`, `Maximum RPM Drop (%)`, `Second-Gear Corner Target (km/h)`, `Third-Gear Corner Target (km/h)`; `Tight Track`, `Balanced Track` and `Fast Track` fill in archetype values. `Search Gearsets` prints candidate ratios, the suggested final drive and the resulting top speed; `Apply Suggested Gearing` writes them into the primary setup (the only tool that changes the active setup). `Import GPX Track` seeds the targets from local GPX geometry (max 5 MB, at least 3 points) and reports track length, an archetype and `Estimated Longest Straight`. It is a discrete geometric search, not a lap-time prediction.

**`Advanced Powertrain`** — three groups. `Center Differential & Preload`: `AWD Front Torque Share (%)`, `Clutch LSD Preload (Nm)`, `Rear Handbrake Demand (%)` with `Apply Center Split & Preload`, `Apply Rear Handbrake` and `Apply Ideal Active AWD Center` (enabled only for an AWD layout; applying a centre split releases the handbrake). `Shift Times & Limiter`: `Per-Upshift Times (s, comma-separated)` needs exactly one finite 0–3 s value per forward upshift, then `Apply Times & Hard Limiter` or `Apply Times & Bounce Limiter`. `Measured Efficiency`: `Measured efficiency CSV (rpm,load,efficiency)` (max 50 kB, header required, fractions not percentages, 2–256 unique samples, RPM 500–15000, load 0–1, efficiency > 0 and ≤ 1), with `Apply Measured Map` and `Use Constant Efficiency`. Nothing is applied until you press an apply button, and changing the gear list invalidates a pending preview.

---

## 7. Setup levels

The `Main Setup` header has a `Level` select: `Easy`, `Medium`, `Full`. It gates **setup inputs only** — graph, tables, cruise check, tools and guides stay visible at every level.

| Level | Adds |
|:--|:--|
| `Easy` | Tire, final drive, redline, gear rows, engine anchors, downforce (`CL`, area, front share), tire compound |
| `Medium` | `Graph Max Speed`, drivetrain layout, sustained lateral G, `Road Load`, `Engine Curve` |
| `Full` | Gear-ratio section, differential model and locks, weight distribution, CoG height, wheelbase, track width, spring rates |

The comparison card has its own `Level` select, limited to the primary level or lower. Its gear rows require `Full`; its `Road Load` and `Engine Curve` sections require `Medium`. Changing the primary level also sets the comparison level; lowering the comparison afterwards is independent. Both are persisted (`haguruma-setup-level`, `haguruma-comp-level`). Cards whose every accordion is hidden are hidden as well.

---

## 8. Preferences

Open the drawer with the hamburger button. `Settings` holds:

| Preference | Options | Persisted as |
|:--|:--|:--|
| `Language` | `EN`, `IT`, `DE`, `ES`, `FR` | `haguruma-lang` |
| `Units` (speed) | `km/h`, `mph` | `haguruma-unit` |
| `Units` (power) | `kW`, `cv` | `haguruma-power-unit` |
| `Theme` | `OLED`, `Dark`, `Light` | `haguruma-theme` |

Switching to `mph` changes the default graph maximum from 300 to 180 and swaps the acceleration KPI cells; switching back restores 300. Switching power unit re-expresses every power field (engine power, secondary power, custom-car power, `Power @ Torque Peak`). `Dark` is the default, `OLED` is pure black and `Light` is white; the graph palette follows the theme. Unit and theme are **not** carried in share links, so a shared setup opens in the recipient's own units and theme.

The drawer also holds `My Cars`, `Share setup` (`Share`, `QR`), `Simulation` switches (`Road Load`, `Secondary Comparison`) that mirror the in-card checkboxes, and `Data` (`Export`, `Import JSON`) for the garage. Navigation entries are `Primary Car`, `Secondary Car`, `Tools` and `Setup`; each scrolls to its section and auto-opens collapsed ancestors. On narrow screens a bottom bar offers `RPM`, `Gears`, `Dynamics`, `Compare` and `Setup`.

---

## 9. Saving and sharing

**Share a link.** `Share` copies a URL encoding the whole setup into the hash and shows `Link copied!` (or `Copy failed`). `QR` opens the `Scan to load setup` modal (`Point a phone camera at the code to open this setup.`); a setup too large for a QR code shows `Setup too large for a QR code`, and the link still works. The hash uses a packed Base64URL `c` token as the primary encoding; when a setup cannot be packed (for example a custom dyno curve) verbose keys are used instead, including `curve=rpm:torque;rpm:torque;...`. Legacy hashes still decode. Opening a link applies the setup fields before the first render. The address bar is kept in sync as you change the setup.

**Garage import/export.** `Data` → `Export` downloads `haguruma-garage.json` with every saved car. `Import JSON` merges a validated file; when a name already exists you are asked to confirm, and confirming replaces only the cars with matching names. Invalid files report `Invalid backup. Choose a Haguruma JSON backup smaller than 2 MB.` A garage export and a full backup are different files: the garage file carries cars only, the backup carries the allowlisted localStorage keys.

**What each action replaces.**

| Action | Effect |
|:--|:--|
| Load a preset | Replaces the entire primary setup; clears any imported dyno curve |
| `Start from primary setup` | Replaces the secondary setup only |
| `Save car` | Writes to the local garage and applies the entry to the primary slot |
| `Import JSON` (garage) | Merges cars; overwrites only matching names after confirmation |
| `Replace Saved Values With This Backup` | Overwrites the saved keys present in the file; everything else stays |
| `Apply Suggested Gearing` | Replaces primary gear ratios and final drive |
| `Use Acceleration Log as Estimated Dyno` | Replaces the active engine curve |
| Open a share link | Replaces the setup fields in the link; unit and theme stay local |

---

## 10. Worked examples

All numbers below are **illustrative**: they come from the model for the stated inputs, not from a measured vehicle. Re-run them with your own data.

### Example 1 — compare two final drives

1. Load `Mazda Miata NA (5-Speed, 4.30 FD)` from the vehicle selector.
2. Tick `Enable Secondary Comparison`, then press `Start from primary setup`.
3. Change `Secondary Final Drive` to `4.77` (a ratio this chassis offers under the final-drive variants select).
4. Compare the dashed curves and the `Δ vs primary` column.

Every gear's `Top Speed` falls and every `Next Gear RPM` rises, because the same engine speed now produces a lower road speed; `Shift deltas Δn / Δv` quantifies the change per gear. Illustrative effect for this pairing: shorter gearing costs roughly 10 % of the top-gear redline speed while raising the RPM at any given road speed by a similar amount.

### Example 2 — plus-size a tire

1. Open `Tools` → `Tire size check`.
2. Set `Stock size` to `205/55R16` and `New size` to `225/45R17` (the tool tracks the primary and secondary tires, so editing those directly works too).

For this pair the parser returns Ø 631.9 mm versus Ø 634.3 mm, a circumference delta of about +0.4 %, and the verdict `Good match`. The speedometer row reads `100→100.4`, and `Gearing change` reports `-0.4% longer` (a taller tire makes the gearing numerically longer). These figures are tire-string arithmetic, so they are exact for the format — but they say nothing about whether the tire physically fits the car.

### Example 3 — run a 100–0 stop

1. Open `Tools` → `Braking Simulation`.
2. Enter `Speed (km/h)` `100` and `Front Brake Bias (%)` `65`.
3. Press `Calculate Without ABS`, then `Calculate With ABS`.

The output line reads `<distance> m · <time> s`, with ` · Wheel-lock risk` when a lock is predicted. The chart adds the `100–0` and `200–0` profiles in the active unit. As a sanity reference, [`../MATH.md`](../MATH.md) documents the `v²/2a` anchor of about 39.3 m for a 100–0 km/h stop at μ 1.0. Raising the front bias or lowering grip lengthens the stop and increases the chance of a lock warning.

---

## 11. What the numbers do not tell you

The model is deliberately quasi-static and low-order. [`../MATH.md`](../MATH.md) §29 lists the omissions; the ones that change decisions most often are:

- **Tires** are a single friction coefficient in a Kamm circle. No slip curve, no load sensitivity of μ, no pressure, temperature, wear or relaxation length, so grip is symmetric and rate-independent.
- **Load transfer** is quasi-static: no suspension compliance, roll stiffness, anti-dive/squat, ride height or transient damping. Wheel loads are clamped at zero, so wheel lift is a zero load, not a lift event.
- **Lateral acceleration** is your input, not a solved corner.
- **Aero** is steady-state `C_L A` and `C_d A`; no pitch or rake effect, no ground effect, no wind.
- **Differentials** use a constant clutch preload on top of a static bias; there is no ramp-angle curve, viscous coupling, plate wear or temperature hysteresis, and the AWD centre is a fixed share or an ideal active lock.
- **Engines** are quasi-static torque curves: no turbo spool, intake transients or thermal derate. The limiter is a torque factor with a hard cut or a timed bounce window.
- **Driveline** shifts are a torque cut over a fixed engagement window; the only slip models are the launch hold and the unmatched-downshift spin-up in the lap sequence.
- **Road** grade is constant; there is no curvature, banking or surface change over distance.

Practical consequences: treat the app as a comparison tool. Comparing two setups through the same model is meaningful; reading an absolute number as a prediction is not. The pyrometer, conflict and sensitivity tools are heuristic guidance, not calibrated track results. GPS results are indicative and depend on phone hardware.

If something does not behave as this guide describes, see [`./troubleshooting.md`](./troubleshooting.md). If a number looks wrong, check the input ranges in [`../MATH.md`](../MATH.md) §26 and the format rules in [`./data-formats.md`](./data-formats.md) first.
