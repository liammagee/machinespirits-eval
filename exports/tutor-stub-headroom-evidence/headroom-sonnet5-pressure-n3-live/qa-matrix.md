# Tutor Stub Cross-Run Field

Generated: 2026-07-11T05:05:57.885Z
Evals: 4 shown (4 source entries)
Sources: file:4

Latest field: outcome score 0.807; process score 0.818; reliability 1; effective closure 0.6666666666666666; diversity 0.8946583905643266

## Run Trajectory

| Run | OK/Failed | Grounded | Mean Turns | Outcome Score | Movement | Reports |
|---|---|---|---|---|---|---|
| auto-eval-2026-07-10T15-06-54-564Z | 15/0 | 10 | 32.267 | 0.833 | baseline (n/a) | [html](.tutor-stub-auto-eval/headroom-sonnet5-pressure-n3-live/diligent/auto-eval-2026-07-10T15-06-54-564Z.html) [json](.tutor-stub-auto-eval/headroom-sonnet5-pressure-n3-live/diligent/auto-eval-2026-07-10T15-06-54-564Z.json) |
| auto-eval-2026-07-10T21-21-26-849Z | 15/0 | 0 | 40 | 0.578 | weakened (-0.255) | [html](.tutor-stub-auto-eval/headroom-sonnet5-pressure-n3-live/affective_resistant/auto-eval-2026-07-10T21-21-26-849Z.html) [json](.tutor-stub-auto-eval/headroom-sonnet5-pressure-n3-live/affective_resistant/auto-eval-2026-07-10T21-21-26-849Z.json) |
| auto-eval-2026-07-10T21-49-56-749Z | 15/0 | 7 | 35.067 | 0.77 | improved (+0.192) | [html](.tutor-stub-auto-eval/headroom-sonnet5-pressure-n3-live/false_memory/auto-eval-2026-07-10T21-49-56-749Z.html) [json](.tutor-stub-auto-eval/headroom-sonnet5-pressure-n3-live/false_memory/auto-eval-2026-07-10T21-49-56-749Z.json) |
| auto-eval-2026-07-10T22-17-26-289Z | 15/0 | 10 | 33.4 | 0.807 | mostly flat (+0.037) | [html](.tutor-stub-auto-eval/headroom-sonnet5-pressure-n3-live/proof_skipper/auto-eval-2026-07-10T22-17-26-289Z.html) [json](.tutor-stub-auto-eval/headroom-sonnet5-pressure-n3-live/proof_skipper/auto-eval-2026-07-10T22-17-26-289Z.json) |

## Policy Field

| Policy | Obs | Outcome Score | Mean Outcome | Reliability | Effective Closure | Mean Turns | Diversity (process) | Process Score | Latest Registers |
|---|---|---|---|---|---|---|---|---|---|
| negative | 4 | 0.947 | 0.783 | 1 | 0.5 | 34.5 | 0.497 | 0.744 | face_threat:30, ironic:29, sarcastic:26 |
| bland | 4 | 0.94 | 0.83 | 1 | 0.667 | 32.416 | 0.064 | 0.722 | plain:91, face_threat:3 |
| dynamical_system | 4 | 0.834 | 0.772 | 1 | 0.5 | 34.583 | 0.832 | 0.78 | charismatic:26, warm:21, precise:19, plain:13, witnessing:10 |
| field | 4 | 0.791 | 0.767 | 1 | 0.5 | 34.666 | 0.908 | 0.787 | charismatic:23, precise:23, brisk:12, ironic:12, plain:12 |
| dynamic | 4 | 0.52 | 0.582 | 1 | 0.083 | 39.75 | 0.605 | 0.585 | precise:60, plain:26, charismatic:23, witnessing:5, face_threat:3 |

## QA Policy Robustness

| Policy | Learners | Worst Outcome | Mean Outcome | Mean Delta vs bland | Worst Delta vs bland | Closure | Coverage | Turns | Failures | Diversity (process) | QA Read |
|---|---|---|---|---|---|---|---|---|---|---|---|
| negative | 4/4 | 0.604 | 0.783 | -0.046 | -0.111 | 0.5 | 0.833 | 34.5 | 0 | 0.497 | learner-sensitive |
| bland | 4/4 | 0.597 | 0.83 | +0 | +0 | 0.667 | 0.833 | 32.416 | 0 | 0.063 | learner-sensitive |
| dynamical_system | 4/4 | 0.592 | 0.772 | -0.058 | -0.143 | 0.5 | 0.764 | 34.583 | 0 | 0.832 | learner-sensitive |
| field | 4/4 | 0.578 | 0.767 | -0.063 | -0.149 | 0.5 | 0.764 | 34.666 | 0 | 0.908 | learner-sensitive |
| dynamic | 4/4 | 0.517 | 0.582 | -0.247 | -0.42 | 0.083 | 0.361 | 39.75 | 0 | 0.605 | robust across observed learners |

## QA Learner Matrix

| Learner | bland | dynamic | field | dynamical_system | negative |
|---|---|---|---|---|---|
| affective_resistant | 0.597 (+0) | 0.517 (-0.08) | 0.578 (-0.019) | 0.592 (-0.005) | 0.604 (+0.007) |
| diligent | 0.952 (+0) | 0.719 (-0.233) | 0.845 (-0.107) | 0.809 (-0.143) | 0.841 (-0.111) |
| false_memory | 0.83 (+0) | 0.573 (-0.257) | 0.854 (+0.024) | 0.852 (+0.022) | 0.742 (-0.088) |
| proof_skipper | 0.94 (+0) | 0.52 (-0.42) | 0.791 (-0.149) | 0.834 (-0.106) | 0.947 (+0.007) |

Matrix cells show the OUTCOME-only QA score, with parenthesized same-learner outcome delta against the configured baseline when available. Register diversity is reported separately and never enters these cells.


## Notes

- Policy comparisons use the OUTCOME-only score (reliability, effective closure, coverage, turn efficiency, leak discipline). The process score additionally includes register diversity — a channel the policy under test controls directly — and must never be used to rank policies.
- Cross-run field axes differ from dialogue fields: reliability, effective closure, coverage, turn efficiency, register diversity, and leak discipline.
- Effective closure counts grounded runs over all rows, so technical failures lower the field point.
- Register diversity uses entropy normalized against the v2 all-register palette size.
- SQL-backed summaries use tutor_stub_* tables when available; local JSON summaries and ledger entries are still accepted.
- QA robustness compares policies across automated learner profiles when summaries include multiple learner profiles.
- QA robustness aggregates policy rows by automated learner profile before ranking policies.
- Delta columns compare each policy against bland within the same learner profile when that baseline is present.
- Worst score is intentionally prominent: a policy that only works for diligent learners should not outrank one that holds up across harder learner profiles.
- Scores and deltas here are OUTCOME-only (reliability, closure, coverage, turn efficiency, leak discipline). Register diversity is reported separately and never enters policy rankings: it is a direct readout of the policy under test and would manufacture an adaptive-vs-bland gap at outcome ceiling.
