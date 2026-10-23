# HAGURUMA Product

<!-- impeccable:product-schema 1 -->

## Platform

web

The same web interface runs in a Capacitor Android wrapper. The wrapper does not imply a separate native design language.

## Users

Car enthusiasts, sim racers, amateur track drivers and tuners. Simple workflows and progressive Easy / Medium / Full input levels must serve both occasional and advanced users.

## Product Purpose

Help users understand and compare vehicle gearing and setup changes before trying them in a simulator or on a vehicle. Success means a user can change a parameter, see its effect, compare a second setup, and preserve or share the result.

## Operating Context

Desktop analysis and mobile, trackside use, including operation without a network connection. Users work with vehicle specifications, tire sizes, gear ratios, dyno curves and locally imported files.

## Capabilities and Constraints

- Client-side Vite and TypeScript application with no backend.
- User data stays local. No telemetry upload or cloud account is required.
- Offline operation and the Android wrapper are product requirements.
- Simulations and diagnostic advice are indicative, not certified predictions or safety guarantees.
- Existing saved setups and shared URLs must remain compatible.
- The requested release scope is every milestone from 0.6.0 through 0.9.0 in `TODO.md`. Unfinished work must not be represented as released functionality.
- English and Italian support must remain intact. German, Spanish and French dictionaries are implemented with compile-time key parity; their copy still needs review by native speakers.
- The 1.0.0 milestone is outside the current implementation scope.

## Brand Commitments

Preserve the HAGURUMA name and the existing application's identity while extending its tools. Documentation, comments and commit messages stay in English; user-facing content belongs in language dictionaries.

## Evidence on Hand

- `README.md`: current capabilities and operating instructions.
- `MATH.md`: documented formulas and modeling assumptions.
- `TODO.md`: release roadmap and completion ledger.
- `AGENTS.md`: architecture, conventions and compatibility requirements.
- `src/config/cars/`: vehicle catalog data.
- `tests/`: mathematical, catalog, storage and sharing regression tests.

No measured drivetrain-efficiency maps or instrument-grade sensor validation have been supplied. Do not invent calibration evidence, accuracy claims or benchmark results.

## Product Principles

1. Make the consequences of a setup change understandable.
2. Keep simple tasks accessible while exposing advanced controls progressively.
3. Preserve local data and backward-compatible sharing.
4. Distinguish model assumptions and estimates from measured evidence.
5. Keep offline workflows useful without accounts or a backend.

## Accessibility & Inclusion

Preserve keyboard navigation, visible focus, screen-reader labels, touch-friendly controls, reduced-motion behavior, and usable layouts across the existing themes. New chart interactions need non-gesture alternatives and textual readouts.

## Open Decisions

Supported telemetry vendor export variants, calibrated drivetrain maps, and measured phone-sensor accuracy remain unverified until representative data or hardware validation is available.
