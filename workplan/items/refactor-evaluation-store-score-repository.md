---
id: refactor-evaluation-store-score-repository
title: Extract evaluation score mutation and audit persistence
status: done
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-08-06
updated: 2026-08-06
branch: codex/refactor-evaluation-store-score-repository
verification: >-
  Direct in-memory repository tests and facade regressions preserve every
  mutable evaluation-result score family, append-only change audit, rubric and
  judge provenance, tutor/learner symmetry, package exports, and import-time
  bootstrap while complete hermetic and risk-coverage gates remain green.
claim_status: planned
depends_on:
  - refactor-evaluation-store-result-repository
links:
  notes:
    - docs/next-steps/2026-08-06-evaluation-store-boundary-inventory.md
  code:
    - services/evaluationStore.js
    - services/evaluationStore/scoreRepository.js
    - tests/evaluationRunner.test.js
    - tests/evaluationStoreScoreRepository.test.js
  items:
    - codebase-refactoring-program
    - refactor-evaluation-store-result-repository
    - refactor-evaluation-store-interaction-repository
  prs:
    - https://github.com/liammagee/machinespirits-eval/pull/525
tags:
  - refactoring
  - evaluation
  - persistence
  - scoring
  - provenance
  - symmetry
  - sqlite
  - maintainability
milestone: evaluation-infrastructure
---

Continue R4 step 6 behind immutable result persistence. This slice owns mutable
score state on `evaluation_results` and the append-only `score_audit` history;
interaction CRUD, statistics, exporters, dialogue-log readers, and host startup
remain later owners.

Acceptance:

- Move legacy overwrite, tutor/learner per-turn and holistic scores, public and
  internal dialogue quality, tutor/learner deliberation, process measures,
  charisma, register scoring, id-construction traces, and score-audit reads and
  writes into one repository bound to the migrated connection.
- Keep all five rubric-version resolvers and the clock as explicit injected
  boundaries; introduce no static import cycle or hidden second connection.
- Preserve append-only before/after audit values, operation labels, judge and
  rubric metadata, unchanged-write suppression, run-scoped audit lookup, and
  the deprecated first-turn score alias exactly.
- Preserve tutor/learner per-turn, holistic, and deliberation axes without
  cross-clobbering; pin mirrored deliberation columns and independent rubric
  provenance directly.
- Preserve all 44 named exports, 41 default members, package paths, import-time
  bootstrap behavior, and production database/log isolation.
- Ratchet the facade below 1,250 lines and the score repository below 750 lines;
  add the repository and its direct tests to hermetic and risk coverage.

Log:

- 2026-08-06 — Activated from refreshed `origin/main` at `a458cae6` after PR
  #522 merged. Baseline: `evaluationStore.js` is 1,870 lines; fifteen exported
  score/audit methods plus their private audit helper remain embedded. All move
  together so score writes cannot detach from provenance recording.
- 2026-08-06 — Reached review with all fifteen score/audit operations in a
  728-line injected repository. The unchanged facade surface is 1,214 lines,
  656 fewer than the refreshed-main baseline, while retaining 44 named exports
  and 41 default members. Direct tests pin changed-only audit history,
  run-scoped lookup, legacy overwrite semantics, independent tutor/learner
  per-turn and holistic axes, mirrored deliberation persistence, and every
  encounter/process/charisma/register/id-trace mutation.
- 2026-08-06 — Validation is complete: 137 focused store/provenance tests,
  root shards of 4,399 and 3,494 tests, and tutor-core's 137 tests pass with no
  failures or skips. Evaluation-store risk coverage passes at 91.05% lines,
  67.16% branches, and 89.43% functions; lint, format, manifest, workplan,
  boundary, diff, and zero-cycle gates are green. No model calls or production
  database/log writes were made. Interaction-evaluation persistence is the next
  bounded repository family.
- 2026-08-06 — Opened the reviewed score/audit extraction as PR #525 at
  `b379ffa1`. Activated the interaction-repository child from that exact head;
  it remains independently reviewable and will rebase onto refreshed `main`
  after #525 merges.
- 2026-08-06 — PR #525 merged as `c162fcc6`; score mutation and append-only
  audit persistence is closed. The interaction-repository child rebased with
  its staged work intact onto current `origin/main` at `a410c982`.
