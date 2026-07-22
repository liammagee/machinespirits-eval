---
id: program-2-committee-floor-ablation
title: "Price the fine-tune: live committee with the untuned mini"
status: triaged
type: experiment
priority: P2
owner: unassigned
source: manual
created: 2026-07-22
updated: 2026-07-22
verification: "The exact Phase 5b design with one variable changed — the untuned same-lineage floor model (program2-floor-instruct-q8) in the mini seat, fallback policy v2 — run under a small frozen prereg (12 committee-floor dialogues + stationarity-pooled controls, seeds and bars fixed before launch), yields a pooled warrant-compliance rate whose comparison against both the pooled control (0.150) and the trained-mini committee reference (0.386, 5b §8) cleanly attributes the live gain between harness and weights."
claim_status: planned
links:
  paper: §6.21
  notes:
    - PROGRAM-2-PHASE5B-FALLBACK-BATTERY-PREREGISTRATION.md
    - notes/program-2/2026-07-20-phase5-live-pilot-results.md
  items:
    - program-2-context-vs-weights-finetune
tags:
  - tutor-stub
  - fine-tune
  - committee
  - ablation
milestone: adaptive-tutor-evidence-v1
---

The one factorial cell the live program never ran: every live committee
result (5, 5b, 5c) used the trained mini, so the harness contribution
(fail-closed battery: resample + cue-preserving trim) and the training
contribution (cue reliability: offline cue failures 19→6; live cue
component 0.54 vs frontier 0.40) were never separated. This run separates
them for roughly the cost of Phase 5b (~700 sonnet + ~1,000 terra CLI
calls; mini local/free).

Readings, frozen in the prereg before launch: committee-floor ≈ 0.386 →
the fine-tune was decorative and the live result is harness engineering
(the battery extracts compliant questions from the untuned model by
resampling/trimming harder); committee-floor ≪ 0.386 (toward control) →
the trained weights are load-bearing and the fine-tune's live
contribution is priced as the difference. Either answer sharpens §6.21's
attribution and directly informs whether the iterated-exhaust retrain
([[program-2-iterated-exhaust-retrain]]) is worth its run: if the
harness carries everything, retraining targets the wrong organ.

Design notes carried from 5b: use current `main` as the sole maintained runtime
after the Program-2 reconciliation, but preserve the exact committee-v2,
fallback-v2, frozen-v1 Phase 5b design. The archived 91b8a50e lineage is
provenance only; Phase 5d's committee-v3 delivery-integrity rider is out of
scope unless separately preregistered. Expect more battery interventions
per moment (the untuned model's known question-discipline weakness is
exactly what the battery repairs), so record the fallbackResolution
distribution as a primary descriptive alongside E1.
