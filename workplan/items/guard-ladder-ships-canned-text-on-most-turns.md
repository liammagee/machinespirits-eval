---
id: guard-ladder-ships-canned-text-on-most-turns
title: The guard ladder ships canned text on most instrumented turns
status: active
type: infra
priority: P2
owner: claude
source: review
created: 2026-07-28
updated: 2026-08-04
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
    - services/tutorStubSelfCorrectionDisclosure.js
    - scripts/tutor-stub.js
    - tests/tutorStubTurnProgressionContract.test.js
    - tests/tutorStubLiveFirstDraftAudit.test.js
    - tests/tutorStubSelfCorrectionDisclosure.test.js
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

## The self-correction pass never lands *(fixed)*

The recovery ladder is: first draft, plain recovery, self-correction pass,
fallback. The pass ran on six turns, was accepted on none, and disclosed on
none — so neither thing it exists for happened once. It is not a no-op writer:
it produces genuinely different text. Attempt by attempt, against the draft it
was correcting:

| dialogue | turn | plain recovery failed on | pass failed on |
|---|---|---|---|
| campus | 1 | settled_point_requestioned, handoff_loses_turn_focus | handoff_loses_turn_focus |
| campus | 6 | settled_point_requestioned | same |
| campus | 9 | question_forbidden, tutor_turn_without_advance | question_forbidden |
| riverside | 1 | learner_uptake_not_realized, settled_point_requestioned | missing_learner_uptake, learner_uptake_not_realized, due_source_exact_occurrence_count |
| riverside | 3 | learner_uptake_not_realized | same |
| riverside | 5 | handoff_loses_turn_focus | missing_selected_actorial_part, learner_uptake_not_realized, handoff_loses_turn_focus |

Two cut a finding, two changed nothing, two came back worse — riverside 5's
correction dropped from a full turn to four sentences and lost the actorial part
and the uptake with it. None cleared.

The line that separates them: on four of the six, the blocking finding had
**already survived a re-draft**. The model was told about the check, wrote the
turn again, and the check fired on the new text too. A third draft against the
same content is the ladder stalling on itself, which is what
`tutor_turn_without_advance` catches one level up. The rung now declines in that
case and records the skip in the trace. Replayed over the run it skips those
four and still runs the two whose finding was new; both of those also failed, so
nothing that shipped is lost.

The uncomfortable half: two of the four it now skips are the turns where the
pass did the most good, cutting two findings to one. Not landing is what makes
that invisible — the learner got the fallback either way. If the guard fixes
above take those findings out of the way, the gate will stop firing on those
turns on its own.

One more change, unverified: the brief now tells the model to keep what the
near-miss had right. That is aimed at the two drafts that came back shorter, and
only the next run can say whether it works.

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

**It asks a closing turn to be two things at once.** *(fixed)* With no question in the
turn the audited surface is the last sentence, and on a closing turn the last
sentence is the closure declaration by design — "The inquiry is closed", "The
verdict is now licensed." The handoff target terms sit earlier in the turn,
where they belong. Coverage 0, every time. That is 6 of the 19, and it is why
Riverside's close — the one turn in the dialogue that most needs to be the
tutor's own words — went out as canned text on all four attempts. Two guards
were claiming the same sentence for jobs that cannot both be done. The weaker
claim gives way: on a closing turn the focus must appear somewhere in the turn,
not in the sentence that ends it. Nothing else moves — a declarative ending that
is not the close is still audited on its last sentence, and a close that says
nothing about what was found still fails.

The remaining 9 are ordinary development sentences carrying one target term or
none. Those may be the check doing its job; do not assume otherwise without
reading them.

## What is left

A run. All four fixes are in and tested against replayed traces, but a replay
cannot tell you what the model writes when the checks stop mis-firing. 12 of the
19 turn-focus findings should go — 4 rounding, 2 split quote, 6 closure — and
they sit on turns that ended in canned text, so the fallback rate is the number
to watch: campus 6 of 10 and riverside 3 of 5 today. Three other things to read
off the same traces: whether `tutor_response_self_correction_pass_skipped` fires
where the replay predicted (campus 1 and 9, riverside 3 and 5, unless the
turn-focus fixes take campus 1 and riverside 5 out first); whether the two passes
that still run land this time; and whether the brief's "keep what already worked"
line stops the shortening.

## Sequence for the safety/closure cards (2026-08-04)

Five active cards were circling the same machinery. Reduced to an order, with
this card holding the plan:

1. `tutor-stub-fallback-register-and-uptake-guard` — finished; moved to review.
   Its residuals all landed and its leftover authoring gap closed under
   `drama-world-public-object-reachability` on 2026-08-04.
2. `harness-untangling-clue-insertion` — finished under its stopping rule;
   moved to review. The t5 wedge is recorded, not chased.
3. **One paid run serves the two remaining guard cards.** Re-run the showcase
   pair (campus and riverside, instrumented, same model and settings as
   2026-07-28) on the post-fix tree, with `TUTOR_STUB_CLUE_INSERTION` off so
   the fallback-rate change is attributable to the guard fixes alone. Read off
   it: the fallback rate against 6 of 10 and 3 of 5; the skip and landing
   behaviour above; and — for
   `tutor-redeclares-close-lifecycle-has-not-accepted` — what the regenerated
   turn looks like when `premature_dialogue_close` fires.
4. Close this card and the re-declared-close card on that run's evidence. The
   t6 closure-regex widening stays a separate change afterwards, with the
   earned path re-checked.
5. `harness-untangling-contract-split` goes last and is gated, not scheduled:
   stage 2 opens when the run (or anything else) surfaces a standing-text edit
   actually worth making. Until then it carries no runnable work.

No card blocks another except through the one run in step 3.

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
