---
id: character-dag-drama-framework-synthetic-contrast
title: Character-DAG drama framework synthetic contrast
status: done
type: research
priority: P2
owner: codex
source: manual
created: 2026-06-30
updated: 2026-06-30
verification: "Focused tests, mock strict robustness, and real seeds-3 strict robustness pass; Paper 2.0 §6.8.9 records the exploratory synthetic-only boundary."
branch: codex/dag-resistance-adaptation-framework
claim_status: exploratory
links:
  paper: docs/research/paper-full-2.0.md#689-postscript-from-local-repair-to-longitudinal-character-state-routing
  notes:
    - docs/next-steps/character-dag-drama-framework-plan.md
  exports:
    - exports/character-dag-drama-framework/report.md
    - exports/character-dag-drama-framework-llm-mock/report.md
    - exports/character-dag-drama-framework-llm-real/report.md
    - exports/character-dag-drama-framework-robustness-policy-repair-mock/robustness-report.md
    - exports/character-dag-drama-framework-robustness-policy-repair-real/robustness-report.md
  items:
    - dag-resistance-character-state-longitudinal
tags:
  - dag-resistance
  - character-state
  - drama-machine
  - peripeteia
  - synthetic-learner
  - adaptive-runner
milestone: paper-2-evidence-cleanup
---

Closure card for the synthetic Character-DAG drama framework. The branch extends
the DAG/resistance character-state harness with fixture-driven dramatic phases,
peripeteia checks, typed transfer scenes, shuffled-state controls, and
transcript-backed observer normalization.

2026-06-30 Codex: Fresh real generated-learner contrast passes after
transcript-backed reanalysis (`seeds=2`, 8 scenes, arms `policy_only`,
`full_character_dag_drama`, `shuffled_character_state`). The result is
exploratory and synthetic-only: it tests coordination of proof-DAG policy,
resistance routing, peripeteia pressure, and evidence-derived character state;
it does not claim human learning or real interior character development.

2026-06-30 Codex: Strict robustness screen passes with real generated learners
after targeted state-conditioned transfer/peripeteia repair and observer
normalization (`seeds=3`, perturbations `baseline`, `noisy_openings`,
`harder_transfer`, `state_dependent_transfer`). `full_character_dag_drama`
passes all four perturbations at 21/24 first-response successes, beats
`policy_only` and `shuffled_character_state` on first-response success and
remediation burden, preserves zero target-label/process leaks, and separates
strongly on state-dependent transfer (full 9/9, policy-only 1/9, shuffled 2/9).
Paper 2.0 §6.8.9 now records this as an exploratory synthetic apparatus claim,
not as evidence of human learning, deployed reliability, or real interior
character development.
