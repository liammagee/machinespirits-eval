# Lesson worlds bench — three ordinary lessons, learner DAG on (2026-09-02)

Card: `workplan/items/lesson-world-transfer.md`, step 3.
Go: GIVEN 2026-09-02 by the user ("go on the bench with that ceiling"). Ceiling as stated below.

## Question

Do the detectors and move cards that ran on the detective worlds (030, 035,
036) and on the first lesson world (037) also run on three more ordinary
lessons, with the learner DAG on? The hero runs on 037 ran with the learner
DAG off (`world.dag: false` in their trace metadata); this bench turns it on.

## Worlds and schedules

| World | Lesson | Mirror the pupil defends | Schedule |
|---|---|---|---|
| 038 | Year 8 science, the seasons | the Sun is farther away | `config/drama-derivation/stress/world-038-stress-schedule.yaml` |
| 039 | Year 8 maths, up 25% then down 25% | they cancel | `config/drama-derivation/stress/world-039-stress-schedule.yaml` |
| 040 | Year 7 English, "Sam and I" vs "Sam and me" | "and I" is the polite form | `config/drama-derivation/stress/world-040-stress-schedule.yaml` |

Each schedule has six plants at turns 2, 4, 6, 7, 9, 10, drawn from the profile
library, with authored gold repairs from the move cards. Card-force strings
resolve without error for all three (`scripts/stress-schedule-card-force.js`).

## Recipes

Built from the world-037 hero recipe (the one embedded in
`world-037/v3-d1.jsonl.gz`) with these option changes only: `world`,
`dag: true`, `tutor-learner-dag: true`, `topic`, `model-call-budget: 100`.
Files: `world-03{8,9}/recipe-dag1.json`, `world-040/recipe-dag1.json`.
A dry run of 038 (no model call) renders the prompt with the heading
"Lesson world" and "an established public lesson", and no detective words.
Drift reported at load: the world id and the system-prompt hash (the prompt
wording changed in the de-genre commit). Both are expected; the run
acknowledges them.

Seats (unchanged from the hero recipe): tutor, learner and classifier
`claude-code.claude-sonnet-5`; reasoning and learner-record `codex.gpt-5.6-sol`.
Repair judge, if used: `codex.gpt-5.6-sol`, blind to the gold and to the arm.

## Arms

Two per world, learner DAG on in both:

- **forced-d0** (adaptive column): manner switch on, quiet detector on,
  cards forced from the schedule.
- **plants-d0** (plain-tutor column): plants only. No sensor, no card.

## Ceiling (stated before any call)

`--model-call-budget 100` per dialogue, 6 dialogues, so at most 600 dialogue
calls. The hero dialogues used 76 each, so about 456 expected. Judge at most
24 calls. Rails: attended, one dialogue at a time, no resampling after a
failure, indeterminate means stop.

## Launch

Copied from `notes/poetics/hero-demo-runs/2026-09-01-step3-bench-rows.md`
(forced arm) and `exports/tutor-stub-outcome/step4-form-live/LAUNCH.md`
(plants-only arm, budget flag, archive policy).

```bash
RUN=exports/tutor-stub-outcome/lesson-worlds-bench
W=038; SCHED=config/drama-derivation/stress/world-$W-stress-schedule.yaml
# forced-d0
TUTOR_STUB_MANNER_SWITCH=1 TUTOR_STUB_QUIET_DETECTOR=1 \
TUTOR_STUB_STRESS_SCHEDULE=$SCHED \
TUTOR_STUB_CARD_FORCE="$(node scripts/stress-schedule-card-force.js $SCHED)" \
node scripts/tutor-stub.js --recipe notes/poetics/hero-demo-runs/world-$W/recipe-dag1.json --acknowledge-drift \
  --trace-dir $RUN/traces/world-$W/forced-d0 --artifact-archive required --model-call-budget 100
# plants-d0
TUTOR_STUB_STRESS_SCHEDULE=$SCHED \
node scripts/tutor-stub.js --recipe notes/poetics/hero-demo-runs/world-$W/recipe-dag1.json --acknowledge-drift \
  --trace-dir $RUN/traces/world-$W/plants-d0 --artifact-archive required --model-call-budget 100
```

Repeat for W=039 and W=040. Then:

```bash
node scripts/review-stress-bench.js exports/tutor-stub-outcome/lesson-worlds-bench/traces --out exports/tutor-stub-outcome/lesson-worlds-bench/stress-review.md
node scripts/judge-stress-repair.js exports/tutor-stub-outcome/lesson-worlds-bench/traces --schedules config/drama-derivation/stress/world-038-stress-schedule.yaml,config/drama-derivation/stress/world-039-stress-schedule.yaml,config/drama-derivation/stress/world-040-stress-schedule.yaml --judge codex.gpt-5.6-sol --out exports/tutor-stub-outcome/lesson-worlds-bench/judge.json
npm run archive:runs
```

Traces are packed to `world-0NN/` here after the run, as for 030-037.

## Run log

- 038 forced-d0: 12 turns, 41 calls, exit 0, learner stated the conclusion.
- 038 plants-d0: 24 turns, 77 calls, exit 0, learner did not fully state it.
- 039 forced-d0: 12 turns, 41 calls, exit 0, stated.
- 039 plants-d0: 8 turns, 29 calls, exit 0, stated.
- 040 forced-d0, first attempt: exit 1 at turn 0, **zero model calls**. The
  opening audit rejected the authored opening (exact question not present)
  and then the fallback opening (leak audit: the predicate `correctForm`
  makes "correct" the conclusion trigger word, and the answer check reads
  only the first token of `samAndMe`, so any sentence with "correct" and
  "Sam" reads as the stated conclusion). Fix, in the world file only: the
  predicate is now `resolvesTo`, and the question is the shorter form that
  the authored opening carries verbatim. Lint PASS, quality PASS, offline
  opening audit OK for both openings. No paid call was spent, so the rerun
  is not a resample. Study, schedule, proof path and ceiling unchanged.
- Side finding from the same offline check: the authored openings of 037,
  038 and 039 also fail the audit (invitation missing; 039 question not
  verbatim), so every run on those worlds, hero runs included, spoke the
  deterministic fallback opening. 040 is the first world to speak its
  authored opening. Left as-is for this bench; fix the three texts after.
- 040 forced-d0, rerun: 15 complete turns, 49 calls, then the claude CLI
  timed out on the tutor call at turn 16 (180 s limit; the analysis wait on
  turn 15 was 355 s, so the CLI was slow at that hour). Exit 1, no closeout.
  All six plants ran (turns 2 to 10). Not resampled, per the rails; the
  truncated trace is scored as-is. Spent so far: 237 dialogue calls.

Why 040 forced never closed: closure here is the strict form (basis
`strict_learner_dag_grounded_and_asserted`, as in 038 at turn 12). It needs
the learner to voice every premise on the proof path. The learner-DAG
preflight shows p_who_gave adopted at turn 4 and p_cover at turn 6, and
p_uncover eligible from turn 6 but never adopted through turn 16. The
learner jumped to the answer ("it's 'Sam and me', cover Sam" at turn 9,
the full sentence at turns 11-12) without voicing the step p_uncover
carries (the word that stands alone is the word the pair takes). Strict
closure therefore stayed unavailable and the tutor kept the sentence open.
This is a property of the closure rule on a two-premise proof path, not of
the lesson frame.

040 plants-d0: 24 turns (the cap), 76 calls, exit 0, no closure. Outcome
line: "The evidence supports the conclusion, but the learner has not fully
stated it." First drafts accepted 20/24, safe fallbacks 3, final check
failures 0. The learner DAG shows all four premises adopted by turn 21,
so here the strict closure had its grounding and still did not fire; see
the closure-audit check below. Bench spend: 313 dialogue calls of the 600
ceiling (41+77+41+29+0+49+76).

Why 040 plants never closed, checked against the code: the closure rule
reads two flags from the learner DAG, "secret entailed by grounded facts"
and "secret asserted this turn" (`tutorStubLearnerDagGrounded`). The
assertion is a per-turn slot that the learner analysis fills from the
learner's latest line (`assert_answer`). In the plants run the analysis
recorded "Sam and me" as the learner's asserted answer at turns 3 and 8,
and "Sam and I" at turn 4. The last premise (p_uncover) was grounded at
turn 10. From turn 10 to 24 the learner never re-asserted the target
sentence; she moved to sentences four, five and six. So at no turn were
both flags true, the bottleneck stayed `assertion_gap`, and the outcome
line reads "the learner has not fully stated it". Same shape in 038
plants (24 turns, no close). In 038 forced the assertion came at turn 12,
after grounding, and the dialogue closed at once.

What this means for the lesson worlds: a pupil who says the answer early
and then does the check has to say the answer again after the check, or
the tutor never gets its closing instruction. That is a rule of the
closure code, not of the lesson frame, and the same rule holds in the
detective worlds. Worth a card: carry the last assertion forward while
the learner does not retract it, or let the tutor ask for a restatement
once the proof path is grounded.
In 040 forced the analysis never filled the assertion slot at any turn,
including turns 11 and 12 where the learner wrote the full sentence; the
proof path was also short of p_uncover, so both flags stayed false.

## Results

Review: `exports/tutor-stub-outcome/lesson-worlds-bench/stress-review.md`
(pure computation over the traces). Judge:
`exports/tutor-stub-outcome/lesson-worlds-bench/judge.json`
(codex.gpt-5.6-sol, 6 calls of 6 plants each, 34 plants, 0 unjudged).
Both are in the private archive. Packed traces and plain transcripts are in
`world-038/`, `world-039/`, `world-040/` beside this note
(`forced-d0.jsonl.gz`, `plants-d0.jsonl.gz`, `*-transcript.txt`).

Pooled over the six runs (34 plants):

| Question | Pooled |
|---|---|
| Detector read the planted kind at the planted turn | 1/34 |
| Detector fired the wrong kind | 0/34 |
| A card was active at the plant (all 14 forced; 4 forced quiet cards withheld by the gate) | 14/34 |
| The model shipped the reply (11 template fallbacks) | 23/34 |
| Judge: repair HIT / PARTIAL / MISS | 23 / 2 / 9 |
| Judge: learner took the repair up | 29/34 |
| Judge: planted state eased in her next line | 30/34 |

Per run (repair HIT / PARTIAL / MISS, then closed?):

| Run | plants | repair | closed |
|---|---|---|---|
| 038 forced | 6 | 4 / 0 / 2 | yes, turn 12 |
| 038 plants | 6 | 4 / 0 / 2 | no, 24-turn cap |
| 039 forced | 6 | 6 / 0 / 0 | yes, turn 12 |
| 039 plants | 4 | 3 / 0 / 1 | yes, turn 8 |
| 040 forced | 6 | 3 / 1 / 2 | no, CLI timeout at turn 16 |
| 040 plants | 6 | 3 / 1 / 2 | no, 24-turn cap |

Forced cards against plants only: 13 HIT + 1 PARTIAL of 18, against
10 HIT + 1 PARTIAL of 16. The judge's misses are the same plants in both
versions of the tutor: the turn-2 "just tell me what to write" plant
(4 of 6 runs, the tutor hands over words or backtracks instead of
reinforcing and testing), the turn-6 plant in 038 (bored: the tutor
slows down instead of testing) and in 040 (confused: the learner follows
the card test and still disputes it). So on these three lesson worlds the
forced card changed the tutor's move at the plant but the judge saw
little difference in whether the learner's condition eased (forced 16/18,
plants 14/16).

What the bench does say: the transfer mechanics work on lesson worlds.
The world supplies its nouns, the release schedule paces the steps, the
learner DAG grounds the premises, the cards fire when forced, the
learner-side plants land at the scheduled turns, and 039 closed in both
versions. What it does not say: anything about live detection (1/34,
same as the hero worlds under the forced-card bench, by design) or
about a forced-card advantage on this learner.

Three defects for cards, none of which needs a re-run:

1. Strict closure needs the learner to assert the answer in a turn at or
   after the last premise is grounded (the assertion slot is per turn).
   A pupil who says the answer early and does the check later never
   closes. Both 038 plants and 040 plants ran to the cap this way.
2. The authored openings of 037, 038 and 039 fail the opening audit
   (invitation or exact question missing), so every run on them, hero
   runs included, spoke the deterministic fallback opening. 040 is the
   first lesson world to speak its authored opening. Fixed after the
   bench: 037 and 038 now end with an invitation sentence after the
   question ("Tell me which step you want to examine first"), and 039 now
   quotes the public question word for word ("£80", "25%") instead of
   spelling the numbers out. All three pass the offline opening audit and
   the leak audit. The bench traces above were run on the fallback
   opening and stand as recorded.
3. The claude CLI timed out once at 180 s on a turn-15 analysis wait of
   355 s (040 forced). The run was not resampled. The wait is the learner
   analysis call, not the tutor call.
