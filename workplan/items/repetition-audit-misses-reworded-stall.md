---
id: repetition-audit-misses-reworded-stall
title: The repetition audit catches verbatim looping and misses a reworded stall
status: active
type: infra
priority: P3
owner: claude
source: review
created: 2026-07-28
updated: 2026-07-28
verification: >-
  A run of tutor turns that restate the same claim in fresh words on every turn
  raises an issue, with the eight-turn Riverside bare arm from the 2026-07-26
  showcase pinned as the case that currently passes; the existing verbatim cases
  (campus bare t8–t10, Jaccard 0.84/0.94/0.84) keep firing with the same issue
  type and no change in `maxSimilarity`; whatever channel is added reports its
  own score beside the lexical one rather than replacing it.
links:
  code:
    - services/tutorStubResponseGuard.js
    - services/tutorStubObservedAudits.js
    - scripts/tutor-stub.js
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

## Direction

Add a second channel beside the lexical one rather than retuning it. Report both
scores. The lexical check is doing its job on the case it was built for; what is
missing is a check on whether the turn added anything, and the release plan plus
the question frame already know the answer on an instrumented turn.

The bare arm is the harder half — it builds neither, which is why the observed
pass carries only leak and repetition in the first place. A no-advance signal
for a bare turn would need to come from the text. Worth scoping before
committing to it; a channel that only works on the instrumented arm is still
worth having, as long as the asymmetry is reported rather than hidden.
