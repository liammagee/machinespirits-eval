# A17 D5 redacted-control run4 gate

Date: 2026-06-24
Branch: `codex/a17-replay-replication`
Item: `workplan/items/a17-one-side-replay-replication-across-scenes.md`

## Scope

The user approved one explicit paid run of the guarded D5 redacted-control gate:

- Generate one fresh D_OED5 `none` control under the new `withhold_secret`
  policy.
- Verify the generated artifacts record `withhold_secret`.
- Run T1 QA on `none` only.
- Stop before D5 `socratic`, D5 `reveal`, D4 generation, grading, or replay.

## Command Run

```bash
A17_PAID_GATE_APPROVED=YES npm run poetics:a17-redacted-control-gate -- --approve-paid
```

## Artifacts

- `exports/a17-one-side-replay-replication/d5-redacted-control-run4/sample/none/T01.txt`
- `exports/a17-one-side-replay-replication/d5-redacted-control-run4/key-none.yaml`
- `exports/a17-one-side-replay-replication/d5-redacted-control-run4/director-none.json`
- `exports/a17-one-side-replay-replication/d5-redacted-control-run4/deliberation/none/T01.json`
- `exports/a17-one-side-replay-replication/d5-redacted-control-run4/transcripts/none/T01.public.txt`
- `exports/a17-one-side-replay-replication/d5-redacted-control-run4/qa-oedipus-arms.json`

Prior quarantine roots remain preserved:

- `exports/a17-one-side-replay-replication/d5-run1/`
- `exports/a17-one-side-replay-replication/d5-run2/`
- `exports/a17-one-side-replay-replication/d5-control-gate-run3/`

## T1 QA Result

The tutor-control invariant passed:

```json
{
  "sampleRoot": "exports/a17-one-side-replay-replication/d5-redacted-control-run4",
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

Interpretation: the redacted `withhold_secret` control solved the prior tutor
contamination problem for this D5 draw. The panel reached the required 3-of-4
withheld consensus, so this is the first successful D5 `none` T1 gate in the
A17 sequence.

## Quality Gate Result

The scene is still not safe for scoring or replay. `key-none.yaml` records:

- `tutor_adaptation_policy: withhold_secret`
- `quality_status: review_before_scoring`
- `quality_warning_count: 1`
- `quality_blocking_warning_count: 1`
- warning code: `no_cue_reframe_leakage`
- recommended action:
  `regenerate_no_cue_arm_or_move_item_to_boundary_suite_before_scoring`

This means the tutor withheld the secret, but the learner independently
self-reframed in the no-cue branch. That does not invalidate the T1 tutor
withholding result, but it does quarantine the scene before original grading,
learner-side replay, or paper claim updates.

After observing this result, `scripts/run-a17-redacted-control-gate.js` was
tightened so future runs fail before QA whenever the generated control is
quality-gated as `review_before_scoring`.

## Usage Evidence

The saved `none` branch deliberation trace records aggregate generation usage
of 102118 input tokens, 8326 output tokens, and 574665 ms summed per-call
latency. The console reported 5m18s generation wall time. The scripts did not
persist a dollar total or QA judge-call usage totals.

## Stop Decision

Execution stopped after the scoped gate. No D5 `socratic` or `reveal` arm, D4
scene, original graded scoring, learner replay, replay scoring, or paper update
was run.

A17 remains unanswered. The next decision is not another automatic paid step:
either explicitly approve a fresh redacted D5 control variation, or close A17
as a methods finding about the instability of D5 no-cue controls.
