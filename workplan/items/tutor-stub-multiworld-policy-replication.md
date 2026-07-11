---
id: tutor-stub-multiworld-policy-replication
title: Confirm adaptive policy effects across worlds and learner families
status: blocked
type: experiment
priority: P1
owner: unassigned
source: review
created: 2026-07-11
updated: 2026-07-11
verification: "A preregistered staged comparison runs on at least three proof geometries and two independent latent learner-generator families with strong fixed, action-frequency-yoked, guard-frequency-yoked, adaptive-move/fixed-register, and state-scramble arms; raw fixed-horizon, safety, independence, and guard-exposure endpoints plus uncertainty intervals determine pass, heterogeneity-only, close-register, or stop."
claim_status: planned
blocked_by: "The learner-state validity card has not passed. The v1 proxy fixture was not promotable, and the corrected exact-sensor v2 crossed benchmark has not yet produced a verdict."
depends_on:
  - adaptive-eval-immutable-provenance
  - tutor-stub-learner-state-validity
  - tutor-stub-typed-pedagogical-actions
links:
  notes:
    - PLAN_4_0/2026-07-11-adaptive-tutor-implementation-plan.md
tags:
  - adaptive-tutor
  - tutor-stub
  - multi-world
  - confirmatory
  - controls
milestone: adaptive-tutor-evidence-v1
---

Implement Phase 4 only after both the state and action gates pass. Use the
smallest staged comparison that can distinguish adaptive selection from action
frequency, state artifacts, guard exposure, and register variation.

2026-07-11 Codex: Blocked before paid policy calls. The first bounded formal
benchmark did not clear its gates, but later audit showed it tested partial
proxies rather than the exact live sensor. Reopen only after the corrected,
independently crossed v2 sensor dataset passes the upstream card; do not tune a
policy on either the failed v1 fixture or the v2 pilot.
