---
id: refactor-adaptive-trace-projection
title: Consolidate adaptive evaluation trace projections
status: done
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-24
updated: 2026-07-25
verification: >-
  The evaluation CLI and runner import one pure adaptive trace-projection
  service; frozen scenario, dialogue, transcript, and learner-turn fixtures are
  deep-equal to the historical shapes; focused and full hermetic suites pass.
branch: codex/refactor-adaptive-trace-projection
depends_on:
  - refactor-tutor-response-cycle
links:
  prs:
    - https://github.com/liammagee/machinespirits-eval/pull/202
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  items:
    - codebase-refactoring-program
tags:
  - refactoring
  - evaluation
  - adaptive-tutor
  - traces
  - projections
milestone: evaluation-infrastructure
---

Bounded R1.3 slice: remove only the exact adaptive projection copies shared by
`scripts/eval-cli.js` and `services/evaluationRunner.js`. Do not change adaptive
trace schemas, scenario metadata, transcript labels, learner trace labels,
turn numbering, rubric inputs, persistence, CLI output, or rejudge behavior.

Acceptance:

- Move adaptive raw-trace recognition, scenario-context projection, and
  trace-to-dialogue conversion into one pure service.
- Move learner-turn extraction into that service while retaining current and
  historical learner/user trace-label compatibility.
- Make the evaluation CLI and runner import the shared functions rather than
  retaining local copies.
- Deep-compare frozen scenario, dialogue, transcript, and learner-turn fixtures
  against the historical output shapes before deleting the duplicates.
- Pass focused projection/manifest tests plus the full hermetic, lint,
  formatting, workplan, cycle, and diff gates without model or API calls.

Log:

- 2026-07-24 — Activated from merged `main` at `8a48ae04` after PR #200 closed
  R1.2. The review-confirmed duplication consists of four pure functions across
  the evaluation CLI and runner: adaptive-log recognition, scenario context,
  dialogue-log conversion, and learner-turn extraction.
- 2026-07-24 — Moved the four functions into one store-free projection service
  imported by both production callers. Frozen raw-log, scenario, dialogue,
  transcript, current/legacy learner-label, internal-deliberation, and
  conversation-history fallback shapes pass deep equality; only one production
  definition of each function remains.
- 2026-07-24 — Review gate passed without model or API calls: 29/29 focused
  assertions, all 458 root test files, all 11 tutor-core files (137/137 core
  tests), lint, formatting, zero static cycles across 343 service files, the
  174-item workplan check, and diff checks are green. R1.3 is ready for review.
- 2026-07-25 — Closed after PR #202 merged to `main` at `6f8770df`; the next
  duplicate family is tracked separately by `refactor-field-policy-helpers`.
