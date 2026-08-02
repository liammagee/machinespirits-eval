---
id: adaptation-plan-3-phase-s
title: "Plan 3.0 Phase S: seat release — name what suppresses the move the bare model can make"
status: active
type: experiment
priority: P1
owner: claude
source: manual
created: 2026-08-02
updated: 2026-08-02
verification: "Gate S1 quoted from ADAPTATION-PLAN-3.0.md: some ablation
  recovers the demand move in ≥half its regenerations while the control
  stays at zero — the suppressor is named; no recovery under any ablation =
  the suppression is distributed, recorded as a bound. S2 runs only if S1
  names a suppressor."
claim_status: methods
depends_on:
  - adaptation-plan-3-model-profiler
tags:
  - tutor-stub
  - adaptation
  - casting
---

The profiler batteries ended with the demand boundary fully relocated:
sonnet-with-card makes the deadline move in a bare probe (every k=3
demand probe hit) and never in the seat (0 across every arm, draft
channel included). The seat's prompt is recorded verbatim in every
trace (system + user + message history), so the suppressor is findable
by exact ablation — no reconstruction, no new dialogues.

## S1 design

Instances: the six recorded demand-turn draft prompts (v4live d0-2 +
h1 d0-2, world-030 t2; note only 3 history messages at t2, so the
accumulated-voice suspect is weak HERE and the contract blocks are
prime). Arms, regenerated with sonnet, one call each, sol-tagged with
standing rulings: (A) control — the stored prompt untouched; (B) minus
recovery + response-check blocks; (C) minus every tutor-only contract
block; (D) bridge — setting + history + card only (the bare-probe
shape rebuilt from seat parts). 24 calls. The w033 t3 prompts join as
a second instance family if the w030 result is ambiguous.

## Gate S1 result (2026-08-02): PASSED — the standing system frame is the suppressor

24 regenerations, read directly against the move's four beats (the
Gate-H criteria). **Control 0/6** (tempo refusals + evidence walks —
the seat suppression reproduces under rendered history, validating the
instrument). **B (minus recovery blocks) 0/6** — the per-turn repair
scaffolding is not the suppressor. **C (minus all tutor-only contract
blocks, system frame kept) 0/6 full moves but a visible thaw** —
replies begin pricing the verdict and naming the decisive check as a
question. **D (system frame dropped; scene + history + card only)
5/6 assemble the move** — deadline accepted, test named, check
assigned, conditional verdict ("here's the test, not the verdict —
before eight, go stand under that mark and trace an actual line").

**Named suppressor: the tutor-stub's standing system prompt (9.4k
chars), with a secondary contribution from the per-turn contract
blocks.** Gate bar met exactly: an ablation recovers ≥half while
control stays at zero. Next: S1b — bisect the system frame (halves,
then quarters; ~12-18 calls) to name the section, THEN S2's live k=3
with that section relaxed at carded turns only. Replies archived
(`exports/s1-ablation-replies.json`); one-world/one-slot limits stand
(6 instances, w030 t2 only).
