# Adaptive DAG/Resistance Comparison

Generated: 2026-06-29T07:17:24.244Z
Run id: `eval-2026-06-29-b7308775`
LLM mode: `real`
Conditions: `positive`
Runs per scenario: 1
Budget ceiling: $1.00
Rows: 15

## Claim Boundary

This is a real-LLM ablation over the mechanism-wiring harness, not an empirical learning-effect result. It checks whether proof-DAG constraints and learner-resistance routing operate as one adaptation policy layer under unscripted learner turns with observable evidence closure.

## Aggregate Result

| arm | positive closure | negative controls rejected | policy-layer matches | positive selected actions |
|---|---:|---:|---:|---|
| DAG-only | 3/5 (60%) | n/a | 5/5 | request_evidence=5 |
| resistance-only | 2/5 (40%) | n/a | 5/5 | ask_strategy_choice=1, elicit_prediction=3, diagnose_with_discriminating_question=1 |
| combined | 0/5 (0%) | n/a | 5/5 | request_evidence=5 |

## Per-Signal Contrast

| signal | DAG-only action | resistance-only action | combined action | all succeeded | combined source join | evidence join |
|---|---|---|---|---:|---:|---:|
| boredom | request_evidence | ask_strategy_choice | request_evidence | no | yes | yes |
| frustration | request_evidence | elicit_prediction | request_evidence | no | yes | yes |
| irrelevance | request_evidence | elicit_prediction | request_evidence | no | yes | yes |
| question_flood | request_evidence | diagnose_with_discriminating_question | request_evidence | no | yes | yes |
| rote_parroting | request_evidence | elicit_prediction | request_evidence | no | yes | yes |

## Positive Row Detail

| signal | arm | action | layer | required evidence | evidence observed | outcome |
|---|---|---|---|---|---|---|
| boredom | DAG-only | request_evidence | proof:W_AF6_CURRICULUM | learner-authored rationale | - | inconclusive |
| boredom | resistance-only | ask_strategy_choice | resistance:boredom | learner-authored choice, renewed content-bearing work, learner-owned test case | learner-owned test case, renewed content-bearing work | inconclusive |
| boredom | combined | request_evidence | proof:W_AF6_CURRICULUM + resistance:boredom | learner-authored rationale, renewed content-bearing work, learner-owned test case | renewed content-bearing work | inconclusive |
| frustration | DAG-only | request_evidence | proof:W_AF6_CURRICULUM | learner-authored rationale | learner-authored rationale | success |
| frustration | resistance-only | elicit_prediction | resistance:frustration | learner-authored prediction, renewed attempt after affective repair, smaller learner-owned move | learner-authored prediction, renewed attempt after affective repair | inconclusive |
| frustration | combined | request_evidence | proof:W_AF6_CURRICULUM + resistance:frustration | learner-authored rationale, renewed attempt after affective repair, smaller learner-owned move | learner-authored rationale, renewed attempt after affective repair | inconclusive |
| irrelevance | DAG-only | request_evidence | proof:W_AF6_CURRICULUM | learner-authored rationale | learner-authored rationale | success |
| irrelevance | resistance-only | elicit_prediction | resistance:irrelevance | learner-authored prediction, learner-owned relevance test, task reorientation | learner-authored prediction | inconclusive |
| irrelevance | combined | request_evidence | proof:W_AF6_CURRICULUM + resistance:irrelevance | learner-authored rationale, learner-owned relevance test, task reorientation | learner-authored rationale, learner-owned relevance test | inconclusive |
| question_flood | DAG-only | request_evidence | proof:W_AF6_CURRICULUM | learner-authored rationale | learner-authored rationale | success |
| question_flood | resistance-only | diagnose_with_discriminating_question | resistance:question_flood | state-disambiguating response, collapsed question set | state-disambiguating response | success |
| question_flood | combined | request_evidence | proof:W_AF6_CURRICULUM + resistance:question_flood | learner-authored rationale, collapsed question set, state-disambiguating response | learner-authored rationale, state-disambiguating response | inconclusive |
| rote_parroting | DAG-only | request_evidence | proof:W_AF6_CURRICULUM | learner-authored rationale | - | inconclusive |
| rote_parroting | resistance-only | elicit_prediction | resistance:rote_parroting | learner-authored prediction, non-formulaic learner rationale | learner-authored prediction, non-formulaic learner rationale | success |
| rote_parroting | combined | request_evidence | proof:W_AF6_CURRICULUM + resistance:rote_parroting | learner-authored rationale, learner-authored prediction, non-formulaic learner rationale | learner-authored rationale, non-formulaic learner rationale | inconclusive |

## Interpretation

- DAG-only enforces the proof-release route: the proof fixture constrains every case to `request_evidence` and requires learner-authored rationale before closure.
- Resistance-only routes by learner resistance signal: the selected actions vary by signal while requiring resistance-breakthrough evidence.
- Combined joins both sources: each combined row carries the proof-DAG identity and the matched resistance signal, and its success contract joins the proof-DAG evidence requirement with the signal-specific resistance evidence.
- Negative controls were not included in this run.
- The comparison supports a mechanical claim about policy-layer integration. It does not show that real learners improve more under the combined mechanism.

