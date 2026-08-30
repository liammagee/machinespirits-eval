# Automated Runs and Recovery

Read this reference for single-learner auto-eval, failed-row recovery, ABM panels, or reproducible policy-by-learner QA matrices.

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
  --cli-effort medium \
  --history-turns 4 \
  --max-tokens 4096 \
  --model-call-budget 120 \
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
  --cli-effort medium \
  --history-turns 4 \
  --max-tokens 4096 \
  --model-call-budget 120 \
  --trace-dir .tutor-stub-auto-eval/adaptive-register-policy-p8 \
  --keep-going
```

Always dry-run first when changing model refs, policies, or directories:

```bash
npm run tutor:stub:auto-eval -- --dry-run <same flags>
```

Build/update repository-informed register priors before using
`empirical_dynamical_system`. The builder scans both auto-eval and human
interactive traces by default, deduplicates repeated run/turn observations,
keeps human helpfulness separate from objective DAG/field progress, and marks
corpus corrections ineligible unless they improve a chronological
independent-run holdout. Human preference summaries remain advisory-only:

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
  --model-call-budget 120 \
  --keep-going
```

If failures say `max_tokens or model output limit was reached`, treat a higher
`--max-tokens` value as a prospective configuration amendment, not automatic
technical recovery. `--history-turns 4` can reduce auxiliary analysis prompts
but does not compact tutor or learner speaker history. For quota or network
failures, keep both the token and model-call caps unchanged and recover only
the failed units after the provider route is healthy.

## ABM Learner Panel (Inspection Only)

Validate personas:

```bash
npm run tutor:stub:abm-panel -- --check
```

The current ABM wrapper does not pass `--lab automated_eval` and an explicit
`--model-call-budget` to its child tutor-stub processes. Until that runtime is
hardened and tested, do not use `--live`; the skill supports validation,
dry-run inspection, and summarization only.

Inspect the full 9-persona command plan without model calls:

```bash
npm run tutor:stub:abm-panel -- \
  --dry-run \
  --runs 1 \
  --turns until-grounded \
  --safety-turns 120 \
  --world world_005_marrick \
  --register-policy field \
  --register-palette all \
  --cli-effort medium \
  --keep-going
```

ABM panel output lives under `exports/tutor-stub-abm-panel/<run-id>/`. Rebuild a
panel report from saved artifacts:

The ABM wrapper inherits full speaker-history replay plus tutor-stub's compact
auxiliary-analysis defaults; it does not expose `--history-turns` directly.

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
npm run tutor:stub:qa -- --suite core --runs 1 --dry-run
```

Run the core seven-policy QA matrix:

```bash
npm run tutor:stub:qa -- \
  --suite core \
  --runs 1 \
  --profiles diligent,answer_seeking,skeptical,overconfident,low_agency,memory_limited \
  --turns until-grounded \
  --safety-turns 120 \
  --parallelism 6 \
  --world world_005_marrick \
  --cli-effort medium \
  --history-turns 4 \
  --max-tokens 4096 \
  --model-call-budget 120 \
  --keep-going
```

Use `--suite pressure` for the cheap `field,negative` profile-discrimination
screen. After it passes, pair `--suite sentinel --profile-suite sentinel
--runs 3` for the representative 60-dialogue comparison. Use `--suite
frontier` when comparing `field`, `trajectory`, the
dynamical-system policies, and continuous policies against `bland`. Use
`--suite adaptive` only when you intentionally want adaptive policies without
same-run controls. Use `--suite audit` when you also need the `negative` floor,
`random` control, and every adaptive policy. `focused` aliases `core`;
`full`/`all` alias `audit`.
Use `--profile-suite sentinel` for a cheaper profile screen (`diligent`,
`proof_skipper`, `false_memory`, `affective_resistant`) and `--profile-suite
stress` for only the sharper failure-mode profiles. Use `--profile-suite audit`
only for an intentional all-profile sweep; `all` is a backward-compatible alias.
Explicit `--profiles` overrides the profile suite.
When testing `affective_resistant`, include a pressure arm such as
`--policies field,negative` so the profile has a real interactional trigger.
Use `--from-dir .tutor-stub-auto-eval/qa-matrix-<timestamp>` to rebuild only the
consolidated reports from existing per-learner summaries.
