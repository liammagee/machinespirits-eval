---
id: layered-task-session-adaptation
title: Layered adaptive tutor task/session adaptation prototype
status: archived
type: research
priority: P1
owner: codex
source: manual
created: 2026-07-01
updated: 2026-07-02
branch: codex/task-session-adaptation
verification: "PR #71 merged; TaskMasteryState remains public-only/advisory; zero-paid taskloop benchmark, focused tests, workplan check, lint, format check, git diff check, and full npm test passed."
claim_status: methods
links:
  notes: PLAN_2_0/layered_adaptive_tutor_technical_spec.md
  exports: exports/dramatic-derivation/layered-adaptation/taskloop-benchmark-report.md
  prs: https://github.com/liammagee/machinespirits-eval/pull/71
tags:
  - adaptive-tutor
  - derivation
  - task-loop
  - outer-loop
---

Open the task/session outer-loop only after the v0 turn/block/scene/act gates
merged. This item tracks a local scaffold, not runtime deployment: infer a
public-only mastery state from ownership, transfer, uptake, self-regulation,
repair, and error signals, then recommend the next task as advisory metadata.

Acceptance criteria:

1. `services/dramaticDerivation/taskMastery.js` rejects hidden proof fields and
   cannot override hidden+proofDebt proof control.
2. `npm run derivation:taskloop-benchmark` beats fixed progression on
   deterministic controls.
3. No human-learning or deployment escalation claim is made from this scaffold.

2026-07-01 Codex: Opened `codex/task-session-adaptation` from merged main after
the layered adaptive tutor v0 gates landed. Human/hybrid handoff remains a
separate deferred project.

2026-07-01 Codex: Closed scaffold pass after PR #71 merged. Local and remote
checks passed: `npm run derivation:taskloop-benchmark` reported 12/12 adaptive
vs 2/12 fixed progression controls; focused tests, workplan check, lint, format
check, `git diff --check`, and full `npm test` passed. This remains a
public-only advisory task/session scaffold, not runtime deployment or
human-learning evidence.

2026-07-02 Codex: Archived as part of total Plan 2.x closeout. The scaffold is
retained as advisory instrumentation and provenance, not a live implementation
track.
