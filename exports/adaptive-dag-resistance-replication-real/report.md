# Adaptive DAG/Resistance Comparison

Generated: 2026-06-29T12:28:10.224Z
Run id: `eval-2026-06-29-bbebc425`
LLM mode: `real`
Conditions: `all`
Control set: `standard`
Arms: `combined_strict`, `combined_staged`, `combined_staged_v2`
Runs per scenario: 3
Budget ceiling: $1.00
Rows: 225

## Claim Boundary

This is a real-LLM ablation over the mechanism-wiring harness, not an empirical learning-effect result. Positive rows use unscripted learner turns; negative controls use fixed shallow replies so false-positive rejection remains strict. The run checks whether proof-DAG constraints and learner-resistance routing operate as one adaptation policy layer with observable evidence closure.

## Aggregate Result

| arm | positive closure | negative controls rejected | policy-layer matches | positive selected actions |
|---|---:|---:|---:|---|
| combined-strict | 1/15 (7%) | 60/60 (100%) | 75/75 | request_evidence=15 |
| combined-staged | 4/15 (27%) | 60/60 (100%) | 75/75 | request_evidence=15 |
| combined-staged-v2 | 15/15 (100%) | 60/60 (100%) | 75/75 | request_evidence=15 |

## Negative Controls

| control | rows | rejected | accidental successes | outcomes |
|---|---:|---:|---:|---|
| mere agreement | 45 | 45/45 (100%) | 0 | failure=45 |
| formula parroting | 45 | 45/45 (100%) | 0 | failure=45 |
| tutor rationale adoption | 45 | 45/45 (100%) | 0 | failure=45 |
| vague explain more | 45 | 45/45 (100%) | 0 | failure=45 |

## Per-Signal Contrast

| signal | combined-strict action | combined-staged action | combined-staged-v2 action | all included succeeded |
|---|---|---|---|---:|
| boredom | request_evidence | request_evidence | request_evidence | no |
| frustration | request_evidence | request_evidence | request_evidence | no |
| irrelevance | request_evidence | request_evidence | request_evidence | no |
| question_flood | request_evidence | request_evidence | request_evidence | no |
| rote_parroting | request_evidence | request_evidence | request_evidence | no |

## Positive Row Detail

| signal | arm | action | layer | staged | required evidence | evidence observed | outcome |
|---|---|---|---|---:|---|---|---|
| boredom | combined-strict | request_evidence | proof:W_AF6_CURRICULUM + resistance:boredom | no | learner-authored rationale, renewed content-bearing work, learner-owned test case | - | inconclusive |
| boredom | combined-strict | request_evidence | proof:W_AF6_CURRICULUM + resistance:boredom | no | learner-authored rationale, renewed content-bearing work, learner-owned test case | learner-owned test case, renewed content-bearing work | inconclusive |
| boredom | combined-strict | request_evidence | proof:W_AF6_CURRICULUM + resistance:boredom | no | learner-authored rationale, renewed content-bearing work, learner-owned test case | learner-owned test case, renewed content-bearing work | inconclusive |
| boredom | combined-staged | request_evidence | proof:W_AF6_CURRICULUM + resistance:boredom | no | learner-authored rationale, renewed content-bearing work, learner-owned test case | - | inconclusive |
| boredom | combined-staged | request_evidence | proof:W_AF6_CURRICULUM + resistance:boredom | yes | learner-authored rationale, renewed content-bearing work, learner-owned test case | learner-authored rationale, learner-owned test case, renewed content-bearing work | success |
| boredom | combined-staged | request_evidence | proof:W_AF6_CURRICULUM + resistance:boredom | yes | learner-authored rationale, renewed content-bearing work, learner-owned test case | learner-owned test case, renewed content-bearing work | inconclusive |
| boredom | combined-staged-v2 | request_evidence | proof:W_AF6_CURRICULUM + resistance:boredom | no | learner-authored rationale | learner-authored rationale, learner-owned test case, renewed content-bearing work | success |
| boredom | combined-staged-v2 | request_evidence | proof:W_AF6_CURRICULUM + resistance:boredom | no | learner-authored rationale | learner-authored rationale, learner-owned test case, renewed content-bearing work | success |
| boredom | combined-staged-v2 | request_evidence | proof:W_AF6_CURRICULUM + resistance:boredom | no | learner-authored rationale | learner-authored rationale, learner-owned test case, renewed content-bearing work | success |
| frustration | combined-strict | request_evidence | proof:W_AF6_CURRICULUM + resistance:frustration | no | learner-authored rationale, renewed attempt after affective repair, smaller learner-owned move | learner-authored rationale, renewed attempt after affective repair, smaller learner-owned move | success |
| frustration | combined-strict | request_evidence | proof:W_AF6_CURRICULUM + resistance:frustration | no | learner-authored rationale, renewed attempt after affective repair, smaller learner-owned move | learner-authored rationale, renewed attempt after affective repair | inconclusive |
| frustration | combined-strict | request_evidence | proof:W_AF6_CURRICULUM + resistance:frustration | no | learner-authored rationale, renewed attempt after affective repair, smaller learner-owned move | - | inconclusive |
| frustration | combined-staged | request_evidence | proof:W_AF6_CURRICULUM + resistance:frustration | no | learner-authored rationale, renewed attempt after affective repair, smaller learner-owned move | - | inconclusive |
| frustration | combined-staged | request_evidence | proof:W_AF6_CURRICULUM + resistance:frustration | yes | learner-authored rationale, renewed attempt after affective repair, smaller learner-owned move | renewed attempt after affective repair | inconclusive |
| frustration | combined-staged | request_evidence | proof:W_AF6_CURRICULUM + resistance:frustration | yes | learner-authored rationale, renewed attempt after affective repair, smaller learner-owned move | learner-authored rationale, renewed attempt after affective repair, smaller learner-owned move | success |
| frustration | combined-staged-v2 | request_evidence | proof:W_AF6_CURRICULUM + resistance:frustration | no | learner-authored rationale | learner-authored rationale, renewed attempt after affective repair, smaller learner-owned move | success |
| frustration | combined-staged-v2 | request_evidence | proof:W_AF6_CURRICULUM + resistance:frustration | no | learner-authored rationale | learner-authored rationale, renewed attempt after affective repair, smaller learner-owned move | success |
| frustration | combined-staged-v2 | request_evidence | proof:W_AF6_CURRICULUM + resistance:frustration | no | learner-authored rationale | learner-authored rationale, renewed attempt after affective repair, smaller learner-owned move | success |
| irrelevance | combined-strict | request_evidence | proof:W_AF6_CURRICULUM + resistance:irrelevance | no | learner-authored rationale, learner-owned relevance test, task reorientation | - | inconclusive |
| irrelevance | combined-strict | request_evidence | proof:W_AF6_CURRICULUM + resistance:irrelevance | no | learner-authored rationale, learner-owned relevance test, task reorientation | - | inconclusive |
| irrelevance | combined-strict | request_evidence | proof:W_AF6_CURRICULUM + resistance:irrelevance | no | learner-authored rationale, learner-owned relevance test, task reorientation | - | inconclusive |
| irrelevance | combined-staged | request_evidence | proof:W_AF6_CURRICULUM + resistance:irrelevance | no | learner-authored rationale, learner-owned relevance test, task reorientation | - | inconclusive |
| irrelevance | combined-staged | request_evidence | proof:W_AF6_CURRICULUM + resistance:irrelevance | yes | learner-authored rationale, learner-owned relevance test, task reorientation | learner-authored rationale, learner-owned relevance test, task reorientation | success |
| irrelevance | combined-staged | request_evidence | proof:W_AF6_CURRICULUM + resistance:irrelevance | yes | learner-authored rationale, learner-owned relevance test, task reorientation | learner-owned relevance test | inconclusive |
| irrelevance | combined-staged-v2 | request_evidence | proof:W_AF6_CURRICULUM + resistance:irrelevance | no | learner-authored rationale | learner-authored rationale, learner-owned relevance test, task reorientation | success |
| irrelevance | combined-staged-v2 | request_evidence | proof:W_AF6_CURRICULUM + resistance:irrelevance | no | learner-authored rationale | learner-authored rationale, learner-owned relevance test, task reorientation | success |
| irrelevance | combined-staged-v2 | request_evidence | proof:W_AF6_CURRICULUM + resistance:irrelevance | no | learner-authored rationale | learner-authored rationale, learner-owned relevance test, task reorientation | success |
| question_flood | combined-strict | request_evidence | proof:W_AF6_CURRICULUM + resistance:question_flood | no | learner-authored rationale, collapsed question set, state-disambiguating response | state-disambiguating response | inconclusive |
| question_flood | combined-strict | request_evidence | proof:W_AF6_CURRICULUM + resistance:question_flood | no | learner-authored rationale, collapsed question set, state-disambiguating response | - | inconclusive |
| question_flood | combined-strict | request_evidence | proof:W_AF6_CURRICULUM + resistance:question_flood | no | learner-authored rationale, collapsed question set, state-disambiguating response | collapsed question set | inconclusive |
| question_flood | combined-staged | request_evidence | proof:W_AF6_CURRICULUM + resistance:question_flood | no | learner-authored rationale, collapsed question set, state-disambiguating response | - | null |
| question_flood | combined-staged | request_evidence | proof:W_AF6_CURRICULUM + resistance:question_flood | no | learner-authored rationale, collapsed question set, state-disambiguating response | - | null |
| question_flood | combined-staged | request_evidence | proof:W_AF6_CURRICULUM + resistance:question_flood | no | learner-authored rationale, collapsed question set, state-disambiguating response | - | null |
| question_flood | combined-staged-v2 | request_evidence | proof:W_AF6_CURRICULUM + resistance:question_flood | yes | learner-authored rationale | collapsed question set, learner-authored rationale, state-disambiguating response | success |
| question_flood | combined-staged-v2 | request_evidence | proof:W_AF6_CURRICULUM + resistance:question_flood | no | learner-authored rationale | collapsed question set, learner-authored rationale | success |
| question_flood | combined-staged-v2 | request_evidence | proof:W_AF6_CURRICULUM + resistance:question_flood | no | learner-authored rationale | collapsed question set, learner-authored rationale, state-disambiguating response | success |
| rote_parroting | combined-strict | request_evidence | proof:W_AF6_CURRICULUM + resistance:rote_parroting | no | learner-authored rationale, learner-authored prediction, non-formulaic learner rationale | learner-authored rationale, non-formulaic learner rationale | inconclusive |
| rote_parroting | combined-strict | request_evidence | proof:W_AF6_CURRICULUM + resistance:rote_parroting | no | learner-authored rationale, learner-authored prediction, non-formulaic learner rationale | - | inconclusive |
| rote_parroting | combined-strict | request_evidence | proof:W_AF6_CURRICULUM + resistance:rote_parroting | no | learner-authored rationale, learner-authored prediction, non-formulaic learner rationale | learner-authored rationale, non-formulaic learner rationale | inconclusive |
| rote_parroting | combined-staged | request_evidence | proof:W_AF6_CURRICULUM + resistance:rote_parroting | yes | learner-authored rationale, learner-authored prediction, non-formulaic learner rationale | learner-authored prediction, learner-authored rationale, non-formulaic learner rationale | success |
| rote_parroting | combined-staged | request_evidence | proof:W_AF6_CURRICULUM + resistance:rote_parroting | yes | learner-authored rationale, learner-authored prediction, non-formulaic learner rationale | learner-authored rationale, non-formulaic learner rationale | inconclusive |
| rote_parroting | combined-staged | request_evidence | proof:W_AF6_CURRICULUM + resistance:rote_parroting | yes | learner-authored rationale, learner-authored prediction, non-formulaic learner rationale | learner-authored rationale, non-formulaic learner rationale | inconclusive |
| rote_parroting | combined-staged-v2 | request_evidence | proof:W_AF6_CURRICULUM + resistance:rote_parroting | no | learner-authored rationale | learner-authored rationale, non-formulaic learner rationale | success |
| rote_parroting | combined-staged-v2 | request_evidence | proof:W_AF6_CURRICULUM + resistance:rote_parroting | no | learner-authored rationale | learner-authored rationale, non-formulaic learner rationale | success |
| rote_parroting | combined-staged-v2 | request_evidence | proof:W_AF6_CURRICULUM + resistance:rote_parroting | no | learner-authored rationale | learner-authored rationale, non-formulaic learner rationale | success |

## Interpretation

- DAG-only enforces the proof-release route: the proof fixture constrains every case to `request_evidence` and requires learner-authored rationale before closure.
- Resistance-only routes by learner resistance signal: the selected actions vary by signal while requiring resistance-breakthrough evidence.
- Combined joins both sources: each combined row carries the proof-DAG identity and the matched resistance signal, and its success contract joins the proof-DAG evidence requirement with the signal-specific resistance evidence.
- Staged combined preserves the same joined contract but lets partial uptake remain pending, then asks for the missing evidence instead of treating the first partial reply as final.
- Staged-v2 adds typed evidence contracts: proof-core evidence remains required, while resistance breakthrough closes on one signal-specific core label and records the remaining labels as supporting evidence.
- Negative controls reject shallow uptake: mere agreement, formula parroting, tutor-rationale adoption, and vague requests for more explanation do not close as success.
- The comparison supports a mechanical claim about policy-layer integration. It does not show that real learners improve more under the combined mechanism.

