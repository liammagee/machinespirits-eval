---
id: refactor-tutor-stub-scaffold-state
title: Refactor tutor-stub scaffold state projection
status: done
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-28
updated: 2026-08-04
verification: focused 48/48; hermetic root 7438/7438 across 548 files and tutor-core 137/137, zero skips; source-only workplan, manifest, lint, format, cycle, refs, syntax, and diff gates pass
branch: codex/refactor-tutor-stub-scaffold-state
claim_status: planned
depends_on:
  - refactor-tutor-stub-guard-attempt-envelope
links:
  prs:
    - https://github.com/liammagee/machinespirits-eval/pull/354
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/tutorStubScaffoldState.js
    - scripts/tutor-stub.js
    - tests/tutorStubScaffoldState.test.js
    - tests/tutorStubHumanDiscourseLayer.test.js
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-guard-attempt-envelope
tags:
  - refactoring
  - tutor-stub
  - human-discourse
  - projection
milestone: evaluation-infrastructure
---

Second-loop run 5: move deterministic human-discourse scaffold-state
projection into a dependency-free owner while retaining world, dramaturgy, and
release selection at the CLI boundary.

Acceptance:

- Mode enablement, public release compaction, future-release redaction,
  branch return targets, active acts, and stable schema remain exact.
- Private future premise ids and surfaces remain excluded from the public
  scaffold projection.
- The CLI strictly shrinks while world loading, branch selection, release
  scheduling, model calls, runtime state, and effects stay in current owners.
- Focused/full hermetic, manifest, lint, formatting, cycle, source-only
  workplan, syntax, ref-status, and diff gates pass.

Out of scope:

- Changing discourse modes, release scheduling, authored scaffolds, branch
  choice, proof policy, tutor prompts, or model behavior.

Log:

- 2026-07-28 — Activated from PR #353's reviewed head at `a45e667b`; the
  24,667-line CLI still owned deterministic scaffold-state projection.
- 2026-07-28 — Extracted public scaffold projection with direct pins for mode
  enablement, release compaction, future-release redaction, and return-target
  choice. The CLI shrank by 51 lines; 48 focused, 7,438 root, and 137
  tutor-core assertions pass with zero skips, together with every static and
  source-only gate.
