---
id: unify-agent-harness-edit-hooks
title: Share safe edit-hook logic across Claude and Codex
status: review
type: infra
priority: P1
owner: codex
source: review
created: 2026-09-03
updated: 2026-09-03
branch: codex/end-to-end-audit-20260903
verification: "Claude and Codex invoke the same repository-owned edit-hook scripts; worktree, relative-path, non-JavaScript, missing-install, lint-failure, format-repair, and protected-env cases pass in focused tests; both hook JSON files parse and remain provider-neutral."
claim_status: planned
links:
  prs:
    - 983
  items:
    - lint-hook-worktree-node-modules-fallback
  notes:
    - .claude/settings.json
    - .codex/hooks.json
tags:
  - tooling
  - codex
  - claude
  - git-worktrees
  - lint
---

The Claude edit hook contains the repaired worktree-aware lint path, but the
Codex hook still runs a fixed `./node_modules/.bin/eslint` command and refers to
Claude-specific environment and error text. The two inline shell programs can
drift again because there is no shared implementation or parity test.

Move protected-environment checking and post-edit JavaScript lint/format work
into repository-owned scripts. Both harness configurations must call those
same scripts. Preserve the existing worktree behavior: find the nearest ESLint
configuration from the edited file, find an install at or above that root,
skip files outside an ESLint project, format lint-clean JavaScript, and block
only when actual ESLint errors remain. Parse hook input as JSON without
interpolating file paths into a shell command.

2026-09-03 Codex: Implemented one repository-owned hook runner and pointed
both `.claude/settings.json` and `.codex/hooks.json` at it. Focused tests cover
configuration parity, protected environment files, worktree dependency lookup,
metacharacter-bearing filenames, missing installs, format repair, and genuine
lint failures. The full hermetic suite and all maintained risk-coverage groups
pass. Implementation is under review in PR #983.
