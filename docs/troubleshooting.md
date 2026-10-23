# Troubleshooting

This page covers observable problems: rejected inputs, suspicious results, import failures, stored-data recovery, stale offline assets, sharing limits, platform features and the native build. It does not restate the physics — for why a model behaves as it does, read [../MATH.md](../MATH.md). For the exact shape and limits of every import and export, read [data-formats.md](data-formats.md).

Two things apply to everything below:

- Every number the app produces is a model estimate. A surprising result is usually an input difference, not a defect.
- The application has no backend: imported files are parsed in the browser and persisted only in `localStorage`. The page itself loads Google Fonts from `index.html`; everything else (including Tailwind, compiled into the bundle through PostCSS) is served from the origin.

## Invalid or inconsistent inputs

### Tire strings

`parseTire` (`src/core/math/tire-math.ts`) matches `/^(\d{3})\/(\d{2})\s*R?(\d{2})$/i`. That means a three-digit width, a two-digit aspect ratio, an optional `R`, and a two-digit rim diameter: `225/45R17` and `225/45 R17` parse, while `205/55ZR17`, `205/55/17`, `95/45R17` and `225/45R17C` do not.

When the string does not parse:

- the status dot next to the field turns red and the message **"Invalid format (e.g. 225/45R17)"** appears (`primary.tireError` in `src/core/i18n/dictionary.en.ts`, rendered through `#tire-error`);
- an invalid entry is ignored and the previous value is kept (`applyTireInput` / `applyTirePill` in `src/services/events/setup-controls-events.ts` return early on non-positive or non-finite input), so a red dot always means the stored string itself does not parse;
- everything that needs a circumference calls `parseTire` and refuses instead of guessing. Tools then report their own message (for example the gear lab shows **"Check solver inputs."**, `opt.invalid`).

Fix the tire string, or reload a preset to restore a valid one.

### Numeric setup fields

The primary final drive, rev limiter and graph maximum are guarded in `src/services/events/primary-events.ts`:

| Field | Accepted | Otherwise |
| --- | --- | --- |
| Final drive | value > 0 | input ignored, state keeps the previous value, no message |
| Rev limiter | value > 1000 | input ignored, state keeps the previous value, no message |
| Graph max speed | value > 50 | input ignored, and the graph window is cleared when it is accepted |

A field that silently does nothing is usually one of these guards, not a frozen UI.

### Tool fields

Tool cards validate their own fields and print a fixed message (keys in `src/core/i18n/dictionary.en.ts`):

| Surface | Message |
| --- | --- |
| Custom car form | "Check the highlighted fields." (`custom.invalid`) |
| Spec-sheet quick add | "Check the highlighted fields." (`wiz.invalid`) |
| Gear lab solver, track advice and GPX import | "Check solver inputs." (`opt.invalid`) |
| Wheel fitment tool | "Invalid tire or rim" (`fit.invalid`) |
| Tire size tool | "Invalid tire format" (`tiretool.invalid`) |
| Telemetry gear recovery and inverse dyno | "No usable rpm/speed rows." (`tele.invalid`) |
| Secondary gear list | "Check secondary gears (e.g. 3.58, 2.05, 1.38)." (`compare.invalid`) |
| Lap sequence (Dynamics card, `src/components/dynamics-tool.ts`) | "Invalid sequence or unsafe downshift (over-rev)." (`dynamics.invalidSequence`) — the field also gets `aria-invalid` |

### Rejected CSV and JSON files

Each importer validates what it can and rejects rather than importing a partial result where the format allows it. Dyno CSV and INI rejection leave the previous state untouched; the garage and preset-bundle importers instead **skip invalid entries and save the valid ones** (documented in `docs/data-formats.md` §7–§8).

| Importer | Rejection message | Practical limits |
| --- | --- | --- |
| Dyno CSV (`src/core/math/dyno-csv.ts`) | "Invalid CSV: need rows with rpm + torque Nm (or power kW/cv)." (`engine.csvError`) | 5 MiB file cap (`MAX_DYNO_CSV_BYTES`), at least two non-comment rows, a recognisable header or 2–3 numeric columns, and at least two usable points after sanitising. The result is resampled to 64 points (`MAX_CURVE_POINTS`). |
| Telemetry CSV (pasted text, `src/core/math/telemetry-math.ts`) | "No usable rpm/speed rows." (`tele.invalid`) | 20 000-row cap per pass (`TELEMETRY_MAX_SAMPLES`), at least 5 samples, RPM and speed both positive; decimal comma accepted only in semicolon files. No file-size cap — the input is a textarea, not a file picker. |
| Inverse dyno (pasted trace, `src/core/math/inverse-dyno.ts`) | "No usable rpm/speed rows." (`tele.invalid`) | at least 6 pairs, strictly increasing time, non-decreasing speed, valid vehicle data. |
| Efficiency map CSV (`src/core/math/efficiency-map.ts`) | Parser only — no UI control calls it | Exact header `rpm,load,efficiency`, 2–256 unique samples, RPM 500–15000, load 0–1, efficiency above 0 and at most 1 (fractions, not percentages), 50 000-character cap. Dormant: documented in `docs/data-formats.md` §3. |
| Lap sequence textarea (`src/core/math/lap-sequence.ts`) | `dynamics.invalidSequence` | Four comma-separated cells per line `duration_s,gear,throttle,brake_g`; up to 32 rows and 4000 characters, at most 60 s per phase and 60 s summed across all phases; gear 1–8, pedals 0–1, brake 0–3 g; the whole input is rejected on one bad cell. |
| GPX track (`src/core/math/gpx-track.ts`) | "Check solver inputs." (`opt.invalid`) | At least 3 valid trackpoints with finite coordinates; no file-size cap and no `DOCTYPE`/`ENTITY` screening in the current parser. |
| Assetto Corsa INI (`src/services/events/export-events.ts`) | "Could not parse drivetrain.ini" (`export.iniError`) | 1 MB cap (`MAX_DRIVETRAIN_INI_BYTES`), at least one `GEAR_n` and a `FINAL` key. Nothing is applied on failure. |
| Full-state backup (`src/core/backup/state-backup.ts`) | "Invalid backup file." (`data.error`) | Envelope must carry `schemaVersion: 1` and a `values` object; non-string values are dropped. No size cap. |
| Garage / preset bundle (`src/components/backup-tool.ts`, drawer path) | Success counts cars in ("… cars imported", `data.carsIn`); there is no dedicated failure message | Every entry must pass the `isPreset` guard; invalid entries are skipped and valid ones saved individually. Malformed JSON logs to the browser console and nothing is written. No size cap. |

## Unexpected or suspicious model outputs

Check these in order before assuming a defect. All of them are inputs or view state, not physics changes.

| Check | Where it lives | Symptom if wrong |
| --- | --- | --- |
| Speed unit | `state.unit`, persisted as `haguruma-unit` | Speeds, splits and axis labels are in the other unit; mph mode shows 60 ft / 0–60 mph / ¼ mile instead of 0–100 / 0–160 / 400 m. |
| Power unit | `state.powerUnit`, persisted as `haguruma-power-unit` | The model always stores kW; only the display switches to cv. A "smaller" number in cv is the same power. |
| Active engine curve | `src/core/state/engine-curve.ts` | Anchors are used until a dyno CSV is imported. The status line reads "Dyno curve active: N points" and the anchor inputs are locked; "Back to anchors" restores the anchor model. |
| Running gear | `state.runningGear` | Front weight distribution, CoG height, wheelbase, track, road friction coefficient, tire compound, differential model and bias, and spring rates all feed the grip curve and the coast lock-up readout. |
| Comparison | `state.compareEnabled` | With the comparison on, dashed curves and a second grip curve are drawn, and the table shows tire and shift deltas against the secondary car. |
| Setup level | `haguruma-setup-level` / `haguruma-comp-level` | An input you expect to see may be hidden: the gears section is Full only, the engine and road-load sections are Medium, `rg-tire` is Easy while `rg-diff` and the chassis rows are Full, and the comparison's gear rows are Full. |
| Graph window | `state.graphWindow`, **not shared** in the URL | The visible window is independent of the axis maximum. A zoomed window can put a curve outside the plot. Floors are 5 km/h and 250 RPM (`VIEW_LIMITS.minSpanKmh/minSpanRpm`); ceilings are 2000 km/h and 30 000 RPM (`VIEW_LIMITS.maxKmh/maxRpm`). Use the fit control (or `Home`/`0` with the plot focused) to return to the full view; changing the axis maximum keeps the window, clamped into the new axis (`clampWindow`). |

Markers that look like errors but are results:

- **`drag-limited`** — appended to a gear's road-load cell when required wheel power exceeds available power in that gear (`table.dragLimited`).
- **`LIMIT`** — the shift cell reports the rev limiter as the best shift point for that pair, instead of a force-curve crossing (`th.shiftTip`).
- **`AERO`** — the graph label at the drag-limited top speed; `LIMIT: <rpm> RPM` is the redline label.

If the model still disagrees with another tool, the models are documented approximations with different assumptions; compare the input sets first. Assumptions are listed in [../MATH.md](../MATH.md).

## Local storage and data recovery

All persisted state uses eight allowlisted keys (`BACKUP_KEYS` in `src/core/backup/state-backup.ts`):

| Key | Contents |
| --- | --- |
| `haguruma-custom-presets` | Saved cars (versioned envelope). |
| `haguruma-lang` | Interface language. |
| `haguruma-theme` | `dark`, `oled` or `light`. |
| `haguruma-unit` | `kmh` or `mph`. |
| `haguruma-power-unit` | `kw` or `cv`. |
| `haguruma-setup-level` | Primary setup level. |
| `haguruma-comp-level` | Comparison setup level. |
| `haguruma-sessions` | Session log runs (versioned envelope). |

When storage is unavailable or full, the backup and preset-bundle paths report the storage error and continue; a key whose write fails is skipped rather than rolled back (the restore returns the count of written keys). One gap is worth knowing: `storeCustomPresets` (`src/core/presets/custom-store.ts`) swallows storage errors, so a car saved from the custom-car form can appear to succeed and then not persist. If saved cars vanish after a reload, check private-browsing mode or storage quota and use the Tools card backup path.

**Before any destructive step, export a full backup.** Tools → Local Backup → "Export Full Backup" writes `haguruma-backup-<YYYY-MM-DD>.json` containing the values of the eight keys above. That file is the recovery path.

What each import replaces:

| Import | Effect |
| --- | --- |
| Backup JSON (Tools → Local Backup) | **Direct apply, no preview and no rollback.** Validating the envelope (`schemaVersion: 1`, object `values`, string values only) writes each allowlisted key immediately; keys absent from the file are left untouched and unrelated keys are never written. The page is not reloaded, so a manual reload may be needed before every restored preference shows. |
| Garage / preset bundle (My Cars / Tools) | Merges into the saved cars: each valid entry is stored individually (incoming wins on a matching name), invalid entries are skipped, and the card reports how many cars were stored. No confirmation dialog appears. |

## Stale offline assets

The service worker is `public/sw.js`, cache name `haguruma-v3`. It is registered only in a production build, only on a secure context or loopback host (`src/services/events/pwa-events.ts`), so it is absent on the Vite dev server. Its behaviour:

- navigations are network-first, falling back to the cached request and then `./index.html`;
- same-origin GET assets (JS, CSS, car JSON) are stale-while-revalidate, capped at 60 entries, with the oldest evicted first;
- cached `.json` responses older than 7 days are dropped and re-fetched;
- on activation, caches other than the current name are deleted.

A stale interface therefore means either the app is running offline from the cache, or the service worker itself has not been replaced yet. Try, in order:

1. **Reload** the page. Navigations are network-first, so a normal reload normally picks up a new shell.
2. If it is still stale, **clear the site data for this origin** (browser settings → site data), or unregister the service worker and reload.

The consequence of step 2 is that all eight `localStorage` keys go with it: saved cars, language, theme, units, setup levels and the logged session runs. **Export a full backup first** if any of that matters.

## Sharing and export limits

The share hash carries setup fields only. Language, theme, speed/power unit and setup levels stay in `localStorage` and are not part of a link (`src/core/share/share-utils.ts`).

| Aspect | Behaviour |
| --- | --- |
| Primary encoding | The packed Base64URL `c` token (version byte 1). Verbose keys are the fallback and are used whenever the token cannot encode the setup (for example with a custom curve or a non-default tire compound). A legacy token is decoded when the v1 token fails. |
| Dyno curve | Always verbose: `curve=rpm:torque;rpm:torque;…`, decimal dot, capped at 64 points. |
| Graph window | **Not shared.** Only the axis maximum travels, as `max` (50–500 km/h). |
| Advanced dynamics | Non-default `d_*` sidecar keys (`d_limiter`, `d_gearbox`, `d_shiftTimesS`, `d_abs`, `d_sequenceCsv`, …) and the extended running-gear keys `rg_dp`/`rg_af`/`rg_cl`/`rg_tv`/`rg_hd`/`rg_ha` with their `crg_` mirrors. See `docs/data-formats.md` §11 for the full tables. |
| Unknown or out-of-range keys | Ignored. Only known keys are read, and numeric values outside their documented ranges are dropped. |
| Unknown differential model or compound ids | Ignored, so a link from an older build still loads (`rg_dm`, `rg_tc`). |
| QR modal | Generated locally with no network access. The encoder handles Latin-1 payloads up to version 10-L (271 data bytes); beyond that the modal shows "Setup too large for a QR code". |
| Exports | Graph PNG and SVG, print/PDF through the browser dialog, and drivetrain files: `haguruma-drivetrain.ini`, `haguruma-drivetrain.json`, `haguruma-transmission.jbeam`, `haguruma-gears-motec.csv`, `haguruma-gears-aim.csv`. Tools also export `haguruma-backup-<date>.json`, `haguruma-my-cars-<date>.json`, `haguruma-garage.json`, dated `haguruma-sessions-<date>.csv`/`.json` and one `<car name>.json` per saved car. There is no sequence CSV export; lap results render in the card only. |

A share link is not a backup: it carries the setup, not your garage, preferences or saved run.

## Browser permissions and platform features

| Feature | Requirement | When unavailable |
| --- | --- | --- |
| GPS timer (Session tool) | `navigator.geolocation`, a secure context and location permission | Without a geolocation object the tool prints "GPS unavailable here." (`sess.nogps`) and does not start. A `watchPosition` error callback (permission denied, timeout, position unavailable) paints the same `sess.nogps` line. |
| GPS sampling | `watchPosition` with `enableHighAccuracy: true`, `maximumAge: 0` | Fixes whose `coords.speed` is null, non-finite or negative are dropped; otherwise every fix appends to the attempt and updates the live speed line. Stopping the timer clears the watch and scores the attempt with `splitsFromSpeedSeries` (`src/core/math/timer-math.ts`): 0–100 km/h, 0–60 mph, 0–160 km/h, 60 ft, quarter-mile and trap speed, each `null` when the series never reaches that mark. There is no accuracy gate, sample cap or auto-stop in the current implementation. |
| Screen wake lock | `navigator.wakeLock` (`src/services/wake-lock.ts`) and a secure context | The request is silent: `acquireWakeLock` returns `false` on unsupported or denied and the toggle simply stays off, with no error message. The lock is a held sentinel released explicitly by the toggle. |
| Service worker | Secure context or loopback host | Registration is skipped, and the app runs online-only. |

## Build and native-wrapper problems

The native wrapper reads `dist/`, so the web build must exist and be synced before Gradle runs:

```bash
npm run build
npx cap sync android
```

Locally the single script does all three steps (`package.json`):

```bash
npm run androidAPP
# npm run build && npx cap sync android && cd android && .\gradlew.bat assembleDebug
```

The APK workflow (`.github/workflows/build-apk.yml`) runs on Node 20, installs **JDK 21** (temurin), installs `platforms;android-35` and `build-tools;35.0.0`, runs `npx cap sync android`, then `./gradlew assembleDebug`. It uploads the `haguruma-debug-apk` artifact and, on a published release, attaches the APK to the release. The APK is debug-signed with the SDK debug key: sideload and test only. Use JDK 21 locally to match CI.

The committed `android/` scaffold excludes generated outputs. `.gitignore` ignores `android/app/build/`, `android/.gradle/`, `android/app/src/main/assets/`, `android/capacitor-cordova-android-plugins/` and `android/local.properties`, so a clean checkout needs `npx cap sync android` before Gradle will assemble anything.

## Native behaviour is documented, not verified

No Android device or emulator is available in this environment. Everything above about the wrapper, screen wake lock, the manifest and the APK pipeline is read from source and configuration, not exercised on hardware. Treat native symptoms as unverified until reproduced on a real device.
