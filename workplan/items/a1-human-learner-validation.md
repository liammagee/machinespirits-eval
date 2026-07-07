---
id: a1-human-learner-validation
title: Human-learner validation pilot (real learning gains)
status: blocked
type: experiment
priority: P0
owner: human
source: todo
created: 2026-06-22
updated: 2026-06-24
verification: Phased N≈90 pilot runs end-to-end across 3 arms; pre/post MCQ +
  immediate transfer + coded free-text explanation + 1-week retention scored;
  the tutor-quality → learning-gains path is estimated (or shown null) in
  exports/.
blocked_by: IRB approval + real consent text + real item content (content/legal
  track, not engineering)
claim_status: future
links:
  paper: §8.1, §9
  notes: notes/design-a1-human-learner-pilot.md
  items: socratic-structured-tutoring-readings
tags:
  - pilot
  - human-learner
  - critical
milestone: human-pilot-prep
---

The single highest-value open question: all evaluations use simulated learners,
so whether recognition-enhanced tutoring produces genuine learning gains with
real humans is unestablished.

**Engineering is complete** (pilot store, routes, item bank, participant UI,
ingestion, 15 tests) — see TODO §A1 for the build manifest and commits. The
2026-05-18 design is a 3-arm pilot (base / recognition / behaviorist-matched
`cell_96`).

Recruitment is gated on the content/legal track, not code: IRB, consent text,
NAEP-derived items, NASA-TLX wording, OSF pre-registration, internal dogfood N=5,
Prolific plumbing. Keep this item `blocked` until those clear; don't let it read
as actionable engineering.

Do not restate the runbook here — it lives at the linked note and TODO §A1.

2026-06-24 Codex: Socratic-reading follow-up closed. The three readings strengthen existing A1 design instincts (explicit curriculum sequencing, student-state inference, unassisted post-test/transfer, and withhold-and-derive patterns) but do not change the immediate blocker: IRB, consent text, and real item content remain the gate before any pilot recruitment.
