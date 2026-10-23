# Vehicle presets and the catalog

A preset is a starting point for the primary or secondary vehicle: tire size, final drive, rev limiter, gear ratios, road-load data and running-gear parameters. Loading one fills the inputs; it does not lock them.

The catalog is a convenience list for comparison work, not a specification database. Read the [provenance](#provenance) section before quoting any value from it.

## Where presets live

One JSON file per vehicle, in `src/config/cars/`:

| Item | Value |
| --- | --- |
| Files | 26 (`src/config/cars/*.json`) |
| Presets exposed at runtime | 26 |
| File name | `<id>.json`, matching the entry `id` (enforced by `tests/catalog-quality.test.ts`) |
| Groups in use | `factory` (14 entries), `community` (12 entries) |
| Registry to edit when adding a vehicle | none |

A file that fails validation is dropped silently by the loader, so a broken entry disappears from the dropdown instead of raising an error. `tests/catalog-quality.test.ts` lints the raw files for exactly that reason.

## How the catalog is assembled

| Stage | File | What it does |
| --- | --- | --- |
| Discovery | `src/config/car-catalog.ts` | `import.meta.glob('./cars/*.json', { eager: true })` reads every file at build time; `unwrapModule` accepts a bare entry or a `default` wrapper. |
| Validation | `src/config/car-catalog.ts` | `validateCatalogEntry(entry)` returns one message per broken rule; `isCatalogEntry` is `validateCatalogEntry(entry).length === 0`. |
| Ordering | `src/config/car-catalog.ts` | `loadCatalogEntries()` keeps valid entries and sorts them by `id` (`localeCompare`), so the order is stable across platforms. |
| Export | `src/config/car-catalog.ts` | `catalogEntries: CarCatalogEntry[]` is the single list every consumer reads. |
| Preset maps | `src/config/presets.ts` | Builds `presets` (id → `GearPreset`), `presetMeta` (id → `{ label, group }`) and `presetGroups` (group → ids, in catalog order). |
| Dropdown | `src/services/events/preset-events.ts` | `buildPresetOptions()` renders the `factory` / `community` optgroups into the selectors at runtime; no `<option>` elements are hardcoded. |
| Quality lint | `src/config/catalog-quality.ts` | `catalogQualityIssues(preset)` flags implausible mass, power, anchors and gear spacing. Its own header states it is "not a substitute for datasheet validation". |

Custom cars are a separate path: they live in `localStorage` under `haguruma-custom-presets` and appear in the same selectors with the `custom:` prefix (`src/core/presets/custom-store.ts`). They are not catalog files and are not covered by the catalog tests.

## The `CarCatalogEntry` contract

Defined in `src/config/car-catalog.ts` and documented in `src/core/models.ts`.

| Field | Required | Rule |
| --- | --- | --- |
| `id` | yes | Non-empty string; matches the file name. |
| `label` | yes | Non-empty string; follows the [label convention](#label-convention). |
| `group` | yes | Non-empty string; the shipped files use `factory` or `community`. |
| `preset.tire` | yes | Non-empty string that `parseTire` accepts (see [troubleshooting.md](troubleshooting.md)). |
| `preset.fd` | yes | Number greater than 0. |
| `preset.redline` | yes | Number greater than 0. |
| `preset.gears` | yes | Non-empty array of positive numbers, strictly decreasing (first gear largest). |
| `preset.finalDrives` | no | At least two ratios, each between 1 and 10, and the list must contain the stock `fd`. |
| `preset.drivetrainOptions` | no | Object with any of `finalDrives`, `gearsets`, `lsds` (see below). |
| `preset.runningGear` | no to the validator | Object; `drivetrainLayout` must be `FWD`, `RWD` or `AWD`, `differentialType` must be `open`, `torsen`, `clutch_lsd`, `spool` or `custom`, and `tireCompoundId` must exist in the compound catalog. |

`preset.drivetrainOptions` rules:

| Key | Rule |
| --- | --- |
| `finalDrives` | Same rule as the top-level list, and it must contain the stock `fd`. |
| `gearsets` | 1–8 entries; each has a `label` of 1–40 characters and a `ratios` array whose values sit between 0.4 and 6.0 and decrease strictly. |
| `lsds` | Every id must exist in `DIFF_PRESETS` (`src/config/diff-presets.ts`). |

Validator messages are returned verbatim, for example `preset.gears must be strictly decreasing`, `preset.finalDrives must contain the stock fd` and `preset.drivetrainOptions.gearsets ratios must be within 0.4-6.0`.

The validator is the minimum bar, not the full requirement. The test suites also require `massKg`, `dragCd`, `frontalAreaM2`, `powerKw`, `peakTorqueNm`, `peakTorqueRpm`, `peakPowerRpm` and a `runningGear` block on every preset, and `npx vitest run tests/catalog-validation.test.ts tests/catalog-quality.test.ts` adds the plausibility ranges in `src/config/catalog-quality.ts`.

## Example files

The smallest file that satisfies `validateCatalogEntry` looks like this. It would still fail the preset tests and the quality lint, so treat it as the contract minimum, not a template:

```json
{
  "id": "example_car",
  "label": "Example Car (5-Speed, 4.10 FD)",
  "group": "community",
  "preset": {
    "tire": "205/55R16",
    "fd": 4.1,
    "redline": 7000,
    "gears": [3.5, 2.1, 1.5, 1.1, 0.85]
  }
}
```

A real file, `src/config/cars/e36_m3.json`, shows the practical shape:

```json
{
  "id": "e36_m3",
  "label": "BMW M3 E36 3.2 (5-Speed, 3.15 FD)",
  "group": "factory",
  "preset": {
    "tire": "225/45R17",
    "fd": 3.15,
    "redline": 7600,
    "gears": [4.23, 2.53, 1.67, 1.23, 1.0],
    "reverseRatio": 3.68,
    "massKg": 1470,
    "dragCd": 0.33,
    "frontalAreaM2": 2.0,
    "powerKw": 236,
    "peakTorqueRpm": 3250,
    "peakTorqueNm": 350,
    "peakPowerRpm": 7000,
    "runningGear": {
      "frontWeightDistribution": 0.51,
      "centerOfGravityHeightMm": 470,
      "wheelbaseMm": 2700,
      "trackWidthMm": 1445,
      "roadFrictionCoefficient": 1.1,
      "drivetrainLayout": "RWD",
      "differentialType": "clutch_lsd",
      "differentialBias": 0.35,
      "springRateFrontNmm": 34,
      "springRateRearNmm": 30,
      "lateralG": 0
    }
  }
}
```

Optional blocks actually in use today: `finalDrives` in `ae86_trueno.json`, `miata_na6.json` and `s2000_ap1.json`; downforce fields (`liftCoefficient`, `liftReferenceAreaM2`, `downforceFrontShare`) in `caterham_seven_160.json`, `mr2_sw20_turbo.json`, `r5_gt_turbo.json`, `rx7_fb_12a.json`, `samurai_sj413.json`, `sierra_rs_cosworth.json` and `tvr_griffith_500.json`. No catalog file uses `drivetrainOptions` yet, although the contract and the loader support it.

## Label convention

Labels follow `<Model> (<N>-Speed[, <Type>], <FD> FD)`:

- `<N>` is the forward gear count.
- `<Type>` appears only when the gearbox is not a manual (`DCT`, `Auto`).
- `<FD>` is the stock final drive formatted to two decimals.

| Branch | Real example | File |
| --- | --- | --- |
| Manual (no type) | `BMW M3 E36 3.2 (5-Speed, 3.15 FD)` | `src/config/cars/e36_m3.json` |
| Non-manual (with type) | `Toyota GR Supra A90 (8-Speed Auto, 3.15 FD)` | `src/config/cars/gr_supra_a90.json` |

Two-decimal formatting is not always the raw number: `caterham_seven_160.json` stores `fd: 3.909` and labels it `3.91 FD`, and `civic_type_r_fk8.json` stores `4.111` and labels it `4.11 FD`.

One file deviates from the pattern: `porsche_930_turbo.json` labels the car `Porsche 911 Turbo 3.3 (930, 4-Speed, 4.22 FD)`, inserting the chassis code before the gearbox. The gear count and final drive still match the data.

## Adding or editing a vehicle

1. Drop one file into `src/config/cars/` named `<id>.json`, following the shape above. No registry edit is needed.
2. Keep `gears` ordered from short (largest ratio) to tall (smallest). The loader and the validator both reject a rising list.
3. Satisfy the validator, then the tests: `npx vitest run tests/catalog-validation.test.ts tests/catalog-quality.test.ts` validates the raw files, gear spread and anchor plausibility, and `npx vitest run tests/presets.test.ts` checks the catalog count, tires, ratios, reverse ratios and running gear.
4. Bump the expected count in `tests/presets.test.ts` when you add a vehicle; it asserts `Object.keys(presets)` has length 26.
5. Run `npx tsc --noEmit` and `npm test` before committing, as described in [../CONTRIBUTING.md](../CONTRIBUTING.md).

The UI gear editor accepts ratios between 0.4 and 6.0 (`GRAPH_LIMITS` in `src/config/graph-constants.ts`) and at most 8 forward gears, while the catalog lint tolerates 0.25–8. All 26 shipped files sit inside the narrower UI range, so any catalog value that passes the lint but falls outside 0.4–6.0 could not be retyped in the editor.

## Catalog table

Read from the 26 JSON files. `Forward gears` lists the stored ratios in order, `Power` is `powerKw` (the model always stores kW; the interface can display cv).

| Preset id | Label | Tire | FD | Redline | Forward gears | Reverse | Power |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `ae86_trueno` | Toyota AE86 Sprinter Trueno (5-Speed, 4.30 FD) | `185/60R14` | 4.3 | 7600 | 3.587 / 2.022 / 1.384 / 1.0 / 0.861 | 3.56 | 95 kW |
| `alpine_a110_pure` | Alpine A110 Pure (7-Speed DCT, 3.60 FD) | `205/40R18` | 3.6 | 6500 | 3.72 / 2.32 / 1.61 / 1.18 / 0.92 / 0.76 / 0.62 | 3.3 | 185 kW |
| `caterham_seven_160` | Caterham Seven 160 (5-Speed, 3.91 FD) | `155/65R14` | 3.909 | 7700 | 3.428 / 2.108 / 1.379 / 1.0 / 0.757 | 3.583 | 59 kW |
| `civic_type_r_fk8` | Honda Civic Type R FK8 (6-Speed, 4.11 FD) | `245/30R20` | 4.111 | 7000 | 3.625 / 2.115 / 1.529 / 1.13 / 0.912 / 0.735 | 3.583 | 228 kW |
| `e36_m3` | BMW M3 E36 3.2 (5-Speed, 3.15 FD) | `225/45R17` | 3.15 | 7600 | 4.23 / 2.53 / 1.67 / 1.23 / 1.0 | 3.68 | 236 kW |
| `e46_m3` | BMW M3 E46 (6-Speed, 3.62 FD) | `255/40R18` | 3.62 | 8000 | 4.23 / 2.53 / 1.67 / 1.23 / 1.0 / 0.83 | 3.75 | 252 kW |
| `eclipse_1g_gs` | Mitsubishi Eclipse 1G GS (5-Speed, 4.32 FD) | `195/60R15` | 4.322 | 7000 | 3.363 / 1.947 / 1.285 / 0.939 / 0.756 | 3.083 | 110 kW |
| `focus_rs_mk1` | Ford Focus RS Mk1 (5-Speed, 3.82 FD) | `215/40R18` | 3.82 | 7000 | 3.67 / 2.14 / 1.45 / 1.03 / 0.77 | 3.56 | 160 kW |
| `golf_gti_mk7` | Volkswagen Golf GTI Mk7 (6-Speed, 3.87 FD) | `225/45R17` | 3.87 | 6800 | 3.5 / 2.1 / 1.5 / 1.14 / 0.94 / 0.79 | 3.4 | 169 kW |
| `gr_supra_a90` | Toyota GR Supra A90 (8-Speed Auto, 3.15 FD) | `255/35R19` | 3.15 | 6500 | 5.25 / 3.36 / 2.17 / 1.72 / 1.32 / 1.0 / 0.82 / 0.64 | 3.32 | 250 kW |
| `gr86` | Toyota GR86 / BRZ (6-Speed, 4.10 FD) | `215/40R18` | 4.1 | 7500 | 3.626 / 2.188 / 1.541 / 1.213 / 1.0 / 0.767 | 3.438 | 168 kW |
| `m2_competition` | BMW M2 Competition (7-Speed DCT, 3.15 FD) | `245/35R19` | 3.154 | 7000 | 4.808 / 2.592 / 1.701 / 1.278 / 1.0 / 0.844 / 0.671 | 3.2 | 302 kW |
| `miata_na6` | Mazda Miata NA (5-Speed, 4.30 FD) | `185/60R14` | 4.3 | 7200 | 3.136 / 1.888 / 1.33 / 1.0 / 0.814 | 3.758 | 85 kW |
| `mr2_sw20_turbo` | Toyota MR2 Turbo SW20 (5-Speed, 4.29 FD) | `225/50R15` | 4.285 | 7200 | 3.23 / 1.913 / 1.258 / 0.918 / 0.731 | 3.545 | 165 kW |
| `nissan_350z_base` | Nissan 350Z Base (6-Speed, 3.79 FD) | `225/45R18` | 3.789 | 7000 | 3.792 / 2.301 / 1.599 / 1.248 / 1.001 / 0.796 | 3.546 | 206 kW |
| `porsche_930_turbo` | Porsche 911 Turbo 3.3 (930, 4-Speed, 4.22 FD) | `265/40R16` | 4.22 | 6700 | 2.25 / 1.3 / 0.89 / 0.62 | 3.0 | 224 kW |
| `porsche_gt3` | Porsche 911 GT3 991 (6-Speed, 3.97 FD) | `305/30R20` | 3.97 | 9000 | 3.75 / 2.38 / 1.72 / 1.34 / 1.11 / 0.96 | 3.42 | 349 kW |
| `r5_gt_turbo` | Renault 5 GT Turbo (5-Speed, 3.73 FD) | `175/60R13` | 3.733 | 6500 | 3.09 / 1.842 / 1.32 / 0.967 / 0.757 | 3.727 | 88 kW |
| `rx7_fb_12a` | Mazda RX-7 FB 12A (5-Speed, 3.91 FD) | `185/70R13` | 3.909 | 7000 | 3.674 / 2.217 / 1.432 / 1.0 / 0.825 | 3.542 | 85 kW |
| `s2000_ap1` | Honda S2000 AP1 (6-Speed, 4.10 FD) | `225/50R16` | 4.1 | 9000 | 3.133 / 2.045 / 1.481 / 1.161 / 0.971 / 0.811 | 2.8 | 177 kW |
| `samurai_sj413` | Suzuki Samurai SJ413 (5-Speed, 3.73 FD) | `195/80R15` | 3.727 | 6000 | 3.652 / 1.947 / 1.423 / 1.0 / 0.795 | 3.466 | 47 kW |
| `sierra_rs_cosworth` | Ford Sierra RS Cosworth (5-Speed, 3.64 FD) | `195/60R14` | 3.64 | 6800 | 3.36 / 1.81 / 1.26 / 1.0 / 0.83 | 3.36 | 150 kW |
| `tvr_griffith_500` | TVR Griffith 500 (5-Speed, 3.31 FD) | `225/50R15` | 3.31 | 6250 | 2.95 / 1.95 / 1.34 / 1.0 / 0.73 | 2.76 | 254 kW |
| `uno_turbo_ie` | Fiat Uno Turbo i.e. (5-Speed, 3.59 FD) | `175/60R13` | 3.59 | 6500 | 3.91 / 2.24 / 1.52 / 1.16 / 0.91 | 3.91 | 78 kW |
| `viper_rt10` | Dodge Viper RT/10 (6-Speed, 3.07 FD) | `335/35R17` | 3.07 | 6000 | 2.66 / 1.78 / 1.3 / 1.0 / 0.74 / 0.5 | 2.9 | 298 kW |
| `volvo_240` | Volvo 240 Turbo (5-Speed, 4.10 FD) | `195/65R15` | 4.1 | 6000 | 3.67 / 2.17 / 1.37 / 1.0 / 0.79 | 3.55 | 114 kW |

Reverse ratios are stored as `reverseRatio` and are excluded from the graph curves. Every file also carries `massKg`, `dragCd`, `frontalAreaM2`, `peakTorqueRpm`, `peakTorqueNm`, `peakPowerRpm` and a `runningGear` block; those columns are omitted here because the table would be unreadable, and they are visible in the files themselves.

## Provenance

What is verifiable from the repository:

- Each file contains exactly the keys `id`, `label`, `group` and `preset`. There is no `source`, `date`, `citation`, `url`, `note` or `verified` field anywhere in `src/config/cars/` (checked across all 26 files).
- `CarCatalogEntry` (`src/config/car-catalog.ts`) has no provenance field either, so no file could record a source even if an author wanted to.
- The catalog tests check structure, ranges and internal plausibility. `src/config/catalog-quality.ts` says in its own header that it is "broad catalog plausibility checks, not a substitute for datasheet validation".

What follows from that:

- The values should be treated as user-provided approximations for comparing setups against each other, not as verified manufacturer specifications. Several entries are plainly rounded or idealised (identical gear sets reused across models, generic drag coefficients, zero lateral load on every chassis).
- No value in this catalog has been checked against a published datasheet, a workshop manual or a measured vehicle in this repository.
- If the catalog is ever presented as factory data, every entry needs maintainer review against a citable source, and the entry schema needs a place to record that source. Neither exists today.

The physics that consumes these numbers is documented in [../MATH.md](../MATH.md), including the list of what is not modelled.

## Related catalogs

Three more lists live in `src/config/` and follow the same append-one-row pattern:

| Catalog | File | Extend by |
| --- | --- | --- |
| Differentials | `src/config/diff-presets.ts` | Appending a `DIFF_PRESETS` row (`id`, i18n `labelKey`, physics `type`, `accLock`, `coastLock`) and adding the label key to every dictionary. |
| Tire compounds | `src/config/tire-compounds.ts` | Appending a `TIRE_COMPOUNDS` row (`id`, `labelKey`, `treadwear`, `gripGain`); `gripGain` multiplies the road friction coefficient. |
| Drivetrain efficiency | `src/config/drivetrain-eff.ts` | Editing the FWD/RWD/AWD defaults (0.90 / 0.85 / 0.80). |

Differential ids are stored in saved setups and in the `rg_dm` share key, so keep existing ids stable. Tire compound ids are validated by `validateCatalogEntry` through `TIRE_COMPOUND_IDS`.

## Tests and lint

| Command or file | Covers |
| --- | --- |
| `tests/presets.test.ts` | 26 presets, parsable tires, `fd > 1`, redline ≥ 6000, at least 4 gears, descending gears, power and mass present, exact reverse ratios, running-gear enums, unique ids, `factory`/`community` groups. |
| `tests/catalog-validation.test.ts` | The validator itself: rejects missing fields, rising gears, unknown enums, `finalDrives` without the stock `fd`, bad gearsets, unknown LSD ids and unknown compounds. |
| `tests/catalog-quality.test.ts` | Lints every raw file in `src/config/cars/`, checks the file name matches the `id`, and exercises the plausibility rules. |
| `npx vitest run tests/catalog-validation.test.ts tests/catalog-quality.test.ts` | Runs the validation and quality suites together (there is no `lint:catalog` script in `package.json`). |
| `tests/diff-presets.test.ts` | Differential catalog order, lock range and i18n labels. |
