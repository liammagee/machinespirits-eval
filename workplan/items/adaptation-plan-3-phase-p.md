---
id: adaptation-plan-3-phase-p
title: "Plan 3.0 Phase P: the in-seat dose profiler, the voice-change probe, and the routing note"
status: active
type: experiment
priority: P2
owner: claude
source: manual
created: 2026-08-02
updated: 2026-08-02
verification: "Gates registered before any run. Gate P1: the in-seat probe
  must reproduce two live anchors — sonnet demand at doses 1-3 stays at/near
  zero (the S2c/S2d nulls) and opus stake at dose 0 hits at least half (R4) —
  before any new cell earns a reading; each model x move then gets a recorded
  minimum in-seat dose or a recorded wall. Gate P2: measurement, not
  pass/fail — spliced-window voice-change detection rate vs intact-window
  false-alarm rate; the difference is the router's visibility price. P3 is
  written only from P1+P2 numbers."
claim_status: methods
depends_on:
  - adaptation-plan-3-phase-l
tags:
  - tutor-stub
  - adaptation
  - casting
---

The casting sheet, finished properly. P1 measures minimum dose IN THE SEAT
(the only channel that predicts live behavior — the channel law): base
prompts are the stored butler-arm seat prompts (card-free by construction),
dose composed on top identically per level (0 none, 1 card, 2 +exemplar,
3 +exemplar+contract-licence). Cells: demand (w030 t2, 5 instances) x
doses 0-3 x {sonnet, opus}; stake (w033 t20, 5 instances) x doses 0-1 x
{sonnet, opus}. 60 regenerations, read against the four beats / split
criterion under the standing rulings.

P2 prices the alternative to dosing: swap ONE mid-dialogue tutor turn to
an opus regeneration (same stored seat prompt, model swapped), show judges
transcript windows ENDING at the swapped turn (no continuation mismatch),
and compare "does the tutor's voice change?" detection on spliced vs
intact windows.

P3: the routing design note, written from the two numbers — when to dose,
when to cast up front, when (if ever) to switch mid-dialogue.
