---
id: refactor-eval-cli-scoring-commands
title: Extract the eval-cli scoring command family
status: review
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-08-06
updated: 2026-08-06
branch: codex/refactor-eval-cli-scoring-commands
verification: The eval-cli executable is a bounded dispatcher with no scoring logic; evaluate, backfill-first-turn, evaluate-learner, and evaluate-dialogue use explicit bounded owners while tutor/learner symmetry, score shapes, judge and rubric provenance, selection, follow mode, output, errors, and storage writes remain unchanged under exact process parity, focused and zero-skip hermetic, coverage-risk, lint, format, manifest, workplan, and zero-cycle gates plus symmetry review.
claim_status: planned
depends_on:
  - refactor-eval-cli-generation-commands
links:
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - scripts/eval-cli.js
    - scripts/eval-cli/commands/
    - scripts/eval-cli/scoringCommandDependencies.js
    - tests/eval-cli-smoke.test.js
    - tests/evalCliScoringCommands.test.js
    - tests/evaluationScoring.test.js
  items:
    - codebase-refactoring-program
    - refactor-eval-cli-generation-commands
  prs:
    - https://github.com/liammagee/machinespirits-eval/pull/517
tags:
  - refactoring
  - evaluation
  - cli
  - scoring
  - symmetry
  - maintainability
milestone: evaluation-infrastructure
---

Complete R4 step 4 as one ambitious macro slice. Move the four remaining
scoring command cases out of the 3,456-line executable without replacing one
large facade with another oversized owner.

Acceptance:

- Give `evaluate`, `backfill-first-turn`, `evaluate-learner`, and
  `evaluate-dialogue` explicit command owners behind a scoring registry.
- Decompose the roughly 1,900-line `evaluate` path and any other oversized
  path into cohesive parse/selection, execution, follow, scoring, and
  presentation owners; keep every new production module below 500 lines.
- Leave `scripts/eval-cli.js` as a small executable/help/error/dependency
  adapter with no rubric, judge, score aggregation, dialogue projection, or
  persistence orchestration logic.
- Preserve exact arguments, aliases, environment restoration, result
  selection, judge filters/provenance, rubric overrides and cleanup, follow and
  review modes, concurrency, score/storage shapes, stdout/stderr, and exits.
- Preserve bilateral tutor/learner scoring symmetry and all per-turn,
  holistic, public-dialogue, internal-dialogue, deliberation, and development
  paths. Historical label and row compatibility must not change.
- Add registry, facade, size, source, safe process-parity, and symmetry
  ratchets. Tests use hermetic fixtures only and never touch production DBs or
  logs. This structural slice authorizes no paid model calls or empirical
  changes.

Log:

- 2026-08-06 — Activated from `origin/main` at `ec4aa873` after PR #515 merged
  R4 step 4's generation/chat/rejudge slice. Baseline: `eval-cli.js` is 3,456
  lines and its only remaining cases are `evaluate`, `backfill-first-turn`,
  `evaluate-learner`, and `evaluate-dialogue`; together they occupy roughly
  3,070 lines. The macro target is a sub-600-line executable facade with every
  extracted production owner below 500 lines.
- 2026-08-06 — Reached review with all four scoring commands behind one
  registry and sixteen bounded production owners. `eval-cli.js` fell from
  3,456 to 269 lines (3,187 lines, 92.2% removed); across all three R4 command
  slices it is down 6,031 lines (95.7%) from the 6,300-line baseline. The
  largest new owner is 485 lines and the committed size ratchet covers every
  new production module.
- 2026-08-06 — Exact no-call process parity passed ten old/new invocations;
  162 focused scoring/CLI tests and the complete zero-skip hermetic suites
  passed (7,870 root tests and 137 tutor-core tests). Risk coverage, lint,
  format, manifest, workplan source/tests, diff, and zero-cycle gates are
  green. The required symmetry reviewer signed off with no findings across
  tutor/learner per-turn, fallback, holistic, deliberation, persistence,
  compatibility-label, and tutor-only paths. No paid model calls or production
  DB/log writes were made.
- 2026-08-06 — Rebased without conflict onto refreshed `origin/main` at
  `f54785aa`, reran the 162-test focused set and all affected static/workplan
  gates, and opened the reviewed macro slice as PR #517. The final
  implementation commit is `00b2b308` before this PR-link follow-up.
