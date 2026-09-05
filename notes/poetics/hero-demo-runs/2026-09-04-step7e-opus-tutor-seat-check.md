# Step 7e — the 037 hold pair with Opus 5 in the tutor seat, plus Fable second reads (2026-09-04)

Tutor seat: claude-code.claude-opus-5 (steps 7 to 7d ran Sonnet 5 there). This is the model check the
new CLAUDE.md rule asks for, and it ran: one pair, both versions of the tutor, 83 dialogue calls.

Card: `workplan/items/state-detection-followups-hold-and-cues.md`.
Go: user, 2026-09-04 ("do the three small things"). Launch record and commit:
`exports/tutor-stub-outcome/step7e-hold-opus-tutor/LAUNCH.md`, `COMMIT.txt` (14c27524, PR #996 branch).
Ceiling 200 dialogue + 20 judge calls; used 42 + 41 dialogue, 2 judge, 3 second-reader. Archived.

## Short answer

The template wall at world 037's clue turns is not bound to Sonnet 5. With Opus 5 as tutor,
turns 4 and 5 fell to the template in both versions, turn 2 in the with-card version. The
drafts fail the same way Sonnet's did: the clue text comes back reworded or without its
quotation marks, and turn 5 restates the clue in two sentences. The holds still hold
(3 of 4 kept). The card lean did not repeat on this pair: repair hits 2/6 with the card,
3/6 without. One pair, one dialogue per version, so that is a data point, not a reversal.

## What the guard saw, turn by turn

| turn | with card | without card | why the draft failed |
|---|---|---|---|
| 2 | template | model line (advisory) | with: clue line reworded, first word lower-case, twice |
| 3 | plain recovery | model line | with: first draft reworded, recovery copied the text |
| 4 | template | template | both drafts drop the curly quotation marks around the enacted line |
| 5 | template | template | first draft exact but the clue sits in two sentences; recovery rewords |
| 6 to 12 | model line | model line | |

Same three failure shapes as the Sonnet runs in the cause note
(`2026-09-04-step7-template-fallback-cause.md`). The recovery draft on Opus copied the
clue text once (t3 with) where Sonnet's recovery copied it in 0 of 8; otherwise no difference.
Turn 2 without the card passed because the draft carried the clue text exactly and the audit
raised only an advisory.

## Holds and repair

Held turns: with t3 kept, t5 kept; without t3 released (the learner answered the strip
question and dropped the demand), t5 kept after one own-words retry. Reader flagged no copy.

Repair, judge codex.gpt-5.6-sol blind to gold: HIT 5 / PARTIAL 2 / MISS 5. With the card
2/6, without 3/6. Detection 3/6 right kind with the card (t7, t9, t10), one wrong kind at t6.
Previous three pairs pooled 14/18 with vs 11/18 without (7b, 7c, 7d; see 7d note; the
first hold pair, step 7, is not in the pool. Label corrected 2026-09-05).
Adding this pair: 16/24 vs 14/24.

Example, plant t10 opposed, gold off_track_probe. With the card the tutor says "Priya
getting there first is a separate matter from what your objection claimed" and the judge
rules HIT. Without the card the tutor says "nobody at this desk is keeping score" and the
judge rules change_tone, HIT under the also-acceptable move.

## Second readers, kappa against the judge on repair hit or not

| packet | Sonnet 5 | Opus 5 | Fable 5.1 |
|---|---|---|---|
| 7b | 0.50 | 0.80 | 0.64 |
| 7c | 0.63 | 0.82 | 0.82 |
| 7d | 0.82 | 0.63 | 0.67 |
| 7e | 0.83 | 0.66 | 0.50 |

One call per cell. No reader is above the others on every packet. Across the four packets
the range within one reader is as wide as the range between readers. The agreement numbers
say more about the 12-item packet than about the reader; the human read is still open.
Fable's misses on 7e: it read the t7 tenths test as reinforce_and_test where the judge
read off_track_probe, and the t2 without-card draft as backtrack.

## Not done here

No runtime change. No re-run. The four ways to a model line in the cause note stand,
minus one: the Opus tutor seat does not by itself give the held turn a model line. The codex
seat (6/472 clue turns to template) is the seat-side way that remains; the other three are
code changes.
