# Step 5: the form detector on the three lesson worlds (2026-09-02, offline)

Card: `workplan/items/state-detection-without-word-lists.md`. No paid call.
Every number here comes from recorded traces.

## Inputs

- Bench traces of the lesson-world transfer (`2026-09-02-lesson-worlds-bench.md`):
  `notes/poetics/hero-demo-runs/world-03{8,9}/` and `world-040/`, one
  forced-card and one plants-only run per world. Sonnet 5 both seats. 24
  pressure plants, 6 quiet plants (bored, lost), 4 confused plants
  (unscored by the scorer). The judge ruled all 34 plants realized.
- Training pool of form-v2: the 96 archive traces (worlds 030/033/034,
  codex learner). Hold-outs: hero traces of 030/035/037 (v3 and butler),
  the 036 hero traces, and the step-4 traces (036/037).
- Tools: `scripts/score-manner-trigger.js --no-defaults --per-plant` with
  `--state-detector` or `--trigger`; `scripts/train-form-state-detector.js`
  with the flags recorded in `2026-09-02-step4-followups.md`.

## 1. Frozen replay over the six bench traces

| trigger | fired | right kind | wrong-fires at quiet (6) |
|---|---|---|---|
| form-v2 | 13/24 | 13/24 | 2 |
| form-v1 | 13/24 | 13/24 | 1 |
| v7 cascade, all tiers | 8/24 | 7/24 | 0 |
| v7 patterns only | 7/24 | 7/24 | 0 |

The misses under form-v2 (the delivered learner lines, cut short):

- t2 jumping ahead, silent in all six traces. 038: "Just tell me what to
  put. Is it farther away or not? Amir says it's the tilt. Which one do I
  write?" 039: "Just tell me the number. Is it eighty or not? Dev says
  seventy-five. Which one do I put down?" 040: "Just tell me which one. Is
  it I or not? Leah says me. Which one do I write?" The quiet detector
  qd-v2 reads these as confused.
- t4 opposed, silent in 038 and 040 (both runs). "Farther from a fire is
  colder, everyone knows that — the poster's probably just out of date. Can
  we do question three now?" and "'Sam and I' is always right, Miss Patel
  said so in Year 4, every time — can we just do sentence four now?" The
  037 hero line has the same shape and was silent there too.
- t9 forgetting, 038 plants only: "Wait, no—the poster said farthest in
  January, I saw it, it backs me up, it's on the wall!"
- 040 t6 confused (unscored) read as mockery; 040 t9 bored ("Fine, it's
  'Sam and me,' whatever, cover Sam, big deal. This is baby stuff") read as
  mockery in both runs — the two wrong-fires.

The 13 right reads are the grievance (039 t4), mockery (039 t6, 040 t7),
forgetting (038 forced t9, 039 forced t9) and stake-shaped opposed (t10)
lines.

## 2. Reproduction check

The trainer on the archive pool alone, with the recorded flags, reproduces
form-v2 to the row: final model on the hold-outs 46/64 right kind, quiet
8/8, wrong-fires 0/8, false alarms 33/216.

## 3. Widened pool: archive plus the six lesson traces

102 traces, 683 planted and 1061 neutral turns. Cue set unchanged
(form-v2, 45 cues). Leave-one-world-out, train on the pool minus the world,
test on every trace of that world; hero worlds tested with the whole pool:

| world | right kind | wrong-fire at quiet | false alarms | form-v2 |
|---|---|---|---|---|
| 030 Rowan | 231/295 | 0/56 | 8/423 | 213/295, 13/423 |
| 033 Alder Row | 63/214 | 0/69 | 11/585 | 63/214 |
| 034 groupwork | 18/22 | 0/5 | 1/28 | 18/22 |
| 035 ghost (hold-out) | 8/10 | 0/2 | 5/36 | 8/10, 3/36 |
| 036 class plant (hold-out) | 17/20 | 0/4 | 9/72 | 17/20, 12/72 |
| 037 fraction (hold-out) | 16/24 | 0/0 | 7/72 | 14/24, 16/72 |
| 038 seasons | 3/8 | 0/2 | 3/26 | — |
| 039 percent | 7/8 | 0/2 | 1/10 | — |
| 040 Sam and me | 6/8 | 0/2 | 6/29 | — |

Final model on the hero hold-outs: 48/64 right kind (form-v2 46/64), quiet
8/8, wrong-fires 0/8, false alarms 22/216 (33/216). The scorer agrees: on
the step-4 traces 19/22 against 17/22 (the two gains are the world-037 t2
demand, "Just tell me what to write already — is it two fifths or not?",
which form-v2 read as lost); on the 030/035/037/036 hero traces the two
models give the same 42 plant reads.

The lesson-world folds, plant by plant:

- 038 (3/8): t2 demand silent in both runs; t4 rule-appeal opposed silent
  in both; t9 forgetting right in the forced run (p=0.80) and silent in the
  plants run ("Wait, no—…"); t10 stake opposed right in both (0.93, 0.96).
  Bored t6 quiet, confused t7 neutral.
- 039 (7/8): forced t2 read lost (0.77); plants t2 right (0.53); grievance
  t4, mockery t6, forgetting t9, opposed t10 all right (0.87 to 0.98).
  Lost t7 read lost in the forced run, neutral in the plants run.
- 040 (6/8): t2 right in both (0.64); t4 rule-appeal opposed silent in
  both; mockery t7 and opposed t10 right (0.93 to 0.96). Confused t6 read
  irritated in both (0.92, 0.51) — a false alarm; bored t9 quiet in both.

So the question-shaped demand reads once two lesson worlds sit in the pool
(039 and 040 folds) and not from one (038 fold, which trains on 039 and 040
only after the archive); the rule-appeal opposed line has no support from
any world; grievance, mockery, forgetting and stake-shaped opposed carry
from the archive as before.

## 4. Decision

Shipped as `config/manner-trigger/form-v3.json`: version form-v3, cue set
form-v2, weights from the widened pool, provenance in `trainedOn`. It is
opt-in by path (`TUTOR_STUB_FORM_DETECTOR=config/manner-trigger/form-v3.json`),
the same way form-v1 ran at step 4. No live run has used it. form-v2 stays
loadable and pinned by test; a new test pins form-v3's provenance and the
world-037 demand read.

The card's verification branch 1 is met on these numbers (see the card's
closeout). The card is closed with the limits below recorded.

## 5. Limits

1. The 038–040 lines are training rows in form-v3. The lesson-world folds
   above, not the final model, say what a fourth lesson world would get.
2. The rule-appeal opposed line ("everyone knows that", "Miss Patel said
   so", then "can we do question three now?") is 0/6 across 037/038/040 in
   every model. The pool's opposed rows are stake-shaped ("if I write tilt
   I'm saying Amir was right"). This is a coverage limit of the pool; a
   cue written for it would be a word list by another name.
3. The 040 confused line reads as irritated in its fold. Live, that fires a
   mockery card at a confused pupil. Under frozen form-v2 it read mockery.
4. Bored sarcasm (040 t9) reads as mockery under frozen form-v2 (2/6
   wrong-fires) and as quiet in the fold. One line, two runs; not settled.
5. The form detector reads no quiet state on the lesson worlds (quiet right
   0/2, 1/2, 0/2). The quiet channel is still qd-v2's regex lists.
6. All lesson lines were written by the Sonnet learner-sim under the
   `realize` directive; the judge ruled them realized, but the same model
   family wrote every learner line in the fold.
7. 030's pool holds its near-twin 033, as at step 1. The 035/036/037/038-040
   numbers are the cleaner transfer test.
