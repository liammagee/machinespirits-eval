---
id: guard-ladder-ships-canned-text-on-most-turns
title: The guard ladder ships canned text on most instrumented turns
status: active
type: infra
priority: P2
owner: claude
source: review
created: 2026-07-28
updated: 2026-07-28
verification: >-
  A turn that quotes an exhibit containing a question mark is audited against the
  whole quoted sentence rather than the fragment after the internal `?`, with the
  real campus turn-1 string pinned as the case; a closing turn is not asked to
  put the handoff target terms in the sentence that declares the close; and the
  self-correction pass either changes the finding that triggered it or does not
  run, checked against the six turns in the 2026-07-28 run where it ran and
  changed nothing.
links:
  code:
    - services/tutorStubTurnProgressionContract.js
    - services/tutorStubFirstDraftOuterLoop.js
    - services/tutorStubGuardDisposition.js
    - scripts/tutor-stub.js
    - tests/tutorStubTurnProgressionContract.test.js
  items:
    - tutor-instrumentation-showcase
    - repetition-audit-misses-reworded-stall
    - tutor-redeclares-close-lifecycle-has-not-accepted
tags:
  - tutor-stub
  - guards
---

## Problem

In the 2026-07-28 showcase run the instrumented arms spent most of their turns
on the deterministic fallback — the fixed harness line the stub falls back to
when no model draft passes. Campus 6 turns of 10, Riverside 3 of 5. On
2026-07-26 Riverside spent 1 of 7. The learner is reading harness boilerplate
instead of tutor prose more often than not.

The dialogue never died: there were zero `tutor_response_fallback_rejected`
events in either trace. Findings on the fallback itself were downgraded to
advisories and delivered, which is what the terminal-fallback accommodation in
`classifyTutorStubGuardIssue` is for and is working as designed. The fault is
upstream — what happens to the three model drafts before it.

## The self-correction pass never lands

The recovery ladder is: first draft, plain recovery, self-correction pass,
fallback. The self-correction pass ran on six turns and was accepted on none.
Each time, the fallback that followed was triggered by **exactly the same issue
list** that triggered the self-correction:

| dialogue | turn | triggered self-correction | triggered fallback |
|---|---|---|---|
| campus | 1 | settled_point_requestioned, handoff_loses_turn_focus | same two |
| campus | 6 | settled_point_requestioned | same |
| campus | 9 | question_forbidden_by_handoff_contract, tutor_turn_without_advance | same two |
| riverside | 1 | learner_uptake_not_realized, settled_point_requestioned | same two |
| riverside | 3 | learner_uptake_not_realized | same |
| riverside | 5 | handoff_loses_turn_focus | same |

Six for six. It is not a no-op writer — it produces genuinely different text —
but the text it produces never clears the check that sent it there. So the pass
costs a model call per turn and buys nothing the guards accept. Six of the nine
fallback turns paid for it.

## `handoff_loses_turn_focus` is the dominant rejecter, and it mis-fires three ways

19 of the roughly 60 findings across both instrumented traces. Three of its
shapes are demonstrably wrong; two are fixed.

**It rounded one side of its own comparison.** *(fixed)* The check required both
at least two of the required target terms and a coverage ratio above
`minimum / required.length`. Those are the same test written twice — except
`coverage` is rounded to three decimals and the threshold is not. A surface
carrying exactly two of fifteen terms scores 0.133 against a threshold of
0.1333, so it failed a check it had passed. That is 4 of the 19, including
campus turn 1's *first draft*, which means the whole recovery ladder on that
turn started from a rejection that should never have happened. The redundant
clause is gone; the term count decides.

**It splits sentences inside quoted evidence.** *(fixed)* `hostQuestionPositions` already
knows to ignore a `?` inside an authored source span, so a question mark in a
quoted exhibit is not counted as the tutor's question. The sentence segmenter
beside it does not get the same treatment. On campus turn 1 the tutor quoted a
proposal containing `such as "Can I drop this module?" or "Where do I upload my
form?"`, and `Intl.Segmenter` cut the quote into two:

```
1  I point to the proposal: “… questions such as "Can I drop this module?"
2  or "Where do I upload my form?"”
3  What does this clue change about the first implementation baseline?
```

`sentences.slice(-2)` is therefore the six-word tail plus the question, and the
target terms are measured against that instead of the quoted proposal sentence
that carries them. Coverage 0.133, finding raised, turn rejected. It hit
attempts 1 and 3 of that turn — 2 of the 19. Sentence boundaries falling inside
an authored source span are now merged, so the quote stays whole.

**It asks a closing turn to be two things at once.** *(open)* With no question in the
turn the audited surface is the last sentence, and on a closing turn the last
sentence is the closure declaration by design — "The inquiry is closed", "The
verdict is now licensed." The handoff target terms sit earlier in the turn,
where they belong. Coverage 0, every time. That is 6 of the 19, and it is why
Riverside's close — the one turn in the dialogue that most needs to be the
tutor's own words — went out as canned text on all four attempts.

The remaining 9 are ordinary development sentences carrying one target term or
none. Those may be the check doing its job; do not assume otherwise without
reading them.

## What is left

The closure collision and the self-correction pass. Both need a live run to
confirm, and the two fixes above should be measured in the same run: 6 of the 19
findings and 4 more from the rounding sit on turns that ended in canned text, so
the fallback rate is the number to watch.

## What was wrong in the first reading

The counts that opened this were read as "the guards reject the system's own
last-resort line". They do not. Every one of those issues was recorded on the
fallback attempt and downgraded to an advisory, so the fallback was delivered.
The advisory events are the audit trail of the accommodation working, not
evidence of rejection. Checking `tutor_response_fallback_rejected` — zero in
both traces — is what settles it, and that check should come first next time.

## Scope

Two dialogues, one model, one run, against a single earlier run for the
comparison. The self-correction result is six for six, which is a clean enough
pattern to act on. The fallback rate going from 1-of-7 to 3-of-5 on Riverside is
one dialogue against one dialogue and is the weakest number here.
