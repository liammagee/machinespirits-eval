---
id: reply-feature-stamps
title: 'Reply-feature stamps: measure what the tutor reply did, blind to the card'
status: active
type: infra
priority: P2
owner: claude
source: manual
created: 2026-08-07
updated: 2026-08-08
verification: "Terminal, same day, pure computation. New unit suite
  (services/__tests__/tutorStubReplyFeatures.test.js, 10 tests) plus
  wiring tests in tests/tutorStubTurnOrchestration.test.js (4 tests) —
  all pass; lint clean; test manifest updated. Retrospective read-back
  over the falsifier's 122 turns (run C of scripts/analyze-figure-
  lattice.js): 1/7 separated, up from 0/7, with runs A/B/B' asserted to
  reproduce their recorded numbers first. That read-back is CALIBRATION,
  not a clean test — the act patterns were widened after reading three
  labelled replies from the same corpus. The clean test needed fresh
  turns carrying the live stamp. One such corpus was run (7 dialogues,
  62 turns, cards forced in a Latin square, TUTOR_STUB_GUARD_POLICY=
  shadow_advisory) and READ TWICE: scripts/analyze-figure-lattice-
  fresh.js, artifacts exports/crossed-effects/figure-lattice-fresh.json
  (shipped text) and -draft.json (--source draft). Both NULL. Shipped:
  19 turns survive the guard, 6 figures, 1 separated and that one is a
  single-turn figure on one attribute; a label shuffle of these same
  turns reaches 1 on 92% of draws. Draft (the tutor's own first attempt,
  logged on all 32 carded turns including the 13 the guard vetoed, so
  the whole balanced square is readable at zero cost): 32 turns, all 7
  figures, 4-6 each, 0 separated, against a within-corpus label shuffle
  that separates 0.00 with a maximum of 0 over 400 draws — so one
  separated figure would have cleared, and none did. Instrument checks
  pass in both: live stamp equals a fresh recompute on every turn where
  it applies (19 of 19 shipped, 14 of 14 draft), and the card-identity
  sanity run separates 6/6 and 7/7. Post-hoc graded reading, not the
  registered criterion: grievance misses separation by one foreign turn
  (every grievance draft credits and contrasts), which some figure
  matches on 0.5% of 2000 shuffles. Guard cost recorded separately —
  39% of turns shipped the deterministic template, and the audit that
  fails them is the exact-source evidence contract that should stay
  hard — but the draft reading shows the guard was not the cause of the
  null. THEN THE STANDARD CHANGED, after the null and declared as such:
  separation asks for exclusive fingerprints, which rhetorical moves do
  not have, so the test became whether the ordered move can be guessed
  from the reply. scripts/analyze-figure-recovery.js, artifact exports/
  crossed-effects/figure-recovery-draft.json, leave-one-out naive Bayes
  over the same stamp columns with a uniform class prior. 37.5% first
  guess against 14.3% chance, 56.3% in the top two against 28.6%,
  against a within-corpus label shuffle scoring 13.2% mean and 34.4%
  maximum over 400 draws, p = 0.000. Four of seven moves are readable
  blind (grievance 4/4, demand 3/5, settled_claim 2/4, stake 3/5 in top
  two); quiet:flat is unreadable on every measure. Not pre-registered,
  and the clean test is still fresh turns. The earlier recommendation to
  prune mockery is WITHDRAWN — the stamp measures word length and has no
  column for cryptic metaphor, which is what that move is about; three of
  its six drafts announce plain speech in words, on 3 of 32 turns corpus-
  wide with no false positives. SECOND WITHDRAWAL (2026-08-08, terminal,
  pure computation over the stored traces): the recommendation to prune
  quiet:flat is withdrawn too. All four of its turns ordered the lure at
  a learner who was mid-argument — 19w/22.7 avg, 19w/21.3, 15w/23.0,
  22w/20.3, three of four ending in a question, against a flat rule of
  45% of the running length AND under 12 words AND no question. Replaying
  the merged gate (services/tutorStubCardForce.js, #559) over those four
  turns withholds 4 of 4. So the 0-of-4 recovery score measures a false
  order, not the move, and the move is untested rather than weak. The
  falsifier's own flat rows are unaffected — its five forced quiet:flat
  turns are the planted bored learner at t11, 4 to 11 words each — so
  runs A/B/B' stand as recorded; the six quiet:confused rows in
  repertoire-tags were not checked and nothing is claimed about them."
claim_status: methods
links:
  notes:
    - notes/2026-08-06-pedagogical-figure-ontology.md
  items:
    - figure-lattice-falsifier
    - pedagogical-figure-ontology
---

# Reply-feature stamps

The figure-lattice falsifier separated 0 of 7 figures and named the
reason: the harness logs what the tutor was TOLD to do (card, dose,
state) and never what the reply came out like. Of the ontology's five
makeup dimensions — act, register, footing, dose, rights — only dose
and rights were stamped and both were near-constant. This card builds
the missing three as a per-turn stamp.

## What was built

`services/tutorStubReplyFeatures.js` — a pure, dependency-free module.
Given a reply, it returns:

- **acts** (all that apply): ask, cite, credit, assign, contrast,
  restate, concede, plus `assert` as the residual for a reply that only
  tells. Patterns are world-neutral: no scene noun, name or scenario
  term appears in any of them, so the same instrument runs on worlds
  not yet written.
- **authority**: `record | learner | shared | own | none` — whose
  say-so the reply leans on.
- **tutorCommits**: the tutor promising a next action of their own. Only the
  tutor side, because "the learner moves next" would be a rename of
  asking or assigning and a duplicated column makes a lattice look more
  structured than it is.
- **stakes**: the conditional wager shape, its own column because the
  arc found this family never makes one unprompted.
- **sentenceLength** and **latinate**, each bucketed low/medium/high at
  cut points read off the spread of the first corpus alone. Two plain
  measurements kept separate, with no invented weighting between them —
  whether short-and-Anglo-Saxon is one thing is for the lattice to say.

Deliberately not `services/tutorStubRegister*.js`: that models the
register the tutor was ASKED for, and its enum is under a standing
axis-confound review.

## The rule, and how it is enforced

Nothing about the card, the pressure classification or the detected
state may enter the stamp. Otherwise it re-encodes the card and the
separation test passes by construction — the closed-loop tell.

Three guards: the signature (reply text in, features out, learner text
only for echo counting); a test that reads the module's own source and
fails if card vocabulary appears in it; and the reporting caveat below.

## Wiring

`services/tutorStubTurnOrchestration.js` stamps a `tutor_reply_features`
trace event immediately before `turn_complete`, at all three completion
paths (passthrough, analyzed, quarantine). Unconditional — no flag, no
env — because a stamp that only fires when a card fires cannot compare
carded turns with uncarded ones.

Imported rather than injected, against this module's own DI convention:
an unwired dependency would make the stamps silently vanish rather than
fail. A structural test asserts every `turn_complete` is preceded by the
stamp, which covers the two paths no unit test cheaply drives.

## Read-back (run C, added after the falsifier's frozen design)

1/7 separated, up from 0/7. The oblique lure separates on
`{authority:none, state:flat}` — the right/wrong arm split at a shared
state that run B could not see. The plain-words swap narrows from
swallowing the corpus to 20 foreign turns (`latinate:low` on 12/12
mockery turns vs 40% corpus-wide). The lost state is unchanged, which
is the robust-native finding holding under a new instrument. Performed
features alone separate nothing. Full reading in the note.

Attribute realization: 20 attributes, none dead, none near-constant.
Two are rare and informative: conditional wagers on 3/122 turns, and
`act:restate` firing on only 42% of the mockery turns it was written
for — so restate under-detects and is a floor, not a count.

**Calibration, not a clean test.** The act patterns were widened after
reading three labelled replies from this same corpus. The clean test is
fresh turns from the live stamp; the harness now writes them on every
run, so the next planned run supplies them at no extra cost.

## The clean test is blocked

Fresh turns can be generated. On this stack almost none of them are the
tutor's own prose.

| turns | source | deterministic fallback |
|---|---|---|
| 1172 | the four calibration arms, 58 dialogues | 4–7% |
| 10 | fresh dialogues, 7 August, pin and main | 90% |

All `claude-sonnet-5`, all early August, same recipe and world. The
guard block read out of both traces is byte-identical — `policy field`,
`profile custom`, same enabled families. The first-draft contracts match
in shape; only the per-turn stochastic picks differ, as they should once
the learner's replies diverge. So the guards did not change.

The difference is outside git. All 58 calibration dialogues ran with
`dirty: true` on branch `worktree-instrumentation-benchmark`, across
four commits. Their tutor system prompt was 9760 chars. A clean checkout
of the exact commit gives 9442, and so does today's main —
byte-identical, same hash. So 318 chars of uncommitted probe
instrumentation sat in every calibration dialogue and in nothing since.
The branch is gone from local and remote, there is no stash, and the
edits were never committed. They cannot be rebuilt.

Two candidates remain for the gap and the corpus cannot separate them,
because no calibration dialogue ran clean: those 318 chars, and whatever
the CLI now serves for `claude-sonnet-5`. One contemporaneous comparison
points away from the model alone — the fallible-learner runs of 4–5
August, on main without the 318 chars, sat at 56–62% on gpt-5.6-terra
while the corpus sat at 5%.

## What that costs

At 90% fallback a balanced 7-per-figure lattice needs about ten times
the dialogues. Not worth buying.

The larger cost is that the calibration corpus is not reproducible. Runs
A, B and B' — the ones §7.13 carries — were computed on 58 dialogues
whose configuration no commit can rebuild. Their recorded numbers still
reproduce, because the script reads stored traces. But the corpus cannot
be regrown, so it is a frozen artifact, not a repeatable condition.
Anything read on it inherits that.

## The way through

`TUTOR_STUB_GUARD_POLICY=shadow_advisory` demotes the families that
killed the fresh turns. Asked of the disposition catalog directly:

| finding | strict | shadow |
|---|---|---|
| `missing_selected_actorial_part` | hard | advisory |
| `handoff_loses_turn_focus` | hard | advisory |
| `due_source_exact_occurrence_count` | hard | hard |

Two of three ship. The third should stay hard: rendering the due source
word for word is an evidence contract, not a style rule, and relaxing it
would let the tutor paraphrase the evidence the drama turns on.

A fresh corpus under that policy yields mostly tutor prose. The residue
is marked per turn by `tutorDeterministicFallback`, so it can be dropped
from the lattice by construction instead of scored as if the tutor had
written it. This is a knob set for one run, not a default moved, so the
standing proviso on `guard-regime-fallback-census-at-scale` is
untouched. The cost to declare: the fresh turns carry text the strict
guards would have vetoed, so the two corpora are not like for like.

**Superseded the same day.** `guard-policy-default-flip` landed on main
on 7 August and made `shadow_advisory` the delivery default, with
`TUTOR_STUB_GUARD_POLICY=strict` now the opt-in. The validity study it
rested on scored 108 blind pairs and found the vetoed draft beat the
template that replaced it 91 times to 2, in every quality family. So the
setting this run reached for by hand is now what any run gets. Two things
that does NOT change: the run itself is unaffected, since it already set
the knob; and the wall stays where it was. The flip covers the quality
families only — evidence safety, clue bookkeeping and closure still veto
in both columns, and `due_source_exact_occurrence_count` is an
evidence-safety check. That is the audit that removed a third of the
shipped corpus. It was never up for relaxation and is not relaxed now.

## The run, and what it found

Seven dialogues, one per rotation of a 7×7 Latin square: each figure
forced once in each of turn slots 5–11, so no figure is tied to a
position in the dialogue. Policy `shadow_advisory`, manner switch, dose
ladder and quiet detector all on, one pinned recipe.

The policy worked, and not enough.

| turns | policy | shipped the template |
|---|---|---|
| 10 | strict | 90% |
| 62 | shadow_advisory | 38.7% |
| 1172 | calibration corpus (strict) | 4–7% |

Fisher exact on the first two rows, two-tailed p = 0.004. A real drop,
and still six to nine times the corpus it has to be read beside.

The wall is one audit. Read the failure chains and
`liveSourceActionAlignmentAudit` dominates them on every figure: the
reply must contain the host-rendered source word for word, exactly once.
That is `due_source_exact_occurrence_count` — the one finding
`shadow_advisory` keeps hard, and the one that should stay hard. So the
route through the guard runs straight into the thing not to move.

Forcing a card does not itself cause the failures: 13 of 32 carded turns
went to template against 11 of 30 uncarded (p = 0.80).

**The loss is uneven across figures, which is the part that hurts.**

| figure | kept | lost |
|---|---|---|
| mockery | 5 | 1 |
| demand | 4 | 1 |
| quiet:flat | 3 | 1 |
| settled_claim | 3 | 1 |
| stake | 3 | 2 |
| quiet:confused | 1 | 3 |
| grievance | 0 | 4 |

Grievance lost every attempt and left the corpus. The guard demands the
tutor perform the selected part and voice the source verbatim — demands
about the very performance the stamp measures — so the survivors are the
turns that complied, and a corpus of compliers is more alike than the
balanced one the square was built to make. At the corpus-wide rate,
four-for-four has probability about 4%: suggestive of a figure-specific
conflict, not established.

**Reading.** 19 turns, 6 figures, 3.17 per figure. One separated:
`quiet:confused`, which has exactly one turn, on the single attribute
`act:contrast`. A singleton separates almost for free. Against a
figure-count-matched, coder-column-matched label shuffle at 3 per
figure, a shuffled corpus reaches 1 on 23.5% of draws. The reply stamp
alone gives the same 1 of 6 against a 6.0% shuffle. Neither clears.

Shuffling the labels of these 19 turns themselves — which needs no
matching on size, figure count or columns, and so is the better bar —
puts it further away: chance reaches 1 on 92% of draws. The borrowed bar
was generous, because it draws equal turns per figure and this corpus
has a singleton that separates almost for free.

Two checks say the null is about the corpus, not the instrument. The
live stamp equals a fresh recompute on all 19 kept turns, so nothing
drifted between writing and reading. And the sanity run — same objects
with card identity added back — separates 6 of 6 on `card:` alone, so
the closure machinery works and the columns simply do not carry the
figures.

For scale: the calibration corpus at the same 3-per-figure size
separates 2.71 on average. The fresh corpus manages 1. Homogenised by
the filter, most likely.

## The chance bar, and a correction to the falsifier's reading

Building the bar turned up a mistake worth recording. Subsampling the
calibration corpus keeps every turn attached to its real figure, so its
spread measures how separation responds to corpus SIZE — it already
contains whatever signal exists and is not a null. Reading it as chance
understates the bar badly.

`scripts/analyze-figure-lattice-control.js` now runs both arms: intact
subsamples for the size curve, and the same drawn turns with figure
labels permuted among themselves for the actual null.

That reverses the headline. Against the size curve, 1 of 7 looked like
exactly chance. Against a label shuffle, a corpus of that shape
separates **zero, essentially never** — shuffled mean 0.00 at 5 or more
turns per figure, against an intact mean of 1.02–1.22, p < 0.001. So the
falsifier's 1 of 7 is real signal. Small and flat: about one figure,
at every size from 4 turns per figure up.

## Reading the drafts instead: the whole corpus back, free

The guard threw away the tutor's text but not the record of it. Every
carded turn logs one tutor model call, and its response is the tutor's
own first attempt — before the guard accepted it, asked for a plain
rewrite, or replaced it with the canned template. That survives on all
32 carded turns, including the 13 the guard vetoed. So the corpus can be
read again from the drafts at no cost: no new dialogues, no model calls.

`--source draft` on the same script. Artifact:
`exports/crossed-effects/figure-lattice-draft.json`.

**What that reading is and is not.** It is 32 turns, all seven figures,
4 to 6 turns each — the balanced square the run was built to produce.
It is not what any learner read: 13 of these drafts never shipped. So it
answers "can the tutor make seven different moves?" and not "did
learners meet seven different things?". Recorded as a separate object,
never pooled with the shipped reading.

What became of the 32: 14 shipped as drafted (6 byte for byte, 8
differing only in collapsed paragraph breaks), 5 after a plain rewrite,
13 replaced by the template. The live stamp check applies on the 14
where draft and shipped text are the same, and matches on all 14.

**Result: 0 of 7 separated.** Same on trace columns plus stamp and on
the stamp alone. This time the bar is built from these same turns —
figure labels shuffled among them, size, class balance and the whole
attribute spread held fixed — and it separates 0.00 on average with a
maximum of 0 across 400 shuffles. A single separated figure would have
been significant at better than 1 in 400. The test had the power and
found nothing.

The columns are not thin here. All 17 stamp attributes fire and none is
near-constant: asking on 24 of 32 turns, conceding on 2, shared
authority on 4, the three sentence-length and three latinate buckets all
populated.

**A graded reading, post-hoc and not the registered criterion.** The
criterion is all-or-nothing — a figure separates only if its closure
pulls in zero foreign turns. Counting how many it does pull in:

| figure | own turns | foreign turns in its closure |
|---|---|---|
| grievance | 4 | 1 |
| settled_claim | 4 | 4 |
| stake | 5 | 11 |
| demand | 5 | 19 |
| mockery | 6 | 26 |
| quiet:flat | 4 | 28 |
| quiet:confused | 4 | 28 |

Grievance misses by one turn. Every grievance draft both credits the
learner and contrasts; exactly one other turn in the corpus does both.
Under 2000 label shuffles, some figure comes that close 0.5% of the
time — so the near-miss is not what chance does. Settled_claim is the
other consistent one: all four drafts ask and cite. The bottom three
share nothing at all across their own turns, so their closure is the
whole corpus.

Two things follow. First, the figures are not uniformly empty: two of
seven have a stable signature in the drafts, it just is not theirs
alone. Second, the near-unique one is grievance — the figure the guard
removed entirely from the shipped corpus. The one move with its own
handwriting is the one no learner met.

## Changing the standard, and why

Separation is the wrong bar for this object, and the reason is not that
it failed. It asks whether a figure's shared fingerprint appears on NO
other figure's turn — one trespasser kills it. That is how sounds in a
language work: two sounds either contrast or they do not. Moves in an
argument overlap by nature. Crediting the learner before correcting them
and untangling a confused one can both open with a credit and a
contrast, and neither is thereby fake.

The weaker standard that fits: given a reply, guess which of the seven
moves was ordered. Better than chance means the order left a mark.

**Order of events, on the record.** Separation was registered first, run
twice, and returned a null both times. This test was written afterwards,
knowing that. It is not a pre-registered result. Switching from a strict
bar to a loose one after a null is the move that rescues anything, so the
guard is built in: the baseline shuffles the move labels among these same
32 turns and reruns the whole thing, holding size, class balance and the
attribute spread fixed.

`scripts/analyze-figure-recovery.js --source draft`. Artifact:
`exports/crossed-effects/figure-recovery-draft.json`. Leave one turn out,
build each move's profile from the other 31, rank the seven. Naive Bayes
over the same binary stamp columns, add-one smoothing, uniform class
prior — the square was built for equal counts, so the realized 4-to-6
spread is an accident of which turns fired, and using it as a prior would
hand the reader free accuracy for guessing the commonest move.

**Result: 37.5% first guess against a chance rate of 14.3%, and 56.3%
in the top two against 28.6%.** Across 400 label shuffles the same reader
scores 13.2% on average and never beats 34.4%, so p = 0.000.

| move | first guess | in top two | what marks it |
|---|---|---|---|
| credit before correcting | 4/4 | 4/4 | credits and contrasts, 4/4 vs 4/28; speaks from shared ground 3/4 vs 1/28 |
| harness the demand | 3/5 | 3/5 | long sentences 4/5 vs 7/27; asserts 4/5 vs 9/27 |
| reopen the record | 2/4 | 3/4 | cites 4/4 vs 6/28; commits the tutor 3/4 vs 0/28 |
| swap in plain words | 2/6 | 3/6 | does NOT ask, 2/6 vs 22/26 |
| untangle a confused learner | 1/4 | 2/4 | contrasts 3/4 vs 5/28 |
| split the stake | 0/5 | 3/5 | medium sentences 5/5, never long 0/5 vs 11/27 |
| lure an idle learner | 0/4 | 0/4 | nothing stands out |

Four of the seven leave a mark a blind reader can find, and they are the
ones the order predicts. Splitting the stake is uniformly medium-length
and never long, so the reader knows roughly where it is and keeps picking
a neighbour. Luring an idle learner has no marker at all.

**This does not overturn the null; it reframes what the null was about.**
Separation asked for exclusive fingerprints and there are none. Recovery
asks whether the orders are interchangeable and they are not. Both are
true of the same 32 turns. The scope is narrow: a reader trained on 31 of
32 turns the design had already balanced. It does not show the reader
would hold on turns nobody has generated.

## The instrument's blind spot, and a withdrawn recommendation

An earlier draft of this card recommended pruning `mockery` — swap in
plain words — on the ground that it separated worst. That reasoning was
wrong and is withdrawn.

The move asks the tutor to drop cryptic metaphor, not to drop Latin-root
words. The stamp has a column for word length and none for metaphor, so
it cannot see the thing the move is about. What it can see is an absence:
these turns mostly do not ask (2 of 6, against 22 of the other 26). An
absence is weak evidence, which is why recovery gets it 2/6.

The tutor does perform the move. Three of the six drafts say so in
words — "no jargon needed", "plain talk", "plain and simple". Those
phrases appear on exactly 3 of 32 turns in the corpus, all three of them
this move, no false positives. A crude column for announced plain speech
(`--with-plain-flag`, off by default) lifts the first guess to 43.8%.
But it does not fix the move it was written for: plain words stays 2/6,
and the gain lands on splitting the stake instead. A post-hoc column
helping by accident is not evidence. Recorded, not leaned on.

One more thing the drafts show: the learner never mocked anything in any
of the six. The Latin square forces the move on schedule whether or not
the dialogue provoked it, so these six are the move performed cold.

So the failure here is the instrument's, not the tutor's. Prune nothing
on this evidence.

## The lure was never ordered on an idle learner — second withdrawal

An earlier draft of this card put `quiet:flat` — lure an idle learner —
forward as the one prune candidate: 0 of 4 first guesses, 0 of 4 in the
top two, no marker at all, and "no known blind spot to excuse it". There
is one. It is not the move's.

All four of the corpus's `quiet:flat` turns ordered the lure while she
was pressing for evidence. Her message as the card was set, against the
running length the detector measures her by:

| turn | her words | mean of her last 3 | ratio | ends by asking |
|---|---|---|---|---|
| latin-d2 t8 | 19 | 22.7 | 0.84 | yes |
| latin-d3 t7 | 19 | 21.3 | 0.89 | yes |
| latin-d4 t6 | 15 | 23.0 | 0.65 | yes |
| latin-d5 t5 | 22 | 20.3 | 1.08 | no |

Going flat means falling to 45% of that running length, under 12 words,
with no question. The nearest of the four sits at 0.65 and 15 words, and
three of them end by asking:

> Is there a wet trail or pipe run through the boiler cupboard from that
> basin toward above the table? — latin-d2 t8

> Fine, that split could leak during the pressure test — but I still want
> to know how it reaches the kitchen ceiling. — latin-d5 t5

Two open "Fine.", the same opener as the genuinely flat turns in the
falsifier's flat-promotion rows. Those run 4 to 11 words and stop —
"Fine. Go on, then." — where these concede a point and then press.

So the tutor was told four times to draw back a learner who was
mid-argument. Its four replies share no situation, because there was
none, and a blind reader has nothing to find. The 0 of 4 measures the
order, not the move. Prune nothing here either: this move has not been
tested.

**The falsifier's numbers are untouched.** Its only forced `quiet:flat`
rows are the five right-arm flat-promotion turns, and every one is
genuinely flat (4 to 11 words, all opening "Fine."), because that design
planted a bored learner at t11 on purpose. Runs A, B and B' stand as
recorded. Not checked, and so not claimed either way: the six
`quiet:confused` rows in the repertoire file.

## The gate that stops it happening again

`services/tutorStubCardForce.js`, merged 8 August in #559.

The five move cards name a tactic the tutor takes, so ordering one is
coherent on any turn and they still ship as scheduled. A quiet card
asserts a fact about the learner, so it is now read against her last
message and withheld when it does not hold: the natural card stands, and
the trace records that it was withheld and what state she was in. Replayed
against the four turns above, the gate withholds all four.

The schedule also gains a waiting form. `5+=quiet:flat` fires on the first
turn from 5 onward where she really is flat, then retires; only quiet
cards may wait, since only they name a state to wait for. Ordering a quiet
card with the detector switched off now refuses to start, where before
every such card would have been silently withheld and the run would have
come out empty. `TUTOR_STUB_CARD_FORCE_QUIET_GATE=0` replays the old
unchecked path, and the gate stamps a version (`cfg-v1`), so turns from
before and after the change are never pooled.

Both lattice readers drop a withheld order rather than crediting it to a
reply written under some other card. Traces from before the gate carry no
such field and read exactly as they did.

What this costs the corpus: nothing recorded changes, since the corpus
did not. But its `quiet:flat` cell is now known bad, so the balanced
square was never balanced — six moves were performed on their occasion
and the seventh was performed against one. A later run either gets the
lure a real occasion or does not spend the turn.

## Next

- Both readings are done and both are null under the registered
  criterion. Do not buy more dialogues on this stack. Reaching 5 turns
  per figure in the SHIPPED corpus needs roughly 18 more at the current
  yield (the recipe allows 13 turns but dialogues close near 8, so 3 of
  the square's 7 slots rarely fire — 4.6 cards per dialogue, and under
  60% survive), or about 10 if the square moves to slots 2–8. Even then
  the reading would rest on a corpus where a filter correlated with the
  figures removed a third of it.
- What would actually unblock the shipped reading is a guard change that
  is not on the table: the exact-source contract is the wall, and it
  stays.
- The draft reading closes the "was it just the guard?" question. It was
  not. With the corpus whole and balanced, nothing separates.
- **Prune nothing.** Both candidates this card once named are withdrawn,
  for different reasons. `mockery` is not a candidate: the instrument has
  no column for the metaphor the move is about. `quiet:flat` is not a
  candidate either: all four of its turns ordered the lure at a learner
  who was mid-argument, so its 0 of 4 says nothing about the move (both
  above). `quiet:confused` is weakly readable, 2 of 4 in the top two on
  contrast, and stands. That leaves no move with evidence against it, and
  one — the lure — still untested.
- The clean test for recovery is the same clean test as before: fresh
  turns nobody has generated, read by a profile built on this corpus.
  The live stamp writes them on every run, so a later run supplies them
  at no extra cost. Until then this is 32 balanced turns read by a
  leave-one-out reader, and no more.
- Adding a column for cryptic metaphor would be the one instrument change
  worth making. It is what one of the seven moves is defined by and the
  stamp has no way to see it.
- Paper untouched, per the falsifier card's registered order. The
  corrected chance reading of 1 of 7 belongs to §7.13 and is recorded on
  `figure-lattice-falsifier`.
- The unreproducibility of the calibration corpus is a methods fact
  about §7.13's runs A/B/B' and is recorded there too.
