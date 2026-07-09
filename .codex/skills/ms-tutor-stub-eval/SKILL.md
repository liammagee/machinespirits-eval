---
name: ms-tutor-stub-eval
description: Run, resume, analyze, or configure the tutor-stub detective-world tutor experiments, including human-driven tutor sessions, automated single-learner policy evals, ABM learner panels, field/state reports, register-policy comparisons, multi-eval/cross-run summaries, cross-run field trajectories, and quota/token-failure recovery.
allowed-tools: Bash, Read, Grep, Glob
---

# Tutor Stub Eval

Use this skill for `scripts/tutor-stub.js`, `scripts/run-tutor-stub-auto-eval.js`,
`scripts/run-tutor-stub-qa-matrix.js`, `scripts/run-tutor-stub-abm-panel.js`,
`scripts/analyze-tutor-stub-field-traces.js`, and
`scripts/analyze-tutor-stub-auto-evals.js`.
Work from the repo root.

## Intake

If the user has not supplied enough detail, ask at most 1-3 concise questions.
Use defaults when the user does not answer or asks to "just run it".

Key choices and defaults:

- Mode: `human`, `auto-eval`, `resume`, `abm-panel`, `analyze`, `multi-eval`; default `auto-eval` for comparisons, `human` when the user will play the learner.
- World: default `world_005_marrick`.
- Register policies: default comparison `negative,bland,dynamic,state,field,trajectory,dynamical_system,empirical_dynamical_system,continuous_dynamical_system,continuous_empirical_dynamical_system,random`; focused adaptive comparison `dynamic,state,field,trajectory,dynamical_system,empirical_dynamical_system,continuous_dynamical_system,continuous_empirical_dynamical_system`.
- QA policy suite: `focused` means the seven-policy robust comparison `bland,dynamic,state,field,trajectory,dynamical_system,empirical_dynamical_system`; `full` adds `negative` and `random` controls.
- Trajectory policy: `--register-policy trajectory` leaves `field` unchanged and adds recent finite-difference velocity/slope/acceleration/risk-trend adjustments for benchmarking against `field`.
- Dynamical-system policy: `--register-policy dynamical_system` maps a continuous state/derivative vector through theory priors plus within-dialogue empirical efficacy corrections; `dynamical-system` is accepted as an alias.
- Empirical dynamical-system policy: run `node scripts/build-tutor-stub-register-priors.js` first, then use `--register-policy empirical_dynamical_system` to add cross-run prior corrections; `empirical-dynamical-system` is accepted as an alias.
- Continuous dynamical-system policies: `continuous_dynamical_system` and `continuous_empirical_dynamical_system` keep a nearest `selected_register` for compatibility while passing a weighted `register_vector`/style blend to the tutor; hyphen aliases are accepted. The empirical variant uses the same register-priors file as `empirical_dynamical_system`.
- DAG discourse mode: default `strict_dag` is the proof-audit baseline. Use `--dag-mode human_scaffold` or `--dag-mode defeasible_human_scaffold` when testing the human-facing scaffold that allows ordinary-language warrant framing, side arcs, compressed human inference, and internal proof debt while the strict DAG remains the audit.
- Negative floor: `--register-policy negative` samples only `ironic`, `sarcastic`, and `face_threat`; use it as an explicit lower-bound/control arm, not as recommended pedagogy.
- Automated learner profile: default `diligent`; vary with `--auto-learner-profile-id answer_seeking|skeptical|overconfident|low_agency|memory_limited|premature_closure|proof_skipper|false_memory|contradiction_keeper|affective_resistant|low_trust_skeptic`, or list presets with `--list-learner-profiles`. Built-ins are structured learner-profile contracts (`machinespirits.tutor-stub.learner-profile-contract.v1`) rendered into automated-learner prompts and preserved in report config. The first six are core profiles; the latter six are sharper failure-mode stress profiles.
- Runs: default `3` for baseline comparisons, `5` for focused policy comparisons, `1` for ABM panels.
- Models: default tutor `codex.gpt-5.5`, analysis/classifier/DAG `codex.gpt-5.5`, automated learner `codex.gpt-5.5`.
- Parallelism: default `8` for `auto-eval`; ABM panel is currently serial.
- Turn stopping: default `--turns until-grounded --safety-turns 120`.
- Token cap: default `--max-tokens 4096` for `auto-eval` and resumes to avoid output-limit failures.
- Memory compaction: default on; use `--history-turns 4` to keep only a short raw recent window plus compact state/field/dialogue summaries. Use `--no-memory-summary` only for legacy full-transcript debugging.
- Trace/output dir: default `.tutor-stub-auto-eval/<descriptive-run-id>` for auto-eval, `exports/tutor-stub-abm-panel` for ABM.
- Eval ledger: default `.tutor-stub-auto-eval/ledger.jsonl` plus `.tutor-stub-auto-eval/ledger.md`; this is local/ignored. Use `--no-ledger` to skip. For SQL querying, ingest JSON summaries into `data/evaluations.db` with `npm run tutor:stub:ingest`.
- Debug turn ids: tutor-stub prints `turn id > <run-id>:tNNN` at each learner turn; ask the user for that id when debugging a specific turn.

Do not recommend `codex.mini`, `codex.gpt-mini`, or `codex.gpt-5-mini`; the local
Codex ChatGPT-account route rejects those. Use `codex.gpt-5.5` for CLI-backed
Codex, or `openai.mini` / `openrouter.gpt-mini` for GPT mini.

## Human Learner Session

Use the mnemonic presets for common interactive checks:

```bash
npm run tutor:stub:direct          # no DAG interpretation, human types turns
npm run tutor:stub:direct:mixed    # no DAG interpretation, learner drafts available
npm run tutor:stub:scaffold        # human-facing DAG scaffold, human types turns
npm run tutor:stub:scaffold:mixed  # human-facing DAG scaffold, learner drafts available
```

Use when the user will type learner turns manually:

```bash
npm run tutor:stub -- \
  --world world_005_marrick \
  --dag \
  --tutor-learner-dag \
  --dag-mode defeasible_human_scaffold \
  --register-policy field \
  --cli-effort low \
  --history-turns 4 \
  --max-tokens 4096
```

Useful variants:

- Add `--resume-last` to continue the latest dialogue in the trace dir.
- Add `--register-policy bland` for a non-dynamic-feeling baseline.
- Add `--model`, `--classifier-model`, `--learner-record-model`, or
  `--auto-learner-model` only when overriding the default `codex.gpt-5.5`.
- Add `--multiple-choice` only when explicitly requested.
- Add `--mixed-learner` for manual play with a prefetched learner draft after
  each tutor turn. Press Tab on an empty learner prompt to insert the draft for
  editing, or use `/suggest`, `/use`, `/regen`.
- Use slash commands during a run: `/analysis`, `/field`, `/viz`, `/clarify [phrase]`,
  `/explain [phrase]`, `/suggest`, `/use`, `/regen`, `/quit`.

## Automated Single-Learner Eval

Use for policy comparisons with one generic automated learner:

```bash
npm run tutor:stub:auto-eval -- \
  --runs 3 \
  --policies negative,bland,dynamic,state,field,trajectory,dynamical_system,empirical_dynamical_system,continuous_dynamical_system,continuous_empirical_dynamical_system,random \
  --parallelism 8 \
  --progress-interval 30 \
  --turns until-grounded \
  --safety-turns 120 \
  --auto-learner-profile-id diligent \
  --world world_005_marrick \
  --dag-mode strict_dag \
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
  --policies dynamic,state,field,trajectory,dynamical_system,empirical_dynamical_system,continuous_dynamical_system,continuous_empirical_dynamical_system \
  --parallelism 8 \
  --progress-interval 30 \
  --turns until-grounded \
  --safety-turns 120 \
  --world world_005_marrick \
  --dag-mode strict_dag \
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

Build/update repository-informed register priors before using
`empirical_dynamical_system`:

```bash
npm run tutor:stub:register-priors -- \
  --out .tutor-stub-auto-eval/register-empirical-priors.json
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

## Reproducible Policy x Learner QA Matrix

Use when the user wants the difference between policies to be robust across
automated learner types, or wants a comprehensive QA environment rather than a
single-policy/single-learner report. The runner writes `qa-plan.json` first,
then one normal auto-eval report per learner profile, then consolidated
`qa-matrix.md` and `qa-matrix.json` robustness reports.

Dry-run the full command expansion first:

```bash
npm run tutor:stub:qa -- --suite focused --runs 1 --dry-run
```

Run the focused seven-policy QA matrix:

```bash
npm run tutor:stub:qa -- \
  --suite focused \
  --runs 1 \
  --profiles diligent,answer_seeking,skeptical,overconfident,low_agency,memory_limited \
  --turns until-grounded \
  --safety-turns 120 \
  --parallelism 6 \
  --world world_005_marrick \
  --cli-effort low \
  --history-turns 4 \
  --max-tokens 4096 \
  --keep-going
```

Use `--suite adaptive` or `--suite full` to include `continuous_dynamical_system`
and `continuous_empirical_dynamical_system`. Use `--suite full` when you also
need the `negative` floor and `random` control.
Use `--profile-suite sentinel` for a cheaper profile screen (`diligent`,
`proof_skipper`, `false_memory`, `affective_resistant`) and `--profile-suite
stress` for only the sharper failure-mode profiles. Explicit `--profiles`
overrides the profile suite.
When testing `affective_resistant`, include a pressure arm such as
`--policies field,negative` so the profile has a real interactional trigger.
Use `--from-dir .tutor-stub-auto-eval/qa-matrix-<timestamp>` to rebuild only the
consolidated reports from existing per-learner summaries.

## Profile Discrimination From Compacted Traces

Use this after a sentinel/stress pilot to test whether learner profiles produce
separable behavior. The analyzer reads full JSONL once, emits compacted
behavior-only traces, then computes profile-pair cosine similarity from
classifier labels, scalar scores, DAG counters, and register-field state.

```bash
npm run analyze:tutor-stub-profile-discrimination -- \
  --trace-root .tutor-stub-auto-eval/<qa-or-profile-screen-run> \
  --write-compacted .tutor-stub-auto-eval/<qa-or-profile-screen-run>/compacted-traces \
  --out .tutor-stub-auto-eval/<qa-or-profile-screen-run>/profile-discrimination.md
```

Use `--json` for a machine-readable report. A useful initial gate is average
pairwise cosine `< 0.85` and max similarity to `diligent < 0.90`; if the gate
fails, the profile prompts are probably not yet differentiated enough to justify
larger runs.
Document the learner-profile robustness evidence and interpretation in
`docs/tutor-stub-learner-profile-robustness.md` when profile schemas or gates
change.

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

Use when comparing several ingested DB summaries, `auto-eval-*.json` summaries,
or the local ledger.
This treats each eval as a point in a cross-run field with axes for reliability,
effective grounded closure, coverage, turn efficiency, register diversity, and
leak discipline.

Default mode reads `data/evaluations.db` tutor-stub tables when present, then
supplements from the local ledger and discovered report directories:

```bash
npm run analyze:tutor-stub-auto-evals -- \
  --latest 12 \
  --out .tutor-stub-auto-eval/cross-run-field.md
```

DB-only:

```bash
npm run analyze:tutor-stub-auto-evals -- \
  --latest 12 \
  --no-ledger \
  --no-dir \
  --out .tutor-stub-auto-eval/cross-run-field.md
```

From explicit summary files:

```bash
npm run analyze:tutor-stub-auto-evals -- \
  .tutor-stub-auto-eval/<run-a>/auto-eval-*.json \
  .tutor-stub-auto-eval/<run-b>/auto-eval-*.json \
  --out .tutor-stub-auto-eval/cross-run-field.md
```

Use `--json` for machine-readable output. Use `--policies state,field,trajectory,dynamical_system,empirical_dynamical_system,continuous_dynamical_system,continuous_empirical_dynamical_system,dynamic`
to focus policy rows. Use `--no-db` for a filesystem-only report.

## SQL Ingest

Use when the user wants SQL queries across tutor-stub eval summaries. This writes
namespaced tables into `data/evaluations.db`; it does not force tutor-stub rows
into `evaluation_results`.

```bash
npm run tutor:stub:ingest -- \
  .tutor-stub-auto-eval/<run>/auto-eval-YYYY-MM-DDTHH-MM-SS-sssZ.json
```

Ingest the newest local summaries:

```bash
npm run tutor:stub:ingest -- --latest 12
```

Useful views after ingest:

- `v_tutor_stub_policy_summary`
- `v_tutor_stub_register_effects`
- `v_tutor_stub_turn_training`
- `v_tutor_stub_failures`

SQL coverage includes run/row/policy/register/effectiveness summaries plus
`tutor_stub_turn_frames`, a per-turn table for transition/reward modeling. It
normalizes register vectors, selected registers, learner/DAG/field state,
dynamical state and derivative vectors, transcript text, response metadata, and
next-turn deltas. The full row JSON is still preserved for backward-compatible
reconstruction.

Example:

```bash
sqlite3 data/evaluations.db "
SELECT auto_learner_profile_id, policy, rows, ok_rate, grounded_rate, mean_turns_ok
FROM v_tutor_stub_policy_summary
ORDER BY auto_learner_profile_id, grounded_rate DESC, mean_turns_ok ASC;"
```

## Reading Results

Prefer the latest `auto-eval-*.json` / `.html` in the trace dir. Report:

- `ok/failed`, and whether failures are technical or pedagogical.
- Grounded closure rate, mean turns, mean coverage, missing premise count.
- Per-policy comparison: `negative`, `bland`, `dynamic`, `state`, `field`, `trajectory`, `dynamical_system`, `empirical_dynamical_system`, `continuous_dynamical_system`, `continuous_empirical_dynamical_system`, `random`.
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
- Compare `state`, `field`, `trajectory`, `dynamical_system`, `empirical_dynamical_system`, `continuous_dynamical_system`, and `continuous_empirical_dynamical_system` only against a baseline/control if `bland` or
  `random` is present.
