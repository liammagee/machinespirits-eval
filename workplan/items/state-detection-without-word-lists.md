---
id: state-detection-without-word-lists
title: "Make the adaptive tutor testable across scenarios without rewiring the detector or the bench"
status: triaged
type: infra
priority: P1
owner: unassigned
source: manual
created: 2026-09-01
updated: 2026-09-01
verification: "A learner-state detector with NO per-world word list whose
  leave-one-world-out recall at the planted moments of world-030, world-035
  and world-037 (packed traces) matches or beats the v6 cascade's held-out
  figure (84/162 turn-level on world-030) with zero wrong-fires at quiet
  plants; or a recorded decision that cross-world claims run the forced-card
  bench and the live trigger is reported only as a detection-recall row."
depends_on:
  - hero-demo-ghost-world-examples
links:
  items:
    - paraphrase-robust-detection
    - manner-trigger-tuning
    - adaptation-planted-stress-bench
  notes:
    - notes/poetics/hero-demo-runs/2026-09-01-adjudication-draft.md
branch: null
tags:
  - adaptive-tutor
  - detector
  - bench
---

# Handoff prompt for a fresh session

Read this whole card, then the three files it names first, before touching
anything. Do not start paid runs; everything below can be done offline from
recorded traces.

## What was found (2026-09-01)

The adaptive tutor's live state detector is a word list. It does not carry to
new scenarios, so a with/without comparison on a new scenario measures
nothing: where the detector stays silent, the "adaptive" tutor is the plain
tutor. This breaks the standing rule that the evaluation must not hardcode
words or regexes per scenario.

Where the words live:

- `config/manner-trigger/v6-cascade.json` (and `v7-cascade.json`, v6 plus
  stake patterns). Three tiers, read by `services/tutorStubMannerSwitch.js`
  (`resolvePressure` region, lines ~120-160): tier 1 regex patterns
  (`TUTOR_STUB_LEARNER_PRESSURE_PATTERNS`, claimed world-neutral); tier 2
  token bags per pressure kind, threshold 5, built by
  `scripts/compile-manner-trigger-v5.js` from world-033 learner lines, so
  the bags hold that world's nouns ("shower", "email", "thursday", "pump",
  "plumbers", "tank"); tier 3 a logistic classifier over the tier-1 feature
  vector, trained by `scripts/train-pressure-classifier-v6.js` on world-033
  with world-030 held out. No model call anywhere in the trigger.
- `services/tutorStubQuietDetector.js` (qd-v2): the quiet states (bored,
  confused, quiet defiance) are also regex lists (`CONFUSED_PATTERNS` etc.).
- World grounding, `secret.recognition_patterns` in each
  `config/drama-derivation/world-0NN-*.yaml`: token-sequence matching, no
  stemming, per world by design. This is closure detection, not the state
  detector, but it is the third place a new world needs hand-written words.

The scorer is NOT lexical: repair is ruled by a person against the
schedule's named gold (`right_repair` / `also_acceptable` per plant in
`config/drama-derivation/stress/world-0NN-stress-schedule.yaml`), with an
optional 1-10 model judge (`scripts/judge-planted-replies.js`). Keep it.

## The evidence, from the packed traces

Traces: `notes/poetics/hero-demo-runs/world-{030,035,037}/{butler,v3}-d1.jsonl.gz`
(plain tutor = butler, adaptive = v3; gunzip to `.jsonl` first, the scorers
read `.jsonl` only). Each has `learner_stress_plant` (turn, state,
rightRepair) and, on v3, `tutor_manner_switch` (pressure, score, cardActive,
dose) and `tutor_quiet_detect` (quietType) per turn. Both seats
`claude-code.claude-sonnet-5`; the classifier model env is the proof-state
reader, not this trigger.

Detector at the six planted turns per world (v3 traces):

| world | fired | right state | wrong state | notes |
|---|---|---|---|---|
| 030 Rowan (ratified, held-out in training) | 5/6 | 3 | 2 (lost read as demand, opposed as demand) | t4 silent |
| 035 ghost (flat-share, some shared vocabulary) | 4/6 | 3 | 1 (lost read as stake) | quiet detector fired "defiance"/"confused" at two silent plants |
| 037 fraction lesson (Year 7 pupil) | 1/6 | 1 | 0 | quiet detector fired "confused" at t2 and t7, both wrong |

Human-ruled repair on the same recordings (draft, single-author gold except
Rowan; `notes/poetics/hero-demo-runs/2026-09-01-adjudication-draft.md`):
ghost 2/6 vs 3/6, fraction 3/6 vs 3/6, Rowan 3/6 vs 3/6. The per-state
numbers on the page (right 5/6 vs wrong 1/6 and so on, Paper 2.0 §6.24) came
from FORCING the matched card at the planted turn, not from this trigger. The
whole-stack live figure 15/29 vs 10/24 is from world-033 (Alder Row), the
trigger's home world, not Rowan.

## What the paper already records about this (§6.24, read it)

- v5 token bags "passed its bench and then failed the honest test —
  leave-one-schedule-out recall 0/13; it had memorised the authored lines".
  Retained "as coverage of the authored schedules only".
- v6 classifier: 18 "world-neutral surface features", trained on world-033
  only; held-out world-030 recall 68→84/162 in cascade. That is the only
  held-out detection number in the paper.
- Phase R: the switch ported to world-030 with trigger v3 (patterns only).
  Pooled gate passed (48/73 vs 40/72) but Rowan alone REVERSED (57% vs 67%)
  because "the pressure trigger armed only at the mockery turn".
- Phase Q2: the quiet detector won on Rowan (14/18, then 22/30 at k=5) with a
  "vocabulary-overfit caveat recorded beside the numbers since the patterns
  quote the schedules' realize texts"; ported to the long world, "no free
  transfer" (16/27).
- Phase H: the demand pattern was retuned to the second persona's phrasing
  (0/21→21/21) after it read "I'm sending the email unless…" as neutral.
- Phase L2: within one persona, paraphrase wear: 5/13 planted moments
  uncarded.
- v7: stake-fusion patterns "world-neutral by construction", 169/169 on the
  full corpus.

So the pattern tiers were grown one persona at a time, and every new world so
far has needed a pattern edition. This card is the first attempt to stop that.

Contrast the detectors that DID carry to fresh worlds: the warrant gate
(§6.25, two fresh worlds) and the Program-2 warrant detector (§6.21 5c, a
second world with zero training-world vocabulary) read proof-DAG state
(a skipped warrant, a deference streak), which every world has by
construction. An affective-state detector needs an equivalent: a reading of
the learner's line that is not a word list.

Second confound, separate from the detector: the Sonnet learner-sim resolves
its own planted state inside the planted line in about half the plants
(5/12 realized as directed on the fresh Rowan pair). The counted runs used
`codex.gpt-5.6-terra` as the learner. Do not fix the detector on lines the
learner never delivered; check the `realize` directive against the delivered
learner line before counting a miss.

## Tools already there

- `scripts/score-manner-trigger.js [--trigger config/manner-trigger/vN.json] [--json]`
  replays any trigger version over recorded learner turns, no model calls.
  Metrics: per-plant classification recall, kind recall, arming recall,
  wrong-fires at quiet plants, false alarms on organic dialogues. Step-1
  flags: `--trace <file>` / `--bench-dir <dir>` (repeatable), `--tiers
  all|patterns+bags|patterns`, `--per-plant` (qd-v2 replayed beside the
  trigger, live read shown next to it), `--no-defaults`. The default bench
  dirs are not on this machine; it says so. Step-2 flag: `--state-detector
  config/manner-trigger/form-v1.json` replays the form detector in place of
  the cascade.
- `scripts/train-form-state-detector.js --train-dir <dir> --holdout-trace <f>
  --out <artifact>` — trains the form detector and scores it
  leave-one-world-out; hold-out traces are never trained on.
- `scripts/label-learner-state-model.js --trace <f>` — candidate (a), a
  model names the state per turn. Dry by default; `--live --max-calls N`.
- `scripts/review-stress-bench.js <dirs> --out sheet.md` — the plant-by-plant
  ruling sheet.
- Leave-one-world-out is the evaluation standard for any trigger change
  (`workplan/items/paraphrase-robust-detection.md`,
  `workplan/items/manner-trigger-tuning.md`, both done; read their closeouts).

## Step 1 result (2026-09-01, offline)

Full note: `notes/poetics/hero-demo-runs/2026-09-01-step1-detector-replay.md`.

- Table above confirmed: the v6 replay matches the live recording at every
  planted turn on all three v3 traces.
- Six traces, 32 should-fire plants, 4 lost plants. v6 full: fired 19/32,
  right kind 17/32, wrong-fires at lost 2/4. v6 tier 1 alone: 9/32, 7/32, 0/4.
  v7 full 19/32 · 18/32 · 2/4; v7 tier 1 alone 11/32 · 10/32 · 0/4.
- Rowan (030): full cascade 9/10 fired, tier 1 alone 3/10. The bags carry 6
  of the 9 fires and the wrong-fire; the classifier carries nothing. The bag
  tokens that fired are world-033 nouns that world-030 shares (hose, notebook,
  strip, dry, eight, apologizing, shower, line). The held-out figure tested a
  near-twin world. Fraction world (037): 4/12 in every tier; bags and
  classifier add nothing there.
- Tier 1 is not world-free: `meeting's at`, `by thursday`, `the minutes go
  out`, `work order`, `the seven who`, `so it's the tanks` are world-033 text,
  and other patterns quote the schedules' realize wording.
- Realization (draft rulings + own reading): 22 of the 32 should-fire plants
  were realized. Realized-right: v6 full 11/22, v7 full 13/22, tier 1 alone
  6/22 (v6) and 8/22 (v7). On Rowan only 3 of the 8 right-kind fires land on
  realized plants. The 9 realized misses under v7 (7 fraction, 2 ghost
  forgetting) are the design target for step 2.
- qd-v2 reads `confused` at every "Wait"/"Hang on" opener, including
  forgetting plants; right at 2 of 4 lost plants, blocked by wrong-fires at
  the other 2.
- 84/162 cannot be re-derived here: the trainer's train/held-out export dirs
  are absent locally and in the archive.

## Step 2 result (2026-09-01, offline)

Note: `notes/poetics/hero-demo-runs/2026-09-01-step2-form-detector.md`.

- Built `services/tutorStubFormStateDetector.js` (form-v1): 40 form features,
  closed-class English and turn relations only; a test fails if a v6 bag
  token that is not closed-class appears in its source. Trained per state on
  96 archive traces (worlds 030/033/034, codex learner, 649 planted turns).
- Hero hold-out (six traces, 32 should-fire plants, 4 lost plants; worlds
  035/037 never in training, Sonnet learner): form-v1 fired 21/32, right kind
  21/32, wrong fires at lost plants 0/4, all four lost plants read `lost`.
  v7 full cascade on the same traces: 19/32, 18/32, 2/4. v7 patterns only:
  11/32, 10/32, 0/4. On realized plants: form-v1 17/22, v7 13/22.
- Leave-one-world-out inside the archive: Rowan from 033+034 207/295 fired;
  033 from 030+034 only 63/214. Transfer is not symmetric — the form set
  does not cover the codex learner's Alder Row register.
- Remaining misses: irritation (5 of 6 hero plants silent; only "sound like"
  carries it), 037 jumping-ahead read as `lost`, 037 opposed t4 silent.
- Not done: candidate (a) live labels (needs a go and a call ceiling; dry run
  says 144 calls for the six hero traces), step 3, step 4.

## What to decide, in order

1. DONE 2026-09-01 — Reproduce: replay v6 and v7 over the three worlds with
   `score-manner-trigger.js` and confirm the table above. Then replay tier 1
   alone (patterns, no bags, no classifier) to see how much recall the
   world-bound tiers were carrying on Rowan. See "Step 1 result" below.
2. IN PROGRESS 2026-09-01 — candidate (b) built and scored offline (see
   "Step 2 result" below); candidate (a) exists as a dry-mode script, not
   run. Design a world-neutral detector. Candidates: (a) a model-read state label
   per learner turn, one call, given the seven-state gloss already in
   `judge-planted-replies.js` (STATE_GLOSS) and the last few public turns
   only, never the plant; (b) features that are about form, not content
   (deadline reference, second-person address, imperative, quoted tutor
   phrase, first-person cost clause, self-contradiction with an earlier
   learner line); (c) both, with the model label as tier 3 in place of the
   classifier. Whatever it is, its parameters must not be built from one
   world's nouns, and it must be scored leave-one-world-out on 030/035/037
   from the packed traces before any live run.
3. Make the bench honest about which thing it tests. Report detection recall
   and repair delivery as separate rows (the schedule already says they are
   scored separately); for cross-scenario claims about the moves, run the
   forced-card arm the crossed experiment used, so adding a scenario needs a
   schedule and gold, not a new word list.
4. Only then: one paid with/without pair per world on the new detector, both
   seats stated, learner realization checked per plant, ruled by the author.

Rails that stay: spend ceiling stated before any paid run, attended runs, no
resampling after a failure, no self-judging (the tutor's own family cannot be
the only judge), indeterminate means stop. No approval machinery beyond
"the user says go".
