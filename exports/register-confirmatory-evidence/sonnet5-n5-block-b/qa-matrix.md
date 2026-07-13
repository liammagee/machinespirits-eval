# Tutor Stub Cross-Run Field

Generated: 2026-07-13T01:35:44.054Z
Evals: 4 shown (4 source entries)
Sources: file:4

Latest field: outcome score 0.16; process score 0.14; reliability 0; effective closure 0; diversity 0

## Run Trajectory

| Run | OK/Failed | Grounded | Mean Turns | Outcome Score | Movement | Reports |
|---|---|---|---|---|---|---|
| auto-eval-2026-07-13T00-52-45-908Z | 15/0 | 11 | 30.467 | 0.467 | baseline (n/a) | [html](.tutor-stub-auto-eval/register-confirmatory-sonnet5-n5-live-2026-07-13/diligent/auto-eval-2026-07-13T00-52-45-908Z.html) [json](.tutor-stub-auto-eval/register-confirmatory-sonnet5-n5-live-2026-07-13/diligent/auto-eval-2026-07-13T00-52-45-908Z.json) |
| auto-eval-2026-07-13T01-21-36-793Z | 6/9 | 0 | 40 | 0.245 | weakened (-0.222) | [html](.tutor-stub-auto-eval/register-confirmatory-sonnet5-n5-live-2026-07-13/affective_resistant/auto-eval-2026-07-13T01-21-36-793Z.html) [json](.tutor-stub-auto-eval/register-confirmatory-sonnet5-n5-live-2026-07-13/affective_resistant/auto-eval-2026-07-13T01-21-36-793Z.json) |
| auto-eval-2026-07-13T01-28-25-224Z | 0/15 | 0 | 0 | 0.16 | weakened (-0.085) | [html](.tutor-stub-auto-eval/register-confirmatory-sonnet5-n5-live-2026-07-13/false_memory/auto-eval-2026-07-13T01-28-25-224Z.html) [json](.tutor-stub-auto-eval/register-confirmatory-sonnet5-n5-live-2026-07-13/false_memory/auto-eval-2026-07-13T01-28-25-224Z.json) |
| auto-eval-2026-07-13T01-35-31-919Z | 0/15 | 0 | 0 | 0.16 | mostly flat (+0) | [html](.tutor-stub-auto-eval/register-confirmatory-sonnet5-n5-live-2026-07-13/proof_skipper/auto-eval-2026-07-13T01-35-31-919Z.html) [json](.tutor-stub-auto-eval/register-confirmatory-sonnet5-n5-live-2026-07-13/proof_skipper/auto-eval-2026-07-13T01-35-31-919Z.json) |

## Policy Field

| Policy | Obs | Outcome Score | Mean Outcome | Reliability | Effective Closure | Mean Turns | Guard Exposure | Repair Rate | Fallback Rate | Diversity (process) | Process Score | Latest Registers |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| bland | 4 | 0.16 | 0.255 | 0.35 | 0 | 18.1 | 0.09 | 0.09 | 0.032 | 0.029 | 0.225 | none |
| field | 4 | 0.16 | 0.271 | 0.35 | 0 | 17 | 0.123 | 0.123 | 0.043 | 0.461 | 0.299 | none |
| negative | 4 | 0.16 | 0.249 | 0.35 | 0 | 17.75 | 0.067 | 0.067 | 0.027 | 0.249 | 0.25 | none |

## QA Policy Robustness

| Policy | Learners | Horizon | Horizon Complete | Horizon Safety | Safety Incomplete | Worst Closure | Worst Coverage | Failures | Turns | Guard Exposure | Repairs | Fallbacks | Worst Outcome | Mean Outcome | Mean Delta vs bland | Worst Delta vs bland | Adequate | Noninferior | Min Effect ≥ 0.05 | Dispersion | Robust | Diversity (process) | QA Read |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| bland | 4/4 | 16 | 0 | 0 | 1 | 0 | 0 | 0.65 | 18.1 | 0.09 | 0.09 | 0.033 | 0.16 | 0.255 | +0 | +0 | no | yes | n/a | learner_sensitive | no | 0.029 | safety_incomplete |
| field | 4/4 | 16 | 0 | 0 | 1 | 0 | 0 | 0.65 | 17 | 0.123 | 0.123 | 0.043 | 0.16 | 0.271 | +0.016 | -0.016 | no | yes | no | learner_sensitive | no | 0.461 | safety_incomplete |
| negative | 4/4 | 16 | 0 | 0 | 1 | 0 | 0 | 0.65 | 17.75 | 0.067 | 0.067 | 0.027 | 0.16 | 0.249 | -0.006 | -0.018 | no | no | no | learner_sensitive | no | 0.249 | safety_incomplete |

## QA Learner Matrix

| Learner | bland | field | negative |
|---|---|---|---|
| affective_resistant | 0.257 (+0) | 0.241 (-0.016) | 0.239 (-0.018) |
| diligent | 0.443 (+0) | 0.523 (+0.08) | 0.437 (-0.006) |
| false_memory | 0.16 (+0) | 0.16 (+0) | 0.16 (+0) |
| proof_skipper | 0.16 (+0) | 0.16 (+0) | 0.16 (+0) |

Matrix cells show the OUTCOME-only QA score, with parenthesized same-learner outcome delta against the configured baseline when available. Register diversity is reported separately and never enters these cells.


## Notes

- Policy comparisons use the OUTCOME-only score (reliability, effective closure, coverage, turn efficiency, leak discipline). The process score additionally includes register diversity — a channel the policy under test controls directly — and must never be used to rank policies.
- Cross-run field axes differ from dialogue fields: reliability, effective closure, coverage, turn efficiency, register diversity, and leak discipline.
- Effective closure counts grounded runs over all rows, so technical failures lower the field point.
- Register diversity uses entropy normalized against the v2 all-register palette size.
- SQL-backed summaries use tutor_stub_* tables when available; local JSON summaries and ledger entries are still accepted.
- QA robustness compares policies across automated learner profiles when summaries include multiple learner profiles.
- Guard exposure, model repair, and deterministic fallback are reported separately by policy; candidate guard matches are not counted as learner-visible leaks.
- QA robustness aggregates policy rows by automated learner profile before ranking policies.
- Delta columns compare each policy against bland within the same learner profile when that baseline is present.
- Raw closure, coverage, and failure endpoints determine adequacy, non-inferiority, dispersion, and policy ordering. The weighted outcome score is descriptive only.
- For non-baseline policies, robust also requires a mean all-planned-row fixed-horizon coverage gain of at least 0.05 against bland.
- Failed or missing rows contribute zero to the primary fixed-horizon coverage estimate; the observed-only mean and missing-outcome bounds remain separate diagnostics.
- Safety is incomplete unless every observed horizon turn has complete guard evidence and the row reaches the horizon or grounds early.
- Register diversity is reported separately and never enters an outcome gate: it is a direct readout of the policy under test and would manufacture an adaptive-vs-bland gap at outcome ceiling.
- Low cross-profile dispersion is descriptive only. Robust is reserved for complete learner coverage plus the frozen dispersion, adequacy, and non-inferiority gates.
