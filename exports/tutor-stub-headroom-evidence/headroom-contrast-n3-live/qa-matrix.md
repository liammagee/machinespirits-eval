# Tutor Stub Cross-Run Field

Generated: 2026-07-10T10:58:58.107Z
Evals: 4 shown (4 source entries)
Sources: file:4

Latest field: outcome score 0.879; process score 0.879; reliability 1; effective closure 0.7333333333333333; diversity 0.8795160764786116

## Run Trajectory

| Run | OK/Failed | Grounded | Mean Turns | Outcome Score | Movement | Reports |
|---|---|---|---|---|---|---|
| auto-eval-2026-07-10T06-39-57-020Z | 15/0 | 15 | 26.867 | 0.964 | baseline (n/a) | [html](.tutor-stub-auto-eval/headroom-contrast-n3-live/diligent/auto-eval-2026-07-10T06-39-57-020Z.html) [json](.tutor-stub-auto-eval/headroom-contrast-n3-live/diligent/auto-eval-2026-07-10T06-39-57-020Z.json) |
| auto-eval-2026-07-10T08-03-30-356Z | 15/0 | 12 | 30.8 | 0.897 | weakened (-0.067) | [html](.tutor-stub-auto-eval/headroom-contrast-n3-live/proof_skipper/auto-eval-2026-07-10T08-03-30-356Z.html) [json](.tutor-stub-auto-eval/headroom-contrast-n3-live/proof_skipper/auto-eval-2026-07-10T08-03-30-356Z.json) |
| auto-eval-2026-07-10T09-45-42-759Z | 15/0 | 14 | 31.4 | 0.941 | mostly flat (+0.044) | [html](.tutor-stub-auto-eval/headroom-contrast-n3-live/false_memory/auto-eval-2026-07-10T09-45-42-759Z.html) [json](.tutor-stub-auto-eval/headroom-contrast-n3-live/false_memory/auto-eval-2026-07-10T09-45-42-759Z.json) |
| auto-eval-2026-07-10T10-58-52-389Z | 15/0 | 11 | 32.267 | 0.879 | weakened (-0.062) | [html](.tutor-stub-auto-eval/headroom-contrast-n3-live/affective_resistant/auto-eval-2026-07-10T10-58-52-389Z.html) [json](.tutor-stub-auto-eval/headroom-contrast-n3-live/affective_resistant/auto-eval-2026-07-10T10-58-52-389Z.json) |

## Policy Field

| Policy | Obs | Outcome Score | Mean Outcome | Reliability | Effective Closure | Mean Turns | Diversity (process) | Process Score | Latest Registers |
|---|---|---|---|---|---|---|---|---|---|
| dynamical_system | 4 | 0.962 | 0.926 | 1 | 0.917 | 31.833 | 0.762 | 0.903 | warm:27, precise:17, plain:14, charismatic:13, witnessing:9 |
| field | 4 | 0.96 | 0.939 | 1 | 0.917 | 30 | 0.863 | 0.927 | precise:24, plain:19, charismatic:14, ironic:11, warm:9 |
| bland | 4 | 0.956 | 0.913 | 1 | 0.833 | 30.084 | 0 | 0.785 | plain:93 |
| dynamic | 4 | 0.871 | 0.94 | 1 | 0.917 | 29 | 0.36 | 0.858 | precise:57, plain:30, brisk:6, charismatic:2 |
| negative | 4 | 0.647 | 0.884 | 1 | 0.75 | 30.75 | 0.494 | 0.829 | ironic:43, sarcastic:40, face_threat:37 |

## QA Policy Robustness

| Policy | Learners | Worst Outcome | Mean Outcome | Mean Delta vs bland | Worst Delta vs bland | Closure | Coverage | Turns | Failures | Diversity (process) | QA Read |
|---|---|---|---|---|---|---|---|---|---|---|---|
| dynamic | 4/4 | 0.871 | 0.94 | +0.026 | -0.085 | 0.917 | 1 | 29 | 0 | 0.359 | robust across observed learners |
| field | 4/4 | 0.871 | 0.939 | +0.025 | +0 | 0.917 | 1 | 30 | 0 | 0.864 | robust across observed learners |
| bland | 4/4 | 0.864 | 0.913 | +0 | +0 | 0.833 | 0.986 | 30.084 | 0 | 0 | robust across observed learners |
| dynamical_system | 4/4 | 0.828 | 0.926 | +0.012 | -0.036 | 0.917 | 0.945 | 31.833 | 0 | 0.762 | robust across observed learners |
| negative | 4/4 | 0.647 | 0.884 | -0.029 | -0.309 | 0.75 | 0.945 | 30.75 | 0 | 0.494 | learner-sensitive |

## QA Learner Matrix

| Learner | bland | dynamic | field | dynamical_system | negative |
|---|---|---|---|---|---|
| affective_resistant | 0.956 (+0) | 0.871 (-0.085) | 0.96 (+0.004) | 0.962 (+0.006) | 0.647 (-0.309) |
| diligent | 0.966 (+0) | 0.964 (-0.002) | 0.966 (+0) | 0.958 (-0.008) | 0.968 (+0.002) |
| false_memory | 0.868 (+0) | 0.96 (+0.092) | 0.957 (+0.089) | 0.956 (+0.088) | 0.962 (+0.094) |
| proof_skipper | 0.864 (+0) | 0.963 (+0.099) | 0.871 (+0.007) | 0.828 (-0.036) | 0.96 (+0.096) |

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
