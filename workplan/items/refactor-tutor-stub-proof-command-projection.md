---
id: refactor-tutor-stub-proof-command-projection
title: Refactor tutor-stub proof-command projection
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-26
updated: 2026-07-26
verification: Live /proof paths and inspect bytes remain identical while pure
  projection, focused, hermetic, manifest, static, and source-only gates pass.
branch: codex/refactor-tutor-stub-proof-command-projection
claim_status: planned
depends_on:
  - refactor-tutor-stub-dag-snapshot-projection
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/tutorStubProofCommandPresentation.js
    - scripts/tutor-stub.js
    - tests/tutorStubProofCommandPresentation.test.js
    - tests/dramaticDerivationProxyDagMemory.test.js
    - config/hermetic-test-manifest.json
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-dag-snapshot-projection
tags:
  - refactoring
  - tutor-stub
  - presentation
  - cli
  - proof-dag
milestone: evaluation-infrastructure
---

Bounded R3 slice: move the deterministic fixed proof-DAG artifact table and
authored/learner/tutor semantic-summary projection out of the CLI while
retaining formal execution, command handling, terminal writes, and traces in
the entrypoint.

Out of scope:

- Changing proof artifact paths, private/public boundary copy, fixture labels,
  counts, colors, ordering, spacing, or blank lines.
- Moving Lean subprocess execution, semantic-web export, SHACL/source audits,
  stale-artifact checks, command parsing, dynamic imports, terminal writes, or
  trace events.
- Moving live session DAG state, reports, browser/voice, lifecycle, model, or
  tutor-turn behavior.

Acceptance:

- One dependency-free pure presentation leaf returns the artifact rows/lines
  and projects all three precomputed semantic-layer summaries.
- `printProofDagArtifactPaths` and `printProofDagSemanticLayer` remain CLI-owned
  terminal adapters; the former still returns the exact rows used by trace
  provenance.
- Frozen artifact, authored, learner, and tutor fixtures pin exact bytes,
  pass/fail wording, private/public labels, counts, paths, and input immutability.
- Actual pre/post-refactor `/proof paths` and `/proof inspect learner` processes
  exit zero with byte-identical output; focused/full hermetic and manifest,
  lint, formatting, cycle, source-only workplan, syntax, and diff gates pass
  without model calls.

Log:

- 2026-07-26 — Activated from rendered `origin/main` at `cce01690` after PR
  #269 merged as `482f97f3` with every CI lane green. Selected the adjacent two
  deterministic fixture-presentation functions; formal proof execution and
  every runtime effect remain explicitly out of scope.
- 2026-07-26 — Baseline no-model `/proof paths` block is 744 bytes with
  SHA-256 `049be5a1ab7288cb83f35c2e9f2ffc22a1614166e56ca8cb7f4fcd62eca73f45`;
  `/proof inspect learner` is 682 bytes with SHA-256
  `646d1d08c5d23914ba483196d738e7bcc2bc14238d283a910d6300679ac012c9`.
- 2026-07-26 — Added one dependency-free 60-line presentation leaf and reduced
  the CLI from 26,591 to 26,550 lines. Both real no-model command blocks retain
  their exact byte counts and baseline hashes; artifact, authored, learner,
  tutor, process, ownership, and existing proof-surface coverage passes 15/15.
- 2026-07-26 — Review parity is green: the natural-teardown hermetic root
  contract passes 6,982/6,982 across 500 files with zero skips and tutor-core
  passes 137/137 with zero skips. ESLint, Prettier, the zero-cycle ratchet
  across 382 files, synchronized test manifest, 211-item source-only workplan,
  syntax, and diff gates pass; generated workplan views remain untouched.
- 2026-07-26 — Rebased onto rendered `origin/main` at `689468b4` after PR #270
  added the versioned evidence-use bridge rubric in separate tutor-stub regions.
  The final-base overlap set passes 57/57; the complete contract passes root
  7,001/7,001 across 501 files and tutor-core 137/137 with zero skips. Static,
  manifest, and 212-item source-only gates remain green.
