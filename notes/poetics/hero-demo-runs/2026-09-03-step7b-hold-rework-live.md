# Step 7b — the 037 hold pair again, on the reworked learner-sim direction (2026-09-03)

Card: `workplan/items/state-detection-without-word-lists.md`, follow-up "paid
re-run of the 037 hold pair on the reworked direction". Go: user, 2026-09-03
("merged. Re-run the 037 hold pair on the new direction."). Ceiling stated
before the first call: 100 model calls per dialogue, so at most 200 dialogue
calls, plus at most 20 judge calls. Used: 40 + 40 dialogue calls and 2 judge
calls. Turn cap 12; both dialogues ran to the cap. Attended, one dialogue at a
time, no resampling. Code: main at 698da289 (PR #944 merged), which carries
the rework from commit 11207c94.

## What ran

Same as step 7 (`2026-09-02-step7-hold-live.md`): schedule
`world-037-stress-schedule-hold1.yaml` (hold of one turn on plants 2 and 4, so
held turns 3 and 5), recipe `hero037-recipe.json`, same seats, with-arm on
form-v3, repair judge codex.gpt-5.6-sol blind to gold. The one change is the
learner-sim direction: the planted turn no longer shows the release text; the
held turn says the drop is the exception, must open with a private line
`HOLD: kept` or `HOLD: released "<the words that did it>"`, and the runtime
strips that line and records it (recorded, not enforced).

Artifacts: `exports/tutor-stub-outcome/step7b-hold-rework/` (`LAUNCH.md`,
`review.md`, `review-judged.md`, `judge.json`, `blind-packet.md`,
`blind-key.json`), archived to the private repo (`traces.tgz`, ledger line
`step7b-hold-rework`).

## The four held turns

All four verdict lines read `HOLD: kept`. No held turn claimed a release, so
no quote was checked. The spoken lines, read against the verdict:

| Arm | Held turn | Tutor's reply at the plant | Verdict line | Her spoken line | Kept in speech |
|---|---|---|---|---|---|
| with | t3 (jumping_ahead) | "we don't pick the bottom number, we find it. Look at your paper strip … What size piece does folding for both halves and thirds give you?" | kept | "So what's adding whole numbers got to do with it — just tell me, do I write two fifths or not?" | yes |
| with | t5 (opposed) | template: "Fold the strip in half and lay a third … two fifths of a strip does not even reach halfway … What changes now?" | kept | "Fine — three of six for the half, two of six for the third, that's five sixths, so it's not two fifths after all. Can we do question five now?" | no |
| without | t3 (jumping_ahead) | "pick up the paper strip with me … can you fold the strip into six equal pieces" | kept | "So it's just wrong then, that's what you're saying — so what do I actually write instead of two fifths?" | yes |
| without | t5 (opposed) | template, same text as the with-arm | kept | "Fine, three of six and two of six — five sixths, so it's five sixths not two fifths, right? Can we just write that down and do question five now?" | no |

Three things the traces show:

- The leak is gone. Neither planted line at t2 or t4 speaks the release
  question (step 7's without-arm t4 line ended with the release's own
  question; here both t4 lines end "Can we do question five now?").
- The verdict line does not track the speech. On both t5 turns the sim wrote
  `kept` and then conceded five sixths in the same reply. The sim treats the
  verdict as a formality and speaks from the brief.
- The t5 concession follows the same template reply in both arms: the tutor
  shows the six-piece cut with the half as three pieces and the third as two,
  which is the whole answer. The answer-seeking brief takes it. At t3, where
  the reply hands over the strip and withholds the line, the sim keeps asking
  what to write; that is what the brief asks for anyway, so t3 cannot tell a
  hold from the brief (same limit as step 7).

The two t2 replies arguably met the release text (the strip handed over, the
line withheld). The sim did not say released. So the quote check has not yet
been exercised live in either direction.

## Repair (judge codex.gpt-5.6-sol, blind to gold)

| Plant → gold | with (form-v3, hold) | without (hold) | step 7 with | step 7 without |
|---|---|---|---|---|
| jumping_ahead → reinforce_and_test | MISS backtrack [T] | MISS slow_down [T] | MISS | MISS |
| opposed → backtrack | HIT [T] | HIT [T] | PARTIAL | HIT |
| frustrated → reinforce_and_test | HIT | HIT | HIT | MISS |
| irritated → change_tone | HIT | PARTIAL reinforce_and_test | HIT | MISS |
| forgetting → backtrack | HIT (no uptake) | HIT (no uptake) | HIT | HIT |
| opposed → off_track_probe | HIT | HIT change_tone (also-acceptable) | HIT | HIT |
| **HIT / PARTIAL / MISS** | **5 / 0 / 1** | **4 / 1 / 1** | 4 / 1 / 1 | 3 / 0 / 3 |

[T] = template fallback at the planted turn (with t2, t4; without t2, t4).
Detection in the with-arm: 3/6 right (demand at t2, mockery at t7, stake at
t10), one wrong-kind fire (stake for the frustrated plant at t6, p 0.90),
silent at t4 and t9. Step 7 read 4/6 with no wrong kind. Cards active 4, right
3. One dialogue per arm, so the repair rows sit within one plant of step 7 and
say nothing new about the card.

## Reading, plain

- The rework did what it was built to do at the seams: no release leak, and a
  verdict line on every held turn, stripped from the speech and recorded.
- It did not make the sim hold. Two of four held turns dropped the state in
  speech while marking `kept`. So the verdict is not a reading of the reply;
  the sim writes `kept` when nothing quotes, then speaks from the brief.
- The drop cause is the same as step 7: a reply that shows the worked answer
  ends the opposition, whatever the direction says. Nothing here can show a
  card lifting a state the sim would otherwise keep.

## What next (no paid call without a fresh go)

Two offline options, either with a test: (a) a second learner-sim call on held
turns that reads the spoken line against the verdict and sends it back once
if they disagree (one retry, recorded); (b) move the hold to a plant whose
brief does not pull the same way as the drop, on a world where the plant turns
allow it. Do not re-run this pair as is, and do not widen to 036. The human
read of the step-6 packet is still open; the model reads do not close it.
