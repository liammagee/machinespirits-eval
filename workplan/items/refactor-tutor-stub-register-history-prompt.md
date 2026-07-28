---
id: refactor-tutor-stub-register-history-prompt
title: Refactor tutor-stub register history prompt
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-28
updated: 2026-07-28
verification: 25 focused register-history and policy assertions, the zero-skip hermetic suite (including tutor-core 137/137), and every static/source-only gate preserve six-turn bounds, normalization, efficacy, ratings, reasons, pending state, and fallback text
branch: codex/refactor-tutor-stub-register-history-prompt
claim_status: planned
depends_on:
  - refactor-tutor-stub-learner-dag-prompt
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/tutorStubRegisterHistoryProjection.js
    - scripts/tutor-stub.js
    - tests/tutorStubRegisterHistoryProjection.test.js
  prs:
    - 380
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-learner-dag-prompt
tags:
  - refactoring
  - tutor-stub
  - registers
  - prompts
milestone: evaluation-infrastructure
---

Fifty-loop run 8: move deterministic register-history prompt projection into
an injected, effect-free service.

Acceptance:

- Six-turn bounds, legacy normalization, efficacy, learner ratings, reasons,
  pending state, and empty fallback remain exact.
- Register normalization, runtime state, prompt assembly, policy selection, and
  effects remain in their current owners.
- Focused/full hermetic and every static/source-only gate pass.

Out of scope:

- Changing register history, efficacy scoring, normalization, or prompt text.

Log:

- 2026-07-28 — Moved register-history prompt projection into an injected,
  effect-free service, reducing `scripts/tutor-stub.js` by 15 lines. Twenty-five
  focused assertions, complete zero-skip hermetic parity, and all static and
  source-only gates pass.
- 2026-07-28 — Opened PR #380 against `main`; the benchmark hook correctly
  classified the history-projection slice as not response-generation relevant.
