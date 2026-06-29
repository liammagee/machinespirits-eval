# Adaptive DAG/Resistance Comparison

Generated: 2026-06-29T06:22:09.193Z
Run id: `eval-2026-06-29-5dfc3484`
Rows: 15

## Claim Boundary

This is a deterministic mock ablation of mechanism wiring, not an empirical learning-effect result. It checks whether proof-DAG constraints and learner-resistance routing can operate as one adaptation policy layer with observable evidence closure.

## Aggregate Result

| arm | rows | success | policy-layer matches | selected actions |
|---|---:|---:|---:|---|
| DAG-only | 5 | 5/5 (100%) | 5/5 | request_evidence=5 |
| resistance-only | 5 | 5/5 (100%) | 5/5 | ask_strategy_choice=1, elicit_prediction=3, diagnose_with_discriminating_question=1 |
| combined | 5 | 5/5 (100%) | 5/5 | request_evidence=5 |

## Per-Signal Contrast

| signal | DAG-only action | resistance-only action | combined action | all succeeded | combined source join | evidence join |
|---|---|---|---|---:|---:|---:|
| boredom | request_evidence | ask_strategy_choice | request_evidence | yes | yes | yes |
| frustration | request_evidence | elicit_prediction | request_evidence | yes | yes | yes |
| irrelevance | request_evidence | elicit_prediction | request_evidence | yes | yes | yes |
| question_flood | request_evidence | diagnose_with_discriminating_question | request_evidence | yes | yes | yes |
| rote_parroting | request_evidence | elicit_prediction | request_evidence | yes | yes | yes |

## Row Detail

| signal | arm | action | layer | required evidence | evidence observed | outcome |
|---|---|---|---|---|---|---|
| boredom | DAG-only | request_evidence | proof:W_AF6_CURRICULUM | learner-authored rationale | learner-authored rationale | success |
| boredom | resistance-only | ask_strategy_choice | resistance:boredom | learner-authored choice, renewed content-bearing work, learner-owned test case | learner-authored choice, learner-owned test case, renewed content-bearing work | success |
| boredom | combined | request_evidence | proof:W_AF6_CURRICULUM + resistance:boredom | learner-authored rationale, renewed content-bearing work, learner-owned test case | learner-authored rationale, learner-owned test case, renewed content-bearing work | success |
| frustration | DAG-only | request_evidence | proof:W_AF6_CURRICULUM | learner-authored rationale | learner-authored rationale | success |
| frustration | resistance-only | elicit_prediction | resistance:frustration | learner-authored prediction, renewed attempt after affective repair, smaller learner-owned move | learner-authored prediction, renewed attempt after affective repair, smaller learner-owned move | success |
| frustration | combined | request_evidence | proof:W_AF6_CURRICULUM + resistance:frustration | learner-authored rationale, renewed attempt after affective repair, smaller learner-owned move | learner-authored rationale, renewed attempt after affective repair, smaller learner-owned move | success |
| irrelevance | DAG-only | request_evidence | proof:W_AF6_CURRICULUM | learner-authored rationale | learner-authored rationale | success |
| irrelevance | resistance-only | elicit_prediction | resistance:irrelevance | learner-authored prediction, learner-owned relevance test, task reorientation | learner-authored prediction, learner-owned relevance test, task reorientation | success |
| irrelevance | combined | request_evidence | proof:W_AF6_CURRICULUM + resistance:irrelevance | learner-authored rationale, learner-owned relevance test, task reorientation | learner-authored rationale, learner-owned relevance test, task reorientation | success |
| question_flood | DAG-only | request_evidence | proof:W_AF6_CURRICULUM | learner-authored rationale | learner-authored rationale | success |
| question_flood | resistance-only | diagnose_with_discriminating_question | resistance:question_flood | state-disambiguating response, collapsed question set | collapsed question set, state-disambiguating response | success |
| question_flood | combined | request_evidence | proof:W_AF6_CURRICULUM + resistance:question_flood | learner-authored rationale, collapsed question set, state-disambiguating response | collapsed question set, learner-authored rationale, state-disambiguating response | success |
| rote_parroting | DAG-only | request_evidence | proof:W_AF6_CURRICULUM | learner-authored rationale | learner-authored rationale | success |
| rote_parroting | resistance-only | elicit_prediction | resistance:rote_parroting | learner-authored prediction, non-formulaic learner rationale | learner-authored prediction, non-formulaic learner rationale | success |
| rote_parroting | combined | request_evidence | proof:W_AF6_CURRICULUM + resistance:rote_parroting | learner-authored rationale, learner-authored prediction, non-formulaic learner rationale | learner-authored prediction, learner-authored rationale, non-formulaic learner rationale | success |

## Interpretation

- DAG-only enforces the proof-release route: the proof fixture constrains every case to `request_evidence` and requires learner-authored rationale before closure.
- Resistance-only routes by learner resistance signal: the selected actions vary by signal while requiring resistance-breakthrough evidence.
- Combined joins both sources: each combined row carries the proof-DAG identity and the matched resistance signal, and its success contract joins the proof-DAG evidence requirement with the signal-specific resistance evidence.
- The comparison supports a mechanical claim about policy-layer integration. It does not show that real learners improve more under the combined mechanism.

