---
id: edged-register-outcome-study
title: Edged-register outcome study on a de-saturated baseline
status: active
type: experiment
priority: P2
owner: claude
source: manual
created: 2026-08-15
updated: 2026-08-17
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

Stage 0 build is complete: hardened personas, two-pass payload seam, yoked
delivery swap, calibration runner, corridor selector with eligibility
screen, cells 206-208, tests. The GO note landed as commit `1a9b7034` and
the paid screen block ran from it.

2026-08-16 calibration finding (draft note §2.11): the person-directed-harm
matcher fired three times in 40 warm rows, every time on the two words
"your capacity" in praise of what the work builds. The operator read all
three turns and resumed unchanged. The matcher was written for turns
deliberately written to cut and was reused on warm turns untested. Before
the main block it must be replaced by a reader — a model reads every edged
turn, a human rules on its flags — and no detector that caps a **score**
enters a gate again without a hand-marked test set first. This repeats the
stance-gate 2.0 finding where the manner phrase list scored 1/15 against
readers at 19/20 and 15/15.

2026-08-16 screen block complete (draft note §2.12): 60 paid rows, all
resolved. Seven harm-tripwire pauses, all the two words "your capacity" in
praise of what the work builds, all ruled resume_unchanged. One cell dropped
at the floor (0/5), one at the ceiling (5/5). Ten cells survived; the §2.3
rule took the seven at 0.10 from .50 and left three at 4/5 unconfirmed. The
warm router converts at 33/60 pooled — de-saturated, unlike stage 2 at .94 —
so a corridor looks likely to exist, but no cell is kept until the confirm
block pools it to n=12 under §2.4.

2026-08-16 confirm block complete (draft note §2.13): 49 paid rows from the
GO note at `b03caee9`, 109 rows total against the 120 cap. Four rows timed
out once and all four passed on the retry, so no cell finished short of
n=12. Four more harm-tripwire pauses, eleven across the study, every one the
two words "your capacity" and none an attack; all ruled resume_unchanged.
`status_shame` and `coerced_uptake` never fired in 109 rows.

**A corridor exists.** Six cells kept: irrelevance_sustained 6/12,
question_flood_sustained 5/12, rote_parroting_sustained 6/12,
boredom_claimheld 5/12, boredom_guarded 5/12, rote_parroting_guarded 7/12.
Pooled 34/72 = 0.472, powering baseline 0.529 — against the .94 that killed
stage 2. frustration_claimheld was excluded by the edge-eligibility screen
(0/12 eligible rows) despite converting at 8/12; the screen changed an
outcome for the first time.

Next step: the §2.5 M-C2 endpoint read — the operator marks the first and
last row of each kept cell in `audit-readings-template.json` and the
selector re-runs with `--audit-readings`. More than 20% disagreement with
the classifier voids the corridor estimates. Registration freezes only after
that read passes; the main block then needs its own GO note and launch
approval.

Owed before the main block (draft note §2.14): the runner overwrites the
state file from memory on exit, which can silently discard a ruling recorded
by another process. Working rule meanwhile — never record a ruling until the
runner has fully exited.
