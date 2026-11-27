# Privacy and Content Security Policy

[← README](../README.md) · [Docs index](README.md)

## Privacy statement

Haguruma has no backend, no account and no telemetry.

- **No analytics, no tracking, no cookies.** The app makes no request that reports usage.
- **Everything stays on the device.** Setups, custom cars, sessions, theme and language live in
  `localStorage`; imported CSV, GPX and JSON files are read in the browser and never uploaded.
- **Sharing is explicit.** A share link or QR code encodes the setup in the URL hash. The hash is
  never sent to a server; whoever you send the link to sees the setup.
- **One third-party host.** Fonts and icons load from Google Fonts (`fonts.googleapis.com`,
  `fonts.gstatic.com`). Google receives the usual request metadata (IP address, user agent) when
  they are fetched. Once cached by the service worker, the app works offline.
- **Android.** The Capacitor build ships the same bundle and declares `INTERNET` plus
  coarse/fine location. Location is requested only when you start the GPS session timer, and the
  readings stay on the device.

## Content Security Policy

Production builds carry a CSP `<meta>` tag injected by `vite.config.ts` (`cspPlugin`, build only,
so the dev server's HMR websocket keeps working):

| Directive | Value | Why |
| :--- | :--- | :--- |
| `default-src` | `'self'` | Nothing loads from elsewhere unless listed. |
| `script-src` | `'self'` | No inline or remote scripts. The pre-paint theme guard is the external `public/boot-theme.js`. |
| `style-src` | `'self' 'unsafe-inline' https://fonts.googleapis.com` | Per-gear colors are set with inline `style` attributes; Google Fonts stylesheets. |
| `font-src` | `'self' https://fonts.gstatic.com` | Font files. |
| `img-src` | `'self' data: blob:` | QR codes and PNG/SVG exports. |
| `connect-src` | `'self'` | Catalog JSON and service-worker fetches stay same-origin. |
| `object-src` | `'none'` | No plugins. |
| `base-uri` / `form-action` | `'self'` / `'none'` | No base hijack; the app submits no forms. |

`frame-ancestors` cannot be set from a `<meta>` tag. GitHub Pages does not allow custom headers;
a host that does should also send `Content-Security-Policy: frame-ancestors 'none'`.

`e2e/smoke.e2e.ts` loads the built app and fails on any console error, which includes CSP
violations.
