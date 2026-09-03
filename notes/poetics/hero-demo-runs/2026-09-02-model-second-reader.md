# Model second reader on the three blind packets (2026-09-02, paid)

Card: `workplan/items/state-detection-without-word-lists.md`.
Ceiling: 3 calls, one per packet, Sonnet 5 through the claude-code bridge.
Used: 3. No retry.

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
