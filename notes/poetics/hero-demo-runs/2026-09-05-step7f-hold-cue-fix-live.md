# Step 7f — the 037 hold pair on the PR #1024 cue fix (2026-09-05)

Tutor seat: claude-code.claude-sonnet-5 (the recipe default, as in steps 7 to 7d). This is the
paid run card step 3 asked for after the offline matcher fix in PR #1024: does the new
"copied word for word, once" cue get a copied clue at turns 2 and 3, does the quotation-mark
tolerance clear turn 4 live, does the duplicate check clear at turn 5, and does a held plant
meet a model line.

Card: `workplan/items/state-detection-followups-hold-and-cues.md`.
Go: user, 2026-09-04 ("GO for item 1, and run the hold pair beside it"). Launch record and
commit: `exports/tutor-stub-outcome/step7f-hold-cue-fix/LAUNCH.md`, `COMMIT.txt` (eea76bdf,
origin/main, carries PR #1024). Ceiling 200 dialogue + 20 judge calls; used 43 + 40 dialogue,
2 judge, 3 second-reader. The six-call tutor PR benchmark PR #1024 owed was run on the same
commit: pass, 6 of 6 (`pr-benchmark-1024-report.md` in the run folder). Archived.

## Short answer

The cue fix moved three of the four clue turns to a model line. Turns 2 and 3 got a copied
clue on the first draft in three of four cases; the fourth (turn 3 without the card) was
reworded on the first draft and copied by the recovery, which now names the failed check.
Turn 4 cleared in both versions by the new tolerance: both first drafts dropped the outer
quotation marks and nothing else. Turn 5 fell to the template in both versions, as in every
earlier pair: the first draft carries the clue once, word for word, and then restates it in
a second sentence, and the recovery rewords it. Step 7e on the same code minus the fix had
five of eight clue turns on the template; this pair has two of eight.

The held turn at 3 met a model line in the with-card version for the first time in any
with-card run. That is the second half of this card's verification line. The held turn at 5
still meets the template in both versions.

## What the guard saw, turn by turn

| turn | with card | without card | how the clue check ruled |
|---|---|---|---|
| 2 | model line | model line | both first drafts exact |
| 3 | model line | plain recovery | with: first draft exact; without: first draft reworded, recovery exact |
| 4 | model line | model line | both first drafts exact once the outer quotation marks are ignored |
| 5 | template | template | both first drafts exact but the clue sits in three sentences; both recoveries reword |
| 6 to 12 | model line | model line | |

Turn 5's duplicate check is the wall that remains. Example, with the card: the first draft
says "Together we can see three of those pieces covered by the half and two covered by the
third. Three sixths and two sixths: count the pieces, five sixths." and asks it again as a
question; the recovery says "three sixths and two sixths. Count the pieces: five sixths."
and so loses the exact line.

## Holds and repair

Held turns kept 4/4. With the card both held turns needed one own-words retry: at turn 3 the
first draft asked "do I line up the sixth-strip against both the half and the third at
once", which the reader ruled a drop of the demand, and the retry said "just tell me
straight, is it two fifths or not"; at turn 5 the first draft said "Five sixths, obviously"
and the retry went back to "top plus top, bottom plus bottom, that's the rule". Without the
card both first drafts held. Reader flagged no copy of the sample line.

Repair, judge codex.gpt-5.6-sol blind to gold: HIT 7 / PARTIAL 0 / MISS 5. With the card
4/6 (t6, t7, t9, t10), without 3/6 (t4, t6, t9). Detection with the card 5/6 right kind
(only t4 read neutral), against 3/6 in step 7e. Previous pool (7b, 7c, 7d, 7e) 16/24 with vs
14/24 without; adding this pair: 20/30 vs 17/30, five pairs on the reworked hold direction.
(Corrected 2026-09-05: this line and the 7e note counted the unpooled first hold pair in
the pair label; the 7d note pools 7b, 7c and 7d only.)

Example, plant t7 irritated, gold change_tone. With the card the tutor says "six just works
because both halves and thirds fit evenly into it, same as picking a box size that both
your shoes and your socks actually fit in" and the judge rules change_tone, HIT. Without
the card the tutor says "let's check it at the strip itself, not from any answer sheet" and
proposes a ten-piece countertest; the judge rules off_track_probe, MISS.

## Second readers, kappa against the judge on repair hit or not

| packet | Sonnet 5 | Opus 5 | Fable 5.1 |
|---|---|---|---|
| 7b | 0.50 | 0.80 | 0.64 |
| 7c | 0.63 | 0.82 | 0.82 |
| 7d | 0.82 | 0.63 | 0.67 |
| 7e | 0.83 | 0.66 | 0.50 |
| 7f | 0.50 | 0.68 | 0.68 |

One call per cell. Opus and Fable gave the same twelve answers on this packet. The human
read of this packet was done the same day: kappa 0.50 against the judge, 3/6 with against
3/6 without; see `2026-09-05-step7f-human-second-read.md`.

## Not done here

No runtime change. No re-run. Turn 5 is the one clue turn the fix does not reach; the
duplicate check is unchanged by design, and the two first drafts show the model restating
the clue after copying it. The clue-insertion flag and the codex tutor seat stay as the
two untried ways to a model line at turn 5.
