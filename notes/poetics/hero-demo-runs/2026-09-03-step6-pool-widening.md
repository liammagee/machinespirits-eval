# Step 6 — pool widening: three new lesson worlds, plants only (2026-09-03)

Card: `workplan/items/state-detection-without-word-lists.md`, follow-up
"widen the pool". Go: user, 2026-09-03. Ceiling stated before the first
call: 100 model calls per dialogue (CLI budget flag), six dialogues, so at
most 600 dialogue calls, plus a small judge pass. Used: 335 dialogue calls
(311 on the six complete dialogues, 24 on two failed starts) and 6 judge
calls. Attended, one dialogue at a time.

## Why

The step-5 folds left three miss shapes uncovered, and the irritated cue set
leaned on one phrase ("you sound like"). The fix under the standing rule (no
per-world words) is more training text, not more cues: new worlds whose
planted irritation takes other forms. Three lesson worlds were written for
that, each with a stress schedule whose irritated plant forbids "sound like"
and "voice":

- 041 log and pebble (floating, Year 7): mock by echoing the teacher's phrase twice in scare quotes.
- 042 half a Moon (Moon phases, Year 8): ask whether the teacher is reading off a card.
- 043 tails is due (coin tosses, Year 7): tell the teacher to stop the slow bit.

## What ran

Six plants-only dialogues: no sensor, no card, the tutor is the plain tutor.
Worlds 041/042/043, each with a Sonnet learner and a codex learner.
Seats (from the recipes): tutor and classifier `claude-code.claude-sonnet-5`;
learner `claude-code.claude-sonnet-5` or `codex.gpt-5.6-sol`; reasoning and
learner-record `codex.gpt-5.6-sol`. Repair judge `codex.gpt-5.6-sol`, blind
to the gold; the tutor is the other family.

Two dialogues failed at their start, both on Sonnet, both from a defect in
the world text, not in the model:

- 042: the surface of the torch premise put the answer words next to the
  predicate head, so the leak guard read the tutor's clue at t3 as a private
  final conclusion and stopped the run (2 turns, 8 calls).
- 043: two sentences of the "fresh coin" premise shared three content
  tokens, so the clue-multiplicity guard failed the delivery (4 turns, 16
  calls).

Both surfaces were rewritten offline. `tests/derivationWorldSurfacesPassTutorGuards.test.js`
now runs both guards over every premise surface of every world at its
release turn, and pins the two old surfaces as failing. The two codex
dialogues on 042/043 ran on the fixed worlds, and the two failed Sonnet
dialogues ran again as `d1`. The failed `d0` traces stay on disk and in the
archive; nothing else was resampled. This departs from the "no re-run"
line in the plan: the fix was to the instrument, which under CLAUDE.md does
not void the go, and a failed start is not a model outcome.

| world | learner | turns | plants | calls | end |
|---|---|---|---|---|---|
| 041 | Sonnet d0 | 8 | 4 | 29 | grounded closure |
| 041 | codex d0 | 13 | 6 | 44 | grounded closure |
| 042 | Sonnet d0 | 2 | 1 | 8 | FAILED, leak guard |
| 042 | codex d0 | 16 | 6 | 54 | grounded closure |
| 042 | Sonnet d1 | 24 | 6 | 77 | turn cap |
| 043 | Sonnet d0 | 4 | 2 | 16 | FAILED, multiplicity guard |
| 043 | codex d0 | 8 | 4 | 29 | grounded closure |
| 043 | Sonnet d1 | 24 | 6 | 78 | turn cap |

Four dialogues closed before the t9/t10 plants, so the six complete traces
hold 32 plants (26 pressure, 6 quiet). Artifacts:
`exports/tutor-stub-outcome/step6-pool-widening-2026-09-03/` (logs, traces,
`judge.json`); archived to the private repo (`traces.tgz` with all eight
trace dirs, ledger line `step6-pool-widening-2026-09-03`).

## The irritated lines the sims wrote

Every one avoids "sound like". The realized column of the judge is yes on
all 32 plants.

| world | learner | line (start) |
|---|---|---|
| 041 | Sonnet | "The same-sized piece of water." "The same-sized piece of water." Do you hear yourself? |
| 041 | codex | "Same-sized piece of water." "Same-sized piece of water." Does anyone actually talk like that? |
| 042 | Sonnet | Oh come on — "What does that show?" — could you just tell me straight |
| 042 | codex | Are you reading that off a card? "The available public evidence does not yet |
| 043 | Sonnet | Stop doing the slow bit. I'm not five. "No memory, starts fresh." Say it once |

(043 codex closed at t8, before its irritated plant.)

## Detection, offline

Two reads of the 26 pressure plants and 6 quiet plants. First, the shipped
form-v3, which never saw these worlds. Second, form-v4, trained on the
form-v3 pool plus these six traces, scored leave-one-world-out, so each
new world is read by a model that did not train on it.

| world | plants | form-v3 (unseen) | form-v4 fold | what is read |
|---|---|---|---|---|
| 041 | 8 | 2 right, 2 wrong kind | 3 right, 2 wrong kind | irritated echo-quote, both learners; Sonnet t2 demand (v4); frustrated t4 read as `opposed` twice |
| 042 | 10 | 0 | 0 | every plant reads neutral; only the Sonnet t9 forgetting line scores anything (`lost` 0.67, under threshold) |
| 043 | 8 | 2 right, 1 wrong kind | 3 right, 1 wrong kind | frustrated "lost the bet", both learners; Sonnet t2 demand (v4); Sonnet opposed t4 read as `jumping_ahead`; irritated and forgetting silent |
| total | 26 | 4/26, 3 wrong | 6/26, 3 wrong | wrong-fires at the 6 quiet plants: 0 in both; the 041 and 043 quiet plants read `lost`, the 042 ones read neutral |

Of the five new irritated lines, the two echo-quote lines (041) are read;
the "reading off a card", "Oh come on" and "I'm not five" lines are not,
by either model. No closed-class cue carries them. The rule-appeal opposed
line (041 codex t10, 042 both t10, 043 both t4) stays at 0, as in every
earlier fold.

Hero hold-outs (030/035/036/037, eight traces, never trained on): form-v3
and form-v4 read the same 42 plants the same way, 29/42 right kind, 0/6
wrong-fires at quiet plants, the same 12 misses. Leave-one-world-out inside
the pool, form-v4 against form-v3 from the step-5 note: 030 234/295
(231), 033 63/214 (same), 034 17/22 (18), 035 8/10 (same), 038 6/8 (3/8),
039 8/8 (7/8), 040 6/8 (same); 036 7/10 and 037 7/12 on the deduplicated
trace set (the step-5 folds counted the step-4 pair twice, 17/20 and
16/24). Wrong-fires at quiet plants 0 in every fold.

Shipped as `config/manner-trigger/form-v4.json` (version form-v4, cue set
form-v2, provenance in `trainedOn`), opt-in by path like form-v3, pinned by
a test. Nothing live has run on it. form-v3 stays as it was.

## Repair with no card (judge codex.gpt-5.6-sol, blind to gold)

The plain tutor's move at each realized plant. HIT / PARTIAL / MISS:

| world | Sonnet learner | codex learner |
|---|---|---|
| 041 | 3 / 0 / 1 (4 plants) | 3 / 0 / 3 |
| 042 | 3 / 1 / 2 | 3 / 1 / 2 |
| 043 | 3 / 2 / 1 | 3 / 0 / 1 (4 plants) |
| all | **18 / 4 / 10** on 32 | |

The t2 demand plant is MISS or PARTIAL in all six dialogues (the tutor slows
down or gives the answer; the gold is to harness the demand). The irritated
plants are HIT 4 of 5 without any card (the codex 042 line got `capitulate`).
Learner took up the move next turn 26/32.

## What this does and does not show

- Shows: three more lesson worlds with irritated plants that do not use
  "sound like", six complete plants-only traces, all plants realized. The
  pool for the form detector is now nine worlds, 108 traces.
- Shows: widening the pool by six traces changes nothing on the eight hero
  hold-outs and lifts the new worlds by two plants (both the Sonnet t2
  demand). It does not reach the new irritated shapes; 042 stays at 0/10.
  The cue set, not the pool, is the limit for those lines.
- Shows: the plain tutor already makes the gold move at 18 of 32 plants
  here, so a sensor that read these worlds would have at most 14 plants to
  move.
- Does not show: any card effect. No sensor ran; these are the without-arm
  numbers only.
- Does not show: world-neutral detection on 042. Every plant there reads
  neutral, so a live with/without pair on 042 would measure the plain tutor
  twice.
- Next, offline only: a cue family for the quoted-phrase-plus-question shape
  ("reading off a card", "do you hear yourself") that stays closed-class, or
  candidate (a) model labels as the read for the shapes the form cues do not
  carry. No paid run until one of those reads 042 held out.
