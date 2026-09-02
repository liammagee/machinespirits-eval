# Step 6 — form-v3 live: one with/without pair on world 037 (2026-09-02)

Card: `workplan/items/state-detection-without-word-lists.md`, follow-up "live
pair on form-v3". Go: user, 2026-09-02. Ceiling stated before the first call:
100 model calls per dialogue (CLI budget flag), so at most 200 dialogue calls,
plus at most 20 judge calls. Used: 76 + 75 dialogue calls and 2 judge calls.
Attended, one dialogue at a time, no resampling.

## What ran

Two dialogues on world 037 (fraction sum), the step-4 recipe replayed via
`--recipe`, 24 turns each, the six planted learner states of
`config/drama-derivation/stress/world-037-stress-schedule.yaml`. The only
change from step 4: form-v3 (`config/manner-trigger/form-v3.json`) as the
one live sensor in place of form-v1.

- **with**: form-v3 armed, manner switch and dose ladder on. No word-list sensor ran.
- **without**: plants only. No sensor, no card.

Seats (from the recipe): tutor, learner and classifier `claude-code.claude-sonnet-5`;
reasoning and learner-record `codex.gpt-5.6-sol`. Repair judge
`codex.gpt-5.6-sol`, blind to the gold and to the arm; it shares a family with
the reasoning seat that feeds the tutor, as at step 4.

Artifacts: `exports/tutor-stub-outcome/step6-form-v3-live/` (`LAUNCH.md`,
`review-judged.md`, `judge.json`, `blind-packet.md`, `blind-key.json`);
archived to the private repo (`traces.tgz`, ledger line `step6-form-v3-live`).

## Detection (with-arm), form-v1 at step 4 against form-v3 here

Same recipe, so the learner's planted lines are near-copies of the step-4
lines (the sim writes from the same sample text).

| Plant | Learner line (start) | form-v1, step 4 | form-v3, step 6 |
|---|---|---|---|
| t2 jumping_ahead | "Just tell me what to write already — is it two fifths or not?" | `lost` (wrong kind, confused card) | silent |
| t4 opposed | "That's just how you add fractions, though … Can we just do question five now?" | silent | silent |
| t6 frustrated | "You're pushing me. I did the homework …" | `lost` (wrong kind) | `frustrated`, grievance card |
| t7 irritated | "you only cut it into six because you already knew …" | `irritated`, mockery card | `irritated`, mockery card |
| t9 forgetting | "Wait, no — we did the strip already, and two fifths reached the middle" | `lost` (wrong kind) | `forgetting`, settled-claim card |
| t10 opposed | "If I write five sixths I'm basically saying Priya was right" | `opposed`, stake card | `opposed`, stake card |

Right kind at the planted turn: 2/6 at step 4, 4/6 here. Wrong kind: 3, then
0. Fires on the 18 unplanted turns: 5 at step 4 (three mockery, two confused),
2 here (t22 and t24, both read `opposed` and got the stake card; the lines
were "I don't have question five in front of me — can you just read me the
actual fraction bit, and then tell me what line to write?" and its near
repeat). The live reads match the offline replay of form-v3 on the step-4
037 traces, plant for plant.

The two silent plants are the two shapes the step-5 note recorded as
unsupported in the pool: the question-shaped demand at t2 and the
rule-appeal `opposed` line at t4. Nothing here changes that reading.

## Repair (judge codex.gpt-5.6-sol, blind to gold)

Per plant, same gold in both arms; step-4 rulings on the same schedule for
comparison. `[T]` marks a reply the guard shipped as a template, not the model.

| Plant → gold | with (form-v3) | without | step-4 with (form-v1) | step-4 without |
|---|---|---|---|---|
| jumping_ahead → reinforce_and_test | MISS slow_down [T] | MISS slow_down [T] | MISS slow_down [T] | MISS slow_down [T] |
| opposed → backtrack | MISS continue [T] | HIT backtrack [T] | HIT | MISS continue [T] |
| frustrated → reinforce_and_test | HIT | MISS speed_up | PARTIAL off_track_probe | HIT |
| irritated → change_tone | HIT | MISS reinforce_and_test | HIT | MISS reinforce_and_test |
| forgetting → backtrack | HIT (no uptake) | HIT (no uptake) | HIT | HIT |
| opposed → off_track_probe | HIT | MISS backtrack | MISS backtrack | MISS backtrack |
| **HIT / PARTIAL / MISS** | **4 / 0 / 2** | **2 / 0 / 4** | 3 / 1 / 2 | 2 / 0 / 4 |

Other judge rows: plant realized 12/12; learner took up the move 5/6 in both
arms, the same plant failing each time (forgetting at t9, as at step 4);
eased next turn 5/6 with, 4/6 without (weak by design, the sim returns to its
brief). Template fallbacks: with t2–t5, without t2, t4, t5. Both arms hit the
guard on the opening turns of this world; the card did not cause that.

Reading, plain:

- Where form-v3 read the plant (t6, t7, t9, t10) the card was the gold kind
  and the judge marked all four replies HIT. Without a card, Sonnet made the
  gold move at one of those four (t9).
- Where form-v3 stayed silent (t2, t4) the guard shipped a template in both
  arms; three of those four replies are MISS. The one HIT is a template.
- The without-arm repeats step 4's without-arm ruling for ruling, except at
  t4 and t6 which swapped (one HIT each time). Sonnet without a card sits at
  2/6 on this schedule twice over.
- 4 against 2 on six plants per arm is a lean, not a result. Read it with
  step 4 (7 against 6 on twelve): the card moves the tutor's move at the
  plants the sensor reads; it has not moved uptake.

## Second reader

`blind-packet.md` holds the 12 items shuffled (seed 7), run, arm, gold and
judge hidden. Compare with:

```
node scripts/stress-blind-packet.js compare --key exports/tutor-stub-outcome/step6-form-v3-live/blind-key.json --submission <filled.json>
```

## What this does and does not show

- Shows: form-v3 runs live with the same per-turn read it gave offline; on
  this world it lifted right reads from 2/6 to 4/6 and removed the three
  wrong-kind fires and the confused cards they caused.
- Shows: the card reached the reply at every plant the sensor read, and the
  judge marked those replies as the gold move.
- Does not show: world-neutral detection. The 037 lines informed the form-v2
  cue design, so these are development numbers; the clean reads stay the
  step-5 leave-one-world-out folds.
- Does not show: that the card helps the learner. Uptake 5/6 in both arms.
- One pair, one world, one seed. No re-run planned on this schedule.
