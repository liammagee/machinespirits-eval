# Device-Specificity Rerun Result

Date: 2026-06-05

Run root: `exports/discursive-replay-loops/discursive-replay-loop-device-specificity-rerun-20260605`

Policy memory: `exports/discursive-replay-lessons/device-specificity-rerun-20260605/policy-memory.md`

## Boundary

This is a targeted post-hoc rerun of the remaining `none / T18` failure. It does not change the fixed held-out replay headline of 7/9 strict origin passes, and it does not establish reliable peripeteia-induced adaptation.

The purpose was to test the stricter `device_specificity` local gate before any fresh held-out generation.

## Implementation

The replay harness now includes a scalar `device_specificity` local-gate field. A high score requires the changed public device/test to be visibly necessitated by the obstruction, not merely a useful scaffold.

The ontology now treats this as part of `ms:PublicCausalBridgeEvidence`: `ms:PeripeteiaOriginSurvivor` requires public obstruction, old-check blockage, tutor mechanism change, learner use of the changed test, and non-generic device-specificity evidence.

## Local Runs

| Iteration | Local status | Public causal bridge | Device specificity | Decision |
| --- | --- | ---: | ---: | --- |
| `i01` | `revise_again` | 0.78 | 0.68 | Stopped before panel; source strip still looked generic. |
| `i02` | `survivor` | 0.85 | 0.80 | Panel eligible; used physical arrowhead occlusion and source/tail visibility. |

The `i02` local checker explicitly credited device specificity:

> The revision replaces the prior source strip with physical occlusion: the sleeve covers arrowheads, leaving only source marks and arrow tails visible.

It also retained a residual warning that critics might still see source-first force naming as standard pedagogy.

## Panel Result

Panel package: `exports/discursive-replay-loops/discursive-replay-loop-device-specificity-rerun-20260605/i02-panel`

Ingested sidecar run id: `discursive-replay-loop-device-specificity-rerun-20260605-i02-panel`

| Source item | Recognition | Peripeteia-origin | Origin counts | Status |
| --- | ---: | ---: | --- | --- |
| `none / T18` | 4/5 | 2/5 | 2 peripeteia, 2 organic, 1 none | `panel_origin_fail` |

Critic split:

- Peripeteia-induced: Claude, Codex
- Organic: DeepSeek, Qwen
- Flat / none: Gemini

## Interpretation

The stricter local gate improved the artifact enough to pass local `device_specificity`, but it still failed blind panel origin. This is important negative evidence.

The failure is not simply "no bridge." The public obstruction and device are now visible. The remaining problem is that force-source reasoning is itself a standard domain scaffold. Even when arrowheads are occluded, critics can still read the tutor move as ordinary physics pedagogy rather than a peripeteia-linked strategic reversal that induces the learner reframe.

So the updated conclusion is:

> Public causal bridge and device specificity are necessary pre-panel screens, but not sufficient origin predictors. For T18-like force-source cases, repeated source-strip/source-mark repairs have diminishing returns unless the mechanism changes qualitatively.

## Policy Capture

Negative lessons were captured as policy memory:

- `device-specificity-is-not-origin-sufficient`
- `causal-unavailability-before-device`
- `t18-source-strip-diminishing-returns`

These are stored in:

- `exports/discursive-replay-lessons/device-specificity-rerun-20260605/policy-memory.md`
- `exports/discursive-replay-lessons/device-specificity-rerun-20260605/lessons.json`
- `exports/discursive-replay-lessons/device-specificity-rerun-20260605/lessons.ttl`

## Fresh Batch Decision

The planned fresh held-out batch was not run. The precondition was that the targeted `none / T18` panel pass after the new local gate. It did not pass. Running a fresh batch now would test a mechanism we already know is insufficient.

## Next Move

Stop prompt-polishing `none / T18`. Either retire it as a hard negative stress case for the current replay mechanism, or redesign the scenario mechanism so the old warrant becomes causally unavailable in a way that source-first force naming cannot be read as ordinary stock pedagogy.
