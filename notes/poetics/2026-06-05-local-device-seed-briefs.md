# Local-Device Counterexample Seed Briefs

Date: 2026-06-05

## Boundary

These are quick-iteration seed briefs for local replay only. They are not panel results and do not claim online tutor adaptation.

The aim is to test whether counterexample-necessity improves when the replacement relation is artificial and local to the staged device, rather than a stock curricular distinction.

## Local Gate

Use the existing replay harness and local adversarial checker:

- `public_causal_bridge >= 0.85`
- `device_specificity >= 0.80`
- `old_warrant_misclassification >= 0.70`

Do not panel unless the local gate returns `survivor`.

## Seed 1: T15 Rotation Notch

Source item:

- `phase2-adaptation-recognition-loop-20260529T023023Z-i01:target-r01:none:T15`

Near-miss evidence:

- `i01`: bridge 0.85, device 0.78, misclassification 0.88.
- `i02-t15`: bridge 0.85, device 0.78, misclassification 0.90.

Problem to avoid:

- Do not use readable-text orientation as the decisive replacement check. Critics can read "make Carbon readable first" as ordinary literacy/orientation scaffolding.
- Do not use a generic overlay that could have been introduced before the obstruction.

Seed mechanism:

- The carbon tile has a small red registration notch on one corner, and the sign-off frame has one matching red notch.
- The learner's old rule is tray-position reading: tray top means top field / atomic number.
- The public obstruction rotates the tile or tray so tray top now points to `12.01`.
- The tutor first asks the learner to apply tray-position reading; the learner publicly sees it misclassifies `12.01` as atomic number.
- The tutor introduces the local rule only after that failure: labels count only when the tile notch is aligned with the frame notch.
- The notch rule is artificial/local: it exists on this exhibit frame and is not a general chemistry explanation.
- The learner must align notch to notch, then use the now-registered fields to place `6` as atomic number and `12.01` as atomic mass.

Target learner reframe:

- In ordinary speech, the learner says tray top failed when `12.01` moved there.
- The learner says the notch/frame alignment, not tray edge or readable text, now decides which field is top.
- The learner applies that aligned field relation to `6` and `12.01`.

## Seed 2: T24 Lock-Pin Meter Frame

Source item:

- `phase2-adaptation-recognition-loop-reverse-20260529T100413Z-i01:target-r01:none:T24`

Problem to avoid:

- Do not rely on "tempo versus time signature" as the replacement distinction. Critics can read that as ordinary music theory pedagogy.
- Do not use generic side-by-side tempo comparison as the decisive device.

Seed mechanism:

- The worksheet has a meter frame with two boxes and a small lock pin.
- The old learner rule is speed-card reading: if tempo changes, the bottom number should change.
- The public counterexample is two slips with different tempo words that both fit into the same locked meter frame without moving the lock pin.
- The tutor introduces the local rule only after the wrong prediction: the meter boxes count only when the lock pin is closed; tempo slips live outside the locked frame.
- The lock-pin relation is local to this worksheet device, not a general explanation of tempo.

Target learner reframe:

- The learner says the speed card predicted a different bottom number, but the locked frame kept the same `3/4`.
- The learner says the lock pin, not speed, decides what belongs inside the meter boxes.

## Seed 3: T24 Broken Rail Bar-Line

Source item:

- `phase2-adaptation-recognition-loop-20260529T023023Z-i01:target-r01:routine:T24`

Problem to avoid:

- Do not use generic one-variable comparison as the decisive mechanism.
- Do not let "quarter note gets the beat" become ordinary curriculum sequencing.

Seed mechanism:

- The bar worksheet has a short rail with three physical stops and a movable bar-line clip.
- The old learner rule is count-by-tile: place a fourth quarter tile if the lower `4` is visible.
- The public counterexample is that the fourth tile physically falls beyond the third stop and cannot sit inside the bar rail.
- The tutor introduces the local rule only after the failed placement: the bar line clips onto the rail after the third stop; the lower `4` names the tile type used at each stop, not the number of stops.
- The rail/clip relation is local to this staged worksheet and physically blocks the old count-by-4 placement.

Target learner reframe:

- The learner says the visible `4` tempted a fourth placement, but the rail would not hold it inside the bar.
- The learner says the clip after three stops now fixes the bar, while `4` names the quarter tile used at each stop.

## Local Smoke Result

Run root:

- `exports/discursive-replay-loops/discursive-replay-loop-local-device-seeds-20260605-i01-t15`

Item:

- `phase2-adaptation-recognition-loop-20260529T023023Z-i01:target-r01:none:T15`

Result:

| Item | Public causal bridge | Device specificity | Old-warrant misclassification | Gate |
| --- | ---: | ---: | ---: | --- |
| `none / T15` red-notch frame | 0.85 | 0.78 | 0.90 | `revise_again` |

The local-device seed did not clear the gate. The notch/frame relation improved the mechanism description but did not improve the device-specificity score over the prior readable-text orientation run (`0.78` in both cases).

Checker interpretation:

- The bridge is public and inspectable.
- The old warrant visibly misclassifies `12.01` as atomic number after tray rotation.
- The learner owns a compact self-reframe.
- The blocking weakness remains `device_specificity`: the critic says a simpler anchor such as "the whole number 6 is always at top" could resolve the obstruction without the artificial notch device.

Decision:

- Do not panel.
- Do not expand to the T24 seeds yet under this quick-iteration rule.
- The lesson is sharper: artificial/local apparatus is not sufficient if the critic can still name a simpler ordinary anchor. A stronger seed needs to make the local device not just available, but uniquely required because ordinary anchors are unavailable or conflicting.
