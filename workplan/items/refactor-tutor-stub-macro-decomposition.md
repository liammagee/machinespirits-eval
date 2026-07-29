---
id: refactor-tutor-stub-macro-decomposition
title: Decompose tutor-stub into cohesive runtime subsystems
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-29
updated: 2026-07-29
verification: Each macro PR removes at least 750 net lines from scripts/tutor-stub.js on a rolling three-PR average, preserves focused byte/contract parity plus the zero-skip hermetic and static gates, introduces no import cycles or replacement oversized module, and leaves the entry script near 2,000 lines
branch: codex/refactor-tutor-stub-command-router
claim_status: planned
depends_on: []
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - scripts/tutor-stub.js
    - services/tutorStubCommandRuntime.js
    - services/tutorStubTutorTurnPipeline.js
    - tests/tutorStubTutorTurnPipeline.test.js
  prs:
    - 426
  items:
    - codebase-refactoring-program
tags:
  - refactoring
  - tutor-stub
  - macro-decomposition
  - maintainability
milestone: evaluation-infrastructure
---

Replace helper-sized tutor-stub extractions with a bounded series of cohesive
subsystem PRs. The target is a small composition entrypoint, not a relocated
monolith.

Acceptance:

- Target 1,000–3,000 net lines removed from `scripts/tutor-stub.js` per PR;
  stop and re-plan if the rolling three-PR average falls below 750.
- Keep focused behavioral/byte parity, the zero-skip hermetic suite, lint,
  formatting, manifest, refs, workplan, syntax, and import-cycle gates green.
- Keep runtime state ownership explicit and avoid replacing the entry script
  with another oversized or cyclic module.
- Reuse this card across the macro series rather than creating a card for every
  moved helper.

Planned order:

1. Tutor generation, audit, repair, and committee pipeline.
2. Slash-command routing and dialogue-settings handlers.
3. Session state, trace, resume, and transcript orchestration.
4. Mixed-learner, model-selection, voice, and picker controllers.
5. Response-configuration policy subsystem.
6. Turn processing and automated-learner orchestration.
7. Subsystem facades and entrypoint/import consolidation.

Log:

- 2026-07-29 — Started macro PR 1 from current `origin/main`: extract the
  complete tutor-turn generation pipeline rather than another inner helper.
- 2026-07-29 — Macro PR 1 moved the complete 2,265-line `callTutor`
  generation, streaming, prompt-audit, response-audit, repair, committee, and
  deterministic-fallback pipeline behind one injected dependency boundary.
  `scripts/tutor-stub.js` fell from 23,299 to 21,131 lines, a 2,168-line net
  reduction and a first-cycle rolling average above the 750-line stop floor.
- 2026-07-29 — Three direct transport-path tests and 55 focused
  transport/guard/recovery/prompt/interactive assertions pass. Ownership tests
  now pin the new service boundary, both Program 2 provider-budget reservations
  remain before dispatch, the zero-skip hermetic suite passes 7,664/7,664 root
  tests plus 137/137 tutor-core tests, and the static import graph remains at
  zero cycles across 449 files.
- 2026-07-29 — A manual strong tutor PR benchmark on runtime commit `567df2b5`
  completed all 6 model calls and reported 0 pass / 6 audit failures. This is a
  standing head result, not a base/head regression attribution; the focused
  byte/contract tests and full hermetic suite provide the parity evidence for
  this structural extraction. The new pipeline path is now explicitly in the
  benchmark hook scope so subsequent behavioral edits cannot be skipped.
- 2026-07-29 — Opened macro PR 1 as PR #426.
- 2026-07-29 — Macro cycle 2 moved the 1,305-line dialogue-settings and
  slash-command dispatch bodies behind one injected command-runtime boundary.
  The entrypoint fell from 21,131 to 19,932 lines, a 1,199-line net reduction;
  the two-cycle rolling average is 1,684 lines per PR.
- 2026-07-29 — Cycle 2 verification passes 83 focused command/settings and
  interactive assertions, 13 director/status ownership and exact-byte checks,
  the zero-skip hermetic suite at 7,667/7,667 root plus 137/137 tutor-core
  tests, and every static gate with zero import cycles across 450 files.
