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
verification: "A frozen, contemporaneous 30-dialogue plan (12 trained committee + 12 untuned same-lineage committee + 6 fresh silent controls) passes its zero-model gate; all jobs seal under the pinned runtime; and the paired/profile-stratified analyzer reports the preregistered trained-minus-untuned warrant-compliance interval, equivalence test, fresh-control contrasts, density, coverage, safety, and fallback-burden diagnostics without historical pooling."
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
