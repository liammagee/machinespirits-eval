# Step 6a — candidate (a) model labels beside form-v3 (2026-09-02, paid)

Card: `workplan/items/state-detection-without-word-lists.md` (closed; open
follow-up "candidate (a) model labels"). Go: user, 2026-09-02 ("go").
Ceiling stated before the first call: 300 calls. Used: 287, one Sonnet call
per learner turn (`claude-code.claude-sonnet-5`, `scripts/label-learner-state-model.js`).
Attended, one attempt per turn, no resampling.

A first launch made zero model calls: the script handed the CLI bridge the
dotted model string, and the bridge threw before any process started. Fixed
in ed26216a9 with a regression test. The relaunch is the run reported here.

## Inputs

The same 14 recorded traces the step-5 fold used: hero hold-outs 030, 035,
037 (two dialogues each), hero 036 (two), and the six lesson-world bench
traces (038, 039, 040; forced-card and plants-only). 287 learner turns, 66
pressure plants, 12 quiet plants (lost, bored, confused), 205 unplanted turns.

The model sees the learner line, the tutor line before it, and a gloss of the
eight states. It returns one word. form-v3 sees the same line plus the prior
learner lines, with no model call. Labels: `exports/form-state-detector/labels-2026-09-02.jsonl`
(gitignored).

## Side by side

| reader | right kind at pressure plants | quiet plants right | wrong-fire at quiet | fires on unplanted turns |
|---|---|---|---|---|
| Sonnet, one call per turn | 53/66 | 8/12 | 2/12 | 35/205 |
| form-v3, no call | 49/66 | 8/12 (scorer: 0 wrong-fires) | 0/12 | 19/205 |

Both fire on the same unplanted turn only 4 times. The model's off-plant
fires are mostly `jumping_ahead` (24 of 35): it reads any "so what do I write"
line as jumping ahead, planted or not. form-v3's off-plant fires are mostly
`opposed` (11 of 19).

Per world, right kind (model / form-v3):

| world | model | form-v3 |
|---|---|---|
| 030 (2 dialogues) | 8/12 | 8/12 |
| 035 | 10/12 | 10/12 |
| 037 | 10/12 | 8/12 |
| 036 | 10/12 | 9/12 |
| 038 | 8/12 | 8/12 |
| 039 | 10/10 | 10/10 |
| 040 | 7/12 | 8/12 |

## What each one misses

- Model, `irritated` plants: 5 of 14 wrong or silent (three read neutral,
  one jumping_ahead, one opposed). form-v3 misses the same shape (the
  mockery cue is thin) and read 9/14.
- Model, world 038 `forgetting` plants: both read `opposed` ("we already did
  this, it's on the sheet" read as pushing back). form-v3 read both right.
- Model, world 040 `bored` plants: both read `irritated`. A card would fire
  a change-of-tone move at a bored pupil. form-v3 stayed quiet on both.
- Model, world 037 `frustrated` and `irritated` in the v3 dialogue: read as
  `irritated` and `opposed`; the butler dialogue's same plants read right.
- form-v3, the three shapes recorded at step 5 (the question-shaped demand,
  the rule-appeal `opposed`, the 040 `confused` line read as irritated): the
  model reads the 037 `opposed` at t4 right in both dialogues (form-v3
  silent in both), and the 038/040 `opposed` at t4 right in three of four
  (form-v3 silent in all four). It reads the 040 `confused` line as
  `jumping_ahead` and `lost`, so that line has no right reader either.

## Reading

Four more right reads out of 66, at the cost of one paid call per turn and
almost twice the off-plant fires. On the two hero worlds that were unseen by
both readers (036, 037) the model is ahead by three. On the lesson worlds the
two tie. The model's failure shapes are different from form-v3's, and the
overlap of their off-plant fires is small (4 of 205 turns), so a pair reading
would cut false alarms but the pool here is too small to set a rule.

This does not change the step-5 decision. form-v3 stays the shipped
no-call sensor. The model labels are a second reader for the three shapes
the pool cannot support, not a replacement.

## Limits

- One model, one prompt, one pass. No second sample, so no reliability figure
  for the model reader itself.
- The model labelled recorded traces after the fact. In a live run it would
  add one call and about ten seconds per turn.
- The lesson-world plants were authored by the same hand as the gloss the
  model reads; the hero worlds were not.
