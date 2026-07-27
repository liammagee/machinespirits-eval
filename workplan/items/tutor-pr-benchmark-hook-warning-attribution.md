---
id: tutor-pr-benchmark-hook-warning-attribution
title: Attribute tutor PR benchmark hook warnings and scope world triggers
status: review
type: infra
priority: P2
owner: claude
source: manual
created: 2026-07-27
updated: 2026-07-27
verification: "Passed: node --test tests/tutorStubPrBenchmarkHook.test.js (13/13, up from 8); npm run lint; npx prettier --check on all four changed files; npm run lint:cycles (0 cycles across 403 files); npm run refs:check; npm run test:manifest. Established against real repository data rather than inference: a zero-call re-audit of the nearest cached ancestor report (77838c3f7a9e, 32 commits back) returned 0 improved, 0 regressed, 6 unchanged fail, confirming the standing failure; 32 authored world files were enumerated and exactly 1 (world-001-nocturne.yaml, id world_001_nocturne) is replayed by the strong preset. A full end-to-end hook probe printed the uncovered-world notice, the STANDING attribution line naming its baseline, and the request-changing-paths caveat, exiting 0."
branch: claude/pr-benchmark-hook-standing-warning
depends_on:
  - tutor-pr-benchmark-delta-harness
  - tutor-pr-benchmark-calibration-harness
links:
  notes:
    - docs/tutor-pr-benchmark.md
tags:
  - tutor-stub
  - pr-gate
  - regression
  - hook
milestone: adaptive-tutor-evidence-v1
---

Two defects made the local pre-push quality warning uninformative noise, so
pushers learned to ignore it.

Attribution. A bare `QUALITY WARNING` gave no way to separate a standing
failure from one the push introduced, because the head run draws fresh
responses and therefore confounds model sampling with whatever the audit code
now does. Reuse the existing zero-call re-audit lane as an identification
strategy: find the nearest cached ancestor commit with a comparable report,
replay that report's saved candidate strings through the currently checked-out
deterministic audits, and report what moved. Holding the candidate text fixed
while varying only the code attributes audit-code change specifically. Pushed
paths that change the benchmark request itself — prompts, fixtures, a replayed
world — fall outside what the re-audit can isolate and must be named as such
rather than silently folded into the verdict.

Scope. Every `config/drama-derivation/world-*.yaml` edit triggered the full
six-call matrix, but all three strong-preset cases replay one world, so the
large majority of authored worlds could not change any job's input. Those
pushes spent the paid budget on a resample that measured nothing. Key relevance
to the world's declared `id` rather than its filename, keep an unparseable
world inside the gate, and name the unmeasurable files so the omission stays
visible.

Guard thresholds and decision semantics are deliberately out of scope; they
belong to the rubric calibration workstream, and changing them here would make
the standing failure disappear for the wrong reason.

## Progress

- 2026-07-27: Raised from two operator reports that the warning fired
  identically at six consecutive commits including ones predating the work
  under review, and that the six failing cases were all nocturne while the
  triggering change was a marrick world. Both reports were confirmed against
  cached reports and the authored world set before any code was written.
- 2026-07-27: Added `STANDING`, `NEW SINCE <sha>`, `ATTRIBUTABLE`,
  `NOT ATTRIBUTABLE TO THE GUARDS`, and `UNATTRIBUTED` outcomes with nearest
  cached-ancestor baseline selection, zero-call re-audit under
  `<report dir>/attribution/`, and a caveat naming request-changing paths.
- 2026-07-27: Added id-keyed world coverage derived from the resolved preset
  plan, fail-closed on world parse errors, with the uncovered files printed
  before the skip decision. Documented both behaviors in
  `docs/tutor-pr-benchmark.md`.
- 2026-07-27: The first live run mislabelled its own driver as a path that
  changes the benchmark request. The caveat filtered on a two-way split, but the
  hook driver imports the runner, so the runner's import closure can never
  contain it. Partitioned relevance three ways, deriving hook machinery as the
  set difference between the hook entrypoint's closure and the runner's so it
  stays self-maintaining, and left it unreported.
