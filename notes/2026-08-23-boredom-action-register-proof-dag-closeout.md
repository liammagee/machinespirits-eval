# Boredom action-before-register proof-DAG: closeout of five studies

Written 2026-08-23. Closes the boredom line of the resistance action-register
programme. Workplan card `resistance-action-register-integration`.
Registrations `config/tutor-stub-boredom-action-register-proof-dag-registration.v4.json`
through `.v8.json`. Combined reports in `.tutor-stub-auto-eval/`; paid artifacts
archived to the private repo. The v7 reading has its own note,
`notes/2026-08-23-boredom-action-register-v7-reading.md`.

This note is the closeout. The card records what happened, run by run. This says
what the five runs together license, why the line stopped, and what a successor
would have to fix first.

## The question

A learner gets bored in the middle of a proof. What should the tutor do about
it? Five registered studies asked that question in three different ways, and
none of them answered it.

## The five runs

| run | contrast | units | result |
|---|---|---|---|
| v4 | warm manner against plain | 33 of 36 scored | registered null |
| v5 | warm manner against plain, wider window | 35 of 36 scored | registered null |
| v6 | ask a question against shrink the step | 36 of 36 scored | gate failure |
| v7 | ask a question against shrink the step, larger | 80 of 84 scored | registered null |
| v8 | make a move against make none | 65 of 72 scored | gate failure |

**v4 and v5 tested the manner and are both nulls.** v4: plain 0 of 18, warm 0 of
15, risk difference 0, exact conditional p = 1. Three units stopped as an
indeterminate measurement and all three fell on warm, so the attrition is
unbalanced. Only 11 of v4's 33 zeros were reachable at all — in the other 22, no
premise on the best path had been released before the dialogue ended, so the
endpoint could not have been met whatever the tutor did. v5 widened that window
and 35 of 35 scored units became reachable. The manner then moved the right way
without reaching the gate: plain 1 of 18, warm 4 of 17, p = 0.18. One unit
stopped, again on warm. **The v4 null is window-bound and must never be cited as
evidence about the manner.** v5 is the only readable manner result in the line,
and it is a null.

**v6 and v7 tested two moves and neither says anything about them.** v6 ran
clean — 36 of 36, no stopped units — and then failed its manner floor by one
unit in thirty-six, 0.889 against 0.90. That is a hard status flip, so v6
licenses nothing. Its numbers exist and may not be reported as a finding. v7
raised the size to 84 and returned a registered null: ask 21 of 41, shrink 16 of
39, risk difference −0.102, one-sided p = 0.874. Auditing v7's own paid
transcripts afterwards showed why that null is empty. Both arms carried the host
action family `stage_next_step`, both were free to end on a question, and both
did, in 0.976 of trigger turns. v7 delivered one behaviour twice and compared it
with itself. Its move-fidelity gate read 1.00 because that gate compares the
assigned move with the study's own copy of the assignment — an echo, not a
reading of the tutor.

**v8 changed the question and failed its own gate.** It contrasted making a
boredom-directed move against making none: `ask_question` asks the
discriminating question under `stage_next_step`, and `carry_on` stages the next
already-public piece of evidence under `reanchor_public_evidence`, which forbids
a closing question. The two arms take different families on purpose. v8 ran 72
planned, 66 transcribed, 65 scored, with 7 stopped and none replaced, split
carry_on 3 and ask_question 4.

## Why v8 failed, and why it took five runs to see it

v8 failed **two** registered floors, and both failures sit entirely on the
reference arm.

| floor | registered | realised | ask_question | carry_on |
|---|---|---|---|---|
| action visibility | 0.90 | 0.692 | 32 of 32 | 13 of 33 |
| delivered contrast | 0.90 | 0.877 | 0.969 | 0.788 |

Action visibility asks whether a reader can name the host action family from the
tutor's delivered turn. Delivered contrast counts question marks in that same
turn: the move arm must ask at least one, the reference arm none. On the
reference side a reader could name the family in about four dialogues in ten,
and about one reference dialogue in five ended on a question the reference
instruction forbids.

One cause explains both. The reference instruction lived in the registration and
in the host action family, and **no code on the generating path read either
one.** The family is one input to a handoff decision among several, and it loses
to a due public clue. When the scene held a clue the tutor owed the learner, the
handoff picked `question_on_due_source`, the tutor asked about the due source,
and the turn was neither recognisably `reanchor_public_evidence` nor free of a
question mark. The reference arm therefore delivered something close to the
treatment arm.

This is the same defect class the paper already records as *a registration binds
the run only where the code reads it* (§6.26; defect-ledger rows 25–27). §6.26
was the fourth recorded instance and this is the fifth.

v7 could not have seen it. Both v7 arms carried one host family, so action
visibility read 1.00 on both sides and had nothing to distinguish; and v7's
report has no question-mark field at all — its row records carry no
`delivered_question_count`. **Giving the two arms different families, and
counting question marks in the tutor's own sentences, is what made the defect
measurable. v8 failed because it was the first design able to fail.** That is
the useful part of it.

The primary numbers are recorded and may not be reported as a finding: carry_on
19 of 33, ask_question 15 of 32, risk difference −0.107, two-sided p = 0.461.
Objective proof progress is near-empty on both sides, 1 of 33 against 0 of 32.
Leakage is clean — none of the 34 scoring turns only said back what the tutor
had just made public.

Two readings bind any successor. The gate failure points the same way as the
measured difference, so the true gap is wider than −0.107 rather than narrower.
And the realised reference rate of 0.576 sits far above the top of the registered
power scan, which reached 0.8 power only below about one in six, so this size
could not have detected the effect it was sized for.

## The repair

Commit `5e3177bb` carries the registered rule down the generating path. A study
may now declare, in its own protected inputs, that one side of its contrast
delivers a question and the other does not
(`measurement.treatmentFidelity.deliveredContrastByMove`). The study hands that
one string to the intervention, the first-draft contract passes it to the turn
progression contract, and the contract owns question permission from there: a
registered `forbids_question` outranks a due public clue and ends the turn
declaratively. Both progression audits fault a turn that breaks the rule, the
draft audit as well as the live one, so a breaking draft can be repaired rather
than only recorded. Two new guard rows are hard in both columns. The preflight
now compiles each arm twice, once with a bare scene and once with a due clue, so
the v8 defect cannot reach a run again.

The default is `null`, which reproduces today's behaviour byte for byte. No
closed study changes and no closed result moves.

**What the repair proves and what it does not.** It is proved by test that a
registered forbid now beats a due clue and that both audits catch a breaking
turn. It is **not** established that the repair lifts action visibility on the
reference arm. That reading asks whether the family is nameable from the turn,
which is broader than the question mark, and only a paid run could answer it.

## What the line licenses

Nothing about what a tutor should do for a bored learner.

1. No warm-against-plain efficacy claim from v4 or v5, and none refuted beyond
   each design's claim boundary. v5 is the readable one and it is a null.
2. No move claim from v6, v7 or v8. v6 and v8 failed registered gates. v7 is a
   null that compared one behaviour with itself.
3. One number can be quoted. Asking a discriminating question recovers about half
   of bored learners inside five post-trigger turns, 21 of 41 in v7.
4. The measurement itself works. The world set, the boredom trigger and the
   recovery endpoint ran 84 units end to end in v7 and 65 in v8. The
   treatment-fidelity gates are what kept failing, not the endpoint.

## What a successor would need

Not in this line. No further paid call here is authorized, and the recovery
endpoint over the five turns after the trigger has returned near-zero signal in
five designs. A successor elsewhere would need, before it registers anything:

- Every registered fidelity rule read by code on the generating path, checked by
  a preflight that compiles both arms under a scene that tempts the tutor away
  from its assignment.
- Floors that read the tutor's own sentences. Echo gates —
  `minimumAssignedMoveDelivery`, `minimumAssignedRegisterDelivery` — compare the
  study with its own copy of itself and can never be reported as readings.
- A size scan run against a realised reference rate near one half, not near one
  in six.
- An endpoint with more signal than proof progress, which came to 1 of 65 across
  both v8 arms.
