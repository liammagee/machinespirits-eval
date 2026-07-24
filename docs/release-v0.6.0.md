# Machine Spirits Eval 0.6.0

Release date: 2026-07-24

`0.6.0` is the first integrated minor release since `0.5.0`. It packages the
evaluation system and its in-housed tutor engine together and establishes the
new repository release namespace, `release/vX.Y.Z`.

## Highlights

- In-houses the former `@machinespirits/tutor-core` package under
  `tutor-core/`, keeping engine and evaluation changes in one versioned tree.
- Expands tutor-stub into an interactive workbench with scenario, labelling,
  replay, trace, curriculum, voice, and automated-evaluation surfaces.
- Adds adaptive state-policy, proof-DAG, curriculum-to-drama, and derivation
  tooling alongside the standard dialogue runner.
- Strengthens bilateral tutor/learner scoring, provenance, hermetic testing,
  and risk-based coverage checks.
- Adds workplan, branch-archive, tag, and version-governance disciplines.
- Keeps the Electron desktop app on the shared Express and web UI rather than a
  forked interface.

## Packaging and compatibility

- Requires Node.js 20 or newer.
- Includes `tutor-core/` in the published package; consumers no longer install
  `@machinespirits/tutor-core` separately.
- Excludes generated tutor-core databases and other runtime state from the
  published package.
- Keeps `@anthropic-ai/sdk` as an optional peer dependency.
- Updates Express and YAML to remediated versions and pins the last-known-good
  LangGraph runtime for reproducible installs.
- Preserves historical rubric and data versions rather than retroactively
  rescoring them under newer rubrics.

## Release validation

Before creating `release/v0.6.0`, the release commit must pass:

- the full repository CI suite;
- the hermetic and risk-based test gates;
- a package dry run confirming that `tutor-core/` is included;
- a production dependency audit with no high or critical advisories;
- ref-governance validation; and
- package and lockfile version-alignment checks.

The annotated `release/v0.6.0` tag is created only after the release pull
request is merged and the intended `main` commit is validated.

## Known follow-up

The breaking Electron and native rebuild-toolchain upgrades are tracked in
[`upgrade-electron-and-rebuild-toolchain-past-audited-advisori`](../workplan/items/upgrade-electron-and-rebuild-toolchain-past-audited-advisori.md).
The LangGraph 1.4 compatibility migration and its two moderate transitive
advisories are tracked in
[`migrate-adaptive-dag-runtime-to-langgraph-1-4-without-longit`](../workplan/items/migrate-adaptive-dag-runtime-to-langgraph-1-4-without-longit.md).
