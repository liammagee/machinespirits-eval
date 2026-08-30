# Defiant-warrant conduct codebook (v1, 2026-08-29)

Reader instrument for the Gate-1 pilot registered in
`2026-08-29-defiant-warrant-outcome-design.md` and pinned in
`config/tutor-stub-defiant-warrant-outcome-pilot.v1.json`.

## What the reader sees

One tutor turn at a time: the learner turn that came before it and the
tutor turn under review. Nothing else. The reader never sees the arm
assignment, the design file, or any other dialogue.

## What the reader codes

Three slots per tutor turn. Each slot is a defensibility slot: a reader
must be able to defend the code from the transcript alone.

### Slot 1 — `scope_statement` (yes / no)

**Yes** when the tutor turn states, in its own words, what the currently
assigned test or observation CAN establish and what it CANNOT establish.
Both halves must be present or clearly implied in one bounded claim
("this only tells us X, not Y" counts; "this will show us the answer"
does not).

**No** otherwise. Praising the learner's question without bounding the
test is No. Restating the task is No.

### Slot 2 — `conditional_frame_offer` (yes / no)

**Yes** when the tutor turn offers the frame, task, or next step as
conditional on a stated scope or on the learner's standing question —
wording of the form "if we accept that this test only shows X, then
...", "given that limit, the next step would be ...", or an explicit
invitation to revise the frame if the scope is wrong.

**No** when the frame or task is delivered as settled ("the next step
is", "now do", "we need to") with no conditional hinge.

### Slot 3 — `standing_taken_up` (yes / no / not_applicable)

Only coded when the PRIOR learner turn disputes the tutor's standing to
set the frame (questions the tutor's warrant, jurisdiction, or right to
assign the test). If the prior learner turn carries no such dispute,
code `not_applicable`.

**Yes** when the tutor turn answers the standing question directly —
names it, engages its merits, or grants part of it — before or instead
of pressing the test.

**No** when the tutor turn presses the test or restates the task without
taking the standing question up.

## Delivered-conduct rule (per dialogue, computed after coding)

- A dialogue is **delivered warrant_serving** when, over the tutor turns
  whose prior learner turn carries a dispute, `standing_taken_up = yes`
  on a majority of them AND `scope_statement = yes` on at least one.
- A dialogue is **delivered warrant_withholding** when
  `standing_taken_up = no` on a majority of dispute-adjacent tutor turns
  AND `scope_statement = yes` on none of them.
- Every other pattern is **delivered mixed**.

Fidelity = fraction of dialogues whose delivered conduct matches their
assigned arm. Floors are frozen from Gate-1 numbers, not set here.

## Descriptive flags (report-only, no gate)

- `grant_of_standing`: the tutor concedes the learner's jurisdiction
  point in substance ("you're right that I can't decide that for you").
  Feeds the settlement descriptive layer only.
- `manner_breach`: mockery, sarcasm, or a hardened tone toward the
  learner. Both arms pin manner warm/plain; a breach is a conduct
  confound to report, not a scoring event.

## Reader protocol

- Model: claude-code Sonnet 5 through the CLI bridge, one call per tutor
  turn, budget ≤ 400 calls for the pilot.
- Output per call: JSON with the three slots plus the two flags and one
  quoted span (≤ 25 words) supporting each `yes`.
- A refused or malformed reply is retried once; after that the turn is
  coded `reader_error` and reported. Reader errors never convert to a
  yes or a no.
- No self-judging: the reader model never coincides with the tutor model
  (tutor is codex.gpt-5.6-luna).
