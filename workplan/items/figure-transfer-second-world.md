---
id: figure-transfer-second-world
title: 'Figure transfer: does the move reader hold in a second world?'
status: active
type: experiment
priority: P2
owner: claude
source: manual
created: 2026-08-08
updated: 2026-08-08
verification: 'REGISTERED, NOT YET RUN. This block is written before the
  test corpus exists and is the thing the result gets checked against.
  Filled in after the read.'
claim_status: scope-bound
links:
  notes:
    - notes/2026-08-06-pedagogical-figure-ontology.md
  paper:
    - docs/research/paper-full-2.0.md#714-the-ontologys-own-falsifier-pedagogical-figures-do-not-separate-on-the-features-the-harness-logs
  items:
    - reply-feature-stamps
    - figure-lattice-falsifier
---

# Does the move reader hold in a second world?

§7.14 reports that a card-blind reader recovers which of five move cards
was ordered from the tutor's reply alone, on turns it was not built from:
14 of 34, 41.2% against a 20% bar, p = 0.0039. It also says, in its own
status line, that the result is bounded to **one world** — every turn on
both sides came from `world_030_rowan_flat`, a share-house argument about
a ceiling leak.

That leaves an obvious way for the number to be less than it looks. The
reader could have learned the vocabulary of one argument rather than the
form of five tactics. Nothing in the held-out test can tell those apart,
because the held-out corpus is the same world.

So: fit the same profile on the same 24 training turns, and read a corpus
from a **different world**.

## What changes and what does not

One thing changes: the world, and the learner brief that world implies.
Everything else is held to the pinned recipe the first two corpora ran
from — same tutor role (`dramatic-detective@v1`), same four models, same
seed, same turn and budget caps, same register policy, same card
schedule, same slots, same dialogue count.

**The second world is `world_031_tideway_makerspace`.** Chosen for two
reasons. It has the same proof shape as Rowan Flat — a person the room
has already blamed (Jules, the newest volunteer) standing in front of a
material cause (an under-strength batch of connectors), with clue
releases on the same turn schedule — so the dialogues run to comparable
lengths and the card slots land in comparable places. And it shares
almost no vocabulary: a load test on a model footbridge, a build log, a
twisted joint. No ceiling, no shower, no flatmate.

**The learner keeps its behaviour and changes its costume.** The Rowan
Flat brief describes a tired tenant who pins every fact to the person
already blamed, bends what almost fits, mocks manual-speak, and gets
shorter when stalled. The Tideway brief keeps all four traits and moves
them into the makerspace. Changing the learner's behaviour as well would
confound the world with the learner and make a null unreadable.

**The instrument does not change.** `services/tutorStubReplyFeatures.js`
stays at rf-v2, no new columns, no widened patterns. This is the same
freeze rule the held-out test ran under, and the reason it exists: rf-v1
was widened after its author read three labelled replies from the corpus
it then scored.

**The reader does not change either**, beyond a flag that renames its
output file so the transfer artifacts do not overwrite
`figure-holdout-draft.json`. The fit, the ranking, the bar and the
shuffle are untouched.

## The bar, fixed before the corpus exists

- **Primary.** Top-1 accuracy on the draft text against a chance bar of
  1/5. One-sided exact binomial. Pass is p < 0.05. Anything else is a
  null, including a result that beats chance but not the bar. The draft
  reading is primary because the training profile was built from drafts.
- **Secondary, reported either way.** Top-2 against 2/5, per-move recall,
  a label shuffle inside the test corpus, and the shipped-text arm. The
  shipped arm carries the same handicap it carried last time — the
  exact-source guard replaced every grievance draft in training, so that
  profile has no grievance class.
- **No turn is dropped after the fact.** The only drops are the ones the
  reader already makes for everyone: a turn whose dialogue never
  completed, and on the shipped reading a turn where the guard shipped
  its template.
- **Descriptive only, not a test.** Comparing this number with world
  030's 41.2% is a between-corpus difference with no matched pairs. It
  gets reported and is not tested.

## What each outcome means, also fixed in advance

**Pass.** The profile is not tied to the vocabulary it was fitted on.
§7.14's scope line loosens from one world to two, and the weak reading of
the figure claim survives one step further than it did.

**Fail.** The reader is world-bound. §7.14 already cautions that the
result is scoped to one world; a null turns that caution into a measured
bound, which is worth reporting in its own right. A null does **not**
retract the held-out result, which stands as recorded for world 030.

Either way this is one run and it goes in the paper as one run.

## How to run it

Registration first, then the corpus, then one read.

1. Build the second pinned recipe from the first, changing only the world
   and the learner brief. It lives beside the first at
   `../ms-figure-pinned/`.
2. `node scripts/run-figure-clean-test.js --recipe <second> --world-dir
   world_031_tideway_makerspace --out
   exports/tutor-stub-outcome/figure-transfer-tideway`
   Attended, one dialogue at a time, stops on the first failure.
3. `node scripts/analyze-figure-holdout.js --test
   exports/tutor-stub-outcome/figure-transfer-tideway --label transfer`
   Training corpus is the default, which is the same 24 turns. Read once.
