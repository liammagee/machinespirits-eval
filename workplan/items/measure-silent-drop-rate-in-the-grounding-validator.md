---
id: measure-silent-drop-rate-in-the-grounding-validator
title: Measure the silent-drop rate in cell 113's grounding validator
status: triaged
type: research
priority: P2
owner: unassigned
source: daily-routine
created: 2026-07-20
updated: 2026-07-28
verification: >-
  Either a status check showing cells 111-113 have no completed rows yet, or a
  measured silent-drop rate — for a sample of finished cell_113 dialogues, every
  validator promote/retire decision checked against whether its cited evidence
  really sits in the evidence ledger at that turn — reported beside a cell_113
  against cell_112 comparison on strategy_shift_correctness from
  scripts/analyze-strategy-shift.js, all from existing traces.
claim_status: planned
links:
  notes:
    - notes/daily-notes/2026-07-20-research-roundup.html
    - notes/research-plans/2026-07-27-research-plan.html
tags:
  - adaptive-tutor
  - grounding
  - a13
milestone: adaptive-tutor-evidence-v1
---

## Problem

Cell 113 (`state_policy_with_validator`) runs a grounding validator that promotes
or retires learner hypotheses against an evidence ledger
(`GROUNDING_VALIDATOR_SYSTEM`, `services/adaptiveTutor/realLLM.js:913`). The
validator returns `{hypothesis_id, new_status, reasoning}` freely, and the code
already names its own weak point at `services/adaptiveTutor/graph.js:625-631`: a
hallucinated `hypothesis_id` is dropped without a sound.

So the failure is known and commented, but nobody has measured how often it
happens. A validator that quietly discards a share of its own decisions is not
doing the job the cell is meant to test, and the size of that share decides
whether the cell 113 against cell 112 contrast means anything.

"Evidence-Grounded Verified Agentic Reasoning" (EG-VAR, arXiv:2607.12650) is the
formal version of what this validator does informally: every accepted claim must
descend structurally from an attested tool call or a kernel-checked chain, and
the system must abstain otherwise. Abstain-over-hallucinate is the discipline the
current code lacks.

## What to do

Code and log audit of the A13 conditions (cells 111-113, `runner: adaptive`).

For a sample of finished cell 113 dialogues, check whether the evidence each
promote/retire decision cites actually exists in the ledger at that turn, or
whether the decision is reasoning-only with nothing structural behind it. That
gives the silent-drop rate the code comment names but does not count.

## Evaluate

Re-analysis of existing A13 dialogue traces. Compare cell 113 (validator on)
against cell 112 (`state_policy`, validator off) on
`strategy_shift_correctness` through `scripts/analyze-strategy-shift.js`, and
read that against the hand-audited hallucinated-id rate.

**Precondition.** Confirm cells 111-113 already have completed rows before
treating this as zero-cost. If the A13 pre-registration run has not finished,
this item is a status check, not a re-analysis — and fresh generation would need
sign-off first.

## Log

- 2026-07-28 — Card opened from the 2026-07-27 research plan, where this was the
  second of three ranked items. Promoted from `workplan/inbox/2026-07-20-arxiv-2607.12650.md`.
