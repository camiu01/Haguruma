# Data formats

HAGURUMA is a client-side single-page app: every format below is read and written in the browser, and no file leaves the device. This is the canonical reference for those formats; limits, ranges and rejection rules are quoted from the implementing module, cited in each section. The physics that consumes imported data is in [../MATH.md](../MATH.md); presets and the catalog contract are in [presets.md](presets.md), the UI walkthrough in [user-guide.md](user-guide.md), and failure symptoms in [troubleshooting.md](troubleshooting.md).

## Summary

| Format | Direction | Implementing module |
|---|---|---|
| Dyno CSV | import | `src/core/math/dyno-csv.ts`, `src/services/events/engine-events.ts` |
| Telemetry CSV (gear recovery) | import (pasted text) | `src/core/math/telemetry-math.ts`, `src/components/telemetry-tool.ts` |
| Acceleration trace (inverse dyno) | import (pasted text), CSV to clipboard | `src/core/math/inverse-dyno.ts`, `src/components/telemetry-tool.ts` |
| Efficiency map CSV | import (parser only, no UI control) | `src/core/math/efficiency-map.ts` |
| Timed lap sequence | input (textarea), shared in the URL | `src/core/math/lap-sequence.ts`, `src/components/dynamics-tool.ts` |
| GPX track | import | `src/core/math/gpx-track.ts`, `src/components/gear-lab-tool.ts` |
| Custom car JSON | export, import via the garage file | `src/components/custom-car.ts`, `src/core/presets/custom-store.ts` |
| Garage JSON | export + import | `src/services/events/drawer-utils-events.ts` |
| Full-state backup JSON | export + import | `src/core/backup/state-backup.ts`, `src/components/backup-tool.ts` |
| Session log (CSV + JSON) | export | `src/core/telemetry/session-store.ts`, `src/components/session-tool.ts` |
| Simulator drivetrain (INI / JSON / jbeam / CSV) | export, INI re-import | `src/services/graph/drivetrain-export.ts`, `src/services/events/export-events.ts` |
| Share URL and QR payload | export + import | `src/core/share/*.ts`, `src/services/events/qr-modal-events.ts` |

## 1. Dyno CSV import

**Direction:** import only; the curve is re-exported only through the share URL `curve` key (section 11). **Modules:** `src/core/math/dyno-csv.ts`, flow in `src/services/events/engine-events.ts`. A successful import stores the points in `state.torqueCurvePoints`, overwrites the peak-torque and peak-power anchors with values derived from the points, and disables the anchor inputs until the curve is cleared.

| Aspect | Behaviour |
|---|---|
| File size | The picker refuses anything above 5 MiB (`MAX_DYNO_CSV_BYTES` = 5 242 880 bytes) before reading it, showing the same error state as a parse failure |
| Delimiter | Auto-detected on the first data line: the most frequent of `;`, `,`, tab; comma on a tie |
| Header | Optional. A line is a header when any non-empty cell is not numeric (whitespace inside cells is stripped). Header-less rows are `rpm,torque[,power]`: column 0 = rpm, 1 = torque, 2 = power (only when a third cell exists) |
| Header labels | Case-insensitive patterns: rpm `rpm\|giri\|rev`; torque `nm\|coppia\|torque\|torq\|kgm\|mkg`; power `kw\|cv\|hp\|ps\|potenza\|power`. First match per role wins; a torque-labelled cell that also matches the power pattern is not treated as torque |
| Minimum | At least 2 non-empty, non-comment lines and resolvable columns, else rejected; blank lines and lines starting with `#` are ignored |

Units: torque is Nm, or kgm when the label matches `kgm\|mkg` (× 9.80665); power is kW, or metric cv/hp/ps when the label matches `cv\|hp\|ps` (converted by `hpToKw` in `src/core/math/aero-math.ts`). Power-only rows convert with `T = P × (30000/π) / n` (`KW_TO_NM` in `engine-curve-core.ts`). A decimal comma becomes a decimal point **only when the delimiter is `;`**; with `,` or tab, `260,5` is not a valid number. A row is skipped (never fatal) when rpm is missing, non-numeric or not positive, or when the derived torque is not a finite positive number.

Surviving points are sanitized by `sanitizeTorquePoints` (`src/core/math/engine-curve-core.ts`): RPM outside 500–15000 and torque outside 5–5000 Nm are dropped, RPM is rounded, points are sorted ascending, and a duplicate RPM keeps only the first; fewer than 2 usable points rejects the import. `parseDynoCsv` accepts a `smooth` option: `true` or `'gauss'` (Gaussian, `[1,4,6,4,1]/16`), `'sg'` (Savitzky-Golay, `[-3,12,17,12,-3]/35`), `'median'` (5-sample median), and `false`/`undefined`/other (no filter). Filters need at least 3 points and reuse the nearest sample at the edges. The shipped UI exposes only the `engine-csv-smooth` checkbox, passing `true` or `false`; the string selectors are part of the parser API. After filtering, a curve longer than `MAX_CURVE_POINTS = 64` is resampled onto 64 evenly spaced RPMs between the first and last point (`resampleTorquePoints`, interpolated with the Akima curve), so an import always ends at 64 points or fewer. On rejection the status line under the engine inputs shows the error and the previous curve is untouched; on success it reports the stored point count. Covered by `tests/dyno-csv.test.ts`.

```csv
rpm;coppia;potenza
2000;180;37.7
4000;260;109.0
```

Illustrative values; header-less files use Nm and kW.

## 2. Telemetry CSV gear recovery and inverse dyno

**Direction:** import only, pasted into two textareas in the Tools card (the parser re-runs on every edit). **Modules:** `src/core/math/telemetry-math.ts` and `src/core/math/inverse-dyno.ts`, UI in `src/components/telemetry-tool.ts`.

### Gear recovery

The parser looks for a header row whose lowercased cells contain a cell matching `rpm` and one matching `speed`, `kmh`, `velocity` or `mph`; a third column matching `t`, `time` or `second` is an optional time channel. Without such a header the rows are read header-less: three cells as `time,rpm,speed`, two cells as `rpm,speed`.

| Aspect | Behaviour |
|---|---|
| Separator | Per line: `;` if present, else tab, else comma. Decimal commas are accepted only when the first line contains `;` (thousands dots are stripped in that mode) |
| Speed unit | Assumed km/h, except a speed column whose header contains `mph`, which is converted (× 1.609344) |
| Accepted values | rpm > 0 and speed > 0, finite; other rows are skipped. A missing time column falls back to row index × 0.1 s |
| Cap | `TELEMETRY_MAX_SAMPLES = 20000` rows per pass |

`estimateGearRatios(samples, circM)` needs at least 5 samples and a positive effective circumference (derived from the primary tire string and rolling factor). It forms the ratio `rpm / wheel-rev-per-min` for every sample, sorts ascending and groups consecutive ratios within a 3 % window into gears; clusters with fewer than 5 samples are discarded. Each gear reports its median ratio, sample count and slip share (samples more than 5 % off the cluster median, as a percentage); the UI tints the slip cell amber above 5 % and numbers gears 1…n shortest-first. These are estimates from a log, not a gearbox measurement.

### Inverse dyno

The trace textarea takes `time,speed` rows (separators comma, semicolon or tab; decimal comma accepted). `torqueFromAccelLog(trace, vehicle)` requires at least 6 pairs with strictly increasing time and non-decreasing speed, plus a valid vehicle: mass, engaged gear ratio, final drive, circumference, and strictly positive Cd, frontal area and rolling-resistance coefficient, with efficiency in (0, 1]. Wheel force is `m·a + drag + rolling`, converted to crank torque through the fixed gear and final drive, then binned at 250 rpm (`INVERSE_DYNO_BIN_RPM`) with the median of each bin. At least 2 points are required. Grade, wind and shift cuts are not modelled, so the result is an estimate, not a dyno measurement. The card renders the points and a Copy button puts an `rpm,torque_Nm` CSV (`recoveredPointsToCsv`) on the clipboard, ready for the engine dyno import of section 1. Covered by `tests/telemetry-math.test.ts` and `tests/inverse-dyno.test.ts`.

```csv
engine_rpm,wheel_speed_kmh
3200,41.2
4100,52.6
```

Illustrative values.

## 3. Efficiency map CSV (parser only)

**Direction:** import parser with **no UI control wired to it**. **Module:** `src/core/math/efficiency-map.ts`. The solvers currently use the constant layout efficiency from `src/config/drivetrain-eff.ts`; `parseEfficiencyCsv` is dormant code that no picker or textarea calls, and it has no test suite. It is documented here because the validation rules are already frozen.

| Aspect | Behaviour |
|---|---|
| Size | Over 50 000 characters rejected |
| Header | Mandatory, exactly `rpm,load,efficiency` in that order (case-insensitive, optional surrounding quotes); separator `;` if the first line contains one, else tab, else comma |
| Rows | 2 to 256 samples, every data row exactly 3 non-empty cells |
| `rpm` | 500–15000 |
| `load` | 0–1, normalised torque demand |
| `efficiency` | Above 0 and at most 1, as a **fraction** (a percentage such as `60` is rejected) |
| Rejection | A repeated `rpm:load` pair or any invalid row rejects the whole file (all-or-nothing) |

## 4. Timed lap sequence (Dynamics tool)

**Direction:** typed into the Dynamics sequence textarea (`dynamics-sequenceCsv`); it also travels in the share URL as `d_sequenceCsv` (section 11). There is **no export format** for either the commands or the resulting trajectory. **Modules:** `src/core/math/lap-sequence.ts`, UI in `src/components/dynamics-controls.ts` and `src/components/dynamics-tool.ts`.

Each line is exactly four comma-separated cells: `duration_s,gear,throttle,brake_g`. There is no header and no optional column; rev-matching is a global toggle applied to every command, not a per-row flag.

| Field | Range |
|---|---|
| `duration_s` | Above 0 and at most 60 s |
| `gear` | Integer 1–8 (one-based, converted internally) |
| `throttle` | 0–1 pedal fraction |
| `brake_g` | 0–3, brake demand as a multiple of vehicle weight |

Text over 4000 characters, more than 32 rows, an empty cell, or a single out-of-range value rejects the entire input — there is no partial import. `simulateLapSequence` integrates at 10 ms and records a sample every 100 ms plus each segment boundary; the summed duration must be at most 60 s. It returns `null` for an unsafe downshift (the wheel-implied RPM at the target gear exceeds the redline) or a divergent run (non-finite speed, or above 500 km/h). Samples carry `{ timeS, speedKmh, distanceM, gear, engineRpm, blipRpm, coastLock }`; results are rendered in the Dynamics card, not downloaded. The shipped default sequence is `2,4,0,0 / 2,3,0,0 / 3,3,0,1.4 / 3,2,0.7,0`. Covered by `tests/lap-sequence.test.ts`.

```csv
2,4,0,0
2,3,0,0
3,3,0,1.4
```

The shipped default; brake demand is expressed in g.

## 5. GPX track import

**Direction:** import only, in the Gear lab card. **Modules:** `src/core/math/gpx-track.ts`, UI in `src/components/gear-lab-tool.ts`.

`<trkpt lat="…" lon="…">` tags are read with a regular expression; no XML parser and no external entity resolution is used. Latitude and longitude must parse as finite numbers (invalid points are skipped), an `<ele>` child is optional and defaults to 0, and points are read in document order — `<trkseg>` boundaries are not honoured. `parseGpx` needs at least 2 points; `summarizeTrack` needs at least 3 and a positive total length. The current parser applies **no file-size cap and no `DOCTYPE`/`ENTITY` screening**.

`summarizeTrack` derives, from the ordered coordinates only: total length (haversine sum, R = 6 371 000 m); the list of straights sorted longest-first (start and length); corners in track order (apex and length); and the longest straight. A point is flagged as cornering when the heading change between consecutive bearings exceeds 0.001 rad per metre, and segments shorter than 25 m are dropped.

The Gear lab card shows the straight count with the longest straight and the corner count. Its Seed button sets the solver Vmax field to the longest straight × 1.1 as a quick km/h heuristic — **review it before use**; it is not a measured track speed. The import never changes the gear set by itself; the solver proposal still has to be applied explicitly. Covered by `tests/gpx-track.test.ts`.

```xml
<trk><trkseg><trkpt lat="45.0" lon="7.0"/><trkpt lat="45.001" lon="7.002"/><trkpt lat="45.0025" lon="7.004"/></trkseg></trk>
```

## 6. Custom car JSON (preset export/import)

**Direction:** export per preset from the saved-cars list; import happens through the garage file (section 7). **Modules:** `src/components/custom-car.ts`, `src/core/presets/custom-store.ts`. Saved cars live in `localStorage` under `haguruma-custom-presets` in a versioned envelope (`CUSTOM_STORE_VERSION` is `1`):

```json
{
  "schemaVersion": 1,
  "presets": { "My Car": { "tire": "205/55R16", "fd": 4.1, "redline": 7000, "gears": [3.3, 2.0, 1.4, 1.0, 0.8] } }
}
```

A bare name-keyed map without `schemaVersion` is still accepted (legacy shape); a numeric `schemaVersion` other than `1` discards the store, as does malformed JSON. Entries failing the `isPreset` guard (string tire, positive numeric `fd` and `redline`, a non-empty list of positive gear ratios) are dropped, and an entry without `runningGear` is backfilled with the defaults.

The single-preset export writes the bare `GearPreset` object — no envelope — pretty-printed as `<name>.json`, where every character outside `a-zA-Z0-9_-` is replaced with `_`:

```json
{
  "tire": "205/55R16", "fd": 4.1, "redline": 7000, "gears": [3.3, 2.0, 1.4, 1.0, 0.8],
  "massKg": 1100, "dragCd": 0.32, "frontalAreaM2": 2.1, "powerKw": 110,
  "peakTorqueRpm": 4000, "peakTorqueNm": 260, "peakPowerRpm": 6000
}
```

Illustrative values; real files may also carry `reverseRatio`, `rotatingMassKg`, `shiftTimeS` and the full `runningGear` object. The catalog-only fields `finalDrives` and `drivetrainOptions` exist on the shared `GearPreset` type but are not produced by this form.

The save form marks and rejects invalid fields before anything is stored: `name` non-empty; `tire` parses; `fd`, mass, Cd, frontal area, power, torque-RPM, torque and power-RPM positive; `redline` positive and at least 1000; gears a comma, space or semicolon separated list of positive ratios; reverse, rotating mass and shift time optional, with shift time at most 3 s. Power typed in the display unit (cv or kW) is converted to kW on save (`fromDisplayPower`). Saved presets appear in the dropdown under the `custom:` prefix (`CUSTOM_PREFIX`) and can be applied to the primary or the comparison slot. Covered by `tests/custom-store.test.ts`.

## 7. Garage bulk import/export

**Direction:** both. **Module:** `src/services/events/drawer-utils-events.ts` (drawer buttons). Export downloads every saved custom preset as one file named `haguruma-garage.json`, containing the bare name-keyed `GearPreset` map as stored (no envelope):

```json
{ "Track Car": { "tire": "205/55R16", "fd": 4.1, "redline": 7000, "gears": [3.3, 2.0, 1.4, 1.0, 0.8] } }
```

Import accepts a single `GearPreset` object (stored under the file name without `.json`, truncated to 40 characters) or a bare name-keyed map (names truncated to 40 characters).

| Rule | Value |
|---|---|
| Per entry | Must pass `isPreset`; invalid entries are **skipped silently** — this path does not guarantee all-or-nothing import |
| Merge | Valid entries are saved one by one (incoming wins over an existing name) |
| Size and counts | No explicit size cap or entry cap in this path |
| Duplicates | No confirmation dialog; an existing name is overwritten |
| Errors | Malformed JSON logs the error to the browser console and nothing is written; a file with no valid entry changes nothing |

The stricter all-or-nothing garage validation (size cap, name rules, prototype-key rejection, transactional write) lives in `src/core/presets/backup-store.ts`, which currently **has no UI caller**; treat the drawer path above as the shipped behaviour.

## 8. Full-state backup bundle

**Direction:** both. **Modules:** `src/core/backup/state-backup.ts`, UI in `src/components/backup-tool.ts`. Download name: `haguruma-backup-<YYYY-MM-DD>.json`. The bundle snapshots the raw strings of the app-owned keys (`BACKUP_KEYS`):

```json
{
  "schemaVersion": 1,
  "exportedAt": "2026-10-23T12:00:00.000Z",
  "values": { "haguruma-theme": "oled", "haguruma-lang": "en" }
}
```

| Key (`BACKUP_KEYS`) | Content |
|---|---|
| `haguruma-custom-presets` | Garage envelope from section 6, stored as its raw JSON string |
| `haguruma-lang`, `haguruma-theme` | `en`/`it`/`de`/`es`/`fr`; `dark`/`oled`/`light` |
| `haguruma-unit`, `haguruma-power-unit` | `kmh`/`mph` and `kw`/`cv` |
| `haguruma-setup-level`, `haguruma-comp-level` | `easy`/`medium`/`full` |
| `haguruma-sessions` | Session log envelope from section 9, raw JSON string |

Keys with no stored value are omitted. Import is **direct apply**: choosing a file validates the envelope (`schemaVersion` must be `1`, `values` an object; non-string values are dropped) and writes it immediately — there is no preview step. `restoreBackup` writes only keys that are in `BACKUP_KEYS` and present in the file: keys absent from the backup are left untouched, unrelated `localStorage` keys are never touched, and a storage error on one key is skipped rather than rolled back (the function returns the count of written keys). There is no size cap in this path, and the page is not reloaded, so a manual reload may be needed before every restored preference is reflected in the running UI.

The same card offers a preset-scoped transfer: `haguruma-my-cars-<YYYY-MM-DD>.json` built by `exportPresetsBundle` (the versioned envelope of section 6). Its import (`parsePresetsBundle`) migrates and validates every entry, skips invalid ones, saves the rest and reports how many cars were stored. Covered by `tests/session-backup.test.ts`.

## 9. Session log (CSV + JSON)

**Direction:** written by the Session tool, exported as files. **Modules:** `src/core/telemetry/session-store.ts`, UI in `src/components/session-tool.ts`. Runs live in `localStorage` under `haguruma-sessions` in a versioned envelope (`{"schemaVersion":1,"runs":[...]}`).

| Field | Type |
|---|---|
| `id`, `dateISO` | Generated run id and ISO recording timestamp |
| `name`, `presetName`, `note` | Free text typed by the user or the active preset label |
| `time0To100S`, `quarterS`, `trapKmh` | Numbers, or `null` when unknown |

On load, entries failing the `isRun` guard (string `id`, `dateISO`, `name`) are filtered out. The tool's GPS timer samples `navigator.geolocation` speed (`enableHighAccuracy`, no stored positions), derives 0–100 km/h, 0–60 mph and quarter-mile splits with `splitsFromSpeedSeries` (`src/core/math/timer-math.ts`), and shows the solver prediction next to them; Save logs a run with the typed name, the active preset label and the splits.

Exports from the same card, dated `haguruma-sessions-<YYYY-MM-DD>.csv` and `.json`:

| Artifact | Shape |
|---|---|
| CSV | Header `date_iso,name,preset,time_0_100_s,quarter_s,trap_kmh,note`; text fields quoted with doubled quotes; numbers at 2 decimals, empty when `null` |
| JSON | The same versioned envelope as storage |

Covered by `tests/timer-math.test.ts` (splits) and `tests/session-backup.test.ts` (store exports). The legacy `haguruma-performance-session` key and its modules (`performance-session.ts`, `performance-store.ts`) are no longer reachable from the UI.

```csv
date_iso,name,preset,time_0_100_s,quarter_s,trap_kmh,note
2026-10-23T12:00:00.000Z,Morning run,Miata,8.20,16.10,140.50,
```

## 10. Simulator and telemetry exports

**Direction:** export, plus re-import of the `.ini`. **Modules:** `src/services/graph/drivetrain-export.ts`, `src/services/events/export-events.ts`. All exports describe the primary gear set, final drive and optional reverse ratio. Every payload below is produced by this project from the current setup. The Assetto Corsa, BeamNG, MoTeC and AiM variants follow the generic shape implied by their names; they have **not** been verified against those tools, and the INI has only been verified to round-trip through this app's own importer.

| Format | Download name | Shape |
|---|---|---|
| Assetto Corsa `.ini` | `haguruma-drivetrain.ini` | `[GEARS]` section, one `GEAR_n=…` per forward gear, then `FINAL=`, optional `REVERSE=`, `COUNT=`; ratios at 3 decimals |
| Drivetrain `.json` | `haguruma-drivetrain.json` | `{ label, gears, finalDrive, reverseRatio, exporter: 'haguruma' }` |
| BeamNG `.jbeam` | `haguruma-transmission.jbeam` | One part object keyed by the slugified label, `slotType: 'transmission'`, `gearRatios` ordered `[reverse, neutral, 1st..nth]`, plus `finalDrive`; ratios at 3 decimals |
| MoTeC CSV | `haguruma-gears-motec.csv` | Comma separated, header `Gear,Ratio,Overall,FinalDrive`, one row per gear plus `R` |
| AiM Race Studio CSV | `haguruma-gears-aim.csv` | Same rows, semicolon separated |

The `.jbeam` export uses `-3.0` as the reverse ratio when no reverse is set (or `-|reverse|` otherwise); the other exports omit reverse in that case. The CSV overall column is `ratio × finalDrive`. The INI importer reads keys only, ignoring sections, comments (`;`, `#`) and trailing comments, and uppercases key names:

| Key | Accepted range | Effect |
|---|---|---|
| `GEAR_<n>` | n an integer 1–12, ratio 0.4–6.0 | Forward gear ratios, sorted by `n` |
| `FINAL` | 1.0–10.0 | Primary final drive |
| `REVERSE` | 1.0–6.0 | Reverse ratio |
| `COUNT` | Not read | Ignored |

At least one valid `GEAR_n` and a valid `FINAL` are required, otherwise the file is rejected with an error status. The file picker refuses anything above 1 MiB (`MAX_DRIVETRAIN_INI_BYTES` = 1 048 576 bytes). On success the parsed gears, final drive and reverse ratio replace the primary setup, the gear list re-renders and the share hash is refreshed. The JSON, jbeam and CSV variants have no import path. Covered by `tests/drivetrain-export.test.ts`.

```ini
[GEARS]
GEAR_1=3.300
GEAR_2=2.000
FINAL=4.100
COUNT=2
```

## 11. Share URL and QR payload

**Direction:** both. **Modules:** `src/core/share/share-utils.ts` (verbose keys and the decode merge), `share-compact.ts` (packed token), `running-gear-share.ts` (`rg_`/`crg_` blocks), `dynamics-share.ts` (`d_*` sidecars and extended running-gear keys), `curve-share.ts` (`curve`), plus `src/services/events/qr-modal-events.ts`. The setup is written into the URL hash (after `#`) as a query string; the decoder accepts the packed token, the verbose keys, and a legacy token.

**Packed `c` token (current).** `encodeCompactHash` packs the whole state into one Base64URL token emitted as `c`; the first byte is the version, `1`. It carries a flags byte (compare enabled, road load enabled, reverse present), the primary tire, final drive `×1000`, redline, max graph speed, primary gears (count plus ratios `×1000`, at most 8, each 0.4–6.0), reverse `×1000`, the full secondary setup, the road-load and engine parameters (mass, Cd `×1000`, area `×1000`, Crr `×100000`, power `×10`, efficiency `×100`, grade `×2` with a `+60` offset, rolling factor `×1000`, torque/power anchors, rotating mass, shift time `×100`), and both running-gear blocks (weight distribution and friction `×100`, geometry, layout and differential enums, differential model as a catalog index, springs, lateral g `×100`, lift coefficient and area `×1000`, downforce share `×100`). The token is emitted only when every value fits the packing ranges — the same ranges as the verbose keys below — and it is skipped, writing the verbose form instead, when a custom dyno curve is active or when either running gear uses a non-default tire compound. A wrong version byte, an unknown enum index, a wrong length or trailing bytes reject the whole token.

**Legacy token.** The decoder also accepts the earlier primary-only layout inside `c`: tire width/aspect/rim bytes, final drive `×100`, redline, gear count, gear ratios `×1000`, and reverse `×1000` with `0` meaning "no reverse". It is accepted only when the v1 token fails and the byte length is exactly `10 + 2 × gear count` with a gear count of 1–8.

**Verbose keys.** Written when the packed token is unavailable. Values are validated on decode; an out-of-range or unparsable value is dropped rather than rejecting the link.

| Key | Field and accepted range |
|---|---|
| `tire`, `fd`, `rl`, `g`, `rev`, `max` | Primary tire (must parse, stored uppercase), final drive 1–10, redline 3000–12000, comma-separated gears (1–8 entries, each 0.4–6.0), reverse (`''` = none, else 1–6), max graph speed 50–500 |
| `cmp` | Comparison enabled, `0` or `1` |
| `ctire`, `cfd`, `cg`, `crl`, `cmass`, `ccd`, `carea`, `cpw`, `ctq`, `ctqn`, `cpwr` | Secondary tire, final drive 1–10, gears, redline 3000–12000, mass 500–3000, Cd 0.15–0.6, area 1–4, power 30–700 kW, torque RPM 1000–12000, torque 20–1500 Nm, power RPM 1000–12000 |
| `mass`, `cd`, `area`, `crr`, `pw`, `eff`, `rle`, `grade`, `rf` | Mass 500–3000, Cd 0.15–0.6, area 1–4, rolling Crr 0.005–0.03, power 30–700 kW, drivetrain efficiency 0.7–1, road load `0`/`1`, grade −30–30 %, rolling factor 0.9–1 |
| `tq`, `tqn`, `pwr`, `rot`, `sft` | Peak torque RPM 1000–12000, peak torque 20–1500 Nm, peak power RPM 1000–12000, rotating mass 0–500 kg, shift time 0–3 s |
| `curve` | Custom dyno curve, see below |

**Running-gear keys.** `rg_` (primary) and `crg_` (comparison) use the same table and ranges.

| Key | Field and range |
|---|---|
| `wd`, `cg`, `wb`, `tw`, `mu` | Front weight distribution 0.4–0.7, CoG height 200–800 mm, wheelbase 2000–3500 mm, track width 1200–1800 mm, road friction 0.5–1.6 |
| `db`, `dc` | Differential accel lock 0–1, coast lock 0–1 |
| `lay`, `df`, `dm` | Layout `FWD`/`RWD`/`AWD`, differential type `open`/`torsen`/`clutch_lsd`/`spool`, catalog model id |
| `tc` | Tire compound id |
| `sf`, `sr`, `lat` | Spring rate front/rear 10–120 N/mm, lateral g 0–2 |
| `lc`, `la`, `ls` | Lift coefficient 0–4, lift reference area 0.5–5 m², downforce front share 0.2–0.8 |

An unknown `dm` model id or `tc` compound id is ignored, so older links keep working.

**Dynamics sidecars.** Non-default v0.7 settings are appended by `dynamics-share.ts` alongside either encoding, because the packed token's layout is fixed. Numbers: `d_brakeFrontBias` 0–1, `d_brakeDemandG` 0–3, `d_cornerRadiusM` 1–1000, `d_cornerMaxG` 0.05–3, `d_approachGear` integer 1–8, `d_sequenceSpeedKmh` 0–500. Enums: `d_limiter` `hard`/`bounce`, `d_gearbox` `synchro`/`dog`, `d_graphView` `rpm`/`force`/`braking`. Booleans (the strings `true`/`false`): `d_abs`, `d_efficiencyMap`, `d_revMatch`, `d_tractionOverlay`, `d_useGearboxDefaults`. `d_shiftTimesS` is a comma-separated list of at most 8 values, each 0–3 s. `d_sequenceCsv` must parse as a lap sequence (section 4) or it is dropped.

The same sidecar pass extends both running-gear blocks with non-default values only: `rg_dp`/`crg_dp` differential preload 0–500 Nm, `rg_af`/`crg_af` AWD front share 0–1, `rg_cl`/`crg_cl` center lock 0–1, `rg_tv`/`crg_tv` torque vectoring 0–1, and the flags `rg_hd`/`crg_hd` (handbrake disengages center coupling, default on) and `rg_ha`/`crg_ha` (handbrake applied), written as `1`/`0`.

**Dyno `curve` key.** A custom curve is encoded as `rpm:torque` pairs joined by `;` with one decimal of torque, and only in verbose mode (the packed token is skipped while a curve is active). Malformed pairs are skipped on decode, the result is sanitized with the same rules as a dyno import, and it is resampled to `MAX_CURVE_POINTS = 64` (`curve-share.ts`).

```text
curve=2000:180.0;4000:260.0;6000:240.0
```

**Not shared.** The graph zoom/pan window, the theme, the language and the unit selections are deliberately not part of the hash (the max graph speed travels as `max`).

**Decode and unknown keys.** `decodeState` merges the decoders in this order: packed token, primary, comparison, road load, engine, running gear, and the dynamics sidecars last, so later groups override earlier ones and the sidecars win on top of everything else. Unknown keys are ignored, and a key whose value is missing or out of range is dropped without affecting the rest of the link. A packed token that fails to decode yields no fields at all, and the legacy token is tried only after the full token fails. An empty hash yields an empty patch.

**QR payload.** The QR modal calls `syncUrlHash()` and encodes the full share URL (`src/core/share/qr-svg.ts`). The generator uses byte mode at error-correction level L, versions 1–10, a fixed mask and a 5-pixel module size. It returns an empty result when the payload exceeds version 10-L capacity (271 data bytes) or contains characters outside Latin-1; the modal then shows the "share URL too long" message instead of a code. Covered by `tests/share-utils.test.ts`, `tests/share-compact.test.ts`, `tests/dynamics-share.test.ts` and `tests/qr-svg.test.ts`.
