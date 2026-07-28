---
id: audit-trap-state-schema-for-typed-reveal-events
title: Audit the trap-scenario state schema for typed reveal events
status: done
type: research
priority: P2
owner: unassigned
source: daily-routine
created: 2026-07-20
updated: 2026-07-28
verification: >-
  A gap list over a sample of cell 110/111/113/124 trap dialogues, each trap turn
  hand-coded against the four Narrative World Model query types (who-knows-what,
  when-learned, event-ordering, setup-payoff) and matched to the
  learnerProfileSchema fields actually recorded at that turn via loadTrace(),
  naming every turn where a strategy shift was scored with no typed reveal event
  under it; drawn from existing dialogue logs and state snapshots, no new runs.
branch: claude/audit-trap-state-schema-reveal-sxoggr
claim_status: methods
links:
  notes:
    - notes/daily-notes/2026-07-20-research-roundup.html
    - notes/research-plans/2026-07-27-research-plan.html
    - notes/2026-07-28-trap-state-schema-typed-reveal-audit.md
  scripts:
    - scripts/audit-trap-reveal-events.js
    - scripts/lib/trapRevealQueryCoding.js
tags:
  - adaptive-tutor
  - state-schema
  - trap-scenarios
milestone: adaptive-tutor-evidence-v1
---

## Problem

`learnerProfileSchema` in `services/adaptiveTutor/stateSchema.js` already carries
a fairly rich bilateral-ToM extension — `misconceptions`, `confidence`,
`agencySignal`, `zpdEstimate`, `tomProbes`. All of it describes ongoing belief
state. None of it has a typed slot for "this fact was revealed at turn T", which
is a different kind of thing: an event with a time, not a standing estimate.

That matters because `strategy_shift_correctness` scoring across cells 110-125,
and the whole-transcript poetics rubric, both lean on judge inference for exactly
the questions a reveal event would settle. If the trace holds no record that
something was disclosed at a given turn, a scored shift rests on the judge's
reading rather than on anything in the state.

"Narrative World Model: Narratology-Grounded Writer Memory for Long-Form Fiction"
(arXiv:2607.05577) builds a typed temporal-state graph to answer two questions —
who knows a given fact and when they learned it, and whether an earlier setup
paid off. Those are the same two questions, so its schema is usable as an audit
instrument against ours.

## What to do

Read-only. Pull persisted state traces for a small sample of cell 110/111/113/124
dialogues, drawn from `config/adaptive-trap-scenarios.yaml` and
`config/cross-suite-trap-scenarios.yaml`. Hand-code each trap turn against the
four query types, and set that coding beside the `learnerProfileSchema` fields
recorded at the same turn through `loadTrace()` in
`scripts/analyze-strategy-shift.js`.

Flag every turn where a strategy shift was scored but the state trace holds no
typed reveal event to ground it.

## Evaluate

Existing dialogue logs and state snapshots for cells 110-125. No new generation.

The output is a structural gap list to weigh against `strategy_shift_correctness`
— not a new metric, and not a claim about whether the schema should change. If
the gap list comes back thin, that is the finding.

## Log

- 2026-07-28 — Card opened from the 2026-07-27 research plan, where this was the
  first of three ranked items. Promoted from `workplan/inbox/2026-07-20-arxiv-2607.05577.md`.
- 2026-07-28 — Audit done. Gap list in
  `notes/2026-07-28-trap-state-schema-typed-reveal-audit.md`. Hand coding of all 14
  trap turns against the four NWM query types is checked in at
  `scripts/lib/trapRevealQueryCoding.js`; the mechanical half is
  `scripts/audit-trap-reveal-events.js` (read-only, joins the coding to the state
  fields at trigger+1 via `loadTrace()`).

  Result: 30 of 30 scored trap turns across cells 110/111/113/124 carry no typed
  reveal event. Not thin, and not a close call — `evidenceLog`/`hypotheses` are
  written only by the three `state_policy_*evidence_bound*` architectures and
  `tomProbes` only by the `bilateral_tom*` ones, so all three channels are
  structurally empty on these four cells. `strategy_shift_correctness` reads
  `tutorInternal.policyAction` and the scenario answer key, and no state. The one
  typed event present, `trapEvents`, is `hiddenLearnerState.triggerSignal` echoed by
  the runner at the scripted turn, so it sits upstream of the tutor and no scorer
  reads it. Cell 111 (`recognition_only`, the A13 C1 baseline) has no
  `learnerProfileUpdate` node and so records no learner state at any turn.

  Reads as a wiring gap rather than a schema gap: `evidenceLog` and
  `tomProbes.infoaccess_list` already answer who-knows-what and when-learned, they
  just do not run on the trap cells. Setup-payoff — needed by 11 of the 30 turns —
  has no home anywhere.

  Limitation: this checkout has no `data/` or `logs/`, so the trace half ran on a
  hermetic mock corpus. Every finding is fixed by graph topology, schema, and what
  the scorers read, so none turns on model output; re-running the script against the
  real corpus should reproduce the verdict counts exactly.
