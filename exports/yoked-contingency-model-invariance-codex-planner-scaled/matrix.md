# Yoked-contingency model-invariance matrix

Generated: 2026-06-25T00:42:23.383Z
Status: pass_model_invariance_matrix

Boundary: model-invariance follow-up only; failures are boundary evidence until replicated at scaled N and integrated into paper-full-2.0.md.

## Five-step protocol

1. Keep the frozen G1 plan artifact as a condition.
2. Re-run G2 with held-out learner model variants.
3. Optionally regenerate G1 plans with non-Codex planners.
4. Use the same hard-transfer, rule-transfer endpoint and require same-state > different-state.
5. Record non-passes as boundary evidence.

## Controls

- Learner protocol: rule-transfer-novice
- Posttest profile: hard-transfer
- Session limit: 9
- G2 max calls per row: 27

## Rows

| Plan | Learner | Boundary class | Status | Sessions | delta2 | same > different | Invalid | Leaks |
|---|---|---|---|---:|---:|---:|---:|---:|
| frozen_g1 | codex | supports_invariance_endpoint | pass_g2_independent_outcome | 9 | 0.378 | 9 | 0 | 0 |
| regenerated_codex | codex | supports_invariance_endpoint | pass_g2_independent_outcome | 9 | 0.366 | 9 | 0 | 0 |

## Read

Every matrix row preserved the same-state advantage on the frozen endpoint.
