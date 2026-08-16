---
id: edged-register-outcome-study
title: Edged-register outcome study on a de-saturated baseline
status: active
type: experiment
priority: P2
owner: claude
source: manual
created: 2026-08-15
updated: 2026-08-16
verification: A powered main block (or a registered no-corridor kill verdict)
  answers whether router-selected ironic/sarcastic delivery beats the warm
  router on post-resistance conversion, on persona-scenario cells where the
  warm baseline converts at 30-70%. Each paid stage runs only after its own
  committed GO note plus explicit human approval.
claim_status: future
depends_on:
  - adaptive-register-switching
links:
  notes:
    - notes/2026-08-15-edged-register-outcome-study-design.md
    - notes/2026-08-16-edged-register-calibration-draft.md
    - notes/2026-08-09-adaptive-register-switching-prereg-draft.md
  code:
    - services/adaptiveRegisterSwitchingStage2.js
    - scripts/run-adaptive-register-switching-stage2.js
    - services/tutorStubEdgeTimingPolicy.js
tags:
  - registers
  - adaptive
  - outcome
---

Stage 2 of the register-switching arc returned NO_PRIMARY_EVIDENCE because
the warm control converted at .94 — the endpoint sat at the ceiling and the
study could not measure a difference. This card re-asks the outcome question
on learners the warm router does not already convert.

Design (see the linked note): three versions of the tutor — adaptive-edged,
yoked-warm (same router, same moments, warm delivery substituted at each
edge moment; prices manner at matched timing), and router-warm. A warm-only
calibration pilot first finds persona-scenario cells with conversion in a
30-70% corridor; if none exists the study stops with a registered kill
verdict. Primary endpoint: post-resistance conversion, adaptive-edged
versus router-warm, on corridor cells only. Stance-fidelity and
manner-presence run as gates; the person-directed-harm guardrail runs
report-only with a pause-for-review stop rule. face_threat stays out of the
menu (simulated-only rule). Sonnet-class judge from the first row.

The confirmatory-grid interaction signals (edged helps diligent, hurts
affective-resistant) are hypotheses only — that instrument was ruled
invalid. Stage order: build (no paid calls) → calibration pilot →
registration freeze from calibration evidence → main block. Nothing is
registered or authorized yet.

2026-08-16 operator rulings (recorded in the calibration draft note): the
four review amendments approved — first-edge-moment A-vs-B endpoint,
two-pass content/manner split on arms A and B, upper-80%-bound powering,
edge-eligibility screen as a keep condition. Stack pinned: generation
codex `gpt-5.6-luna`, judge claude-code Sonnet 5. Calibration at 4 lanes.

Next step: Stage 0 build (no paid calls) in `../ms-edged-register` —
hardened personas, two-pass payload seam, yoked delivery swap, calibration
runner (screen n=5 → confirm n=12, 4 lanes), corridor selector with
eligibility screen, new cell IDs, tests. No paid call is licensed until a
GO note lands.
