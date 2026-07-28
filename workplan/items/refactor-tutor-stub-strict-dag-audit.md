---
id: refactor-tutor-stub-strict-dag-audit
title: Refactor tutor-stub strict DAG audit state
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-28
updated: 2026-07-28
verification: focused 48/48; hermetic root 7450/7450 across 551 files and tutor-core 137/137, zero skips; source-only workplan, manifest, lint, format, cycle, refs, syntax, and diff gates pass
branch: codex/refactor-tutor-stub-strict-dag-audit
claim_status: planned
depends_on:
  - refactor-tutor-stub-warrant-audit-projection
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/tutorStubStrictDagAuditState.js
    - scripts/tutor-stub.js
    - tests/tutorStubStrictDagAuditState.test.js
    - tests/tutorStubHumanDiscourseLayer.test.js
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-warrant-audit-projection
tags:
  - refactoring
  - tutor-stub
  - dag
  - projection
milestone: evaluation-infrastructure
---

Second-loop run 8: move deterministic strict learner-DAG audit-state
projection into a dependency-free owner at the human-discourse frame boundary.

Acceptance:

- Disabled defaults, wrapped and legacy model shapes, metric precedence,
  booleans, numeric coercion, bottlenecks, buckets, and counts remain exact.
- The CLI strictly shrinks while DAG construction, learner updates, warrant
  audits, proof debt, prompts, model calls, runtime state, and effects stay in
  current owners.
- Focused/full hermetic, manifest, lint, formatting, cycle, source-only
  workplan, syntax, ref-status, and diff gates pass.

Out of scope:

- Changing DAG assessment, missing-premise computation, proof-debt policy,
  learner updates, tutor prompts, or model behavior.

Log:

- 2026-07-28 — Activated from PR #356's reviewed head at `1ee06ff7`; the
  24,508-line CLI still owned deterministic strict-DAG audit projection.
- 2026-07-28 — Extracted strict-DAG audit projection with direct pins for
  disabled, wrapped, and legacy models plus count and boolean precedence. The
  CLI shrank by 16 lines; 48 focused, 7,450 root, and 137 tutor-core assertions
  pass with zero skips, together with every static and source-only gate.
