---
id: fallback-drops-the-clarification-invitation
title: The last-resort line drops the clarification invitation and kills the dialogue
status: active
type: infra
priority: P1
owner: claude
source: review
created: 2026-07-29
updated: 2026-07-29
verification: >-
  On a turn whose handoff contract supplies its own question and whose support
  contract requires a clarification invitation, the built fallback carries the
  invitation inside that one question, so the question-support audit passes, the
  question stays last, and the question count stays at one. Pinned with the real
  campus turn-10 contract and support from the 2026-07-28 run, which is the turn
  that killed the dialogue.
links:
  code:
    - services/tutorStubTurnProgressionContract.js
    - services/tutorStubQuestionSupport.js
    - services/tutorStubDramaticRelease.js
    - scripts/tutor-stub.js
    - tests/tutorStubTurnProgressionContract.test.js
  items:
    - guard-ladder-ships-canned-text-on-most-turns
    - tutor-instrumentation-showcase
tags:
  - tutor-stub
  - guards
---

## Problem

The campus dialogue in the 2026-07-29 showcase run died at turn 10. Three model
drafts failed their checks, the fixed last-resort line was built and checked, and
it failed too, so the run ended with nothing published — the first time in any
run that the last line has been refused.

The learner had signalled trouble twice, so the support contract for that turn
asked the tutor to make a clarifying question visibly available. The last-resort
line ended:

> What should the campus FAQ tool use as its first implementation baseline, on
> the evidence in the formulation card?

No invitation, so the support check fired. The other finding on that line, a
restatement with almost nothing new in it, is downgraded to an advisory on the
last-resort line; support findings are not, and should not be — a fixed line that
refuses to answer a learner who has said twice that they are lost is exactly what
the check is for.

## Cause

The line is not fixed. It is built per turn, and the piece that carries the
invitation is built too — `configuredFallbackHandoff` writes a question that
folds it in when the support contract asks for one. It is then thrown away.

`deterministicTutorStubTurnProgressionHandoff` takes the support contract and
uses it on one branch only. When the turn forbids a question it passes the
requirement down, and the declarative ending honours it. When the turn allows a
question it calls `contractAwareFallbackQuestion(contract, defaultQuestion)`
without the support contract at all — and that function returns the progression
contract's own question whenever it has one, discarding the default that was the
only carrier of the invitation. Campus turn 10 was an assertion-gap turn, so the
contract had one, and the invitation went.

The existing mechanical repair cannot save it. It appends the invitation as its
own sentence, and only when the missing invitation is the sole hard finding; on
turn 10 it was not the sole finding on the recovery draft, and the turn's handoff
contract also required the question to be last, so a sentence appended after it
would have failed a different check.

## Fix

Fold the invitation into the question instead of appending it after. One question
mark, still last, target terms still covered, so no other check moves. Applied
wherever the question-allowed handoff is built, and skipped when the contract
demands an exact question, which is the stronger claim on that sentence.

The dramatic-release fallback has the same shape and the same latent fault: it
adds the invitation as a separate sentence after the handoff, which would fail
the question-must-be-last check on a contract turn. It takes the folded form too.

## What is left

A run. This unblocks the turn that died; whether the dialogue then finishes is a
separate question the traces cannot answer.
