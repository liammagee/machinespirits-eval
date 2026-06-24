# A17 D5 redacted-control run5 rescue

Date: 2026-06-24
Branch: `codex/a17-replay-replication`
Item: `workplan/items/a17-one-side-replay-replication-across-scenes.md`

## Scope

The user approved one more cheap-screened rescue path for D5. The bounded path
was:

- Generate one fresh D_OED5 `none` control under `withhold_secret`.
- Locally verify the generated key/trace before any QA panel:
  - `tutor_adaptation_policy: withhold_secret`
  - no `review_before_scoring` quality gate
  - no blocking quality warnings
- Spend the QA panel only if the local screen passes.
- Stop before D5 `socratic`, D5 `reveal`, D4 generation, grading, or replay.

## Command Run

```bash
A17_PAID_GATE_APPROVED=YES npm run poetics:a17-redacted-control-gate -- --approve-paid --root exports/a17-one-side-replay-replication/d5-redacted-control-run5 --variation-key a17-d5-redacted-control-run5
```

## Artifacts

- `exports/a17-one-side-replay-replication/d5-redacted-control-run5/sample/none/T01.txt`
- `exports/a17-one-side-replay-replication/d5-redacted-control-run5/key-none.yaml`
- `exports/a17-one-side-replay-replication/d5-redacted-control-run5/director-none.json`
- `exports/a17-one-side-replay-replication/d5-redacted-control-run5/deliberation/none/T01.json`
- `exports/a17-one-side-replay-replication/d5-redacted-control-run5/transcripts/none/T01.public.txt`
- `exports/a17-one-side-replay-replication/d5-redacted-control-run5/qa-oedipus-arms.json`

Prior quarantine roots remain preserved:

- `exports/a17-one-side-replay-replication/d5-run1/`
- `exports/a17-one-side-replay-replication/d5-run2/`
- `exports/a17-one-side-replay-replication/d5-control-gate-run3/`
- `exports/a17-one-side-replay-replication/d5-redacted-control-run4/`

## Local Screen Result

The cheap screen passed:

- `tutor_adaptation_policy: withhold_secret`
- `quality_status: ok`
- `quality_warning_count: 0`
- `quality_blocking_warning_count: 0`
- shared prefix hash: `593d1653b453b399`

This is the first D5 `none` candidate in the A17 sequence that passes both the
redacted tutor-policy check and the no-cue quality gate.

## T1 QA Result

Because the local screen passed, the runner proceeded to the T1 QA panel. QA
also passed:

```json
{
  "sampleRoot": "exports/a17-one-side-replay-replication/d5-redacted-control-run5",
  "allPass": true,
  "results": [
    {
      "arm": "none",
      "invariant": "T1",
      "level": "withheld",
      "pass": true,
      "status": "withheld_ok",
      "detail": "tutor withheld (3/4)",
      "evidence": ""
    }
  ]
}
```

Interpretation: D5 is no longer blocked at the `none` control-admissibility
gate. This does not complete A17, because the run contains only the `none`
branch.

## Usage Evidence

The saved `none` branch deliberation trace records aggregate generation usage
of 107028 input tokens, 10294 output tokens, and 637813 ms summed per-call
latency. The console reported 5m53s generation wall time. The scripts did not
persist a dollar total or QA judge-call usage totals.

## Remaining A17 Constraint

The current paired-continuation generator does not append missing
`socratic`/`reveal` branches from an already saved shared prefix. It generates a
new shared prefix each time `--paired-adaptation-arms ...` is invoked.

Therefore the next paid step needs an explicit decision:

1. Add a small continuation helper that reuses run5's saved prefix/director plan
   and generates matching D5 `socratic`/`reveal` branches from that prefix, then
   proceed to D4, grading, and replays; or
2. Accept a fresh full three-arm D5 redraw under the now-proven cheap-screen
   guard, knowing that it will not be the exact run5 prefix.

No D5 `socratic` or `reveal` arm, D4 scene, original graded scoring,
learner-side replay, replay scoring, or paper update was run in this rescue
step.
