---
id: refactor-tutor-stub-side-arc-state
title: Refactor tutor-stub side-arc state projection
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-28
updated: 2026-07-28
verification: focused 49/49; hermetic root 7444/7444 across 549 files and tutor-core 137/137, zero skips; source-only workplan, manifest, lint, format, cycle, refs, syntax, and diff gates pass
branch: codex/refactor-tutor-stub-side-arc-state
claim_status: planned
depends_on:
  - refactor-tutor-stub-scaffold-state
links:
  prs:
    - https://github.com/liammagee/machinespirits-eval/pull/355
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/tutorStubSideArcState.js
    - scripts/tutor-stub.js
    - tests/tutorStubSideArcState.test.js
    - tests/tutorStubHumanDiscourseLayer.test.js
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-scaffold-state
tags:
  - refactoring
  - tutor-stub
  - human-discourse
  - projection
milestone: evaluation-infrastructure
---

Second-loop run 6: move deterministic learner side-arc classification and
projection into a dependency-free owner beside scaffold-state projection.

Acceptance:

- Generous-inference precedence, clarification, warrant-challenge, affective,
  off-task, and no-arc states remain exact.
- Return-target and learner-need selection retain the existing fallback order.
- The CLI strictly shrinks while learner classification, generous inference,
  scaffold construction, prompts, model calls, runtime state, and effects stay
  in current owners.
- Focused/full hermetic, manifest, lint, formatting, cycle, source-only
  workplan, syntax, ref-status, and diff gates pass.

Out of scope:

- Changing side-arc vocabulary, matching precedence, classification prompts,
  generous-inference policy, tutor behavior, or model behavior.

Log:

- 2026-07-28 — Activated from PR #354's reviewed head at `1c6188b4`; the
  24,616-line CLI still owned deterministic side-arc projection.
- 2026-07-28 — Extracted side-arc projection with direct pins for generous
  inference precedence and all four side-arc classes plus the clean state. The
  CLI shrank by 52 lines; 49 focused, 7,444 root, and 137 tutor-core assertions
  pass with zero skips, together with every static and source-only gate.
