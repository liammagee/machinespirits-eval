---
name: resume-run
description: Resume an incomplete evaluation run — diagnose missing tests, clean empty rows, resume generation, and start judging
argument-hint: <run-id>
disable-model-invocation: true
allowed-tools: Bash, Read, Grep
---

Resume an incomplete evaluation run `$ARGUMENTS`.

## Steps

1. **Diagnose the run** — check what's missing:
   ```bash
   sqlite3 -header -column data/evaluations.db "
     SELECT
       COUNT(*) total,
       COUNT(CASE WHEN suggestions != '[]' AND suggestions IS NOT NULL THEN 1 END) generated,
       COUNT(CASE WHEN tutor_first_turn_score IS NOT NULL THEN 1 END) scored,
       COUNT(CASE WHEN suggestions = '[]' OR suggestions IS NULL THEN 1 END) empty
     FROM evaluation_results WHERE run_id LIKE '$ARGUMENTS%'"
   ```

2. **Check run metadata** for model overrides that need to be preserved:
   ```bash
   sqlite3 data/evaluations.db "SELECT metadata FROM evaluation_runs WHERE id LIKE '$ARGUMENTS%'"
   ```
   Look for `egoModel`, `superegoModel`, `learnerModel` in the metadata JSON — these were the CLI overrides used in the original run. The resume command automatically re-applies them from stored metadata.

3. **Clean empty rows** if there are rows with `suggestions = '[]'`:
   ```bash
   # FIRST: Count exactly how many rows will be deleted
   sqlite3 data/evaluations.db "SELECT COUNT(*) FROM evaluation_results WHERE run_id LIKE '$ARGUMENTS%' AND (suggestions = '[]' OR suggestions IS NULL) AND tutor_first_turn_score IS NULL"
   ```
   **Show the count to the user and ask for confirmation before deleting.**
   ```bash
   sqlite3 data/evaluations.db "DELETE FROM evaluation_results WHERE run_id = '<exact-run-id>' AND (suggestions = '[]' OR suggestions IS NULL) AND tutor_first_turn_score IS NULL"
   ```
   CRITICAL: Use the **exact run ID** (not LIKE) for the DELETE. Never use wildcard patterns in DELETE statements.

4. **Resume generation**:
   ```bash
   node scripts/eval-cli.js resume <runId> --skip-rubric [--parallelism N]
   ```
   The resume command detects missing attempts from the original run plan and re-runs only those.

5. **Start judging** (can run in parallel with generation once first rows land):
   ```bash
   node scripts/eval-cli.js evaluate <runId> --follow
   ```
   `--follow` polls for new rows and judges them as they appear.
   Do NOT use `--force` unless the user explicitly wants to re-score existing rows.

6. **Verify completion**:
   ```bash
   sqlite3 -header -column data/evaluations.db "SELECT profile_name, COUNT(*) n, COUNT(tutor_first_turn_score) scored FROM evaluation_results WHERE run_id LIKE '$ARGUMENTS%' GROUP BY profile_name"
   ```

## Critical safety notes
- **NEVER use LIKE/wildcard patterns in DELETE** — enumerate exact run IDs
- Always show row counts and confirm with user before any DELETE
- Resume automatically re-applies model overrides from stored metadata (fixed Feb 23)
- `--force` on resume means "re-generate even existing attempts" (rarely needed)
- `evaluate --force` is destructive — it overwrites existing scores including cross-judge data
- If the run has multiple judge models, be explicit about which judge to use with `--judge`
