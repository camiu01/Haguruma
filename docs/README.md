# Haguruma documentation

[← README](../README.md)

## Documents

| Document | What it covers |
| :--- | :--- |
| [Architecture](architecture.md) | Directory layout, module ownership and data flow of the app as it exists today. |
| [Data formats](data-formats.md) | HAGURUMA is a client-side single-page app: every format below is read and written in the browser, and no file leaves the device. |
| [Deployment](deployment.md) | Haguruma ships to three targets from one Vite build: a static web bundle (`dist/`), the same bundle published to GitHub Pages, and a Capacitor-wrapped debug… |
| [Vehicle presets and the catalog](presets.md) | A preset is a starting point for the primary or secondary vehicle: tire size, final drive, rev limiter, gear ratios, road-load data and running-gear parameters. |
| [Testing](testing.md) | Haguruma is a pure client-side SPA with no backend: physics, codec and presentation modules are unit-tested with Vitest, the vehicle catalog is checked as… |
| [Troubleshooting](troubleshooting.md) | This page covers observable problems: rejected inputs, suspicious results, import failures, stored-data recovery, stale offline assets, sharing limits,… |
| [HAGURUMA — User Guide](user-guide.md) | HAGURUMA plots engine RPM against vehicle speed for every gear, computes the RPM you land on after each upshift, estimates road-load physics (mass, aero… |

## Reading paths

This directory holds the task-oriented documentation. The repository root holds the entry point and the reference documents. Each topic has one canonical location; other files summarize and link rather than repeat it.

### Where to start


### Reading paths

**Using the app.** Start with the [README](../README.md) for the workflow overview, then work through [user-guide.md](user-guide.md). Keep [troubleshooting.md](troubleshooting.md) open when an input is rejected. You do not need [MATH.md](../MATH.md) to use the app, but its assumptions list explains what the numbers do not include.

**Understanding the numbers.** Read [MATH.md](../MATH.md) end to end: it defines the notation, the constants, each implemented relation, the input guards, the validation anchors and the explicit list of what is not modeled. [testing.md](testing.md) explains which of those relations are pinned by tests and which are not.

**Extending the code.** Read [architecture.md](architecture.md) for the layout and data flow, then [../AGENTS.md](../AGENTS.md) for the mandatory coding conventions. [testing.md](testing.md) covers how to add a suite, and [presets.md](presets.md) and [data-formats.md](data-formats.md) cover the data-side extension points.

**Maintaining and releasing.** Read [deployment.md](deployment.md) for the build, hosting and Android paths, [testing.md](testing.md) for the CI checks, and [../SECURITY.md](../SECURITY.md) for the hardening boundaries. [../CONTRIBUTING.md](../CONTRIBUTING.md) holds the pull-request process.

### Canonical locations


### Documentation conventions

- English throughout, matching the project convention for comments and commit messages.
- Relative links between repository documents, so the set stays readable on a branch.
- Every statement about behavior should be traceable to a source file. Where behavior is implemented but not verified against real data or hardware, the text says so.
- Illustrative values are labelled as illustrative. Preset data is not presented as verified manufacturer specification.
- GitHub-flavored Markdown, with `$...$` and `$$...$$` math where a formula is needed.
