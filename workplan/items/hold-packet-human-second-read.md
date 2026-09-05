---
id: hold-packet-human-second-read
title: Human second read of one blind hold packet (037)
status: review
type: research
priority: P3
owner: human
source: review
created: 2026-09-05
updated: 2026-09-05
verification: "A human reader, blind to gold and version, scores at least one of the five 037 hold packets (7b to 7f) on repair hit or not; agreement with the codex judge is reported as kappa beside the model readers' 0.50 to 0.83; the hold lean in §6.24 is kept, narrowed or dropped on that reading."
claim_status: exploratory
depends_on:
  - state-detection-followups-hold-and-cues
links:
  items:
    - state-detection-followups-hold-and-cues
  notes:
    - notes/poetics/hero-demo-runs/2026-09-05-step7f-human-second-read.md
    - notes/poetics/hero-demo-runs/2026-09-05-step7f-hold-cue-fix-live.md
    - notes/poetics/hero-demo-runs/2026-09-03-model-second-reader-7b-7c.md
  exports:
    - exports/tutor-stub-outcome/step7f-hold-cue-fix/
tags:
  - hold-instrument
  - human-read
---

The hold instrument's card closed on 2026-09-05 with one step open: no human
has read a blind packet. Three model readers (Sonnet 5, Opus 5, Fable 5.1)
agree with the codex repair judge at kappa 0.50 to 0.83 across the five
packets, and no reader is above the others throughout. The model reads do not
stand in for a human one.

The packets are in the run folders under `exports/tutor-stub-outcome/step7*`
(archived). Twelve items each, one call per reader. Score with
`scripts/score-blind-packet-model.js` as the template for the sheet. No paid
call is needed.

# Read done 2026-09-05

Liam Magee read the step 7f packet blind to gold and version, one item per
screen on a private web page that also showed the earlier turns (the three
model readers saw the three packet lines only). Against the codex judge on
repair HIT or not: 9/12, kappa 0.50, level with Sonnet 5 (0.50) and under Opus
5 and Fable 5.1 (0.68). Against Opus and Fable the human agrees 11/12 (kappa
0.83). Card effect on the human read: 3/6 with the card, 3/6 without, the first
read on any packet with no lean (judge 4/6 vs 3/6; the three models keep with
above without). Two divergences to sort out before the read is cited: the
human ruled "realized" no or partly on all twelve where every other reader
ruled yes, which looks like a question-wording fault; and on the four items
whose next line is the next plant (turns 6 and 9) the human read the condition
as persisting where the judge read it as eased. Note
`notes/poetics/hero-demo-runs/2026-09-05-step7f-human-second-read.md`;
answers and compare in `exports/tutor-stub-outcome/step7f-hold-cue-fix/`
(`reader-human*.json`, `reader-human-compare.md`), archived.

What stays for the author: the §6.24 line "a human second read is still open",
and whether the five-pair lean is kept, narrowed to the model readers, or
dropped on this reading. No paid call is needed for either.

# Two rulings 2026-09-05, same day

The reader answered both divergences. Realized: the page asked "carry out the
direction" and the reader took it as whether the learner was successful with
the lesson, so the 0/12 is a page fault and is withdrawn (kept in
`reader-human.meta.json`). The page now asks whether the learner's line does
what the direction and its sample say, and the reader is redoing question 1 on
all twelve items; the other three answers stand. Eased: skipped on the four
items whose next line is itself the next plant (items 2, 6, 7, 8);
`scripts/stress-blind-packet.js compare` now skips such items and says how
many. On the eight left the human agrees with the judge 7/8, each model 8/8.
Repair, kappa, uptake and the card effect are unchanged. The redone question
1 count and the wider skip landed the same day (next section).

# Redo and widened skip 2026-09-05, same day

Question 1 redone on the reworded page: 11/12 yes. Item 12 (with the card,
turn 2, jumping ahead) the reader ruled no where every model reader ruled yes;
no reason was recorded on the page. Eased: after the discussion the reader
widened the skip from the four adjacent-plant items to every item whose next
line is scripted, the next plant or a held turn. On 7f that is eight of twelve
(items 1, 2, 5, 6, 7, 8, 9, 12). On the four left the human and every model
reader agree with the judge 4/4. `compare` now reads the held turns from the
trace (either hold event) and reports the plant and hold skips apart. The
earlier packets re-scored on the same rule at zero cost: 7b to 7e 4/4 for every
model reader, step 7 (the first hold pair) 4/4 for both readers, step 6 (no hold
schedule) 8/8, step 4 16/16. So every eased disagreement recorded in this arc
sat on a scripted next line. Repair 9/12, kappa 0.50, uptake and the card
effect (3/6 vs 3/6) are unchanged. Archive updated. The §6.24 line and the fate
of the lean stay with the author.
