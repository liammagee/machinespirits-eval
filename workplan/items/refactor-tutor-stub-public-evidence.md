---
id: refactor-tutor-stub-public-evidence
title: Refactor tutor-stub public evidence model
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-28
updated: 2026-07-28
verification: focused 7/7 plus full hermetic root and tutor-core zero-skip contracts preserve release selection, closure, answer terms, and guard-visible text; every static and source-only gate passes
branch: codex/refactor-tutor-stub-public-evidence
claim_status: planned
depends_on:
  - refactor-tutor-stub-fact-matching
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/tutorStubPublicEvidence.js
    - scripts/tutor-stub.js
    - tests/tutorStubPublicEvidence.test.js
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-fact-matching
tags:
  - refactoring
  - tutor-stub
  - evidence
  - proof-dag
milestone: evaluation-infrastructure
---

Third-loop run 3: move the deterministic public-evidence view beside the shared
fact model while injecting the CLI-owned release-row selectors.

Acceptance:

- Explicit/scheduled/paced premise selection, public facts, closure,
  entailment, answer terms, provenance text, assertion text, and missing-world
  behavior remain exact.
- Release scheduling, world loading, audit policy, state mutation, and effects
  remain in their current owners.
- Focused/full hermetic and every static/source-only gate pass.

Out of scope:

- Changing evidence visibility, release timing, proof rules, or guard policy.

Log:

- 2026-07-28 — Bound one reusable public-evidence model to the existing
  CLI-owned release-row selectors and reduced the CLI by 51 lines. Seven
  focused assertions and the complete zero-skip hermetic contract pass.
