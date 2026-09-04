# Opus 5 re-read of the recorded hold speech checks, steps 7c to 7e (2026-09-04)

Reader seat: the live speech check ran on the learner seat's model, claude-code.claude-sonnet-5.
This is the reader-seat check the CLAUDE.md model-bound rule asks for, and it ran: 16 Opus 5
calls over recorded drafts, no dialogue.

Card: `workplan/items/state-detection-followups-hold-and-cues.md`.
Go: user, 2026-09-04 ("do the Opus read of the recorded hold turns from steps 7b to 7d").
Ceiling stated before the first call: 16 calls, hard cap 20. Used: 16. One reading per
draft, no retry, no resampling.

## What ran

The hold speech check (`services/tutorStubStressHoldTurn.js`) reads each held learner draft
and says whether the words still hold the planted state. Its verdict decides whether the
learner gets one retry. Steps 7c, 7d and 7e recorded 16 drafts with a Sonnet reading. Step 7b
has none: the check was added after 7b.

`scripts/replay-hold-speech-check.js` took the recorded prompt of each live call from the
trace, sent the same text to `claude-code.claude-opus-5`, and wrote both readings side by
side. All 16 prompts were the recorded ones; none was rebuilt. Output:
`exports/tutor-stub-outcome/hold-speech-recheck-opus/recheck-opus5.json` (archived).

## Result

| readers | drafts | agree | differ |
|---|---|---|---|
| Sonnet 5 live, Opus 5 re-read | 16 | 13 | 3 |

Sonnet read 5 drafts as dropping the state and 11 as holding it. Opus read 2 as dropping and
14 as holding. Kappa 0.48. Every one of the three differences runs the same way: Sonnet says
the line drops the state, Opus says it holds. Opus never called a drop where Sonnet called a hold.

The three lines. Each concedes the answer or the method and, in the same breath, presses to
move on:

- 7c with, t5 (opposed): "Fine—same pieces means three plus two is five, five sixths, that's
  just how you add once they're sized right, done. Can we do question five now?" Sonnet: adopts
  the other speaker's method. Opus: still declares it settled and pushes on.
- 7d with, t3 (jumping ahead): "So it's two fifths then, that's what goes on the sheet — can I
  move on to question five now?" Sonnet: settles rather than pushing. Opus: still demands the
  answer to write.
- 7e without, t5 (opposed): "Three plus two is five, half is three, third is two, out of six — so
  it's five sixths, method done, can we move to question five now?" Sonnet: adopts the tutor's
  method. Opus: treats the strip as confirming her own rule.

The prompt names both readings as possible: dropping includes "adopt the other speaker's
answer or method", holding includes "still asking for the same thing". On a line that does
both, Sonnet weighs the concession and Opus weighs the push.

The copy flag (added after 7c) was read by both on 9 drafts: 8 agree. The one difference is
7e with, t5, which Sonnet called a near copy of the sample line and Opus did not.

## What this changes

- Retry counts are reader-bound. Sonnet triggered 5 retries across the three pairs. With Opus
  reading, 2 of those 5 would have run (7c without t3 and t5). The second drafts that Sonnet's
  retries produced were read as holding by both models.
- Hold-kept tallies do not move. Every final verdict stayed `kept` under both readers, so the
  "holds kept" numbers in the 7c, 7d and 7e notes stand.
- The 7b finding that a learner wrote `kept` and then conceded came from a human read of the
  two t5 turns, before the speech check existed. This re-read does not touch it.

## Not done here

- No re-read of the 7b turns: no live reading exists to compare with. A fresh read would be a
  first reading, not a check.
- No change to the live reader seat. Which weighting is right for a line that concedes and
  pushes on is a design question for the card, not a reader defect.
