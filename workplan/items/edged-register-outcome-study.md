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

2026-08-17 M-C2 endpoint read complete — **the check FAILS** (draft note
§2.15). The operator read the first and last row of each kept cell blind to
the classifier: 4 of 12 disagreements, 33.3%, against a 20% bar. The
corridor estimates in §2.13 are void for selection and the endpoint must be
revised before registration. Three of the four disagreements run one way —
the learner keeps its resistance phrase at the front and does fresh work
behind it, and the classifier vetoes on the surface phrase. The fourth runs
the other way, so the rule is keyed to the wrong surface and misses in both
directions. Same defect class as §2.11 and the stance-gate 2.0 finding.

2026-08-17 revised endpoint written and applied (draft note §2.16, §2.17).
The operator ruled against spending a hand-marked test set. A blind model
reader sees the learner's earlier turn, the tutor's push and the learner's
next turn, and answers what task the tutor set and whether the learner did
it — a question a second reader can argue from the transcript. The
yes/partly/no-to-conversion rule was frozen at commit `b761bbbe` before any
per-cell number was visible: yes only is primary, yes-plus-partly is
reported beside it. No new generation; the same 109 paid rows.

Reader answers across 109 rows: yes 52, partly 47, no 10.

**A corridor exists on the revised endpoint.** Four cells kept —
question_flood_sustained 5/12, rote_parroting_sustained 5/12,
boredom_claimheld 7/12, rote_parroting_guarded 6/12, all 12/12
edge-eligible. Pooled 23/48 = 0.479, powering baseline 0.550. Dropped:
irrelevance_sustained 2/12 below the floor, boredom_guarded 9/12 above the
ceiling, frustration_claimheld excluded a second time by the
edge-eligibility screen (0/12 eligible) on a different endpoint.

**The corridor hangs on one line.** On the sensitivity reading (yes or
partly) every cell saturates at or above the ceiling and none is kept. The
mapping rule was frozen before the numbers, so the choice was not tuned to
the answer, but the weight sitting on that line is a fact about the study
and travels with it.

Operator spot check of the reader (§2.17.1): twelve rows drawn by fixed
spread from the yes/partly line inside the kept cells, six each way, all
twelve agree. Two limits — the reader states its answer first, so this
confirms rather than reads cold, and no bar is registered for this check
(the 20% M-C2 bar was for the old question).

Open operator rulings: whether the spot check licenses the revised endpoint
for selection; whether 0.479 with baseline 0.550 powers the main block;
whether any of the 11 remaining rows under the 120 cap are spent on the
five n=5 cells the screen dropped. The main block still needs its own GO
note and launch approval.

Owed before the main block (draft note §2.14): **fixed 2026-08-17.** The
runner overwrote the state file from memory on exit, which could silently
discard a ruling recorded by another process. Saving now re-reads the file
and merges the fields another process owns — rulings, guardrail
resolutions, killed cells — before the write. Five tests cover it; four
fail without the merge. The working rule stands anyway: never record a
ruling until the runner has fully exited.
