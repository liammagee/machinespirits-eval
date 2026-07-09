---
id: tutor-stub-human-discourse-layer
title: "Human discourse layer for tutor-stub proof DAGs"
status: active
type: infra
priority: P1
owner: codex
source: manual
created: 2026-07-09
updated: 2026-07-09
verification: "Tutor-stub supports a labelled human-scaffold DAG mode with trace/report fields for scaffold state, proof debt, side arcs, and warrant/premise stocktake; Marrick dry-run and targeted tests show strict DAG audit remains intact."
claim_status: planned
links:
  notes:
    - docs/tutor-stub-human-discourse-layer.md
  items:
    - continuous-register-policy
    - tutor-stub-transition-reward-model
tags:
  - tutor-stub
  - proof-dag
  - human-scaffold
  - proof-debt
  - side-arcs
---

Package the Marrick/human-user concerns as a first-class tutor-stub architecture
slice rather than a local prompt tweak. The strict proof DAG remains the audit
layer, while a new human discourse layer gives the tutor a forward scaffold,
controlled proof debt, warrant framing, and non-DAG side arcs for clarification
or orientation.

Acceptance:

- Add a labelled DAG mode, initially `human_scaffold` or
  `defeasible_human_scaffold`, without changing current `strict_dag` semantics.
- Project world `dramaturgy.acts`, release schedule, and proof-path structure
  into a human-facing scaffold context: branch, local question, warrant frame,
  and return target.
- Track proof debt separately from strict proof coverage: opened, repaired,
  discharged, and harmful leaps.
- Track warrant and premise stocktake separately from proof debt: explicit
  warrants, implied warrants, explicit public premises, implied premises,
  suppressed/private premises, common-sense bridges, and illicit hidden
  premise candidates.
- Classify side arcs such as language clarification, task clarification,
  orientation, affective repair, method question, and meta request.
- Require every side arc to carry a return contract back to the active branch or
  local evidence question.
- Preserve trace/report/SQL fields for strict DAG coverage, scaffold coverage,
  proof debt, side-arc type, and final closure status.
- Treat obvious public bridges as compressed human reasoning: keep them as
  implied proof debt internally, but ask the learner for explicit warrants only
  when a leap is unsafe, conflicting, or case-closing.
- Update QA guidance so old strict-DAG evals remain a baseline but are not mixed
  naively with human-scaffold runs.

Implementation phases:

1. Done: add data shapes and trace fields for scaffold state, side arcs, and
   proof debt.
2. Done: add data shapes and trace fields for warrant/premise stocktake.
3. Done: add Marrick scaffold projection from existing `dramaturgy.acts` and
   `release_schedule`.
4. Done: extend tutor prompt context with warrant framing and side-arc return
   contracts.
5. Done: extend learner-record extraction to distinguish strict proof adoption
   from provisional scaffold acceptance.
6. Done: update reports, SQL ingest, and QA labels to separate strict and
   human-scaffold metrics.
7. In progress: run targeted tests plus a Marrick mixed/human-scaffold smoke
   before any larger eval comparison.

This item is intentionally breaking for eval comparability. Historical Marrick
strict-DAG runs remain useful as proof-discipline baselines, not as direct
comparators for human-scaffold runs.

Progress log:

- 2026-07-09: Phase 1 implemented trace/report data shapes: `--dag-mode`,
  human-discourse run config, per-turn `humanDiscourseFrame`,
  `scaffoldState`, `sideArc`, `proofDebt`, and `warrantPremiseAudit` records,
  plus dry-run contract tests. Behavior remains unchanged in this phase.
- 2026-07-09: Phases 2-6 implemented: human scaffold modes now project
  dramaturgy/release context into tutor prompts, record provisional
  warrant/premise stocktake, preserve side-arc/proof-debt data in reports and
  SQL ingest, and label auto-eval summaries with `dagMode`. Strict mode remains
  audit-only.
- 2026-07-09: Human-scaffold prompt policy revised for step compression:
  plausible learner leaps now carry implied proof debt internally, while
  explicit warrant prompts are reserved for unsafe, contradictory, hidden, or
  case-closing leaps.
