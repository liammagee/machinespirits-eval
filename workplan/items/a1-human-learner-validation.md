---
id: a1-human-learner-validation
title: Human-learner validation pilot (real learning gains)
status: blocked
type: experiment
priority: P0
owner: human
source: todo
created: 2026-06-22
updated: 2026-08-30
verification: A replacement prospective design first freezes the canonical
  closed-loop state → action → guard → outcome tutor against a move- and
  resource-matched non-adaptive, yoked, or fixed-policy control in one bounded
  proof-DAG domain; after IRB approval and final consent/items, a phased human
  pilot scores pre/post performance, immediate transfer, independently coded
  explanation, and delayed retention, and reports the learning effect or null.
blocked_by: Canonical-kernel human-study redesign + independent state/move and
  proof-DAG validity + IRB approval + final consent and item content
claim_status: future
depends_on:
  - adaptive-causality-human-state-move-validation
  - adaptive-proof-dag-cross-world-validation
links:
  paper: §8.1, §9
  notes:
    - notes/poetics/2026-08-29-adaptive-tutor-from-null-to-control.html
    - ADAPTIVE-TUTOR-KERNEL-CONTRACT.md
  items:
    - adaptive-causality-human-state-move-validation
    - adaptive-proof-dag-cross-world-validation
    - socratic-structured-tutoring-readings
tags:
  - pilot
  - human-learner
  - critical
milestone: human-pilot-prep
---

The single highest-value open question remains whether the tutor's improved
local causal control produces genuine learning gains with real humans.

The participant infrastructure is reusable: pilot store, routes, item bank,
participant UI, ingestion, and tests. It was built for the historical 2026-05
prompt-condition design (base / recognition / behaviorist-matched `cell_96`),
which remains historical context in TODO §A1 rather than the current launch
design. The linked standalone runbook never existed in the tracked repository.

The replacement study must test the canonical closed-loop kernel against a
matched non-adaptive policy, not treat the unchanged May recognition-slope
hypothesis as though it became positive. That redesign and the kernel-to-pilot
adapter are not complete. Recruitment also remains gated on IRB, consent text,
real items, pre-registration, internal dogfood, and recruitment plumbing.

Keep this item blocked until both the construct-validity dependencies and the
content/legal gates clear. The pilot must report a null without substituting
transcript-visible synthetic learner change for human learning.

2026-06-24 Codex: Socratic-reading follow-up closed. The three readings strengthen existing A1 design instincts (explicit curriculum sequencing, student-state inference, unassisted post-test/transfer, and withhold-and-derive patterns) but do not change the immediate blocker: IRB, consent text, and real item content remain the gate before any pilot recruitment.

2026-08-30 Codex: Blocker refresh confirmed that the participant consent and
item bank are still explicitly marked as placeholders, while recruitment
remains closed by default. The aggregate pilot store contains two sessions and
zero completions. No IRB-approved consent or real item content was found, so
the external dependency remains live; no participant recruitment was
attempted.

2026-08-30 Codex: Reframed after the human-work review. The durable P0 objective
is human learning, transfer, and retention; the old prompt-condition treatment
is no longer the primary adaptive-tutor question. Existing participant
infrastructure remains reusable, but the current canonical-kernel contrast must
be designed and integrated before recruitment.
