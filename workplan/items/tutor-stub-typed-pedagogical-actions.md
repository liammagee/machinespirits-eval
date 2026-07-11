---
id: tutor-stub-typed-pedagogical-actions
title: Adapt Plan 2 typed pedagogical actions into tutor-stub
status: done
type: infra
priority: P1
owner: codex
source: review
created: 2026-07-11
updated: 2026-07-11
verification: Tutor-stub consumes the existing Plan 2 action registry through an
  additive adapter that independently records move, support, task/KC,
  difficulty, register, expected evidence, and fade condition; realization and
  guard audits pass deterministic controls without creating a second action
  registry.
claim_status: methods
depends_on:
  - adaptive-eval-immutable-provenance
links:
  notes:
    - PLAN_4_0/2026-07-11-adaptive-tutor-implementation-plan.md
    - PLAN_2_0/GENUINE-ADAPTATION-IMPLEMENTATION-PLAN.md
tags:
  - adaptive-tutor
  - tutor-stub
  - typed-actions
  - scaffolding
milestone: adaptive-tutor-evidence-v1
branch: codex/adaptive-tutor-implementation
---

Implement Phase 3 of the linked plan by adapting the canonical
`services/adaptiveTutor/` action contract. Register remains one coordinate of
an instructional action; it must not stand in for move, support, or task.

2026-07-11 Codex: Added an additive v2 pedagogical-action schema and opt-in
tutor-stub adapter over the existing Plan 2 registry. Move, support,
task/difficulty, and register are independent; decisions precede prose; full
candidates/propensity/vetoes persist; public next observations close outcomes;
and the bounded diagnose-support-uptake-fade-independent-transfer/recover
lifecycle is exercised. Default-off and backward-reader regressions pass. The
card is in review; policy efficacy remains gated on learner-state validity.
