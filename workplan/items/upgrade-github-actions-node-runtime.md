---
id: upgrade-github-actions-node-runtime
title: Upgrade GitHub Actions to the current JavaScript runtime
status: done
type: maintenance
priority: P2
owner: codex
source: review
created: 2026-08-19
updated: 2026-08-20
verification: "Every repository workflow uses actions/checkout@v7 and actions/setup-node@v7 where applicable; focused workflow-policy, format, and workplan checks pass; hosted CI completes without the deprecated Node 20 action-runtime warning."
branch: codex/upgrade-github-actions-node-runtime
links:
  prs:
    - 698
  items:
    - shorten-full-ci-critical-path
    - decommission-electron-desktop-target
tags:
  - ci
  - github-actions
  - maintenance
---

GitHub now runs the repository's `actions/checkout@v4` and
`actions/setup-node@v4` steps under a forced compatibility runtime because those
action releases target deprecated Node 20. Upgrade only these workflow actions
to their current supported majors; preserve every workflow trigger, path
classifier, checkout option, Node test matrix, cache setting, and command.

Acceptance:

- Replace every `actions/checkout@v4` reference with `actions/checkout@v7`.
- Replace every `actions/setup-node@v4` reference with `actions/setup-node@v7`.
- Make no package-manifest, lockfile, runtime, trigger, test-shard, or cache-policy
  change.
- Pass the existing workflow contract/policy checks and the full hosted lanes
  selected by the workflow-file boundary.

Log:

- 2026-08-19 — Opened after PR #697 closed the CI critical-path card. Official
  action documentation identifies v7 as the current major for both checkout and
  setup-node; this is warning-removal and dependency hygiene, not a claimed CI
  speed improvement.
- 2026-08-19 — Updated all 33 checkout/setup-node references across 11 workflow
  files without changing triggers, inputs, commands, test matrices, or cache
  settings. Workflow YAML parsing, CI-policy and hermetic/surface contract tests,
  changed-file formatting, and source-only workplan validation pass; moved to
  review for the workflow-selected hosted lanes and warning check.
- 2026-08-20 — PR #698 merged the action-runtime upgrade as
  `bb7ec2eb0db25cab3184a6c3bbaaba54346d99cc` after every applicable hosted
  browser, validation, lint, Node 22/24, PTY, and risk-coverage check passed.
  The supported action majors are live on `main`, so this card is done.
