---
id: refactor-dramatic-derivation-post-turn-lifecycle
title: Extract dramatic-derivation post-turn lifecycle
status: done
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-08-10
updated: 2026-08-10
branch: codex/refactor-dramatic-derivation-post-turn-lifecycle
verification: >-
  4/4 direct lifecycle assertions, 590/590 dramatic-derivation assertions,
  8,289/8,289 hermetic root tests, 137/137 tutor-core tests, and all nine risk
  groups pass. The lifecycle owner reaches 92.13% line/74.06% branch/90.16%
  function coverage; every new function is complexity 12 or lower; source,
  format, lint, manifest, and cycle gates pass.
claim_status: planned
depends_on:
  - refactor-dramatic-derivation-role-transitions
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
    - docs/next-steps/2026-08-09-codebase-refactoring-post-run-coordinator-reconciliation.md
  code:
    - services/dramaticDerivation/engine.js
    - services/dramaticDerivation/runState.js
    - services/dramaticDerivation/postTurnLifecycle.js
    - tests/dramaticDerivationPostTurnLifecycle.test.js
    - config/coverage-risk-floors.json
    - config/hermetic-test-manifest.json
  items:
    - codebase-refactoring-program
    - refactor-dramatic-derivation-role-transitions
tags:
  - refactoring
  - dramatic-derivation
  - lifecycle
  - runtime
milestone: evaluation-infrastructure
---

Continue R5 as a stacked child of PR #620. The explicit run-state and
role-transition owners are established, but `runDrama()` still directly owns
the entire post-learner phase: scene closure and strategy-ledger reset, stall
detection, deterministic decay/mutation, logic snapshots, and the attended
shell's live-turn projection.

Acceptance:

- Introduce one named post-turn lifecycle coordinator against the explicit
  run-state contract, with bounded helpers for scene closure, stall handling,
  decay, and live status projection.
- Preserve the exact order of scene close, stall termination, decay draws,
  logic snapshots, and `onTurn` delivery; preserve all event, transcript,
  strategy-ledger, register, corruption, scene, DAG, field, and cast shapes.
- Preserve the deterministic corruption stream, including one draw per
  eligible entry and mutation-only extra draws.
- Keep role-view construction and the outer loop in `engine.js`; do not alter
  prompts, role calls, policies, schemas, persistence, scoring, or public UI.
- Reduce `engine.js` and `runDrama()` materially; keep the new owner below 650
  lines and every new function below complexity 30, with no import cycle.
- Add direct lifecycle characterization and ratchet it in the hermetic
  manifest and risk-coverage configuration.

Log:

- 2026-08-10 — Activated from PR #620 head `0d537aa6` as an explicit stacked
  dependency. Baseline is a 1,622-line engine with complexity-123 `runDrama()`;
  the post-learner lifecycle occupies roughly 330 lines and remains the last
  major state-mutation block before finalization.
- 2026-08-10 — Completed the post-turn lifecycle extraction. Scene closure and
  strategy reset, stall-before-decay ordering, deterministic corruption,
  logic snapshots, and the complete `onTurn` projection now have a bounded
  610-line owner whose maximum function complexity is 12. `engine.js` fell to
  1,217 lines and `runDrama()` to complexity 14. All 590 direct dramatic
  assertions, 8,289 hermetic root tests, 137 tutor-core tests, nine risk
  groups, and structural gates pass without provider calls or production-data
  writes. The first hermetic/all-risk attempts hit sandbox-only loopback
  `EPERM`; permissioned reruns were fully green.
- 2026-08-10 — Rebased cleanly onto post-PR-#620 main `2252d801`; the only
  intervening change was the serialized generated-board refresh, so the
  validated source patch restored without conflict.
- 2026-08-10 — Rebased again onto current main `6e7dac6d` before handoff. The
  intervening PR #621 touched only the paper and ref-status documentation, so
  the lifecycle source and its validation contract remained disjoint.
