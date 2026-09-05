GO

# Scoreboard crossed run: GO note

Operator: Liam Magee
Date: 2026-09-05
Authorization source: the user's word "Go" in the chat, 2026-09-05 UTC, after
the PR #1034 hand-back. The word covers the study below: the question, the design, the measurement
rules and the spend ceiling. It stays valid until the study changes. A bug fix
does not void it.
Recorded by: Claude Fable 5.1

Brief: `notes/2026-09-04-scoreboard-replay-prompt.md`, Step 2.
Card: `workplan/items/scoreboard-reader-replay-and-crossed-run.md`.
Gate: Step 1 PASSED on the two pooled bars
(`notes/2026-09-05-scoreboard-replay-report.md`). The held-out half missed the
pairwise bar by one dialogue. The pooled bars are the registered bars, so
Step 2 is open. The cast preflight passed with zero calls (command below).

## Study

One crossed run. Two learner shapes, each cast as a policy over the board:
the permission-seeking learner (profile `low_agency`) and the overconfident
learner (profile `overconfident`). Two tutor conditions: the tutor whose move
table reads the board (`board`) and the same tutor with the board hidden
(`board_blind`). Same prompt otherwise. Same seed schedule (run seed
20260711). Two worlds, the same two the §6.25 run used: world-101, the kestrel
signal lamp, and world-102, the marigold archive box. Eight learner turns per
dialogue. Twelve dialogues per cell, six per world.

48 dialogues, 384 tutor turns.

Endpoints, fixed before any call:

1. Board change on each shape's own channel, read by the program from the
   board. Permission-seeking: a learner commitment undertaken with no licence
   in force. Overconfident: entitlement moves from pending or unwarranted to
   warranted after a tutor challenge. Unit: share of dialogues in which the
   channel fires at least once.
2. Decision correctness by the §6.25 reader method: two isolated model
   readers judge, at each learner turn, whether the tutor should change its
   held approach. The harness compares the tutor's move at that turn, as read
   by the board, with the two-reader consensus.
3. Warranted shift share by the §6.26 method: consensus cases judged
   warranted over all consensus cases, per cell.

Prediction: the board tutor is above the blind tutor on endpoints 1 and 2.

Kill rules:

- Kill 1. The board tutor is not above the blind tutor on either shape's
  channel. The scorer prints this as "Kill 1 ... FIRED".
- Kill 2. Any dialogue in which the board tutor makes a move whose licence is
  not in force, as read by the program. The runtime writes a
  `scoreboard_licence_violation` event, ends that dialogue and fails its job.
  The attended operator then stops the matrix. That is a defect. Do not patch
  a live run. Report the dialogues done so far and stop.
- Indeterminate means stop. If a channel cannot be decided for a shape, or the
  readers reach consensus on no case in a cell, the note reports it and no
  more calls are made.

## Seats

| seat | model | why |
|---|---|---|
| tutor, learner analysis, auto-learner (main run) | `claude-code.claude-sonnet-5` | default stack; never nemotron/kimi |
| reader 1 and reader 2 (main run) | `codex.gpt-5.6-luna` | a different model from the tutor seat, so no self-judging |
| tutor (second-model pair) | `codex.gpt-5.6-sol` | model-bound rule: one small pair with Sol in the tutor seat |
| reader check | `claude-code.claude-opus-5` | model-bound rule for the reader seat: a few calls on Opus |

The reader runner refuses a reader model that also held a tutor seat, and
refuses nemotron or kimi in any seat. Both checks fail before the first call.

## Zero-call preflight, run before the first paid call

```bash
node scripts/preflight-scoreboard-learner-cast.js
```

It must print PASS and exit 0. It builds each shape's trigger from the board
with no model call. If it fails, the cast fails and nothing is launched.

## Planned calls and ceilings

Figures come from `--print-plan` output and from the runner's own count, not
from the brief's estimate.

| stage | command | dialogues | expected calls | hard ceiling | how the ceiling is enforced |
|---|---|---|---|---|---|
| generation, world 101 | A below | 24 | about 648 | 960 | per-dialogue budget 40; `reserve()` throws before the call at 40 |
| generation, world 102 | B below | 24 | about 648 | 960 | same |
| reader seats, main run | C below | 48 | 192 | 192 | `--max-calls 192`, checked before every call |
| second-model pair, world 101 | D below | 8 | about 216 | 320 | per-dialogue budget 40 |
| reader seats, second-model pair | E below | 8 | 32 | 32 | `--max-calls 32` |
| Opus reader check, six main dialogues | F below | 6 | 12 | 12 | `--max-calls 12` |

Expected total about 1,748 calls. Hard ceiling total 2,476 calls. The expected
generation figure uses the §6.25 rate of 27 model calls per 8-turn dialogue
(tutor 8, auto-learner 8, learner analysis 8, recovery about 2, opening 1).
The §6.25 run used budget 30; this run uses 40 so that a slow dialogue is not
cut short, and the ceiling still fails before the call.

Automatic retries: 0. No resampling after a failure. No top-up. A dialogue
that fails stays failed and is reported as such.

A. Generation, world 101 (plan print: 24 expected dialogue rows, primary
horizon learner turn 8, DAG mode strict_dag, budget 40, warrant gate observe,
stop on grounded no):

```bash
node scripts/run-tutor-stub-qa-matrix.js --suite scoreboard --profiles low_agency,overconfident --runs 6 --turns 8 --primary-horizon 8 --cli-effort medium --warrant-gate observe --no-stop-on-grounded --world docs/adaptation-refinement/outcome-study-a1/worlds/world_101_kestrel_signal_lamp.yaml --model claude-code.claude-sonnet-5 --analysis-model claude-code.claude-sonnet-5 --auto-learner-model claude-code.claude-sonnet-5 --model-call-budget 40 --trace-dir exports/tutor-stub-live/scoreboard-crossed-2026-09-05/world-101
```

B. Generation, world 102 (same plan figures):

```bash
node scripts/run-tutor-stub-qa-matrix.js --suite scoreboard --profiles low_agency,overconfident --runs 6 --turns 8 --primary-horizon 8 --cli-effort medium --warrant-gate observe --no-stop-on-grounded --world docs/adaptation-refinement/outcome-study-a1/worlds/world_102_marigold_archive_box.yaml --model claude-code.claude-sonnet-5 --analysis-model claude-code.claude-sonnet-5 --auto-learner-model claude-code.claude-sonnet-5 --model-call-budget 40 --trace-dir exports/tutor-stub-live/scoreboard-crossed-2026-09-05/world-102
```

Run A and B one after the other, attended. They share one quota window and
feed one contrast.

C. Reader seats over the 48 dialogues (dry run first; it writes the packets
and makes no call):

```bash
node scripts/run-scoreboard-crossed-readers.js --traces exports/tutor-stub-live/scoreboard-crossed-2026-09-05/world-101 --traces exports/tutor-stub-live/scoreboard-crossed-2026-09-05/world-102 --out exports/tutor-stub-live/scoreboard-crossed-2026-09-05/readers --dry-run
```

```bash
node scripts/run-scoreboard-crossed-readers.js --traces exports/tutor-stub-live/scoreboard-crossed-2026-09-05/world-101 --traces exports/tutor-stub-live/scoreboard-crossed-2026-09-05/world-102 --out exports/tutor-stub-live/scoreboard-crossed-2026-09-05/readers --reader-model codex.gpt-5.6-luna --readers-count 2 --effort medium --max-calls 192
```

Each dialogue gives two packets. The warrant packet holds, for each learner
turn, the public record through that turn with the tutor reply withheld. The
delivery packet holds each learner turn and the tutor reply to it. Packets
carry public text only: no board, no trace internals.

D. Second-model pair, Sol in the tutor seat (plan print: 8 expected dialogue
rows):

```bash
node scripts/run-tutor-stub-qa-matrix.js --suite scoreboard --profiles low_agency,overconfident --runs 2 --turns 8 --primary-horizon 8 --cli-effort medium --warrant-gate observe --no-stop-on-grounded --world docs/adaptation-refinement/outcome-study-a1/worlds/world_101_kestrel_signal_lamp.yaml --model codex.gpt-5.6-sol --analysis-model claude-code.claude-sonnet-5 --auto-learner-model claude-code.claude-sonnet-5 --model-call-budget 40 --trace-dir exports/tutor-stub-live/scoreboard-crossed-2026-09-05/second-model-world-101
```

E. Reader seats over the second-model pair:

```bash
node scripts/run-scoreboard-crossed-readers.js --traces exports/tutor-stub-live/scoreboard-crossed-2026-09-05/second-model-world-101 --out exports/tutor-stub-live/scoreboard-crossed-2026-09-05/second-model-readers --reader-model codex.gpt-5.6-luna --readers-count 2 --effort medium --max-calls 32
```

F. Opus reader check over six main dialogues: the first job directory of
each cell in world 101 plus the first two of world 102, passed as six
`--traces` job paths, one Opus reader:

```bash
node scripts/run-scoreboard-crossed-readers.js --traces <six job dirs> --out exports/tutor-stub-live/scoreboard-crossed-2026-09-05/opus-reader-check --reader-model claude-code.claude-opus-5 --readers-count 1 --effort medium --max-calls 12
```

Scoring is zero calls:

```bash
node scripts/run-scoreboard-crossed-readers.js --traces exports/tutor-stub-live/scoreboard-crossed-2026-09-05/world-101 --traces exports/tutor-stub-live/scoreboard-crossed-2026-09-05/world-102 --score --readers exports/tutor-stub-live/scoreboard-crossed-2026-09-05/readers --score-out exports/tutor-stub-live/scoreboard-crossed-2026-09-05/score.json
```

## Settings and why

- `--turns 8` and `--primary-horizon 8`: eight learner turns, the §6.25
  horizon.
- `--warrant-gate observe`: the gate records its decision and does not steer.
  The §6.25 run used the same setting. The board reader reads the recorded
  decision.
- `--no-stop-on-grounded`: every dialogue runs to turn 8, as in §6.25, so the
  cells have equal turn counts.
- `--cli-effort medium`: the §6.25 setting.
- `--model-call-budget 40`: see the table above.
- Run seed 20260711 and safety turns 120 are the matrix defaults; the plan
  print shows them.
- `--world` takes the yaml path under
  `docs/adaptation-refinement/outcome-study-a1/worlds/`, not the bare id. The
  stub and the matrix search `config/drama-derivation/` for a bare id, and
  worlds 101 and 102 are not there. The §6.25 run passed the path in the same
  way. The trace records the id from the yaml, so the board reader is not
  affected. Found on 2026-09-05 when command A stopped before its first child
  started; no paid call was made. A zero-call dry run with the path form
  passed and hashed the world file. This is a fix to the run recipe, not a
  change to the study.

## Run record, kept in place

- 2026-09-05 12:36 UTC: command A started. The low_agency cell ran all 12
  dialogues to turn 8 with 0 licence violations. The analyzer seat (Sonnet 5,
  learner analysis) returned invalid semantic events three times on
  `board-r2` turn 8 and three times on `board_blind-r5` turn 3, so 94 of 96
  learner turns have an analyzer reading. The child sealed the cell
  `learner_analysis_incomplete` and exited 1, and the matrix stopped before the
  overconfident cell. No dialogue is re-run. The two turns count as unread on
  the fields the analyzer feeds; the public text of both turns stays in the
  reader packets. No admission ruling is written.
- 2026-09-05 12:51 UTC: the overconfident cell for world 101 started with
  `--profiles overconfident` and `--trace-dir
  exports/tutor-stub-live/scoreboard-crossed-2026-09-05/world-101-overconfident`.
  The matrix refuses a root that already holds a plan, so the cell has a
  sibling root. The plan print shows the same child command as command A:
  same seed 20260711, same budget, same world path, same models. Commands C
  and F take this root as one more `--traces` entry. Dialogue count is
  unchanged at 48.

- 2026-09-05 13:02 UTC: the world-101 overconfident cell ended with all 12
  dialogues at turn 8, 0 licence violations, 0 unread turns. Command B started
  at 13:02 UTC with both shapes for world 102.
- 2026-09-05 13:11 UTC: Kill 2 fired. In the world-102 permission-seeking
  cell the program read the board tutor as naming the answer with no right to
  close, in `board-r2` and `board-r4`, both at turn 6. The runtime ended both
  dialogues and failed their jobs; the cell sealed incomplete and the matrix
  stopped before the overconfident cell. The two spans come from a
  defect in the board reader: its sentence splitter breaks a sentence at a
  dash. The report describes it.
  No patch to the live run. The world-102 overconfident cell, command D, and
  the reader commands C, E and F did not run. 36 of 48 dialogues exist. Kill
  1 also fired on the zero-call score over those 36. Report:
  `notes/2026-09-05-scoreboard-crossed-run-report.md`. Paid calls made: 990
  of the 2,476 ceiling.
- 2026-09-05 15:52 UTC: the user said "Do that" in the chat to the next step
  the card names: run world 102 again in both shapes, then the reader seats.
  That word amends the study in one point. The world-102 cells run again
  under the board reader as fixed in PR #1044 (merge 2dc26da5). The first
  world-102 permission-seeking cell, 12 dialogues with two ended at turn 6 by
  the reader defect, stays on disk and in the archive. The report gives its
  zero-call numbers as a stopped block; it does not enter the score. The new
  cells use command B with `--trace-dir
  exports/tutor-stub-live/scoreboard-crossed-2026-09-05/world-102-rerun`,
  because the matrix refuses a root that already holds a plan. Same seed,
  same models, same budget, same world path; the plan print shows 24 rows.
  Ceiling for the two new cells: 960 calls; expected about 648. Command C then
  reads the 48 dialogues from `world-101`, `world-101-overconfident` and
  `world-102-rerun` with `--max-calls 192`. Commands D, E and F follow as
  written. The study's total hard ceiling rises from 2,476 to 3,436 calls;
  990 were spent before this word. Kill 1, Kill 2 and the indeterminate rule
  apply unchanged. Provenance at launch: main 9b1a64d2 plus this note commit, clean tree; each trace records the exact commit.
  Between the world-101 run commit 4b7a8362 and this commit the only tutor
  stub file that changed is the board reader, `services/tutorStubScoreboard.js`.

## After the run

1. `npm run archive:runs`, then commit in the private archive repo.
2. Write `notes/2026-09-05-scoreboard-crossed-run-report.md`. First line:
   which model held each seat and whether the second-model check ran. Then
   per-cell numbers, the two kill rules read, three quoted dialogues, what the
   paper may say. A conduct claim, never a learning claim.
3. Provenance: the runner writes the commit, the branch and the dirty flag
   into each trace's `run_start` event. The report copies them. Provenance is
   recorded, not enforced. The approval is to the study, not to a commit, a
   digest or a hash. There is no freeze, void or re-sign step.

## What this note does not license

- Step 3, the human seat. It stays on `a1-human-learner-validation`, gated on
  IRB approval. No pilot code is touched.
- Any edit to `docs/research/paper-full-2.0.md`.
- Any dialogue beyond the 48 plus the 8 of the second-model pair, or any
  reader call beyond the ceilings above.
- A re-run, a resample, a top-up, or a patch to a live run. The one
  exception is the world-102 rerun that the user's word of 15:52 UTC
  covers; see the run record.
- Any seat on nemotron or kimi.
- Any run through `services/retiredPaidLauncher.js` or through the §6.25
  reader runner with its approval ceremony.

Authorized by: Liam Magee, "Go" in the chat, 2026-09-05.
Recorded: 2026-09-05, before command A. No paid call had been made at that
point.
