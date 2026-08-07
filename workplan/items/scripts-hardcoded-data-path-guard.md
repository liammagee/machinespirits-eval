---
id: scripts-hardcoded-data-path-guard
title: A test that fails when a script builds its own database or logs path
status: triaged
type: infra
priority: P2
owner: unassigned
source: manual
created: 2026-08-08
updated: 2026-08-08
verification: A new script that writes `path.join(root, 'data', 'evaluations.db')` or `path.join(root, 'logs', 'tutor-dialogues')` fails `npm test`, and the failure message names the resolver to call instead.
claim_status: methods
links:
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
for the database path, 7 for the logs path, counting only files that build a
path and import no shared resolver.
