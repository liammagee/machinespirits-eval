# Negative-Register Effect Estimation Future Work

## Status

The register-taxonomy and negative-register measurement work is ready to merge.
The branch now supports three things that were missing at the start:

- negative registers are explicit experiment-assigned arms rather than organic
  router choices;
- hand-authored corrosive exemplars separate judge sensitivity from generation
  warmth;
- generated negative-register rows pass through a stance-fidelity gate before
  they count as evidence for the assigned arm.

The latest held-out check, `eval-2026-07-02-5c4d52e6`, covered frustration and
question-flood after the cue repair. It completed 6/6 rows, scored 6/6 under
the tutor-only v2.2 rubric, scored 9/9 register slices, and classified 6/6
assigned negative-register rows as faithful with 0 invalid person-attack
violations. Read with the prior cue-repair canary
`eval-2026-07-02-7e461a5c`, the repaired stance contract has sampled all five
controlled resistance targets with 15/15 faithful assigned rows and 0 invalid
violations.

## What This Does And Does Not Show

This shows treatment fidelity can be repaired in the simulator: when a row is
assigned to irony, sarcasm, or simulated face-threat, the tutor can now visibly
instantiate that stance without crossing the invalid-person-attack guardrail.

It does not show that negative registers improve learning, preserve recognition,
or are safe for human-facing tutoring. The local outcome signal remains mixed:
the held-out check produced 3/6 strict candidate breakthroughs and 4/6 positive
local outcomes. That is enough to motivate a future effect-estimation run, not
enough to make a pedagogical endorsement.

## Future Work

Run the full five-target negative-arm grid only if the next question is effect
estimation. The grid should report two estimands:

- assigned-arm effects: what happened to every row assigned to the negative
  register;
- faithful-arm effects: what happened only after the stance gate verified the
  tutor actually instantiated the assigned register.

The report should also keep invalid person-attack violations separate from both
estimands. An invalid corrosive row is not "successful sarcasm"; it is a failed
guardrail case.

Recommended minimum design:

- cells 196, 197, and 198 across all five controlled resistance targets;
- at least three repeats per cell-target pair before treating arm means as more
  than a smoke;
- tutor-only v2.2 scoring plus generic register-rubric scoring;
- the breakthrough matrix report with assigned-arm, faithful-arm, exclusion, and
  invalid-violation counts;
- paper wording that remains simulated-only and non-human-facing unless a
  separate human-coded or human-learner check is added.

Do not run that grid merely to prove treatment fidelity. The two post-repair
canaries already cover that narrower question.
