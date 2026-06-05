# Existing Counterexample Seed Smoke

Date: 2026-06-05

## Boundary

This is a local-only smoke test using existing original phase-2 transcripts. It does not create a blind panel package and does not claim peripeteia-induced adaptation.

The purpose was to test whether existing non-T18 transcripts can be reused as counterexample-necessity seeds via `scripts/replay-discursive-transcript.js`, rather than creating a new scenario pipeline.

## Inputs

Run roots:

- `exports/discursive-replay-loops/discursive-replay-loop-counterexample-seeds-existing-20260605-i01`
- `exports/discursive-replay-loops/discursive-replay-loop-counterexample-seeds-existing-20260605-i02-t15`

Local gate thresholds:

- `public_causal_bridge >= 0.85`
- `device_specificity >= 0.80`
- `old_warrant_misclassification >= 0.70`

Candidate items:

- `phase2-adaptation-recognition-loop-20260529T023023Z-i01:target-r01:none:T15`
- `phase2-adaptation-recognition-loop-reverse-20260529T100413Z-i01:target-r01:none:T24`
- `phase2-adaptation-recognition-loop-20260529T023023Z-i01:target-r01:routine:T24`

## Results

| Iteration | Item | Public causal bridge | Device specificity | Old-warrant misclassification | Gate |
| --- | --- | ---: | ---: | ---: | --- |
| `i01` | `none / T15` | 0.85 | 0.78 | 0.88 | `revise_again` |
| `i01` | `none / T24` | 0.80 | 0.70 | 0.85 | `revise_again` |
| `i01` | `routine / T24` | 0.80 | 0.75 | 0.82 | `revise_again` |
| `i02-t15` | `none / T15` | 0.85 | 0.78 | 0.90 | `revise_again` |

No item survived the local gate. No panel was run.

## Interpretation

The existing replay harness is the right tool for this step: it can rewrite multiple existing transcripts, run an adversarial local checker, and apply the new counterexample gate without any new scenario-generation code.

The substantive result is mixed but informative:

- `old_warrant_misclassification` is achievable on existing transcripts. All four local candidates passed it.
- The bottleneck remains `device_specificity`. Local critics repeatedly see the revised devices as plausible standard pedagogy: orienting a tile by readable text, or comparing same-signature tempo cards, rather than as uniquely forced by the public obstruction.
- The closest case is `none / T15`: it passes bridge and misclassification, but stalls at `device_specificity = 0.78` in both passes.

## Decision

Do not panel these artifacts. The local screen is doing its job.

The next useful move is not another source/contact-style replay polish. Either:

1. run a bounded second selection pass over different existing T15/T24 originals to find a device-specificity survivor, or
2. move to fresh generation with a stronger seed constraint: the changed relation must be local to the staged device, not a standard curricular distinction that a critic can read as ordinary pedagogy.
