---
id: refactor-tutor-stub-response-configuration-presentation
title: Refactor tutor-stub response-configuration presentation
status: done
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-27
updated: 2026-07-27
verification: Live technical-debug response-configuration bytes remain
  identical while pure projection, focused, hermetic, manifest, static, and
  source-only gates pass.
branch: codex/refactor-tutor-stub-response-configuration-presentation
claim_status: planned
depends_on:
  - refactor-tutor-stub-learner-classification-presentation
links:
  prs:
    - 303
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/tutorStubResponseConfigurationPresentation.js
    - scripts/tutor-stub.js
    - tests/tutorStubResponseConfigurationPresentation.test.js
    - tests/tutorStubInteractivePerformance.test.js
    - tests/tutorStubLearnerClassificationPresentation.test.js
    - tests/tutorStubLearnerDagPresentation.test.js
    - config/hermetic-test-manifest.json
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-learner-classification-presentation
tags:
  - refactoring
  - tutor-stub
  - presentation
  - cli
  - response-configuration
  - debug
milestone: evaluation-infrastructure
---

Bounded R3 slice: move deterministic technical stance-efficacy and selected
response-configuration serialization out of the CLI while retaining efficacy
calculation, policy selection, helper-derived display inputs, debug gating,
call sites, traces, and terminal writes in their existing owners.

Out of scope:

- Changing engagement-stance selection, policy composition, efficacy,
  confidence, adaptive temperature, light/random adaptation, distributions,
  actorial parts, expected moves, or warnings.
- Moving field-delta, distribution, or diagnostic-label calculations;
  policy/state mutation; `printAutomaticTechnicalDetails`; commands; traces;
  or terminal writes.
- Changing colors, labels, ordering, fallback values, punctuation, or when
  private diagnostics become visible.

Acceptance:

- One dependency-free pure presentation leaf returns frozen line arrays from
  explicit selected state, helper-derived display inputs, and a color palette.
- The CLI retains policy selection plus field-delta, stance-distribution, and
  actorial-part-label derivation, debug gates, callers, and terminal adapters.
- Full/minimal, efficacy/rating, light/random/temperature, policy stack,
  continuous blend, distribution, actorial-part, warning, expected-move, and
  immutability fixtures pin exact bytes.
- An actual fake-provider technical-debug process exits zero with
  byte-identical response-configuration output; focused/full hermetic and
  manifest, lint, formatting, cycle, source-only workplan, syntax, ref-status,
  and diff gates pass.

Log:

- 2026-07-27 — Activated from `origin/main` at `1e97ba14`, stacked temporarily
  on the one-line ref-status repair commit `0d348a28` from PR #296. Selected
  only the technical serializer; every policy/state calculation, three
  helper-derived display values, debug gate, caller, trace, and terminal write
  remains in the CLI. Rebase away the repair commit after #296 merges and
  before opening this child PR.
- 2026-07-27 — Baseline fake-provider Marrick technical response-configuration
  output is 949 bytes over nine lines with SHA-256
  `9ee64b109d7b735ef9fbd74ff3bef61d1e1b1944be94cb4ab1a9ff5fe21ef0b6`.
- 2026-07-27 — Added one dependency-free 116-line presentation leaf and
  reduced the CLI by 68 net lines. Efficacy/rating, light/random/temperature,
  policy-stack, distribution, continuous-blend, actorial-part, warnings,
  expected moves, immutability, ownership, and the real technical-debug
  process pass 338/338 focused assertions; the live block retains its exact
  baseline bytes and hash. Stacked-base parity passes 7,234/7,234 root tests
  across 522 files plus 137/137 tutor-core tests, both with zero skips. The
  synchronized manifest, 228-item source-only workplan, current ref registry,
  ESLint, Prettier, zero-cycle ratchet across 404 files, syntax, and diff gates
  pass.
- 2026-07-27 — PR #296 merged as `eff8e9ae` with all ten CI lanes green,
  including the repaired ref-status gate. Rebased directly onto final
  `origin/main` at `b185756e` after PR #297; the incoming skill-permission
  changes are code-disjoint and their overlap passes 7/7. Final-base parity
  passes 7,239/7,239 root tests across 522 files plus 137/137 tutor-core tests,
  both with zero skips. The synchronized manifest, 230-item source-only
  workplan, current ref registry, ESLint, Prettier, zero-cycle ratchet across
  404 files, syntax, and diff gates pass.
- 2026-07-27 — Rebased again onto `origin/main` at `5589017d` after PRs #300
  and #301. Their big-picture skill and workplan-only changes do not overlap
  the runtime refactor; the skill-sync plus response-presenter boundary passes
  7/7. The prior full final-base parity remains applicable because the
  incoming commits change no runtime or test files.
- 2026-07-27 — PR #303 merged as `254111ba` with all ten CI lanes green; the
  serialized workplan render followed as `e0e1f58d`. Closed this child and
  activated `refactor-tutor-stub-response-policy-context` for the adjacent
  deterministic tutor-only prompt projection.
