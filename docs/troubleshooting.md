# Troubleshooting

This page covers observable problems: rejected inputs, suspicious results, import failures, stored-data recovery, stale offline assets, sharing limits, platform features and the native build. It does not restate the physics — for why a model behaves as it does, read [../MATH.md](../MATH.md). For the exact shape and limits of every import and export, read [data-formats.md](data-formats.md).

Two things apply to everything below:

- Every number the app produces is a model estimate. A surprising result is usually an input difference, not a defect.
- The application has no backend: imported files are parsed in the browser and persisted only in `localStorage`. The page itself does load third-party assets (the Tailwind CDN script and Google Fonts in `index.html`), which are ordinary requests to those hosts.

## Invalid or inconsistent inputs

### Tire strings

`parseTire` (`src/core/math/tire-math.ts`) matches `/^(\d{3})\/(\d{2})\s*R?(\d{2})$/i`. That means a three-digit width, a two-digit aspect ratio, an optional `R`, and a two-digit rim diameter: `225/45R17` and `225/45 R17` parse, while `205/55ZR17`, `205/55/17`, `95/45R17` and `225/45R17C` do not.

When the string does not parse:

- the status dot next to the field turns red and the message **"Invalid format (e.g. 225/45R17)"** appears (`primary.tireError` in `src/core/i18n/dictionary.en.ts`, rendered through `#tire-error`);
- the typed string is still written to `state.primaryTire` (`src/services/events/primary-events.ts`), so it also travels in the share link;
- everything that needs a circumference calls `parseTire` and refuses instead of guessing. Tools then report **"Check the highlighted values and try again."** (`lab.invalid`).

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

`toolNumber` sets `min`, `max` and `step`, and `toolValue` (`src/components/tool-form.ts`) rejects empty, non-finite or out-of-range values. On rejection it sets `aria-invalid="true"` on the field and moves focus there; the tool prints its own message. The invalid state is styled by `.track-tool [aria-invalid='true']` in `src/styles/track-tools.css`.

| Surface | Message | Focus behaviour |
| --- | --- | --- |
| Most tools | "Check the highlighted values and try again." (`lab.invalid`) | focus moves to the rejected field |
| Custom car form | "Check the highlighted fields." (`custom.invalid`) | invalid fields get a red border, focus does not move |
| Spec-sheet quick add | "Enter a name, valid tire, 2–8 decreasing ratios, FD 1–10, 3000–12000 RPM, 300–4000 kg and 5–1500 kW; then review again." (`quick.invalid`) | focus moves to the name field |
| Advanced shift times | "Enter one finite shift time from 0 to 3 seconds for each forward upshift." (`advanced.invalidTimes`) | focus moves to the shift-time field |
| Lap sequence | "Use the five-column header and 1–60 phases, each 0.01–60 seconds, at most 180 seconds total…" (`lap.invalid`) | focus moves to the command box |
| Pyrometer / sensitivity | `lab.invalid` | focus moves to the rejected field |

### Rejected CSV and JSON files

Each importer validates the whole file and rejects it rather than importing a partial result. Files that fail are not partially applied: the previous state stays active.

| Importer | Rejection message | Practical limits |
| --- | --- | --- |
| Dyno CSV (`src/core/math/dyno-csv.ts`) | "Invalid CSV: need rows with rpm + torque Nm (or power kW/cv)." (`engine.csvError`) | 5 MB file cap, at least two non-comment rows, a recognisable header or 2–3 numeric columns, and at least two usable points after sanitising. The result is resampled to 64 points (`MAX_CURVE_POINTS`). |
| Telemetry CSV (`src/core/math/telemetry-math.ts`) | "Choose a CSV under 10 MB with increasing time in seconds, engine RPM and speed in km/h." (`telemetry.invalid`) | 10 MB file cap, a header containing both an RPM-like and a speed-like channel, a time channel, no `mph`/`mps` speed column, 50 000-row cap, and at least 3 usable rows before ratios are shown. |
| Inverse dyno from telemetry | "No usable steady-gear acceleration. Include the gear column and a full-throttle run on a known grade." (`telemetry.noDyno`) | Needs a full-throttle steady-gear run. |
| Efficiency map (`src/core/math/efficiency-map.ts`) | "Use a CSV headed rpm,load,efficiency with 2–256 unique samples: RPM 500–15000, load 0–1, efficiency above 0 and at most 1. Maximum 50 kB." (`advanced.invalidMap`) | Exact header, 50 kB cap, 2–256 unique samples, fractions rather than percentages. |
| Lap command box (`src/core/math/lap-sequence.ts`) | `lap.invalid` | Exact header `duration_s,gear,throttle,brake,rev_match` plus an optional `handbrake` column, 1–60 phases, 0.01–60 s per phase, 180 s total, gear 1–8, pedals 0–1, `rev_match` 0 or 1, 8000-character box. |
| GPX track (`src/core/math/gpx-track.ts`) | `lab.invalid` | 5 MB cap, `<!DOCTYPE`/`<!ENTITY` rejected, at least 3 valid trackpoints. |
| Assetto Corsa INI (`src/services/events/export-events.ts`) | "Could not parse drivetrain.ini" (`export.iniError`) | 1 MB cap, at least one `GEAR_n` and a `FINAL` key. Nothing is applied on failure. |
| Saved GPS run (`src/core/presets/performance-store.ts`) | "No valid saved run. Arm a new GPS run first." (`timer.noSession`) | Session must be `schemaVersion: 1`, at most 5000 samples, strictly increasing time, speed 0–500 km/h, accuracy 0–15 m. |
| Backup file (`src/core/presets/backup-store.ts`) | "Invalid backup. Choose a Haguruma JSON backup smaller than 2 MB." (`backup.invalid`) | 2 MB cap, `schemaVersion: 1`, allowlisted keys only. |
| Garage file (`src/core/presets/backup-store.ts`) | `backup.invalid` | 2 MB cap, every car validated, at most 500 cars, never a silently filtered subset. |

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
| Graph window | `state.graphWindow`, shared as `z_min`/`z_max`/`z_rmin`/`z_rmax` | The visible window is independent of the axis maximum. A zoomed window can put a curve outside the plot. Floors are 5 km/h and 250 RPM; ceilings are 2000 km/h and 30 000 RPM. Use the reset or fit control (or a double-tap) to return to the full view; changing the axis maximum also clears the window. |

Markers that look like errors but are results:

- **`drag-limited`** — appended to a gear's road-load cell when required wheel power exceeds available power in that gear (`table.dragLimited`).
- **`LIMIT`** — the shift cell reports the rev limiter as the best shift point for that pair, instead of a force-curve crossing (`th.shiftTip`).
- **`AERO`** — the graph label at the drag-limited top speed; `LIMIT: <rpm> RPM` is the redline label.

If the model still disagrees with another tool, the models are documented approximations with different assumptions; compare the input sets first. Assumptions are listed in [../MATH.md](../MATH.md).

## Local storage and data recovery

All persisted state uses eight allowlisted keys (`BACKUP_KEYS` in `src/core/presets/backup-store.ts`):

| Key | Contents |
| --- | --- |
| `haguruma-custom-presets` | Saved cars (versioned envelope). |
| `haguruma-lang` | Interface language. |
| `haguruma-theme` | `dark`, `oled` or `light`. |
| `haguruma-unit` | `kmh` or `mph`. |
| `haguruma-power-unit` | `kw` or `cv`. |
| `haguruma-setup-level` | Primary setup level. |
| `haguruma-comp-level` | Comparison setup level. |
| `haguruma-performance-session` | Last saved GPS run. |

When storage is unavailable or full, the backup and quick-add paths report **"Browser storage is unavailable or full. Keep your backup file and try again."** (`backup.storageError`) and the restore path rolls back the keys it had already written. One gap is worth knowing: `storeCustomPresets` (`src/core/presets/custom-store.ts`) swallows storage errors, so a car saved from the custom-car form can appear to succeed and then not persist. If saved cars vanish after a reload, check private-browsing mode or storage quota and use the Tools card backup path, which does report the failure.

**Before any destructive step, export a full backup.** Tools → Local Backup → "Export Full Backup" writes `haguruma-backup.json` containing the values of the eight keys above. That file is the recovery path.

What each import replaces:

| Import | Effect |
| --- | --- |
| Backup JSON (Tools → Local Backup) | Validated first and shown as a preview. Applying it replaces the keys present in the file and leaves every other key unchanged; reload the app to apply restored preferences ("Backup restored. Reload the app to apply the restored preferences."). |
| Garage / custom-car JSON (My Cars) | Merges into the saved cars, replacing cars with matching names while others stay unchanged. A confirmation dialog appears when a name would be overwritten ("This file replaces saved cars with matching names. Other cars stay unchanged. Import these cars?"). |

## Stale offline assets

The service worker is `public/sw.js`, cache name `haguruma-v3`. It is registered only in a production build, only on a secure context or loopback host (`src/services/events/pwa-events.ts`), so it is absent on the Vite dev server. Its behaviour:

- navigations are network-first, falling back to the cached request and then `./index.html`;
- same-origin GET assets (JS, CSS, car JSON) are stale-while-revalidate, capped at 60 entries, with the oldest evicted first;
- cached `.json` responses older than 7 days are dropped and re-fetched;
- on activation, caches other than the current name are deleted.

A stale interface therefore means either the app is running offline from the cache, or the service worker itself has not been replaced yet. Try, in order:

1. **Reload** the page. Navigations are network-first, so a normal reload normally picks up a new shell.
2. If it is still stale, **clear the site data for this origin** (browser settings → site data), or unregister the service worker and reload.

The consequence of step 2 is that all eight `localStorage` keys go with it: saved cars, language, theme, units, setup levels and the saved GPS run. **Export a full backup first** if any of that matters.

## Sharing and export limits

The share hash carries setup fields only. Language, theme, speed unit, power unit and setup levels stay in `localStorage` and are not part of a link (`src/core/share/share-utils.ts`).

| Aspect | Behaviour |
| --- | --- |
| Primary encoding | The packed Base64URL `c` token. Verbose keys are the fallback and are used whenever the token cannot encode the setup. |
| Dyno curve | Always verbose: `curve=rpm:torque;rpm:torque;…`, decimal dot, capped at 64 points. |
| Graph window | `z_min`, `z_max`, `z_rmin`, `z_rmax`. All four must be present and in range (span ≥ 5 km/h, ≥ 250 RPM); otherwise the window is ignored and the full view is used. |
| Unknown or out-of-range keys | Ignored. Only known keys are read, and numeric values outside their documented ranges are dropped. |
| Unknown differential model ids | Ignored, so a link from an older build still loads (`rg_dm`). |
| Advanced extension | `view=force`, `margin=1`, `sim=<json>` (under 25 000 characters), `rgx`/`crgx` (under 1000 characters). |
| QR modal | Generated locally with no network access. The encoder handles latin-1 payloads up to version 10-L (271 data bytes); beyond that the modal shows "Setup too large for a QR code". |
| Exports | Graph PNG and SVG, print/PDF through the browser dialog, and drivetrain files: `haguruma-drivetrain.ini`, `haguruma-drivetrain.json`, `haguruma-transmission.jbeam`, `haguruma-gears-motec.csv`, `haguruma-gears-aim.csv`. Tools also export `haguruma-sequence.csv`, `haguruma-run.csv`, `haguruma-run.json`, `haguruma-backup.json` and one `<car name>.json` per saved car. |

A share link is not a backup: it carries the setup, not your garage, preferences or saved run.

## Browser permissions and platform features

| Feature | Requirement | When unavailable |
| --- | --- | --- |
| GPS performance timer | `navigator.geolocation`, a secure context and location permission | Permission failure or a 15 s timeout reports "GPS access failed. Check location permission and secure-context support, then arm a new run." (`timer.permission`). With no geolocation object at all, `PerformanceRecorder` reports `hardware.unsupported`, whose text is the screen-awake wording: "This device could not enable screen awake. Check permissions and power-saving settings." — misleading for a GPS problem. |
| GPS precision gates | Accuracy ≤ 15 m, speed ≤ 500 km/h, fresh timestamp | "GPS speed unavailable or accuracy worse than 15 m. Move to an open area and wait." (`timer.accuracy`); starting above 1 km/h reports `timer.standstill`; samples more than 2 s apart stop the run with `timer.gap`. Recording also stops after 120 s or 5000 samples, when the page is hidden, or on `pagehide`. Coordinates are discarded; only time, speed and accuracy are kept. |
| Screen wake lock | Capacitor `KeepAwake`, and a device that reports support | "This device could not enable screen awake. Check permissions and power-saving settings." (`hardware.unsupported`). The request is released when the document becomes hidden. |
| Native haptics | A native platform (the Capacitor wrapper) | The toggle only sets a flag and prints no status. On the web build it has no visible effect, and failures are swallowed (`src/services/hardware/device-feedback.ts`). |
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

The APK workflow (`.github/workflows/build-apk.yml`) runs on Node 24, installs **JDK 21** (temurin), installs `platforms;android-35` and `build-tools;35.0.0`, runs `npx cap sync android`, then `./gradlew assembleDebug`. It uploads the `haguruma-debug-apk` artifact and, on a published release, attaches the APK to the release. The APK is debug-signed with the SDK debug key: sideload and test only.

The committed `android/` scaffold excludes generated outputs. `.gitignore` ignores `android/app/build/`, `android/.gradle/`, `android/app/src/main/assets/`, `android/capacitor-cordova-android-plugins/` and `android/local.properties`, so a clean checkout needs `npx cap sync android` before Gradle will assemble anything.

**Documentation contradiction (JDK version).** The workflow pins JDK 21 and [../CONTRIBUTING.md](../CONTRIBUTING.md) also says JDK 21, but the committed `README.md` (`git show HEAD:README.md`) states the workflow "assembles `app-debug.apk` (JDK 17)". JDK 21 is the version the build actually uses; the JDK 17 claim in that README text was wrong. The README currently in the working tree no longer states a JDK version, so this only matters if you read the older text. Use JDK 21 locally to match CI.

## Native behaviour is documented, not verified

No Android device or emulator is available in this environment. Everything above about the wrapper, screen wake lock, native haptics, the manifest and the APK pipeline is read from source and configuration, not exercised on hardware. Treat native symptoms as unverified until reproduced on a real device.
