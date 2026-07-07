# Yoked-contingency GLM 5.2 model-invariance matrix

Generated: 2026-06-25T01:55:58.375Z
Status: pass_completed_glm52_model_invariance

Boundary: the completed GLM 5.2 regenerated planner and learner row preserves the same-state advantage at the scaled endpoint.

## Controls

- Learner protocol: rule-transfer-novice
- Posttest profile: hard-transfer
- Session limit: 9
- Direct regenerated G2 rerun used OPENROUTER_REASONING_EXCLUDE=true, OPENROUTER_MAX_TOKENS=4000, OPENROUTER_TIMEOUT_MS=300000, and G2_HELDOUT_LEARNER_ATTEMPTS=8

## Rows

| Plan | Learner | Boundary class | Status | Sessions | delta2 | same > different | Invalid | Leaks | Artifact |
|---|---|---|---|---:|---:|---:|---:|---:|---|
| regenerated_openrouter-z-ai-glm-5-2 | openrouter:z-ai/glm-5.2 | supports_invariance_endpoint | pass_g2_independent_outcome | 9 | 0.400 | 9/9 | 0 | 0 | `exports/yoked-contingency-model-invariance-glm52-planner-scaled/g2-runs/regenerated-openrouter-z-ai-glm-5-2__openrouter-z-ai-glm-5-2.md` |

## Read

The GLM 5.2 regenerated planner/learner route preserves the same-state advantage at the scaled endpoint.
