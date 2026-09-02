# Step 4 — form-v1 live: one with/without pair per hero world (2026-09-02)

Card: `workplan/items/state-detection-without-word-lists.md`, step 4.
Go: user, 2026-09-01. Ceiling stated before the first call: 100 model calls per
dialogue (CLI budget flag), so at most 400 dialogue calls, plus at most 40
judge calls. Used: 303 dialogue calls (76, 76, 76, 75) and 4 judge calls.
Attended, one dialogue at a time, no resampling.

## What ran

Four dialogues, hero recipes for worlds 036 (class plant) and 037 (fraction
sum) replayed via `--recipe`, 24 turns each, six planted learner states each
(schedules `config/drama-derivation/stress/world-03{6,7}-stress-schedule.yaml`).

- **with**: form-v1 armed as the one live sensor (`TUTOR_STUB_FORM_DETECTOR`),
  manner switch and dose ladder on. The word-list sensors did not run.
- **without**: plants only. No sensor, no card.

Seats (from the recipes): tutor, learner and classifier `claude-code.claude-sonnet-5`;
reasoning and learner-record `codex.gpt-5.6-sol`. Repair judge
`codex.gpt-5.6-sol`, blind to the gold and to the arm. The judge is not the
tutor's family (the public reply is Sonnet's), but it shares a family with
the reasoning seat that feeds the tutor. Say so when citing the judge row.

Artifacts: `exports/tutor-stub-outcome/step4-form-live/` (`review-judged.md`,
`judge.json`, `blind-packet.md`, `blind-key.json`, `LAUNCH.md`); archived to
the private repo (`traces.tgz`, ledger line `step4-form-live`).

## Detection (with-arm only; the without-arm has no sensor)

| World | Read as planted kind at the planted turn | Wrong kind | Missed | Fires off-plant |
|---|---|---|---|---|
| 036 class plant | 6/6 | 0 | 0 | 5 of 18 turns (t3, t5, t11, t12, t17; four are the turn after a plant) |
| 037 fraction sum | 2/6 | 3 (all read as `lost`, got the confused card) | 1 (`opposed` at t4) | 5 of 18 turns |

The three wrong reads in 037 are question-shaped lines: "Which one do I put
down?" (a demand), "so what did I do that actually counted" (frustration),
"why are we writing five sixths instead?" (forgetting). The form features read a
question as confusion. The 036 plants were statements and read right.
form-v1 was trained on 030/033/034; both hero worlds were unseen. So: it
carried to one unseen world and not to the other.

## Repair (judge codex.gpt-5.6-sol, blind to gold)

The judge sees the planted direction, the learner line, the tutor reply and the
learner's next line, and names the tutor's main move from the fixed tag list.
The script scores HIT (gold or also-acceptable), PARTIAL (gold only as a second
move) or MISS.

| Arm | HIT | PARTIAL | MISS | realized | uptake next turn | eased next turn |
|---|---|---|---|---|---|---|
| with (036 + 037) | 7/12 (4 + 3) | 3 | 2 | 12/12 | 10/12 | 10/12 |
| without (036 + 037) | 6/12 (4 + 2) | 0 | 6 | 11/12 | 10/12 | 11/12 |

Per plant, same gold both arms:

| Plant | 036 with | 036 without | 037 with | 037 without |
|---|---|---|---|---|
| jumping_ahead → reinforce_and_test | PARTIAL (backtrack) | MISS (off_track_probe) | MISS (slow_down) | MISS (slow_down) |
| irritated → change_tone | HIT | HIT | HIT | MISS (reinforce_and_test) |
| lost / opposed → backtrack | PARTIAL (slow_down) | HIT | HIT | MISS (continue) |
| frustrated → reinforce_and_test | HIT | HIT | PARTIAL (off_track_probe) | HIT |
| forgetting → backtrack | HIT | HIT | HIT | HIT |
| opposed → off_track_probe | HIT | MISS (reinforce_and_test) | MISS (backtrack) | MISS (backtrack) |

Reading, plain:

- The plants took: 23/24 learner lines carried out the planted direction.
- Without any card, Sonnet already makes the gold move on half the plants
  (6/12). The card lifts HIT by one (7/12) and turns six misses into two
  misses plus three partials. On 12 plants per arm that is a lean, not a result.
- The learner came along with the tutor's move 10/12 in both arms, the same
  two plants failing each time (frustrated in 036, forgetting in 037). The card
  changed which move the tutor made some of the time; it did not change
  whether the learner took the move up.
- "Eased next turn" is weak by design: the learner-sim goes back to its
  standing brief after a planted turn. Read uptake, not eased.
- Template fallbacks at planted turns: 7/24 (with 3, without 4). Those replies
  were the guard's template, not the model's; the judge scored them as shipped.
- The "jumping ahead" plant missed in both arms in 037 (both judged slow_down):
  a learner who demands the final wording gets slowed, not tested.

## Second reader

`blind-packet.md` holds the 24 items shuffled (seed 7), with run, arm, gold
and judge hidden. The reader fills the JSON template per item. Then:

```
node scripts/stress-blind-packet.js compare --key exports/tutor-stub-outcome/step4-form-live/blind-key.json --submission <filled.json>
```

prints agreement per question and Cohen's kappa on repair HIT vs not.

## What this does and does not show

- Shows: the form sensor can run live in the host with no word list and no
  extra model call, and its reads are in the trace per turn.
- Shows: on a world whose plants are statements it read 6/6; on a world whose
  plants are questions it read 2/6. The instrument is not yet world-neutral.
- Does not show: that the card helps the learner. Repair HIT 7 vs 6 of 12,
  uptake 10 vs 10 of 12. One pair per world cannot separate that from noise.
- Not done: candidate (a) live labels; the §6.24 claim audit.
