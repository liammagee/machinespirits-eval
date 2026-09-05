# Scoreboard crossed run: report

Sonnet 5 (`claude-code.claude-sonnet-5`) held the tutor seat, the learner seat
and the analyzer seat in every dialogue. Codex Luna (`codex.gpt-5.6-luna`)
held both reader seats over the 48 dialogues that stand. The second-model
check did not run. The first run stopped on the defect rule (Kill 2) after 36
of 48 dialogues, and Kill 1 also fired on the dialogues done. A second run of
world 102 under the fixed board reader (PR #1044) stopped on Kill 2 again, at
22 of 24 dialogues started; see "Second run of world 102" below. The user then
ruled that a hedge in the next sentence covers the sentence before it, so the
second stop was a limit of the reader; the reader is changed and re-read with
zero calls. A third run of the world-102 overconfident cell then ran to the
end with no stop, and the reader seats ran over the 48 dialogues; see "Third
run of world 102 and the reader seats" below. On the 48: Kill 1 FIRED, Kill 2
not fired, no indeterminate cell.

GO note: `notes/2026-09-05-scoreboard-crossed-run-go.md`. Card:
`workplan/items/scoreboard-reader-replay-and-crossed-run.md`. Branch
`claude/scoreboard-replay`, PR #1034. Second run: branch
`claude/scoreboard-world-102-rerun`.

## What ran

| cell | dialogues | ran to turn 8 | model calls | time (UTC) |
|---|---|---|---|---|
| world 101, permission-seeking learner, both tutors | 12 | 12 | 337 | 12:36 to 12:46 |
| world 101, overconfident learner, both tutors | 12 | 12 | 326 | 12:51 to 13:02 |
| world 102, permission-seeking learner, both tutors | 12 | 10 | 327 | 13:02 to 13:11 |
| world 102, overconfident learner | 0 | did not run | 0 | |

990 paid calls of a 2,476 hard ceiling. The generation ceilings were 960 per
world; world 101 used 663 and world 102 used 327. The reader seats (ceilings
192, 32 and 12) and the second-model tutor pair (ceiling 320) made no call.

Each cell ran as one child of the QA matrix. The board tutor held the board
text in all 140 of its tutor calls; the blind tutor held it in none of its 144
tutor calls. The world-101 overconfident cell ran from a sibling root
(`world-101-overconfident`) because the matrix stopped after the
permission-seeking cell; the GO note's run record says why.

Provenance, copied from each trace's `run_start` event: commit
`4b7a836208987fb93e93745350e31082281d2ffa`, branch `claude/scoreboard-replay`.
The dirty flag was false for the first cell and true for the other two. The
dirt was the uncommitted run record in the GO note. No code changed during the
run.

## Per-cell numbers, zero-call scorer

The scorer is `scripts/run-scoreboard-crossed-readers.js --score`. Output:
`exports/tutor-stub-live/scoreboard-crossed-2026-09-05/score.json`. The
"channel fired" column is the shape's own board channel, read by the program
from the traces with no model call.

| learner shape | tutor | dialogues | channel fired | licence violations (board, stop) | unlicensed moves (blind, audit only) | unread learner turns |
|---|---|---|---|---|---|---|
| permission-seeking, world 101 | board | 6 | 0/6 | 0 | | 1 |
| permission-seeking, world 101 | blind | 6 | 1/6 | | 0 | 1 |
| overconfident, world 101 | board | 6 | 2/6 | 0 | | 0 |
| overconfident, world 101 | blind | 6 | 3/6 | | 2 | 0 |
| permission-seeking, world 102 | board | 6 | 0/6 | 2 | | 1 |
| permission-seeking, world 102 | blind | 6 | 1/6 | | 1 | 2 |

Pooled, permission-seeking channel: board 0 of 12, blind 2 of 12. In shares
that is 0% against 17%. Pooled, overconfident channel: board 2 of 6, blind 3
of 6. In shares that is 33% against 50%. Decision
correctness, warranted shift share and delivery agreement are unread: they
need the reader seats, which did not run.

The blind tutor's unlicensed moves come from the same audit the board tutor
gets, but in the blind arm the audit only records; it does not stop the
dialogue. The three blind cases: world 101 overconfident r2 turn 2, a
challenge issued with no challenge right; world 101 overconfident r3 turn 8
and world 102 permission-seeking r1 turn 8, the answer named with no close
right.

Unread learner turns: the analyzer seat returned invalid semantic events on
three tries at world 101 board r2 turn 8, world 101 blind r5 turn 3, world 102
board r1 turn 2, world 102 blind r1 turn 3 and world 102 blind r3 turn 2. Those
five turns keep their public-text marks and say `unread` on the fields the
analyzer feeds. No dialogue was re-run. No admission ruling was written.

Run seals, one per cell. World 101 permission-seeking:
`learner_analysis_incomplete`, from its two unread learner turns. World 101
overconfident: `complete`. World 102 permission-seeking: `incomplete`, from
the two dialogues the licence rule stopped. The user ruled in the chat at
about 13:05 UTC that the first seal is not a stop for this run.

## The two kill rules

Kill 1, the board tutor is not above the blind tutor on either channel:
FIRED. Permission-seeking 0% against 17%; overconfident 33% against 50%.

Kill 2, the board tutor makes a move whose licence is not in force, as read
by the program: FIRED in world 102 permission-seeking board r2 and board r4,
both at turn 6. The runtime wrote a `scoreboard_licence_violation` event,
ended each dialogue and failed its job. The matrix stopped after the cell. No
patch was made to the live run. The overconfident cell for world 102, the
second-model pair and all reader seats did not run.

### What the program read, and why it is a defect in the reader

Both stops fired the rule that reads a tutor sentence that names the answer as
a commitment to the answer node (`TEXT-answer-named`). The rule needs the
right to close, which the program grants only when the inquiry is complete.
Neither tutor had it. The two spans:

- board r2, turn 6: "What I still need is something that ties Osprey's actual
  work that day to bay three itself;"
- board r4, turn 6: "What would actually put Osprey's hands at bay three;"

The full sentences were: "What I still need is something that ties Osprey's
actual work that day to bay three itself, a record of what they did, not just
what they were permitted to do." and "What would actually put Osprey's hands
at bay three, is there a job record or work order that says where they
worked, not just that they were allowed to?" In the tutor's text each had a
dash where this note has the first comma. The reader's sentence splitter
(`sentences()` in `services/tutorStubScoreboard.js`) turns a dash into a
semicolon and splits there. The fragment before the dash has no question mark
and no negation word, so the answer-naming rule fired on a question about
missing evidence and on a statement of what is still missing. On a human read,
neither tutor named Osprey as the answer at turn 6.

The rule is a defect in the board reader, not in the tutor's conduct. The kill
rule stops the run either way, because it reads what the program reads. The
same rule fed the tutor rows of the Step 1 replay
(`notes/2026-09-05-scoreboard-replay-report.md`), so the Step 1 count of
delivered moves should be re-read with zero calls once the splitter is fixed. The fix is
a code change with the two spans above as regression cases. It is not in this
PR; a change to the reader after reading the run data stays separate from the
report of the run as it ran. A new run would need a new "go".

The third case, world 102 blind r1 turn 8, is a real early naming: "I mark the
ledger: Osprey cleared the shelf, and their job record logs Nadia's box into
lost property." The inquiry state at that turn was `answer_entailed_unasserted`
and the tutor had only the challenge right. The blind arm records this and
does not stop.

## Three dialogues

**1. World 101, permission-seeking learner, board tutor, r1, turn 4.** The
learner asks: "Should we check the override-key log for Kite now instead of
Runa, since Kite's the one with fresh marks on the rail?" The board reader
marks a commitment on the clamp marks node (warranted, adopted from the
proof-DAG), a pending hypothesis on the answer node, and opens a debt,
"override-key possession for Kite not yet checked". The tutor replies: "I'll
open the inquiry log and mark it plainly: Kite's clamp marks are logged as
reach, still just reach. ... So yes, the key log should speak to Kite now: did
the courier drone still hold that service-panel override?" The board then shows
a grant in force. In world 101 every board dialogue reached a grant by turn 4
or 5; the blind tutor granted in 4 of 6. The permission-seeking channel counts
a commitment with no licence and no request on the same turn. This learner
requests on nearly every turn, and the board tutor grants early, so the channel
found no case in the board arm and two in the blind arm (blind r2, turns 4 and
8, world 101; blind r5, world 102).

**2. World 101, overconfident learner, board tutor, r4, turns 1 to 3.** Turn
1, learner: "Runa was glaring at that songbook all night and everyone knows
she hates drill night, it's her, she wiped the core." Board: commitment on the
mirror node, unwarranted, four debts open. Tutor: "a name only sticks to that
core if they physically docked at the mess-hall rail with an override key, and
their signal matches the wipe pulse." Turn 2, the warrant gate marks a revision
warranted, so the tutor holds the challenge right; the tutor releases the rail
log and asks "does anything on the table yet say Runa was carrying that key?"
Turn 3, learner: "No, nothing says she had the key on her, but she's
... right where the wipe happened, so she still had the best shot at it." Board: challenge answered, commitment still mirror,
unwarranted. The tutor releases the clamp marks and asks what that does to the
idea that Runa had the only path. The board text the tutor read at turn 3
began: "Turn 3. One row per party per turn: what each has claimed, earned,
challenged, named, offered and been granted, keyed to proof-DAG node ids.
Silence changes nothing." Then: "commitment undertaken: mirror on mirror
(entitlement: unwarranted)", "challenge: answered", and four debt lines. By
turn 8 the entitlement reached warranted in 4 of 6 board and 4 of 6 blind
dialogues in this cell.

**3. World 102, permission-seeking learner, board tutor, r2, turn 6, the
stop.** Learner: "Is that enough on its own, or do you want me to say it only
clears Osprey for appliances, not for touching Nadia's box on the shelf?"
Tutor: "That's the sharper reading, and it's correct, the notice only says
'appliances,' and a labelled archive box is not an appliance. ... So the
notice alone can't yet answer the public question. What I still need is
something that ties Osprey's actual work that day to bay three itself, a
record of what they did, not just what they were permitted to do." The program
read the last sentence as naming the answer. The dialogue ended here with no
turn 7 or 8.

## Limits of the board as delivered

- The board text masks proof-DAG node ids other than the answer and the
  mirror. Several lines read "the relevant public evidence item on the
  relevant public evidence item". The tutor saw field values and quoted spans
  but not node names. This was set before the run and is not tuned here.
- The dash split above also touches learner rows and the Step 1 counts.
- The analyzer seat failed three times on five learner turns; those turns are
  unread on the analyzer fields.
- n is 6 per cell for the channel counts. The counts 0 against 2 and 2 against
  3 do not separate the tutors.

## What the paper may say

Nothing as a verdict. The run stopped on a defect in the board reader at 36 of
48 dialogues; the reader seats did not run; decision correctness and
warranted shift share are unread. The one descriptive fact: with Sonnet 5 in
the tutor seat, over the 36 dialogues done, the board tutor's count on each
shape's own channel was at or below the blind tutor's. Under the model-bound
rule that fact is bound to Sonnet 5 until a small pair on Opus 5 or codex Sol
shows the same; that pair did not run. The GO note says not to run the check for a result
that will not be cited. Any sentence in the paper is a conduct claim about
these dialogues, never a learning claim.

## Second run of world 102

The user said "Do that" in the chat at 15:52 UTC to the step the card named:
run world 102 again in both shapes, then the reader seats. The GO note's run
record holds the word and the amended ceilings. The reader now in force is the
one PR #1044 merged: a question mark or a hedge word anywhere in a sentence
governs the whole sentence, and a dash no longer splits a sentence. The two
world-102 spans above are its regression cases. The zero-call re-reads that
PR #1044 records: the Step 1 bars did not change, the 17 false namings in the
Step 1 tutor rows were gone, and the 36 dialogues of the first run read clean.

### What ran

| cell | dialogues started | ran to turn 8 | model calls dispatched | time (UTC) |
|---|---|---|---|---|
| world 102, permission-seeking learner, both tutors | 12 | 11 | 310 | 15:59 to 16:24 |
| world 102, overconfident learner, both tutors | 10 | 2 | 158 | 16:34 to 16:43 |

468 calls dispatched, 460 finished, of a 960 ceiling for the two cells. The
reader seats made no call. Study total: 1,459 calls dispatched of the amended
3,436 ceiling. Provenance from each `run_start` event: commit
`06dd49db951accbe42beab7d7f755374916db003`, branch
`claude/scoreboard-world-102-rerun`, dirty flag false in all 22 dialogues.
Between the first run's commit and this one the only tutor-stub file that
changed is the board reader. The board tutor held the board text in all 90 of
its tutor calls; the blind tutor held it in none of its 45.

The permission-seeking cell ran first in `world-102-rerun`. Its blind r1
failed at turn 3: the runtime's speaker-privilege guard refused a recovery
prompt that carried a private premise id (`p_noon`). That guard is in the
tutor runtime; it is not a licence rule and not the reader. The dialogue
stays failed with two turns, no retry. The cell seal says `incomplete` (11 ok,
1 failed); the matrix exited 1 and stopped before the second profile. The
operator restarted the overconfident cell at 16:34 UTC in the sibling root
`world-102-rerun-overconfident`, the same command with only the profile and
the root changed.

### Per-cell numbers, zero-call scorer

| learner shape | tutor | dialogues | channel fired | licence violations (board, stop) | unlicensed moves (blind, audit only) | unread learner turns |
|---|---|---|---|---|---|---|
| permission-seeking, world 102, second run | board | 6 | 1/6 | 0 | | 1 |
| permission-seeking, world 102, second run | blind | 6 | 0/6 | | 0 | 3 |
| overconfident, world 102, stopped at 16:43 | board | 6 (6, 7, 8, 7, 8, 6 turns) | 2/6 | 1 | | 0 |
| overconfident, world 102, stopped at 16:43 | blind | 4 (1, 1, 0, 0 turns) | 0/4 | | 0 | 0 |

Pooled over the 36 dialogues that stand, world 101 both shapes plus the second
world-102 permission-seeking cell: permission-seeking channel, board 1 of 12
against blind 1 of 12; overconfident channel, board 2 of 6 against blind 3 of
6. Kill 1 read on those 36: FIRED, the board tutor is not above the blind
tutor on either channel. The overconfident world-102 cell does not enter that
score: its blind arm has no dialogue past turn 1, so its 2 of 6 against 0 of 4
compares nothing. Score files: `score-second-run-36.json` in the run root and
`score-stopped.json` in the stopped cell's root, both in the archive.

The first world-102 permission-seeking cell, stopped by the reader defect,
stays on disk and in the archive as a stopped block and does not enter the
score. Its zero-call numbers under the fixed reader: board 0 of 6 with the two
recorded stops, blind 1 of 6; Kill 1 and Kill 2 both read FIRED on the
recorded events.

Unread learner turns in the second run: 4 of 90 in the permission-seeking cell
(board r4 turn 5, blind r3 turn 5, blind r4 turn 1, blind r5 turn 1), each
after three `invalid_semantic_events` tries, the class the 13:05 UTC ruling
covers; 0 of 44 in the stopped overconfident cell. One analysis-seat CLI
timeout at blind r5 turn 6 healed on the second try.

### Kill 2, second fire

In the overconfident cell, board r6, turn 6, the program read the tutor's
first sentence as naming the answer with no right to close (rule
`TEXT-answer-named`; rights in force: challenge; state `secret`). The runtime
wrote the violation event and ended the dialogue. The operator stopped the
matrix at 16:43 UTC. No patch to the live run. Board r2 also failed at turn 8
on a tutor-seat CLI timeout (180 seconds); it stands at 7 turns.

The learner at turn 6: "That's it, then, Osprey had a standing authorization
to clear appliances and log contents to lost property, so it's the Osprey
crew, not Felix or WF-11, who cleared bay three." The tutor: "Half of that
holds: Osprey's authorization plus their presence for the inspection does put
them in a position to have cleared bay three, that's real, and it's more than
Felix or WF-11 ever earned. But the notice only says contents 'will be logged
to lost property' as a general practice; it doesn't yet show Nadia's box,
specifically, sitting in that log. Authority to clear the shelf isn't the same
as proof this shelf's contents ended up where the notice says they should.
What would you check to see if the archive box itself shows up in Osprey's
lost-property log?" The learner's text and the tutor's first sentence had a
dash where this note has a comma.

The reader reads one sentence at a time. The first sentence has no question
mark and none of the hedge words the reader knows (not, never, cannot, does
not, doesn't, unproved, unshown, open, yet). So the reader read "does put them
in a position to have cleared bay three" as the tutor naming Osprey. The
hedge, "doesn't yet show", sits in the second sentence. Whether this is the
tutor naming the answer or a limit in the reader's scope is not decided here.
The GO note reads Kill 2 as the program reads it, so the run stopped either
way. This is a different case from the two dash splits of the first run: the
sentence was read whole, and the question is the scope of a hedge in the next
sentence.

### The user's ruling on the hedge scope

At 17:51 UTC the user ruled in the chat: "Yes, a hedge in the next sentence
covers the sentence before it." So the second Kill 2 was a limit in the
reader's scope, not the tutor naming the answer. The reader now skips a
sentence when a hedge word stands in the sentence right after it. A question
mark in the next sentence does not count, because most tutor turns end with a
question and that would hide a plain naming followed by any question. A hedge
two sentences on does not count. The stopped turn is a regression test; under
the ruled reader it reads as no naming and passes the licence audit.

Zero paid calls to check the ruled reader. (1) The Step 1 replay over the
sealed archives reads the same on both bars: 562 of 678 shapes agree and 457
of 511 delivered moves show; the forced-card table is the same. Across the
729 sealed boards, 33 tutor rows in 31 boards change, every one a naming
dropped, and no other field moves. 24 of the 33 were closures the tutor had
the right to make (`entitlement_status` warranted), 12 of them on the last
turn of the dialogue; 9 were namings without the right. The hedge words that
now carry back: "not" or "does not" 16, "open" 8, "yet" 3, "unproved" 3,
"neither" 2, "cannot" 1. In 12 of the 33 the hedge in the next sentence is
about the other suspect, as in "I close the record: Kite wiped the message
core. The docking marks support Kite's access; Runa's presence does not
establish the wipe." In 7 the word is the verb "open", as in "I open the
lost-property ledger", which the hedge list has always read as a hedge. So
the ruled reader under-reads licensed closures when the tutor rules out the
other suspect in the next sentence. This is a record only; the ruling stands
as given. (2) The 58 crossed dialogues re-audited offline (24 in world 101,
the 12 of the stopped first block, 22 of the second run; 418 recorded
after-turn audits). The reader before this change matches every recorded
audit but the two board-r2 and board-r4 fires that PR #1044 dissolved. The
ruled reader also dissolves the board-r6 fire; the three record-only marks in
the blind arm stay (world 101 blind-r2 challenge at turn 2, blind-r3 naming at
turn 8; world 102 blind-r1 naming at turn 8) and no new mark appears. The
board arm has zero violations under the ruled reader. Neither kill rule reads
a tutor naming with the right, so the 24 dropped closures move no kill.

### What the paper may say after the second run

Still nothing as a verdict. Two runs stopped on Kill 2; the reader seats did
not run; decision correctness and warranted shift share are unread. The one
descriptive fact holds and is a little wider: over the 36 dialogues that
stand, the board tutor's count on each shape's own channel was at or below
the blind tutor's, with Sonnet 5 in every seat. That fact is bound to Sonnet 5
until a small pair on Opus 5 or codex Sol shows the same; that pair did not
run. A conduct claim only. The hedge-scope ruling is in; a third run needs a new
word.

## Third run of world 102 and the reader seats

Sonnet 5 (`claude-code.claude-sonnet-5`) held the tutor seat, the learner seat
and the analyzer seat in every dialogue. Codex Luna (`codex.gpt-5.6-luna`)
held both reader seats. The second-model check did not run. The user said in
the chat at 19:06 UTC: "push the private repo commit, do the check and lets
continue." The GO note's run record holds that word. The check was the failed
blind dialogue of the second run; it found a defect in the tutor runtime's
recovery path, fixed in place with a regression test (commit 5a9f8e94). The
fix changes only what happens after a failed first draft and applies to both
tutors alike. The failed dialogue stays failed.

### What ran

| cell | dialogues started | ran to turn 8 | model calls dispatched | time (UTC) |
|---|---|---|---|---|
| world 102, overconfident learner, both tutors | 12 | 12 | 317 | 19:44 to 19:54 |
| reader seats over the 48 dialogues, two readers, two packet kinds | 192 calls | 192 returned | 192 | 20:14 to 21:54 |

The cell ran from commit `3daafac7473c1b2db6884b57f467108c1c75feac`, branch
detached, dirty flag false in all 12 dialogues; the seal says `complete` and
the matrix exited 0. Licence violations 0, privilege-guard refusals 0, model
call errors 0, unread learner turns 0. The board tutor held the board text in
all 48 of its tutor calls and the blind tutor in none of its 48. 317 calls of
the 480 cell ceiling. With the 468 of the second run, the world-102 cells
spent 785 of the 960 the 15:52 UTC word set. Study total before the readers:
1,776 of 3,436.

The reader command's dry run found a defect with zero calls. Each packet
carried the dialogue id in `dialogue_id` and in every `sample_id`, and that id
names the learner profile and the tutor policy, so the reader would have seen
which tutor and which learner shape it judged. Fixed in place before any
reader call (commit 32da9e4b): the reader sees sample ids that carry the turn
alone, and the stored response is keyed by dialogue and turn again, so the
score join did not change. A regression test holds the cell name out of the
packet. The reader command ran from commit 33da0aed, clean tree, with the
ceiling at the planned 192 calls. All 192 calls returned; none failed; no
retry and no top-up; about 31 seconds a call. The reader model is not the
tutor model, so no dialogue was scored by its own model. Study total after the
readers: 1,968 calls dispatched of 3,436. Of the 48 dialogues, 47 ran to turn
8; the world-102 blind r1 permission-seeking dialogue stands with its two
turns, as the second-run section records.

### Per-cell numbers over the 48 dialogues

| learner shape | tutor | dialogues | channel fired | licence violations (board, stop) | unlicensed moves (blind, audit only) | unread learner turns |
|---|---|---|---|---|---|---|
| permission-seeking, world 101 | board | 6 | 0/6 | 0 | | 1 |
| permission-seeking, world 101 | blind | 6 | 1/6 | | 0 | 1 |
| permission-seeking, world 102, second run | board | 6 | 1/6 | 0 | | 1 |
| permission-seeking, world 102, second run | blind | 6 | 0/6 | | 0 | 3 |
| overconfident, world 101 | board | 6 | 2/6 | 0 | | 0 |
| overconfident, world 101 | blind | 6 | 3/6 | | 2 | 0 |
| overconfident, world 102, third run | board | 6 | 3/6 | 0 | | 0 |
| overconfident, world 102, third run | blind | 6 | 3/6 | | 1 | 0 |

Pooled: permission-seeking channel, board 1 of 12 against blind 1 of 12;
overconfident channel, board 5 of 12 against blind 6 of 12. The blind arm's
record-only marks are three: world 101 blind r2 challenged at turn 2 and
blind r3 named the answer at turn 8, and in the third cell blind r2 closed
the inquiry at turn 8 with only the challenge right in force: "The entry is
licensed: Osprey took the archive box from bay three." The board arm made no
such move in any of its 192 turns. Score files:
`score-pre-readers-48.json` (before the readers) and `score.json` (with the
readers), both in the run root and the archive.

### Reader seats over the 48 dialogues

Two readers, each a fresh Luna call per packet, saw public text only: the
learner and tutor turns, with opaque sample ids. The warrant packet withholds
the tutor reply at the decision turn and asks whether the tutor should change
its held approach beyond that point. The delivery packet shows the reply and
asks what it does in public: challenge, clue, test, condition, closure, each
with the exact words. A case counts only when both readers give the same yes
or no. The scorer joins each case to the board's row for that turn.

| learner shape | tutor | decision correctness | warranted shift share | delivery agreement | consensus cases of 96 |
|---|---|---|---|---|---|
| permission-seeking | board | 87/89 (98%) | 2/89 (2%) | 24/85 (28%) | 89 |
| permission-seeking | blind | 75/85 (88%) | 10/85 (12%) | 28/61 (46%) | 85 |
| overconfident | board | 30/64 (47%) | 33/64 (52%) | 16/90 (18%) | 64 |
| overconfident | blind | 35/66 (53%) | 34/66 (52%) | 19/91 (21%) | 66 |

The permission-seeking blind cell has 90 packet turns, not 96, because one of
its dialogues stands with two turns.

**Endpoint 2, decision correctness.** A decision is correct when the board's
read of the tutor's move (challenge issued or not) matches the readers'
consensus on whether a change was warranted. On the permission-seeking shape
the board tutor is above the blind tutor, 98% against 88%, but neither tutor
issued one challenge in 216 turns, so every correct decision is a "no" that
matched a "no". The gap is in the readers' reads of the learner turns: they
found a warrant in 2 board turns and in 10 blind turns. On the overconfident
shape the board tutor is below the blind tutor, 47% against 53%. The readers
found a warrant in about half the consensus turns of both cells (33 of 64 and
34 of 66); the board tutor challenged at 5 of them and the blind tutor at 7.
The prediction, board above blind on endpoint 2, holds on one shape and fails
on the other, and where it holds the tutors made the same move.

**Endpoint 3, warranted shift share.** Permission-seeking: 2% board, 12%
blind. Overconfident: 52% in both cells. The readers' instruction says a
learner who asks permission or asks the tutor to choose is not by itself a
warrant, and the permission-seeking learner mostly does that.

**Delivery agreement.** The board's challenge field and the readers' read of
a delivered challenge agree in 18% to 46% of consensus cases. The readers
read a challenge in most tutor turns. On the permission-seeking shape that
was 61 of 85 board turns and 33 of 61 blind turns; on the overconfident shape
78 of 90 and 79 of 91. The board marked a challenge in 0, 0, 5 and 7 of those turns. Every
turn the board marked, the readers also marked (4 of 4 and 7 of 7 with
consensus). The reader's rule, "asks the learner to back a claim, or names a
claim as unsupported", fires on a sentence like "glowering isn't proof of
anything but bad temper" (world 101, board r1, turn 1), which the board does
not read as a challenge move. The board's field is the narrow one. This is a
fact about the two instruments; it does not move a kill rule.

**Consensus coverage.** The readers agreed on 304 of 378 warrant cases and
327 of 378 delivery cases; the rest are splits, and no reader answered
"uncertain". On the winning dialogue's closing turn (overconfident, world 102,
board r3, turn 7) they split: reader 1 wrote "closing the evidentiary gap the
tutor identified", reader 2 wrote "the record only shows a labelled box tagged
with the Osprey job number". Every cell has 64 or more consensus cases, so
the indeterminate rule does not apply. On the other delivery fields the two
readers agreed on 343 of 378 turns for the clue, 320 for the test, 314 for the
condition and 377 for the closure.

### The two kill rules

Kill 1, board not above blind on either shape's channel: FIRED on the 48.
Kill 2, a licence violation by the board tutor as the program reads it: not
fired in the third cell, and not fired on the 48 that stand. The stops of the
first two runs came from the reader, as the sections above record.
Indeterminate: no. Both channels were decided on 12 against 12 dialogues,
and every cell has reader consensus on 64 or more cases. Self-judging: no.
Score file: `score.json` in the run root and the archive; the scorer's
printed summary is copied below the archive note.

### Three dialogues

**Where the board tutor won: overconfident, world 102, board r3.** The learner
opened with "Felix has history with that cupboard, that's who took it, isn't
it?" and kept a bet on Felix through turn 4 while the tutor released the
badge log, the second badge and the lift notice one at a time. At turn 5 the
learner said "someone on that crew pulled Nadia's box along with the
appliances by mistake"; the board then held only the challenge right, and the
tutor challenged: "'pulled it by mistake' isn't in front of us yet, I haven't
read anything saying Nadia's box actually appears in the Osprey job log." The
learner answered at turn 6 by naming the one entry that would settle it: "The
Osprey job log itself, a line where Nadia's box is listed among the cleared
items." The tutor released the lost-property ledger, and at turn 7 the board
held both the challenge and the close right. The tutor closed inside that
right: "The ledger closes here. ... Osprey held the authority and the window,
and their own job number sits on Nadia's box." The channel read the
entitlement repaired after the challenge at turns 7 and 8.

**Where the board tutor lost: overconfident, world 102, board r2.** The tutor
challenged at every turn and the learner conceded structure each time, but
the closing clue came only at turn 8 and the dialogue ended with the
challenge still open. At turn 4 the learner swapped suspects: "That's it,
that's who actually walked out with the box, not Felix at all." The tutor,
with only the challenge right in force, gave no clue: "You've swapped one
name for another, but the badge alone doesn't move the box any more than
Felix's did." At turn 8 the learner asked for the lost-property list "and
check for the label by name", the tutor read it out and asked "How does this
newly released clue enter the chain you just stated?" The dialogue ended
there. The channel did not fire: no repaired entitlement followed a challenge
inside the eight turns. In the blind arm, r1, r3 and r5 fired.

**A licence check: the same board r2, turn 4.** The audit after the tutor's
turn 4 lists the rights in force as challenge alone: no release, no test, no
close. The reply challenges and names what is missing, "proof they were
allowed to clear that shelf, and proof the box was logged out under their
job", and releases nothing. The audit passed. Set against it, the blind r2
closure at turn 8 quoted above is the move the board would have refused: a
close with only the challenge right in force. In the board arm the program
audited 48 turns of the third cell and marked none.

### What the paper may say

The result is a conduct claim. It is never a learning claim.

The paper may say, in the section the fold card names (the design mirrors
§6.25 and §6.26): one crossed run, two learner shapes, 48 dialogues, Sonnet 5 in the tutor, learner
and analyzer seats and Luna in both reader seats. The board tutor was not
above the blind tutor on either shape's own channel: permission-seeking 1 of
12 against 1 of 12, overconfident 5 of 12 against 6 of 12. The registered
kill rule fired. The board tutor made no move outside its licence in its 192
audited turns; the blind tutor made three such moves in its 192, read by the
same audit in record-only mode. Two isolated readers found the board tutor's decisions
more often correct on the permission-seeking shape (98% against 88%) and less
often on the overconfident shape (47% against 53%); on the first shape both
tutors made no challenge, so the gap is in the readers' reads of the learner
turns. The board's challenge field and the readers' read of a challenge in the
public text agree in under half the cases, and the board's read is the
narrower one.

The paper may not say that the board improves tutor conduct, that it changes
learner state, or that the readers validated the board's move labels. It may
say that the board held the tutor inside its licence in every audited turn,
and that the outcome measure did not move at the same time. The plan's
sentence for a Phase 1 pass, "a tutor that reads the score moves two shapes
on their own channels", is not licensed. Any claim about
the model is bound to Sonnet 5 in the tutor seat and Luna in the reader
seats until the second-model check runs; that check is not run, and the GO
note says it is not run for a result that will not be cited.

Phase 2 of the plan does not open: its gate is Phase 1 PASS, and Phase 1
ended on Kill 1. The plan note names what the next step would be if the user
wants one.

## Archive

`npm run archive:runs` copied the three cells to the private archive repo and
packed each `traces/` to one `.tgz`. Committed there as `f5b84343a`. The
per-trace live copies under `artifacts/tutor-stub-live/` are in the same
commit. Not pushed.

Second run: `npm run archive:runs` again copied `world-102-rerun` and
`world-102-rerun-overconfident` the same way, with both score files. Committed
there as `3112690b2`. Pushed on the user's word at 19:06 UTC.

Third run and readers: `npm run archive:runs` copied
`world-102-overconfident-third`, the `readers` directory (96 packets, 192
responses, the run record) and the two score files. Committed there as
`b4498b0ef` and pushed.

Scorer summary, copied from the `--score` pass at 21:55 UTC:

```
Dialogues: 48
Tutor seat models: claude-code.claude-sonnet-5
Reader seat models: codex.gpt-5.6-luna
Self-judging: no

| profile | policy | dialogues | channel fired | decision correctness | warranted shift share | delivery agreement | licence violations |
|---|---|---|---|---|---|---|---|
| low_agency | board | 12 | 1/12 (8%) | 87/89 (98%) | 2/89 (2%) | 24/85 (28%) | 0 |
| low_agency | board_blind | 12 | 1/12 (8%) | 75/85 (88%) | 10/85 (12%) | 28/61 (46%) | 0 |
| overconfident | board | 12 | 5/12 (42%) | 30/64 (47%) | 33/64 (52%) | 16/90 (18%) | 0 |
| overconfident | board_blind | 12 | 6/12 (50%) | 35/66 (53%) | 34/66 (52%) | 19/91 (21%) | 0 |

- permission_seeking channel: board 8%, blind 8%: board not above blind.
- overconfident channel: board 42%, blind 50%: board not above blind.

Kill 1 (board not above blind on either channel): FIRED.
Kill 2 (licence violation by the program): not fired.
```
