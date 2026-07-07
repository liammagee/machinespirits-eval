# Adaptive DAG/Resistance Follow-Up Synthesis

Generated: 2026-06-29

## Claim

Combined proof-DAG/resistance adaptation fails when closure is a flat conjunctive checklist, but succeeds when the same policy layer uses typed staged closure: proof-core evidence remains required, resistance breakthrough is evaluated as a signal-specific core, and staged follow-ups ask for the missing evidence axis rather than repeating a generic evidence request.

This is a mechanism-wiring claim, not an empirical learning-effect claim. The runs use simulated learner turns; negative controls are fixed shallow replies so false-positive rejection can be checked strictly.

## Replication

Source reports:

- `exports/adaptive-dag-resistance-replication/report.md`
- `exports/adaptive-dag-resistance-replication-real/report.md`

Real replication run: `eval-2026-06-29-bbebc425`, 225 rows, 3 repetitions, standard negative controls.

| arm | positive closure | negatives rejected |
|---|---:|---:|
| `combined_strict` | 1/15 | 60/60 |
| `combined_staged` | 4/15 | 60/60 |
| `combined_staged_v2` | 15/15 | 60/60 |

Interpretation: v2 survives learner-turn variance across three repetitions while preserving zero accidental negative successes. The earlier one-shot `5/5` result is not a lucky draw under this harness.

## Component Ablation

Source reports:

- `exports/adaptive-dag-resistance-component-ablation/report.md`
- `exports/adaptive-dag-resistance-component-ablation-real/report.md`

Real component run: `eval-2026-06-29-b7eb5e86`, 100 rows, standard negative controls.

| arm | positive closure | negatives rejected |
|---|---:|---:|
| `combined_contracts_only` | 0/5 | 20/20 |
| `combined_semantic_only` | 3/5 | 20/20 |
| `combined_followup_only` | 1/5 | 20/20 |
| `combined_staged_v2` | 4/5 | 20/20 |

Interpretation: typed contracts alone do not carry the gain. The semantic observer is the strongest single component, typed follow-up helps weakly by itself, and the full stack remains strongest. The mechanism appears conjunctive: v2 needs semantic observation plus staged typed repair, with the contract schema preventing that observation from becoming loose acceptance.

## Adversarial Negative Controls

Source reports:

- `exports/adaptive-dag-resistance-adversarial-controls/report.md`
- `exports/adaptive-dag-resistance-adversarial-controls-real/report.md`

Real adversarial run: `eval-2026-06-29-d6a4cb23`, 20 rows, strict validation.

| arm | adversarial negatives rejected | accidental successes |
|---|---:|---:|
| `combined_staged_v2` | 20/20 | 0 |

Adversarial controls included fluent empty rationale, fake relevance language, copied task wording, and semantic label salad. The empty-rationale case exposed a mock false positive before the final ledger guard; after adding `empty rationale` to accumulated-success rejection, both mock and real adversarial controls passed strictly.

## Paper-Ready Boundary

A defensible statement is:

> In the controlled DAG/resistance harness, combining proof-DAG constraints with learner-resistance routing is not sufficient under flat conjunctive closure: strict combined closure remained brittle. The combined mechanism became reliable only after closure was typed and staged. Across a three-run real-provider replication, `combined_staged_v2` closed 15/15 positive cases while rejecting 60/60 standard negative controls; a separate adversarial-control run rejected 20/20 harder negatives. Component ablation suggests the semantic observer supplies much of the gain, but only the full typed staged policy retains complete positive closure while preserving strict false-positive rejection.

Open boundary: this still demonstrates mechanism integrity under simulated learner turns, not improved learning outcomes for human learners.
