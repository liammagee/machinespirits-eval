# Adaptive DAG/Resistance Comparison

Generated: 2026-06-29T12:33:26.267Z
Run id: `eval-2026-06-29-b7eb5e86`
LLM mode: `real`
Conditions: `all`
Control set: `standard`
Arms: `combined_contracts_only`, `combined_semantic_only`, `combined_followup_only`, `combined_staged_v2`
Runs per scenario: 1
Budget ceiling: $1.00
Rows: 100

## Claim Boundary

This is a real-LLM ablation over the mechanism-wiring harness, not an empirical learning-effect result. Positive rows use unscripted learner turns; negative controls use fixed shallow replies so false-positive rejection remains strict. The run checks whether proof-DAG constraints and learner-resistance routing operate as one adaptation policy layer with observable evidence closure.

## Aggregate Result

| arm | positive closure | negative controls rejected | policy-layer matches | positive selected actions |
|---|---:|---:|---:|---|
| combined-contracts-only | 0/5 (0%) | 20/20 (100%) | 25/25 | request_evidence=5 |
| combined-semantic-only | 3/5 (60%) | 20/20 (100%) | 25/25 | request_evidence=5 |
| combined-followup-only | 1/5 (20%) | 20/20 (100%) | 25/25 | request_evidence=5 |
| combined-staged-v2 | 4/5 (80%) | 20/20 (100%) | 25/25 | request_evidence=5 |

## Negative Controls

| control | rows | rejected | accidental successes | outcomes |
|---|---:|---:|---:|---|
| mere agreement | 20 | 20/20 (100%) | 0 | failure=20 |
| formula parroting | 20 | 20/20 (100%) | 0 | failure=20 |
| tutor rationale adoption | 20 | 20/20 (100%) | 0 | failure=20 |
| vague explain more | 20 | 20/20 (100%) | 0 | failure=20 |

## Per-Signal Contrast

| signal | combined-contracts-only action | combined-semantic-only action | combined-followup-only action | combined-staged-v2 action | all included succeeded |
|---|---|---|---|---|---:|
| boredom | request_evidence | request_evidence | request_evidence | request_evidence | no |
| frustration | request_evidence | request_evidence | request_evidence | request_evidence | no |
| irrelevance | request_evidence | request_evidence | request_evidence | request_evidence | no |
| question_flood | request_evidence | request_evidence | request_evidence | request_evidence | no |
| rote_parroting | request_evidence | request_evidence | request_evidence | request_evidence | no |

## Positive Row Detail

| signal | arm | action | layer | staged | required evidence | evidence observed | outcome |
|---|---|---|---|---:|---|---|---|
| boredom | combined-contracts-only | request_evidence | proof:W_AF6_CURRICULUM + resistance:boredom | no | learner-authored rationale | learner-owned test case, renewed content-bearing work | inconclusive |
| boredom | combined-semantic-only | request_evidence | proof:W_AF6_CURRICULUM + resistance:boredom | no | learner-authored rationale, renewed content-bearing work, learner-owned test case | learner-authored rationale, learner-owned test case, renewed content-bearing work | success |
| boredom | combined-followup-only | request_evidence | proof:W_AF6_CURRICULUM + resistance:boredom | no | learner-authored rationale, renewed content-bearing work, learner-owned test case | - | inconclusive |
| boredom | combined-staged-v2 | request_evidence | proof:W_AF6_CURRICULUM + resistance:boredom | no | learner-authored rationale | learner-authored rationale, learner-owned test case, renewed content-bearing work | success |
| frustration | combined-contracts-only | request_evidence | proof:W_AF6_CURRICULUM + resistance:frustration | no | learner-authored rationale | renewed attempt after affective repair | inconclusive |
| frustration | combined-semantic-only | request_evidence | proof:W_AF6_CURRICULUM + resistance:frustration | no | learner-authored rationale, renewed attempt after affective repair, smaller learner-owned move | learner-authored rationale, renewed attempt after affective repair | inconclusive |
| frustration | combined-followup-only | request_evidence | proof:W_AF6_CURRICULUM + resistance:frustration | yes | learner-authored rationale, renewed attempt after affective repair, smaller learner-owned move | learner-authored rationale, renewed attempt after affective repair | inconclusive |
| frustration | combined-staged-v2 | request_evidence | proof:W_AF6_CURRICULUM + resistance:frustration | no | learner-authored rationale | learner-authored rationale, renewed attempt after affective repair, smaller learner-owned move | success |
| irrelevance | combined-contracts-only | request_evidence | proof:W_AF6_CURRICULUM + resistance:irrelevance | no | learner-authored rationale | - | inconclusive |
| irrelevance | combined-semantic-only | request_evidence | proof:W_AF6_CURRICULUM + resistance:irrelevance | no | learner-authored rationale, learner-owned relevance test, task reorientation | learner-authored rationale, learner-owned relevance test, task reorientation | success |
| irrelevance | combined-followup-only | request_evidence | proof:W_AF6_CURRICULUM + resistance:irrelevance | no | learner-authored rationale, learner-owned relevance test, task reorientation | - | inconclusive |
| irrelevance | combined-staged-v2 | request_evidence | proof:W_AF6_CURRICULUM + resistance:irrelevance | no | learner-authored rationale | learner-authored rationale, learner-owned relevance test, task reorientation | success |
| question_flood | combined-contracts-only | request_evidence | proof:W_AF6_CURRICULUM + resistance:question_flood | no | learner-authored rationale | - | inconclusive |
| question_flood | combined-semantic-only | request_evidence | proof:W_AF6_CURRICULUM + resistance:question_flood | no | learner-authored rationale, collapsed question set, state-disambiguating response | collapsed question set, learner-authored rationale, state-disambiguating response | success |
| question_flood | combined-followup-only | request_evidence | proof:W_AF6_CURRICULUM + resistance:question_flood | no | learner-authored rationale, collapsed question set, state-disambiguating response | - | null |
| question_flood | combined-staged-v2 | request_evidence | proof:W_AF6_CURRICULUM + resistance:question_flood | no | learner-authored rationale | collapsed question set, learner-authored rationale | success |
| rote_parroting | combined-contracts-only | request_evidence | proof:W_AF6_CURRICULUM + resistance:rote_parroting | no | learner-authored rationale | learner-authored rationale | inconclusive |
| rote_parroting | combined-semantic-only | request_evidence | proof:W_AF6_CURRICULUM + resistance:rote_parroting | no | learner-authored rationale, learner-authored prediction, non-formulaic learner rationale | learner-authored rationale, non-formulaic learner rationale | inconclusive |
| rote_parroting | combined-followup-only | request_evidence | proof:W_AF6_CURRICULUM + resistance:rote_parroting | yes | learner-authored rationale, learner-authored prediction, non-formulaic learner rationale | learner-authored prediction, learner-authored rationale, non-formulaic learner rationale | success |
| rote_parroting | combined-staged-v2 | request_evidence | proof:W_AF6_CURRICULUM + resistance:rote_parroting | no | learner-authored rationale | - | inconclusive |

## Interpretation

- DAG-only enforces the proof-release route: the proof fixture constrains every case to `request_evidence` and requires learner-authored rationale before closure.
- Resistance-only routes by learner resistance signal: the selected actions vary by signal while requiring resistance-breakthrough evidence.
- Combined joins both sources: each combined row carries the proof-DAG identity and the matched resistance signal, and its success contract joins the proof-DAG evidence requirement with the signal-specific resistance evidence.
- Staged-v2 adds typed evidence contracts: proof-core evidence remains required, while resistance breakthrough closes on one signal-specific core label and records the remaining labels as supporting evidence.
- Negative controls reject shallow uptake: mere agreement, formula parroting, tutor-rationale adoption, and vague requests for more explanation do not close as success.
- The comparison supports a mechanical claim about policy-layer integration. It does not show that real learners improve more under the combined mechanism.

