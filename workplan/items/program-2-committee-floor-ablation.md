---
id: program-2-committee-floor-ablation
title: "Price the fine-tune: live committee with the untuned mini"
status: active
type: experiment
priority: P2
owner: codex
source: manual
created: 2026-07-22
updated: 2026-07-23
verification: "A frozen, contemporaneous 30-dialogue plan (12 trained committee + 12 untuned same-lineage committee + 6 fresh silent controls) passes its zero-model gate; all jobs seal under the pinned runtime; and the paired/profile-stratified analyzer reports the preregistered trained-minus-untuned warrant-compliance interval, equivalence test, fresh-control contrasts, density, coverage, safety, committee fallback burden, and tutor-response fallback/guard diagnostics without historical pooling."
branch: codex/program2-committee-floor-ablation
claim_status: planned
links:
  paper: §6.21
  notes:
    - PROGRAM-2-COMMITTEE-FLOOR-ABLATION-PREREGISTRATION.md
    - PROGRAM-2-PHASE5B-FALLBACK-BATTERY-PREREGISTRATION.md
    - notes/program-2/2026-07-20-phase5-live-pilot-results.md
  exports:
    - exports/program2-committee-floor-ablation/launch-state.json
    - exports/program2-committee-floor-ablation/analysis.json
    - exports/program2-committee-floor-ablation-amendment-3/launch-state.json
    - exports/program2-committee-floor-ablation-amendment-3/analysis.json
    - exports/program2-committee-floor-ablation-amendment-4/launch-state.json
    - exports/program2-committee-floor-ablation-amendment-4/analysis.json
  items:
    - program-2-context-vs-weights-finetune
tags:
  - tutor-stub
  - fine-tune
  - committee
  - ablation
milestone: adaptive-tutor-evidence-v1
---

The one factorial contrast the live program never ran: every live committee
result (5, 5b, 5c) used the trained mini, so the harness contribution
(fail-closed battery: resample + cue-preserving trim) and the training
contribution were never separated. This run places the trained and untuned
same-lineage minis into the same committee seat contemporaneously, with fresh
controls, for approximately 1.7 times the cost of Phase 5b (minis local/free).

The causal reading is frozen in
`PROGRAM-2-COMMITTEE-FLOOR-ABLATION-PREREGISTRATION.md`: the primary contrast
is trained minus untuned over 12 matched profile/repeat blocks. A null is not
called harness sufficiency unless its full 95% interval lies within ±0.10;
otherwise attribution remains indeterminate. This directly informs whether the
iterated-exhaust retrain ([[program-2-iterated-exhaust-retrain]]) targets a
load-bearing organ.

Design notes carried from 5b: preserve committee-v2, fallback-v2, the frozen-v1
audit, Marrick world, Sonnet tutor, Terra support roles, and all harness
settings. No historical controls are pooled. The fallback-resolution
distribution is a preregistered mechanism descriptive because the untuned mini
may require more resampling or trimming even when its delivered compliance is
similar.

Log:

- 2026-07-23 — activated on the dedicated worktree; design, runner plan, and
  analyzer implemented before any model-backed dialogue.
- 2026-07-23 — launch SHA `8fd08b2a` passed all zero-model/model-presence gates
  but hit the frozen three-consecutive-failure abort after 1/30 sealed. The
  analyzer returned `incomplete_or_under_informative`; no trained-vs-untuned
  estimate is licensed. Blocked pending an explicit amendment decision; see
  preregistration §7 for the failure anatomy.
- 2026-07-23 — Amendment 1 activated after user approval: retain the original
  partial launch as excluded diagnostics, repair the strict deterministic
  fallback and failure ledger, then restart a clean 30-dialogue cohort under a
  new pushed SHA. No endpoint, guard disposition, or reading rule changes; see
  preregistration §8.
- 2026-07-23 — the first amended invocation made zero provider calls because
  the isolated worktree lacked its dependency path; no trace was created. Add
  a zero-model child-runtime preflight and fail fast on non-retryable process
  errors before restarting the still-unbegun clean cohort.
- 2026-07-23 — Amendment 1's first real attempt exposed a second terminal
  composition bug at turn 16: the same long learner focus appeared in both
  uptake and handoff. No job sealed; the retry was stopped after its opening.
  Amendment 2 freezes shortest-valid focus composition and a new 30-cell clean
  restart; see preregistration §9.
- 2026-07-23 — Amendment 2's first dialogue reached turn 30 before terminal
  fallback reopened a learner claim already supported by committed public
  evidence and the learner-DAG update. No job sealed; its retry was stopped
  after the opening. Amendment 3 compiles one public-only
  `supported|unsupported|unknown` claim status and makes host planning,
  recovery, and audit consume it. All Amendment 2 artifacts are excluded.
  The 30-cell run restarts under a clean SHA; historical absolute comparisons
  are stratified by harness revision, while trained versus untuned remains a
  contemporaneous same-harness contrast. See preregistration §10.
- 2026-07-23 — Amendment 3 correctly credited the original failed relation,
  then exposed a later state-loss loop: an exact repeated compound claim fell
  from supported to unknown when its current-turn DAG delta reset to zero.
  No job sealed and the run was stopped at turn 27. Amendment 4 freezes a
  public claim signature plus its active premise/fact support, preserves that
  status across exact repeats only while the support remains active, and makes
  the analyzer recover first-draft contracts from authoritative trace events.
  All Amendment 3 artifacts are excluded; the 30 jobs restart cleanly under a
  new SHA. See preregistration §11.
