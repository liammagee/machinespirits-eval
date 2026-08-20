# Analysis and Results

Read this reference for report-console interpretation, profile discrimination, field/state analysis, cross-run comparison, SQL ingest, or result reporting.

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
- Clue-release pace signals, explicit faster/slower requests, final effective speed, and early/on-time/late release counts.
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
