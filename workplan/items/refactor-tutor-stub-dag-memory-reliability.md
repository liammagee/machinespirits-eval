---
id: refactor-tutor-stub-dag-memory-reliability
title: Refactor tutor-stub DAG memory reliability projection
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-28
updated: 2026-07-28
verification: focused 41/41; hermetic root 7452/7452 across 551 files and tutor-core 137/137, zero skips; source-only workplan, manifest, lint, format, cycle, refs, syntax, and diff gates pass
branch: codex/refactor-tutor-stub-dag-memory-reliability
claim_status: planned
depends_on:
  - refactor-tutor-stub-strict-dag-audit
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/tutorStubDagFactDropout.js
    - services/tutorStubPublicLearnerAnalysis.js
    - scripts/tutor-stub.js
    - services/__tests__/tutorStubDagFactDropout.test.js
    - services/__tests__/tutorStubPublicLearnerAnalysis.test.js
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-strict-dag-audit
tags:
  - refactoring
  - tutor-stub
  - dag
  - deduplication
milestone: evaluation-infrastructure
---

Second-loop run 9: replace duplicate CLI and public-analysis construction of
the DAG fact-dropout memory-reliability view with one shared pure projector.

Acceptance:

- Schema, configured rate, active/dropped/repaired counts, conduct visibility,
  and disabled null remain exact in both call paths.
- The CLI and public-analysis service both strictly shrink while dropout state,
  board mutation, DAG construction, model calls, runtime state, and effects stay
  in current owners.
- Focused/full hermetic, manifest, lint, formatting, cycle, source-only
  workplan, syntax, ref-status, and diff gates pass.

Out of scope:

- Changing dropout scheduling, state mutation, replay, assessment, tutor
  response configuration, or model behavior.

Log:

- 2026-07-28 — Activated from PR #357's reviewed head at `2ba4719d`; the CLI
  and public learner-analysis service still duplicated the same six-field
  memory-reliability projection.
- 2026-07-28 — Replaced both copies with one shared projector and pinned its
  public conduct contract and disabled null. The CLI and public-analysis
  service each shrank by eight lines; 41 focused, 7,452 root, and 137
  tutor-core assertions pass with zero skips, together with every static and
  source-only gate.
