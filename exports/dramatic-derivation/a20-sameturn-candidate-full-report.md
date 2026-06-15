# A20 Same-Turn Assertion Candidate Full Matrix

Date: 2026-06-15

Question: whether the same-turn assertion affordance should be promoted across the current candidate arm set, and whether episode replay can expedite that test.

## Candidate Arm Set

The comparison used the current reliability baseline: static hidden guard plus proof-debt guard. The candidate S1 arm added `--same-turn-assertion-affordance` without changing the selector or hidden/visible routing.

Worlds:

| World | Baseline S0 source | Candidate S1 label |
| --- | --- | --- |
| Withercombe | `withercombe-selector-v4-isolation-debt-hidden-r1` | `a20-sameturn-withercombe-r1` |
| Fengate | `fengate-selector-v4-isolation-debt-hidden-r1` | `a20-sameturn-fengate-r1` |
| Hethel | `hethel-selector-v4-isolation-debt-hidden-r1` | `a20-sameturn-hethel-r1` |
| Ravensmark | `ravensmark-selector-v4-isolation-debt-hidden-r1` | `a20-sameturn-ravensmark-r1` |
| Lantern | `lantern-selector-v4-heldout-debt-hidden-r1` | `a20-sameturn-lantern-r1` |
| Marrick | `marrick-selector-v4-heldout-debt-hidden-r1` | `a20-sameturn-marrick-r1` |

Shared S1 stack:

```bash
DERIVATION_PROVIDER=codex
DERIVATION_LEARNER_PROVIDER=codex
DERIVATION_CLI_TIMEOUT_MS=900000
DERIVATION_LLM=real
DERIVATION_TRACE=0
node scripts/run-derivation-matrix.js \
  --spec exports/dramatic-derivation/a20-sameturn-candidate-full-spec.yaml \
  --label a20-sameturn-candidate-full-20260615 \
  --out exports/dramatic-derivation/matrix \
  --concurrency 3
```

Core flags: `--real`, `--superego`, hidden `--pacing-guard`, `--proof-debt-guard`, `--same-turn-assertion-affordance`, `--confront`, `--repair-clause`, `--release-authority`, `--plot`, `--throughline`, `--critic-feedback off`, `--critic off`, staged decay.

## Episode Replay Screen

The episode runner was extended to inherit and explicitly set `--same-turn-assertion-affordance`. A codex-matched suffix screen replayed each S0 transcript through the first live turn near the final assertion point.

| World | Replay label | Verdict | Forced | Grounded | Gap |
| --- | --- | ---: | ---: | ---: | ---: |
| Withercombe | `a20-replay-withercombe-sameturn-codex-r1` | grounded | 19 | 19 | 0 |
| Fengate | `a20-replay-fengate-sameturn-codex-r1` | grounded | 22 | 22 | 0 |
| Hethel | `a20-replay-hethel-sameturn-codex-r1` | grounded | 20 | 20 | 0 |
| Ravensmark | `a20-replay-ravensmark-sameturn-codex-r1` | grounded | 13 | 13 | 0 |
| Lantern | `a20-replay-lantern-sameturn-codex-r1` | grounded | 20 | 20 | 0 |
| Marrick | `a20-replay-marrick-sameturn-codex-r1` | grounded | 22 | 22 | 0 |

Interpretation: episode replay is useful for suffix debugging and fast false-positive checks. It is not independent evidence for the candidate arm because it preserves the successful S0 prefix.

## Fresh Matrix Results

| World | S0 verdict | S0 gap | S0 release | S1 verdict | S1 gap | S1 release | Note |
| --- | --- | ---: | ---: | --- | ---: | ---: | --- |
| Withercombe | grounded | 0 | 6/9 | grounded | 0 | 7/9 | matched success; release adherence improved by one cue |
| Fengate | grounded | 0 | 6/9 | grounded | 0 | 6/9 | matched success |
| Hethel | grounded | 0 | 7/8 | disengagement | - | 5/8 | archived stop at turn 11; later audit classifies it as premature stall detection under decay |
| Ravensmark | grounded | 0 | 4/5 | grounded | 0 | 4/5 | matched success but took two more turns |
| Lantern | grounded | 0 | 7/8 | grounded | 0 | 7/8 | matched success |
| Marrick | grounded | 0 | 5/9 | grounded | 0 | 5/9 | matched success |

Archived S1 success rate under the then-current detector: 5/6 grounded.

Matched S0 success rate on the same first-pass labels: 6/6 grounded.

All five S1 grounded runs had forced/asserted gap 0, no fabricated facts, and no learner overreach. Hethel stopped by disengagement at turn 11, before `S` was forced and before the same-turn assertion affordance could fire.

Follow-up detector audit: the Hethel tail was `D=4,4,4,3,3,3` over turns 6--11 while the net grounded count stayed flat at 7. The learner made proof progress at turn 9, but decay/repair churn masked it from the old disengagement detector, which checked net `groundedCount` growth before checking D decrease. The stop is therefore an implementation artifact of the stall detector under decay, not clean evidence that the same-turn assertion policy hurt Hethel.

## Failure Classification

| World | Failure type | Classification |
| --- | --- | --- |
| Hethel | premature disengagement stop | implementation artifact: detector counted flat net `groundedCount` as disengagement despite a D decrease inside the window |

Hethel did not crash and should not be rerolled as crash recovery. The archived verdict should remain as run-produced, but it should not be counted as clean policy negative transfer without rerunning under the corrected detector.

## Interpretation

The same-turn affordance works as a local suffix mechanism: when a newly visible or newly consolidated final exhibit is adopted on the current turn, the learner can immediately recheck the expanded board and assert the answer without waiting an extra turn.

But the current hidden+proofDebt candidate arm already had gap 0 on all six matched S0 worlds. In this stack, the same-turn affordance has little room to improve the primary metric. The archived Hethel row initially looked like first-pass negative transfer, but the detector audit shows the stop fired while D had recently decreased and the next proof exhibit (`p_mark`) was still two turns away on the fixed release schedule.

Policy call: keep the current candidate/default arm as static hidden plus proof-debt guard. Keep same-turn assertion affordance available for targeted failure repair and suffix diagnosis, but do not promote it as the broad reliability policy from this result because the baseline already solved the forced/asserted gap.

## Artifacts

- Fresh matrix: `exports/dramatic-derivation/matrix/a20-sameturn-candidate-full-20260615/matrix-summary.json`
- Spec: `exports/dramatic-derivation/a20-sameturn-candidate-full-spec.yaml`
- Replay episodes: `exports/dramatic-derivation/episodes/a20-replay-*-sameturn-codex-r1/`
- Episode runner implementation: `scripts/run-derivation-episode.js`
- Replay regression: `tests/dramaticDerivationReplay.test.js`
- Stall-detector correction: `services/dramaticDerivation/slope.js`

Validation:

```bash
node --test tests/dramaticDerivation.test.js
node --test tests/dramaticDerivationReplay.test.js
git diff --check
```
