# Contributing to HAGURUMA

First off, thank you for considering contributing to **HAGURUMA** — a client-side TypeScript app for gear-ratio visualization, shift-drop analysis, and road-load physics.

Please review this document to ensure a smooth workflow.

---

## Code of Conduct

This project adheres to standard open-source community guidelines. Be respectful, constructive, and considerate in issues, discussions, and pull requests. See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

---

## Architecture Overview

Single-page Vite + TypeScript app, **zero backend**. All state lives in a single mutable store (`src/core/state/app-state.ts`). Every render passes through `renderAll()` (`src/views/render-all.ts`).

```
src/
  main.ts                          # Bootstrap: refs + events + first paint
  core/
    models.ts                      # SpeedUnit, TireSpec, GearPreset, AppState
    math/                          # tire-math, speed-math, aero-math, traction-math, shift-math
    state/app-state.ts             # defaultState + mutable singleton
    units/unit-utils.ts            # getSpeedStep(), getUnitLabel(), getMaxRpm()
    i18n/                          # en/it dictionaries + language.ts
    theme/theme.ts                 # dark / oled / light toggle
    presets/custom-store.ts        # localStorage persistence for custom cars
    share/share-utils.ts           # URL hash encode/decode
  config/
    presets.ts                     # Factory vehicle presets
    gear-colors.ts                 # 8-color palette
    graph-constants.ts             # GRAPH_PADDING, GRAPH_STYLE per theme, GRAPH_LIMITS
  services/
    dom/element-refs.ts            # Typed DOM handles (ElementRefs)
    graph/                         # canvas-setup, graph-axes, curves, drops, renderer, tooltip, theme
    events/                        # One binder per control group
  components/
    gear-list.ts                   # Editable gear rows + add/remove
    gear-table.ts                  # Top-speed + shift-drop + torque/traction/opt-shift
    custom-car.ts                  # Save/load/export/import custom presets
  views/render-all.ts              # resizeCanvas + drawGraph + renderTable
  styles/main.css                  # Theme variables, overrides, scrollbars, help-dot
```

---

## Adding a New Vehicle Preset

1. **Add the catalog entry** in `src/config/car-catalog.json`:
   ```json
   { "id": "mx5_nd", "label": "Mazda MX-5 ND (6-Speed, 4.30 FD)", "group": "factory", "preset": { "tire": "195/50R16", "fd": 4.3, "redline": 7500, "gears": [3.36, 2.02, 1.46, 1.0, 0.83, 0.68] } }
   ```
   Keep gears ordered from short (large) to tall (small). `src/config/presets.ts` loads the catalog at build time and exposes `presets`, `presetMeta` and `presetGroups`.

2. **Option building is runtime** — `buildPresetOptions()` in `src/services/events/preset-events.ts` renders factory/community optgroups into both selectors; never add hardcoded `<option>` elements to `index.html`.

3. **Cover with Tests** — `tests/presets.test.ts` already validates tire format, `fd > 1`, redline range, and descending gears.

---

## Adding a New i18n Key

1. Add the key to both `en` and `it` dictionaries in `src/core/i18n/dictionaries.ts`.
2. Use `data-i18n` (text), `data-i18n-tip` (tooltip), or `data-i18n-ph` (placeholder) in the HTML.
3. Do **not** nest help-dot spans inside `data-i18n` elements — `textContent` replacement strips children.

---

## Adding a Graph Layer

1. Create a leaf module in `src/services/graph/graph-<layer>.ts` exporting one focused function.
2. Wire it in `src/services/graph/graph-renderer.ts` inside `drawGraph()` in the correct paint order: background → grids → redline band → curves → shift drops → comparison → titles.
3. Document with TSDoc (`@brief`, `@param`, `@return`).
4. Add tests for pure logic in `tests/`.

---

## Theme System

Three themes: `dark` (default), `oled` (pure black), `light` (white). Persisted in localStorage.

- CSS uses `[data-theme='dark']`, `[data-theme='oled']`, `[data-theme='light']` selectors.
- **Every Tailwind color class needs a light-mode override** in `main.css` (e.g. `[data-theme='light'] .text-gray-300 { color: #334155 !important; }`).
- Same for OLED: `bg-gauge/80`, `bg-gauge/50` need explicit overrides.
- Graph palettes are per-theme in `graph-theme.ts`.

---

## Conventions (must follow)

- **Tabs** for indentation, never spaces.
- **Single quotes** for strings; semicolons required.
- TSDoc on every function: `@brief`, `@param`, `@return`.
- Files **under 400 lines**, functions **under 50 lines**.
- Avoid nested conditionals deeper than 3 levels.
- All comments, docs, and commit messages in **English**.
- Commits follow **Conventional Commits** (`feat:`, `fix:`, etc.).

---

## Development & Testing Checklist

Before opening a pull request:

- [ ] `npx tsc --noEmit` — zero type errors.
- [ ] `npm test` — all Vitest suites pass.
- [ ] `npm run build && npm run preview` — manual smoke test: tire validation, kmh/mph toggle, preset load, comparison, theme cycle, tooltip, gear add/remove.
- [ ] Verify light mode overrides if you added new color classes.

---

## Submitting Pull Requests

1. Fork and branch: `git checkout -b feature/my-feature`
2. Commit with Conventional Commits: `git commit -m "feat(presets): add MX-5 ND preset"`
3. Push: `git push origin feature/my-feature`
4. Open a PR targeting `main`. Explain the change, data sources, and testing performed.