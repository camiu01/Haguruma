# Security Policy

## Supported Versions

Only the latest commit on the `main` branch is actively maintained.

| Version | Supported |
| ------- | --------- |
| latest  | ✅ |
| legacy  | ❌ |

## Reporting Issues

HAGURUMA is a client-side TypeScript visualizer with no backend, no authentication, and no data collection. While not safety-critical hardware, incorrect ratio math or misleading top-speed figures could lead to poor tuning decisions if used beyond its educational scope. Simulation results (0–100, quarter mile, grip limits) are estimates for comparison only — never use them for road or track decisions without independent verification.

If you find a calculation error, rendering bug, broken preset, or dependency vulnerability:

1. Open a [standard GitHub issue](https://github.com/camiu01/Haguruma/issues) with exact reproduction steps.
2. For security-related flaws (supply-chain, XSS vectors via share links / custom JSON import), open a [Private Vulnerability Report](https://github.com/camiu01/Haguruma/security/advisories/new).

### Input surfaces to keep hardened

- **Share URL hash** — packed `c` token or verbose keys, decoded with range checks and unknown-key ignore; corrupt tokens are rejected, never `eval` or inject raw hash content.
- **Custom car JSON import** — validated field-by-field before `localStorage`; reject non-finite numbers and oversized gear arrays.
- **Drivetrain INI import** — `GEAR_n` / `FINAL` / `REVERSE` parsed with strict ranges; unknown keys, sections and comments ignored.
- **Service worker** — same-origin app shell plus capped stale-while-revalidate asset cache; report any cross-origin cache poisoning.

## Android builds

The **Build APK** workflow runs manually or automatically on published releases (attaching `haguruma-<tag>.apk` to the release). It produces a debug APK signed with the SDK debug key — sideloading and personal testing only, never a store release. A signed release would require a private keystore held outside this repository (never commit keystores, passwords, or signing configs). The Capacitor wrapper adds no extra permissions and runs the same local-only web app inside the system WebView: still no backend, no accounts, no data collection.