---
name: ms-tutor-stub-eval
description: Run, resume, analyze, or configure the tutor-stub detective-world tutor experiments, including human-driven tutor sessions, automated single-learner policy evals, ABM learner panels, field/state reports, register-policy comparisons, multi-eval/cross-run summaries, cross-run field trajectories, and quota/token-failure recovery.
allowed-tools: Bash, Read, Grep, Glob
---

# Tutor Stub Eval

Use this skill for `scripts/tutor-stub.js`, `scripts/run-tutor-stub-auto-eval.js`,
`scripts/run-tutor-stub-abm-panel.js`, `scripts/analyze-tutor-stub-field-traces.js`,
and `scripts/analyze-tutor-stub-auto-evals.js`.
Work from the repo root.

## Intake

If the user has not supplied enough detail, ask at most 1-3 concise questions.
Use defaults when the user does not answer or asks to "just run it".

Key choices and defaults:

- Mode: `human`, `auto-eval`, `resume`, `abm-panel`, `analyze`, `multi-eval`; default `auto-eval` for comparisons, `human` when the user will play the learner.
- World: default `world_005_marrick`.
- Register policies: default comparison `bland,dynamic,field,state,random`; focused adaptive comparison `dynamic,field,state`.
- Runs: default `3` for baseline comparisons, `5` for focused policy comparisons, `1` for ABM panels.
- Models: default tutor `openai.mini`, analysis/classifier/DAG `codex.gpt-5.5`, automated learner `openai.mini`.
- Parallelism: default `8` for `auto-eval`; ABM panel is currently serial.
- Turn stopping: default `--turns until-grounded --safety-turns 120`.
- Token cap: default `--max-tokens 4096` for `auto-eval` and resumes to avoid output-limit failures.
- Memory compaction: default on; use `--history-turns 4` to keep only a short raw recent window plus compact state/field/dialogue summaries. Use `--no-memory-summary` only for legacy full-transcript debugging.
- Trace/output dir: default `.tutor-stub-auto-eval/<descriptive-run-id>` for auto-eval, `exports/tutor-stub-abm-panel` for ABM.
- Eval ledger: default `.tutor-stub-auto-eval/ledger.jsonl` plus `.tutor-stub-auto-eval/ledger.md`; this is local/ignored and separate from `data/evaluations.db`. Use `--no-ledger` to skip.

Do not recommend `codex.mini`, `codex.gpt-mini`, or `codex.gpt-5-mini`; the local
Codex ChatGPT-account route rejects those. Use `codex.gpt-5.5` for CLI-backed
Codex, or `openai.mini` / `openrouter.gpt-mini` for GPT mini.

## Human Learner Session

Use when the user will type learner turns manually:

```bash
npm run tutor:stub -- \
  --model openai.mini \
  --classifier-model codex.gpt-5.5 \
  --learner-record-model codex.gpt-5.5 \
  --world world_005_marrick \
  --dag \
  --tutor-learner-dag \
  --register-policy field \
  --cli-effort low \
  --history-turns 4 \
  --max-tokens 4096
```

Useful variants:

- Add `--resume-last` to continue the latest dialogue in the trace dir.
- Add `--register-policy bland` for a non-dynamic-feeling baseline.
- Add `--multiple-choice` only when explicitly requested.
- Use slash commands during a run: `/analysis`, `/field`, `/viz`, `/quit`.

## Automated Single-Learner Eval

Use for policy comparisons with one generic automated learner:

```bash
npm run tutor:stub:auto-eval -- \
  --runs 3 \
  --policies bland,dynamic,field,state,random \
  --parallelism 8 \
  --progress-interval 30 \
  --turns until-grounded \
  --safety-turns 120 \
  --model openai.mini \
  --analysis-model codex.gpt-5.5 \
  --auto-learner-model openai.mini \
  --world world_005_marrick \
  --cli-effort low \
  --history-turns 4 \
  --max-tokens 4096 \
  --trace-dir .tutor-stub-auto-eval/baseline-register-policy-p8 \
  --keep-going
```

Focused adaptive comparison:

```bash
npm run tutor:stub:auto-eval -- \
  --runs 5 \
  --policies dynamic,field,state \
  --parallelism 8 \
  --progress-interval 30 \
  --turns until-grounded \
  --safety-turns 120 \
  --model openai.mini \
  --analysis-model codex.gpt-5.5 \
  --auto-learner-model openai.mini \
  --world world_005_marrick \
  --cli-effort low \
  --history-turns 4 \
  --max-tokens 4096 \
  --trace-dir .tutor-stub-auto-eval/adaptive-register-policy-p8 \
  --keep-going
```

Always dry-run first when changing model refs, policies, or directories:

```bash
npm run tutor:stub:auto-eval -- --dry-run <same flags>
```

To add an existing auto-eval summary to the local ledger without re-running
models:

```bash
npm run tutor:stub:auto-eval -- \
  --report-from .tutor-stub-auto-eval/<run>/auto-eval-YYYY-MM-DDTHH-MM-SS-sssZ.json
```

## Resume Failed Auto-Eval Rows

Find the latest summary:

```bash
find .tutor-stub-auto-eval -type f -name 'auto-eval-*.json' -print0 | xargs -0 ls -lt | head
```

Retry only failed rows:

```bash
npm run tutor:stub:auto-eval -- \
  --resume-from .tutor-stub-auto-eval/<run>/auto-eval-YYYY-MM-DDTHH-MM-SS-sssZ.json \
  --resume-statuses failed \
  --parallelism 6 \
  --progress-interval 30 \
  --history-turns 4 \
  --max-tokens 4096 \
  --keep-going
```

If failures say `max_tokens or model output limit was reached`, use compact
memory (`--history-turns 4`, default on) and increase `--max-tokens`. If failures
are quota/network failures, keep the same token cap and rerun after quota/network
recovery.

## ABM Learner Panel

Validate personas:

```bash
npm run tutor:stub:abm-panel -- --check
```

Run the full 9-persona panel once per persona:

```bash
npm run tutor:stub:abm-panel -- \
  --live \
  --runs 1 \
  --turns until-grounded \
  --safety-turns 120 \
  --model openai.mini \
  --analysis-model codex.gpt-5.5 \
  --auto-learner-model openai.mini \
  --world world_005_marrick \
  --register-policy field \
  --register-palette all \
  --cli-effort low \
  --keep-going
```

ABM panel output lives under `exports/tutor-stub-abm-panel/<run-id>/`. Rebuild a
panel report from saved artifacts:

The ABM wrapper currently inherits tutor-stub's compact-memory defaults; it does
not expose `--history-turns` directly.

```bash
npm run tutor:stub:abm-panel -- --summarize exports/tutor-stub-abm-panel/<run-id>
```

## Field/State Analysis

For ordinary tutor-stub traces:

```bash
npm run analyze:tutor-stub-fields -- \
  --traces-dir .tutor-stub-traces \
  --out /tmp/tutor-stub-field-report.md
```

For auto-eval traces with per-job subdirectories, analyze explicit trace files:

```bash
find .tutor-stub-auto-eval/<run>/traces -name '*.jsonl' -print0 \
  | xargs -0 node scripts/analyze-tutor-stub-field-traces.js --out /tmp/tutor-stub-field-report.md
```

## Multi-Eval / Cross-Run Field

Use when comparing several `auto-eval-*.json` summaries or the local ledger.
This treats each eval as a point in a cross-run field with axes for reliability,
effective grounded closure, coverage, turn efficiency, register diversity, and
leak discipline.

From the local ledger:

```bash
npm run analyze:tutor-stub-auto-evals -- \
  --latest 12 \
  --out .tutor-stub-auto-eval/cross-run-field.md
```

From explicit summary files:

```bash
npm run analyze:tutor-stub-auto-evals -- \
  .tutor-stub-auto-eval/<run-a>/auto-eval-*.json \
  .tutor-stub-auto-eval/<run-b>/auto-eval-*.json \
  --out .tutor-stub-auto-eval/cross-run-field.md
```

Use `--json` for machine-readable output. Use `--policies field,state,dynamic`
to focus policy rows.

## Reading Results

Prefer the latest `auto-eval-*.json` / `.html` in the trace dir. Report:

- `ok/failed`, and whether failures are technical or pedagogical.
- Grounded closure rate, mean turns, mean coverage, missing premise count.
- Per-policy comparison: `bland`, `dynamic`, `field`, `state`, `random`.
- Register entropy and dominant registers.
- Bottlenecks: `learner_integration_gap`, `release_or_pacing_gap`, `assertion_gap`, `premature_assertion`, `grounded_asserted_secret`.
- Check `.tutor-stub-auto-eval/ledger.md` for the local cross-run ledger before comparing recent evals.
- For multi-eval comparisons, prefer `npm run analyze:tutor-stub-auto-evals`
  over ad hoc parsing; report the run trajectory and policy field table.

Interpretation guardrails:

- Failed rows are not always pedagogical failures; inspect logs for quota,
  network, unsupported model, and max-token errors.
- `auto_safety_turn_cap` is an incomplete/timeout-like outcome even when row
  status is `ok`.
- Compare `field` and `state` only against a baseline/control if `bland` or
  `random` is present.
