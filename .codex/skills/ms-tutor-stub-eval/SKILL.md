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
- Register policies: default comparison `negative,bland,dynamic,state,field,trajectory,dynamical_system,empirical_dynamical_system,continuous_dynamical_system,continuous_empirical_dynamical_system,random`; adaptive-only comparison `dynamic,state,field,trajectory,dynamical_system,empirical_dynamical_system,continuous_dynamical_system,continuous_empirical_dynamical_system`.
- QA policy suites: `core` is the routine baseline + discrete adaptive comparison (`bland,dynamic,state,field,trajectory,dynamical_system,empirical_dynamical_system`); `controls` is `negative,bland,random`; `pressure` is the cheap `field,negative` screen for pressure-sensitive learner profiles; `sentinel` is the representative five-policy ladder (`bland,field,trajectory,dynamical_system,negative`) for the 60-dialogue sentinel-profile `n=3` comparison; `frontier` adds the richer/continuous state policies against `bland`; `audit` is the expensive all-policy sweep. `focused` aliases `core`; `full`/`all` alias `audit`.
- Trajectory policy: `--register-policy trajectory` leaves `field` unchanged and adds recent finite-difference velocity/slope/acceleration/risk-trend adjustments for benchmarking against `field`.
- Dynamical-system policy: `--register-policy dynamical_system` maps a continuous state/derivative vector through theory priors plus within-dialogue empirical efficacy corrections; `dynamical-system` is accepted as an alias.
- Empirical dynamical-system policy: run `node scripts/build-tutor-stub-register-priors.js` first, then use `--register-policy empirical_dynamical_system` to add cross-run prior corrections; `empirical-dynamical-system` is accepted as an alias.
- Continuous dynamical-system policies: `continuous_dynamical_system` and `continuous_empirical_dynamical_system` keep `selected_register` and `register_vector` as compatibility aliases while using `engagement_stance` and a weighted engagement-stance blend internally; hyphen aliases are accepted. The empirical variant uses the same register-priors file as `empirical_dynamical_system`.
- Engagement-stance temperature: default `0.85`. Use the backward-compatible `--register-temperature <n>` launch flag or `/settings stance-temp <n>` (`/settings temp` remains an alias). Standard semantics apply: lower values sharpen the dominant engagement stance; higher values broaden only that stance distribution. Action family, audience register, lexical accessibility, and scene immersion are deterministic and are never temperature-scaled. The supported range is `0.05` to `3.0`. Live changes invalidate and regenerate mixed suggestion analysis/prefetch state.
- Accumulated DAG-fact dropout: default `0` (off). Use `--dag-fact-dropout <0..1>` and optional deterministic `--dag-fact-dropout-seed <n>`, or change the live rate with `/settings dropout <0..1>`. Only adopted public premises are eligible; background facts are immune; facts receive two grace turns; at most two may be dropped concurrently. A learner can repair a dropped fact by explicitly using or re-adopting it. The public transcript remains intact, exact dropped premise ids stay in technical traces rather than tutor speech, and `0` stops new losses without silently restoring already dropped facts. Live changes invalidate mixed suggestion analysis/prefetch state.
- DAG discourse mode: default `strict_dag` is the proof-audit baseline. Use `--dag-mode human_scaffold` or `--dag-mode defeasible_human_scaffold` when testing the human-facing scaffold that allows ordinary-language warrant framing, side arcs, compressed human inference, and internal proof debt while the strict DAG remains the audit.
- Negative floor: `--register-policy negative` samples only `ironic`, `sarcastic`, and `face_threat`; use it as an explicit lower-bound/control arm, not as recommended pedagogy.
- Automated learner profile: default `diligent`; vary with `--auto-learner-profile-id answer_seeking|skeptical|overconfident|low_agency|memory_limited|premature_closure|proof_skipper|false_memory|contradiction_keeper|affective_resistant|low_trust_skeptic`, or list presets with `--list-learner-profiles`. Built-ins are structured learner-profile contracts (`machinespirits.tutor-stub.learner-profile-contract.v3`) rendered into automated-learner prompts and preserved in report config. The first six are core profiles; the latter six are sharper failure-mode stress profiles.
- Learner profile suites: `core` is the routine robustness suite; `sentinel` is the cheap discrimination screen; `stress` is targeted failure-mode probing; `audit` is the expensive all-profile sweep. `all` remains accepted as an alias for `audit`, but do not use it as the default QA matrix.
- Runs: default `3` for baseline comparisons, `5` for core/frontier policy comparisons, `1` for ABM panels.
- Models: default tutor `codex.gpt-5.6-terra`, analysis/classifier/DAG `codex.gpt-5.6-terra`, automated learner `codex.gpt-5.6-terra`.
- Parallelism: default `8` for `auto-eval`; ABM panel is currently serial.
- Turn stopping: default `--turns until-grounded --safety-turns 120`.
- Token cap: default `--max-tokens 4096` for `auto-eval` and resumes to avoid output-limit failures.
- Memory compaction: default on; use `--history-turns 4` to keep only a short raw recent window plus compact state/field/dialogue summaries. Use `--no-memory-summary` only for legacy full-transcript debugging.
- Trace/output dir: default `.tutor-stub-auto-eval/<descriptive-run-id>` for auto-eval, `exports/tutor-stub-abm-panel` for ABM.
- Eval ledger: default `.tutor-stub-auto-eval/ledger.jsonl` plus `.tutor-stub-auto-eval/ledger.md`; this is local/ignored. Use `--no-ledger` to skip. For SQL querying, ingest JSON summaries into `data/evaluations.db` with `npm run tutor:stub:ingest`.
- Debug turn ids: tutor-stub prints `turn id > <run-id>:tNNN` at each learner turn. `/id` (aliases `/turn-id`, `/debug-id`) repeats the last completed or in-progress id plus the exact JSONL trace path; ask the user to paste that id into Codex when debugging a specific turn.

Do not recommend `codex.mini`, `codex.gpt-mini`, or `codex.gpt-5-mini`; the local
Codex ChatGPT-account route rejects those. Use `codex.gpt-5.6-terra` for CLI-backed
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
  `--auto-learner-model` only when overriding the default `codex.gpt-5.6-terra`.
- Add `--multiple-choice` only when explicitly requested.
- Add `--mixed-learner` for manual play with a prefetched clue-answer pair after
  each tutor turn. Use `/clue` or `/hint` for non-revealing direction, press Tab
  on an empty learner prompt to insert the answer for editing, or use
  `/suggest`, `/use`, `/regen`.
- Mixed suggestions may be questions. The ready line, `/clue`, and `/suggest`
  label the proposed move as `ask a question` or `respond`; question clues say
  what uncertainty to ask about without revealing the exact wording. Tutor
  prompts may invite one concrete in-scene question when clarification is more
  useful than guessing.
- Mixed artifacts also carry a separate `profile_signal`: a short account of
  how the visible draft expresses the active learner profile. The full ready
  notice and compact profile card appear once per active profile; later
  suggestions activate Tab silently so they do not interrupt the dramatic
  flow. `/suggest` and `/use` still expose the profile id, intended pattern,
  and visible expression on demand; only the learner response is inserted or
  spoken, so this metadata does not break the dramatic frame.
- Learner suggestions and clarifications are kept inside the dramatic frame,
  and tutor prompts require the same: generated speech addresses the other
  speaker directly and does not say `the tutor`, `the learner`, `the dialogue`,
  `the prompt`, or that a question is `pending`. Clarification restates the
  live question directly.
- `/explain [phrase]` and natural vocabulary questions such as `what does cupel
  mean?` update a persistent comprehension side-state without advancing the
  learner DAG. Unresolved terms raise `language_opacity` and
  `compression_need`, favour plain/warm explanation, and suppress charismatic
  or negative pressure. A successful gloss marks the term explained while
  retaining recent clarification pressure for the next turn; unresolved and
  explained terms survive memory compaction, traces, resumes, reports, and
  mixed-cache regeneration. Inspect them with `/analysis` or `/analysis
  technical`.
- Tutor response configuration has five independent axes:
  `engagement_stance`, `action_family`, `audience_register`,
  `lexical_accessibility`, and `scene_immersion`. `selected_register` remains a
  backward-compatible alias for `engagement_stance`; it must not be used to
  derive the action family. `child_accessible` audience register requires an
  explicit public age signal—ordinary confusion defaults to `adult_novice`,
  never to child-directed speech. Every completed tutor response stores a
  deterministic surface audit for whether each configured axis became visible
  in the transcript.
- In `defeasible_human_scaffold`, high-confidence adjacent ellipsis such as
  `it will be the same` is resolved against the immediately preceding
  single-referent public question. The strict learner-DAG may retain an audit
  gap, but the spoken tutor must treat that local question as answered. A
  response audit repairs or replaces drafts that merely ask the same question
  again in different words; case-closing/join answers are not compressed this
  way.
- Combined learner-analysis parsing repairs only a bounded one- or two-delimiter
  JSON truncation and promotes known `learner_record` / `register_selection`
  fields if the missing delimiter nested them under `classification`. It still
  rejects unterminated strings, trailing prose, and larger structural repairs.
- DAG-backed dialogues have an explicit closure lifecycle. Strict grounded and
  asserted learner-DAG closure always requires a terminal tutor act. In human
  interactive sessions, a fully released authored tutor DAG also makes
  conversational closure available: if the tutor states the final verdict, it
  must explicitly close the case rather than ask another proof question. The
  tutor may offer exactly one optional learner check-in; its response must end
  the inquiry without another question. `no thanks` closes immediately without
  another model call. Automated eval stopping and grounded-rate metrics remain
  tied to strict learner-DAG closure, not conversational closure.
- Mixed mode also pre-analyzes the exact cached answer in the background. An
  unchanged Tab or `/use` submission reuses that result; edited text or changed
  turn state invalidates it and runs the normal analysis path.
- After that analysis, mixed mode speculatively generates the tutor response on
  a cloned state. It is reused only when the exact rendered classifier,
  learner-DAG, register, scaffold, transcript, and tutor configuration context
  still matches; otherwise the normal tutor call runs. Regeneration, clear,
  turn invalidation, and exit abort stale Codex subprocesses.
- Change the mixed learner interactively with `/profile <id>`. Use `/profile`
  for the current profile, `/profile list` for built-ins, `/profile default` to
  restore the launch-time profile, or `/profile custom <description>` for an
  ad-hoc behavior sketch. Switching aborts and clears the old clue, answer,
  analysis, and prefetched tutor response before regenerating the full chain;
  Tab activates when the replacement answer's ready message appears.
- Use `/profile example` for a copyable custom profile. A useful custom sketch
  names an observable recurring behavior, the situation that triggers it, and
  the tutor support that permits progress, without adding hidden case facts.
  For example:

  ```text
  /profile custom The learner can identify individual clues but struggles to connect them. When asked for a conclusion, they repeat the newest clue. They progress only when the tutor asks them to connect two specific public facts.
  ```
- `/analysis` and `/a` default to a plain policy-centered account of the latest
  learner move, engagement-stance blend, independent action/audience/language/
  scene configuration, main signals, tutor aim, and transcript-visible
  realization count. Use `/analysis technical` or `/a technical` for the
  classifier labels, learner/tutor DAGs, field metrics, stance vectors,
  per-axis realization audit, scaffold audit, leak guard, and trace path.
- `/settings` shows the active policy and engagement-stance temperature.
  `/settings stance-temp 0.4` sharpens subsequent locally selected stance
  distributions; `/settings stance-temp 1.4` broadens them. No other response
  axis is temperature-scaled. Changes are rejected while a tutor turn is in
  progress so each turn has one deterministic setting.
- `/settings dropout 0.15` gives each eligible accumulated public premise a
  seeded 15% per-turn chance of leaving the active learner DAG; `/settings
  dropout 0` disables new losses. Dropout is harness-owned, not a role-play
  instruction, and a visible lapse independently selects the
  `reanchor_public_evidence` action family.
- Interim waiting lines rotate labeled plain-language views such as Tutor
  focus, Evidence pacing, Learner reading, Reasoning state, Tutor style, and
  Clue progress. `view n/N` is a carousel position, not a score; restrained
  color distinguishes phase, view number, and panel category.
- Use slash commands during a run: `/analysis`, `/settings [temp n|dropout n]`, `/field`, `/viz`, `/clarify [phrase]`,
  `/explain [phrase]`, `/id`, `/profile`, `/clue`, `/hint`, `/suggest`, `/use`, `/regen`, `/quit`.

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
  --cli-effort low \
  --history-turns 4 \
  --max-tokens 4096 \
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

## Reading the Report Index Console

Regenerate the console with `node scripts/run-tutor-stub-auto-eval.js --index
--index-root .tutor-stub-auto-eval`; live runners also refresh it on their
progress ticks. On the selected-evaluation card:

- **Status chip**: `running` = a runner wrote `run-state.json` within the last
  15 minutes; `stale` = a runner went quiet mid-plan (check its log under Run
  Operations); `completed` = no active runner, verdicts read the latest saved
  report per profile. Hover the chip for the same explanation in place.
- **Progress strip** (under the card head): `X/Y trials finished (%)`, profile
  completion, per-profile live chips, and last-activity age. A `repair pass`
  chip means a `--resume-from ... --resume-statuses failed` pass: it re-plans
  only previously failed trials, so its denominator is smaller than the
  original grid; earlier finished trials stay on disk and in the report.
- **Verdict banner**: `Outcome achieved` = some arm reached >=95% grounded
  closure and >=95% coverage. `Adaptation advantage not established` = no
  non-baseline policy crossed the evidence thresholds (contingency NMI >=0.05
  with >=6 state-action observations; >=3 scored transitions with positive mean
  reward proxy; benefit >+0.02 vs baseline). While the card is `running` the
  banner carries an explicit interim-read caveat.
- **Evidence numbers** (`contingency` / `benefit` / `positive x% / n`): defined
  in the collapsible "How to read these numbers" guide on the Verdict,
  Profile x Policy, and 3D Lab views. Key trap: `n0` means zero scored
  strategy transitions, i.e. missing evidence, not a measured zero effect.
- **3D Lab safeguard**: verdicts are computed only from the flat 2D numbers;
  the 3D projection re-plots them for cluster-spotting and stays locked until
  every plotted point is inspectable as a 2D row (depth/perspective can make
  weak separation look strong).

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

SQL coverage includes run/row/policy/stance/effectiveness summaries plus
`tutor_stub_turn_frames`, a per-turn table for transition/reward modeling. It
normalizes stance vectors, the legacy selected-register alias, independent
action/audience/lexical/scene fields, response-configuration audits,
learner/DAG/field state, dynamical state and derivative vectors, transcript
text, response metadata, and next-turn deltas. The full row JSON is still
preserved for backward-compatible reconstruction.

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
- Engagement-stance entropy and dominant stances (`register` remains a legacy report label in older artifacts).
- Response-configuration realization rate and pairwise transcript-visible difference rate; `n/a` means the run did not contain two distinct configurations to compare.
- DAG-fact dropout opportunities, drops, re-adoptions, and active dropped facts at the end when `--dag-fact-dropout` is non-zero.
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
