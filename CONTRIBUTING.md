# Contributing to HAGURUMA

Thanks for considering a contribution to Haguruma — a client-side TypeScript application for gear-ratio visualization, shift-drop analysis and road-load physics.

## Code of Conduct

This project follows standard open-source community guidelines. Be respectful, constructive and considerate in issues, discussions and pull requests. See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## Before you start

| Document | Why you may need it |
| --- | --- |
| [README.md](README.md) | What the app does and how to run it. |
| [docs/architecture.md](docs/architecture.md) | Directory layout, module responsibilities, data flow, extension guides. |
| [AGENTS.md](AGENTS.md) | The coding conventions you must follow. |
| [MATH.md](MATH.md) | The formulas, constants and assumptions behind every number. |
| [docs/testing.md](docs/testing.md) | Test commands, categories and CI checks. |
| [docs/data-formats.md](docs/data-formats.md) | Import and export formats and their limits. |
| [docs/presets.md](docs/presets.md) | The vehicle catalog and how to extend it. |
| [docs/deployment.md](docs/deployment.md) | Hosting, PWA and Android builds. |

The architecture summary in one paragraph: a single-page Vite + TypeScript app with no backend, one mutable state singleton in `src/core/state/app-state.ts`, and one refresh entry point, `renderAll(refs)` in `src/views/render-all.ts`. Physics is pure and isolated under `src/core/math/`. Details are in [docs/architecture.md](docs/architecture.md).

## Adding a new vehicle preset

1. **Drop one file** into `src/config/cars/` named `<id>.json` (for example `mx5_nd.json`):

   ```json
   {
     "id": "mx5_nd",
     "label": "Mazda MX-5 ND (6-Speed, 4.30 FD)",
     "group": "factory",
     "preset": {
       "tire": "195/50R16",
       "fd": 4.3,
       "redline": 7500,
       "gears": [3.36, 2.02, 1.46, 1.0, 0.83, 0.68]
     }
   }
   ```

   The file must satisfy the `CarCatalogEntry` interface (`id`, `label`, `group`, `preset`). Keep gears ordered from short (large) to tall (small). An optional `finalDrives` array must list at least two ratios and include the stock `fd`. `src/config/car-catalog.ts` discovers every file through `import.meta.glob('./cars/*.json')`, and `src/config/presets.ts` exposes `presets`, `presetMeta` and `presetGroups`, so no registry edit is needed.

2. **Option building is runtime.** `buildPresetOptions()` in `src/services/events/preset-events.ts` renders the factory and community optgroups into both selectors. Never add hardcoded `<option>` elements to `index.html`.

3. **Cover it with tests.** `tests/presets.test.ts` validates tire format, `fd > 1`, the redline range and descending gears; `tests/catalog-validation.test.ts` enforces the full contract and `tests/catalog-quality.test.ts` flags implausible values. Update the catalog count referenced in [docs/presets.md](docs/presets.md) when you add a vehicle, and do not present preset values as verified manufacturer data — see the provenance section of that document.

## Adding a differential model

1. Append one row to `DIFF_PRESETS` in `src/config/diff-presets.ts`:

   ```ts
   { id: 'lsd_2_5way', labelKey: 'running.diff25Way', type: 'clutch_lsd', accLock: 0.55, coastLock: 0.35 }
   ```

2. Add the label key to every dictionary (parity is compile-time checked).
3. Keep `id` stable — it is stored in `RunningGear.differentialModelId` and in the share hash as `rg_dm`.
4. Add the id to `LSD_MODEL_IDS` only if it uses clutch-LSD physics and should show the accel and coast lock inputs.
5. Cover it with `tests/diff-presets.test.ts` (catalog order, lock range, i18n labels).

## Adding or changing a translation

1. Add the English copy to `src/core/i18n/dictionary.en.ts`, which owns the `DictKey` union. Every other language file is typed as `Record<DictKey, string>`, so a missing key is a compile error.
2. Add the same key to `dictionary.it.ts`, `dictionary.de.ts`, `dictionary.es.ts` and `dictionary.fr.ts`.
3. Reference long-form copy from data modules through `DictKey` (for example `setup.fix.*`, `setup.feel.*`) and resolve it with `t(key, lang)`. Never inline user-facing strings in feature files.
4. Use `data-i18n` for text, `data-i18n-tip` for tooltips or `data-i18n-ph` for placeholders in the markup.
5. Do **not** nest help-dot spans inside `data-i18n` elements — the `textContent` replacement strips children.
6. `tests/i18n.test.ts` asserts identical key sets and non-empty values across every locale. Keep it passing; do not weaken it.

## Adding a graph layer

1. Create a leaf module in `src/services/graph/graph-<layer>.ts` exporting one focused function.
2. Wire it in `src/services/graph/graph-renderer.ts` inside `drawGraph()` at the correct position in the documented paint order: cached static bitmap (background → grids → redline band → titles) → curves → shift drops → aero-wall shading → comparison → grip limits.
3. Document it with TSDoc (`@brief`, `@param`, `@return`).
4. Add tests for any pure logic in `tests/`.

## Adding a calculation

1. Put the pure math in `src/core/math/<name>-math.ts` with a `@file` and `@brief` header.
2. Validate inputs and return a neutral value instead of throwing, and never propagate `NaN` or `Infinity`.
3. Keep SI internally and convert units only at the display boundary.
4. Add a mirror suite in `tests/<name>-math.test.ts` and document the relation in [MATH.md](MATH.md).

## Theme system

Three themes: `dark` (default), `oled` (pure black) and `light`. Persisted in `localStorage`.

- CSS uses `[data-theme='dark']`, `[data-theme='oled']` and `[data-theme='light']` selectors.
- **Every Tailwind colour class needs a light-mode override** in `overrides.css`, for example `[data-theme='light'] .text-gray-300 { color: #334155 !important; }`.
- OLED needs explicit overrides for translucent utilities such as `bg-gauge/80` and `bg-gauge/50`.
- Graph palettes are per theme in `graph-theme.ts`.

## Conventions

The full list is in [AGENTS.md](AGENTS.md). In short:

- **Tabs** for indentation, never spaces.
- **Single quotes** for strings; semicolons required.
- TSDoc on every function: `@brief`, `@param`, `@return`.
- Files **under 400 lines**, functions **under 50 lines**.
- Avoid nested conditionals deeper than three levels.
- All comments, documentation and commit messages in **English**.
- Commits follow **Conventional Commits** (`feat:`, `fix:`, `docs:`, …).

## Development and testing checklist

Before opening a pull request:

- [ ] `npx tsc --noEmit` — zero type errors.
- [ ] `npm test` — all Vitest suites pass.
- [ ] `npm run lint:catalog` if you touched the vehicle catalog.
- [ ] `npm run build && npm run preview` — smoke test the built output: tire validation, the km/h and mph toggle, preset load, the comparison card, the theme cycle, the graph tooltip, and gear add and remove.
- [ ] Verify light and OLED overrides if you added new colour classes.
- [ ] Update the owning documentation when behavior changes. Do not duplicate content between documents; see [docs/README.md](docs/README.md).

## Submitting pull requests

1. Fork and branch: `git checkout -b feature/my-feature`
2. Commit with Conventional Commits: `git commit -m "feat(presets): add MX-5 ND preset"`
3. Push: `git push origin feature/my-feature`
4. Open a pull request targeting `main`. Explain the change, the data sources, and the testing performed. If you changed a preset value, say where the number came from.

## Building the Android APK

1. The `android/` scaffold is committed; generated outputs (the Gradle build directory and the synced web assets) are ignored and regenerated by `npx cap sync android` after `npm run build`.
2. Trigger the **Build APK** workflow manually (Actions → Build APK → Run workflow), or publish a GitHub release: on `release: published` the same workflow builds the web app, syncs Capacitor, assembles with JDK 21, and attaches `haguruma-<tag>.apk` to the release. It uploads the `haguruma-debug-apk` artifact in both cases.
3. The debug APK is signed with the SDK debug key — sideloading and testing only, never a store release. See [docs/deployment.md](docs/deployment.md) and [SECURITY.md](SECURITY.md).
