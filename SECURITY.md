# Security Policy

## Supported Versions

Only the latest commit on the `main` branch is actively maintained.

| Version | Supported |
| ------- | --------- |
| latest  | ✅ |
| legacy  | ❌ |

## Reporting Issues

HAGURUMA is a client-side TypeScript visualizer with no backend, no authentication, and no data collection. While not safety-critical hardware, incorrect ratio math or misleading top-speed figures could lead to poor tuning decisions if used beyond its educational scope.

If you find a calculation error, rendering bug, broken preset, or dependency vulnerability:

1. Open a [standard GitHub issue](https://github.com/camiu01/haguruma/issues) with exact reproduction steps.
2. For security-related flaws (supply-chain, XSS vectors), open a [Private Vulnerability Report](https://github.com/camiu01/haguruma/security/advisories/new).