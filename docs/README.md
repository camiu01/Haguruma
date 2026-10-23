# Haguruma documentation

This directory holds the task-oriented documentation. The repository root holds the entry point and the reference documents. Each topic has one canonical location; other files summarize and link rather than repeat it.

## Where to start

| If you want to... | Read |
| --- | --- |
| Understand what the app does and run it | [../README.md](../README.md) |
| Use every panel and tool | [user-guide.md](user-guide.md) |
| Understand the formulas, constants and assumptions | [../MATH.md](../MATH.md) |
| Import or export data | [data-formats.md](data-formats.md) |
| Work with the vehicle catalog | [presets.md](presets.md) |
| Read or extend the code | [architecture.md](architecture.md) |
| Run or add tests | [testing.md](testing.md) |
| Host, deploy or build the APK | [deployment.md](deployment.md) |
| Fix a problem | [troubleshooting.md](troubleshooting.md) |
| See what has been completed | [../CHANGELOG.md](../CHANGELOG.md) |
| See what is still open | [../TODO.md](../TODO.md) |

## Reading paths

**Using the app.** Start with the [README](../README.md) for the workflow overview, then work through [user-guide.md](user-guide.md). Keep [troubleshooting.md](troubleshooting.md) open when an input is rejected. You do not need [MATH.md](../MATH.md) to use the app, but its assumptions list explains what the numbers do not include.

**Understanding the numbers.** Read [MATH.md](../MATH.md) end to end: it defines the notation, the constants, each implemented relation, the input guards, the validation anchors and the explicit list of what is not modeled. [testing.md](testing.md) explains which of those relations are pinned by tests and which are not.

**Extending the code.** Read [architecture.md](architecture.md) for the layout and data flow, then [../AGENTS.md](../AGENTS.md) for the mandatory coding conventions. [testing.md](testing.md) covers how to add a suite, and [presets.md](presets.md) and [data-formats.md](data-formats.md) cover the data-side extension points.

**Maintaining and releasing.** Read [deployment.md](deployment.md) for the build, hosting and Android paths, [testing.md](testing.md) for the CI checks, and [../SECURITY.md](../SECURITY.md) for the hardening boundaries. [../CONTRIBUTING.md](../CONTRIBUTING.md) holds the pull-request process.

## Canonical locations

| Topic | Canonical document |
| --- | --- |
| Feature overview, requirements, commands | [../README.md](../README.md) |
| UI workflows and labels | [user-guide.md](user-guide.md) |
| Physics, formulas, assumptions, validation anchors | [../MATH.md](../MATH.md) |
| Import and export formats | [data-formats.md](data-formats.md) |
| Vehicle catalog and provenance | [presets.md](presets.md) |
| Code structure, module boundaries, extension guides | [architecture.md](architecture.md) |
| Coding conventions | [../AGENTS.md](../AGENTS.md) |
| Tests, benchmarks, CI | [testing.md](testing.md) |
| Hosting, PWA, offline, Android | [deployment.md](deployment.md) |
| Diagnostics and recovery | [troubleshooting.md](troubleshooting.md) |
| Completed work | [../CHANGELOG.md](../CHANGELOG.md) |
| Open work | [../TODO.md](../TODO.md) |

## Documentation conventions

- English throughout, matching the project convention for comments and commit messages.
- Relative links between repository documents, so the set stays readable on a branch.
- Every statement about behavior should be traceable to a source file. Where behavior is implemented but not verified against real data or hardware, the text says so.
- Illustrative values are labelled as illustrative. Preset data is not presented as verified manufacturer specification.
- GitHub-flavored Markdown, with `$...$` and `$$...$$` math where a formula is needed.
