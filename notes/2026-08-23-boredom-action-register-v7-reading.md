# Boredom action-before-register, v7 confirmation: how to read the null

Written 2026-08-23. Study
`boredom-action-register-proof-dag-confirmation-v7-live-2026-08-23`.
Registration `config/tutor-stub-boredom-action-register-proof-dag-registration.v7.json`.
Combined report in `.tutor-stub-auto-eval/`, artifacts archived to
`artifacts/boredom-proof-dag-v7-live/` in the private repo.
Workplan card `resistance-action-register-integration` holds the dated entries.

This note is the reading. The card records what happened and the archive README
records the run. Neither says what the result licenses, and that is what a
later reader will need.

## The question and the answer

A learner gets bored in the middle of a proof. The tutor can ask a
discriminating question, or shrink the step to one workable piece. Which brings
the learner back to work?

84 dialogues, 42 per move, 6 worlds, 7 per move per world. 80 scored.

| move | recovered | scored | rate |
|---|---|---|---|
| ask a discriminating question (reference) | 21 | 41 | 0.512 |
| shrink the step (treatment) | 16 | 39 | 0.410 |

Risk difference −0.102. One-sided exact conditional blocked score test,
p = 0.874 against alpha 0.05. Registered decision
`shrink_step_ask_question_recovery_not_confirmed`.

Every treatment-fidelity gate passed. The host action was visible in every unit,
the assigned move came out in every unit, the assigned manner came out in every
unit, and a reader could name the manner in 78 of 80. Zero safety overrides,
zero move nonadherence, zero content leakage in 37 scoring turns. This is the
first run in the arc that is readable end to end.

## What the run licenses

1. **The measurement works.** v4 and v5 tested a different contrast, warm
   against plain, and are nulls; v4's objective window was mostly unreachable
   and v5 fixed that. v6 was the first to test the two moves. It ran 36 of 36
   with no stopped units and then failed its manner floor by one unit, so it
   licenses nothing. v7 passed every gate. The instrument, the world set and the
   trigger detection are sound enough to run a study on.
2. **The registered decision.** Shrinking the step is not confirmed to beat
   asking a question at recovering a bored learner, on this stack, on this
   simulated learner, in these six worlds.
3. **A better reference rate.** Asking a question recovers about half of bored
   learners inside five turns: 21 of 41. v6's 8 of 18 came from a run that
   failed its gate and could only be used for sizing. This one can be quoted.

## What the run does not license

1. **Not "asking a question is better."** The design is one-sided and names
   `shrink_step` as the treatment. A result pointing the other way may not be
   reported as a finding in that direction, however large it is. The claim
   boundary in the registration rules it out and a two-sided test was
   deliberately not run.
2. **Not "the two moves are the same."** Showing two things are close needs an
   equivalence design with a stated margin. This is not one. A null here means
   the study did not find the registered difference, nothing more.
3. **Not a manner claim.** Warm and plain were balanced inside each move as a
   block, never contrasted. The counts are descriptive: question plain 10/21 and
   warm 11/20, shrink plain 9/19 and warm 7/20.
4. **Not poolable.** v4, v5, v6 and v7 may not be combined. Each spent corpus is
   permanently excluded from every later outcome.

## The v6 gap did not survive

v6 measured shrink 14/18 = 0.78 against ask 8/18 = 0.44. v7 measured shrink
16/39 = 0.41 against ask 21/41 = 0.51. The reference side held almost exactly.
The treatment side fell by more than half and the gap changed sign.

The registration named this risk before the run, under `winnersCurse`: a first
measured gap runs high, because a run gets looked at once it has produced
something. v6's 18 units per side carried a 95 percent interval from about 0.22
to 0.69 on the reference rate alone. The gap that sized v7 was mostly noise, and
v7 is the correction.

That is the useful thing here. A 36-unit pilot produced a large clean-looking
difference that an 84-unit confirmation erased. Treat any single small run in
this programme as a sizing input, never as a result, whatever it shows.

## What recovery is, and what it is not

Three windows were read on the same 80 dialogues.

| window | ask | shrink |
|---|---|---|
| recovered within 5 turns (primary) | 21/41 | 16/39 |
| recovered within 1 turn (comparability, descriptive) | 1/41 | 2/39 |
| objective proof progress within 5 turns (key secondary) | 0/41 | 0/39 |

Not one learner in 80 dialogues got further in the proof within five turns of
the tutor's move. The primary endpoint reads the learner coming back to work,
not the learner learning anything. That is what it was registered to read and
the registration says so, but the three rows together make the limit concrete in
a way one row does not.

The key secondary carries `not_independently_powered`. It is tested under the
fixed sequence and the registration says a null on it says nothing, which is
right: at v6's rates of 1 in 18 and 2 in 18, no size this programme can afford
would power it. 0 of 80 is still worth writing down as a description: the
five-turn window is too short for proof progress to appear at all, so no study
built on this window can measure it. A later design that wants to measure
learning must lengthen the window or change the endpoint. It cannot keep this
one.

## The world matters more than the move

Recovery rate by world, both moves pooled: 4/11, 6/13, 6/14, 7/14, 9/14, 5/14 —
a range from 0.36 to 0.64. The two moves span 0.41 to 0.51. The spread across
worlds is wider than the spread across moves.

Blocking on world was re-audited before v7 and kept because it costs almost no
power (0.568 blocked against 0.584 unblocked). The realised data says it was
worth keeping for a second reason the audit did not use: the confound it removes
is bigger than the effect being looked for.

## What a v8 would have to change

The safeguard arithmetic, not the money, set v7's size. The registration reserved
a never-exceed ceiling of 10,332 attempts for 84 dialogues and the programme
safeguard is 15,000, so 96 dialogues would not fit. **v7 actually spent 1,676**,
inside the registration's own forecast of "about 1700 to 2000". The ledger now
stands near 4,684 of 15,000.

So the ceiling method reserves roughly six times what the run costs. A larger
study is affordable and the arithmetic hides it. Any v8 should either forecast
from measured spend with a stated margin, or ask for the safeguard to be raised.
Both are spend decisions and belong to the user, not to a design document.

Sizing is the harder problem. v7 puts both moves near 0.46, so any real
difference looks small. At 20 attempts per dialogue and a ledger of 4,684,
one-sided alpha 0.05 and power 0.8, a rough normal-approximation sizing says:

| difference to detect | per side | dialogues | attempts | ledger would reach |
|---|---|---|---|---|
| 10 points, the gap v7 measured | 293 | 586 | ~11,700 | ~16,400 of 15,000 |
| 15 points | 133 | 266 | ~5,300 | ~10,000 of 15,000 |
| 20 points | 72 | 144 | ~2,900 | ~7,600 of 15,000 |

Script `scripts/size-boredom-v7-blocked-power.js` does the real sizing; the
table above is an order-of-size answer, because the registered test is exact and
blocked and this arithmetic is neither.

Read it this way. The safeguard as it stands can pay for a study that would
catch a 15-point difference, and cannot pay for one that would catch a 10-point
difference. v7 measured 10 points, pointing the wrong way. So the size the
programme can afford is the size that answers a question v7 has already made
look unlikely.

Three routes, in the order I would rank them:

1. **Close the move contrast.** The instrument is validated, the reference rate
   is measured, and the difference, if any, is too small for this programme to
   buy. Report v7 as a clean registered null and move the arc's effort to an
   endpoint with more signal per unit.
2. **Change the endpoint before changing the size.** A graded reading of how far
   the learner came back, instead of recovered or not, would carry more
   information per dialogue than a coin flip does. It needs its own validation
   first, which is a real cost.
3. **Buy the size.** Raise the safeguard, forecast from measured spend, and run
   several hundred per side on the same endpoint. Only worth it if a 10-point
   difference in re-engagement is worth that much.

I recommend the first. The second is the one to take if the arc continues.

## The provenance defect, in one paragraph

The registration asked for 84 distinct public openings, set
`requireDistinctPublicPrefixHashes`, and named what to do about a repeat: stop
the unit, replace nothing, analyse nothing. Only half of that rule was built.
Nothing computed the duplicate half, so the first thing to notice a repeat was
the combined analysis, after every dialogue had been paid for, and it refused
the whole study. A live check was never cheap either, because an opening exists
only once its dialogue has reached the trigger turn and batches run in separate
processes that cannot see each other. The rule was applied in analysis on the
terms it would have had live: inside a group sharing an opening, the one that
ran first is the original, ordered by batch number then unit name, reading
nothing about how any dialogue ended. That is a change to analysis code made
after the data was seen. The frozen v7 request still pins the bytes from before
it, so the change shows as closure drift instead of disappearing, and the drift
was left in place on purpose. Eval-repo commit `e101803b`.

This is the fourth time in this arc that a rule written in a registration turned
out to have no code reading it. The check that would catch the fifth is a test
that every named rule in a registration resolves to a call site. Nobody has
written it.

## Attrition

Four units lost, none replaced.

| unit | world | move | manner | why |
|---|---|---|---|---|
| `bored-confirm-w2-d8` | `world_026_skyway_bakery` | shrink_step | plain | no readable boredom trigger by turn 4 |
| `bored-confirm-w1-d11` | `world_022_foxtrot_jukebox` | shrink_step | warm | repeats the opening of `w1-d9` |
| `bored-confirm-w1-d12` | `world_022_foxtrot_jukebox` | shrink_step | plain | repeats the opening of `w1-d1` |
| `bored-confirm-w1-d13` | `world_022_foxtrot_jukebox` | ask_question | warm | repeats the opening of `w1-d4` |

All three repeats sit in one world and one batch, `execution_batch_3`.

Attrition was **unbalanced**: 1 lost on the question side, 3 on the shrink side.
The kept shrink sample is conditional on not stopping and the question sample is
less so. The exact conditional test is valid for the units that exist and does
not repair this. The report carries
`registered_confirmation_interpretable_within_claim_boundary_and_unbalanced_attrition_caveat`.

No amendment was needed. v7 registers conditioning on realised counts, so a
short study is read on the counts it realised. This is the one place where a
lesson from an earlier failure paid off inside the same run.
