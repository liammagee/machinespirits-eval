---
id: repetition-audit-misses-reworded-stall
title: The repetition audit catches verbatim looping and misses a reworded stall
status: done
type: infra
priority: P3
owner: claude
source: review
created: 2026-07-28
updated: 2026-07-28
verification: >-
  `auditTutorStubAdvanceResponse` scores content-word novelty against the recent
  tutor turns and fires `tutor_turn_without_advance` below 0.25. The full
  eight-turn Riverside bare arm is pinned as a test case: it fires on the last
  turn while `maxSimilarity` stays under the lexical threshold, which is the
  whole point. Both scores are reported on the one audit object; the lexical
  channel is unchanged and the advance channel is opt-in, so a caller that
  cannot supply its context gets exactly the old behaviour.
links:
  code:
    - services/tutorStubResponseGuard.js
    - services/tutorStubGuardDisposition.js
    - services/tutorStubObservedAudits.js
    - scripts/tutor-stub.js
    - tests/tutorStubResponseGuard.test.js
  items:
    - tutor-instrumentation-showcase
    - tutor-redeclares-close-lifecycle-has-not-accepted
tags:
  - tutor-stub
  - guards
---

## Problem

`auditTutorStubRepetitionResponse` compares a candidate against the last ten
tutor turns on Jaccard word-set overlap, at `threshold = 0.82`. That is a
lexical test, and the failure it is meant to catch is not always lexical.

Replaying the audit over the 2026-07-26 showcase run reproduces its recorded
results exactly:

```
campus_faq  bare    0.00 0.24 0.25 0.50 0.59 0.61 0.79 X0.84 X0.94 X0.84
campus_faq  instr   0.00 0.15 0.09 0.13 0.19 0.09 0.16  0.17  0.16  0.22
riverside   bare    0.00 0.19 0.32 0.30 0.30 0.28 0.32  0.39
riverside   instr   0.00 0.11 0.13 0.10 0.19 0.29  0.28
```

Campus bare loops almost verbatim and the audit fires three times. Riverside
bare tops out at 0.39 — less than half the threshold — and never fires, yet its
turns 4 to 8 make the same move five times over:

- t4 — "That would be strong evidence: the appointment action, its timing, and Mara's source would line up. Until those three match, her opening the record remains only an access trace."
- t6 — "Until that entry ties the cancellation itself to Mara's source, the evidence does not support blaming her."
- t8 — "I mark it: Mara's record opening is an access trace, not proof of cancellation. The cancellation remains unlinked until its own audit entry shows the action, time, and source."

The v2.2 judge had no trouble seeing it: *"Turn 8 is nearly identical in content
and structure to turns 5, 6, and 7 despite repeated learner input."* It scored
`adaptive_responsiveness` and `elicitation_quality` at 1. The audit passed every
one of those turns.

## Why lowering the threshold is the wrong fix

Dropping 0.82 far enough to catch 0.39 would fire on ordinary continuity — a
tutor that keeps naming the same evidence while doing new work with it. The
instrumented arms sit in the 0.09–0.29 band throughout and are doing exactly
that. There is no threshold that separates 0.39 from 0.29 on this signal.

The distinguishing feature is not word overlap. It is whether the turn advances:
whether it releases evidence not yet public, asks something not yet asked, or
names a distinction not yet drawn. Across all four showcase dialogues, questions
and evidence releases move together perfectly — every turn that releases an
exhibit asks a question, every turn without one asks none. That co-movement is
the cheap signal, and it is already on the turn record.

## What was built

A second channel, `auditTutorStubAdvanceResponse`, beside the lexical one rather
than a retune of it. It asks what share of a turn's content words the last ten
turns have not already used, and fires `tutor_turn_without_advance` below 0.25.
Both scores ride on the one audit object.

The bare arm turned out not to be the harder half after all. The card expected to
need the release plan and the question frame, and so expected an instrumented-only
signal; a text-only novelty score works on both arms, which is what makes the
observed-audit path on passthrough worth anything.

## Where the floor came from

Read off the four showcase arms, not chosen a priori. Novelty per turn:

```
campus_faq  bare    --  .62 .50 X.22 X.24 X.10 X.00 X.00 X.06 X.00
campus_faq  instr   --  .74 .77  .69  .54  .73  .45  .41  .30  .30
riverside   bare    --  .61 .39  .48  .40  .26 X.23 X.14
riverside   instr   --  .79 .67  .60  .32 X.20  .31
```

Campus instrumented — the arm that *rose* — bottoms out at 0.30 and never fires.
Every stalling stretch drops below 0.25. The floor sits in a 0.07 gap between
them.

Two things worth stating about that. It catches campus bare from t4, four turns
before the lexical channel woke at t8. And it is a threshold read off eight
scored turns in two dialogues on one model, so it is set loose on purpose: it
fires on the deep end of a stall and lets the onset through rather than risk
blocking a good turn. Riverside bare t6 at 0.26 is a turn the judge marked down
that this floor lets pass.

## Exemptions

A turn can be word-poor without stalling, so three cases skip the check and say
which: it delivers an exhibit (`released_new_evidence`), it is the closing act
(`terminal_turn`), or it is under eight content words (`too_short_to_judge`).
Passthrough has neither a release schedule nor a closure frame, so on that arm
the channel runs on text alone — the asymmetry is recorded in `advanceSkipped`
rather than hidden.
