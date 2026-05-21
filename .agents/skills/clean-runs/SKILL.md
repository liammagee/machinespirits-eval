---
name: clean-runs
description: Identify and remove stalled, failed, or test-artifact evaluation runs from the database
argument-hint: "[stalled | artifacts | all]"
allowed-tools: Bash, Read
---

Identify and clean up problematic evaluation runs from `data/evaluations.db`.

Scope is controlled by `$ARGUMENTS`:
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

## Step 4: Confirm and delete

**CRITICAL SAFETY RULES:**
- **NEVER use LIKE or wildcard patterns in DELETE statements** — enumerate exact run IDs
- Always show the exact SQL and affected row counts BEFORE executing
- Ask the user to confirm which runs to delete
- Delete from `evaluation_results` first, then `evaluation_runs`

```bash
# Count result rows that will be deleted (show to user first)
sqlite3 data/evaluations.db "
  SELECT run_id, COUNT(*) AS rows
  FROM evaluation_results
  WHERE run_id IN ('<id1>', '<id2>', '<id3>')
  GROUP BY run_id"
```

Only after user confirms:

```bash
sqlite3 data/evaluations.db "
  DELETE FROM evaluation_results WHERE run_id IN ('<id1>', '<id2>', '<id3>');
  DELETE FROM evaluation_runs WHERE id IN ('<id1>', '<id2>', '<id3>');"
```

## Step 5: Verify

```bash
sqlite3 data/evaluations.db "
  SELECT COUNT(*) AS remaining_runs FROM evaluation_runs WHERE status <> 'completed';
  SELECT COUNT(*) AS total_runs FROM evaluation_runs;
  SELECT COUNT(*) AS total_results FROM evaluation_results;"
```
