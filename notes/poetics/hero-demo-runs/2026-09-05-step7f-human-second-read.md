# Human second read of the step 7f hold packet (2026-09-05)

Reader: Liam Magee. Packet: the twelve items of `exports/tutor-stub-outcome/step7f-hold-cue-fix/blind-packet.md`
(world 037, the hold pair on the PR #1024 cue fix). Judge: codex.gpt-5.6-sol, seed 7, blind to gold
and version. No paid call: the read was done by hand and the compare is arithmetic.

Card: `workplan/items/hold-packet-human-second-read.md`.

## How the read was done

The packet on paper did not work on a phone, so the twelve items went into a small web page
(a private claude.ai artifact, one item per screen, four multiple-choice questions, answers
saved in the page's store and pasted back into chat). One design difference from the model
reads: the page showed the whole dialogue up to the moment, with the three packet lines
marked, because a move like change_tone cannot be read from one turn. The three model readers
saw the three packet lines only. Gold and version stayed hidden from the human as from the
models. Answers: `reader-human.json`; compare: `reader-human-compare.md`; instrument record:
`reader-human.meta.json`, all in the run folder.

## Numbers

Agreement with the judge, human beside the three model reads of the same packet:

| question | human | Sonnet 5 | Opus 5 | Fable 5.1 |
|---|---|---|---|---|
| realized | 0/12 | 12/12 | 12/12 | 12/12 |
| move, exact tag | 3/12 | 8/12 | 7/12 | 6/12 |
| repair HIT or not | 9/12 | 9/12 | 9/12 | 9/12 |
| uptake | 8/12 | 10/12 | 10/12 | 10/12 |
| eased | 7/12 | 12/12 | 12/12 | 8/12 |
| kappa, repair HIT vs not | 0.50 | 0.50 | 0.68 | 0.68 |

Human against the other readers on repair HIT or not: Opus 11/12 (kappa 0.83), Fable 11/12
(0.83), Sonnet 8/12 (0.33). The one item where the human and Opus part is item 11 (without
the card, turn 10, opposed): the human read change_tone, which the key accepts, and Opus read
backtrack.

Card effect on repair hits, with the card against without:

| reader | with | without |
|---|---|---|
| judge | 4/6 | 3/6 |
| human | 3/6 | 3/6 |
| Sonnet 5 | 4/6 | 2/6 |
| Opus 5 | 3/6 | 2/6 |
| Fable 5.1 | 3/6 | 2/6 |

The human read is the first on any packet that gives the card no lean. Every model read on
this packet keeps with at or above without, by one or two plants.

## Where the human and the models part

**Realized.** The judge and all three models ruled that the learner carried out the direction
on all twelve items. The human ruled no on ten and partly on two (items 1 and 4). On the face
of it the learner lines follow the direction's sample near word for word, for example item 2:

```text
Direction sample: "We did the strip. Two fifths reached the middle, I saw it. It's on the sheet."
Learner line:     We did the strip, though — two fifths reached the middle, I saw it, it's on the sheet.
```

So the human read the question differently from the models, and the note does not know how.
The question on the page was "Did the learner carry out the direction?" with yes, partly, no.
This is open and is put back to the reader below; the count is recorded as given.

**Eased.** The human said persists on items 2, 6, 7 and 8, where the judge, Sonnet and Opus
said eased and Fable said unclear. All four are the plants whose next line is itself the next
plant (turns 6 and 7, turns 9 and 10 are adjacent in the schedule). The next line is a new
scripted stress, so "does the condition still show" cannot be read from it as a result of
the tutor's reply. The human read the learner as still pressing; the models read the change
of condition as easing. On item 1 (turn 4, opposed, followed by the held turn 5) the human
said eased and every other reader said persists: the held line concedes "five sixths" and in
the same breath asks to move on, the same line shape that split Sonnet and Opus in the
speech-check re-read.

**Move.** The human used change_tone as the main tag four times (items 4, 9, 11, 12) and a
secondary tag on ten of twelve items; the models used change_tone as the main tag on no item.
Two of the four count as hits through the key's second acceptable tag (items 4 and 11); the
other two are the turn-2 jumping_ahead plants, where every reader and the judge missed gold
(reinforce_and_test) one way or another. Items 3 and 10 (the irritated plants, gold
change_tone) the human read as more_words and reinforce_and_test; no reader hit item 10, and
only the judge hit item 3.

## What it changes

The human repair read sits at the bottom of the model range on this packet (0.50, level with
Sonnet) and agrees with Opus and Fable more than with the judge. The lean the models kept, the
human does not: 3/6 against 3/6. One packet, one human, one read. The §6.24 sentence "a human
second read is still open" can now say what the read found; whether the five-pair lean is
kept as a lean, narrowed to the model readers, or dropped is the author's call and is not
made here.

## Open

- What "no" on realized meant to the reader. If the reader took the question to mean
  something other than "did the line follow the direction", the page's wording is the fault
  and the count says nothing about the sim.
- Whether the eased question should be scored at all on a plant whose next line is the next
  plant. The compare script could report those items as not scorable.
- Whether to give the model readers the earlier turns too, as the human had. One packet with
  both packet shapes would say if the context changes the model reads.

No paid call was made. No re-run.
