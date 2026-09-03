# Model second readers on the three blind packets (2026-09-02, paid)

Card: `workplan/items/state-detection-without-word-lists.md`.
Two reads, each under a ceiling of 3 calls, one per packet, no retry:
Sonnet 5, then Opus 5, both through the claude-code bridge. Used: 3 + 3.

## Why a model, and why this one

The blind packets (step 4, step 6, step 7) waited on a human second
reader. The user found the sheet hard to fill and asked for a model to
stand in for now. A human reader is still needed; nothing below closes
that. The judge ran on codex (`codex.gpt-5.6-sol`), so the reader must be
another family: Sonnet 5 (`claude-code.claude-sonnet-5`). The reader sees
the packet only. The packet does not say which version of the tutor an
item came from. The key and the judge file stay closed to it.

Script: `scripts/score-blind-packet-model.js <packet.md> --out <file>`.
It sends the packet as written, asks for the filled JSON array only, and
writes the array that `stress-blind-packet.js compare` takes, with a
sidecar `.meta.json` naming the reader. Files:
`exports/tutor-stub-outcome/<run>/reader-sonnet5{.json,.raw.txt,.meta.json,-compare.md}`.

## Agreement with the judge

| packet | items | realized | move tag | repair HIT/PARTIAL/MISS | uptake | eased | kappa (HIT vs not) |
|---|---|---|---|---|---|---|---|
| step 4 (036 + 037, form-v1) | 24 | 22/24 | 16/24 | 18/24 | 21/24 | 22/24 | 0.67 |
| step 6 (037, form-v3) | 12 | 12/12 | 5/12 | 9/12 | 10/12 | 11/12 | 0.50 |
| step 7 (037, hold) | 12 | 11/12 | 6/12 | 8/12 | 11/12 | 9/12 | 0.31 |

The reader agrees with the judge on what the pupil did (realized) and on
what she did next (uptake, eased). It agrees less on which move the tutor
made. The exact tag matches on half the items or fewer in the two 037
packets. The HIT column holds up better than the tag column because
several tags share a gold.

## Does the reader see the card effect?

Repair HIT by version of the tutor, from the reader's own tags:

| packet | with card | without card | judge with / without |
|---|---|---|---|
| step 4 | 6/12 | 5/12 | 7/12 vs 6/12 |
| step 6 | 4/6 | 3/6 | 4/6 vs 2/6 |
| step 7 | 4/6 | 3/6 | 4/6 vs 3/6 |

The reader's margin is one plant in every packet. The judge's margin on
step 6 was two plants. On step 6 the reader gives the without-card tutor
a HIT at t6 (frustrated), where the judge read the reply as `speed_up`.
That one item is the whole difference.

## Where the two readers part

- The reader tags `backtrack` where the judge tags something else on 9 of
  the 24 disagreements across the three packets. On step 7 it tags
  `backtrack` for the with-card t7 (irritated, gold `change_tone`) and
  t10 (opposed, gold `off_track_probe`) replies, and for the without-card
  t7 reply. One HIT and one MISS come from that alone.
- Both readers agree that the two silent plants (t2 demand, t4 rule
  appeal) get no repair in either version, on every packet. Both tag the
  t2 reply `slow_down` or `backtrack`, never the gold
  `reinforce_and_test`.
- Neither reader gives the t10 endgame plant (opposed, face cost) a HIT
  without the card on any packet. With the card the judge gives it a HIT
  on step 6 and step 7; the reader gives it on step 6 only.

## What this shows and does not show

- The direction of the card effect holds under a second reader from
  another model family on all three packets. The size does not: one
  plant, not two, on step 6.
- A move tag is a hard call for both readers. A HIT/not-HIT ruling is
  more stable than the tag. Any claim in the paper should cite HIT
  counts, not tags.
- A model reader is not a human reader. Both readers are language models
  reading the same three lines; they may share a blind spot. The human
  read stays open on the card.

## Second read: Opus 5 (same packets, same script, 3 calls)

The user asked for Opus after the Sonnet read. Same blind setup;
`--model claude-code.claude-opus-5`. Files
`reader-opus5{.json,.raw.txt,.meta.json,-compare.md}` beside the Sonnet
ones. One parse defect on the way: on step 6 Opus put an escaped copy of
the array inside a shell command before the real array, and the
first-`[`-to-last-`]` cut failed. The reply was complete. The script now
walks back from the last `]` to the first slice that parses
(`extractAnswerArray`, tested) and has `--from-raw` to re-read a saved
reply. No second call was made.

| packet | realized | move tag | repair | uptake | eased | kappa (HIT vs not) |
|---|---|---|---|---|---|---|
| step 4 | 23/24 | 13/24 | 15/24 | 22/24 | 20/24 | 0.51 |
| step 6 | 12/12 | 10/12 | 10/12 | 10/12 | 11/12 | 0.83 |
| step 7 | 12/12 | 6/12 | 8/12 | 11/12 | 11/12 | 0.50 |

Repair HIT by version of the tutor, all three readers:

| packet | judge (codex) | Sonnet 5 | Opus 5 |
|---|---|---|---|
| step 4 (form-v1) | 7/12 vs 6/12 | 6/12 vs 5/12 | 4/12 vs 5/12 |
| step 6 (form-v3) | 4/6 vs 2/6 | 4/6 vs 3/6 | 5/6 vs 2/6 |
| step 7 (hold) | 4/6 vs 3/6 | 4/6 vs 3/6 | 4/6 vs 2/6 |

- On step 6 Opus agrees with the judge on 10 of 12 move tags and gives
  the card a wider margin than either other reader (three plants). The
  two disagreements both go the card's way: with-card t4 (judge
  `continue`, Opus `backtrack`, the gold) and without-card t6 (judge
  `speed_up`, Opus `backtrack`, PARTIAL).
- On step 4 Opus reverses the direction: 4 of 12 with the card, 5 of 12
  without. It tags `continue` on 8 of the 24 replies, and three of those
  are with-card 037 replies the judge and Sonnet both read as the gold
  move (t4 opposed, t7 irritated, t9 forgetting). Step 4 ran on form-v1,
  where the sensor read only 2 of 6 plants; step 6 is the same pair on
  form-v3.
- On step 7 all three readers agree that the with-card tutor repairs 4
  of 6 and the without-card tutor 2 or 3 of 6.

What changes: the step-6 result (form-v3 live) now has three readers
from three families agreeing on the direction, margins one to three
plants. The step-4 result (form-v1) does not survive the Opus read and
should not be cited on its own. The human read is still open.

