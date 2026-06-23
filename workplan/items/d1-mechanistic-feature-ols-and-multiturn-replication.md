---
id: d1-mechanistic-feature-ols-and-multiturn-replication
title: D1. Mechanistic feature OLS and multi-turn replication
status: done
type: research
priority: P2
owner: codex
source: todo
created: 2026-06-23
updated: 2026-06-23
verification: Reran D1 Pass 6 OLS, Pass 7 multi-turn scope replication, and
  cross-judge checks; exports and notes/d1-paper-integration.md are present.
branch: codex/d1-mechanistic-feature-ols
claim_status: settled
links:
  notes:
    - TODO.md#D1
    - notes/d1-paper-integration.md
  exports:
    - exports/d1-structural-features.md
    - exports/d1-structural-features-v2.md
    - exports/d1-structural-features-v3.md
    - exports/d1-cross-judge-replication.md
    - exports/d1-multifeature-ols.md
    - exports/d1-ends-question-replication.md
  paper: docs/research/paper-full-2.0.md §7.10.1
  atlas: recognition-calibration
  runs:
    - eval-2026-04-24-e9a785c0
    - eval-2026-04-23-42e7acbe
    - eval-2026-04-17-c92ad6c7
    - eval-2026-04-17-6766015b
    - eval-2026-02-20-0fbca69e
    - eval-2026-03-01-aea2abfb
tags:
  - d1
  - mechanism
  - structural-features
  - ols
  - multi-turn
---

TODO §D1 left two concrete analysis passes open after the five-pass sequence: multi-feature OLS over the regex and embedding features, and a multi-turn replication. Both are now closed in the narrower paper-integrated form recorded in `notes/d1-paper-integration.md`: Pass 6 shows the ends-with-question partial coefficient survives multivariate control in the two intersubjective cells, and Pass 7 shows the surface feature is single-turn-specific and reverses sign in multi-turn final-turn contexts. The richer learner-echo / prior-turn acknowledgement trace analysis is not claimed here because this checkout does not contain the dialogue logs needed for that feature family.

2026-06-23 Codex: Reran `node scripts/analyze-d1-multifeature-ols.js`, `node scripts/analyze-d1-ends-question-replication.js`, and `node scripts/analyze-d1-cross-judge-replication.js` against the local symlinked evaluation DB plus warm embedding cache. Paper 2.0 already contains the integrated result in §7.10.1 and revision v3.0.54. White-box activation work remains future/toolchain-dependent and should get a separate item only if an open-weights interpretability setup is actually chosen.
