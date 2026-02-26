---
name: run-eval
description: Run an evaluation with specified cells and handle the full generation + judging pipeline
argument-hint: "<cell-profiles> [--runs N] [--model provider.alias]"
disable-model-invocation: true
allowed-tools: Bash, Read, Grep
---

Run an evaluation pipeline. The user will specify which cells and how many runs.

## Steps

1. **Parse the request**: Identify cell profiles, run count, model overrides, and options.
   - Cell format: `cell_1_base_single_unified`, `cell_5_recog_single_unified`, etc.
   - Model format: dot notation like `openrouter.nemotron` or `openrouter.kimi-k2.5`
   - Options: `--scenario <id>`, `--cluster <name>`, `--parallelism N`, `--live`, `--transcript`

2. **Pre-flight checks**:
   - Verify cells exist: `grep "$CELL_NAME" config/tutor-agents.yaml`
   - Check model availability: `node scripts/test-rate-limit.js <model-alias>`
   - Confirm with user before starting (runs cost API credits)

3. **Run generation** (skip rubric for speed):
   ```bash
   node scripts/eval-cli.js run --profiles <cells> --runs N --skip-rubric [--live]
   ```
   Common options:
   - `--ego-model <ref>` — override tutor ego model only
   - `--superego-model <ref>` — override tutor superego model only
   - `--model <ref>` — override ALL agent models
   - `--learner-model <ref>` — override learner ego + superego uniformly
   - `--scenario <id>` — specific scenario(s)
   - `--cluster <name>` — scenario cluster (single-turn, multi-turn, core, etc.)
   - `--parallelism N` — parallel tests (default: 2)
   - `--live` — stream API calls in real time
   - `--transcript` — write play-format transcript files

4. **Note the run ID** from output, then **start judging**:
   ```bash
   node scripts/eval-cli.js evaluate <runId> --follow
   ```
   CAUTION: Do NOT use `--force` unless the user explicitly asks to re-score existing rows.
   `--force` overwrites existing scores and is destructive to cross-judge data.
   Without `--force`, only NULL-scored rows are evaluated.

5. **Report results** when complete:
   ```bash
   sqlite3 -header -column data/evaluations.db "SELECT profile_name, judge_model, COUNT(*) n, ROUND(AVG(tutor_first_turn_score),1) mean FROM evaluation_results WHERE run_id = '<runId>' AND tutor_first_turn_score IS NOT NULL GROUP BY profile_name, judge_model"
   ```

## Critical notes
- CLI model format is **dot notation**: `openrouter.nemotron`, NOT `openrouter/nemotron`
- CLI uses `--runs` NOT `--repeats`
- Score column: `tutor_first_turn_score` (Turn 0). `overall_score` is deprecated alias.
- Multi-turn runs also have `tutor_last_turn_score` (last turn) and `tutor_development_score`.
- Always confirm cell names and run count with user before executing
- For incomplete runs, use `/resume-run` or: `node scripts/eval-cli.js resume <runId>`
- New cells need registration in `EVAL_ONLY_PROFILES` array in `services/evaluationRunner.js`
- **NEVER use `--force` on runs with multiple judge models** — it silently destroys cross-judge data
