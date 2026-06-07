# T24 Local-Device Option Loop

Date: 2026-06-05

## Boundary

This is a local-only option loop using `scripts/replay-discursive-transcript.js`. It does not create a blind panel package and does not claim peripeteia-induced adaptation.

The purpose was to test three quick local-device variants for the same T24 source item:

- `phase2-adaptation-recognition-loop-20260529T023023Z-i01:target-r01:routine:T24`

## Options

Feedback files:

- Option A: `notes/poetics/local-device-options/2026-06-05-t24-option-a-broken-rail.md`
- Option B: `notes/poetics/local-device-options/2026-06-05-t24-option-b-keyed-slots.md`
- Option C: `notes/poetics/local-device-options/2026-06-05-t24-option-c-conflicting-anchors.md`

Run roots:

- `exports/discursive-replay-loops/discursive-replay-loop-t24-local-device-options-20260605-option-a`
- `exports/discursive-replay-loops/discursive-replay-loop-t24-local-device-options-20260605-option-b`
- `exports/discursive-replay-loops/discursive-replay-loop-t24-local-device-options-20260605-option-c`

Local thresholds:

- `public_causal_bridge >= 0.85`
- `device_specificity >= 0.80`
- `old_warrant_misclassification >= 0.70`

## Results

| Option | Mechanism | Public causal bridge | Device specificity | Old-warrant misclassification | Gate |
| --- | --- | ---: | ---: | ---: | --- |
| A | broken three-stop bar rail | 0.85 | 0.78 | 0.88 | `revise_again` |
| B | keyed slots / locking feet | 0.85 | 0.75 | 0.85 | `revise_again` |
| C | conflicting anchors / arbitration tab | 0.82 | 0.73 | 0.80 | `revise_again` |

No option survived the local gate. No panel was run.

## What Worked

All three options produced old-warrant misclassification. This is now a robust design capability:

- Option A: the lower `4` tempts a fourth quarter tile, but the fourth tile cannot sit inside the three-stop bar rail.
- Option B: the fourth object does not latch into the keyed bar slots.
- Option C: nearest-number reading makes `4` look like the count, but it conflicts with the inside-bar tab's three slots.

Option A produced the best public bridge and the clearest learner reframe. The checker accepted the material failure as specifically responsive to the learner's count hypothesis, not merely a generic tempo scaffold.

## What Did Not Work

The bottleneck remains device specificity.

Option A came closest, but still scored `device_specificity = 0.78`, below the `0.80` local threshold. The checker warned that even a three-stop rail can be read as a plausible generic music-education manipulative.

Option B was more artificial, but that made it look like a generic physical sorter. The keyed-foot device linked to the obstruction, but the critic could still classify it as a familiar shape-matching scaffold.

Option C was the weakest because the public bridge also dropped below threshold. The arbitration tab created a conflict, but the device began to feel like an invented widget rather than a necessary feature of the task.

## Decision

Do not panel these artifacts.

The useful near-miss is Option A. If quick iteration continues, tune only Option A and make the three-stop rail less like a generic manipulative by requiring that:

1. the learner first tries an ordinary non-rail anchor and it fails publicly;
2. the rail is not pre-explanatory, but becomes relevant only when the fourth tile fails to fit; and
3. the learner's final reframe names the rail as the only thing that settled whether `4` was count or unit.

If that still stalls below `device_specificity >= 0.80`, stop replay tuning and switch to fresh generation where the local constraint is built into the task from the beginning.
