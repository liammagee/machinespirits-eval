# Same-Turn Assertion Affordance: First-Pass Bitterwell Check

Date: 2026-06-15

Group: `same-turn-assertion-affordance-20260615`

## Question

The gated recognition-pressure v2 regression left a specific Bitterwell failure mode unresolved: the learner reached `D=0` when the final exhibit arrived, but waited one extra turn to assert the answer. That suggested the issue was not ordinary recognition pressure, but the learner-side assertion contract.

This increment adds an opt-in learner affordance:

- after adopting any newly visible exhibits in the current reply, immediately re-check the expanded learner-visible record;
- if that expanded record entails the public answer, answer in the same JSON reply;
- keep the grounding gate active so unsupported assertions are suppressed.

The flag is `--same-turn-assertion-affordance`. It does not change release timing, selector routing, hidden/visible guard policy, or recognition-pressure calculation.

## Code Path

- Runner flag and diagnosis field: `scripts/run-derivation-loop.js`
- Learner prompt and effective grounding gate: `services/dramaticDerivation/llmRoles.js`
- Regression test: `tests/dramaticDerivationConfront.test.js`

The affordance implies the learner assertion grounding gate. In other words, a learner may be nudged to answer earlier only when the answer is entailed by the learner-visible board plus adopted exhibits.

## First-Pass Result

| World | Prior gated-v2 result | Affordance result | Forced | Asserted | Gap | Verdict |
| --- | --- | --- | ---: | ---: | ---: | --- |
| Bitterwell | 16 turns, forced 15, asserted 16 | 15 turns, forced 15, asserted 15 | 15 | 15 | 0 | grounded_anagnorisis |

Run label: `assert-now-bitterwell-affordance-r1`

Artifacts:

- `exports/dramatic-derivation/loop/assert-now-bitterwell-affordance-r1/transcript.md`
- `exports/dramatic-derivation/loop/assert-now-bitterwell-affordance-r1/diagnosis.json`
- `exports/dramatic-derivation/loop/assert-now-bitterwell-affordance-r1/result.json`
- `exports/dramatic-derivation/same-turn-assertion-affordance-logs/assert-now-bitterwell-affordance-r1.log`

## Transcript Check

The learner did not assert before the final exhibit. At turn 15, after adopting `steepsBitter mirel`, the learner asserted `turnedBitter mirel commonWell` in the same reply. The public prose stayed naturalistic:

> Hand, place, and stuff all meet there. The survey can write its finding: Mirel turned the Aldermere common well bitter.

No unsupported assertion was recorded. The diagnosis reports:

- `verdict`: `grounded_anagnorisis`
- `firstForcedTurn`: 15
- `assertedGroundedTurn`: 15
- `forcedToAssertedGap`: 0
- `fabricatedFacts`: []
- `releaseAdherence.onCue`: 7
- `releaseAdherence.deviations`: []
- `learnerInference.overreachCount`: 0

## Caveat

This is a useful fix for the known Bitterwell lag, not a general reliability claim. It should next be checked on the other known recognition-lag case, Withercombe gated-v2, and on a case that already had gap 0 to ensure the affordance does not introduce over-answering or stylistic regression.

Recommended next run sequence:

1. Withercombe gated-v2 plus `--same-turn-assertion-affordance`.
2. Ravensmark gated-v2 plus `--same-turn-assertion-affordance` as a negative-transfer check.
3. If both are clean, promote the affordance into the candidate overall derivation arm while keeping it flag-recorded in diagnosis.
