---
name: ms-run-eval
description: Validate and dry-run a proposed standard eval-cli generation and judging pipeline for specified cells. Paid standard launches are blocked because this runner has no general enforced spend ceiling; use a bounded registered runner or add and test a hard cap first.
---

Prepare and dry-run an evaluation pipeline. Do not start real generation or
judging from this skill.

## Steps

1. **Parse the request**: Identify cell profiles, run count, model overrides, and options.
   - Cell format: `cell_1_base_single_unified`, `cell_5_recog_single_unified`, etc.
   - Model format: dot notation like `openrouter.nemotron` or `openrouter.kimi-k2.5`
   - Options: `--scenario <id>`, `--cluster <name>`, `--parallelism N`, `--live`, `--transcript`

2. **Pre-flight checks**:
   - Run `node scripts/eval-cli.js validate-config` with temporary
     `EVAL_DB_PATH` and `EVAL_LOGS_DIR`; the CLI initializes a store even for
     validation. Canonical `cell_*` names are derived from
     `config/tutor-agents.yaml`, not maintained in a second list.
   - Resolve model references from `config/providers.yaml`. For a new exploratory
     run, use a current `provider.alias`; for a reproduction, registered study, or
     resumed run, preserve the recorded model exactly even if a newer model exists.
   - Do not run `scripts/test-rate-limit.js` automatically; it is itself a paid
     provider request and belongs under `$ms-check-models` when explicitly asked.
   - The standard runner has no general fail-before-call spend ceiling. A user
     request can authorize a study but cannot make an unenforced ceiling hard.

3. **Dry-run generation only**:
   ```bash
   eval_sandbox="$(mktemp -d -t machinespirits-eval-dry-run.XXXXXX)"
   EVAL_DB_PATH="$eval_sandbox/evaluations.db" \
   EVAL_LOGS_DIR="$eval_sandbox/logs" \
     node scripts/eval-cli.js run --profiles <cells> --runs N --skip-rubric --dry-run
   ```
   `--dry-run` changes model execution to mock data; the hermetic paths are what
   keep its run/results writes out of the production DB and logs.
   Common options:
   - `--ego-model <ref>` — override tutor ego model only
   - `--superego-model <ref>` — override tutor superego model only
   - `--model <ref>` — override ALL agent models
   - `--learner-model <ref>` — override learner ego + superego uniformly
   - `--scenario <id>` — specific scenario(s)
   - `--cluster <name>` — scenario cluster (single-turn, multi-turn, core, etc.)
   - `--parallelism N` — parallel tests (default: 2)
   - `--live` — changes display/streaming only; it does not distinguish mock
     from real execution and is not a safety gate
   - `--transcript` — write play-format transcript files

4. **Do not start real generation or judging.** To re-enable a paid standard
   launch, the runtime must expose and test a finite fail-before-call ceiling,
   or the request must route through an existing bounded registered runner.

5. **Historical judging command (do not execute from this skill):**
   ```bash
   node scripts/eval-cli.js evaluate <runId> --follow
   ```
   CAUTION: Do NOT use `--force` unless the user explicitly asks to re-score existing rows.
   `--force` overwrites existing scores and is destructive to cross-judge data.
   Without `--force`, only NULL-scored rows are evaluated.

6. **For an already completed run, report stored results read-only:**
   ```bash
   sqlite3 -header -column data/evaluations.db "SELECT profile_name, judge_model, COUNT(*) n, ROUND(AVG(tutor_first_turn_score),1) mean FROM evaluation_results WHERE run_id = '<runId>' AND tutor_first_turn_score IS NOT NULL GROUP BY profile_name, judge_model"
   ```

## Critical notes
- CLI model format is **dot notation**: `openrouter.nemotron`, NOT `openrouter/nemotron`
- CLI uses `--runs` NOT `--repeats`
- Score column: `tutor_first_turn_score` (Turn 0). `overall_score` is deprecated alias.
- Multi-turn runs also have `tutor_last_turn_score` (last turn) and `tutor_development_score`.
- Do not copy a model name from an old skill example or historical run into a new
  run. Read `config/providers.yaml` and the current run/study contract.
- For an incomplete run, use `$ms-resume-run` to diagnose whether its original
  stored mode and ceiling make bounded recovery possible.
- New canonical cells are registered once in `config/tutor-agents.yaml`; the
  profile registry derives them automatically.
- **NEVER use `--force` on runs with multiple judge models** — it silently destroys cross-judge data
