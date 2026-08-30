---
id: declarative-handoff-ending-instruction
title: Stop the ending instruction ordering a question the handoff forbids
status: done
type: infra
priority: P2
owner: claude
source: manual
created: 2026-08-29
updated: 2026-08-29
verification: >-
  The rebuilt first-draft contract for a handoff with question_allowed
  false ends declaratively, and the guard recovery redraft prompt repeats
  that bar instead of ordering a question. Both are pinned by tests that
  fail on the old code. No paid call is required.
claim_status: methods
links:
  items:
    - preconscious-tutor-stub-arc
  notes:
    - services/tutorStubFirstDraftContract.js
    - services/tutorStubGuardRecovery.js
tags:
  - tutor-stub
  - delivery-contract
  - defect-fix
---

## Defect

`chooseHandoffMode` can return a declarative mode with
`question_allowed: false`. The turn progression audit then rejects any
candidate that asks a question
(`question_forbidden_by_handoff_contract`). But the ending cue built for
that same turn could still order one.

In `endingCue()` the barred branch handled two shapes — a bounded choice
and a clarification invitation — and then fell through. Everything else
reached the question-support instruction, which says "If you do ask a
struggling learner a question, explicitly permit a short question about
which clue or term is unclear", and past that to two defaults that end
"with at most one light question". So the contract could tell the writer
to ask a question on a turn where asking one is a hard failure.

The compact host-plan renderer never read `ending.instruction`, so the
live first-draft prompt was not affected. The guard recovery prompt does
read it, and its own fallback was worse: with no instruction present it
printed "END — Use at most one concrete, answerable question" whatever
the handoff said. A turn rejected *for asking a forbidden question* was
therefore redrafted under an order to ask one.

This is the same shape as the recurring class in §6.26 and defect-ledger
rows 25–27: a rule binds only where the code reads it.

## Fix

- `services/tutorStubFirstDraftContract.js` — the `question_allowed:
  false` block now returns before the question-support instruction. It
  keeps the responsive-repair wording where an earlier learner question
  went unanswered, and otherwise ends declaratively, carrying the unseen
  record guard when question support asked for it.
- `services/tutorStubGuardRecovery.js` — `recoveryEndingLine()` falls
  back to a declarative END line when the handoff bars questions, and
  keeps the old wording when it does not.

## Not fixed by this

The benchmark still fails on the writing side, and the six-call strong
run at the authorized push settles what kind of failure it is. Codex
passed all three cases. Sonnet failed two of three, both on the same
broken rule — asking a question the handoff forbids. The one case I had
guessed at, the boundary handoff, is the one Sonnet passed.

The two failing endings:

- counterpressure write — "The ledger, not the lamp, is what would
  settle a period of use — has anyone opened it yet?"
- period source — "That fixes when the nocturne was written, but not yet
  whose hand held the pen. What does the copy-room ledger show for that
  same winter?"

Codex on the same two turns ends flat: "the period of use must be shown
before the paper can date the nocturne", and "This dates the nocturne,
but does not identify its composer."

So this is not a missing instruction and not one bad case. The refreshed
compact prompt bars the question twice, once on the handoff line and
once on the tactic line, and one model of the two still asks. The hook
also compared the saved baseline responses under this change's audit
code: 0 improved, 0 regressed of 6. The fix neither helped nor hurt the
benchmark, which is right — the benchmark never reaches the redraft path
this fix corrects.

## Log

- 2026-08-29: Defect found while checking why a benchmark case writes a
  closing question. Fixed on both paths, with regression tests in
  `tests/tutorStubFirstDraftContract.test.js` and
  `services/__tests__/tutorStubGuardRecovery.test.js`. The authorized
  push ran the strong preset: 4 pass, 2 fail, both failures Sonnet
  ending on a question. Card closed; the benchmark shortfall is recorded
  above as a per-model writing property, not a harness defect.
