---
id: refactor-tutor-stub-learner-dag-presentation
title: Refactor tutor-stub learner-DAG presentation
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-27
updated: 2026-07-27
verification: Live technical-debug learner-DAG bytes remain identical while
  pure projection, focused, hermetic, manifest, static, and source-only gates
  pass.
branch: codex/refactor-tutor-stub-learner-dag-presentation
claim_status: planned
depends_on:
  - refactor-tutor-stub-director-presentation
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/tutorStubLearnerDagPresentation.js
    - scripts/tutor-stub.js
    - tests/tutorStubLearnerDagPresentation.test.js
    - tests/tutorStubInteractivePerformance.test.js
    - tests/tutorStubMultiPremiseAdvance.test.js
    - config/hermetic-test-manifest.json
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-director-presentation
tags:
  - refactoring
  - tutor-stub
  - presentation
  - cli
  - learner-dag
  - debug
milestone: evaluation-infrastructure
---

Bounded R3 slice: move deterministic technical learner-DAG diagnostic
serialization out of the CLI while retaining DAG construction, assessment,
dropout state, accepted updates, warning provenance, debug gating, call sites,
traces, and terminal writes in their existing owners.

Out of scope:

- Changing learner-DAG schemas, metrics, assessment, premise buckets, dropout,
  accepted movement, acceleration, or extractor warnings.
- Moving DAG construction, learner-record analysis, state mutation,
  `printAutomaticTechnicalDetails`, debug commands, traces, or terminal writes.
- Changing colors, labels, counts, ordering, fallback values, punctuation, or
  when private diagnostics become visible.

Acceptance:

- One dependency-free pure presentation leaf returns frozen line arrays from
  an explicit learner-DAG result and color palette.
- The CLI retains every builder, state and warning source, automatic debug
  gate, call site, and terminal adapter.
- Absent/minimal, premise-bucket, dropout, accepted-update, hypothesis,
  acceleration, warning, and input-immutability fixtures pin exact bytes.
- An actual fake-provider technical-debug process exits zero with
  byte-identical learner-DAG output; focused/full hermetic and manifest, lint,
  formatting, cycle, source-only workplan, syntax, and diff gates pass.

Log:

- 2026-07-27 — Activated from rendered `origin/main` at `f628fe85` after PR
  #286 merged as `c05444f6` with all ten CI lanes green. Selected only the
  private technical line serializer; DAG construction, state, debug gating,
  callers, traces, and terminal ownership remain explicitly out of scope.
- 2026-07-27 — Baseline fake-provider Marrick technical output is 336 bytes
  over three lines with SHA-256
  `ecb8c2bf55b237cb4b4de52f002e71daf742a46c8a9ff020b964452b48cc9603`.
- 2026-07-27 — Added one dependency-free 50-line presentation leaf and reduced
  the CLI by 38 net lines. Absent/minimal models, premise buckets, dropout,
  accepted movement, hypotheses, acceleration, warnings, immutability,
  ownership, and real technical-debug coverage pass 94/94; the live block
  retains its exact baseline bytes and hash.
- 2026-07-27 — Rebased onto `origin/main` at `d29d729b` after PR #287. The
  production changes were disjoint and the shared hermetic manifest merged and
  synchronized. Showcase PR-benchmark and learner-DAG overlap passes 103/103.
  Final-base parity passes 7,206/7,206 root tests across 519 files plus 137/137
  tutor-core tests, both with zero skips. The synchronized manifest, 226-item
  source-only workplan, ESLint, Prettier, zero-cycle ratchet across 401 files,
  syntax, and diff gates pass.
