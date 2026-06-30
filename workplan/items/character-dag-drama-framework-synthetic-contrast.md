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
    - exports/character-dag-drama-framework-family-controls-mock-v2/robustness-report.md
    - exports/character-dag-drama-framework-family-controls-mock-v2/claim-audit.md
    - exports/character-dag-drama-framework-family-controls-mock-v2/human-pilot-hypotheses.md
    - exports/character-dag-drama-framework-family-controls-real-v2-base/robustness-report.md
    - exports/character-dag-drama-framework-family-controls-real-v2-base/claim-audit.md
    - exports/character-dag-drama-framework-family-controls-real-v2-base/human-pilot-hypotheses.md
  items:
    - dag-resistance-character-state-longitudinal
    - character-dag-drama-transfer-specificity-controls
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

2026-06-30 Codex: Added expanded fixture-family and stronger-control robustness
support. Mock generated-learner screen passes across four fixture families
(`base`, `ratio_series`, `definition_boundary`, `causal_identification`), four
strict perturbations, and seven arms including stale, overconfident, compressed,
and state-without-proof controls. A bounded real generated-learner repair screen
on `base/state_dependent_transfer` passes scenario acceptance and leak guards
and separates full from policy-only, shuffled, stale, overconfident, and
state-without-proof controls, but fails the stronger robustness claim because
`compressed_character_state` ties full at 8/8 first-response and 3/3 transfer.
Decision: do not promote a stronger real claim or update Paper 2.0. Follow-up is
`character-dag-drama-transfer-specificity-controls`: the transfer evidence
contract must require a specific prior condition/check rather than accepting
generic "some condition must hold" reasoning.
