---
id: program-2-weights-interface-factorial
title: "Separate trained skill from interface transmission"
status: active
type: experiment
priority: P1
owner: codex
source: review
created: 2026-07-24
updated: 2026-07-25
verification: "A preregistered 2×2 trained/untuned × v1/v2 cohort passes provenance and cue-blind-enforcement gates, seals with the frozen missingness thresholds, and reports blinded first-pass semantic skill, transmission, burden, attrition, and final operational outcomes without historical pooling."
branch: codex/program2-committee-floor-ablation
claim_status: planned
links:
  paper: §6.21
  notes:
    - PROGRAM-2-WEIGHTS-INTERFACE-FACTORIAL-PREREGISTRATION.md
    - notes/program-2/2026-07-24-floor-ablation-interface-diagnosis.md
    - notes/program-2/2026-07-25-weights-interface-factorial-launch-decision.md
  exports:
    - exports/program2-committee-floor-ablation-amendment-4/analysis.json
    - exports/program2-committee-floor-ablation-amendment-4/mediation-analysis.json
    - exports/program2-committee-floor-ablation-amendment-4/provenance-audit.json
  items:
    - program-2-committee-floor-ablation
    - tutor-stub-final-audit-reliability-gate
tags:
  - tutor-stub
  - fine-tune
  - interface
  - factorial
milestone: adaptive-tutor-evidence-v1
---

The completed floor ablation left trained-weight attribution under-informative
and exposed differential interface mediation. The successor crosses the two
same-lineage mini artifacts with frozen question-only v1 and cue-preserving,
non-generative v2 while removing cue-aware resampling and selection from the
delivery harness.

The primary endpoint is condition-blind semantic warrant validity in the raw
mini turn. Lexical cue movement, transmission, correction burden, attrition,
and final system compliance remain separate endpoints. No historical results
are pooled.

Log:

- 2026-07-24 — design frozen after the official incomplete reading, final
  zero-call mediation waterfall, and 30/30-check local provenance audit. No
  successor implementation, paid smoke, or cohort launch is licensed in this
  change set.
- 2026-07-24 — user approved the frozen sequence as a separate implementation
  slice and authorized paid smoke/cohort calls when the preregistered clean-SHA,
  zero-model, provenance, and smoke gates pass.
- 2026-07-24 — implementation committed at
  `c32c5c0c89d2a419a64e6d7a0cd361b919202c1c`; zero-model, focused tests,
  prompt/world quality, lint, prelaunch provenance, and local-mini smoke passed.
  The excluded paid four-cell smoke ended 3/4 sealed with `trained_v2`
  finalized attrition. Post-smoke provenance passed 11/11, 64/64 committee
  moments carried cue-blind ledgers, and mini resamples were zero. Cohort and
  semantic judging are blocked pending [[tutor-stub-final-audit-reliability-gate]].
- 2026-07-24 — the separate common final-audit reliability gate passed at
  `6faca5440eb911fe9f2d24bbd5e45c123a7814ad`: fresh smoke 4/4 sealed, zero
  attrition, exactly one recovered retry, 11/11 provenance, zero mini
  resamples, and no normalized treatment-command drift. The card returns to
  triage for a separate explicit 48-dialogue launch decision; no cohort or
  semantic judging was started by the gate.
- 2026-07-25 — explicit **GO** decision recorded for the fresh 48-dialogue
  cohort after the user requested the preregistered next move. The run is
  activated on the unchanged validated treatment implementation. Launch must
  pin the clean post-decision SHA, use
  `exports/program2-weights-interface-factorial`, pass the fresh zero-model and
  read-only provenance gates, and retain all retries and attrition. The
  conservative two-attempt generation ceiling is 30,720 configured-provider
  calls (23,040 Terra and 7,680 Sonnet); the expected count is materially lower.
