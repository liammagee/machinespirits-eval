# Adaptive DAG/Resistance Comparison

Generated: 2026-06-29T08:36:09.694Z
Run id: `eval-2026-06-29-5fdffe28`
LLM mode: `real`
Conditions: `all`
Runs per scenario: 1
Budget ceiling: $1.00
Rows: 125

## Claim Boundary

This is a real-LLM ablation over the mechanism-wiring harness, not an empirical learning-effect result. Positive rows use unscripted learner turns; negative controls use fixed shallow replies so false-positive rejection remains strict. The run checks whether proof-DAG constraints and learner-resistance routing operate as one adaptation policy layer with observable evidence closure.

## Aggregate Result

| arm | positive closure | negative controls rejected | policy-layer matches | positive selected actions |
|---|---:|---:|---:|---|
| DAG-only | 4/5 (80%) | 20/20 (100%) | 25/25 | request_evidence=5 |
| resistance-only | 3/5 (60%) | 20/20 (100%) | 25/25 | ask_strategy_choice=1, elicit_prediction=3, diagnose_with_discriminating_question=1 |
| combined-strict | 0/5 (0%) | 20/20 (100%) | 25/25 | request_evidence=5 |
| combined-staged | 1/5 (20%) | 20/20 (100%) | 25/25 | request_evidence=5 |
| combined-staged-v2 | 5/5 (100%) | 20/20 (100%) | 25/25 | request_evidence=5 |

## Negative Controls

| control | rows | rejected | accidental successes | outcomes |
|---|---:|---:|---:|---|
| mere agreement | 25 | 25/25 (100%) | 0 | failure=25 |
| formula parroting | 25 | 25/25 (100%) | 0 | failure=25 |
| tutor rationale adoption | 25 | 25/25 (100%) | 0 | failure=25 |
| vague explain more | 25 | 25/25 (100%) | 0 | failure=25 |

## Per-Signal Contrast

| signal | DAG-only action | resistance-only action | combined-strict action | combined-staged action | combined-staged-v2 action | all succeeded | strict source join | staged source join | staged-v2 source join | strict evidence join | staged evidence join | staged-v2 evidence join |
|---|---|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|
| boredom | request_evidence | ask_strategy_choice | request_evidence | request_evidence | request_evidence | no | yes | yes | yes | yes | yes | yes |
| frustration | request_evidence | elicit_prediction | request_evidence | request_evidence | request_evidence | no | yes | yes | yes | yes | yes | yes |
| irrelevance | request_evidence | elicit_prediction | request_evidence | request_evidence | request_evidence | no | yes | yes | yes | yes | yes | yes |
| question_flood | request_evidence | diagnose_with_discriminating_question | request_evidence | request_evidence | request_evidence | no | yes | yes | yes | yes | yes | yes |
| rote_parroting | request_evidence | elicit_prediction | request_evidence | request_evidence | request_evidence | no | yes | yes | yes | yes | yes | yes |

## Positive Row Detail

| signal | arm | action | layer | staged | required evidence | evidence observed | outcome |
|---|---|---|---|---:|---|---|---|
| boredom | DAG-only | request_evidence | proof:W_AF6_CURRICULUM | no | learner-authored rationale | - | inconclusive |
| boredom | resistance-only | ask_strategy_choice | resistance:boredom | no | learner-authored choice, renewed content-bearing work, learner-owned test case | learner-authored choice, learner-owned test case, renewed content-bearing work | success |
| boredom | combined-strict | request_evidence | proof:W_AF6_CURRICULUM + resistance:boredom | no | learner-authored rationale, renewed content-bearing work, learner-owned test case | learner-owned test case, renewed content-bearing work | inconclusive |
| boredom | combined-staged | request_evidence | proof:W_AF6_CURRICULUM + resistance:boredom | no | learner-authored rationale, renewed content-bearing work, learner-owned test case | learner-authored rationale, learner-owned test case, renewed content-bearing work | success |
| boredom | combined-staged-v2 | request_evidence | proof:W_AF6_CURRICULUM + resistance:boredom | no | learner-authored rationale | learner-authored rationale, learner-owned test case, renewed content-bearing work | success |
| frustration | DAG-only | request_evidence | proof:W_AF6_CURRICULUM | no | learner-authored rationale | learner-authored rationale | success |
| frustration | resistance-only | elicit_prediction | resistance:frustration | no | learner-authored prediction, renewed attempt after affective repair, smaller learner-owned move | learner-authored prediction, renewed attempt after affective repair | inconclusive |
| frustration | combined-strict | request_evidence | proof:W_AF6_CURRICULUM + resistance:frustration | no | learner-authored rationale, renewed attempt after affective repair, smaller learner-owned move | learner-authored rationale, renewed attempt after affective repair | inconclusive |
| frustration | combined-staged | request_evidence | proof:W_AF6_CURRICULUM + resistance:frustration | no | learner-authored rationale, renewed attempt after affective repair, smaller learner-owned move | - | inconclusive |
| frustration | combined-staged-v2 | request_evidence | proof:W_AF6_CURRICULUM + resistance:frustration | no | learner-authored rationale | learner-authored rationale, renewed attempt after affective repair, smaller learner-owned move | success |
| irrelevance | DAG-only | request_evidence | proof:W_AF6_CURRICULUM | no | learner-authored rationale | learner-authored rationale | success |
| irrelevance | resistance-only | elicit_prediction | resistance:irrelevance | no | learner-authored prediction, learner-owned relevance test, task reorientation | learner-authored prediction | inconclusive |
| irrelevance | combined-strict | request_evidence | proof:W_AF6_CURRICULUM + resistance:irrelevance | no | learner-authored rationale, learner-owned relevance test, task reorientation | learner-owned relevance test | inconclusive |
| irrelevance | combined-staged | request_evidence | proof:W_AF6_CURRICULUM + resistance:irrelevance | no | learner-authored rationale, learner-owned relevance test, task reorientation | - | inconclusive |
| irrelevance | combined-staged-v2 | request_evidence | proof:W_AF6_CURRICULUM + resistance:irrelevance | no | learner-authored rationale | learner-authored rationale, learner-owned relevance test, task reorientation | success |
| question_flood | DAG-only | request_evidence | proof:W_AF6_CURRICULUM | no | learner-authored rationale | learner-authored rationale | success |
| question_flood | resistance-only | diagnose_with_discriminating_question | resistance:question_flood | no | state-disambiguating response, collapsed question set | state-disambiguating response | success |
| question_flood | combined-strict | request_evidence | proof:W_AF6_CURRICULUM + resistance:question_flood | no | learner-authored rationale, collapsed question set, state-disambiguating response | state-disambiguating response | inconclusive |
| question_flood | combined-staged | request_evidence | proof:W_AF6_CURRICULUM + resistance:question_flood | no | learner-authored rationale, collapsed question set, state-disambiguating response | - | null |
| question_flood | combined-staged-v2 | request_evidence | proof:W_AF6_CURRICULUM + resistance:question_flood | yes | learner-authored rationale | collapsed question set, learner-authored rationale | success |
| rote_parroting | DAG-only | request_evidence | proof:W_AF6_CURRICULUM | no | learner-authored rationale | learner-authored rationale | success |
| rote_parroting | resistance-only | elicit_prediction | resistance:rote_parroting | no | learner-authored prediction, non-formulaic learner rationale | learner-authored prediction, non-formulaic learner rationale | success |
| rote_parroting | combined-strict | request_evidence | proof:W_AF6_CURRICULUM + resistance:rote_parroting | no | learner-authored rationale, learner-authored prediction, non-formulaic learner rationale | learner-authored rationale, non-formulaic learner rationale | inconclusive |
| rote_parroting | combined-staged | request_evidence | proof:W_AF6_CURRICULUM + resistance:rote_parroting | no | learner-authored rationale, learner-authored prediction, non-formulaic learner rationale | - | null |
| rote_parroting | combined-staged-v2 | request_evidence | proof:W_AF6_CURRICULUM + resistance:rote_parroting | no | learner-authored rationale | learner-authored rationale, non-formulaic learner rationale | success |

## Interpretation

- DAG-only enforces the proof-release route: the proof fixture constrains every case to `request_evidence` and requires learner-authored rationale before closure.
- Resistance-only routes by learner resistance signal: the selected actions vary by signal while requiring resistance-breakthrough evidence.
- Combined joins both sources: each combined row carries the proof-DAG identity and the matched resistance signal, and its success contract joins the proof-DAG evidence requirement with the signal-specific resistance evidence.
- Staged combined preserves the same joined contract but lets partial uptake remain pending, then asks for the missing evidence instead of treating the first partial reply as final.
- Staged-v2 adds typed evidence contracts: proof-core evidence remains required, while resistance breakthrough closes on one signal-specific core label and records the remaining labels as supporting evidence.
- Negative controls reject shallow uptake: mere agreement, formula parroting, tutor-rationale adoption, and vague requests for more explanation do not close as success.
- The comparison supports a mechanical claim about policy-layer integration. It does not show that real learners improve more under the combined mechanism.

