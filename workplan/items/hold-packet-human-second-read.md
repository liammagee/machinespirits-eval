---
id: hold-packet-human-second-read
title: Human second read of one blind hold packet (037)
status: blocked
type: research
priority: P3
owner: human
source: review
created: 2026-09-05
updated: 2026-09-05
verification: "A human reader, blind to gold and version, scores at least one of the five 037 hold packets (7b to 7f) on repair hit or not; agreement with the codex judge is reported as kappa beside the model readers' 0.50 to 0.83; the hold lean in §6.24 is kept, narrowed or dropped on that reading."
blocked_by: "Needs a human reader with time for one twelve-item packet"
claim_status: exploratory
depends_on:
  - state-detection-followups-hold-and-cues
links:
  items:
    - state-detection-followups-hold-and-cues
  notes:
    - notes/poetics/hero-demo-runs/2026-09-05-step7f-hold-cue-fix-live.md
    - notes/poetics/hero-demo-runs/2026-09-03-model-second-reader-7b-7c.md
  exports:
    - exports/tutor-stub-outcome/step7f-hold-cue-fix/
tags:
  - hold-instrument
  - human-read
---

The hold instrument's card closed on 2026-09-05 with one step open: no human
has read a blind packet. Three model readers (Sonnet 5, Opus 5, Fable 5.1)
agree with the codex repair judge at kappa 0.50 to 0.83 across the five
packets, and no reader is above the others throughout. The model reads do not
stand in for a human one.

The packets are in the run folders under `exports/tutor-stub-outcome/step7*`
(archived). Twelve items each, one call per reader. Score with
`scripts/score-blind-packet-model.js` as the template for the sheet. No paid
call is needed.
