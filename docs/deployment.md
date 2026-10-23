# Deployment

Haguruma ships to three targets from one Vite build: a static web bundle
(`dist/`), the same bundle published to GitHub Pages, and a Capacitor-wrapped
debug APK for Android. There is no server component, no database and no runtime
configuration. See [../README.md](../README.md) for the feature overview,
[architecture.md](./architecture.md) for module layout and
[testing.md](./testing.md) for the checks that run before a deploy.

All statements below come from reading the repository files cited inline. No
workflow, build or deployment has been executed while writing this document —
see [Not verified](#not-verified).

## Static web build

```bash
npm run build     # npx tsc --noEmit && npx vite build
npm run preview   # serve the built output locally
```

`package.json` defines the build as a typecheck followed by `vite build`, so a
type error fails the build before any bundling happens. `vite.config.ts` sets:

| Option | Value | Effect |
|:--|:--|:--|
| `base` | `'./'` | Relative asset URLs in the emitted HTML |
| `publicDir` | `'public'` | `public/sw.js`, `public/manifest.webmanifest`, `public/icons/`, `public/favicon.svg` are copied verbatim into the output |
| `build.outDir` | `'dist'` | Output directory (`dist/` is gitignored) |
| `server.port` | `5173` | Dev server only |

`base: './'` means the emitted entry references assets relatively, e.g.
`./assets/index-<hash>.js`, instead of rooting them at `/assets/...`. That is
what makes the bundle usable from a sub-path, not only from a domain root.

Tailwind is compiled into the bundle through PostCSS (no CDN script); the only
remote requests the page makes at runtime are Google Fonts.

### Hosting requirements

- Serve the directory as static files, keeping the file layout intact; do not
  rewrite or relocate the relative asset paths.
- **No rewrite or fallback rules are needed.** The application is a single page
  whose state lives in the URL hash (`#...`); the hash is never sent to the
  server, so every URL the app produces already resolves to `index.html`.
- The page loads web fonts from Google Fonts at runtime (`index.html`:
  `fonts.googleapis.com`, `fonts.gstatic.com`). A client without outbound
  access to those hosts falls back to the local font stack; everything else,
  including Tailwind, is served from the origin as part of the bundle.

`npm run preview` starts Vite's preview server over the built `dist/` for a local
check. The config only overrides the dev-server port, so the preview port is
Vite's default unless passed on the command line.

## GitHub Pages

`.github/workflows/cd.yml` publishes the web build. Triggers: a push to `main`
and manual `workflow_dispatch`. Permissions: `contents: read`, `pages: write`,
`id-token: write`. Concurrency group `pages` with `cancel-in-progress: true`.

| Job | Step | Detail |
|:--|:--|:--|
| `build` | `actions/checkout@v4` | — |
| | `actions/setup-node@v4` | `node-version: '20'`, `cache: npm` |
| | `npm ci` | Lockfile install |
| | `npm run build` | Typecheck + Vite build into `dist/` |
| | `actions/upload-pages-artifact@v3` | `path: dist` |
| `deploy` | `actions/deploy-pages@v4` | `id: deployment`, needs `build` |
| | environment | `github-pages`, `url: ${{ steps.deployment.outputs.page_url }}` |

The deployed content is the `dist/` directory, including `sw.js`, the manifest
and the icons copied from `public/`.

The canonical Pages URL is **not stored in this repository** — no `github.io`
or `pages.dev` reference exists in any tracked file. (The only hostname of that
shape is `https://haguruma.app/#c=...` used as a synthetic share URL in
`tests/qr-svg.test.ts`, which is a test fixture rather than a hosting address.)
The authoritative value at deploy time is the `page_url` output of the `deploy`
step; the public address is whatever the repository's Pages configuration
serves. Publishing through the Pages deployment API also requires the
repository's Pages source to be set to "GitHub Actions", a setting that lives in
repository settings rather than in this repository.

## PWA

`public/manifest.webmanifest` declares:

| Field | Value |
|:--|:--|
| `name` / `short_name` | `Haguruma` |
| `display` | `standalone` |
| `orientation` | `any` |
| `start_url` / `scope` | `.` |
| `theme_color` / `background_color` | `#0b0d11` |
| `icons` | `icons/icon-192.svg` (192×192, `any`), `icons/icon-512.svg` (512×512, `any maskable`) |

`index.html` links the manifest, sets `apple-touch-icon` to
`./icons/icon-192.svg`, and uses `viewport-fit=cover`. Its `theme-color` meta is
`#0f141c`, which differs from the manifest's `#0b0d11`.

Registration lives in `src/services/events/pwa-events.ts` (`bindPwaEvents`). It
skips registration when `import.meta.env.DEV` is set (Vite dev server), when
`navigator.serviceWorker` is missing, or when
`src/core/pwa/pwa-utils.ts:isSecureContext` rejects the origin (the browser's
`isSecureContext` flag, `https:`/`wss:`, or a loopback hostname —
`localhost`, `127.0.0.1`, `[::1]`). A failed registration is logged and does not
break the app. Otherwise it registers `./sw.js`.

### Service-worker strategy (`public/sw.js`)

| Aspect | Implementation |
|:--|:--|
| Cache name / version | `haguruma-v3` |
| Entry cap | `MAX_ENTRIES = 60`, oldest entries evicted first |
| JSON expiry | `JSON_MAX_AGE_MS` = 7 days, applied to cached responses whose URL ends in `.json` |
| `install` | Precaches `./`, `./index.html`, `./manifest.webmanifest`; failures are swallowed |
| `activate` | Deletes every cache whose name is not `haguruma-v3` |
| Fetch filter | `GET` only, `http:`/`https:` only |
| Navigations (`req.mode === 'navigate'`) | Network-first: the fresh response is cached, and on failure the cache is consulted, falling back to `./index.html` |
| Other requests | Stale-while-revalidate: a cached hit is returned immediately while a background fetch refreshes the cache and trims it to 60 entries; on a network failure with no hit, `./index.html` is returned |

An expired JSON entry is deleted and treated as a miss, so a stale `.json`
payload is re-fetched instead of served.

### Offline scope and limits

- The precache holds three **same-origin** URLs. No cross-origin resource is
  precached, so the Google Fonts stylesheets are not part of the app-shell
  cache; a cold client with no network falls back to the local font stack
  instead of failing. A previously fetched cross-origin response can still end
  up in the runtime cache through `cache.put` in the stale-while-revalidate
  branch, but that is not guaranteed.
- The hashed JS/CSS bundles under `./assets/` are same-origin and cached on first
  use, so after one online visit the app shell and its scripts are available
  offline.
- The vehicle catalog is **not** fetched at runtime: `src/config/car-catalog.ts`
  loads `./cars/*.json` with `import.meta.glob(..., { eager: true })`, inlining
  the presets into the JS bundle at build time. No `fetch()` call exists in
  `src/`, so the `.json` expiry rule in `sw.js` is defensive; the header comment
  about "car JSON presets" does not match the current bundling.

### How a new deploy reaches an existing client

1. A navigation is network-first, so the browser fetches the new `index.html`,
   caches it and serves it. The page now references new content-hashed assets.
2. New hashed assets are cache misses and are fetched from the network. Old
   hashed assets stay cached until the 60-entry cap evicts them.
3. Unhashed same-origin files (`sw.js`, `manifest.webmanifest`, icons,
   `favicon.svg`) are stale-while-revalidate, so they can be one load behind.
4. `sw.js` contains no `skipWaiting()` or `clients.claim()`, and no update
   listener exists in `src/` (`updatefound`/`controllerchange` are absent), so an
   already-open tab keeps its scripts until it is reloaded or navigated. There is
   no in-app "new version available" prompt.
5. The `haguruma-v3` cache name is only bumped by editing `sw.js`; a change to
   that file is re-fetched and re-installed, and `activate` purges the previous
   cache on the next worker activation.

## Android / Capacitor

`capacitor.config.ts`:

| Field | Value |
|:--|:--|
| `appId` | `com.haguruma.app` |
| `appName` | `Haguruma` |
| `webDir` | `dist` |

The `android/` Capacitor scaffold is committed; generated outputs are not
(`.gitignore` lists `android/app/build/`, `android/.gradle/`,
`android/app/src/main/assets/`, `android/capacitor-cordova-android-plugins/`,
`android/local.properties`). The synced web assets therefore live under
`android/app/src/main/assets/` and are produced by `npx cap sync android`, which
copies `dist/` into the Android project.

Build settings come from the scaffold: `android/variables.gradle` sets
`minSdkVersion 23`, `compileSdkVersion 35`, `targetSdkVersion 35`;
`android/build.gradle` uses the Android Gradle Plugin `8.7.2`;
`android/gradle/wrapper/gradle-wrapper.properties` pins Gradle `8.11.1`;
`android/app/build.gradle` sets `applicationId "com.haguruma.app"`,
`versionCode 11` and `versionName "0.8.0"`. Note the version lag: `package.json`
reports `0.9.0`, so the native `versionName` has not been bumped to match.

Local build (`package.json`), Windows-oriented:

```bash
npm run androidAPP   # npm run build && npx cap sync android && cd android && .\gradlew.bat assembleDebug
```

### `build-apk.yml`

`.github/workflows/build-apk.yml` — job `apk` on `ubuntu-latest`, permissions
`contents: write`. Triggers: manual `workflow_dispatch` and `release: published`.

| Step | Detail |
|:--|:--|
| `actions/checkout@v4` | — |
| `actions/setup-node@v4` | `node-version: '20'`, `cache: npm` |
| `npm ci` | Lockfile install |
| `npm run build` | Typecheck + web build (no `npm test` in this workflow) |
| `actions/setup-java@v5` | `distribution: temurin`, `java-version: '21'` |
| Android SDK packages | `$ANDROID_SDK_ROOT/cmdline-tools/latest/bin/sdkmanager`: licenses accepted with `yes \| ... --licenses`, then `platform-tools`, `platforms;android-35`, `build-tools;35.0.0` |
| `npx cap sync android` | Copies `dist/` into the Android project and updates plugins |
| `chmod +x android/gradlew` | Makes the wrapper executable on the runner |
| `./gradlew assembleDebug` | Run with `working-directory: android` |
| Rename | `app-debug.apk` → `haguruma-${{ github.ref_name }}.apk` |
| `actions/upload-artifact@v4` | Name `haguruma-debug-apk`, path `android/app/build/outputs/apk/debug/haguruma-*.apk` |
| `softprops/action-gh-release@v2` | Only `if: github.event_name == 'release'`; attaches `android/app/build/outputs/apk/debug/haguruma-*.apk` to the published release |

Exact Gradle artifact path before renaming:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

### Signing status

The workflow runs the `debug` variant only. The APK is signed with the Android
SDK debug key generated by the Android Gradle Plugin on the build machine. That
makes it suitable for sideloading and personal testing only — never a store
release. No release keystore exists in the repository (no `.jks` or `.keystore`
file is tracked), and a store release would require a keystore held outside it,
plus its own signing configuration. This document does not describe store
publication steps because the repository contains none.

### JDK

The workflow requests **JDK 21** (temurin) via `actions/setup-java@v5`, and the
Android Gradle Plugin 8.7.2 / Gradle 8.11.1 combination runs on it.
[../CONTRIBUTING.md](../CONTRIBUTING.md) and [../README.md](../README.md) also
state JDK 21.

A JDK is required for any local native build; `npm run androidAPP` relies on
whatever `JAVA_HOME` the machine provides, not on the workflow's setup step.

### Android permissions

`android/app/src/main/AndroidManifest.xml` declares:

| Declaration | Why |
|:--|:--|
| `android.permission.INTERNET` | The WebView loads Google Fonts at runtime and fetches updated assets |
| `android.permission.ACCESS_COARSE_LOCATION` | Speed/GPS sessions; `src/components/session-tool.ts` calls `navigator.geolocation.watchPosition` with `enableHighAccuracy` |
| `android.permission.ACCESS_FINE_LOCATION` | Same, for accurate speed traces |
| `<uses-feature android:name="android.hardware.location.gps" android:required="false" />` | GPS is optional hardware; the app installs on devices without it |

No background-location permission is declared, and no other permission is
requested. Location access is foreground-only, requested by the Web Geolocation
API at the moment the session timer is started. `tests/android-manifest.test.ts`
asserts exactly this contract, including that `ACCESS_BACKGROUND_LOCATION` is
absent and that the `FileProvider` is not exported.

The only Capacitor plugin linked into the native project
(`android/capacitor.settings.gradle`) is `@capacitor/android` itself; it adds no
permission entry.

## Not verified

- No workflow, build, `cap sync`, Gradle task or deployment was run while
  producing this document. Everything above describes the configuration as it
  stands in the working tree, not observed output.
- No Android device, emulator, JDK or Android SDK is present in this
  environment, so the APK path, artifact name and release attachment are read
  from `.github/workflows/build-apk.yml`, not observed.
- The published Pages URL is not derivable from this repository; only the
  workflow's `page_url` output knows it.
- Bundle size numbers are not quoted here; no size report is generated by the
  build.
