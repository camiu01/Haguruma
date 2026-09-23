# AGENTS.md — HAGURUMA

## Quick start
```bash
npm install
npm run dev              # vite dev server on :5173
npx tsc --noEmit         # typecheck
npm test                 # vitest run
npm run build            # tsc --noEmit; vite build
npm run preview          # vite preview (static host test)
```

## Architecture
- Single-page Vite + TypeScript app, **zero backend**.
- All state lives in `src/core/state/app-state.ts` (mutable singleton).
- Every refresh goes through `renderAll(refs)` in `src/views/render-all.ts`.
- Entrypoint: `src/main.ts` → `bootstrap()` on `DOMContentLoaded`.

## Directory layout
```
src/
  main.ts                         # bootstrap only
  core/
    models.ts                     # SpeedUnit, TireSpec, GearPreset, AppState, etc.
    math/                         # tire-math, speed-math, aero-math, traction-math, shift-math
    setup/                        # setup-matrix.ts (wizard data) + setup-guide-content.ts (handbook copy)
    state/app-state.ts            # defaultState + singleton
    units/unit-utils.ts          # getSpeedStep(), getUnitLabel(), getMaxRpm()
    i18n/                         # dictionary.en.ts + dictionary.it.ts + language.ts (applyI18n)
  config/
    presets.ts                    # preset maps built from the catalog loader
    car-catalog.ts                # CarCatalogEntry model + import.meta.glob loader
    cars/                         # one <id>.json per vehicle, drop-in to add
    gear-colors.ts                # 8-color palette
    graph-constants.ts            # GRAPH_PADDING, GRAPH_STYLE_DARK/OLED/LIGHT, GRAPH_LIMITS
  services/
    dom/element-refs.ts           # Typed DOM handles (ElementRefs)
    graph/                        # canvas-setup, graph-axes, graph-curves, graph-shift-drops, graph-renderer, graph-tooltip, graph-theme
    events/                       # One binder per control group
  components/
    gear-list.ts                  # Editable gear rows + add/remove
    gear-table.ts                 # Top-speed + shift-drop + torque/traction/opt-shift table
    custom-car.ts                 # Save/load/export/import custom presets
    setup-guide.ts                # Setup shell injection + card assembly
    card/                         # base Card + one file per specialized card + index.ts barrel
  views/render-all.ts             # resizeCanvas + drawGraph + renderTable
  styles/
    main.css                      # Hub only: @imports below, no rules
    tokens.css                    # Theme variables (dark/oled/light)
    base.css                      # Base elements, safe-area, scrollbars, small viewports
    drawer.css                    # Slide-over drawer + relocated header controls
    components.css                # Cards, accordions, tables, inputs, help-dot
    shell.css                     # Header controls, modal, preset combobox
    overrides.css                 # OLED + light Tailwind overrides
    setup-guide.css               # Wizard badges, feel cues, procedure steps
index.html                        # Shell layout; feature shells inject into mount points
capacitor.config.ts               # Native wrapper (webDir dist)
android/                          # Committed Capacitor scaffold (generated outputs ignored)
.github/workflows/build-apk.yml   # Manual workflow: web build + assembleDebug + APK artifact
```

## Key conventions (must follow)
- **Tabs** for indentation (never spaces).
- **Single quotes** for strings; semicolons required.
- Every function needs a TSDoc block: `@brief`, `@param`, `@return`.
- Every file starts with `@file` + `@brief`.
- Feature modules must stay **under 400 lines**, functions **under 50 lines**.
- Exempt from the file cap: `index.html` (app shell), `styles/main.css` (import hub),
  and the dictionary system (`src/core/i18n/dictionaries.ts` holds every language in one file).
  New static markup belongs in component-owned `inject*Shell()` builders, not in `index.html`.
- Avoid nested conditionals deeper than 3 levels.
- One component per file in `components/card/` (base `Card`, specialized cards, `index.ts` barrel). Cards receive data via props/options, render with `textContent` only, and cause no side effects.
- Phone content order is controlled by responsive `order-*` utilities (graph + table first below `xl`); desktop order stays untouched.
- All comments, docs, and commit messages in **English**.
- Commits follow **Conventional Commits** (`feat:`, `fix:`, etc.).
- Do **not** add AI-slop comments like `// increment counter` above `i++`.

## Theme system
- `src/core/theme/theme.ts` — three themes: `'dark' | 'oled' | 'light'`.
- Toggle cycles dark → oled → light. Persisted in localStorage.
- CSS uses `[data-theme='dark']`, `[data-theme='oled']`, `[data-theme='light']` selectors.
- **Every Tailwind text/background/border class needs a light-mode override** in `overrides.css` (e.g. `[data-theme='light'] .text-gray-300 { color: #334155 !important; }`).
- New feature CSS goes in its own `styles/<feature>.css` module (theme tokens only) and is wired via `@import` in `main.css`, keeping hub order: tokens, base, drawer, components, shell, overrides, feature.
- Same for OLED: `bg-gauge/80`, `bg-gauge/50` need explicit OLED overrides.
- `document.documentElement.classList.toggle('dark', currentTheme !== 'light')` controls Tailwind dark mode.
- Graph has separate palettes per theme in `graph-theme.ts`.

## Graph layer order (must maintain in drawGraph)
1. Background (`graph-axes.ts: drawBackground`)
2. Grid, redline band, labels (`graph-axes.ts: drawGrid, drawRedlineBand, drawLabels`)
3. Primary curves + shift drops + markers (`graph-curves.ts`, `graph-shift-drops.ts`)
4. Comparison curves + shift drops (if enabled, dashed style)
5. Titles + legend (`graph-axes.ts`)

## Important DOM patterns
- `data-i18n` for text content → `applyI18n()` sets `el.textContent = t(key)`.
- `data-i18n-tip` for tooltip attributes → sets `title`, `data-tip`, `aria-label`.
- `data-i18n-ph` for placeholder attributes.
- All English copy lives in `dictionary.en.ts`, all Italian copy in `dictionary.it.ts` (compile-time parity). Data modules hold `DictKey` references and resolve via `t(key, lang)` — never inline user-facing strings.
- All static elements are resolved in `element-refs.ts` via `document.getElementById()`.
- Feature shells are injected by `inject*Shell(mount)` builders called in `bootstrap()` **before** `getElementRefs()`, so ids, `[data-accordion]` sections and `[data-i18n]` nodes exist for refs, accordion binding and `applyI18n()`.
- **Do not put help-dot spans inside `data-i18n` elements** — `textContent` replacement strips children. Wrap the span in a separate parent.

## Custom car system
- Saved in localStorage key `haguruma-custom-presets`.
- Preset dropdown prefix: `custom:` (constant `CUSTOM_PREFIX`).
- `custom-car.ts`: `readCustomForm()` validates 13 fields, returns `{name, preset}`.
- `applyPreset()` already handles `peakTorqueRpm`, `peakTorqueNm`, `peakPowerRpm` from `GearPreset`.
- Export downloads a `.json` file with the full `GearPreset`; Import reads a file, validates, and saves.

## Testing
- `vitest` framework, tests in `tests/` mirroring `src/`.
- Run single file: `npx vitest run tests/tire-math.test.ts`.
- Always run `npx tsc --noEmit` + `npm test` before committing.

## Share/URL
- Full setup encoded in URL hash, restored on page load via `restoreFromUrl()`.
- Uses `navigator.clipboard.writeText()` with textarea fallback.

## v3
- `vite.config.ts` uses `base: './'` for GitHub Pages deployment.
- `tsconfig.json`: strict mode, `noEmit`, `moduleResolution: bundler`.
- Tailwind loaded via CDN (`cdn.tailwindcss.com`) with custom colors in `index.html`.