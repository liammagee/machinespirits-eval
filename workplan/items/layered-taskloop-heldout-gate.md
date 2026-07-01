---
id: layered-taskloop-heldout-gate
title: Layered adaptive tutor held-out task-loop artifact gate
status: review
type: research
priority: P1
owner: codex
source: manual
created: 2026-07-01
updated: 2026-07-01
branch: codex/taskloop-heldout-gate
verification: "Held-out task-loop gate passes with public-only selector inputs, unchanged proof-control fingerprints, adaptive recommendations beating fixed progression, and no runtime or human-learning claim."
claim_status: methods
links:
  notes: PLAN_2_0/layered_adaptive_tutor_technical_spec.md
  exports: exports/dramatic-derivation/layered-adaptation/taskloop-heldout-gate-report.md
  items: layered-task-session-adaptation
tags:
  - adaptive-tutor
  - derivation
  - task-loop
  - heldout
  - outer-loop
---

Strengthen the task/session scaffold from PR #71 with a held-out artifact gate.
The question is: does the task/session selector still beat fixed progression on
held-out derivation traces, without using hidden proof state and without
changing proof-control behavior?

Acceptance criteria:

1. The fixture set links to frozen derivation artifacts rather than the original
   deterministic benchmark controls.
2. `TaskMasteryState` receives only public learner/task signals.
3. Fixed and adaptive proof-control fingerprints remain identical.
4. Adaptive recommendations beat fixed progression by the predeclared margin.
5. The report claims only local advisory task/session evidence, not runtime
   assignment, proof-control promotion, or human-learning gain.

2026-07-01 Codex: Opened `codex/taskloop-heldout-gate` from refreshed main after
closing the original task/session scaffold item. This branch should produce a
zero-paid artifact gate and leave human/hybrid handoff deferred.

2026-07-01 Codex: Implemented the held-out gate and moved to review after
validation passed. The zero-paid gate reports 12/12 adaptive recommendations vs
2/12 fixed progression, delta 0.833, with zero public-only failures and zero
proof-control drift rows. Passing checks: focused held-out test, held-out gate
script, workplan check, format check, lint, diff check, and full `npm test`.
