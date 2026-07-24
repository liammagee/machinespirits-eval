---
id: program-2-committee-floor-ablation
title: "Price the fine-tune: live committee with the untuned mini"
status: review
type: experiment
priority: P2
owner: codex
source: manual
created: 2026-07-22
updated: 2026-07-24
verification: "A frozen, contemporaneous 30-dialogue plan (12 trained committee + 12 untuned same-lineage committee + 6 fresh silent controls) passes its zero-model gate; all jobs seal under the pinned runtime; and the paired/profile-stratified analyzer reports the preregistered trained-minus-untuned warrant-compliance interval, equivalence test, fresh-control contrasts, density, coverage, safety, committee fallback burden, and tutor-response fallback/guard diagnostics without historical pooling."
branch: codex/program2-committee-floor-ablation
claim_status: exploratory
links:
  paper: §6.21
  notes:
    - PROGRAM-2-COMMITTEE-FLOOR-ABLATION-PREREGISTRATION.md
    - PROGRAM-2-PHASE5B-FALLBACK-BATTERY-PREREGISTRATION.md
    - notes/program-2/2026-07-20-phase5-live-pilot-results.md
    - notes/program-2/2026-07-24-floor-ablation-interface-diagnosis.md
  exports:
    - exports/program2-committee-floor-ablation/launch-state.json
    - exports/program2-committee-floor-ablation/analysis.json
    - exports/program2-committee-floor-ablation-amendment-3/launch-state.json
    - exports/program2-committee-floor-ablation-amendment-3/analysis.json
    - exports/program2-committee-floor-ablation-amendment-4/launch-state.json
    - exports/program2-committee-floor-ablation-amendment-4/analysis.json
    - exports/program2-committee-floor-ablation-amendment-4/mediation-analysis.json
    - exports/program2-committee-floor-ablation-amendment-4/provenance-audit.json
  items:
    - program-2-context-vs-weights-finetune
    - program-2-weights-interface-factorial
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
- 2026-07-24 — after 10 terminal Amendment 4 jobs (nine sealed, one finalized
  two-attempt attrition), the launcher exited during unsealed job 11. The
  existing resume path skipped sealed traces but began an invalid third attempt
  of the attrition job; it was stopped before the first learner turn. Amendment
  5 makes finalized attrition terminal for resume while leaving incomplete jobs
  pending. This is launcher-only provenance: job commands, runtime treatment,
  retry limit, estimands, and reading rules are unchanged. See preregistration
  §12.
- 2026-07-24 — after 19 terminal jobs (14 sealed, five finalized attritions),
  the command-host session disappeared twice during job 20. One complete
  deterministic-audit failure was trace-visible but not launch-state-visible,
  so another blind resume would have reset its retry allowance. Amendment 6
  reconciles only terminal `model_call_error` traces, checkpoints every
  retryable failure before the retry, persists the transport-failure counter,
  and resumes job 20 at its remaining attempt 2. The two interrupted traces
  stay non-terminal and excluded; treatment and estimands remain frozen. See
  preregistration §13.
- 2026-07-24 — cohort terminal at 24/30 sealed plus six finalized attritions.
  The unchanged frozen analyzer remains `incomplete_or_under_informative`:
  W1 trained-minus-untuned = -0.060, 95% CI [-0.204, 0.105], not practically
  equivalent. A separate post-hoc mediation analyzer preserves the trained raw
  cue signature (45/55 versus 40/80) but shows differential v1 cue loss and
  heavy final-stage overwrite; all rates are conditional on sealing. The
  read-only model audit passed 30/30 checks. Awaiting review rather than paper
  fold-in or a claim about weight efficacy.
