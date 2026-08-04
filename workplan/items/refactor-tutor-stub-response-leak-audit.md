---
id: refactor-tutor-stub-response-leak-audit
title: Refactor tutor-stub response leak audit
status: done
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-28
updated: 2026-08-04
verification: focused leak-audit and response-guard 18/18 plus full hermetic root and tutor-core zero-skip contracts preserve concealed-answer, private-conclusion, unreleased-content, and evidence-assertion behavior; every static and source-only gate passes
branch: codex/refactor-tutor-stub-response-leak-audit
claim_status: planned
depends_on:
  - refactor-tutor-stub-public-evidence
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/tutorStubResponseLeakAudit.js
    - scripts/tutor-stub.js
    - tests/tutorStubResponseLeakAudit.test.js
    - tests/tutorStubResponseGuard.test.js
  prs:
    - 364
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-public-evidence
tags:
  - refactoring
  - tutor-stub
  - guards
  - privacy
milestone: evaluation-infrastructure
---

Third-loop run 4: move the deterministic response-leak policy beside its
public-evidence and fact dependencies.

Acceptance:

- Concealed answer names, private intermediate/final conclusions, unreleased
  premise content, token thresholds/stopwords, evidence assertions, ordering,
  and returned metadata remain exact.
- Release scheduling, generation, guard orchestration, state mutation, and
  effects remain in their current owners.
- Focused/existing/full hermetic and every static/source-only gate pass.

Out of scope:

- Changing any leak threshold, conclusion pattern, visibility rule, or repair
  policy.

Log:

- 2026-07-28 — Bound the response-leak policy to the extracted public-evidence
  model and reduced the CLI by 245 lines. Eighteen focused assertions and the
  complete zero-skip hermetic contract pass.
