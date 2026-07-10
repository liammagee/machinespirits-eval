---
id: tutor-stub-headroom-contrast
title: "Tutor-stub outcome-headroom contrast — first confound-free policy comparison"
status: triaged
type: experiment
priority: P1
owner: claude
source: manual
created: 2026-07-10
updated: 2026-07-10
verification: "One headroom QA matrix run (sentinel profiles x bland/negative/dynamic/field/dynamical_system, n=3, binding safety-turns 40) completes under a single committed SHA; qa-matrix.md ranks policies by the outcome-only score; the adaptive-vs-bland verdict (separation or null) is recorded with the artifact root."
claim_status: planned
links:
  notes:
    - PLAN_4_0/2026-07-10-preconscious-adaptation-review.md
    - docs/tutor-stub-learner-profile-robustness.md
  items:
    - continuous-register-policy
    - tutor-stub-transition-reward-model
tags:
  - tutor-stub
  - register-policies
  - outcome-headroom
  - adaptation
---

Run the first register-policy comparison that can produce an outcome-channel
answer either way. All prior policy matrices were run at the release-schedule
grounding ceiling (126/126 grounded, flat turns) against near-clone learner
profiles, with the headline delta manufactured by the register-diversity term
of the composite score. All three confounds are now fixed: the QA score is
outcome-only, the sentinel profiles pass the discrimination gate, and the
headroom suite applies a binding 40-turn cap.

Command (machinery ready, run not yet launched — attended Max-plan run):

```bash
npm run tutor:stub:qa -- \
  --suite headroom \
  --runs 3 \
  --parallelism 4 \
  --trace-dir .tutor-stub-auto-eval/headroom-contrast-n3-live \
  --world world_005_marrick \
  --cli-effort low \
  --history-turns 4 \
  --max-tokens 4096 \
  --keep-going
```

60 dialogues (4 profiles x 5 policies x 3 runs) on codex.gpt-5.5.

Decision reading, frozen before launch:

- A null (bland ties adaptive on grounding rate and turns with headroom
  present) closes the register-policy line cleanly — the instrument is now
  confound-free, so the null is real.
- A separation is the branch's first outcome-channel adaptation signal; the
  follow-up is a same-design replication on a second model family before any
  claim wording.
- "Negative beats bland" or "any-variation ties adaptive" outcomes count
  against adaptive *selection* per the 2026-07-10 review (variety vs policy).

Coordinate with the in-flight contract-v2 sentinel matrix
(`profile-policy-sentinel-v2-n3-live`) — the designs overlap; merge into one
run rather than paying twice.
