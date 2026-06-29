# DAG/Resistance Character Development Experiment

Generated: 2026-06-29T13:01:07.481Z
LLM mode: `mock`
Scenes per arm: 6

## Claim Boundary

This is a longitudinal simulated-learner mechanism experiment. It tests whether a compact evidence-derived character state can reduce repeated local repair across linked scenes. It is not a human learning-outcome result.
The character-state observer is computed for every arm for comparability, but only the memory arms route that state into later learner responses.
The learner responses in this harness are scripted from the carried character state, and the closed-loop policy realization is programmatic; `llm_mode` records backend selection but is not evidence of unscripted learner behavior.

## Aggregate Result

| arm | state routed | success | first-response success | staged follow-ups | mature first responses | transfer first-response success | final maturity |
|---|---:|---:|---:|---:|---:|---:|---:|
| no-memory baseline | no | 1/6 | 1/6 | 0/6 | 0/6 | 1/1 | 0.667 |
| character-state only | yes | 3/6 | 3/6 | 0/6 | 5/6 | 1/1 | 0.907 |
| v2 policy only | no | 6/6 | 4/6 | 2/6 | 0/6 | 1/1 | 0.787 |
| character-state + v2 policy | yes | 6/6 | 6/6 | 0/6 | 5/6 | 1/1 | 0.907 |

## Interpretation

- `v2_policy_only` can repair each scene locally, but repeated staged follow-ups mean the learner is not becoming more self-directing across scenes.
- `character_state_plus_v2` tests the desired developmental signature: later scenes should need fewer staged follow-ups and more first-response evidence because the learner carries prior evidence forward.
- The transfer scene checks whether the character state generalizes to a novel case rather than only memorizing a single resistance signal.

