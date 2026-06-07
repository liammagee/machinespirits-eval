# T24 Option A v2 Panel Result

Date: 2026-06-05

## Boundary

This is a targeted one-item replay result. It does not claim online tutor adaptation, and it does not claim that all T24 designs are exhausted.

It tests whether the refined broken-rail local device can move from adversarial local-gate survival to blind-panel origin attribution.

Source item:

- `phase2-adaptation-recognition-loop-20260529T023023Z-i01:target-r01:routine:T24`

Replay root:

- `exports/discursive-replay-loops/discursive-replay-loop-t24-option-a-v2-delayed-rail-20260605`

Panel package:

- `exports/discursive-replay-loops/discursive-replay-loop-t24-option-a-v2-delayed-rail-20260605/i01-panel`

Ingested sidecar run id:

- `discursive-replay-loop-t24-option-a-v2-delayed-rail-20260605-i01-panel`

DB ingest check:

- `1` poetics item
- `5` linked critic scores

## Local Gate

The v2 feedback file forced a sharper public sequence:

1. learner first tries the ordinary lower-`4` count rule;
2. the tutor asks the learner to try four quarter tiles;
3. the fourth tile fails outside the three-stop rail;
4. only then does the tutor name the clip-after-three local rule; and
5. the learner reframes count versus unit by citing the rail failure.

Local adversarial checker:

| Field | Score | Threshold | Pass |
| --- | ---: | ---: | --- |
| Public evidence | 0.85 | 0.70 | yes |
| Public causal bridge | 0.85 | 0.85 | yes |
| Device specificity | 0.80 | 0.80 | yes |
| Old-warrant misclassification | 0.90 | 0.70 | yes |
| Tactic selection | 0.85 | 0.70 | yes |
| Learner actional uptake | 0.90 | 0.70 | yes |
| Learner self-reframe | 0.85 | 0.70 | yes |
| Dyadic revision | 0.85 | 0.70 | yes |
| Non-leakage | 0.95 | 0.90 | yes |
| Prose preservation | 0.80 | 0.50 | yes |

Local status: `survivor`.

Advisory warning:

- The rail device is introduced in the scene setup rather than emerging entirely mid-scene. The checker judged this acceptable for counterfactual revision, but it remained a panel risk.

## Blind Panel

Default five-critic panel, run concurrently:

- `qwen/qwen3.7-max`
- `google/gemini-3.5-flash`
- `deepseek/deepseek-v4-pro`
- `anthropic/claude-sonnet-4.6`
- `codex`

Panel summary:

| Source item | Recognition | Peripeteia-origin | Origin counts | Status |
| --- | ---: | ---: | --- | --- |
| `routine / T24` | 4/5 | 0/5 | 4 organic, 1 none | `panel_origin_fail` |

Critic split:

- Organic recognition: Qwen, DeepSeek, Claude, Codex
- Flat / none: Gemini
- Peripeteia-induced: none

## Interpretation

This is a strong negative for the current broken-rail replay family.

The local repair worked in the narrow sense: it produced a visible public counterexample, cleared `device_specificity`, and yielded recognitive form for most blind critics. But the blind panel did not attribute the learner's reframe to the tutor's peripeteia-linked strategic move.

The failure is therefore not "no recognition." It is origin attribution. The panel could read the learner's final reframe as organic movement inside the staged transcript, even though the local checker accepted the causal bridge.

The likely weakness is that the rail is too available as scene furniture. Even when the tutor uses it after the learner's failed four-tile attempt, blind critics can treat the physical apparatus as part of the transcript's ordinary problem setup rather than as evidence that the tutor made a strategic move that induced the reframe.

## Hard Negative Record

Treat `T24 broken-rail replay` as a hard negative for prompt-polish replay continuation:

- Do not keep rerunning the same rail/clip replay as a local wording repair.
- Do not treat local `device_specificity = 0.80` as sufficient origin evidence.
- Use this as another boundary specimen where counterfactual replay can induce recognitive form but fail peripeteia-origin attribution.

This is not a reason to retire T24 as a domain. It is a reason to stop treating an edited public transcript with pre-staged apparatus as enough.

## Next Design Requirement

A future T24 attempt should be fresh generation, not another replay polish.

The device must be part of the dramatic action, not just the set. The tutor's public move should visibly select or alter the available test after the learner's old warrant fails, so that the critic can attribute the learner's reframe to the tutor's strategic move rather than to ordinary use of already-present materials.

Candidate design constraint:

> The learner's old lower-`4` rule first succeeds far enough to become accountable, then fails against a public obstruction. The tutor must then introduce, select, or transform a test that was not already functioning as the scene's default apparatus. The learner's final reframe must cite that tutor-selected test as the reason the old rule became unavailable.

Operational stop rule:

- No more panel runs for the broken-rail replay family.
- Next paid panel should require a fresh-generation artifact that passes the same local gate and avoids scene-initial device availability as the origin risk.
