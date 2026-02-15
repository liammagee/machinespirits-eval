---
name: run-eval
description: Run an evaluation with specified cells and handle the full generation + judging pipeline
argument-hint: "<cell-profiles> [--runs N] [--model provider.alias]"
disable-model-invocation: true
allowed-tools: Bash, Read, Grep
---

Run an evaluation pipeline. The user will specify which cells and how many runs.

## Steps

1. **Parse the request**: Identify cell profiles, run count, and ego model (if specified).
   - Cell format: `cell_1_base_single_unified`, `cell_5_recog_single_unified`, etc.
   - Model format: dot notation like `openrouter.nemotron` or `openrouter.kimi-k2.5`

2. **Pre-flight checks**:
   - Verify cells exist: `grep "$CELL_NAME" config/tutor-agents.yaml`
   - Check model availability: `node scripts/test-rate-limit.js <model-alias>`
   - Confirm with user before starting (runs cost API credits)

3. **Run generation** (skip rubric for speed):
   ```bash
   node scripts/eval-cli.js run --profiles <cells> --runs N --skip-rubric
   ```

4. **Note the run ID** from output, then **start judging**:
   ```bash
   node scripts/eval-cli.js evaluate <runId> --force --follow
   ```

5. **Report results** when complete:
   ```bash
   sqlite3 data/evaluations.db "SELECT tutor_profile, COUNT(*), ROUND(AVG(overall_score),1), ROUND(STDEV(overall_score),1) FROM evaluation_results WHERE run_id = '<runId>' AND overall_score IS NOT NULL GROUP BY tutor_profile"
   ```

## Critical notes
- CLI model format is **dot notation**: `openrouter.nemotron`, NOT `openrouter/nemotron`
- CLI uses `--runs` NOT `--repeats`
- Always confirm cell names and run count with user before executing
- For incomplete runs, use `resume` not `run`: `node scripts/eval-cli.js resume <runId>`
- New cells need registration in `EVAL_ONLY_PROFILES` array in `services/evaluationRunner.js`
