---
name: ms-clean-runs
description: Inspect and, only after explicit confirmation, delete stalled or test-artifact evaluation runs from data/evaluations.db. Use for database cleanup; do not use to resume a run, repair scores, or remove failed attempts from a valid run record.
---

Identify and clean up problematic evaluation runs from `data/evaluations.db`.

Scope is controlled by the user's request:
- `stalled` — only runs with status != "completed" (stuck in "running")
- `artifacts` — only completed runs where ALL result rows have empty suggestions (`'[]'`) and zero scored rows
- `all` or empty — both categories
- A specific run ID — inspect and offer to delete that single run

## Step 1: Identify stalled runs

Runs stuck in "running" status with no recent activity:

```bash
sqlite3 -header -column data/evaluations.db "
  SELECT r.id,
    r.status,
    r.created_at,
    r.total_tests,
    COUNT(e.id) AS actual_rows,
    SUM(CASE WHEN e.tutor_first_turn_score IS NOT NULL THEN 1 ELSE 0 END) AS scored,
    SUM(CASE WHEN e.suggestions = '[]' OR e.suggestions IS NULL THEN 1 ELSE 0 END) AS empty_sug,
    substr(r.description, 1, 50) AS description
  FROM evaluation_runs r
  LEFT JOIN evaluation_results e ON r.id = e.run_id
  WHERE r.status <> 'completed'
  GROUP BY r.id
  ORDER BY r.created_at DESC"
```

A run is **stalled** if:
- Status is "running" AND created more than 6 hours ago
- Actual rows < total_tests (incomplete)

## Step 2: Identify test artifacts

Completed runs that produced no useful data:

```bash
sqlite3 -header -column data/evaluations.db "
  SELECT r.id,
    r.created_at,
    r.total_tests,
    COUNT(e.id) AS actual_rows,
    SUM(CASE WHEN e.tutor_first_turn_score IS NOT NULL THEN 1 ELSE 0 END) AS scored,
    SUM(CASE WHEN e.suggestions = '[]' THEN 1 ELSE 0 END) AS empty_sug,
    substr(r.description, 1, 50) AS description
  FROM evaluation_runs r
  LEFT JOIN evaluation_results e ON r.id = e.run_id
  WHERE r.status = 'completed'
  GROUP BY r.id
  HAVING scored = 0 AND (empty_sug = actual_rows OR actual_rows = 0)
  ORDER BY r.created_at DESC"
```

A run is an **artifact** if:
- Status is "completed"
- Zero scored rows AND all suggestions are empty (or no result rows at all)

## Step 3: Present findings

Show the user a table of identified runs, grouped by category (stalled vs artifact). For each run, show:
- Run ID
- Created date
- Rows present / expected
- Scored count
- Description snippet

If a stalled run has scored rows, **flag it** — the user may want to keep those rows or resume instead of deleting.

## Step 4: Preview with the repository deletion path

**CRITICAL SAFETY RULES:**
- Never use raw SQL deletion. `evaluationStore.deleteRun()` owns the
  transaction across run rows, results, interaction evaluations, and audit
  rows.
- Enumerate exact run IDs; never pass a broad text/profile/date filter for the
  destructive invocation.
- Ask the user to confirm which runs to delete
- Prefer resume or scientific closeout for a stalled real run with meaningful
  attempts.

```bash
node scripts/eval-cli.js delete-runs --run-id <id1>,<id2>,<id3>
```

The command is a preview unless `--force` is present. Show its exact targets and
counts, then obtain explicit confirmation. Only after confirmation:

```bash
node scripts/eval-cli.js delete-runs --run-id <id1>,<id2>,<id3> --force
```

## Step 5: Verify

```bash
node scripts/eval-cli.js runs
```

Also verify that the deleted IDs are absent from related DB tables and report
any external transcript/artifact directories separately. The database command
does not imply permission to delete files on disk.
