# Adaptation policy evaluation

**Evaluation type:** deterministic synthetic policy-level mechanics test  
**Suite version:** 1.0  
**Scenarios:** 14  
**Tutor turns per dialogue:** 3

> This deterministic oracle evaluation validates mechanics and discriminability only. It is not evidence of real learner adaptation or repository-integrated performance.

## Aggregate results

| Metric | closed_loop | legacy | closed_loop - legacy |
|---|---:|---:|---:|
| Strict joint proof/release/ownership success | 1.000 | 0.429 | 0.571 |
| State top-1 accuracy | 1.000 | 0.143 | 0.857 |
| State Brier score (lower is better) | 0.264 | 0.857 | -0.593 |
| Intervention success rate | 1.000 | 0.190 | 0.810 |
| Action-state fit rate | 1.000 | 0.000 | 1.000 |
| Tutor control cost | 0.176 | 0.417 | -0.240 |
| Proof/release mismatch rate | 0.143 | 0.143 | 0.000 |
| Counterfactual regret | 0.000 | 0.607 | -0.607 |
| Final proof | 0.664 | 0.379 | 0.286 |
| Final release | 0.650 | 0.336 | 0.314 |
| Final ownership | 0.743 | 0.400 | 0.343 |

## Paired bootstrap intervals

- **Strict joint proof/release/ownership success:** mean difference 0.571, 95% bootstrap CI [0.286, 0.857]
- **State top-1 accuracy:** mean difference 0.857, 95% bootstrap CI [0.643, 1.000]
- **State Brier score (lower is better):** mean difference -0.593, 95% bootstrap CI [-0.616, -0.570]
- **Intervention success rate:** mean difference 0.810, 95% bootstrap CI [0.667, 0.929]
- **Proof/release mismatch rate:** mean difference 0.000, 95% bootstrap CI [0.000, 0.000]
- **Action-state fit rate:** mean difference 1.000, 95% bootstrap CI [1.000, 1.000]
- **Tutor control cost:** mean difference -0.240, 95% bootstrap CI [-0.256, -0.224]
- **Counterfactual regret:** mean difference -0.607, 95% bootstrap CI [-0.696, -0.500]
- **Final proof:** mean difference 0.286, 95% bootstrap CI [0.207, 0.371]
- **Final release:** mean difference 0.314, 95% bootstrap CI [0.186, 0.443]
- **Final ownership:** mean difference 0.343, 95% bootstrap CI [0.246, 0.450]

## Scenario traces

| Scenario | Hidden state | legacy actions | contract actions | contract_gate actions | closed_loop actions |
|---|---|---|---|---|---|
| missing-prerequisite-1 | missing_prerequisite | explain_principle -> minimal_hint -> contrast_models | diagnose_with_discriminating_question -> diagnose_with_discriminating_question -> diagnose_with_discriminating_question | diagnose_with_discriminating_question -> diagnose_with_discriminating_question -> diagnose_with_discriminating_question | diagnose_with_discriminating_question -> minimal_hint -> request_evidence |
| missing-prerequisite-2 | missing_prerequisite | explain_principle -> minimal_hint -> contrast_models | diagnose_with_discriminating_question -> diagnose_with_discriminating_question -> diagnose_with_discriminating_question | diagnose_with_discriminating_question -> diagnose_with_discriminating_question -> diagnose_with_discriminating_question | diagnose_with_discriminating_question -> minimal_hint -> request_evidence |
| low-confidence-1 | low_confidence | explain_principle -> minimal_hint -> contrast_models | diagnose_with_discriminating_question -> diagnose_with_discriminating_question -> diagnose_with_discriminating_question | diagnose_with_discriminating_question -> diagnose_with_discriminating_question -> diagnose_with_discriminating_question | diagnose_with_discriminating_question -> elicit_prediction -> ask_strategy_choice |
| low-confidence-2 | low_confidence | explain_principle -> minimal_hint -> contrast_models | diagnose_with_discriminating_question -> diagnose_with_discriminating_question -> diagnose_with_discriminating_question | diagnose_with_discriminating_question -> diagnose_with_discriminating_question -> diagnose_with_discriminating_question | diagnose_with_discriminating_question -> elicit_prediction -> ask_strategy_choice |
| approval-dependency-1 | approval_dependency | explain_principle -> minimal_hint -> contrast_models | diagnose_with_discriminating_question -> diagnose_with_discriminating_question -> diagnose_with_discriminating_question | diagnose_with_discriminating_question -> diagnose_with_discriminating_question -> diagnose_with_discriminating_question | diagnose_with_discriminating_question -> ask_strategy_choice -> ask_strategy_choice |
| approval-dependency-2 | approval_dependency | explain_principle -> minimal_hint -> contrast_models | diagnose_with_discriminating_question -> diagnose_with_discriminating_question -> diagnose_with_discriminating_question | diagnose_with_discriminating_question -> diagnose_with_discriminating_question -> diagnose_with_discriminating_question | diagnose_with_discriminating_question -> ask_strategy_choice -> ask_strategy_choice |
| task-misread-1 | task_misread | explain_principle -> minimal_hint -> contrast_models | diagnose_with_discriminating_question -> diagnose_with_discriminating_question -> diagnose_with_discriminating_question | diagnose_with_discriminating_question -> diagnose_with_discriminating_question -> diagnose_with_discriminating_question | diagnose_with_discriminating_question -> reanchor_goal -> ask_strategy_choice |
| task-misread-2 | task_misread | explain_principle -> minimal_hint -> contrast_models | diagnose_with_discriminating_question -> diagnose_with_discriminating_question -> diagnose_with_discriminating_question | diagnose_with_discriminating_question -> diagnose_with_discriminating_question -> diagnose_with_discriminating_question | diagnose_with_discriminating_question -> reanchor_goal -> ask_strategy_choice |
| notation-overload-1 | notation_overload | explain_principle -> minimal_hint -> contrast_models | diagnose_with_discriminating_question -> diagnose_with_discriminating_question -> diagnose_with_discriminating_question | diagnose_with_discriminating_question -> diagnose_with_discriminating_question -> diagnose_with_discriminating_question | diagnose_with_discriminating_question -> minimal_hint -> request_evidence |
| notation-overload-2 | notation_overload | explain_principle -> minimal_hint -> contrast_models | diagnose_with_discriminating_question -> diagnose_with_discriminating_question -> diagnose_with_discriminating_question | diagnose_with_discriminating_question -> diagnose_with_discriminating_question -> diagnose_with_discriminating_question | diagnose_with_discriminating_question -> minimal_hint -> request_evidence |
| answer-seeking-1 | answer_seeking | explain_principle -> minimal_hint -> contrast_models | diagnose_with_discriminating_question -> diagnose_with_discriminating_question -> diagnose_with_discriminating_question | diagnose_with_discriminating_question -> diagnose_with_discriminating_question -> diagnose_with_discriminating_question | diagnose_with_discriminating_question -> ask_strategy_choice -> ask_strategy_choice |
| answer-seeking-2 | answer_seeking | explain_principle -> minimal_hint -> contrast_models | diagnose_with_discriminating_question -> diagnose_with_discriminating_question -> diagnose_with_discriminating_question | diagnose_with_discriminating_question -> diagnose_with_discriminating_question -> diagnose_with_discriminating_question | diagnose_with_discriminating_question -> ask_strategy_choice -> ask_strategy_choice |
| alternative-model-1 | correct_alternative_model | explain_principle -> minimal_hint -> contrast_models | diagnose_with_discriminating_question -> diagnose_with_discriminating_question -> diagnose_with_discriminating_question | diagnose_with_discriminating_question -> diagnose_with_discriminating_question -> diagnose_with_discriminating_question | diagnose_with_discriminating_question -> request_evidence -> request_evidence |
| alternative-model-2 | correct_alternative_model | explain_principle -> minimal_hint -> contrast_models | diagnose_with_discriminating_question -> diagnose_with_discriminating_question -> diagnose_with_discriminating_question | diagnose_with_discriminating_question -> diagnose_with_discriminating_question -> diagnose_with_discriminating_question | diagnose_with_discriminating_question -> request_evidence -> request_evidence |

## Interpretation

The closed-loop condition wins this oracle fixture when it uses diagnostic actions to resolve state uncertainty, then selects lower-control actions matched to the revealed learner cause and closes intervention outcomes. Treat these results as a mechanics check before repository-integrated and real-LLM evaluation.
