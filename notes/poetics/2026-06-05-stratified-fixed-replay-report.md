# Stratified Fixed Replay Result

Date: 2026-06-05

Local artifact: `exports/discursive-replay-loops/discursive-replay-loop-heldout-stratified-fixed-20260605/report.md`

## Boundary

This is a counterfactual replay result, not evidence that the original tutor adapted online. The test asks whether a fixed replay loop can rewrite previously failed public transcripts so blind critics attribute learner recontextualization to a tutor peripeteia-linked strategic move rather than to organic drift.

## Fixed Settings

- Generator: `codex`
- Checker: `adversarial` (`claude` for Codex rewrites)
- Max iterations: 2
- Local gate: enabled
- Blind panel: enabled
- Critics: panel default (`qwen/qwen3.7-max`, `google/gemini-3.5-flash`, `deepseek/deepseek-v4-pro`, `anthropic/claude-sonnet-4.6`, `codex`)
- Recognition threshold: majority
- Origin threshold: majority
- Policy memory: `exports/discursive-replay-lessons/heldout-revise-again-20260605/policy-memory.md`

## Batch

The held-out batch used 9 source items, stratified as 3 `peripeteia-only`, 3 `none`, and 3 `routine`, with one each for T15, T18, and T24 where possible. Items already used in prior replay-loop manifests were excluded.

All selected originals failed strict origin at baseline.

## Result

| Metric | Baseline originals | Final replay state |
| --- | ---: | ---: |
| Recognition majority | 0/9 | 9/9 |
| Strict peripeteia-origin pass | 0/9 | 7/9 |
| Final pending at cap | n/a | 2/9 |

By condition:

| Condition | N | Baseline strict pass | Final recognition pass | Final strict pass |
| --- | ---: | ---: | ---: | ---: |
| `peripeteia-only` | 3 | 0/3 | 3/3 | 3/3 |
| `none` | 3 | 0/3 | 3/3 | 2/3 |
| `routine` | 3 | 0/3 | 3/3 | 2/3 |

The two final capped failures were:

- `phase2-adaptation-recognition-loop-20260527T044802Z-i02:target-r01:none:T18`
- `phase2-adaptation-recognition-loop-20260527T044802Z-i01:target-r01:routine:T15`

Both reached 5/5 recognition in their final panel pass, but failed origin attribution. The failures therefore localize to the public causal bridge from tutor move to learner reframe, not to recognitive form as such.

## Claim

Supported:

- The fixed replay loop reliably induced recognitive form in this held-out batch.
- Strict peripeteia-origin attribution was achieved in most cases.
- `peripeteia-only` was the cleanest stratum.
- The local gate is not a rubber stamp: all local survivors still faced meaningful blind-panel discrimination.

Not supported:

- Reliable peripeteia-induced adaptation across all held-out strata.
- A claim that two iterations are enough for no-cue/routine stress cases.
- A claim that recognition alone is evidence of peripeteia-origin.

Current bounded claim:

> Under a fixed two-iteration replay loop, counterfactual rewrites reliably induce recognitive form in this stratified held-out sample and usually induce panel-attributed peripeteia-origin, but origin attribution remains a separate and stricter mechanism boundary.

## Next Move

Do not tune the two final failures directly. Compare the public causal bridge in the 7 strict passes against the 2 organic failures, then turn that contrast into a pre-registered bridge criterion before any further generation.
