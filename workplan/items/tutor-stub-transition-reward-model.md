---
id: tutor-stub-transition-reward-model
title: "Learn tutor-stub transition and reward models from turn frames"
status: blocked
type: research
priority: P1
owner: unassigned
source: manual
created: 2026-07-09
updated: 2026-07-11
verification: "A sealed stable export from tutor_stub_turn_frames records typed actions, realized outcomes, guard exposure, and logging propensities; overlap and effective sample size are reported before estimation; ridge/logistic/GBM baselines use dialogue-grouped cross-fitting with held-out worlds and learner sources; a guarded learned ranker is compared out of sample with strong fixed, action-frequency-yoked, and guard-frequency-yoked controls on raw outcomes and cannot pass with a safety loss."
claim_status: planned
blocked_by: "No claim-grade multi-world transition dataset exists: the learner-state sensor is not passed and tutor-stub-multiworld-policy-replication remains blocked."
depends_on:
  - tutor-stub-multiworld-policy-replication
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
milestone: adaptive-tutor-evidence-v1
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
- Freeze and persist action propensities before outcomes; reject unsupported
  actions, report common-support overlap and effective sample size, and do not
  fit a learned policy when positivity is inadequate.
- Group every fit/tune/evaluate split by dialogue, world, and learner source;
  use grouped cross-fitting so no dialogue transition leaks across folds.
- Compare any learned ranker against strong fixed, action-frequency-yoked, and
  guard-frequency-yoked controls on raw fixed-horizon/independence outcomes.
  A safety regression or unsupported off-policy estimate is an automatic stop.
- Keep simulation-only results exploratory until held-out worlds, held-out
  learner profiles, independent judging, and eventually human traces support a
  stronger claim.
