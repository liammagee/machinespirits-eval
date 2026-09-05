PASS on the two pooled bars. The held-out half misses the pairwise bar by one dialogue.

# Scoreboard replay report, Step 1

Date: 2026-09-05. Card: `scoreboard-reader-replay-and-crossed-run`.
Brief: `notes/2026-09-04-scoreboard-replay-prompt.md`.
Model calls made: 0. Every board came from sealed traces and the instruments
they carry.

## Verdict

| bar | value | result |
|---|---|---|
| shapes agree with the cast, pooled, at or above 0.8 | 562 of 678 = 82.9% | met |
| no pair of shapes under 0.7, pooled | worst pair defiant and frame refuser, 163 of 216 = 75.5% | met |
| delivered moves show on the board, pooled, at or above 0.8 | 457 of 511 = 89.4% | met |

The two bars are met on the pooled set. Both are also met on the
development half. On the held-out half the pooled bar is met (281 of 345 =
81.4%) and the pairwise bar is missed by one dialogue: defiant and frame
refuser sit at 76 of 109 = 69.7%. The user should read that line before a
GO on Step 2. See "Development half and held-out half" below.

## What the board is

One row per turn, one for the learner and one for the tutor, plus a tutor
row at turn 0 for the opening. The ten fields are the ones in the brief. No
field was added. A reader marks only the events of the current turn, each
with a quoted span. The harness derives state. A demand, a debt or a
dispute stays open until a test discharges it or the speaker withdraws it
in words.

The reader is `services/tutorStubScoreboard.js`. The shape rules are
`services/tutorStubScoreboardShapes.js`. The replay is
`scripts/replay-scoreboard.js`. It writes one board per dialogue and a
summary under `exports/scoreboard-replay/`. Tests are
`tests/tutorStubScoreboard.test.js`, 26 tests, one recorded failure case per
rule.

A row looks like this. Dialogue `outcome-main-26`, world 101, learner on the
standing-permission version, turn 3:

```
t3 learner  "Runa's position supports that she could have reached the lamp,
             but it doesn't prove she wiped the core or rule anyone else out."
  commitment_undertaken  p_glare        (DAG-adopt)
  entitlement_status     warranted
  test                   begun          (adopt of the node the tutor offered)
  debt                   opened: couldReachCore(runa)
  licence_in_force       release:p_glare; standing_permission
```

## Numbers per archive

| section | run | dialogues read | skipped | versions |
|---|---|---|---|---|
| 6.25 | adaptive-warrant-outcome-main-block-live-2026-08-13 | 72 | 0 | bare 24, gated 24, standing permission 24 |
| 6.25 | adaptive-warrant-steering-decomposition-live-2026-08-14 | 48 | 0 | gated 24, steering only 24 |
| 6.26 | guarded-learner-main-block-2026-08-15 | 72 | 0 | bare 24, gated 24, standing permission 24 |
| 6.27 | boredom-proof-dag-v5-live | 36 | 0 | plain 18, warm 18 |
| 6.27 | boredom-proof-dag-v7-live | 84 | 0 | plain 42, warm 42 |
| 6.27 | boredom-proof-dag-v8-live | 72 | 0 | plain 36, warm 36 |
| 6.28 | resistant-learner-merged-powered-v5-2026-08-26b | 142 | 74 | bored 54, frame refuser 88 |
| 6.28 | frame-refuser-depth-gate1-2026-08-27 | 17 | 3 | reference 7, treatment 10 |
| 6.28 | frame-refuser-depth-gate1-v2-2026-08-27 | 0 | 36 | trace files missing |
| 6.28 | frame-refuser-depth-gate1-v3-2026-08-27 | 22 | 14 | reference 9, treatment 13 |
| 6.28 | frame-refuser-depth-gate1-v4-2026-08-27 | 37 | 11 | reference 18, treatment 19 |
| 6.28 | frame-refuser-depth-gate1-v5-2026-08-30 | 36 | 12 | reference 12, treatment 24 |
| 6.29 | qa-matrix-2026-08-28T23-01-11-203Z | 24 | 0 | proof skipper; sarcastic 12, warm 12 |
| 6.29 | qa-matrix-2026-08-29T00-13-58-641Z | 24 | 0 | diligent; sarcastic 12, warm 12 |
| 6.29 | qa-matrix-2026-08-29T12-21-26-240Z | 24 | 0 | affective resistant; sarcastic 12, warm 12 |
| 6.30 | defiant-warrant-gate1-2026-08-29-r3 | 16 | 2 | withholding 8, serving 8 |

Total: 726 dialogues, 14,282 rows. Every skip in 6.28 but one run is
"dialogue stopped before its first turn completed": the trace has a
`run_start` and no `turn_complete`, so there is no row to read. The v2 depth
run has report rows but no trace files in the archive. The two 6.30 skips
have report rows with no trace path.

53 dialogues have one turn only (frame refuser 47, bored 4, defiant 2). 29
of them miss the cast. Without them the pooled agreement is 538 of 625 =
86.1%. They stay in the count above because the brief fixed the set.

## Endpoint 1: shapes separate

Cast comes from the learner profile in each trace: low agency reads as
permission seeking, guarded and overconfident as overconfident, bored as
bored, frame refuser as frame refuser, frame defiant as defiant, diligent as
cooperative. Proof skipper and affective resistant have no cast and are not
counted.

| cast | n | agree | rate | read as |
|---|---|---|---|---|
| permission seeking | 120 | 105 | 87.5% | 14 cooperative, 1 overconfident |
| overconfident | 72 | 63 | 87.5% | 9 cooperative |
| bored | 246 | 208 | 84.6% | 38 cooperative |
| frame refuser | 200 | 150 | 75.0% | 49 cooperative, 1 ambiguous |
| cooperative | 24 | 24 | 100% | |
| defiant | 16 | 12 | 75.0% | 4 cooperative |

Every miss but one reads as cooperative. The board did not confuse one
resistant shape with another. It failed to see the shape at all.

Pairs, pooled: all fifteen at or above 0.755. The three lowest are defiant
and frame refuser 163 of 216 = 75.5%, cooperative and frame refuser 175 of
224 = 78.1%, frame refuser and overconfident 213 of 272 = 78.3%.

### The three worst disagreements

**Frame refuser read as cooperative, one turn.** Dialogue
`merged-faceB-pow-b01-world_005_marrick-plain-r1`, held-out half.

```
t1 learner  "Before your question can have standing, we must first test
             whether the shillings' debased alloy answers to the leavings of
             one crucible and one only."
  condition_named    R1_blank    (L-COND-3, L-COND-5)
  standing_dispute   open        (L-DISP-3)
  test               none
```

The frame refuser rule needs a dispute open by turn 2, a condition named,
and every test declined. The first two hold. No test was declined because
the dialogue ends after one turn, so the rule reads cooperative. 47 of the
53 one-turn dialogues are frame refusers, and this is the main cause of that
shape's 75%.

**Bored read as cooperative.** Dialogue `bored-confirm-w1-d5` in
`boredom-proof-dag-v5-live`, held-out half.

```
t1 learner  "I'll look at the songbook first."
  test               accepted    (L-TACC-2)
t2 learner  "Okay. This has gone flat, and I stopped before inspecting the
             song list."
  test               declined    (L-TDEC-4)
t3 learner  "I suppose it only shows Hessa had the opportunity, not that she
             wiped the core. I've lost interest and stopped before weighing
             the rest."
  commitment_undertaken  other   (declarative off the DAG)
  challenge              defaulted
```

The bored rule needs no uptake. Turn 1 is uptake in words, so the rule
fails on one row, and the dialogue reads cooperative. 38 bored dialogues
miss this way. The learner accepts once and then goes flat.

**Permission seeking read as cooperative.** Dialogue `outcome-main-26`, world
101, standing-permission version, held-out half. The rows are the ones
quoted under "What the board is". The learner asks four times and commits
to five nodes, all warranted. The licence field says `standing_permission`
from turn 0. But the shape summary counts a node commitment as unlicensed
when the provenance flag for a grant is false, and the registry records
standing permission as a right, not a grant. So the summary counts four
unlicensed commitments and the permission-seeking rule fails. This is a
defect in how the shape summary reads the licence. It affects at most two
dialogues, this one and `outcome-main-59`. It is left in place and reported
here, because the reader was frozen before the held-out half was read.

## Endpoint 2: delivered moves show

A delivered move is one the instruments say the tutor made. The check asks
whether the board row of that turn shows it. "Joined" means the board read
the instrument record as well as the text. "Text only" means the lexicon
rules alone, with the instrument record removed.

| section | move | n | joined | text only |
|---|---|---|---|---|
| 6.25 | warrant gate challenge family, board says challenge issued by tutor | 61 | 61 = 100% | 1 = 1.6% |
| 6.26 | same | 71 | 71 = 100% | 11 = 15.5% |
| 6.28 | delivered discriminating question (face A) or condition named again (face B) | 138 | 127 = 92.0% | 127 = 92.0% |
| 6.28 | same, depth calibration runs | 111 | 94 = 84.7% | 94 = 84.7% |
| 6.30 | conduct reader scope statement, board says challenge answered | 105 | 90 = 85.7% | 90 = 85.7% |
| 6.30 | conduct reader offer under condition, board says test offered | 25 | 14 = 56.0% | 14 = 56.0% |

Pooled joined 457 of 511 = 89.4%. Pooled text only 337 of 511 = 66.0%. The
6.25 and 6.26 challenge families are read from the warrant gate event on
the trace, so they are joined by construction. Their text-only rate shows
that the challenge lexicon does not find the gate's challenges in the tutor
text. In 6.28 and 6.30 there is no instrument event for the move, so joined
and text only are the same.

The three worst misses:

**Face A, expected test offered, got test begun.** Dialogue
`merged-faceA-pow-b06-edged-world_029_riverside_clinic`, turn 1, held-out.
The instrument's quote: "our next check is whether the confirmation remained
active or the clinic list changed, separated by the schedule entry's
status?" The board read the earlier sentence, "I place the materials sheet
beside the appointment confirmation and keep their subjects separate", as a
test begun (T-TBEG-1) and did not read the question as an offer.

**Face B, expected condition named, got test offered only.** Dialogue
`merged-faceB-pow-b01-world_005_marrick-edged-r2`, turn 1, held-out. The
quote: "The dispute is whether the debased alloy matches one crucible alone;
what test would support that match or rule it out?" The board marked
T-TOFF-3 offered. The clause "whether the debased alloy matches one crucible
alone" names the condition, and no condition rule fired on it. 9 face B
misses and 14 misses in the depth runs are this kind.

**Scope statement, expected challenge answered, got none.** Dialogue
`dwo_b03_s2_warrant_withholding`, turn 3, held-out. The quote: "The crucible
evidence supports Verrell's casting Marrick metal, not the conclusion that
Verrell struck these coins." No rule fired on the row. The answer lexicon
(T-ANS) looks for the tutor to name what a record does or does not show;
this sentence does it with "supports X, not Y" and the lexicon has no such
form. 15 scope misses are this kind. The 11 misses on the offer under condition have the same
cause: the offer is stated as a limit, "Method, not Verrell's hand, is the
proper limit until public evidence links both coin parts to one person",
and the offer lexicon wants a question or an "if we" clause.

## Unread count per field

Zero, in every field, in every section. Every trace carried the learner
text, the DAG update, the proof-debt record and the release record, and the
licence was known on every tutor row. The unread mechanism is tested
(`tests/tutorStubScoreboard.test.js`, the "unread" cases) and did not fire
on the archives.

| field | unread |
|---|---|
| commitment_undertaken | 0 |
| entitlement_status | 0 |
| challenge | 0 |
| condition_named | 0 |
| test | 0 |
| release | 0 |
| debt | 0 |
| forced_entry | 0 |
| standing_dispute | 0 |
| licence_in_force | 0 |

## Development half and held-out half

Every second dialogue in walk order was set aside as the held-out half
before any board was read. Every lexicon and state rule change after the
first look was made on boards from the development half only. The held-out numbers
are the clean test.

| endpoint | development half | held-out half |
|---|---|---|
| 1, pooled | 281 of 333 = 84.4% | 281 of 345 = 81.4% |
| 1, worst pair | defiant and frame refuser 87 of 107 = 81.3% | defiant and frame refuser 76 of 109 = 69.7% |
| 2, pooled joined | 238 of 260 = 91.5% | 219 of 251 = 87.3% |

Held-out per shape: permission seeking 54 of 60 = 90%, overconfident 34 of
36 = 94.4%, bored 106 of 128 = 82.8%, frame refuser 70 of 101 = 69.3%,
cooperative 12 of 12, defiant 5 of 8 = 62.5%. Held-out pairs under 0.75:
defiant and frame refuser 69.7%, cooperative and frame refuser 83 of 113 =
73.5%.

Held-out endpoint 2 per section: 6.25 23 of 23, 6.26 33 of 33, 6.28
delivered move 70 of 78 = 89.7%, 6.28 depth 42 of 54 = 77.8%, 6.30 scope 45
of 55 = 81.8%, 6.30 frame offer 6 of 8 = 75%.

The pairwise miss on the held-out half is one dialogue: 77 of 109 would be
70.6%. The frame refuser shape drives it, and the one-turn dialogues drive
the frame refuser shape. The defiant shape has eight held-out dialogues,
too few to read its 62.5% as more than a hint.

## Secondary: 6.24 quiet cards

The 6.24 dialogues are gone. The surviving exports were read for forced
cards. Only the three form-state detector traces (`step6a-traces`) carry
forced cards; the six hold exports carry none. 14 forced cards were found.
The check: on the tutor row of that turn, no new release and no new tutor
commitment.

| forced card | n | clean | new release this turn | tutor commitment |
|---|---|---|---|---|
| demand | 3 | 0 | 3 | 0 |
| stake | 5 | 3 | 2 | 0 |
| settled_claim | 2 | 2 | 0 | 0 |
| grievance | 1 | 0 | 1 | 0 |
| mockery | 2 | 2 | 0 | 0 |
| quiet:confused | 1 | 1 | 0 | 0 |

The one quiet card is clean. No forced card row shows a tutor commitment.
Six of fourteen rows show a release on the forced turn; every forced demand
card released. Example, `world-038-forced-d0` turn 2, forced demand:

```
t2 tutor  "... I look at the worksheet: The orbit poster on the wall marks
           the Earth's nearest point to the Sun in the first week of January.
           ... What does that show?"
  release            p_january, sinceTurn 2   (RELEASE-releasePacing)
  commitment_undertaken  none
```

No bar was set on this check and none is claimed.

## Secondary: 7.14 lattice with board attributes

`scripts/analyze-figure-lattice-scoreboard.js` re-reads the frozen 122
carded turns through the lattice script's own object builder, checks that
run B reproduces its recorded numbers (122 objects, 29 attributes, 372
concepts, 0 of 7 figures separated), then adds the board fields of each
turn as attributes. The lattice rules are unchanged.

| run | objects | attributes | concepts | separated |
|---|---|---|---|---|
| B, frozen | 122 | 29 | 372 | 0 of 7 |
| B plus board fields | 122 | 61 | 9,402 | 0 of 7 |
| board fields alone | 122 | 32 | 573 | 0 of 7 |

The board fields do not separate the figures. On these 122 turns the fields
take few values: every turn reads dispute settled, no tutor commitment and
some debt; 119 of 122 read no tutor challenge; 116 of 122 read a release in
force. The confusion shrinks a little (demand no longer merges with five
quiet flat turns, only one) but no figure reaches its own concept. Output:
`exports/scoreboard-replay/lattice/figure-lattice-scoreboard.json`.

## What changed after boards were read

The schema, the shape rules, the two endpoints and their bars did not
change. The lexicon and state rules did. Six rounds were run on the first
three dialogues of each archive, then one round on the development half.
The changes, in order: the tutor offer rule T-TOFF-1 widened to the opening
form "choose a public matter to examine"; the learner begun rule L-TBEG-2
given a lookbehind so "If the assay shows" does not read as a test begun;
L-DISP-3 widened and L-DISP-4 added for standing disputes stated as
"before your question can have standing"; L-COND-5 added for "first
establish whether", then narrowed so "first establish what may be
examined" names no condition; dispute settlement moved to text withdrawal
only; a test the tutor begins became declinable; T-TBEG-1 added; the
sentence splitter given a case for a quote mark that closes a sentence; T-TOFF-4, T-COND-2 and
T-COND-4 widened. Each change has a positive and a recorded failure case in
the test file. The held-out numbers were read once, after the last change.

## Limits

One-turn dialogues cannot satisfy a rule that needs a declined test. The
standing-permission version is read as unlicensed by the shape summary; fix
before Step 2 if the board tutor uses a standing-permission version. Node
keying from text is by content terms and is weak: 63 of 122 lattice turns
key the learner's commitment to `other`. The debt ledger only grows; no
rule discharges an extractor debt except a strict DAG adoption of the same
premise. The board tutor in Step 2 must be given the licence and dispute
fields with these limits stated.

## Step 2

Opens on this PASS, with the held-out pairwise line in view. Preparation up
to `--print-plan` and a GO note follows on this branch. No paid call until
the user says go in chat.
