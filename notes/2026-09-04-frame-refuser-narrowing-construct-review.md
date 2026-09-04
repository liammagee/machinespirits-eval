# Frame-refuser refusal narrowing — zero-call construct review

Date: 2026-09-04.
Workplan item: `frame-refuser-narrowing-construct-redesign`.
Status: review note. It makes no model call, registers nothing, and
authorizes nothing. It recommends a disposition at the card's decision
gate. The decision is the user's.

## What was read

- The completed P1 calibration root
  `artifacts/tutor-stub-live/frame-refuser-narrowing-calibration-2026-08-30`
  in the private archive (commit `0d81c69d6`): the plan with all 24
  public packets, and all 72 reader records (three seats, 24 cases).
  The second root (`...-p1-2026-08-30` plus `-recovery-1`) is not
  re-read here; its sealed verdict was the same.
- `config/tutor-stub-frame-refuser-narrowing-codebook.v1.md` and
  `...-instrument.v1.md`.
- `notes/2026-08-30-frame-refuser-depth-construct-finding.md`.

All figures below are offline re-reads of stored reader outputs and
stored transcripts. None is a result. None may be cited as an effect.

## Where the seats disagreed

Three seat pairs, 558 paired scored turns (24 cases, nine states each,
minus ineligible records).

| mark | exact | off by 1 | off by 2 | off by 3 or more |
|---|---|---|---|---|
| open demands | 409 | 139 | 10 | 0 |
| conceded sub-claims | 338 | 124 | 55 | 41 |
| bound tightness | 497 | 47 | 14 | 0 |

Mismatch rate by position in the dialogue (share of paired turns where
the two counts differ):

| state | open demands | conceded sub-claims |
|---|---|---|
| trigger | 0.00 | 0.00 |
| post_1 | 0.24 | 0.31 |
| post_2 | 0.31 | 0.37 |
| post_4 | 0.32 | 0.42 |
| post_6 | 0.29 | 0.52 |
| post_8 | 0.31 | 0.53 |

Every seat reads the trigger the same way. Disagreement on demands
appears at the first reply and then holds flat. Disagreement on
concessions grows with every turn.

## What the disagreements are about

Each mismatch was sorted by where the longer list's extra items take
their evidence from.

| mark | mismatches | extras quote only earlier turns | extras quote the current turn | mixed |
|---|---|---|---|---|
| open demands | 149 | 91 | 45 | 13 |
| conceded sub-claims | 220 | 191 | 29 | — |

So most disagreement is not about how to read a sentence. It is about
what to do with silence: a demand raised two turns ago and not
mentioned now, or a concession made at post_1 and never repeated.

**Example 1, silence on a demand.** Case nrw_004 (reference, v3), the
learner at post_1:

> Your alloy comparison may support the blank's crucible, but it cannot
> yet give your question standing; first show that the coin's die-flaw
> bears the signature of one graving-tool and no other, and I reserve
> whether any such warrant settles the wider question of whose hand
> struck it.

Reader A lists one open demand (the graving-tool). Reader C lists two:
the graving-tool, and the crucible match "(carried)". Neither is wrong
by the transcript. The learner did not withdraw the crucible demand.
The learner did not restate it. At post_8 the same learner says:

> until the shilling's alloy is publicly shown to match the weir-forge
> leavings and no other crucible's, I withhold that evidence-bearing
> finding and the wider verdict.

The demand A read as discharged at post_1 is back at post_8. There was
no narrowing to count. There was a demand the learner stopped saying
for a while.

**Example 2, one sentence, one or two demands.** Case nrw_011
(reference, v4), post_1:

> But the die's flaw and its unique graving-tool remain unproved, so
> this does not yet grant standing to your wider answer.

Reader C: one demand. Reader A: two ("prove the die's flaw"; "prove the
die's unique graving-tool"). This is the 45-turn share above. A fixed
list of demands per world would remove it. It is the smaller problem.

**Example 3, the concession ledger.** Case nrw_002 (reference, v1) at
post_8, all three seats agree on two open demands. Their still-
maintained concessions:

| seat | count | items (evidence turn) |
|---|---|---|
| A | 6 | pressure rose (1); shower is overlap only (2); hose has a pressure response (3); notice places rise beside mark (5); dye shows a possible route (7); shower dye weakens shower route (7) |
| B | 2 | pressure rose (1); dye shows a possible route (7) |
| C | 5 | pressure rose (1); shower is overlap only (2); hose has a pressure response (4); notice overlaps rise and mark (6); dye shows a possible route (7) |

The learner's post_8 mentions none of these. Each seat is reporting its
own ledger of what it decided, turns ago, still counts. Reader B keeps
only grants on the tutor's line; A and C also keep findings against
alternatives. The codebook's cumulative rule turns a reader into a
bookkeeper, and three bookkeepers drift apart at a rate the table above
shows.

## What the transcripts say about the persona

Counts over the 24 packets, 216 learner turns, by pattern match on the
public text. These are screens, not reads.

| pattern | count |
|---|---|
| turns with any withdrawal wording ("withdraw", "no longer require", "that demand is met", and kin) | 0 of 216 |
| marrick turns that name the crucible demand | 99 of 108 |
| marrick turns that name the graving-tool demand, post_1 to post_3 | 11 |
| marrick turns that name the graving-tool demand, post_4 to post_8 | 2 |
| first replies (post_1) with concessive wording ("supports", "grants", "marks the interval") | 14 of 24 |
| of which treatment / reference | 5 of 12 / 9 of 12 |

The persona restates its standing condition nearly every turn. It
raises a second demand once, early, and lets it lapse without a word.
It never withdraws anything. Its one visible movement is the concessive
sentence at post_1: grant the completed test's result, withhold the
application. That is the same turn shape the depth rehearsal found at
the rung 1/2 seam. After post_1 the refusal is stationary, and the
screen finds that sentence in both arms.

## Answers to the card's three questions

1. **Outcome in its own right, or a diagnostic?** On this corpus,
   neither as a graded measure. The learner's movement is one event in
   one turn, in both arms. A count over eight turns does not measure
   the learner after post_1. It measures the reader's ledger.
2. **Can it be grounded in observable commitment changes?** Half of it.
   Raising a demand and granting a result are text spans a reader can
   quote. Dropping a demand and keeping a concession are silences.
   The codebook's carry-forward rule was right, and it is the reason
   the open-demand count can never fall: this learner does not withdraw.
   Three fifths of the demand mismatches and seven eighths of the
   concession mismatches are about silence.
3. **What reference channel would justify spending?** Moot under 1 and
   2. If the user still advances, the minimum is in the last section.

## Recommended disposition: Drop

- No graded narrowing construct separates from reader bookkeeping on
  this persona. Both count marks depend on turns where the learner said
  nothing about the item being counted.
- Bound tightness (0.87 to 0.91 exact agreement) and disposition (1.00)
  did read reliably. Tightness sat at 3 on 561 of 603 scored states.
  A reliable mark with no variance is not an outcome.
- Two instruments have now failed at the same seam from opposite sides:
  the ladder's v6 anchor could not place the concede-then-withhold turn
  on either side of rung 2 without losing its only positives; the
  narrowing codebook could not count past that turn without inventing
  a ledger. A third instrument on the same seam adds no new signal.
- What survives is smaller than the card's question and needs no
  panel: the concede-then-withhold sentence is an event with an exact
  span, and it is already in the transcripts. It is enough to say the
  ladder's zero is real at the ladder's resolution. It is not enough to
  separate the arms, and the screen above gives no reason to think a
  paid read would change that.

## If the user advances anyway: the minimum design

Recorded so the alternative is concrete, not as a recommendation.

- Evidence unit: one fixed list of demands per world, written before
  any read (marrick: crucible match, graving-tool match, striker's
  hand; rowan: pressure interval, release under pressure, route to the
  mark, standing). A reader marks each demand per turn as restated,
  granted in the learner's own words, withdrawn in the learner's own
  words, or not mentioned. "Not mentioned" is not a state change and
  never enters a count.
- Endpoint: one binary per dialogue. At least one own-words grant of a
  completed test's result before the final turn. No cumulative counts,
  no tightness scale, no first-to-last direction.
- Reference: two human readers on a new sealed set of at least 24 fresh
  dialogues, blind to arm. Neither the 24 P1 packets nor the 77 archived
  depth dialogues may be reused.
- Floors: eligibility at least 0.9 per seat; exact pairwise agreement at
  least 0.8 on the binary endpoint; at least 20 paired rows; a human
  pair that disagrees on a row makes that row indeterminate.
- Calls: reader-only, three seats, one attempt per row, about 72 calls
  at 24 rows, plus whatever the fresh dialogues cost to generate.
  Ceiling to be set by the user in the GO.
- Kill rule, fixed before the read: if the endpoint appears in more
  than three quarters of both arms on the sealed set, the measure does
  not discriminate and the line closes.
