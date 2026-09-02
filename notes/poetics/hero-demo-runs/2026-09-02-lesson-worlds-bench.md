# Lesson worlds bench — three ordinary lessons, learner DAG on (2026-09-02)

Card: `workplan/items/lesson-world-transfer.md`, step 3.
Go: NOT YET GIVEN. This note states the design and the ceiling; nothing has run.

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
