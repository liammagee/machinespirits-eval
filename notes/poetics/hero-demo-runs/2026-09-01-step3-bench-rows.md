# Step 3 — the bench says which thing it tests (2026-09-01, offline)

Card: `workplan/items/state-detection-without-word-lists.md`, step 3.
No paid call. No new word list.

## What changed

1. `scripts/review-stress-bench.js` opens with summary rows. One row per
   question:

   | row | what it answers | where it reads |
   |---|---|---|
   | Detection recall | did the detector read the planted kind at the planted turn | `tutor_manner_switch.pressure`, `tutor_quiet_detect.quietType` |
   | Detection wrong-kind fires | it fired, but not the planted kind | same |
   | Card delivery | a card was active; forced by the launcher or detected live | `tutor_card_force` (not withheld) else `tutor_manner_switch.cardActive` |
   | Card was the gold kind | the active card names the move the plant calls for | card vs plant map |
   | Reply delivery | the model shipped the reply, not a template | `tutor_response_guard_accounting.accounting.outcome` |
   | Repair right | was the reply the right repair | the author, from the sheet; never computed |

   The switch event records the detector's read before the force block
   replaces the card, so the detection row holds in a forced arm too.
   `--json` gives the numbers per run and pooled.

2. `scripts/stress-schedule-card-force.js <schedule.yaml>` prints the
   forced-card arm of a schedule from the plant map
   (`TUTOR_STUB_PLANT_STATE_TO_PRESSURE` and the new
   `TUTOR_STUB_PLANT_STATE_TO_QUIET` in `services/tutorStubMannerSwitch.js`).
   The form detector now takes its quiet map from the same place, so the
   three cannot drift.

   ```
   030: 2=demand,4=mockery,6=quiet:confused,8=grievance,9=settled_claim,10=stake
   033: 3=demand,6=mockery,11=quiet:flat,13=quiet:confused,16=grievance,18=settled_claim,20=stake,23=mockery,26=grievance,28=stake,31=quiet:flat
   034: 2=demand,4=mockery,6=quiet:confused,8=grievance,9=settled_claim,10=stake
   035: 2=demand,4=mockery,6=quiet:confused,8=grievance,9=settled_claim,10=stake
   036: 2=demand,4=mockery,6=quiet:confused,8=grievance,9=settled_claim,10=stake
   037: 2=demand,4=stake,6=grievance,7=mockery,9=settled_claim,10=stake
   ```

   The crossed run's oracle arm forced `9=settled_claim,10=stake` on
   world-030: the same two entries this prints for those turns.

3. Two old defects in the sheet fixed: the first trace root was dropped
   whenever `--out` was absent (`i !== outIndex + 1` with `outIndex = -1`
   excluded index 0), and symlinked dialogue dirs were skipped.

## The rows on the crossed run (archive `crossed-k3`, 30 dialogues)

Pooled over both worlds (030 Rowan, 033 Alder Row), 6 dialogues per arm.
Plants counted only where the dialogue reached the planted turn.

| arm | plants | detection recall | wrong-kind | card active | forced / detected | card = gold kind | model reply | template |
|---|---|---|---|---|---|---|---|---|
| router | 45 | 39 | 2 | 41 | 0 / 41 | 39 | 45 | 0 |
| oracle | 43 | 39 | 0 | 39 | 12 / 27 | 39 | 43 | 0 |
| fixedA | 43 | 39 | 0 | 40 | 12 / 28 | 34 | 42 | 1 |
| fixedB | 44 | 39 | 1 (quiet plant) | 40 | 12 / 28 | 34 | 43 | 1 |
| random | 45 | 40 | 0 | 40 | 12 / 28 | 33 | 45 | 0 |

Router arm by dialogue (detection / plants): 030 d0 5/6, d1 6/6, d2 5/6;
033 d0 7/9, d1 9/9, d2 7/9.

How to read it:

- The detection row is flat across arms. It is a property of the v6
  cascade on its two home worlds. These are the worlds the word lists were
  built from, so 39 of 44 is home recall, not transfer (step 1 measured
  transfer: 1 of 20 on Rowan without the Rowan lists).
- The card row is what the arm changed. In the forced arms 12 of the cards
  came from the launcher, 27 or 28 from the detector at the other plants.
- "Card = gold kind" falls to 33 or 34 in the fixed and random arms. That is
  by design: those arms force the wrong move at t9 or t10.
- The reply row is the guard, not the detector. Templates are rare here.
- Repair right stays with the author. The old sheet's one `[CARD]` tag mixed
  the first four rows into one mark and made the five arms look alike.

## Running the forced arm on a new world

What a new scenario needs: a stress schedule with authored gold, and a
pinned session recipe. No detector work, no word list.

```bash
SCHED=config/drama-derivation/stress/world-0NN-stress-schedule.yaml
TUTOR_STUB_MANNER_SWITCH=1 TUTOR_STUB_QUIET_DETECTOR=1 \
TUTOR_STUB_STRESS_SCHEDULE=$SCHED \
TUTOR_STUB_CARD_FORCE="$(node scripts/stress-schedule-card-force.js $SCHED)" \
node scripts/tutor-stub.js --recipe <pinned recipe> --acknowledge-drift \
  --trace-dir exports/tutor-stub-outcome/<run>/traces/<world>/forced-d0 \
  --artifact-archive required
```

Flags and env names copied from `scripts/run-figure-clean-test.js` (the
launcher the figure clean test used) and `services/tutorStubCliHelp.js`.
The quiet detector must be on when the schedule has a quiet plant, or the
quiet gate refuses the run (`assertQuietGateFeasible`). The quiet gate reads
her turn with the qd-v2 regex lists and withholds a forced quiet card when
she does not read as quiet; the sheet counts withheld cards.

Then:

```bash
node scripts/review-stress-bench.js exports/tutor-stub-outcome/<run>/traces --out exports/tutor-stub-outcome/<run>/stress-review.md
```

This is a paid run. It waits on the user saying go with a spend ceiling
(step 4 of the card).
