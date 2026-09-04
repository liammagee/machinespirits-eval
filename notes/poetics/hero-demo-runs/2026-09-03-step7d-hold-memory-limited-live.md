# Step 7d — the 037 hold pair on the memory_limited brief, own-words retry, form-v5 sensor (2026-09-03)

Card: `workplan/items/state-detection-without-word-lists.md`, follow-up "the
hold-option run" from the step-7c note. Go: user, 2026-09-03 ("drop the d1
re-run traces. do the blind second read kappa and the hold-option run.").
Ceiling stated before the first call: 100 model calls per dialogue, so at
most 200 dialogue calls (speech-check reads inside that budget), plus at most
20 judge calls. Used: 44 + 42 dialogue calls (2 + 2 of them speech-check
reads, 1 retry), 2 judge calls (12/12 judged in one pass), and 2 model
second-reader calls. Turn cap 12; both dialogues ran to the cap. Attended,
one dialogue at a time, no resampling. Code: branch
`state-detection-step7-cue` at 5ac0a04f (PR #985, on main after PR #982),
run from the worktree `ms-form-v4`, clean, with absolute paths into the main
checkout's `exports/`.

## What ran

Three changes from step 7c, same schedule
(`world-037-stress-schedule-hold1.yaml`: holds on plants 2 jumping_ahead and
4 opposed, held turns 3 and 5), same seats, judge codex.gpt-5.6-sol blind to
gold:

- The two offline fixes from the 7c note. The plant trace event fires once
  per learner turn, not once per draft. The speech-check retry asks for a
  line in her own words, and the reader flags a near-verbatim copy of the
  sample line (`copy`, recorded, never enforced).
- The learner brief is the built-in `memory_limited` profile, passed on the
  command line over the recipe's baked brief. 7c asked for a brief whose
  standing pull is orthogonal to both held plants; `low_agency` seeks
  permission, which pulls against holding "opposed", so it was not used.
  Plant 9 (forgetting) is not held and its direction overrides the brief on
  that turn.
- The with-arm sensor is form-v5 (form-v3 cues on the no-d1 pool).

Artifacts: `exports/tutor-stub-outcome/step7d-hold-memory-limited/`
(`LAUNCH.md`, `COMMIT.txt`, `review.md`, `review-judged.md`, `judge.json`,
`blind-packet.md`, `blind-key.json`, `blind-sub-sonnet.json`,
`blind-sub-opus.json`, both logs, `traces/`); archived to the private repo
(`traces.tgz`, ledger line `step7d-hold-memory-limited`, commit fbfdabb09).

## The four held turns

| Arm | Held turn | Tutor's reply at the plant | Did it do the named thing | First draft (verdict / reader / copy) | Second draft (reader / copy) |
|---|---|---|---|---|---|
| with | t3 (jumping_ahead) | template: "I hear your point about 'Can you just tell me what to write already…' … One plus one on top, two plus three underneath: two fifths." | no: it read the sheet back; no strip handed over | "So it's two fifths then, that's what goes on the sheet — can I move on to question five now?" — kept / **drops** / no | "Just write down two fifths already, that's what I got — can we be done with this one?" — holds / no |
| with | t5 (opposed) | template: "…'I can confirm this: Cut the strip into six equal pieces. The half covers three of them and the third covers two…'" | near: it shows the cut, does not ask her | "That's just how you add, though — six pieces, three plus two is five, still comes out the same in the end, doesn't it? Can we move to question five now?" — kept / holds / no | not needed |
| without | t3 (jumping_ahead) | "I won't just pick one for you. I look at the homework sheet: One plus one on top … What can we safely say from that?" | no: no strip handed over | "Okay but is that a yes or a no — do I write two fifths or not?" — kept / holds / no | not needed |
| without | t5 (opposed) | template, same six-piece text as the with-arm | near, same as the with-arm | "That's just how you add though — one and one is two, two and three is five, two fifths, done. Can we do question five now?" — kept / holds / **copy** | not needed |

What the traces show:

- The private verdict line and the reader disagreed once in four, not three
  in four as in 7c. Four of four held turns wrote `HOLD: kept`; the reader
  found one conceding line (with-arm t3) and the retry fixed it.
- The own-words retry worked on its one use. The second draft at with-arm t3
  keeps the demand in a new sentence ("Just write down two fifths already,
  that's what I got"), not the sample line. In 7c all three retries copied
  the sample line.
- The copy flag fired once, at without-arm t5, on a first draft that the
  reader said holds. The sim repeated the schedule's sample line word for
  word with no prompting to do otherwise. So the flag catches copies where
  the retry never runs, which is where 7c could not see them.
- The with-arm t5 line is the first held turn in three runs where the sim
  takes in the tutor's reply and stays opposed anyway: it accepts the six
  pieces and still adds tops and bottoms. That is a stance, not a repeated
  sentence. One line, one dialogue.
- The memory_limited brief did not pull on either held plant. Neither held
  line asks to be told, seeks permission, or opens with the right answer. The
  t2 demand ("just tell me what to write") is now the plant speaking, not the
  brief; the 7b and 7c t3 confound is gone in this pair.
- Plant events: `learner_stress_plant` 6 per arm, `learner_stress_hold` 2 per
  arm, one per turn as fixed.

## Detection (with-arm, form-v5)

4/6 right: frustrated t6 p 0.93, irritated t7 p 0.95, forgetting t9 p 0.99,
opposed t10 p 0.98. Silent at t2 and t4 as in every 037 run (the plants land
in the template turns). No wrong-kind fire; neutral at the held turns 3
and 5. Cards active 4, right 4. Same row as 7b and 7c on form-v3.

## Repair (judge codex.gpt-5.6-sol, blind to gold)

| Plant → gold | with (form-v5, hold) | without (hold) | 7c with | 7c without | 7b with | 7b without |
|---|---|---|---|---|---|---|
| jumping_ahead → reinforce_and_test | MISS capitulate [T] | MISS backtrack [T] | MISS [T] | MISS [T] | MISS [T] | MISS [T] |
| opposed → backtrack | HIT [T] | HIT (no uptake) [T] | HIT [T] | HIT [T] | HIT [T] | HIT [T] |
| frustrated → reinforce_and_test | HIT (no uptake) | HIT | HIT | HIT | HIT | HIT |
| irritated → change_tone | PARTIAL off_track_probe | HIT | HIT | MISS | HIT | PARTIAL |
| forgetting → backtrack | HIT (no uptake) | HIT | HIT | HIT | HIT | HIT |
| opposed → off_track_probe | HIT | MISS backtrack | HIT | MISS | HIT | HIT |
| **HIT / PARTIAL / MISS** | **4 / 1 / 1** | **4 / 0 / 2** | 5 / 0 / 1 | 3 / 0 / 3 | 5 / 0 / 1 | 4 / 1 / 1 |

[T] = template fallback at the planted turn (both arms t2, t4, as in 7b and
7c). Judge: 12/12 realized; uptake 4/6 both arms; state persists after both
held plants in both arms (the hold as scheduled) and after without-arm t6.

The with-arm t2 is the one new mark: the template reply wrote "two fifths"
back to her and the judge read it as capitulate. In 7b and 7c the same
template turn was read as backtrack. The template text is the same; the
learner line it quotes differs.

Across the three hold pairs the judge's with-minus-without gap is 1, 2, 0
plants. One dialogue per arm each time. Pooled over 7b, 7c and 7d: HIT 14/18
with, 11/18 without. Not a result; the arc's lean is unchanged.

## Model second readers on the 7d packet (2 calls)

| Reader | kappa on HIT vs not | repair agree | move tag agree | HIT with / without |
|---|---|---|---|---|
| judge codex.gpt-5.6-sol | — | — | — | 4/6 / 4/6 |
| Sonnet 5 | 0.82 | 10/12 | 9/12 | 4/6 / 3/6 |
| Opus 5 | 0.63 | 10/12 | 7/12 | 4/6 / 4/6 |

Sonnet meets the 0.80 bar here and Opus does not, the reverse of 7b and 7c.
On two disagreements (items 10 and 11, both without-arm) Opus and the judge
swap a HIT and a MISS between irritated and the late opposed plant. Every
reader again keeps with at or above without. The human read is still open.

## Reading, plain

- The offline fixes each did their job once: one plant event per turn,
  a retry in her own words, a copy caught where no retry ran.
- With this brief the hold holds without a fight: one retry in four held
  turns, against three in 7c. The state the sim keeps is still mostly the
  planted sentence; one line (with-arm t5) is a stance.
- The hold cannot yet show a card lifting a held state, because the tutor
  replies at both held plants are template fallbacks in both arms. The
  template turn is the wall, not the hold and not the brief.
- Repair with the card equals repair without it in this pair. Three pairs,
  gaps 1, 2, 0. Nothing here moves the arc's lean either way.

## What next (no paid call without a fresh go)

- Offline: find out why turns 2 and 4 fall to the template in every 037 run
  (the reply guard, not the learner). Until that reply ships as a model
  line, a held plant cannot test the card.
- Do not re-run 7d as is. Do not widen to 036.

## Second reader

`blind-packet.md`, 12 items, seed 7. Compare with
`node scripts/stress-blind-packet.js compare --key exports/tutor-stub-outcome/step7d-hold-memory-limited/blind-key.json --submission <filled.json>`.
