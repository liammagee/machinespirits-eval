---
id: tutor-stub-transition-reward-model
title: "Learn tutor-stub transition and reward models from turn frames"
status: triaged
type: research
priority: P1
owner: unassigned
source: manual
created: 2026-07-09
updated: 2026-07-09
verification: "A stable dataset export from tutor_stub_turn_frames exists; baseline transition/reward models are evaluated on held-out worlds and learner profiles; results are documented with exploratory claim boundaries."
claim_status: planned
links:
  notes:
    - notes/2026-07-09-continuous-register-ml-dag-bridge.md
  items:
    - continuous-register-policy
tags:
  - tutor-stub
  - continuous-registers
  - transition-model
  - neuro-symbolic
  - paper-update
---

Use the continuous-register and learner-DAG trace substrate to learn a cautious
transition/reward model before attempting any learned tutor policy.

Suggested sequence:

- Run adaptive QA with continuous policies across learner profiles and multiple
  worlds, then ingest the summaries into `data/evaluations.db`.
- Export a stable per-turn dataset from `tutor_stub_turn_frames` /
  `v_tutor_stub_turn_training`, including state vectors, DAG features, register
  vectors, tutor/learner text, next-state deltas, and reward proxies.
- Fit simple transition/reward baselines first: ridge/logistic/GBM before any
  neural policy.
- Test whether continuous register vectors explain next-state movement beyond
  the nearest discrete `selected_register`.
- Keep simulation-only results exploratory until held-out worlds, held-out
  learner profiles, independent judging, and eventually human traces support a
  stronger claim.
