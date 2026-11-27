# Accessibility conformance report

[← README](../README.md) · [Docs index](README.md)

Target: **WCAG 2.1 level AA**. Audited for v1.0.0 on 2026-11-27.

## Method

- **Automated gate.** `e2e/a11y.e2e.ts` runs axe-core with the `wcag2a`, `wcag2aa`, `wcag21a` and
  `wcag21aa` rule sets against the production build in each theme (dark, OLED, light). CI fails on
  any violation.
- **Keyboard.** The same suite focuses the plot, steps the crosshair with the arrow keys and checks
  that the snap readout is announced.
- Manual screen-reader passes (NVDA, TalkBack) were not run for this report.

## Results

| Criterion | Status | Notes |
| :--- | :--- | :--- |
| 1.4.3 Contrast (minimum) | Supports | All three themes pass. The light theme accents, gear labels and plot legend were darkened to reach 4.5:1. |
| 1.4.10 Reflow / landscape | Supports | Phone landscape (`max-height: 500px`) slims the header and gives the plot the viewport. |
| 2.1.1 Keyboard | Supports | Every control is reachable by Tab. The plot is focusable: ←/→ step through shift points, Esc clears. |
| 2.3.3 / 2.2.2 Motion | Supports | `prefers-reduced-motion` disables every transition and animation (`base.css`). |
| 2.4.3 Focus order | Supports | Disabled groups (comparison, road load, LSD locks) are `inert`, so focus never lands on dimmed controls. Drawer and modals trap and restore focus. |
| 2.5.3 Label in name | Supports | Buttons with visible text keep it as their accessible name; the tooltip becomes `aria-description`. |
| 2.5.5 Target size | Supports | Touch targets are at least 44 px. |
| 4.1.3 Status messages | Supports | The plot snap readout (`#graph-hud`) is a polite `role="status"` live region. |

## Known limitations

- The plot itself is an SVG image; its data is available in text through the gear breakdown table,
  not by exploring the drawing with a screen reader.
- Colors distinguish gears in the plot; gear numbers are always printed next to them.
