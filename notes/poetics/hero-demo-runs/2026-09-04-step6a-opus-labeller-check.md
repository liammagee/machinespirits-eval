# Step 6a model labeller, Opus 5 check (2026-09-04, paid)

Labeller seat at step 6a: Sonnet 5. This is the model check the CLAUDE.md
model-bound rule asks for (PR #996). It ran: 287 Opus 5 calls, one per
learner turn, over the same 14 recorded traces step 6a labelled.

Card: `workplan/items/state-detection-followups-hold-and-cues.md`. Go: user,
2026-09-04, after the hold-reader re-read (PR #1001) showed Opus reading the
same lines differently from Sonnet. Ceiling stated before the first call: 300.
Used: 287 (`claude-code.claude-opus-5`, `scripts/label-learner-state-model.js`,
same prompt as step 6a). Attended, one attempt per turn, no resampling, no
answer unparsed.

## Inputs

The 14 traces of step 6a, copied from the 2026-09-02 session scratchpad into
`exports/form-state-detector/step6a-traces/` (gitignored, archived): hero
hold-outs 030, 035, 037 (v3 and butler dialogues), hero 036 (two), and the
six lesson-world bench traces (038, 039, 040; forced-card and plants-only).
287 learner turns, 66 pressure plants, 12 quiet plants, 4 `confused` plants
outside the eight states, 205 unplanted turns.

Labels: `exports/form-state-detector/labels-2026-09-04-opus5.jsonl`. Sonnet
labels from step 6a: `labels-2026-09-02.jsonl` (same folder). The side by
side comes from the new `scripts/compare-learner-state-labels.js`, which joins
the two label files and a no-call form-v3 replay turn by turn and checks the
learner text matches. It gives back step 6a's Sonnet and form-v3 numbers
exactly, except quiet plants for form-v3 (7/12 here, 8/12 at step 6a, where
the scorer composed the quiet detector beside it). Output:
`exports/form-state-detector/compare-2026-09-04.{md,json}`.

## Side by side

| reader | right kind at pressure plants | quiet plants right | wrong-fire at quiet | fires on unplanted turns |
|---|---|---|---|---|
| Opus 5, one call per turn | 53/66 | 10/12 | 1/12 | 57/205 |
| Sonnet 5, one call per turn (step 6a) | 53/66 | 8/12 | 2/12 | 35/205 |
| form-v3, no call | 49/66 | 7/12 | 0/12 | 19/205 |

Per world, right kind at pressure plants (Opus / Sonnet / form-v3):

| world | plants | Opus | Sonnet | form-v3 |
|---|---|---|---|---|
| 030 | 10 | 5 | 7 | 7 |
| 035 | 10 | 8 | 8 | 8 |
| 036 | 10 | 9 | 8 | 7 |
| 037 | 12 | 10 | 10 | 7 |
| 038 | 8 | 7 | 6 | 6 |
| 039 | 8 | 8 | 8 | 8 |
| 040 | 8 | 6 | 6 | 6 |

By planted state, right reads (Opus / Sonnet): jumping_ahead 12/14 both;
irritated 8/12 vs 7/12; frustrated 10/10 vs 9/10; forgetting 11/11 vs 9/11;
opposed 12/19 vs 16/19. Opus gains on forgetting and loses on opposed. Five
of its seven missed `opposed` plants it read as `jumping_ahead` or
`forgetting`; example, 037 butler t4, "That's just how you add, isn't it?
One and one is two ... Can we do question five now?" (Sonnet: opposed; Opus:
jumping_ahead).

## Agreement between readers

| pair | all 287 turns | 82 planted turns | both fire on the same unplanted turn |
|---|---|---|---|
| Sonnet vs Opus | 231/287, kappa 0.69 | 65/82, kappa 0.76 | 29 (24 with the same state) |
| Sonnet vs form-v3 | 208/287, kappa 0.48 | 52/82, kappa 0.58 | 4 |
| Opus vs form-v3 | 191/287, kappa 0.43 | 57/82, kappa 0.65 | 5 |

The two model readers agree with each other far more than either agrees with
form-v3, and they fire together off plant on 29 turns, mostly the same
"so what do I write" lines (jumping_ahead: 33 of Opus's 57, 24 of Sonnet's 35).

## Where Opus fires that Sonnet does not

28 unplanted turns. 11 `jumping_ahead`, 8 `bored`, 6 `forgetting`, 2
`irritated`, 1 `lost`. The bored and forgetting reads sit on the closing
turns of the hero dialogues, where the learner sums up the settled case:

- 030 butler t16, "Agreed—entry stands: basin hose, not Sam's shower, closed
  the case. Notebook's done." Opus: bored.
- 035 v3 t14, "Fair enough — diary entry stands as written: ..." Opus:
  forgetting.
- 036 butler t14, "Agreed — case closed, heat not thirst. I'll update the
  laminated rota too ..." Opus: forgetting.

A live card would fire a change-of-tone or a memory move at a learner who
is closing a solved case. This is the same over-reading the Opus hold-reader
re-read showed on 2026-09-04: Opus reads more into a settled line than
Sonnet does.

## What this changes

The step 6a finding is now checked on a second model and stands: one model
call per turn buys about four more right reads out of 66 at pressure plants
and costs many more off-plant fires (Sonnet 35, Opus 57, against form-v3's
19). The off-plant firing is a model-reader pattern, not a Sonnet quirk.
form-v3 stays the shipped no-call sensor. The gain at quiet plants (10/12)
is the one place Opus is clearly ahead, but on 12 plants.

The step 6a sentence can now go in the paper without the Sonnet-bound label.

## Not done here

- No third sample; each model read each turn once.
- No live run with a model reader in the loop.
- No change to form-v3 or to any shipped prompt.
