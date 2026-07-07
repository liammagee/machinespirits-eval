# Adaptive DAG/Resistance Comparison

Generated: 2026-06-29T12:14:45.973Z
Run id: `eval-2026-06-29-6a0d37bc`
LLM mode: `mock`
Conditions: `negative`
Control set: `adversarial`
Arms: `combined_staged_v2`
Runs per scenario: 1
Rows: 20

## Claim Boundary

This is a deterministic mock ablation of mechanism wiring, not an empirical learning-effect result. It checks whether proof-DAG constraints and learner-resistance routing can operate as one adaptation policy layer with observable evidence closure, and whether shallow negative-control replies are rejected.

## Aggregate Result

| arm | positive closure | negative controls rejected | policy-layer matches | positive selected actions |
|---|---:|---:|---:|---|
| combined-staged-v2 | n/a | 20/20 (100%) | 20/20 |  |

## Negative Controls

| control | rows | rejected | accidental successes | outcomes |
|---|---:|---:|---:|---|
| fluent empty rationale | 5 | 5/5 (100%) | 0 | failure=5 |
| fake relevance language | 5 | 5/5 (100%) | 0 | inconclusive=5 |
| copied task wording | 5 | 5/5 (100%) | 0 | inconclusive=5 |
| semantic label salad | 5 | 5/5 (100%) | 0 | inconclusive=5 |

## Per-Signal Contrast

| signal | combined-staged-v2 action | all included succeeded |
|---|---|---:|
| boredom |  | n/a |
| frustration |  | n/a |
| irrelevance |  | n/a |
| question_flood |  | n/a |
| rote_parroting |  | n/a |

## Positive Row Detail

| signal | arm | action | layer | staged | required evidence | evidence observed | outcome |
|---|---|---|---|---:|---|---|---|

## Interpretation

- DAG-only enforces the proof-release route: the proof fixture constrains every case to `request_evidence` and requires learner-authored rationale before closure.
- Resistance-only routes by learner resistance signal: the selected actions vary by signal while requiring resistance-breakthrough evidence.
- Combined joins both sources: each combined row carries the proof-DAG identity and the matched resistance signal, and its success contract joins the proof-DAG evidence requirement with the signal-specific resistance evidence.
- Staged-v2 adds typed evidence contracts: proof-core evidence remains required, while resistance breakthrough closes on one signal-specific core label and records the remaining labels as supporting evidence.
- Negative controls reject shallow uptake: mere agreement, formula parroting, tutor-rationale adoption, and vague requests for more explanation do not close as success.
- The comparison supports a mechanical claim about policy-layer integration. It does not show that real learners improve more under the combined mechanism.

