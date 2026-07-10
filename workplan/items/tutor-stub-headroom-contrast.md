---
id: tutor-stub-headroom-contrast
title: "Tutor-stub outcome-headroom contrast — first confound-free policy comparison"
status: review
type: experiment
priority: P1
owner: claude
source: manual
created: 2026-07-10
updated: 2026-07-10
verification: "One headroom QA matrix run (sentinel profiles x bland/negative/dynamic/field/dynamical_system, n=3, binding safety-turns 40) completes under a single committed SHA; qa-matrix.md ranks policies by the outcome-only score; the adaptive-vs-bland verdict (separation or null) is recorded with the artifact root."
claim_status: exploratory
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

## Result (2026-07-10, run complete)

Artifact root: `.tutor-stub-auto-eval/headroom-contrast-n3-live/` (SHA bd4532fe,
60/60 rows ok, codex.gpt-5.5 all roles). The arena worked: 3 of 4 profiles came
off the grounding ceiling (proof_skipper 12/15, false_memory 14/15,
affective_resistant 11/15).

Outcome-only ranking (mean / worst outcome score): dynamic 0.940/0.871, field
0.939/0.871, bland 0.913/0.864, dynamical_system 0.926/0.828, negative
0.884/0.647 ("learner-sensitive").

Verdict against the frozen reading:

- NOT a clean null and NOT a clean adaptive win. The first outcome-channel
  separation on this stack is NEGATIVE's profile-dependent collapse: it beat
  bland on both cognitive-failure profiles (+0.094/+0.096) then went 0/3 on
  affective_resistant (delta -0.309, all rows hit the 40-turn cap). Register
  choice demonstrably matters for grounding; the learner population now
  discriminates policies.
- Adaptive-vs-bland stays within noise: mean delta +0.025/+0.026, worst delta
  <= 0 except field (worst delta exactly 0 — the only arm that never lost to
  bland anywhere). Bland never collapsed (worst cell 2/3). dynamic lost its
  edge on affective_resistant (2/3); dynamical_system ranks below bland on
  worst-case.
- Per the card: follow-up for any claim = same-design replication on a second
  model family; the defensible exploratory sentence today is "register choice
  has outcome consequences (hostile registers collapse on affect-sensitive
  learners); adaptive selection buys no measurable outcome advantage over a
  plain fixed register at n=3."

Coordinate with the in-flight contract-v2 sentinel matrix
(`profile-policy-sentinel-v2-n3-live`) — the designs overlap; merge into one
run rather than paying twice.
