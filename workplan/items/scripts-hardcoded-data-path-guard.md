---
id: scripts-hardcoded-data-path-guard
title: A test that fails when a script builds its own database or logs path
status: done
type: infra
priority: P2
owner: codex
source: manual
created: 2026-08-08
updated: 2026-08-08
branch: codex/scripts-hardcoded-data-path-guard
verification: A new script that writes `path.join(root, 'data', 'evaluations.db')` or `path.join(root, 'logs', 'tutor-dialogues')` fails `npm test`, and the failure message names the resolver to call instead.
claim_status: methods
links:
  code:
    - scripts/check-evaluation-data-paths.js
    - config/evaluation-data-path-allowlist.json
    - tests/evaluationDataPathGuard.test.js
  prs:
    - 572
  items:
    - eval-db-writer-reader-path-split
    - eval-logs-root-single-resolver
tags:
  - infra
  - data-integrity
  - guardrail
---

Both path rules now live in one place each — `resolveEvaluationDbPath` and
`resolveEvaluationLogsRoot` in `services/evaluationDataPaths.js`. Nothing stops
the next script from ignoring them and joining the path by hand, which is
exactly how the worktree incident happened.

The guard is a test that walks `scripts/*.js`, flags any file that builds
either path itself, and holds an allowlist of the files that do it today. New
offenders fail; the allowlist only ever shrinks, and shrinking it is
[[scripts-adopt-shared-data-path-resolvers]].

Two details worth getting right:

- Flag the **constructive** form (`path.join(..., 'data', 'evaluations.db')`),
  not every mention of the string. Help text, comments and default-value
  documentation say `data/evaluations.db` harmlessly.
- Make the failure message say what to call instead. A guard that only says
  "not allowed" gets worked around with a differently-spelled join.

Current size of the allowlist, measured 2026-08-08 on `origin/main`: 45 scripts
construct the database path and 13 construct the logs path. Six do both, so the
union is 52 scripts: the 45 database builders plus seven additional log-only
builders.

## Log

- 2026-08-08 — Reached review with an Acorn-backed constructive-call scanner,
  a shrinking category-specific allowlist, a standalone
  `npm run eval-data-paths:check` command, and a required root test. The
  baseline is 52 unique scripts: 45 construct the database path and 13
  construct the dialogue-log path, with six overlaps and seven additional
  log-only scripts. Detector, allowlist, manifest, lint, formatting, workplan,
  and diff checks pass.
- 2026-08-08 — Closed after PR #572 merged. The guard and its shrinking
  allowlist are on `main`, and every required hosted check passed.
