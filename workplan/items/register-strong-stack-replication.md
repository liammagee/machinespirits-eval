---
id: register-strong-stack-replication
title: Does the sarcastic edge survive a strong writer?
status: active
type: experiment
priority: P2
owner: claude
source: manual
created: 2026-08-09
updated: 2026-08-09
verification: The plan is frozen and its SHA printed by --dry-run before the
  first paid call. The report is zero-call and fails closed on four registered
  measures, one of which reads the tutor stack off the dialogue traces rather
  than off the model columns. The comparison against the parent sarcastic arm
  is fixed in the plan before the run exists.
claim_status: exploratory
depends_on:
  - register-manner-learner-turn
  - register-presence-hand-marked-set
links:
  notes:
    - notes/2026-08-09-register-strong-stack-replication-preregistration.md
  services:
    - services/registerStrongStackReplication.js
  scripts:
    - scripts/run-register-strong-stack-replication.js
  tests:
    - tests/registerStrongStackReplication.test.js
tags:
  - register
  - manner
  - id-director
  - provenance
---

Every August negative-register run stores `codex.gpt-5.5` and none of them
called it on the tutor side. The fix is in ([[register-manner-learner-turn]],
paper v3.0.280), no count moved, and the counts are now claims about
nemotron/kimi. This buys one arm back on a strong writer before buying the
whole grid.

## The design

Cell 197, the parent sarcastic arm, unchanged. The same five resistance
targets, 3 repeats, 15 rows. `codex.gpt-5.5` on the ego and the id — by an
override that now reaches both seats. Same gate (`sarcastic` at
`stance-gate/2.0`), same fold (adopting turn), same judges, same pinned reader
on the same versioned question.

Comparison fixed before the run exists, from paper v3.0.279:

| measure | parent arm, nemotron ego / kimi id |
|---|---|
| cue compliance | 8/15 |
| read as edged | 6/15 |

## Registered measures

The report is zero-call and fails closed on all four.

1. **Provenance** — every `id`, `ego` and `agency_return_verifier` call in the
   dialogue traces went to `codex.gpt-5.5`. Read off the trace, which records
   the call, not the model columns, which record the ask. Those two disagreed
   silently for four runs; that disagreement is why this run exists, so it is a
   measure and not a courtesy.
2. **Cue compliance** — faithful rows under the gate at the adopting turn.
3. **Manner presence** — of those, how many the reader calls edged. An unread
   row fails the report; it is not a flat row.
4. **Positive local outcome** — the parent's own registered verdict.

## What it can show

Fifteen against fifteen screens for collapse; it does not estimate. A large
move separates, a small one does not, and a non-separating result is
uninformative rather than agreement — the report says
`NO_SEPARATION_AT_THIS_SIZE` rather than letting it read as a null. The stack
is the only thing that changes, but it changes two seats at once, so a move
cannot be pinned on the ego or the id alone.

## Status

Apparatus built and tested (16/16). Plan hash printed by the dry run and fixed
before the first call:
`399d618831892f0f5fced889fccf4d10de3bca75cb4654b226473b863c1955dd`.

Outcome to follow.
