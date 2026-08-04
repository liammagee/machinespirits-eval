---
id: measure-silent-drop-rate-in-the-grounding-validator
title: Measure the silent-drop rate in the evidence-ledger grounding validator
status: done
type: research
priority: P2
owner: codex
source: daily-routine
created: 2026-07-20
updated: 2026-08-05
branch: codex/measure-grounding-validator-silent-drop
verification: >-
  Existing cell-127/128 traces are audited without model calls; exact legacy
  silent-drop attribution is reported as unidentifiable when raw proposals are
  absent, observed terminal appearances/transitions are checked against the same-turn
  evidence ledger and thresholds, cell 127 is compared with the correct cell
  126 ablation through scripts/analyze-strategy-shift.js, and prospective
  proposal/drop/citation events are exercised by tests plus a mock smoke.
claim_status: scope-bound
links:
  prs:
    - 480
  notes:
    - notes/daily-notes/2026-07-20-research-roundup.html
    - notes/research-plans/2026-07-27-research-plan.html
    - notes/2026-08-04-grounding-validator-silent-drop-audit.md
  paper:
    - docs/research/paper-full-2.0.md#695-stage-3-result-validator-enabled-architecture-reshapes-terminal-status-distribution
tags:
  - adaptive-tutor
  - grounding
  - a14
milestone: adaptive-tutor-evidence-v1
---

## Problem

The card originally attributed the evidence-ledger `groundingValidator` to cell
113. Code audit corrected that mapping: cell 113 runs the A13 post-policy
`tutorValidator`, while the hypothesis validator is enabled only in cells
127/128 and is paired against cell 126. It returns
`{hypothesis_id, new_status, reasoning}` freely, and the graph silently dropped
a hallucinated `hypothesis_id` before this work added an audit event.

Historical traces preserved only the end-of-turn hypothesis snapshot, so a
dropped proposal left no observable event and updater/validator status writes
were collapsed together. The exact historical rate is consequently
unidentifiable. The available retrospective question is narrower: are the
persisted terminal statuses consistent with same-turn ledger evidence and the
validator thresholds?

"Evidence-Grounded Verified Agentic Reasoning" (EG-VAR, arXiv:2607.12650) is the
formal version of what this validator does informally: every accepted claim must
descend structurally from an attested tool call or a kernel-checked chain, and
the system must abstain otherwise. Abstain-over-hallucinate is the discipline the
current code lacks.

## What to do

Code and log audit of the A14 evidence-bound conditions (cells 126-128,
`runner: adaptive`).

For finished cell-127/128 dialogues, distinguish observable end-of-turn status
consistency from unobservable raw-proposal attribution. Add prospective audit
events that make every validator proposal, application/drop reason, evidence
citation and threshold check countable without changing the decision policy.

## Evaluate

Re-analysis of existing A14 dialogue traces. Compare cell 127 (validator on)
against cell 126 (validator off) on
`strategy_shift_correctness` through `scripts/analyze-strategy-shift.js`, and
read that beside the trace-identifiability result.

**Precondition.** Confirm cells 126-128 already have completed rows before
treating this as zero-cost. If the evidence-bound runs have not finished, this
item is a status check, not a re-analysis — and fresh generation would need
sign-off first.

## Log

- 2026-08-05 — PR #480 merged as `bd56f2f5`; the verified scope-bound result,
  prospective audit events, analyzer, tests, and no-cost mock smoke are now on
  `main`. The merged worktree and local/remote feature branches were removed
  after ancestry and clean-worktree verification.
- 2026-08-04 — Ready for review. The zero-model audit covered all 67 completed
  cell-127/128 dialogues (134 original/counterfactual branches; no trace
  attrition). Historical raw decisions are absent, so the exact silent-drop
  rate is not identifiable. All 493 observed terminal events (268 first
  appearances and 225 within-trace status transitions) cite non-empty same-turn
  ledger refs; 492/493 meet the configured threshold.
  The one exception is a `validated` cell-127 counterfactual hypothesis with
  six supporting and two contradicting refs. The corrected outcome comparison
  reproduces cell 126 14/33 = 42.4% versus cell 127 18/33 = 54.5% strict shift;
  §6.9.7 already records that the +12.1-pp binary gain is a +0.01 graded null.
  Added a read-only analyzer and prospective call/decision audit events. A
  no-cost eight-dialogue mock smoke observed 66 calls and 31 decisions, all
  applied and structurally grounded; 0/31 dropped. This validates the new
  instrumentation, not a real-model rate.
- 2026-08-04 — Activated in an isolated worktree. Initial source audit found
  the card's cell mapping is wrong: cell 113 contains the A13 post-policy
  `tutorValidator`, while the evidence-ledger `groundingValidator` and its
  silent unknown-`hypothesis_id` drop are confined to cells 127/128. The
  relevant paired strategy-shift contrast is therefore cell 127 against cell
  126, not cell 113 against cell 112. The historical cell-127 traces persist
  end-of-turn hypothesis state but not the validator's raw verdict proposals,
  so exact legacy silent-drop attribution also needs to be reported as
  unidentifiable rather than guessed.
- 2026-07-28 — Card opened from the 2026-07-27 research plan, where this was the
  second of three ranked items. Promoted from `workplan/inbox/2026-07-20-arxiv-2607.12650.md`.
