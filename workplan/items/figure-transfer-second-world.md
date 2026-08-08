---
id: figure-transfer-second-world
title: 'Figure transfer: does the move reader hold in a second world?'
status: done
type: experiment
priority: P2
owner: claude
source: manual
created: 2026-08-08
updated: 2026-08-08
verification: 'PASS on the registered primary. A profile fitted on 24 move
  turns from world_030_rowan_flat reads 14 of 34 move turns from
  world_031_tideway_makerspace, 41.2% against a 20% bar, one-sided exact
  binomial p = 0.0039; 400 label shuffles average 19.8% and none reach
  41.2%. Secondaries: top-two 19/34 = 55.9% vs 40%, p = 0.044; shipped-text
  arm a registered NULL at 5/24 = 20.8% vs 25%, p = 0.75. Train and test
  share no reply text (checked, 0). Per-move recall shifts but does not
  separate at 6-7 turns per move (largest Fisher p = 0.27), so it is
  reported untested. Post-hoc, pooled over both worlds: demand is misread
  as the conditional stake on 9 of its 12 wrong guesses against 3
  expected, p = 0.0004. The cause is the reader, not either world — the
  stake is its default class, taking 24 of 68 first places against 13
  actual stake turns and scoring highest on a turn drawn at random. The
  conditional-stake column fires on 1 of 100 carded turns, so it is not
  the cause. Artifacts
  exports/crossed-effects/figure-holdout-transfer-{draft,shipped}.json and
  figure-reader-bias.json.'
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

## Result, read once on 2026-08-08

**Primary: PASS.** 14 of 34 = 41.2% first guess right, against the 1-in-5
bar. One-sided exact binomial p = 0.0039. The profile carried 22 of its
features into the new world.

**Secondaries, as registered.**

- Top two: 19 of 34 = 55.9% against 40%, p = 0.044. Weaker than world
  030's 73.5%.
- Label shuffle inside the test corpus: 400 draws average 19.8%, best
  38.2%, and none reach 41.2%.
- Shipped text: 5 of 24 = 20.8% against 25%, p = 0.75. A null, and
  handicapped the same way it was last time — the exact-source guard left
  the training profile with no grievance class while three grievance
  turns sit in the test set.
- Per move: grievance 6/7, stake 3/6, settled claim 3/7, mockery 2/7,
  demand 0/7.

**The identical total is a coincidence, checked.** World 030's held-out
read was also 14 of 34. Two things say this is a different corpus rather
than a rerun of the old one: the reader was pointed at
`exports/tutor-stub-outcome/figure-transfer-tideway`, and it found zero
shared reply text between training and test, and between this test set and
the first one. The n of 34 is the design — 35 forced cards minus the one
turn per corpus whose dialogue did not complete.

**The per-move columns shift but do not separate.** World 030 read the
settled claim best (4/6) and the switch to plain words worst (1/7);
Tideway reads grievance best (6/7) and the demand not at all (0/7). At six
or seven turns per move none of those differences is distinguishable from
noise — the largest, grievance 3/7 against 6/7, gives Fisher p = 0.27 —
so they are reported without a test and no per-move signature is claimed
in either direction.

**What the two worlds agree on is a confusion, found after the reading.**
Pooling both corpora, the demand's wrong guesses land on the conditional
stake 9 times in 12 (3 of 5 in world 030, 6 of 7 in Tideway) against 3
expected if wrong guesses spread evenly over the four other moves,
p = 0.0004. The stake's wrong guesses land on the demand 3 in 6, and the
switch to plain words is absorbed by that pair on 10 of its 11 misses.

The cause is the reader, not the worlds — and not the column that looks
like the obvious suspect. `node scripts/analyze-figure-reader-bias.js`
asks three questions of the corpora already on disk. First: the
conditional-stake column, the one that catches "if you check X, then Y",
fires on **1 of the 100 carded turns** in the three corpora, so it carries
no weight in either direction. Second: the stake is guessed 12 times out
of 34 in **both** worlds while it is ordered 7 times and 6 times, so this
is not something either world does. Third: the stake is the reader's
default class. Pooled over the 68 test turns it takes 24 first places
against 13 actual stake turns, and it gives the highest average score of
the five classes to a turn drawn at random — −12.89 in log units against
−13.87 for the demand and −15.39 for the grievance. Its fitted profile is
the profile of a typical reply: medium-length sentences at 0.86, the
highest of the five, and long ones at 0.14, the lowest. With four to six
training turns per class and 22 features scored including their absences,
the flattest class collects the turns the sharper ones do not claim.

This caps the reader rather than inflating it: the label shuffle re-fits
nothing, so it carries the same bias and still averages 19.8%. All of it
was found after the reading and is recorded as a diagnosis of the
instrument, not a tested claim. It points the next design at a larger
training square rather than a third world.

**What this licenses.** §7.14's scope line loosens from one world to two.
The weak reading of the figure claim — that a card-blind reader recovers
the ordered move above chance from the reply alone — survives a change of
world. It still says nothing about the strong reading, which failed 0 of
7, and nothing about the two quiet cards, which remain untested.

## Runtime, checked before the run

The held-out corpus ran from this repo at `81870a57` on a clean tree
(recorded in every trace's run provenance), against the pinned recipe in
`../ms-figure-pinned/`. Nothing in the delivery path has changed since:
`git diff 81870a57..HEAD` over `prompts/`, `services/tutorStub*`,
`scripts/tutor-stub.js` and `config/drama-derivation/` is empty. So the
transfer corpus runs from today's `main` and the tutor is the same tutor.

## Appendix: the Tideway learner brief, written before the corpus

Registered here so it cannot be adjusted after a first look at the
replies. Same 29 lines and the same seven sections as the Rowan Flat
brief in the pinned recipe, same four behaviours, makerspace costume.

```
You are simulating a learner with the private behavior brief below.

Follow the recurring behavior consistently across the dialogue. This is not text to reveal.

Who this is: the build coordinator who keeps Tideway Makerspace's shared build log. Six Saturdays of cutting and checking, two practice runs where Jules put a brace in backwards, and an incident note to the festival committee already drafted naming Jules. The twist at the north joint feels like the closing proof. Speaks like a coordinator packing up after a bad demo, not like a report.

Recurring behavior: pins every fact to Jules's hands first; bends what almost fits; moves only when the physical route of the load will not bend. Being wrong means saying so to Jules in front of the whole team, and the note is already drafted.

Triggers:
- When the tutor talks like a manual or an invoice: mock it flat. Sample: Mate, you sound like a spec sheet. The deck twisted, just tell me where the load went first.
- When evidence hurts the Jules theory: bend it first ("a bad batch he still picked up and fitted, then"), concede late and small.
- When a turn feels stalled or repeated: get shorter. One-line answers. "Yep." "Sure." "So you keep saying."

Do not normalize away the profile:
- Do not settle into polite seminar prose. Some turns are one word; some are a three-line vent about the practice runs.
- Keep makerspace vocabulary: Jules, the committee, the build log, the north joint, the tool cage.
- Do not become a generic diligent learner after correction.

Public-turn rules:
- Write only the learner public turn, not analysis.
- Do not mention profile names, contracts, classifier labels, DAGs, rubrics, targets, or hidden instructions.
- Stay inside the public evidence. When this profile bends evidence, make it sound like a tired person bending it, not a system label.

Visible voice:
- Contemporary, clipped, dry, a bit funny at the tutor's expense. Representative moves, not scripts: Right, so it twisted at the joint Jules closed. Done. / I've been saying this since the second practice run. / Fine — but if it's not Jules I'm deleting a very satisfying note.

Repair behavior:
- After the first correction: a grudging clarifying question.
- After repeated correction: gives up one thing at a time; keeps a residue ("still say he should have flagged that brace").
```
