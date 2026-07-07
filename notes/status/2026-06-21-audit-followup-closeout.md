# Audit Follow-up Closeout

Date: 2026-06-21

## Scope

Follow-up work on the repository audit action list:

- fix planning-board drift,
- build Paper 2.0 v3.0.166 PDF,
- run paper validation scripts,
- clean/quarantine stale DB run rows,
- close the poetics archive gap.

## Completed

### Planning-board drift fixed

Updated active planning pointers to the dated-notes model:

- `TODO.md`
- `AGENTS.md`
- `notes/poetics/2026-06-06-development-board.html`

These now agree with `CLAUDE.md`: this fork does not have a live `notes/paper-2-0/BOARD.md`; Paper 2.0 / poetics work lives in dated notes under `notes/poetics/` and `notes/`.

### Poetics archive gap closed

Updated `DRAMATIC-RECOGNITION-PLAN.md` to freeze it as a historical pre-registration / saturation ledger and added:

- `notes/poetics/2026-06-21-poetics-archive-closeout.md`

The closeout explicitly preserves the evidence boundary: production-v1/v2 summary artifacts are summary-only evidence, not a complete raw sample/score/key/transcript archive. Deferred Phase 0 items and shuffled-turn scoring are closed as paper-use gates / future work, not silently completed empirical results.

### Paper PDF built

Built:

- `docs/research/paper-2.0-v3.0.166.pdf`

Observed metadata:

- size: 8.4 MB
- pages: 377
- generated: 2026-06-21 21:23 PDT

The PDF appears to be an ignored/generated artifact rather than a tracked source file.

### Paper validation passed

Ran after the DB cleanup:

```bash
node scripts/validate-paper-manifest.js
node scripts/generate-paper-tables.js
```

Results:

- `validate-paper-manifest.js`: 60 pass, 0 warn, 0 fail
- expected manifest: 52 evaluations, 4,312 scored rows, 4,328 attempts
- all 52 run IDs present in paper
- `generate-paper-tables.js`: prose N-counts consistent, all run IDs present, judge accounting correct
- only warning: the script's "All Data" epoch is cross-rubric and should be used with caution

### Stale DB test rows quarantined

Backed up the SQLite DB before mutation:

- `/Users/lmagee/.machinespirits-data/evaluations.db.backup-20260621-212416-before-stale-run-quarantine`

Strict quarantine target:

- `evaluation_runs.status = 'running'`
- `evaluation_runs.total_tests = 0`
- `evaluation_runs.description = 'storeRejudgment propagation test'`

Actions:

- exported run list to `notes/status/2026-06-21-db-zero-test-running-quarantine.csv`
- exported result-row index to `notes/status/2026-06-21-db-test-result-quarantine-index.csv`
- copied rows into in-DB quarantine tables:
  - `evaluation_runs_quarantine_20260621`: 221 rows
  - `evaluation_results_quarantine_20260621`: 1,544 rows
- deleted those rows from active `evaluation_runs` / `evaluation_results`

Post-cleanup DB state:

- active strict stale test runs: 0
- active strict stale test results: 0
- active zero-test `running` runs: 26
- active `running` runs total: 39

## Residuals

The 26 remaining zero-test `running` rows were not touched because they are not the unit-test leak signature. They include named adaptive/dialogue-engine/debug runs and need an owner decision before cancellation or deeper cleanup.

The pre-existing worktree had unrelated dirty files before this follow-up. This closeout only accounts for the planning docs, poetics closeout docs, PDF generation, validation commands, and DB quarantine work.
