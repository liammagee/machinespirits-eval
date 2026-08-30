---
name: ms-resume-run
description: Diagnose and, only when the original stored mode and an enforceable attempt ceiling are verified, resume one incomplete standard eval-cli run without overwriting prior attempts. Do not use for tutor-stub studies, completed runs, or new designs.
---

Resume the exact incomplete evaluation run named by the user.

## Steps

1. **Resolve the exact run id and diagnose what's missing**:
   ```bash
   sqlite3 -header -column data/evaluations.db "
     SELECT
       COUNT(*) total,
       COUNT(CASE WHEN success = 1 THEN 1 END) successful_rows,
       COUNT(DISTINCT CASE WHEN success = 1 THEN attempt_index END) successful_attempts,
       COUNT(CASE WHEN tutor_first_turn_score IS NOT NULL THEN 1 END) scored,
       COUNT(CASE WHEN suggestions = '[]' OR suggestions IS NULL THEN 1 END) empty
     FROM evaluation_results WHERE run_id = '<exact-run-id>'"
   ```

2. **Check run metadata** for the original scoring mode, model and judge pins,
   planned attempts, and enforced ceiling:
   ```bash
   sqlite3 data/evaluations.db "SELECT metadata FROM evaluation_runs WHERE id = '<exact-run-id>'"
   ```
   Preserve `skipRubricEval`, `modelOverride`, `tutorModelOverride`, `egoModelOverride`,
   `superegoModelOverride`, `learnerModelOverride`, `learnerEgoModelOverride`,
   `learnerSuperegoModelOverride`, judge configuration, seed, and rubric. The
   resume command re-applies stored runtime state; a new CLI `--skip-rubric`
   flag is ignored and must not be advertised as changing the resume mode.

   Verify any recorded PID is stale before recovery. If the original runner did
   not enforce a finite attempt/spend ceiling, report that live resume is not
   supported from this skill.

3. **Preserve every prior attempt.** Do not delete empty or failed rows merely to
   make resume work. The attempt-aware runtime ignores `success = false` rows
   when computing completion and regenerates only their missing attempt indexes.

4. **Resume the original stored mode** only after those checks:
   ```bash
   node scripts/eval-cli.js resume <runId> [--parallelism N]
   ```
   The resume command detects missing attempts from the original run plan and
   re-runs only those. Its `--force` flag only bypasses the live-PID guard; it
   does not mean "regenerate completed attempts".

5. **Judge separately only when the stored run was generation-only and the user
   has authorized the explicit judge route and ceiling**:
   ```bash
   node scripts/eval-cli.js evaluate <runId> --follow --judge <recorded-judge>
   ```
   `--follow` polls for new rows and judges them as they appear. Do not launch
   it automatically for a resume whose stored mode already included judging.
   Do NOT use `--force` unless the user explicitly wants to re-score existing rows.

6. **Verify completion**:
   ```bash
   sqlite3 -header -column data/evaluations.db "SELECT profile_name, COUNT(*) n, COUNT(tutor_first_turn_score) scored FROM evaluation_results WHERE run_id = '<exact-run-id>' GROUP BY profile_name"
   ```

## Critical safety notes
- Use the exact run id for diagnosis and mutation; never use a wildcard target.
- Resume automatically re-applies model overrides from stored metadata.
- Under standing bounded technical recovery authority, do not request another
  approval when the study design, sealed inputs, model/provider,
  profile/seed/configuration/rubric, data scope, and enforced attempt/spend
  ceiling are unchanged. Record code provenance rather than digest-binding it.
  Stop on repeated failure, an unresolved code defect, or any design, route,
  scope, seed, rubric, budget, or interpretation change.
- `--force` on resume bypasses an existing-process check and can cause duplicate
  workers; use it only after proving the recorded PID is stale.
- `evaluate --force` is destructive — it overwrites existing scores including cross-judge data
- If the run has multiple judge models, be explicit about which judge to use with `--judge`
