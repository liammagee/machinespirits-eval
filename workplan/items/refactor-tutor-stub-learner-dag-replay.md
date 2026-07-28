---
id: refactor-tutor-stub-learner-dag-replay
title: Refactor tutor-stub learner-DAG replay
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-28
updated: 2026-07-28
verification: 4 focused learner-DAG replay assertions, synchronized hermetic manifest, the zero-skip hermetic suite (including tutor-core 137/137), and every static/source-only gate preserve gates, update projection, turn/text/dropout semantics, evidence merge, model state/cloning, counts, and empty-turn behavior
branch: codex/refactor-tutor-stub-learner-dag-replay
claim_status: planned
depends_on:
  - refactor-tutor-stub-typed-action-restoration
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/tutorStubLearnerDagRestoration.js
    - scripts/tutor-stub.js
    - tests/tutorStubLearnerDagRestoration.test.js
  prs: []
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-typed-action-restoration
tags:
  - refactoring
  - tutor-stub
  - learner-dag
  - persistence
milestone: evaluation-infrastructure
---

Fifty-loop run 50: move learner-DAG replay from saved turns behind injected
record-update and public-evidence adapters.

Acceptance:

- Disabled/world gates, accepted update projection, turn fallback, learner
  text, dropout precedence/fallback, public-evidence merge, model state,
  precomputed-model cloning, replay/skip counts, and empty-turn behavior remain
  exact.
- World/trace loading, state creation, persistence, live DAG updates, runtime
  sequencing, and effects remain in the CLI.
- Focused/full hermetic and every static/source-only gate pass.

Out of scope:

- Changing DAG update policy, evidence projection, dropout semantics, or resume
  flow.

Log:

- 2026-07-28 — Started the bounded learner-DAG replay extraction.
- 2026-07-28 — Moved learner-DAG replay from saved turns behind injected
  record-update and public-evidence adapters, reducing `scripts/tutor-stub.js`
  by thirty lines. Four focused assertions, synchronized hermetic inventory,
  complete zero-skip hermetic parity, and all static/source-only gates pass.
