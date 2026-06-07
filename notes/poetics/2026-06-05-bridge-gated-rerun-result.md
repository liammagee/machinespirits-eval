# Bridge-Gated Rerun Result

Date: 2026-06-05

Run root: `exports/discursive-replay-loops/discursive-replay-loop-bridge-rerun-local-20260605`

Sidecar run id: `discursive-replay-loop-bridge-rerun-local-20260605-i01-panel`

## Boundary

This is a targeted post-hoc rerun of the two capped failures from the stratified fixed replay. It should not replace the fixed two-iteration held-out headline. The fixed result remains 7/9 strict origin passes. This rerun tests whether the newly formalized public causal bridge criterion can repair the remaining failures before another generation batch.

## Procedure

Two previous panel-origin failures were rerun:

- `phase2-adaptation-recognition-loop-20260527T044802Z-i02:target-r01:none:T18`
- `phase2-adaptation-recognition-loop-20260527T044802Z-i01:target-r01:routine:T15`

Settings:

- Generator: `codex`
- Checker: adversarial (`claude` for Codex rewrites)
- Policy memory:
  - `exports/discursive-replay-lessons/heldout-revise-again-20260605/policy-memory.md`
  - `notes/poetics/2026-06-05-public-causal-bridge-criterion.md`
- Local gate: active, including `public_causal_bridge >= 0.7`
- Blind panel: five critics, majority recognition and majority peripeteia-origin required
- Ingest: completed as replay sidecar data, 2 items and 10 scores

## Local Gate

Both items survived the revised local gate:

| Source item | Gate status | Public causal bridge | Note |
| --- | --- | ---: | --- |
| `none / T18` | `survivor` | 0.85 | Advisory warning only: temporal ledger scope could acknowledge partial learner ownership earlier. |
| `routine / T15` | `survivor` | 0.90 | Advisory warning only: tactic label might be closer to `scope_test` or `mirror_and_extend`. |

This means the new bridge criterion was strong enough to shape generation and pass the adversarial local check, but the blind panel still had to decide whether the bridge was publicly persuasive.

## Blind Panel

| Source item | TID | Recognition | Peripeteia-origin | Status |
| --- | --- | ---: | ---: | --- |
| `none / T18` | T01 | 5/5 | 2/5 | `panel_origin_fail` |
| `routine / T15` | T02 | 5/5 | 3/5 | `panel_pass` |

Critic split:

| Source item | Peripeteia-induced critics | Organic critics |
| --- | --- | --- |
| `none / T18` | Claude, DeepSeek | Codex, Gemini, Qwen |
| `routine / T15` | Claude, Codex, Qwen | DeepSeek, Gemini |

## Interpretation

The bridge gate improved the result but did not solve the mechanism boundary.

The `routine / T15` rewrite passed because the tutor introduced a visibly changed public device: the field frame/window test. That device blocked the old number-shape warrant and let the learner use the changed public field test in the final reframe.

The `none / T18` rewrite still failed origin attribution despite local bridge survival. The source-strip device made the learner's final force-source reframe recognizable, but a majority of critics still read the tutor move as insufficiently origin-producing. The likely weakness is that the source strip can look like a generic scaffold rather than a disruption-forced mechanism change. Codex and Qwen both applied mechanism clamps around stock/device quality, which suggests the local bridge criterion is still too permissive when the introduced device is plausible but not visibly forced by the obstruction.

## Updated Lesson

Public causal bridge is necessary but not yet sufficient. The next stricter subcriterion should ask:

> Does the changed public test make the old warrant fail in a way that a critic can see as unavailable before the tutor's move, or is it merely a better generic scaffold?

For future local checks, a high `public_causal_bridge` score should require not only obstruction -> tutor change -> learner use, but also device specificity: the changed test must be publicly necessitated by the obstruction, not simply pedagogically helpful.

## Current Claim

Supported:

- The bridge criterion can convert at least one capped organic failure into a strict origin pass.
- Recognition remains easy relative to origin: both rerun items reached 5/5 recognition.
- The panel continues to discriminate origin after local bridge survival.

Not supported:

- Reliable repair of all capped organic failures.
- Treating the current local bridge score as a sufficient pre-panel predictor.
- Updating the fixed held-out replay headline from 7/9 to 8/9 without clearly marking this as a targeted post-hoc rerun.

## Next Move

Tighten the local bridge criterion with a `device_specificity` or `non_generic_mechanism` check, then rerun only `none / T18` locally. Do not panel it unless the checker explicitly says the source/test change is publicly necessitated by the obstruction rather than merely a useful scaffold.
