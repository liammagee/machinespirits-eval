---
id: state-detection-without-word-lists
title: "Make the adaptive tutor testable across scenarios without rewiring the detector or the bench"
status: done
type: infra
priority: P1
owner: claude
source: manual
created: 2026-09-01
updated: 2026-09-03
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
    - lesson-world-transfer
  notes:
    - notes/poetics/hero-demo-runs/2026-09-01-adjudication-draft.md
    - notes/poetics/hero-demo-runs/2026-09-02-step5-lesson-fold.md
    - notes/poetics/hero-demo-runs/2026-09-03-step6-pool-widening.md
    - notes/poetics/hero-demo-runs/2026-09-03-step7-quote-manner-cue.md
branch: claude/de-genre-tutor-stub
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

- `scripts/stress-schedule-card-force.js <schedule.yaml>` — prints the
  forced-card arm of a schedule (`2=demand,4=mockery,6=quiet:confused,...`)
  from the plant map, for `TUTOR_STUB_CARD_FORCE`. Step 3.
- `scripts/review-stress-bench.js` now opens with summary rows: detection
  recall, wrong-kind fires, card delivery (forced vs detected), card was the
  gold kind, reply delivery (model vs template), repair right (author-ruled,
  never computed). `--json` for the numbers. Step 3.

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

## Step 3 result (2026-09-01, offline)

Two changes, no paid call. Full note:
`notes/poetics/hero-demo-runs/2026-09-01-step3-bench-rows.md`.

**Separate rows.** The review sheet now answers four questions in four rows
instead of one `[CARD]` tag: did the detector read the planted kind (the
switch event records its read before a forced card replaces the card, so
the row holds in every arm); was a card active and how did it enter (forced
by the launcher or detected live); did the model ship the reply or a
template; was the repair right (the author rules it from the sheet; the
bench never judges its own repairs). Replayed over the crossed run's 30
dialogues, pooled both worlds, 6 dialogues per arm:

| arm | plants | detection recall | card active (forced / detected) | card = gold kind | model reply |
|---|---|---|---|---|---|
| router | 45 | 39 (2 wrong-kind) | 41 (0 / 41) | 39 | 45 |
| oracle | 43 | 39 | 39 (12 / 27) | 39 | 43 |
| fixedA | 43 | 39 | 40 (12 / 28) | 34 | 42 |
| fixedB | 44 | 39 (1 wrong-kind, at a quiet plant) | 40 (12 / 28) | 34 | 43 |
| random | 45 | 40 | 40 (12 / 28) | 33 | 45 |

Read: the detection row is the same in every arm (about 39 of 44) because
it is a property of the v6 detector on its two home worlds, not of the arm;
the card row is what the arm changed; the "card = gold kind" row falls in
the fixed and random arms because those arms force the wrong move on
purpose. Under the old one-tag sheet these five arms looked alike.

**Forced arm from a schedule.** `stress-schedule-card-force.js` turns a
schedule into the `TUTOR_STUB_CARD_FORCE` string from the plant map alone
(`services/tutorStubCardForce.js`, `cardForceScheduleFromStressPlants`).
On the ratified world-030 schedule it prints
`2=demand,4=mockery,6=quiet:confused,8=grievance,9=settled_claim,10=stake`;
the crossed run's oracle arm forced exactly `9=settled_claim,10=stake` at
those plants. So a new scenario needs a schedule and its gold and nothing
else; the tutor is told the right move at the planted turn with no detector
in the loop, and the detection row still reports what the detector read.
One caveat: a forced quiet card passes the existing quiet gate, which reads
her turn with the qd-v2 regex lists, so a quiet plant she does not realize
as quiet is withheld (the sheet counts these).

Also fixed: the old sheet dropped the first trace root whenever `--out` was
absent (an index-0 filter bug), and did not follow symlinked dialogue dirs.

## Step 4 result (2026-09-02, paid: 303 dialogue calls + 4 judge calls, ceiling 400 + 40)

Full note: `notes/poetics/hero-demo-runs/2026-09-02-step4-form-live.md`.
Artifacts: `exports/tutor-stub-outcome/step4-form-live/` (archived, ledger
line `step4-form-live`).

- form-v1 ran as the one live sensor (`TUTOR_STUB_FORM_DETECTOR=config/manner-trigger/form-v1.json`,
  with `TUTOR_STUB_MANNER_SWITCH=1 TUTOR_STUB_CARD_DOSE_LADDER=1`); the
  word-list sensors did not run. Every read is a `tutor_form_state` trace line.
- Detection at the planted turn: world 036 6/6; world 037 2/6 (three
  question-shaped plants read as `lost`, one missed). Both worlds unseen in
  training. Not world-neutral yet: a question reads as confusion.
- Repair, judge `codex.gpt-5.6-sol` blind to gold and arm: with 7/12 HIT,
  3 PARTIAL, 2 MISS; without 6/12 HIT, 0 PARTIAL, 6 MISS. Sonnet makes the
  gold move on half the plants with no card at all.
- Learner took up the move next turn: 10/12 in both arms, same two plants
  failing. Plants realized 23/24. "Eased" is weak by design (sim returns to
  brief); read uptake.
- Template fallbacks at planted turns 7/24 (with 3, without 4).
- Second reader: `blind-packet.md` + `blind-key.json`; compare with
  `scripts/stress-blind-packet.js compare`.
- Seats: tutor/learner/classifier Sonnet 5 (claude-code); reasoning and
  learner-record codex.gpt-5.6-sol — same family as the judge; say so.
- Reading: the sensor works live and carried to one of two unseen worlds; the
  card's effect on the learner is not shown on one pair per world.

## Step 5 result (2026-09-02, offline)

Full note: `notes/poetics/hero-demo-runs/2026-09-02-step5-lesson-fold.md`.
The three lesson worlds of the transfer bench (038/039/040, Sonnet learner,
never in any training set) give a second fresh test of the form detector.

- Frozen replay over the six bench traces (24 pressure plants, 6 quiet
  plants): form-v2 13/24 right kind, 2/6 wrong-fires at quiet; form-v1 13/24,
  1/6; v7 cascade 7/24, 0/6; v7 patterns only 7/24, 0/6. Every miss is one
  of three shapes: the question-shaped demand at t2 (0/6), the opposed line
  that appeals to a rule and asks to move on at t4 (0/4), and one "Wait,
  no" forgetting line. Bored sarcasm in 040 read as mockery twice.
- The trainer on the archive pool alone reproduces form-v2 exactly. With the
  six lesson traces added to the pool (102 traces, cues unchanged), the
  leave-one-world-out folds hold at zero wrong-fires everywhere: 030 231/295
  (form-v2 213/295), 035 8/10, 036 17/20, 037 16/24 (14/24), 038 3/8, 039
  7/8, 040 6/8. On the hero hold-outs the final model reads 48/64 right kind
  (form-v2 46/64) with false alarms 22/216 (33/216).
- Shipped as `config/manner-trigger/form-v3.json` (version form-v3, cue set
  form-v2, provenance in `trainedOn`). Opt-in by path, as before; nothing
  live has run on it. form-v2 stays loadable and pinned.
- Still unsupported: the rule-appeal opposed line (0/6 across 037/038/040
  in every model; the pool's opposed rows are stake-shaped — a coverage
  limit, not a cue to add); the 040 confused line at t6 reads as irritated
  in its fold (a live run would fire a mockery card at a confused pupil); no
  quiet-state reads on the lesson worlds (the quiet channel is still qd-v2).

## Closeout (2026-09-02)

Verification branch 1 is met on the numbers: a detector with no per-world
word list, leave-one-world-out, reads 231/295 planted turns on world-030
(the v6 cascade's held-out figure was 84/162), 8/10 on 035 and 16/24 on 037,
with zero wrong-fires at quiet plants; the same detector reads 16/24 on
three lesson worlds it never saw. Two caveats stay beside the numbers: the
030 pool holds a near-twin world (033), and the three miss shapes above are
not covered. Branch 2 was also recorded at step 3 (cross-world claims run
the forced-card bench; the live trigger is a detection-recall row).

Open follow-ups, none started without a go: the blind second reader on the
step-4 packet (waits on the user); one 037 pair with the learner-sim `hold`
block; candidate (a) model labels (144 calls dry estimate); a live pair on
form-v3.

## What to decide, in order

1. DONE 2026-09-01 — Reproduce: replay v6 and v7 over the three worlds with
   `score-manner-trigger.js` and confirm the table above. Then replay tier 1
   alone (patterns, no bags, no classifier) to see how much recall the
   world-bound tiers were carrying on Rowan. See "Step 1 result" below.
2. DONE 2026-09-02 — candidate (b) built (form-v1, form-v2) and re-trained on
   a wider pool (form-v3, see "Step 5 result" below); candidate (a) exists as
   a dry-mode script, not run. Design a world-neutral detector. Candidates: (a) a model-read state label
   per learner turn, one call, given the seven-state gloss already in
   `judge-planted-replies.js` (STATE_GLOSS) and the last few public turns
   only, never the plant; (b) features that are about form, not content
   (deadline reference, second-person address, imperative, quoted tutor
   phrase, first-person cost clause, self-contradiction with an earlier
   learner line); (c) both, with the model label as tier 3 in place of the
   classifier. Whatever it is, its parameters must not be built from one
   world's nouns, and it must be scored leave-one-world-out on 030/035/037
   from the packed traces before any live run.
3. DONE 2026-09-01 (offline; see "Step 3 result" below) — Make the bench
   honest about which thing it tests. Report detection recall and repair
   delivery as separate rows (the schedule already says they are scored
   separately); for cross-scenario claims about the moves, run the forced-card
   arm the crossed experiment used, so adding a scenario needs a schedule and
   gold, not a new word list.
4. DONE 2026-09-02 (paid; see "Step 4 result" below) — one with/without pair
   per hero world on form-v1 live, seats stated, realization checked per plant
   by a codex judge blind to gold; a human second reader gets the blind packet.
   (User changed "ruled by the author" to automated judge + blind human reader.)

Rails that stay: spend ceiling stated before any paid run, attended runs, no
resampling after a failure, no self-judging (the tutor's own family cannot be
the only judge), indeterminate means stop. No approval machinery beyond
"the user says go".

## Follow-up runs after closeout (2026-09-02, paid)

- Candidate (a) model labels run, 287 Sonnet calls under a 300 ceiling. Right kind 53/66 vs form-v3 49/66; off-plant fires 35/205 vs 19/205. form-v3 stays shipped. Note `notes/poetics/hero-demo-runs/2026-09-02-step6-model-labels.md`. Labeller defect (bare model string to the bridge) fixed ed26216a9, no spend lost.
- **Live pair on form-v3 (037), 2026-09-02, paid.** Ceiling 100 calls per
  dialogue ×2 plus 20 judge calls; used 76 + 75 + 2. form-v3 read 4/6 plants
  right (form-v1 at step 4: 2/6, with 3 wrong-kind fires), 0 wrong kind,
  2 off-plant fires on 18 turns (step 4: 5). Judge (codex.gpt-5.6-sol, blind):
  repair HIT 4/6 with the card, 2/6 without; uptake 5/6 both arms. Lean, not
  result. Note `notes/poetics/hero-demo-runs/2026-09-02-step6-form-v3-live.md`;
  artifacts `exports/tutor-stub-outcome/step6-form-v3-live/`, archived.
- **Hold pair on 037, 2026-09-02, paid.** Schedule copy with `hold: turns 1`
  on plants 2 and 4 (6/7 and 9/10 are adjacent, so they cannot hold).
  Ceiling 200 dialogue + 20 judge calls; used 38 + 40 + 2, turn cap 12. Hold
  events fired at t3 and t5 in both arms. The sim dropped the state on all
  three held turns where the reply missed the release; the one held-looking
  turn is the answer-seeking plant, which the standing brief asks for anyway.
  The release text leaked into one plant line. Repair HIT 4/6 with, 3/6
  without (step 6 again). Next step is offline: stricter hold direction,
  release text hidden on the planted turn, with a test. Note
  `notes/poetics/hero-demo-runs/2026-09-02-step7-hold-live.md`; artifacts
  `exports/tutor-stub-outcome/step7-hold-live/`, archived.
- Model second reader on the three blind packets (3 calls, Sonnet 5, judge was codex): card effect keeps its direction on every packet, reader margin one plant (step 6: 4/6 vs 3/6; judge 4/6 vs 2/6); kappa on HIT vs not 0.67 / 0.50 / 0.31; move tags agree on half the items or fewer. Opus 5 read the same packets (3 more calls): step 6 5/6 vs 2/6, kappa 0.83; step 7 4/6 vs 2/6; step 4 (form-v1) reversed to 4/12 vs 5/12, so step 4 is not citable alone. A human reader is still needed; the model reads do not close that.
- Offline hold-block rework (2026-09-02, no paid call): release text hidden on the planted turn; held turn names the drop as the exception and makes the sim quote the releasing words on a private `HOLD:` line, stripped and recorded as `learner_stress_hold_verdict` with a `quoteFound` check. Canned-dialogue test `tests/tutorStubStressHoldWiring.test.js`. A paid 037 hold pair on the reworked direction needs its own go. Note `notes/poetics/hero-demo-runs/2026-09-02-model-second-reader.md`; script `scripts/score-blind-packet-model.js`.
- **Hold pair on 037 again, 2026-09-03, paid, on the reworked direction.** Ceiling 200 dialogue + 20 judge calls; used 40 + 40 + 2, turn cap 12. All four held turns wrote `HOLD: kept`, none claimed a release. The release leak is gone. Both t3 turns kept the state in speech (the brief asks for that line anyway); both t5 turns conceded five sixths in speech while marking `kept`, after the same template reply that shows the six-piece cut. Repair HIT 5/6 with, 4/6 without (within one plant of step 7). The hold still cannot show a card lifting a state the sim would keep. Next is offline (a speech-versus-verdict check, or a plant whose brief does not pull the same way); no re-run as is. Note `notes/poetics/hero-demo-runs/2026-09-03-step7b-hold-rework-live.md`; artifacts `exports/tutor-stub-outcome/step7b-hold-rework/`, archived.
- Offline follow-up (2026-09-03, no paid call): speech check built, opt-in `TUTOR_STUB_STRESS_HOLD_SPEECH_CHECK=1`: a model read of the held-turn line against the planted state, one retry with the reading fed back when a `kept` verdict sits on a conceding line, all drafts recorded (`learner_stress_hold_speech_check`); unreadable reading stops the retry. Tests in the two stress test files. Next pair designed, not run: same hold schedule with the overconfident brief (`--auto-learner-profile overconfident`), so the t5 concession is not the brief speaking. Launch line in the step-7b note. Needs its own go and ceiling.
- **Hold pair on 037 a third time, 2026-09-03, paid: overconfident brief plus the speech check (step 7c).** Ceiling 200 dialogue + 20 judge calls; used 44 + 45 + 2, turn cap 12; a first judge pass hit a codex outage and was rerun an hour later. All four held turns wrote `HOLD: kept`; on three of four the spoken line conceded five sixths anyway, the reader caught all three, and the one retry kept the state each time by repeating the schedule's sample line near verbatim. So the verdict line is the weaker record and the reader is the one to trust; the hold now works but costs two calls per held turn and holds a sentence, not a stance. The overconfident brief opens with the right answer, so the opposed plant has her contradict herself; it moved the confound, did not remove it. Repair HIT 5/6 with, 3/6 without (with-arm same as 7b). Next is offline: one hold event per turn not per draft, a retry asking for her own words with the reader flagging a copy of the sample line, and a brief orthogonal to both plants (low_agency or memory_limited). No re-run as is; do not widen to 036. Note `notes/poetics/hero-demo-runs/2026-09-03-step7c-hold-overconfident-live.md`; artifacts `exports/tutor-stub-outcome/step7c-hold-overconfident/`, archived.
- **Pool widening on three new lesson worlds (041/042/043), 2026-09-03, paid.** Six plants-only dialogues (Sonnet and codex learners), ceiling 100 calls each; used 335 (24 on two failed starts) plus 6 judge calls. Both failed starts were world-text defects (a leaked answer word in 042, a duplicated clue sentence in 043), fixed offline and pinned by `tests/derivationWorldSurfacesPassTutorGuards.test.js`; the two Sonnet dialogues ran again as `d1` on the fixed worlds, the failed `d0` traces kept. All 32 plants realized; the irritated lines avoid "sound like". Detection offline on the 26 pressure plants: form-v3 (unseen) 4/26 right kind; form-v4, retrained on the widened pool and scored leave-one-world-out, 6/26; 042 reads 0/10 under both, and the three new irritated shapes ("reading off a card", "Oh come on", "I'm not five") are silent under both. On the eight hero hold-outs form-v4 equals form-v3 plant for plant (29/42, 0/6 wrong-fires). Shipped `config/manner-trigger/form-v4.json`, opt-in, pinned; form-v3 unchanged. Plain-tutor repair with no card, judge codex blind: HIT 18 / PARTIAL 4 / MISS 10, the t2 demand missed in all six. The pool is not the limit for the new shapes; the cue set is. Next is offline only. Note `notes/poetics/hero-demo-runs/2026-09-03-step6-pool-widening.md`; artifacts `exports/tutor-stub-outcome/step6-pool-widening-2026-09-03/`, archived.
- **One more closed-class cue, gated on 042 held out, 2026-09-03, offline.** Cue set `form-v3` = `form-v2` plus one conjunction, `quote_manner_challenge` (a quoted span plus, outside it, a demand to say it plainly or a challenge to the speech itself), and a quote matcher that no longer lets a straight apostrophe open a span; trainer takes `--feature-version`. Same pool, seed and hyper-parameters as form-v4. Gate: 042 held out 0/10 to 2/10 right kind (both irritated lines), wrong-fires 0/2, false alarms 2/28 unchanged. Elsewhere: 043 3/8 to 4/8, 033 63/214 to 68/214; 041 3/8 to 2/8, 036 7/10 to 6/10, 030 234/295 to 223/295, all losses near-threshold quote-less sound-like lines and deadline demands, not at the cue; hero hold-outs 29/42 to 28/42, false alarms 9/144 to 6/144, 0/6 wrong-fires. Shipped `config/manner-trigger/form-v5.json`, opt-in, pinned; form-v4 unchanged; nothing live. No paid run. Note `notes/poetics/hero-demo-runs/2026-09-03-step7-quote-manner-cue.md`.
