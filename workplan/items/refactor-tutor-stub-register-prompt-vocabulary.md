---
id: refactor-tutor-stub-register-prompt-vocabulary
title: Refactor tutor-stub register prompt vocabulary
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-28
updated: 2026-07-28
verification: 26 focused register-palette and policy assertions, the zero-skip hermetic suite (7516 root plus tutor-core 137/137), and every static/source-only gate preserve stance summaries, request-type rows, JSON formatting, defaults, and fallbacks
branch: codex/refactor-tutor-stub-register-prompt-vocabulary
claim_status: planned
depends_on:
  - refactor-tutor-stub-visible-model
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/tutorStubRegisterPalette.js
    - scripts/tutor-stub.js
    - tests/tutorStubRegisterPalette.test.js
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-visible-model
tags:
  - refactoring
  - tutor-stub
  - registers
  - prompts
milestone: evaluation-infrastructure
---

Fifty-loop run 6: move deterministic engagement-stance and request-type prompt
vocabulary beside register-palette selection through an injected model.

Acceptance:

- Stance defaults, optional fields, request-type roles, JSON formatting, and the
  empty-registry fallback remain exact.
- Runtime register state, prompt assembly, policy selection, and effects remain
  in their current owners.
- Focused/full hermetic and every static/source-only gate pass.

Out of scope:

- Changing stance definitions, request types, policies, or prompt content.

Log:

- 2026-07-28 — Moved engagement-stance and request-type prompt vocabulary into
  an injected register-palette model, reducing `scripts/tutor-stub.js` by 25
  lines. Twenty-six focused assertions, complete zero-skip hermetic parity, and
  all static/source-only gates pass.
