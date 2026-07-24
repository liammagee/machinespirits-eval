---
id: refactor-dialogue-log-fixtures
title: Make dialogue-structure tests hermetic
status: done
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-24
updated: 2026-07-24
verification: >-
  Clean hermetic runs seed tracked dialogue fixtures through EVAL_LOGS_DIR;
  every dialogue-structure group executes without ambient logs or undeclared
  skips; the dialogue-logs-absent ledger entry is removed; and focused plus
  full hermetic parity passes.
branch: codex/refactor-dialogue-log-fixtures
depends_on:
  - refactor-required-run-manifest
  - refactor-v-series-fixtures
links:
  prs:
    - https://github.com/liammagee/machinespirits-eval/pull/192
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  items:
    - codebase-refactoring-program
tags:
  - testing
  - fixtures
  - dialogue-logs
  - hermetic
  - refactoring
milestone: evaluation-infrastructure
---

Bounded R0.3 slice: make the dialogue-structure contract execute from tracked,
synthetic logs in a clean checkout. Do not change runtime trace semantics,
production dialogue logs, evaluator outputs, or historical artifacts.

Acceptance:

- Resolve dialogue logs through `EVAL_LOGS_DIR` in hermetic runs.
- Track the minimum synthetic logs covering multi-agent and single-agent tutors
  plus ego-superego, unified scripted, and unified LLM learner traces.
- Execute every dialogue-structure group without ambient repository logs.
- Remove the `dialogue-logs-absent` allowed-skip entry and its runner fixture.
- Leave production dialogue logs untouched and preserve useful local sampling.
- Pass focused dialogue/runner tests, the full hermetic root phase, lint,
  formatting, and workplan validation without model or API calls.

Log:

- 2026-07-24 — Activated from merged `main` at `a7a7d2b0` after PR #188 closed
  R0.2; scope is frozen to tracked dialogue fixtures, hermetic path resolution,
  and removal of the discharged skip-ledger entry.
- 2026-07-24 — Added three compact synthetic logs covering multi-agent and
  single-agent tutors plus ego-superego, scripted-unified, and LLM-unified
  learners. The structure suite now resolves and seeds them through the
  hermetic `EVAL_LOGS_DIR`, retains bounded local-log sampling outside that
  runner, and no longer emits the discharged dialogue-log skips.
- 2026-07-24 — Local proof is green: the focused dialogue/runner phase passes
  51/51 with zero skips; the full hermetic run passes 6,608/6,609 root tests
  with only the separately declared cast-layer skip, then 133/133 tutor-core
  tests; lint, formatting, and the 165-item workplan check also pass. Moved to
  review pending clean Node 20/22 CI.
- 2026-07-24 — PR #192 exposed a recurring integration failure: the PR template
  placeholder reached the link check unchanged, and rerunning the failed job
  reused its stale event body. Hardened the check to infer only one exact item
  `branch:` match, fail closed on unknown/ambiguous branches or explicit typos,
  and rerun on PR-body edits; the PR body itself now links this item explicitly.
- 2026-07-24 — Closed after PR #192 merged with the clean Node 20/22 matrix;
  stable `main` was synchronized and the merged local branch and worktree were
  removed after ancestry and clean-worktree checks.
