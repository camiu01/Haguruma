# Data formats

HAGURUMA is a client-side single-page app: every format below is read and written in the browser, and no file leaves the device. This is the canonical reference for those formats; limits, ranges and rejection rules are quoted from the implementing module, cited in each section. The physics that consumes imported data is in [../MATH.md](../MATH.md); presets and the catalog contract are in [presets.md](presets.md), the UI walkthrough in [user-guide.md](user-guide.md), and failure symptoms in [troubleshooting.md](troubleshooting.md).

## Summary

| Format | Direction | Implementing module |
|---|---|---|
| Dyno CSV | import | `src/core/math/dyno-csv.ts` |
| Telemetry CSV | import | `src/core/math/telemetry-math.ts`, `src/components/telemetry-tools.ts` |
| Efficiency map CSV | import | `src/core/math/efficiency-map.ts`, `src/components/efficiency-map-tools.ts` |
| Lap sequence CSV | import + export | `src/core/math/lap-sequence.ts`, `src/components/lap-sequence-tools.ts` |
| GPX track | import | `src/core/math/gpx-track.ts`, `src/components/optimizer-tools.ts` |
| Custom car JSON | export + import | `src/components/custom-car.ts`, `src/core/presets/custom-store.ts` |
| Garage JSON | export + import | `src/services/events/drawer-utils-events.ts`, `src/core/presets/backup-store.ts` |
| Full-state backup JSON | export + import | `src/core/presets/backup-store.ts`, `src/components/backup-tools.ts` |
| Performance session (CSV + JSON) | export + import | `src/core/math/performance-session.ts`, `src/core/presets/performance-store.ts`, `src/components/performance-timer.ts` |
| Simulator drivetrain (INI / JSON / jbeam / CSV) | export, INI re-import | `src/services/graph/drivetrain-export.ts`, `src/services/events/export-events.ts` |
| Share URL and QR payload | export + import | `src/core/share/*.ts`, `src/services/events/qr-modal-events.ts` |

## 1. Dyno CSV import

**Direction:** import only; the curve is re-exported only through the share URL `curve` key (section 11). **Module:** `src/core/math/dyno-csv.ts`, flow in `src/services/events/engine-events.ts`. A successful import stores the points in `state.torqueCurvePoints`, overwrites the peak-torque and peak-power anchors with values derived from the points, and disables the anchor inputs until the curve is cleared.

| Aspect | Behaviour |
|---|---|
| Delimiter | Auto-detected on the first data line: the most frequent of `;`, `,`, tab; comma on a tie |
| Header | Optional. A line is a header when any cell is non-empty and not numeric. Header-less rows are `rpm,torque[,power]`: column 0 = rpm, 1 = torque, 2 = power (only when a third cell exists) |
| Header labels | Case-insensitive, whitespace stripped: rpm `rpm\|giri\|rev`; torque `nm\|coppia\|torque\|torq\|kgm\|mkg`; power `kw\|cv\|hp\|ps\|potenza\|power`. First match per role wins; a torque label that also matches the power pattern is not torque |
| Minimum | At least 2 non-empty lines must remain and the columns must resolve, else rejected; blank lines and lines starting with `#` are ignored |

Units: torque is Nm, or kgm when the label matches `kgm\|mkg` (× 9.80665); power is kW, or metric cv/hp/ps when the label matches `cv\|hp\|ps` (converted by `hpToKw` in `src/core/math/aero-math.ts`). Power-only rows convert with `T = P × (30000/π) / n`. A decimal comma becomes a decimal point **only when the delimiter is `;`**; with `,` or tab, `260,5` is not a valid number. A row is skipped (never fatal) when rpm is missing, non-numeric or not positive, or when neither a finite positive torque nor a usable power value is present.

Surviving points are sanitized by `sanitizeTorquePoints` (`src/core/math/engine-curve-core.ts`): RPM outside 500–15000 and torque outside 5–5000 Nm are dropped, RPM is rounded, points are sorted ascending, and a duplicate RPM keeps only the first; fewer than 2 usable points rejects the import. `parseDynoCsv` accepts `smooth` values `true` or `'gauss'` (Gaussian, `[1,4,6,4,1]/16`), `'sg'` (Savitzky-Golay, `[-3,12,17,12,-3]/35`), `'median'` (5-sample median), and `false`/`undefined`/other (no filter). Filters need at least 3 points and reuse the nearest sample at the edges. The shipped UI exposes only a checkbox (`engine-csv-smooth`) passing `true` or `false`; the string selectors are part of the parser API. After filtering, a curve longer than `MAX_CURVE_POINTS = 64` is resampled onto 64 evenly spaced RPMs between the first and last point (`resampleTorquePoints`, interpolated with `torqueAtRpm`), so an import always ends at 64 points or fewer. On rejection the status line under the engine inputs shows the CSV error and the previous curve is untouched; on success it reports the stored point count. The file picker refuses anything above 5 000 000 bytes before reading it, showing the same error state.

```csv
rpm;coppia;potenza
2000;180;37.7
4000;260;109.0
```

Illustrative values; header-less files use Nm and kW.

## 2. Telemetry CSV import, ratio recovery and inverse dyno

**Direction:** import only. **Modules:** `src/core/math/telemetry-math.ts`, `src/components/telemetry-tools.ts`. The parser scans for the first line matching both `rpm|engine.?speed` and `speed|velocity`; that line is the header, and column names are lowercased and stripped of non-alphanumerics before matching.

| Channel | Header names matched (after stripping) | Required |
|---|---|---|
| RPM | `rpm`, `enginerpm`, `enginespeed` | yes |
| Speed | `wheelspeed`, `speed`, `gpsspeed`, `velocity` | yes |
| Time | `time`, `elapsed`, `timestamp` | yes |
| Gear | `gear`, `gearindex` | no |

Separator: `;` if the header contains one, else tab, else comma. A UTF-8 BOM is stripped and quoted cells with escaped `""` are handled. The import is rejected when any required channel is missing, or when the speed column name contains `mph` or `mps` — speed must be km/h. Text over 10 000 000 characters is rejected (the UI also refuses files above 10 000 000 bytes), and rows are read from the header up to the 50 001st data line. Accepted values are time ≥ 0 s, rpm 0–30000, speed 0–600 km/h, all finite; gear is kept only as an integer 1–8. Timestamps must increase strictly — a row at or before the previous timestamp is skipped, not fatal. Fewer than 3 usable rows is reported as invalid.

`recoverGearRatios(rows, circM, fd)` ignores rows below 15 km/h or 1000 rpm and computes `ratio = rpm × circM × 0.06 / (speed × fd)`. Ratios outside 0.3–8 are dropped; the rest are clustered into at most 64 groups with a 6 % membership window around the running centre, and groups with fewer than 3 samples are discarded. Each group reports its median ratio, sample count and slip fraction (share of samples deviating more than 3 % from the median); the top 8 by descending ratio are shown as `G1`…`Gn`. These are estimates from the log, not a gearbox measurement.

`inverseDyno(rows, setup)` needs consecutive samples in the same gear (the `gear` column present and equal on the rows before and after), speed ≥ 15 km/h, a span across the outer samples above 0 and at most 2 s, and acceleration above 0 and at most 20 m/s². The setup must carry finite mass, final drive, circumference, efficiency (0–1), Cd, area, rolling resistance and grade. Wheel force is expanded with drag, rolling resistance and grade, converted to crank torque, and binned at 250-rpm resolution with each bin averaged. The result is sanitized like a dyno import and resampled to 64 points; applying it requires a separate explicit button press, and without steady-gear acceleration the tool reports that no curve could be derived.

```csv
Time,RPM,GPS Speed,Gear
0.00,1500,20,1
0.50,2200,30,1
1.00,3100,45,2
```

Illustrative values; time in seconds, speed in km/h.

## 3. Efficiency map CSV import

**Direction:** import only. **Modules:** `src/core/math/efficiency-map.ts`, `src/components/efficiency-map-tools.ts`. A map is a table of measured drivetrain efficiency at operating points, and parsing is strict and all-or-nothing: one bad row discards the whole file.

| Aspect | Behaviour |
|---|---|
| Header | Mandatory, exactly `rpm,load,efficiency` in that order, case-insensitive; `;` or tab separators accepted. The separator is `;` if the first line contains one, else tab, else comma |
| Size and rows | Over 50 000 characters rejected (the UI also refuses files above 50 000 bytes); 2 to 256 samples |
| `rpm` | 500–15000 |
| `load` | 0–1, normalised torque demand |
| `efficiency` | Above 0 and at most 1, as a **fraction** (a percentage such as `60` is rejected) |
| Rejection | A repeated `rpm:load` pair or any invalid row rejects the whole file; unknown fields are dropped |

On success the count is reported and the map is held as a preview; it is written to `state.simulation.efficiencyMap` only when Apply is pressed, and it travels in the share URL through the `sim` key (section 11). Rejection marks the file input invalid and shows the invalid-map message while the active map is unchanged. Reset removes the map and falls back to the constant layout efficiency, and replacing the primary gear set invalidates a pending preview.

```csv
rpm,load,efficiency
2000,0.2,0.62
4000,1.0,0.91
```

## 4. Lap sequence CSV

**Direction:** import, plus a trajectory export. **Modules:** `src/core/math/lap-sequence.ts`, `src/components/lap-sequence-tools.ts`. The header must be exactly `duration_s,gear,throttle,brake,rev_match`, or that header plus `,handbrake`; comparison is case-insensitive on the trimmed first line and the delimiter is always a comma.

| Field | Range |
|---|---|
| `duration_s` | 0.01–60 s |
| `gear` | integer 1–8 |
| `throttle` / `brake` | 0–1 |
| `rev_match` | 0 or 1 |
| `handbrake` (optional) | 0–1 |

Every row must have exactly 5 or 6 non-empty cells. Text over 8000 characters, more than 60 rows, a missing or wrong header, or a single out-of-range value rejects the entire sequence — there is no partial import. The summed duration must be at most 180 s. Rejection marks the textarea invalid and shows the invalid-sequence message; an unsafe downshift is reported separately. `simulateLapSequence` returns `LapResult`, and the export button stays disabled while `error` is set:

| Field | Contents |
|---|---|
| `points` | `{ timeS, distanceM, speedKmh, rpm, gear, accelMps2 }`, integrated at 10 ms and sampled every 100 ms |
| `shifts` | `{ timeS, fromGear, toGear, targetRpm, blipRpm, lockRisk }` |
| `error` | `null`, or `'invalid'`, `'overrev'` (RPM past the limiter), `'divergent'` |

The download is `haguruma-sequence.csv` with header `time_s,distance_m,speed_kmh,engine_rpm,gear,accel_mps2`, default number formatting and no location data.

```csv
duration_s,gear,throttle,brake,rev_match,handbrake
2,3,1,0,1,0
2,4,1,0,1,0
```

## 5. GPX track import

**Direction:** import only, into the gear optimizer. **Modules:** `src/core/math/gpx-track.ts`, `src/components/optimizer-tools.ts`. `<trkpt ...>` tags are read with a regular expression; no XML parser and no external entity resolution is used. Files over 5 000 000 characters are rejected (the UI also refuses files above 5 000 000 bytes), as is any file containing `<!DOCTYPE` or `<!ENTITY`. Each point needs finite `lat` within ±90 and `lon` within ±180; invalid points are skipped and parsing stops after 50 000 points. Every `<trkpt>` is read in document order, so `<trkseg>` boundaries are not honoured and a multi-segment file is treated as one continuous path. Fewer than 3 points is reported as invalid.

`summarizeTrack` derives, from the ordered coordinates only: total length (haversine sum, R = 6 371 000 m); longest segment; longest straight (longest run of consecutive segments whose accumulated heading change stays within 5°); and tightest corner radius (smallest circumscribed circle `a·b·c / (4·area)` over point triples, keeping only triples with both adjacent segments ≥ 5 m and a triangle area above 0.1 m²). The optimizer then seeds its target speed from the longest straight (300 km/h above 800 m, 240 km/h above 350 m, else 180 km/h), classifies the track as `tight` below 35 m radius or `fast` above 100 m, otherwise `balanced`, and estimates an apex speed from the tightest radius as `√(r × 0.8 × 9.81) × 3.6`, clamped to 20–200 km/h; the second corner field is 1.5× that apex, clamped to 300 km/h.

**These values are a geometry seed, not measured track data.** The radius comes from three-point geometry on raw GPS coordinates and the straight detection is a heading-change heuristic, so the seeded speeds must be reviewed before use. The import never changes the gear set by itself; the optimizer preview still has to be applied explicitly.

```xml
<trk><trkseg><trkpt lat="45.0" lon="7.0"/><trkpt lat="45.001" lon="7.002"/><trkpt lat="45.0025" lon="7.004"/></trkseg></trk>
```

## 6. Custom car JSON (preset export/import)

**Direction:** export per preset, import as part of the garage file (section 7). **Modules:** `src/components/custom-car.ts`, `src/core/presets/custom-store.ts`. Saved cars live in `localStorage` under `haguruma-custom-presets` in a versioned envelope (`CUSTOM_STORE_VERSION` is `1`):

```json
{
  "schemaVersion": 1,
  "presets": { "My Car": { "tire": "205/55R16", "fd": 4.1, "redline": 7000, "gears": [3.3, 2.0, 1.4, 1.0, 0.8] } }
}
```

A bare name-keyed map without `schemaVersion` is still accepted (legacy shape); a numeric `schemaVersion` other than `1` discards the store, as does malformed JSON. Entries failing the `isPreset` guard are dropped, and an entry without `runningGear` is backfilled with the defaults.

The single-preset export writes the bare `GearPreset` object — no envelope — pretty-printed as `${name}.json`, where the name is stripped of characters outside `a-zA-Z0-9_-`:

```json
{
  "tire": "205/55R16", "fd": 4.1, "redline": 7000, "gears": [3.3, 2.0, 1.4, 1.0, 0.8],
  "massKg": 1100, "powerKw": 110, "peakTorqueRpm": 4000, "peakTorqueNm": 260, "peakPowerRpm": 6000
}
```

Illustrative values; real files also carry `dragCd`, `frontalAreaM2`, the full `runningGear` object, and may include `reverseRatio`, `rotatingMassKg`, `shiftTimeS` and `simulation`. The catalog-only fields `finalDrives` and `drivetrainOptions` exist on the shared `GearPreset` type but are not produced by this form.

The save/apply form validates 15 fields first: `name` non-empty; `tire` parses; `fd`, `massKg`, `dragCd`, `frontalAreaM2`, power, torque-RPM, torque and power-RPM positive; `redline` positive and at least 1000; gears a comma, space or semicolon separated list of positive ratios; reverse, rotating mass and shift time optional, with shift time at most 3 s. Invalid fields are marked and nothing is saved. Power typed in cv is converted to kW on save. Saved presets appear in the dropdown under the `custom:` prefix (`CUSTOM_PREFIX`) and apply to the primary or comparison slot.

## 7. Garage bulk import/export

**Direction:** both. **Module:** `src/services/events/drawer-utils-events.ts`, validated by `src/core/presets/backup-store.ts`. Export downloads every saved custom preset as one file named `haguruma-garage.json`, containing the bare name-keyed `GearPreset` map (no `schemaVersion` envelope):

```json
{ "Track Car": { "tire": "205/55R16", "fd": 4.1, "redline": 7000, "gears": [3.3, 2.0, 1.4, 1.0, 0.8] } }
```

Import accepts a single `GearPreset` object (stored under the file name without `.json`, truncated to 120 characters), a bare name-keyed map, or the versioned envelope from section 6.

| Rule | Value |
|---|---|
| Size | Over 2 000 000 characters rejected (the UI also refuses files above 2 000 000 bytes) |
| Names | Non-empty after trimming, at most 120 characters, at most 500 of them, never `__proto__`, `prototype` or `constructor` |
| Per entry | `isPreset` passes, tire parses, `fd` ≤ 10, `redline` 1000–30000, at most 8 gears each ≤ 8, every numeric field finite |
| All-or-nothing | One bad entry rejects the whole file; the app never saves a silently filtered subset |
| Duplicates | If any incoming name already exists, a confirmation dialog runs first; cancelling writes nothing |

An empty or fully rejected file reports the invalid-backup message. On success the incoming map is merged over the saved one (incoming wins) and written through `restoreStateBackup`, so the write is transactional: if storage throws, the previous value is restored and the error is reported.

## 8. Full-state backup bundle

**Direction:** both. **Modules:** `src/core/presets/backup-store.ts`, `src/components/backup-tools.ts`. Download name: `haguruma-backup.json`. The bundle is an allowlisted snapshot of `localStorage` values, each stored exactly as the raw string:

```json
{
  "schemaVersion": 1,
  "values": { "haguruma-custom-presets": "{\"schemaVersion\":1,\"presets\":{}}", "haguruma-theme": "oled" }
}
```

| Key (`BACKUP_KEYS`) | Validated as |
|---|---|
| `haguruma-custom-presets` | Garage validation from section 7, parsed from the embedded JSON string |
| `haguruma-lang` | One of `en`, `it`, `de`, `es`, `fr` |
| `haguruma-theme` | One of `dark`, `oled`, `light` |
| `haguruma-unit`, `haguruma-power-unit` | `kmh`/`mph` and `kw`/`cv` |
| `haguruma-setup-level`, `haguruma-comp-level` | One of `easy`, `medium`, `full` |
| `haguruma-performance-session` | Re-validated by `parsePerformanceSession` and re-serialized |

Keys absent from the export are omitted. A different `schemaVersion`, a non-string value, an unknown key or a value outside its enum rejects the whole file. The size limit is 2 000 000 characters and the UI also refuses files above 2 000 000 bytes.

Import is preview-then-apply: choosing a file only validates it and enables Apply. Applying writes the validated entries and reports success or a storage error. The restore is transactional — previous values are captured first and put back (or removed when they did not exist) if any write throws. Only keys present in the file are written: keys absent from the backup are left untouched and never deleted, and unrelated `localStorage` keys are not touched at all. The tool does not reload the page, so a manual reload may be needed before every restored preference is reflected in the running UI.

## 9. Performance session (CSV + JSON)

**Direction:** export and re-import through local storage. **Modules:** `src/core/math/performance-session.ts`, `src/core/presets/performance-store.ts`, `src/components/performance-timer.ts`. A session is a list of GPS speed samples; positions are deliberately not recorded.

| Field | Range |
|---|---|
| `timeS` | 0–120 s |
| `speedKmh` | 0–500 km/h |
| `accuracyM` | 0–15 m |

Storage key `haguruma-performance-session` (`SESSION_STORAGE_KEY`) holds `{"schemaVersion":1,"samples":[...]}`. The serialized form is limited to 1 000 000 characters and 5000 samples, samples must be strictly increasing in time, and any bad sample rejects the whole session. The same validator runs when the key is restored from a backup bundle. The in-memory metrics add further gates: at least 2 samples, the first at or below 1 km/h (a standstill start), and no gap above 2 s between consecutive samples — otherwise the splits come back empty rather than partial.

Exports from the Tools card: `haguruma-run.csv` (header `time,speed_kmh,accuracy_m`, fixed to 3/3/1 decimals) and `haguruma-run.json` (`{"schemaVersion":1,"samples":[...]}`). Recording stops when the page is hidden or unloaded, and the session is written to storage on stop.

```csv
time,speed_kmh,accuracy_m
0.000,0.000,3.2
0.500,5.400,3.1
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

The `.jbeam` export uses `-3.0` as the reverse ratio when no reverse is set; the other exports omit reverse in that case. The CSV overall column is `ratio × finalDrive`. The INI importer reads keys only, ignoring sections, comments (`;`, `#`) and trailing comments, and uppercases key names:

| Key | Accepted range | Effect |
|---|---|---|
| `GEAR_<n>` | n an integer 1–12, ratio 0.4–6.0 | Forward gear ratios, sorted by `n` |
| `FINAL` | 1.0–10.0 | Primary final drive |
| `REVERSE` | 1.0–6.0 | Reverse ratio |
| `COUNT` | Not read | Ignored |

At least one valid `GEAR_n` and a valid `FINAL` are required, otherwise the file is rejected with an error status. The file picker also refuses anything above 1 000 000 bytes. On success the parsed gears, final drive and reverse ratio replace the primary setup, the gear list re-renders and the share hash is refreshed.

```ini
[GEARS]
GEAR_1=3.300
GEAR_2=2.000
FINAL=4.100
COUNT=2
```

## 11. Share URL and QR payload

**Direction:** both. **Modules:** `src/core/share/share-utils.ts`, `share-compact.ts`, `running-gear-share.ts`, `advanced-share.ts`, `graph-window-share.ts`, and `src/services/events/qr-modal-events.ts`. The setup is written into the URL hash (after `#`) as a query string; three encodings exist and the decoder accepts all of them.

**Packed `c` token (current).** `encodeCompactHash` packs the whole state into one Base64URL token emitted as `c`; the first byte is the version, `1`. It carries the compare/road-load/reverse flags, primary tire, final drive, redline, max graph speed, primary gears, reverse ratio, the full secondary setup, the road-load and engine parameters, and both running-gear blocks. Scaled integers are used throughout, so precision is bounded by the scale factor: final drive is packed as `×1000`, road grade as `×2` with a `+60` offset, and running-gear weight distribution and friction as `×100`. The token is emitted only when the state fits the packing exactly; it is skipped — and the verbose form written instead — when a custom dyno curve is active, when either running gear uses a non-default tire compound, or when any packed value is out of range (final drive 1–10, redline 3000–12000, mass 500–3000, Cd 0.15–0.6, frontal area 1–4, power 30–700 kW, gear ratios 0.4–6.0 in at most 8 gears, and so on). It cannot carry an efficiency map; that travels in `sim`.

**Legacy token.** `decodeCompactSetup` also accepts the earlier primary-only layout: tire width/aspect/rim bytes, final drive `×100`, redline, gear count, gear ratios `×1000`, and reverse `×1000` with `0` meaning "no reverse". It is accepted only when the byte length is exactly `10 + 2 × gear count` and the gear count is 1–8.

**Verbose keys.** Written when the packed token is unavailable. Values are validated on decode; an out-of-range or unparsable value is ignored rather than rejecting the link.

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
| `lay`, `df`, `db`, `dc`, `dm` | Layout `FWD`/`RWD`/`AWD`, differential type `open`/`torsen`/`clutch_lsd`/`spool`, accel lock 0–1, coast lock 0–1, catalog model id |
| `tc` | Tire compound id |
| `sf`, `sr`, `lat` | Spring rate front/rear 10–120 N/mm, lateral g 0–2 |
| `lc`, `la`, `ls` | Lift coefficient 0–4, lift reference area 0.5–5 m², downforce front share 0.2–0.8 |

An unknown `dm` model id or `tc` compound id is ignored, so older links keep working. **Graph window and advanced keys** are always written alongside the packed token, because the token's layout is fixed:

| Key | Behaviour |
|---|---|
| `z_min`, `z_max`, `z_rmin`, `z_rmax` | Graph window, applied atomically with all four required: min speed ≥ 0, max ≤ 2000, span ≥ 5 km/h; min RPM ≥ 0, max ≤ 30000, span ≥ 250 |
| `view`, `margin` | `view=force` switches the graph to the wheel-force view; `margin=1` enables the traction-margin shading |
| `sim` | JSON below 25 000 characters: `limiterMode` `hard`/`bounce`, `shiftTimesS` at most 7 values 0–3 s, optional `efficiencyMap` validated by `validateEfficiencyMap` (2–256 samples) |
| `rgx`, `crgx` | JSON below 1000 characters with optional `awdFrontShare` 0–1, `differentialPreloadNm` 0–1000, `preloadRadiusM` 0.1–1, `handbrakeFraction` 0–1, `centerDisengaged` boolean, `activeCenter` boolean |

**Dyno `curve` key.** A custom curve is encoded as `rpm:torque` pairs joined by `;` with one decimal of torque, and only in verbose mode. Malformed pairs are skipped on decode, the result is sanitized with the same rules as a dyno import, and it is resampled to `MAX_CURVE_POINTS = 64`.

```text
curve=2000:180.0;4000:260.0;6000:240.0
```

**Decode and unknown keys.** `decodeState` merges all decoders; later groups override earlier ones, so a verbose key wins over the packed token when both are present, and the advanced keys merge last on top of everything else. Unknown keys are ignored, and a key whose value is missing or out of range is dropped without affecting the rest of the link. A packed token that fails to decode — wrong version byte, wrong length, unknown layout or differential enum, or trailing bytes — yields no fields at all, and the legacy token is tried only after the full token fails. An empty hash yields an empty patch, and a malformed `sim`, `rgx` or `crgx` extension is discarded without discarding the legacy setup.

**QR payload.** The QR modal calls `syncUrlHash()` and encodes the full share URL. The generator (`src/core/share/qr-svg.ts`) uses byte mode at error-correction level L, versions 1–10 and a fixed mask. It returns an empty result when the payload exceeds version 10-L capacity (271 data bytes) or contains characters outside Latin-1; the modal then shows the "share URL too long" message instead of a code.
