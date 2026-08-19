---
name: ms-resume-run
description: Resume an incomplete evaluation run — preserve prior attempts, regenerate only missing or failed units, and continue judging
argument-hint: <run-id>
disable-model-invocation: true
---

Resume an incomplete evaluation run `$ARGUMENTS`.

## Steps

1. **Resolve the exact run id and diagnose what's missing**:
   ```bash
   sqlite3 -header -column data/evaluations.db "
     SELECT
       COUNT(*) total,
       COUNT(CASE WHEN suggestions != '[]' AND suggestions IS NOT NULL THEN 1 END) generated,
       COUNT(CASE WHEN tutor_first_turn_score IS NOT NULL THEN 1 END) scored,
       COUNT(CASE WHEN suggestions = '[]' OR suggestions IS NULL THEN 1 END) empty
     FROM evaluation_results WHERE run_id = '<exact-run-id>'"
   ```

2. **Check run metadata** for model overrides that need to be preserved:
   ```bash
   sqlite3 data/evaluations.db "SELECT metadata FROM evaluation_runs WHERE id = '<exact-run-id>'"
   ```
   Preserve `modelOverride`, `tutorModelOverride`, `egoModelOverride`,
   `superegoModelOverride`, `learnerModelOverride`, `learnerEgoModelOverride`,
   and `learnerSuperegoModelOverride`. The resume command re-applies them.

3. **Preserve every prior attempt.** Do not delete empty or failed rows merely to
   make resume work. The attempt-aware runtime ignores `success = false` rows
   when computing completion and regenerates only their missing attempt indexes.

4. **Resume generation**:
   ```bash
   node scripts/eval-cli.js resume <runId> --skip-rubric [--parallelism N]
   ```
   The resume command detects missing attempts from the original run plan and
   re-runs only those. Its `--force` flag only bypasses the live-PID guard; it
   does not mean "regenerate completed attempts".

5. **Start judging** (can run in parallel with generation once first rows land):
   ```bash
   node scripts/eval-cli.js evaluate <runId> --follow
   ```
   `--follow` polls for new rows and judges them as they appear.
   Do NOT use `--force` unless the user explicitly wants to re-score existing rows.

6. **Verify completion**:
   ```bash
   sqlite3 -header -column data/evaluations.db "SELECT profile_name, COUNT(*) n, COUNT(tutor_first_turn_score) scored FROM evaluation_results WHERE run_id = '<exact-run-id>' GROUP BY profile_name"
   ```

## Critical safety notes
- Use the exact run id for diagnosis and mutation; never use a wildcard target.
- Resume automatically re-applies model overrides from stored metadata.
- Under standing bounded technical recovery authority, do not request another
  approval when source, model/provider, study/profile/seed/configuration/rubric,
  data scope, and attempt/spend ceiling are unchanged. Stop on a repeated same
  failure, a likely code defect, or any boundary change.
- `--force` on resume bypasses an existing-process check and can cause duplicate
  workers; use it only after proving the recorded PID is stale.
- `evaluate --force` is destructive — it overwrites existing scores including cross-judge data
- If the run has multiple judge models, be explicit about which judge to use with `--judge`
