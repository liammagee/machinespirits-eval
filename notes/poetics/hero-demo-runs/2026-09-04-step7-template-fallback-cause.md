# Step 7, offline: why turns 2 to 5 on world 037 fall to the template (2026-09-04)

Card: `workplan/items/state-detection-followups-hold-and-cues.md`, open
step 1 ("Read the traces in the exports above; do not run again"). No paid
call. Read from the traces of the four 037 hold runs (steps 7, 7b, 7c, 7d:
8 dialogues, all on the Sonnet 5 tutor seat) and, for the cross-run checks,
from the archive copies of earlier runs.

## The short answer

The reply guard causes the template. The learner and the world do not. The
guard runs as set, on a tutor seat that does not copy text exactly, with the
one repair path that could keep the reply switched off.

- Turns 2, 3, 4 and 5 are the four turns where world 037 releases a clue.
  On a clue turn the guard requires the reply to contain the host-rendered
  clue text exactly once, matched character for character (plain substring
  search, no normalisation). Turns 6 to 12 release no clue, so this check
  cannot fail there, and every one of those turns shipped as a model line.
- Sonnet 5 rewords. At turns 2 and 3 it keeps the sense and often the first
  sentence of the clue, then rewrites the second. At turn 4 it copies every
  word and drops the curly quotation marks that the enacted-role rendering
  wraps round the line. At turn 5 the text is exact, but the clue is one
  short arithmetic line and the model restates it in three more sentences,
  which the duplicate-delivery check rejects.
- The one model retry (the plain recovery) is told only that "the previous
  draft failed a response check". It is not told which check, and it is not
  told to copy the text word for word. It fails the same way as the first
  draft on every turn.
- The clue-insertion repair, which keeps the model draft and swaps the
  exact clue text into it, exists and was accepted on its card
  (`harness-untangling-clue-insertion`, PR #444). It is opt-in
  (`TUTOR_STUB_CLUE_INSERTION=1`). None of the four hold runs set it. That
  is why early-August runs on the same seat shipped model lines at clue
  turns and the September runs never did.

## Per-turn evidence, 037 hold runs (8 dialogues)

| turn | clue render | first draft | plain recovery | outcome |
|---|---|---|---|---|
| 2 | presented exhibit, 2 sentences | 7/8 miss exact (3 keep sentence 1, 4 reword) | 7/7 miss exact | 7/8 template |
| 3 | presented exhibit, 2 sentences | 6/8 miss exact (all reword) | 6/6 miss exact | 6/8 template |
| 4 | enacted role, curly quotes | 8/8 whole text present, marks dropped | 8/8 same | 8/8 template |
| 5 | presented exhibit, 1 line | 8/8 exact once; 8/8 duplicate delivery | 8/8 miss exact | 8/8 template |
| 6+ | no clue due | 8/8 pass | | 0 template |

The template's own third attempt copies the text, so it passes the same
check 29/29 times.

Example, turn 2 recovery (7d, with-d0). Plan line given to the model:
"After PART, open, read, show, test, or place this public exhibit exactly
once: One plus one on top, two plus three underneath: two fifths. That is
what the pupil wrote, and it is what adding whole numbers looks like."
Reply: "... One plus one on top, two plus three underneath: two fifths.
That's what adding whole numbers looks like, tops with tops, bottoms with
bottoms. ..." Sentence one exact, sentence two reworded, count 0.

Example, turn 4 recovery (same dialogue). Plan line: "Copy exactly, marks
included: “I can confirm this: Cut the strip into six equal pieces. The half
covers three of them and the third covers two of them. Now the pieces are
the same size.”" Reply: "... I can confirm this: Cut the strip into six
equal pieces. The half covers three of them and the third covers two of
them. Now the pieces are the same size. What does ..." Every word present,
no quotation marks, count 0.

Example, turn 5 first draft (7 hold, with-d0). Clue: "Three sixths and two
sixths: count the pieces, five sixths." Present once. The duplicate check
also matched "three sixths from the half, two sixths from the third", "all
five shaded pieces out of six" and "five sixths, not two fifths", four
bearing sentences, and rejected the draft.

## Cross-run checks (archive traces)

Same pattern on other worlds and other seats, so this is a property of the
guard and the seat, not of world 037:

| set | clue-due turns to template | no-clue turns to template |
|---|---|---|
| step 6 pool widening (worlds 041 to 043, Sonnet 5) | 24/27 | 2/70 |

| tutor seat | first draft exact on clue turns | template on clue turns |
|---|---|---|
| codex (109 dialogues) | 33% | 6/472 (recovery fixed 311/315 misses) |
| Opus 5 (12 dialogues) | 29% | 8/48 |
| Sonnet 5, all runs (225 dialogues) | 13% | 310/1023 |
| Sonnet 5, runs from Aug 7 on | 14% | 71 to 100% per run |

Early-August Sonnet runs (crossed-k3, flatpromo-k3) shipped 87/133 and 36/53
of their clue-turn misses through clue insertion. From the figure-clean test
(Aug 7) on, that outcome does not appear in any trace, and the launch lines
in the hold notes carry no `TUTOR_STUB_CLUE_INSERTION`. The baseline
manifest's full-stack line (`config/stability/baseline-v0.7.0.json`) does
carry it. The clue-insertion card's own close said to leave the flag off
for the guard-fix run so that run's fallback rate stayed attributable; the
hold runs inherited the flag-off launch line without that reason.

## What this means for the hold test

The held plant sits at turns 3 and 5 (holds on plants 2 and 4). Both held
turns and both plant turns are clue turns, so on this seat with this launch
line the tutor's reply at every turn the card cares about is the template.
A held learner state can only be tested against a model line. There are
four ways to get one; none needs a paid call to decide, and none is chosen
here:

1. Set `TUTOR_STUB_CLUE_INSERTION=1` on the next hold run. Per its card this
   returns model lines at presented-exhibit turns (2, 3, and likely 5), and
   leaves enacted-role turn 4 with the template. No code change.
2. Run the hold pair on the codex tutor seat. Its recovery copies text
   (311/315), so clue turns ship as model lines with the current code. No
   code change; changes the seat the card has been reading.
3. Make the presented-exhibit cue say what the enacted-role cue says
   ("Copy exactly ..."), and let the matcher accept a reply that drops or
   straightens the quotation marks around an enacted line. Small code
   change to `tutorStubFirstDraftContract.js` and
   `tutorStubLiveFirstDraftAudit.js`, needs tests, and changes the
   instrument in the middle of the arc.
4. Tell the plain recovery which check failed and that the clue text must
   appear word for word. Small prompt change to the recovery packet.

Turn 5 is a separate problem: a one-line arithmetic clue cannot be explained
without restating it, so the duplicate-delivery check and the tutor's job
pull against each other on that turn. Option 1 may or may not clear it;
the clue-insertion card recorded a duplicate conflict and then fixed it by
span replacement, but that was tested on 2-sentence exhibits.

## Not done here

No runtime change, no paid run, no world 036. The choice between the four
options is on the card as step 3.
