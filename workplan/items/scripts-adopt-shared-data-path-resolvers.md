---
id: scripts-adopt-shared-data-path-resolvers
title: Move the 52 scripts that build their own data paths onto the shared resolvers
status: triaged
type: infra
priority: P3
owner: unassigned
source: manual
created: 2026-08-08
updated: 2026-08-08
verification: The allowlist in the hardcoded-path guard is empty, and a spot check from a worktree shows each converted script opening the same file the store writes.
claim_status: methods
links:
  items:
    - scripts-hardcoded-data-path-guard
    - eval-db-writer-reader-path-split
tags:
  - infra
  - data-integrity
  - backlog
---

Measured on `origin/main`, 2026-08-08:

- 45 scripts in `scripts/` build `path.join(..., 'data', 'evaluations.db')`
  themselves and import no shared resolver.
- 7 build `path.join(..., 'logs', 'tutor-dialogues')` the same way.

Each one is a script that reads the wrong file when it is run from a worktree.
Most are analysis and report scripts, so the symptom is a report that says it
found no rows rather than an error — the same silence as the original incident.

The work is mechanical but not blind. Readers get
`openEvaluationDbReadonly()`; writers that update existing rows get
`resolveEvaluationDbPath()` with `fileMustExist`; ingest scripts that
legitimately create a fresh database keep creating one. Dialogue-log readers
get `resolveTutorDialoguesDir()`. Do it in batches of five to ten, shrinking
the allowlist in [[scripts-hardcoded-data-path-guard]] with each batch, so a
mistake is confined to one small diff.

Worth doing the ones the sarcasm and charisma-desire report scripts depend on
first — those are the ones paid runs are read through.
