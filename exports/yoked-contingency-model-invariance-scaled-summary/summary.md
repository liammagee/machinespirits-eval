# Yoked-contingency scaled model-invariance summary

Generated: 2026-06-25T01:55:58.375Z
Status: pass_completed_scaled_model_invariance_summary

Boundary: seven completed scaled rows support the hard-transfer rule-transfer endpoint across Claude, GLM 5.2, and Codex/OpenAI-family routes. Every completed route preserved the same-state advantage with zero invalid answers and zero hidden-label prompt leaks.

## Controls

- Learner protocol: rule-transfer-novice
- Posttest profile: hard-transfer
- Session limit: 9
- Standard G2 max calls per completed matrix row: 27
- GLM 5.2 regenerated G2 row: 28 calls because one held-out learner call retried after a length/content failure

## Completed Supporting Rows

| Plan | Planner | Learner | Status | Sessions | delta2 | same > different | p | Invalid | Leaks | Artifact |
|---|---|---|---|---:|---:|---:|---:|---:|---:|---|
| frozen_g1 | frozen Codex G1 | claude-code:haiku | pass_g2_independent_outcome | 9 | 0.322 | 9/9 | 0.0020 | 0 | 0 | `exports/yoked-contingency-model-invariance-claude-planner-scaled/g2-runs/frozen-g1__claude-code-haiku.md` |
| frozen_g1 | frozen Codex G1 | claude-code:sonnet | pass_g2_independent_outcome | 9 | 0.389 | 9/9 | 0.0020 | 0 | 0 | `exports/yoked-contingency-model-invariance-claude-planner-scaled/g2-runs/frozen-g1__claude-code-sonnet.md` |
| regenerated_claude-code-sonnet | claude-code:sonnet | claude-code:haiku | pass_g2_independent_outcome | 9 | 0.311 | 8/9 | 0.0195 | 0 | 0 | `exports/yoked-contingency-model-invariance-claude-planner-scaled/g2-runs/regenerated-claude-code-sonnet__claude-code-haiku.md` |
| regenerated_claude-code-sonnet | claude-code:sonnet | claude-code:sonnet | pass_g2_independent_outcome | 9 | 0.445 | 9/9 | 0.0020 | 0 | 0 | `exports/yoked-contingency-model-invariance-claude-planner-scaled/g2-runs/regenerated-claude-code-sonnet__claude-code-sonnet.md` |
| regenerated_openrouter-z-ai-glm-5-2 | openrouter:z-ai/glm-5.2 | openrouter:z-ai/glm-5.2 | pass_g2_independent_outcome | 9 | 0.400 | 9/9 | 0.0020 | 0 | 0 | `exports/yoked-contingency-model-invariance-glm52-planner-scaled/g2-runs/regenerated-openrouter-z-ai-glm-5-2__openrouter-z-ai-glm-5-2.md` |
| frozen_g1 | frozen Codex G1 | codex | pass_g2_independent_outcome | 9 | 0.378 | 9/9 | 0.0020 | 0 | 0 | `exports/yoked-contingency-model-invariance-codex-planner-scaled/g2-runs/frozen-g1__codex.md` |
| regenerated_codex | codex | codex | pass_g2_independent_outcome | 9 | 0.366 | 9/9 | 0.0020 | 0 | 0 | `exports/yoked-contingency-model-invariance-codex-planner-scaled/g2-runs/regenerated-codex__codex.md` |

## Read

Across completed scaled runs, the same-state yoked advantage survives Claude, GLM 5.2, and Codex/OpenAI-family substitutions. This is enough for a bounded paper claim of cross-model robustness across completed routes. It is not evidence for universal model invariance.
