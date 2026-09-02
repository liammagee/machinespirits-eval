# Step 2 (offline): a learner-state detector with no story words

Card: `workplan/items/state-detection-without-word-lists.md`. Follows the step-1 note
(`2026-09-01-step1-detector-replay.md`), which showed that the v6/v7 cascade carries
most of its recall in word bags built from the training story (world 033).

No paid calls were made. Everything below is a replay over packed traces.

## What was built

**Candidate (b), form features.** `services/tutorStubFormStateDetector.js` reads the
shape of a learner line, not its subject: does it order the tutor about, ask a forced
choice, name a deadline in clock grammar, address the tutor in the second person,
say "sound like", quote the tutor's last line back, count effort, ask what it was
worth, assert "we did / it's in my ...", name a personal cost ("I'm the one", "in
front of", "apolog-"), hedge a wish, open with "hang on / wait", ask itself a
question, go short and flat. Forty features: 29 binary cues, 9 surface counts and
densities, 2 relational overlaps (with the tutor's previous line, with the learner's
own previous line). Weights are learned per state (seven planted states, one-vs-rest
logistic), so no threshold was tuned by hand beyond the 0.5 decision line.

A test (`tests/tutorStubFormStateDetector.test.js`) reads the v6 token bags, drops
closed-class words, and fails if any remaining token (the story's things, people,
weekdays) appears anywhere in the detector's source.

**Trainer.** `scripts/train-form-state-detector.js` trains on a pool of traces and
scores leave-one-world-out: for each world, train on the pool minus that world, test
on every trace of that world. Hold-out traces are never trained on. Artifact:
`config/manner-trigger/form-v1.json`.

**Scorer hook.** `scripts/score-manner-trigger.js --state-detector <artifact>` replays
a form detector in place of the cascade, same per-plant verdicts as step 1.

**Candidate (a), model label.** `scripts/label-learner-state-model.js` asks a model to
name the learner's state from a fixed list, one call per turn. It is DRY by default
(prints call count and a sample prompt). `--live` needs `--max-calls N`. Not run.

## Data

| Set | Traces | Worlds | Learner model | Planted turns | Unplanted turns |
|---|---|---|---|---|---|
| Pool (archive, 18 run bundles) | 96 | 030 Rowan (57), 033 Alder Row (34), 034 groupwork (5) | codex gpt-5.6-terra | 649 | 1000 |
| Hold-out (hero runs) | 6 | 030 Rowan, 035 ghost, 037 fraction (2 each) | Sonnet | 36 | 108 |

Worlds 035 and 037 appear in no training trace. The hero traces also use a different
learner model, so the hold-out is new on both story and speaker.

## Leave-one-world-out (train on the other pool worlds, test on that world)

| Held-out world | Fired at should-fire plants | Right kind | Quiet plants read right | Wrong fires at quiet plants | Reads at unplanted turns |
|---|---|---|---|---|---|
| 030 Rowan (trained on 033+034) | 207/295 | 205/295 | 13/56 | 0/56 | 15/423 |
| 033 Alder Row (trained on 030+034) | 63/214 | 63/214 | 3/69 | 0/69 | 12/585 |
| 034 groupwork (trained on 030+033) | 20/22 | 18/22 | 5/5 | 0/5 | 1/28 |
| 035 ghost (trained on all three) | 8/10 | 8/10 | 2/2 | 0/2 | 5/36 |
| 037 fraction (trained on all three) | 6/12 | 6/12 | 0/0 | 0/0 | 10/36 |

Transfer is not symmetric. Rowan and the hero worlds are read well from Alder Row
training; Alder Row is read badly from Rowan training (63/214). The codex learner on
Alder Row writes its pressure in a business register the other worlds do not teach.

## Hero hold-out: form-v1 against the cascade (six traces, 32 should-fire plants, 4 lost plants)

| Detector | Fired | Right kind | Wrong fires at lost plants | Reads at unplanted turns (108) |
|---|---|---|---|---|
| v7 full cascade | 19/32 | 18/32 | 2/4 | 22 |
| v7 patterns + bags | 19/32 | 18/32 | 1/4 | 11 |
| v7 patterns only (the world-neutral tier) | 11/32 | 10/32 | 0/4 | 1 |
| **form-v1 (no story words)** | **21/32** | **21/32** | **0/4** | 18 |

Per world, form-v1: Rowan 7/10, ghost 8/10, fraction 6/12 — every fire the right kind.
It also read all four lost plants as `lost` itself (the cascade needs qd-v2 for that).

On plants the learner actually realized (22 of 32, per the adjudication draft):

| Detector | Right kind at realized plants |
|---|---|
| v7 full | 13/22 |
| v6/v7 patterns only | 6–8/22 |
| form-v1 | 17/22 |

## What form-v1 still misses

Nine silent should-fire plants, all read `neutral` (or `lost` once):

- **irritated, 5 of 6**: 030 v3 t4, 030 butler t4, 035 v3 t4, 035 butler t4, 037 v3 t7.
  The one hit (037 butler t7) is carried by `sound like`. Sonnet's irritation is dry
  and does not name the tutor's manner; the form has to come from somewhere else
  (short clipped sentences, a "fine." opener, a barbed question) and the codex
  training set does not show enough of it.
- **jumping_ahead, 037 both t2**: the fraction learner asks "so do I just write ...?" —
  a request for the answer without a deadline or an order. Read as `lost`, which is
  not wrong on its face.
- **opposed, 037 both t4**: the learner keeps "two fifths" without naming a cost.
- **frustrated, 037 v3 t6**: not realized (learner had already conceded).

Reads at unplanted turns (18/108): eight are the fraction learner asking "do I just
write X" mid-dialogue (read `lost` or `opposed`); those lines do ask for the answer.
Four are closing-turn diary lines read `opposed` by the cost clause "stands".

Strongest weights, for the record: jumping_ahead ← ultimatum, sentence count, a quote;
irritated ← sound_like, second-person density; frustrated ← worth_question, length,
first+second person; forgetting ← we_did, already_settled, record_ref; opposed ←
cost_clause, if_i_write; bored ← short line, assent opener; lost ← confusion_marker,
question count, self_question.

## Commands

```bash
# unpack archive bundles into a scratch dir first (see step-1 note), then:
node scripts/train-form-state-detector.js --train-dir <scratch>/archive-traces \
  --holdout-trace notes/poetics/hero-demo-runs/world-030/v3-d1.jsonl ... (six traces) \
  --out config/manner-trigger/form-v1.json --per-plant
node scripts/score-manner-trigger.js --no-defaults --state-detector config/manner-trigger/form-v1.json --per-plant --trace ...
node scripts/label-learner-state-model.js --trace ...            # dry: counts + sample prompt
```

JSON report: `exports/form-state-detector/2026-09-01-form-v1-report.json` (gitignored).

## Reading

1. A detector with no story words matches or beats the cascade on three stories it never
   saw, with no wrong fire at a quiet plant. The step-1 worry (recall lived in the
   story's nouns) has a working answer.
2. The remaining gap is irritation. Neither the cascade's tier 1 nor form-v1 reads
   Sonnet's dry irritation; that is where a model read (candidate a) would earn its cost.
3. Both numbers rest on 36 planted turns from one learner model. The archive fold on
   033 (63/214) says the form set is not complete either — it learned Rowan-style
   pressure from 033 and the reverse did not hold.
