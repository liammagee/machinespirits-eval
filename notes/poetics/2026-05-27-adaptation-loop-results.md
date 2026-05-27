# Adaptation Recognition Loop Results

Date: 2026-05-27

## Command

```bash
npm run poetics:adaptation-loop -- --max-iterations 3 --required-passes 2 --skip-existing-scores
```

The loop was stopped during iteration 3 after two completed iterations. That was deliberate: the first two iterations were enough to expose the repeated failure classes, and one gate bug was found and fixed before spending another full generation cycle.

## Gate Definition

The loop tested D42, D50, and D53 under three arms:

- routine
- none
- peripeteia-only

A run passes only if:

- routine and none stay negative under the four-critic panel
- peripeteia-only gets at least 3 of 4 recognition votes
- at least 3 critics classify the recognition origin as `peripeteia_induced`
- at least 3 critics see learner actional breakthrough
- the deterministic tutor-adaptation analyzer finds branch-valid reversal use, private mechanism declaration, and public tutor mechanism shift

Critics:

- `qwen/qwen3.7-max`
- `google/gemini-3.5-flash`
- `deepseek/deepseek-v4-pro`
- `anthropic/claude-sonnet-4.6`

## Iteration Summary

| iteration | pass | passed items | failure counts after corrected gate |
|---:|---:|---:|---|
| `phase2-adaptation-recognition-loop-20260527T044802Z-i01` | no | 5/9 | `critic_split:2`, `organic_or_ambiguous_recognition:2`, `private_only_adaptation:2`, `scorer_error:1`, `insufficient_scores:1` |
| `phase2-adaptation-recognition-loop-20260527T044802Z-i02` | no | 6/9 | `scorer_error:2`, `insufficient_scores:2`, `recognition_not_produced:1`, `organic_or_ambiguous_recognition:1` |

## Substantive Reading

We are closer than the first raw failure line suggested, but not at robust adaptation -> recognition.

Controls are now mostly under control. Iteration 2 had no substantive routine/none recognition leak after correcting scorer-error handling; the remaining control failures were DeepSeek no-content responses, now classified as scorer coverage failures rather than low-organic leaks.

D50 is the strongest current anchor. In iteration 2, D50 peripeteia-only passed the full gate: 4 of 4 recognition votes, 3 of 4 `peripeteia_induced` origin votes, 3 actional votes, and branch-valid public mechanism evidence.

D42 and D53 remain the blockers. They can produce branch-valid tutor adaptation and learner actional breakthrough, but the learner does not reliably re-read the earlier frame in a way critics count as recognition. This is the core architecture gap: public mechanism and learner action are not yet sufficient to force recognitive reorientation.

## Why Iteration 3 Was Stopped

The loop had already spent two full generation/scoring passes, and the second pass repeated the same architecture-level pattern: clean controls plus a partial peripeteia success, not global robustness. Continuing iteration 3 without changing the scenario/peripeteia contract would mostly test stochastic luck.

The next move should be design, not another blind loop:

1. Keep D50 as the current positive anchor.
2. Redesign D42 and D53 peripeteia branches so the learner must publicly compare the old rule against the new device, not merely use the device.
3. Add an explicit post-action re-reading beat to the peripeteia-only branch contract: action first, then learner names what the action changed about the earlier assumption.
4. Re-run the loop only after that contract is encoded in the generator/scenario spec.
5. Treat DeepSeek no-content rows as scorer coverage errors and either retry that critic or accept an insufficient-coverage status; do not count them as control leakage.

## Current Conclusion

The mechanism exists locally but is not robust across anchors. The most defensible claim right now is:

> Branch-valid tutor peripeteia can produce recognitive reframe in at least one clean low-organic anchor, but the architecture still needs a stronger public action-to-re-reading bridge before we can claim adaptation reliably produces recognition.

## Follow-Up Changes Made

After reading the failed D42 and D53 peripeteia transcripts, the generator contract was tightened. The peripeteia learner branch now requires a three-part public shape:

1. perform the new device on the current task
2. name the prior pressure or misfit as a task object
3. state the replacement check now carried by the device

The rules structure critic was also tightened. A peripeteia arm now fails before external scoring if the learner performs the device without an earned public reorientation. Re-running the stricter critic over iteration 2 correctly rejects D42 and D53 while allowing D50.

This changes the next loop from blind generation/scoring into generate -> structural reject/regenerate -> score only if the action-to-re-reading bridge is visible.
