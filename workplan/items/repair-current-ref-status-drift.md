---
id: repair-current-ref-status-drift
title: Refresh ref status and restore green main
status: done
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-08-28
updated: 2026-08-28
branch: main
verification: Regenerating the ref registry changes only the expected
  docs/ref-status.md entries, npm run refs:check passes, and the resulting main
  workflow is green without altering managed refs or research claims.
links:
  prs:
    - https://github.com/liammagee/machinespirits-eval/pull/842
  code:
    - docs/ref-status.md
    - scripts/ref-governance.js
tags:
  - refs
  - ci
  - maintenance
---

The current `main` workflow is red only because the generated managed-ref
registry is stale after the latest paper checkpoint and merged research work.
Refresh that projection through the existing ref-governance path and verify
that no ref itself is moved, created, or deleted as part of the repair.

## Acceptance

- Run the existing ref renderer and inspect the resulting registry diff.
- Confirm the change contains only the expected current-`main` and managed-tag
  metadata.
- Pass `npm run refs:check` and the source workplan validation required for the
  card-bearing change.
- Confirm the hosted `main` workflow returns green after merge.

## Log

- 2026-08-28: Refreshed remote refs and regenerated the registry through the
  existing renderer. The only registry change is canonical paper version
  `3.0.293` to `3.0.295`; no managed ref changed. Local `refs:check` and
  workplan source validation pass.
- 2026-08-28: Commit `1fd696dd` passed the complete hosted `main` CI,
  validation, workplan, and commit-link workflows. Merged that repair into PRs
  #846, #847, and #848; every applicable hosted check passed and all three PRs
  report a clean merge state.
