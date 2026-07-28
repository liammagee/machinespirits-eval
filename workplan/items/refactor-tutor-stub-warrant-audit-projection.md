---
id: refactor-tutor-stub-warrant-audit-projection
title: Refactor tutor-stub warrant audit projection
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-28
updated: 2026-07-28
verification: focused 48/48; hermetic root 7447/7447 across 550 files and tutor-core 137/137, zero skips; source-only workplan, manifest, lint, format, cycle, refs, syntax, and diff gates pass
branch: codex/refactor-tutor-stub-warrant-audit-projection
claim_status: planned
depends_on:
  - refactor-tutor-stub-side-arc-state
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/tutorStubWarrantPremiseAudit.js
    - scripts/tutor-stub.js
    - tests/tutorStubWarrantPremiseAudit.test.js
    - tests/tutorStubHumanDiscourseLayer.test.js
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-side-arc-state
tags:
  - refactoring
  - tutor-stub
  - human-discourse
  - projection
milestone: evaluation-infrastructure
---

Second-loop run 7: move deterministic public stocktake and warrant/premise
audit projection into a dependency-light owner while retaining extraction and
world-specific fact rendering at the CLI boundary.

Acceptance:

- Strict closure, risk, proof-debt, clean-state, count, phase, public-premise,
  warrant, adoption, and extraction-side-arc contracts remain exact.
- Strict-DAG rejections and heuristic missing warrants retain their order and
  provenance.
- The CLI strictly shrinks while extraction, world fact rendering, learner
  classification, prompts, model calls, runtime state, and effects stay in
  current owners.
- Focused/full hermetic, manifest, lint, formatting, cycle, source-only
  workplan, syntax, ref-status, and diff gates pass.

Out of scope:

- Changing extraction, proof policy, overleap detection, rejected-DAG rules,
  human-discourse modes, tutor prompts, or model behavior.

Log:

- 2026-07-28 — Activated from PR #355's reviewed head at `c6a42751`; the
  24,564-line CLI still owned deterministic warrant-audit projection.
- 2026-07-28 — Extracted public stocktake and warrant-audit projection with
  direct pins for closure, risk, debt, clean state, provenance ordering, and
  every count. The CLI shrank by 56 lines; 48 focused, 7,447 root, and 137
  tutor-core assertions pass with zero skips, together with every static and
  source-only gate.
