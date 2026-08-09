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
paper v3.0.282 --- renumbered from v3.0.280 in the 2026-08-09 merge), no count moved, and the counts are now claims about
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

## Outcome

Run `eval-2026-08-08-6021754f`, 2026-08-09. 15/15 rows, 15/15 tutor scores,
27/27 register slices, 15/15 read for manner with none unread. The report came
back COMPLETE on all four measures. Paper v3.0.283 (renumbered from v3.0.281).

| measure | this run, codex on both seats | parent, nemotron ego / kimi id | Fisher |
|---|---|---|---|
| tutor calls on the plan model | 135/135 | — | — |
| cue compliance | 15/15 | 8/15 | p = 0.0063 |
| read as edged | 11/15 | 6/15 | p = 0.1394 |
| positive local outcome, faithful rows | 9/11 | 5/8 | — |

Registered verdict: **no separation at this size**, keyed to the reading. Not
agreement — fifteen rows against fifteen cannot tell 11 from 6.

Two things this settles. The weak pairing's shortfall was mostly a writer
failing to use a cue phrase it had been handed: seven of its fifteen turns
missed the cue, none of the strong writer's did. And the gap between saying the
words and meaning them survives the stack change, because a writer that uses
the cue every time still writes the manner into eleven turns out of fifteen.

## Why eleven and not fifteen

Post hoc — found by reading the four flat turns afterwards, not registered.

What separates them is a mock-compliment: praise in the words that the sentence
then withdraws. Ten of the eleven edged turns carry one; one of the four flat
turns does (p ≈ 0.033).

- edged, row 34759: "But nice trick, the tidy reversal can still become the
  answer vending machine"
- edged, row 34760: "Conveniently, it marches to `mind of one's own` without
  ever making the servant touch anything"
- flat, row 34761: opens "Your answer has found the hinge" — real praise, no
  barb anywhere in the turn
- flat, row 34763: opens "You're stuck at the hinge, not the slogan" —
  diagnosis, not mockery
- flat, row 34770: gives the cue bare, then teaches straight

The reader is not hunting the cue. Rows 34772 and 34773 open with the same
sentence — "Wonderful: the formula can sound like understanding while doing
none of the work" — and it called one edged and one flat, on what the rest of
the turn does. Row 34768 is the mirror case: the bare cue sentence is the
evidence it quotes for an edge, in a turn where the pressure keeps up.

So the next question for a design is whether the mock-compliment can be asked
for directly, and whether asking costs anything. Nothing here tests that.

*Follow-up ([[register-mock-praise-probe]], run `eval-2026-08-09-bb402d97`):
the question dissolved. This same arm re-drawn one day later read 14/15 —
the 11/15 was a draw, not a rate. The device pattern held prospectively
(29/29 with praise edged, the one bare turn flat).*

## Limits

One arm, one writer, one reader, one draw per cell, fifteen rows against
fifteen. A screen for collapse, not an estimate. Cross-run and cross-stack by
construction. The stack change moves two tutor seats at once, so no part of the
move can be pinned on the ego or the id alone. The mock-compliment pattern is
post hoc on 15 rows.

Plan hash, printed by the dry run and fixed before the first call:
`399d618831892f0f5fced889fccf4d10de3bca75cb4654b226473b863c1955dd`.
Apparatus tested 16/16.
