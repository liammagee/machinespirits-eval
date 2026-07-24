---
id: workplan-source-only-generated-views
title: Make feature PRs source-only for generated workplan views
status: done
type: infra
priority: P1
owner: codex
source: manual
created: 2026-07-24
updated: 2026-07-25
verification: "Feature PR CI rejects generated-view diffs while `wp:source-check` and workplan tests pass, and the serialized main renderer regenerates and strictly validates both views."
links:
  notes: workplan/playbook/git-and-workflow.md
  prs:
    - https://github.com/liammagee/machinespirits-eval/pull/207
    - https://github.com/liammagee/machinespirits-eval/pull/209
tags:
  - workplan
  - ci
  - merge-conflicts
  - generated-artifacts
milestone: board-pm
---

Prevent recurring merge conflicts caused by otherwise independent branches
rewriting the shared `workplan/BOARD.md` and `workplan/board.json` aggregates.

Acceptance criteria:

- [x] Feature PR validation checks authored workplan source without requiring
      branch-local generated views to be current.
- [x] PR CI rejects changes to either generated board view by default.
- [x] A clearly labelled exception exists for deliberate renderer migrations.
- [x] A single non-cancelling `main` workflow renders, strictly checks, and
      commits only the generated views after source changes merge.
- [x] Contributor, agent, CLI, and workplan skill guidance all describe the
      source-only contract.
- [x] Focused tests and workflow validation pass.

Review log:

- 2026-07-25 — Rebased onto current `origin/main`; aligned the PR template with
  `wp:source-check`; verified lint, formatting, 15/15 workplan tests, 176/176
  source items, mirrored skills, workflow YAML, and an isolated strict render
  check of both generated views.
- 2026-07-25 — PR #207 merged at `b4e2ea11`; the first serialized main render
  completed successfully and committed current generated views at `c58395c4`.
