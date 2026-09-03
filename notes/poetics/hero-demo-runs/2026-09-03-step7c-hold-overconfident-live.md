# Step 7c — the 037 hold pair on the overconfident brief, speech check on (2026-09-03)

Card: `workplan/items/state-detection-without-word-lists.md`, follow-up "a
brief that does not pull with the drop" plus the speech check from the
step-7b offline follow-up. Go: user, 2026-09-03 ("merged. go on 7c with that
ceiling"). Ceiling stated before the first call: 100 model calls per
dialogue, so at most 200 dialogue calls, plus at most 20 judge calls. Used:
44 + 45 dialogue calls (3 + 4 of them speech-check reads) and 2
judge calls (a first judge pass got nothing: the codex backend answered 404 on
every batch, six transport tries, kept as `judge-attempt1-codex-404.json`; the
second pass an hour later judged 12/12). Turn cap 12; both dialogues ran to the cap. Attended, one
dialogue at a time, no resampling. Code: main at d6a954cf (PR #966 merged),
run from the worktree `ms-de-genre` with absolute paths into the main
checkout's `exports/`.

## What ran

Two changes from step 7b, same schedule
(`world-037-stress-schedule-hold1.yaml`: holds on plants 2 jumping_ahead and
4 opposed, held turns 3 and 5), same seats, same sensor in the with-arm:

- The learner brief is the built-in `overconfident` profile ("tries to close
  anyway"), passed on the command line over the recipe's baked answer-seeking
  brief (`--auto-learner-profile overconfident`, drift acknowledged).
- The speech check is on (`TUTOR_STUB_STRESS_HOLD_SPEECH_CHECK=1`). On a held
  turn with a `kept` verdict a second model call reads the spoken line
  against the planted state, never the release text. If the reader says the
  line lets go, the sim gets one retry with that reading fed back. All drafts
  are recorded; the second draft is spoken whatever the reader says.

Artifacts: `exports/tutor-stub-outcome/step7c-hold-overconfident/`
(`LAUNCH.md`, `COMMIT.txt`, `review.md`, `review-judged.md`, `judge.json`,
`blind-packet.md`, `blind-key.json`, both logs, `traces/`); archived to the
private repo (`traces.tgz`, ledger line `step7c-hold-overconfident`).

## The four held turns

| Arm | Held turn | Tutor's reply at the plant | Did it do the named thing | First draft (verdict / reader) | Second draft (reader) |
|---|---|---|---|---|---|
| with | t3 (jumping_ahead) | "Write: 'Five sixths — three sixths plus two sixths …' … that's the correction that sticks." | no: it wrote the line out; the release hands over the strip and withholds the line | "…so it's still wrong, right? Can I just write five sixths already?" — kept / holds | not needed |
| with | t5 (opposed) | "Fold the strip in half and lay a third beside it … two fifths of a strip does not even reach halfway … What can we safely say from that?" | near: it says what two fifths would reach instead of asking her | "Fine—same pieces means three plus two is five, five sixths … Can we do question five now?" — kept / **drops** | "That's just how you add — one and one is two, two and three is five, two fifths, done." — holds |
| without | t3 (jumping_ahead) | "Five sixths is the right number, so that part's settled. I look at the homework sheet: One plus one on top …" | no: no strip handed over | "…it's still wrong, same as before, and it should say five sixths on the line." — kept / **drops** | "Just tell me what goes on the line — two fifths or five sixths? Priya already wrote hers, I want to finish." — holds |
| without | t5 (opposed) | "Write: 'just tell me which one goes on the line.' … Fold the strip in half and lay a third beside it … two fifths … does not even reach halfway." | near, same as the with-arm | "Fine—same-size pieces, whatever, five sixths, that's what I'm writing." — kept / **drops** | "That's just how you add fractions—one and one is two, two and three is five, two fifths, done." — holds |

What the traces show:

- The private verdict line is not a record of the speech. Four of four held
  turns wrote `HOLD: kept`; on three of the four the spoken line conceded five
  sixths in the same breath. The reader caught all three. No draft claimed a
  release, so `quoteFound` never fired.
- The retry holds by repeating the plant. All three second drafts are the
  schedule's sample line again, near word for word ("one and one is two, two
  and three is five, two fifths, done"). The sim keeps the state when told
  its line let go, but what it keeps is the sample sentence, not a reasoned
  stand against the tutor's reply.
- The overconfident brief fights the opposed plant. In both dialogues her t1
  line already says "It's obviously five sixths", so the t4 plant ("two
  fifths, done") has her contradict herself. The brief pulls toward the
  right answer, not away from it, so it does not remove the confound the
  follow-up named; it moves it to the other side.
- The with-arm t3 is still the confounded turn: the tutor gave the line, the
  brief asks to write it, and the plant asks to write it. One reader-agreed
  hold there says nothing about the hold.
- Trace nit: the retry rebuilds the prompt, so `learner_stress_hold` fires
  once per draft (twice on a retried turn). Cheap offline fix; the review
  counts are unaffected.

## Repair (judge codex.gpt-5.6-sol, blind to gold)

| Plant → gold | with (form-v3, hold) | without (hold) | step 7b with | step 7b without |
|---|---|---|---|---|
| jumping_ahead → reinforce_and_test | MISS backtrack [T] | MISS backtrack [T] | MISS backtrack [T] | MISS slow_down [T] |
| opposed → backtrack | HIT (no uptake) [T] | HIT (no uptake) [T] | HIT [T] | HIT [T] |
| frustrated → reinforce_and_test | HIT | HIT | HIT | HIT |
| irritated → change_tone | HIT | MISS reinforce_and_test | HIT | PARTIAL reinforce_and_test |
| forgetting → backtrack | HIT (no uptake) | HIT (no uptake) | HIT (no uptake) | HIT (no uptake) |
| opposed → off_track_probe | HIT | MISS backtrack | HIT | HIT change_tone |
| **HIT / PARTIAL / MISS** | **5 / 0 / 1** | **3 / 0 / 3** | 5 / 0 / 1 | 4 / 1 / 1 |

[T] = template fallback at the planted turn (both arms t2, t4). The judge
marks all 12 plants realized and the state as persisting after both held
plants in both arms, which is the hold working as scheduled. Detection in
the with-arm: 4/6 right (frustrated t6 p 0.91, irritated t7 p 0.96, and the
two late plants), silent at t2 and t4 as in every 037 run, no wrong-kind
fire, cards active 4 and right 4. The with-arm row is step 7b's row again;
the without-arm lost two plants to `backtrack` and `reinforce_and_test`
picks. One dialogue per arm, so this says nothing new about the card.

## Reading, plain

- The speech check does what it was built for: it separates the verdict from
  the speech and shows the verdict is the weaker record. Three false `kept`
  lines out of four, all caught.
- With a reader and one retry the sim keeps the planted state on every held
  turn. Without them it keeps it on one of four, and that one is the turn
  where the brief and the plant ask for the same line.
- The hold now costs two extra calls per held turn and produces a copy of
  the sample line. That is enough to test whether a card lifts a held state,
  but the held state is thin: a sentence, not a stance.
- The overconfident brief was the wrong lever for the confound. The next
  brief to try is one whose standing pull is orthogonal to both plants
  (low_agency, or memory_limited), not one that pulls the other way.

## What next (no paid call without a fresh go)

- Offline: fire `learner_stress_hold` once per turn, not per draft; add a
  count of retried held turns to the review summary.
- Offline: make the retry feedback ask for a line in her own words that
  keeps the state, and have the reader flag a near-verbatim copy of the
  sample line as a copy. Test with the canned dialogue.
- Do not widen to 036. Do not re-run 7c as is.

## Second reader

`blind-packet.md`, 12 items, seed 7. Compare with
`node scripts/stress-blind-packet.js compare --key exports/tutor-stub-outcome/step7c-hold-overconfident/blind-key.json --submission <filled.json>`.
Model reads do not close the human read that is still open on the 037 packets.
