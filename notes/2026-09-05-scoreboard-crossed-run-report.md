# Scoreboard crossed run: report

Sonnet 5 (`claude-code.claude-sonnet-5`) held the tutor seat, the learner seat
and the analyzer seat in every dialogue. No reader seat ran. The second-model
check did not run. The run stopped on the defect rule (Kill 2) after 36 of 48
dialogues, and Kill 1 also fired on the dialogues done.

GO note: `notes/2026-09-05-scoreboard-crossed-run-go.md`. Card:
`workplan/items/scoreboard-reader-replay-and-crossed-run.md`. Branch
`claude/scoreboard-replay`, PR #1034.

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

## Archive

`npm run archive:runs` copied the three cells to the private archive repo and
packed each `traces/` to one `.tgz`. Committed there as `f5b84343a`. The
per-trace live copies under `artifacts/tutor-stub-live/` are in the same
commit. Not pushed.
