---
id: refactor-field-turn-projection
title: Consolidate tutor-stub field-turn projection
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-25
updated: 2026-07-25
verification: >-
  One pure projection service serves the tutor-stub CLI and auto-eval; frozen
  fixtures preserve the richer learner-advance, overreach, self-assessment,
  and calculation fields while existing report output remains unchanged.
branch: codex/refactor-field-turn-projection
depends_on:
  - refactor-forbidden-key-audit
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/tutorStubFieldTurnProjection.js
    - scripts/tutor-stub.js
    - scripts/run-tutor-stub-auto-eval.js
    - tests/tutorStubFieldTurnProjection.test.js
  items:
    - codebase-refactoring-program
tags:
  - refactoring
  - tutor-stub
  - auto-eval
  - duplication
milestone: evaluation-infrastructure
---

Bounded R1.3 duplicate-removal slice: replace the drifted tutor-stub CLI and
auto-eval `lightweightFieldTurn` implementations with one pure field-turn and
dialogue projection service.

Out of scope:

- Redesigning the `machinespirits.tutor-stub.lightweight-field.v1` schema,
  field formulas, visualization, report renderer, or trace persistence.
- Extracting unrelated field-policy, trajectory, classifier, or reporting
  helpers.
- Running model-backed or paid evaluation calls.

Acceptance:

- One dependency-free helper owns field-turn and dialogue projection; both
  scripts import it and their local projection copies are removed.
- The newer CLI progression, overreach, self-assessment, learner-advance, and
  calculation fields are retained exactly on frozen fixtures.
- The established auto-eval report projection and golden output remain
  unchanged for its frozen fixture.
- Focused projection/report tests, the full hermetic suite, lint, formatting,
  workplan source validation, cycle, and diff gates pass without model calls.

Log:

- 2026-07-25 — Activated from merged `main` at `768d46b9` after PR #210
  closed the forbidden-key audit slice. Confirmed the CLI copy is the richer
  source of truth and the auto-eval copy is an older projection variant.
- 2026-07-25 — Moved both paths onto one dependency-free projection service.
  The interactive default preserves learner advance, expanded overreach,
  self-assessment, and calculation detail; an explicit auto-eval v1 adapter
  preserves its historical JSON shape, values, and property order.
- 2026-07-25 — Frozen interactive and byte-level report goldens pass 4/4;
  existing report-regeneration and auto-eval evidence assertions remain green.
  The complete permitted hermetic run passes all 460 root files (6,641/6,641,
  zero skips) and all 11 tutor-core files (137/137), alongside lint, formatting,
  zero cycles across 348 files, the 179-item source-only workplan check, workplan
  tests, syntax, and diff checks. Ready for review without model or API calls.
