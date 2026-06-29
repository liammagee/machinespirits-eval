# Synthetic Character-DAG Drama Framework

Generated: 2026-06-29T21:00:20.150Z
Fixture: `/Users/lmagee/Dev/machinespirits-eval-dag-resistance-adaptation/config/character-dag-drama-framework.yaml`
LLM mode: `real`
Learner mode: `llm`
Scenes per arm: 6
Seeds per arm: 1

## Claim Boundary

This is a synthetic-only framework benchmark. It tests whether proof-DAG policy, resistance routing, dramatic peripeteia pressure, and evidence-derived character state can coordinate inside the harness. It is not a human learning result and not a claim about real interior states.

## Aggregate Result

| arm | proof | drama | state | shuffled | success | first-response | staged | unresolved | burden | transfer first | peripeteia | character proxy |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| policy only | yes | no | no | no | 3/6 | 2/6 | 2/6 | 3/6 | 5 | 1/1 | 0/0 | 52 |
| full character-DAG drama | yes | yes | yes | no | 4/6 | 3/6 | 1/6 | 2/6 | 3 | 1/1 | 1/1 | 77 |
| shuffled character-state control | yes | yes | no | yes | 3/6 | 2/6 | 2/6 | 3/6 | 5 | 1/1 | 1/1 | 67 |

## Acceptance Gates

- no_target_evidence_label_leak: PASS
- no_public_theory_or_process_leak: PASS
- full_beats_policy_on_first_response: PASS
- full_reduces_policy_followup_or_unresolved_burden: PASS
- full_beats_shuffled_on_first_response: PASS
- full_reduces_shuffled_followup_or_unresolved_burden: PASS
- full_transfer_stronger_than_policy: FAIL
- peripeteia_only_where_required: PASS
- character_development_scores_evidence_bound: PASS

Overall gate status: FAIL

## Interpretation

- `policy_only` is the local repair baseline: it can close scenes, but should need staged follow-up.
- `full_character_dag_drama` is the target mechanism: local repair plus dramatic pressure and longitudinal state.
- `shuffled_character_state` is the negative control for state routing that does not match the current learner.
- `burden` is staged follow-ups plus unresolved scenes, so an arm is not rewarded for failing before a repair prompt can close the scene.
- Character-development proxy scores are structural diagnostics, not LLM-judge rubric scores.
