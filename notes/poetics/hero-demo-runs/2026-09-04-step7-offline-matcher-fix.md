# Step 7, offline: matcher and recovery packet fix for the clue turns (2026-09-04)

Card: `workplan/items/state-detection-followups-hold-and-cues.md`, step 3.
Cause note: `2026-09-04-step7-template-fallback-cause.md`, options 3 and 4.
No paid call. All counts below come from a zero-call replay on the ten
recorded 037 hold traces (steps 7, 7b, 7c, 7d, 7e; five pairs with-d0 and
without-d0). The cause note counted eight; 7e (Opus tutor seat) adds two.

## What changed, per file

1. `services/tutorStubLiveFirstDraftAudit.js`. The clue check now
   accepts a draft that copies the clue text the host renders word for word and
   changes only its quotation marks: curly marks written as straight marks,
   or the outer pair of marks left out. Nothing else is loosened. The line
   must still appear exactly once. A reworded line, a line with one word
   changed, or a line that appears twice still fails. Two small pure
   functions are exported for tests: `straightenQuotationMarks` and
   `dropOuterQuotationMarks`. Each match row records which form matched
   (`exact`, `quotation_marks_straightened`, or
   `outer_quotation_marks_dropped`). Spans still point into the original
   draft, so the boundary and configuration audits downstream read the same
   offsets as before. The duplicate-delivery check is not touched.

2. `services/tutorStubFirstDraftContract.js`. The presented-exhibit cue
   now says the copy rule. Before: "After PART, open, read, show, test, or
   place this public exhibit exactly once: ..." After: "Open, read, show,
   test, or place this exhibit, copied word for word, once: ...". The
   enacted-role cue keeps "Copy exactly, marks included: ... Keep SOURCE
   words inside; inherit no deed or ownership." The compact speaker prompt
   stays inside its word cap (the old cue sat exactly on it).

3. `services/tutorStubRecoveryAccountingRuntime.js`. The plain recovery
   packet now names each failed check and says what it requires. Before:
   "The previous draft failed a response check and was not shown to the
   learner." After, on a clue turn: "The previous draft failed this
   response check and was not shown to the learner:
   live_source_action_alignment_v1:due_source_exact_occurrence_count. Failed
   check live_source_action_alignment_v1:due_source_exact_occurrence_count
   requires the SOURCE line to appear exactly once, word for word, with no
   word changed, added, or dropped (the rejected draft had it 0 times). Copy
   the line as given; only quotation marks may differ." When the duplicate
   check fired it adds: "Failed check dramatic_release:duplicate_clue_delivery
   requires the newly public clue in one sentence only; do not restate it in
   other words in another sentence." No new field: the list of hard issues and
   the audit rows already carry the check name and the observed count.

4. `tests/tutorStubLiveFirstDraftAudit.test.js`. Seven new tests with real
   trace strings from the 037 runs: the reworded turn-2 line still fails;
   the turn-4 line with the outer marks dropped passes; straightened marks
   pass; the line twice fails (quoted plus bare, and exhibit twice); the
   recovery packet names the check; the replay script counts a small
   fixture trace. `tests/tutorStubReleasePacing.test.js` pins the new cue
   text.

5. `scripts/replay-first-draft-audit.js`. Zero-call replay. It reads each
   trace, takes the turn's first-draft contract and every first draft and
   plain recovery draft on turns 2 to 5, checks the sha256 of the draft
   against the digest the guard recorded for the audited text, and runs the new matcher on
   the same draft and the same host text. Summary:
   `exports/first-draft-audit-replay/2026-09-04/summary.json`. Run:
   `node scripts/replay-first-draft-audit.js --exports-root <exports/tutor-stub-outcome>`.

## Replay counts, per turn (ten dialogues)

"Rejected" means the clue check was one of the hard issues on the recorded
draft. "Now pass" means the new matcher finds the line exactly once.
"Would deliver" also needs no other hard issue on the same draft.

| turn | draft | drafts | rejected by clue check | now pass | would deliver | still fail | why still fail |
|---|---|---|---|---|---|---|---|
| 2 | first | 10 | 8 | 0 | 0 | 8 | 8 reworded |
| 2 | recovery | 8 | 8 | 0 | 0 | 8 | 7 reworded, 1 letter case only |
| 3 | first | 10 | 7 | 0 | 0 | 7 | 7 reworded |
| 3 | recovery | 7 | 6 | 0 | 0 | 6 | 5 reworded, 1 letter case only |
| 4 | first | 10 | 10 | 10 | 6 | 0 | 4 also hit the duplicate check |
| 4 | recovery | 10 | 10 | 10 | 7 | 0 | 3 also hit the duplicate check |
| 5 | first | 10 | 0 | | | | all 10 rejected by the duplicate check only |
| 5 | recovery | 10 | 10 | 0 | 0 | 10 | 6 reworded, 4 letter case only |
| all | | 75 | 59 | 20 | 13 | 39 | 33 reworded, 6 letter case only |

All 59 rejected drafts could be replayed. The trace holds every draft text,
every turn's contract, and the digests all agree. Zero turns were missing.
Fallback template attempts (one per template turn) are not replayed; the
template copies the text and passes.

"Letter case only" means the line is present once and only the case of one
letter differs, for example "three sixths and two sixths: count the
pieces, five sixths" after a colon at turn 5. The matcher keeps these
strict; the task was to loosen quotation marks and nothing else.

Turn 4 match kinds: 19 drafts dropped the outer marks, 1 straightened them.

## Replay counts, per run

| run | rejected | now pass | would deliver | still fail |
|---|---|---|---|---|
| 7 live, with-d0 | 3 | 2 | 1 | 1 |
| 7 live, without-d0 | 7 | 2 | 1 | 5 |
| 7b rework, with-d0 | 7 | 2 | 1 | 5 |
| 7b rework, without-d0 | 7 | 2 | 2 | 5 |
| 7c overconfident, with-d0 | 7 | 2 | 2 | 5 |
| 7c overconfident, without-d0 | 5 | 2 | 2 | 3 |
| 7d memory-limited, with-d0 | 7 | 2 | 2 | 5 |
| 7d memory-limited, without-d0 | 7 | 2 | 1 | 5 |
| 7e Opus tutor, with-d0 | 6 | 2 | 1 | 4 |
| 7e Opus tutor, without-d0 | 3 | 2 | 0 | 1 |

Every run gains the same two drafts: its turn-4 first draft and its turn-4
recovery. Whether either would have shipped depends on the duplicate check
on that draft, which the replay reads from the record and does not re-run.

## One rejected draft beside the host text, per turn

Turn 2, first draft, 7 live without-d0. Host text: "One plus one on top,
two plus three underneath: two fifths. That is what the pupil wrote, and it
is what adding whole numbers looks like." Draft: "... One plus one on top,
two plus three underneath: two fifths ... that's what you wrote, and it's
what adding whole numbers looks like, but this strip isn't whole numbers.
..." (the "..." after "two fifths" stands for a dash in the draft).
Sentence two is reworded. Old matcher: count 0. New matcher: count 0. Still
fails, as it should.

Turn 4, first draft, 7 live with-d0. Host text: "“I can confirm this: Cut
the strip into six equal pieces. The half covers three of them and the
third covers two of them. Now the pieces are the same size.”" Draft: "...
We're still standing at your paper strips, halves and thirds side by side on
the desk. I can confirm this: Cut the strip into six equal pieces. The half
covers three of them and the third covers two of them. Now the pieces are
the same size. I lay both cut strips flat ..." Every word present, outer
marks left out. Old matcher: count 0. New matcher: count 1, match kind
`outer_quotation_marks_dropped`. This draft also hit the duplicate check, so
it would still not ship; the recovery draft on the same turn hit only the
clue check and would now ship.

Turn 5, recovery draft, 7 live with-d0. Host text: "Three sixths and two
sixths: count the pieces, five sixths." Draft: "Yes ... three sixths and two
sixths, same-size pieces now. I count them together: five sixths. What does
that clue tell you about Priya's answer?" (the "..." stands for a dash).
Reworded, count 0 on both
matchers. The first draft on the same turn had the line exactly once and
was rejected by the duplicate check alone: it also said "three sixths from
the half, two sixths from the third" and "five sixths, not two fifths".

## What still needs a paid run

- Turn 5. The duplicate check rejects all ten first drafts, and no offline
  change here touches it. A one-line arithmetic clue and the tutor's job of
  explaining it pull against each other on that turn. The new recovery
  packet now names that check and says "one sentence only", but whether the
  model obeys is a live question.
- Turns 2 and 3. The cue and the recovery packet now say "word for word"
  and name the check. Whether Sonnet 5 then copies the two-sentence exhibit
  is a live question; the replay can only show that the matcher change does
  not help these turns (0 of 29).
- The held turns. The card wants a model line on turns 3 and 5. Nothing
  offline can confirm that. One hold pair on the current code is the check.
- The six letter-case-only drafts. They stay rejected. Loosening case is a
  design choice for the card, not part of this fix.
- The PR benchmark hook fires on `services/tutorStub*.js` changes and wants
  six paid calls. This session bypassed it with the stated reason. The
  benchmark is deferred to the user.
