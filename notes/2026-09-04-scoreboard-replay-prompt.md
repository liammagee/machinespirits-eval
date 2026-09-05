# Hand-off prompt: the public scoreboard, replayed and then run once

Date: 2026-09-04. Workplan item: scoreboard-reader-replay-and-crossed-run. For a fresh session in a clean
worktree of `machinespirits-eval` on `main` at or after the commit that adds
this file. Copy everything below the line into the new session as its first
message.

---

You work in `machinespirits-eval`. Read `CLAUDE.md` and `.claude/style-rule.md`
first. Speak and write in ASD-STE100 Simplified Technical English. Short plain
words, one idea per sentence, no epigrams, no coined compounds, no arrows, no
em-dashes. The rule applies to notes and commit messages too. Run
`node scripts/plain-speech-stop-hook.js --check-file <path>` on every note you
write before you commit it.

Your task has two steps. Step 1 costs no model calls. Step 2 is one paid run
and opens only if Step 1 passes. A third step, the human seat, exists in the
plan and is not yours. Do not start it, do not prepare it, do not touch the
pilot code under `services/pilotStore.js` or `routes/pilotRoutes.js`.

## What this is about

The paper (`docs/research/paper-full-2.0.md`, v3.0.304, §6.24 to §6.30)
studied five resistant learner shapes one at a time. Each study built its own
reader and its own endpoint. The blueprint of 2026-09-04
(`notes/2026-09-04-theoretical-blueprint.md`) and the plan
(`notes/2026-09-04-adaptive-tutor-plan.md`) say the five studies were all
reading one object without naming it: a public score of what each party has
claimed, earned, challenged, named, offered and been granted. We call it the
scoreboard. It extends the proof-DAG state the runtime already keeps (the
release ledger, the proof-debt ledger, the checker's forced entries) with a
standing column for both parties.

Your job is to build the reader for that score, replay it over the sealed
archives with no calls, test the pre-declared predictions, and, if they hold,
run one crossed live experiment where a tutor that reads the score meets the
same tutor that cannot see it.

## The schema

One row per turn. A reader marks only the events of the current turn, each
with a quoted span from the turn. The harness derives the state. Silence
changes nothing: a demand, a debt or a dispute stays open until a test
discharges it or the speaker withdraws it in words.

```
turn, speaker            (tutor | learner)
commitment_undertaken    proof-DAG node id, or other
entitlement_status       warranted | unwarranted | pending
challenge                issued | answered | defaulted | none   (either direction)
condition_named          proof-DAG node id, or other
test                     offered | accepted | declined | begun  (keyed to a node)
release, debt            premiseId, surface, sinceTurn
forced_entry             the node the checker forced this turn, or none
standing_dispute         open | settled
licence_in_force         the rights the tutor holds this turn
```

Do not add a field. If a field cannot be read from the text, the row says
`unread` in that field and the run reports the unread count. Do not tune the
schema on the data.

## Where the fields already come from

| board field | existing producer | file | status |
|---|---|---|---|
| turn, speaker, text | the turn record on each `turn_complete` row of the trace, normalised by the outcome-study scorer; the frozen-replay module extracts one turn from a trace | `scripts/tutor-stub.js`, `scripts/score-adaptive-warrant-outcome-study.js`, `services/tutorStubFrozenReplay.js` | reuse |
| commitment_undertaken | the commitment-transition test of the warrant gate core; the learner's own proof DAG snapshot, which says which nodes the learner has voiced or asserted | `services/adaptiveWarrantGateCore.js`, `services/dramaticDerivation/learnerDag.js` | reuse, key to node id |
| entitlement_status | the warrant gate's outcome per turn; the entitlement state of the derivation engine | `services/tutorStubWarrantGate.js`, `services/dramaticDerivation/learnerEntitlement.js` | reuse |
| challenge | the action family `challenge_resistance` in the outcome-study scorer; the defiant conduct reader's slots for the learner side | `scripts/score-adaptive-warrant-outcome-study.js`, `scripts/run-defiant-warrant-conduct-reader.js` | reuse tutor side; new reader for learner side |
| condition_named | rung 1 of the graded engagement rung, prose only | `services/tutorStubResistantLearnerSemanticRuntime.js` | new typed field |
| test | three separate marks: the learner's proposed test in the public learner analysis, the bounded-test non-delivery code in the resistant learner runtime, the defiant conduct reader's slot for a test offered under a condition (`conditional_frame_offer`) | `services/tutorStubPublicLearnerAnalysis.js`, `services/tutorStubResistantLearnerSemanticRuntime.js`, `scripts/run-defiant-warrant-conduct-reader.js` | new: one lifecycle over the three |
| release | the public release ledger, rows `{premise, turn, via, surface, fact}` | `services/tutorStubPublicLearnerAnalysis.js` | reuse |
| debt | the proof-debt view, rows `{premiseId, surface, sinceTurn}` | `services/dramaticDerivation/proofDebt.js`, `services/tutorStubProofDebt.js` | reuse, exact match |
| forced_entry | the symbolic checker's derivation distance over grounded facts, which says which node is forced this turn | `services/dramaticDerivation/slope.js`, `services/dramaticDerivation/assessment.js` | reuse |
| standing_dispute | the defiant conduct reader's slots, per turn only | `scripts/run-defiant-warrant-conduct-reader.js` | new: durable state under the silence rule |
| licence_in_force | the dose-3 licence flag on the manner card | `services/tutorStubMannerSwitch.js` | new: a registry, not a flag |
| row provenance, beside the row | the harness's card force at this turn, from the trace event `tutor_card_force`; the source instrument of each mark | `services/tutorStubCardForce.js` | reuse |

One existing module already keeps state under the silence rule for one
field. The public obligation ledger of the warrant gate
(`services/adaptiveWarrantPublicObligationLedger.js`) records a result the
learner asked the tutor to supply and discharges it only by a matching answer,
an accountable deferral, a transfer or a withdrawal. The board applies that
rule to every field.

Reuse these. Write one new event reader for the fields no instrument
produces (challenge, test, standing dispute) over public text only, with a
quoted span per mark. Do not write a numbered copy of any file (repo rule of
2026-09-03). Edit in place and commit.

## Step 1: replay over the sealed archives (zero calls)

Archives, by section:

All archives live in the private repo `../machinespirits-eval-private`, or
under `$EVAL_ARCHIVE_DIR` when that is set. Read it. Never write into it
during Step 1. Its run ledger is `RUN-LEDGER.md`. The replay reads
three storage formats:

- Format A: one folder per dialogue, `<ISO>.jsonl.gz` beside
  `<ISO>.jsonl.archive.json` (concatenated gzip members; the manifest
  carries the event count).
- Format B: one `traces.tgz` per job, which unpacks to `traces/<ISO>.jsonl`.
- Format C: unpacked `jobs/<id>/traces/<ISO>.jsonl`.

| section | learner shape | root under the private repo | dialogues | format |
|---|---|---|---|---|
| 6.25 | permission-seeking (profile id `low_agency`) | `artifacts/tutor-stub-live/.tutor-stub-auto-eval/adaptive-warrant-outcome-main-block-live-2026-08-13/dialogues/` | 72: 24 bare, 24 gated, 24 standing permission | A |
| 6.25 | the same | `artifacts/tutor-stub-live/.tutor-stub-auto-eval/adaptive-warrant-steering-decomposition-live-2026-08-14/dialogues/` | 48: gated and steering only | A |
| 6.26 | overconfident (profile id `overconfident`) | `artifacts/tutor-stub-live/.tutor-stub-auto-eval/guarded-learner-main-block-2026-08-15/` | 72, plus `warranted-shift-rate-reanalysis.json` and `late-presence-score.json` | A |
| 6.27 | bored | `artifacts/boredom-proof-dag-v5-live/`, `-v7-live/`, `-v8-live/`; each batch holds job dirs and a `combined.json` report | 35 reachable in v5; see the reports for v7 and v8 | B |
| 6.28 | bored (face A) and frame-refuser (face B) | `artifacts/tutor-stub-live/resistant-learner-merged-powered-v5-2026-08-26b/` with `report.json` | 216 jobs, 120 with `transcript.json` | C |
| 6.28 | frame-refuser rung calibrations | `artifacts/tutor-stub-live/frame-refuser-depth-gate1-2026-08-27`, `-v2-2026-08-27`, `-v3-2026-08-27`, `-v4-2026-08-27`, `-v5-2026-08-30` | 20, 36, 36, 48, 48 jobs | C |
| 6.29 | proof skipper, diligent, affective resistant; warm and sarcastic | `.tutor-stub-auto-eval/qa-matrix-2026-08-28T23-01-11-203Z`, `qa-matrix-2026-08-29T00-13-58-641Z`, `qa-matrix-2026-08-29T12-21-26-240Z` | 24 each: 12 warm, 12 sarcastic | B |
| 6.30 | defiant | `.tutor-stub-auto-eval/defiant-warrant-gate1-2026-08-29-r3/` with `conduct-reader.json` | 18 jobs, serving and withholding | C |
| 6.24 | oracle and router, typed cards, licence exception | none | 0 | absent |

The §6.24 dialogues are gone. The eval repo ignores `exports/`, and the
commit the section cites does not resolve. What survives of that line is the
hold and form-state work in the eval repo: `exports/tutor-stub-outcome/step6-form-v3-live`,
`step7-hold-live`, `step7b-hold-rework`, `step7c-hold-overconfident`,
`step7d-hold-memory-limited`, `step7e-hold-opus-tutor`, and
`exports/form-state-detector/step6a-traces/` (14 traces, labels in
`labels-2026-09-02.jsonl`). Use those for the typed quiet card check only.
No archive holds the licence exception, so no endpoint tests it.

Two hazards. The §6.28 satisfiable calibration sits only in a git worktree
flagged prunable, `/private/tmp/ms-frame-refuser-satisfiable-private`, and
eleven other prunable worktrees under `/private/tmp` hold run roots. Never
run `git worktree prune` in the private repo. Do not read that worktree for
Step 1; its 48 dialogues never reached their trigger and add nothing to the
shape test. Second, the paper's §6.27 and §6.29 name paths as if they were
in the eval repo; they resolve only inside the private repo.

Zero-call helpers already in the tree: `scripts/report-resistant-learner-powered-run.js --run-root <dir>`
reads `report.json` and writes nothing; `scripts/score-warranted-shift-rate-reanalysis.js --run <dir>`;
`scripts/summarize-tutor-stub-run.js <traceDir>`. Two scripts that look like
replays make live calls and are not for Step 1: `scripts/replay-hold-speech-check.js`
and `scripts/run-defiant-warrant-conduct-reader.js`.

Build:

1. `services/tutorStubScoreboard.js` (or the name the runtime's conventions
   give it): dialogue plus world file in, one board row per turn out. Join the
   instruments above; add the event reader. Every mark carries its span.
2. Tests over fixtures under `tests/`, with one recorded failure case per
   rule, so that a rule that cannot fail is caught in review.
3. `scripts/replay-scoreboard.js`: walks the archives, writes one board file
   per dialogue under `exports/scoreboard-replay/<run>/`, plus a summary.

Predictions, fixed here before you look at any board:

Shape signatures. With the cast label hidden, assign each dialogue a shape by
these rules and compare with the cast.

- Permission-seeking: the learner undertakes no commitment before a licence
  is in force, and issues no challenge, in at least six of eight turns.
- Overconfident: the learner undertakes commitments whose entitlement stays
  pending or unwarranted, and defaults on at least one challenge.
- Bored: no uptake, no commitment on any node, and rival content in at least
  two turns.
- Frame-refuser: a standing dispute open at turn 2 or earlier, at least one
  condition named, and every test declined.
- Defiant: a standing dispute open, a challenge issued by the learner, and no
  condition named.
- Cooperative (where the archive has a control): none of the above.

Endpoint 1, shapes separate: agreement with the cast at or above 0.8 across
the pooled archives, and no pair of shapes below 0.7 pairwise.

Endpoint 2, delivered moves show: the archives carry rulings that a tutor
move was delivered. In every dialogue with such a ruling, the board shows
the matching change at or after the move turn. The pairs are fixed here.

- §6.25 and §6.26: the warrant gate's per-turn log says a challenge fired.
  The board row shows a challenge issued by the tutor on that turn.
- §6.28: the powered run's report marks a delivered discriminating question
  on face A and, on face B, a condition the tutor names again. The board shows a test
  offered, and a condition named, on those turns.
- §6.30: the conduct reader's per-turn slots mark a scope statement or a
  test offered under a condition. The board shows the same in its challenge and
  test fields.

Rate at or above 0.8 pooled, and reported per section. Secondary, with no
test: over the hold exports of the §6.24 line, report whether the row at a
forced quiet card (trace event `tutor_card_force`) shows no release and no
new tutor commitment on that turn.

Secondary, reported with no test: re-run the §7.14 lattice over its frozen 122
objects with the board attributes added. The baseline is 0 of 7 figures
separated. Report how many separate now. Do not change the lattice's own
rules.

Kill: either primary endpoint under its bar closes the board as a detector.
Write the closeout note and stop. Do not proceed to Step 2. The board may still
serve as an endpoint record. That work belongs to a separate card, and that
card is not yours.

Write the Step 1 report as `notes/<date>-scoreboard-replay-report.md`. First
line: PASS or FAIL against the two bars. Then the numbers per archive, the
unread count per field, the three worst disagreements quoted with their spans,
and the lattice result. Quote real rows beside their turns in every
explanation.

## Step 2: one crossed live run (paid, opens only on PASS)

Design, mirroring §6.25 and §6.26.

- Runtime: the live tutor stub in this repo. The pinned runtime of
  earlier arcs, `../ms-phase5-pinned`, no longer exists. Launch through the
  QA-matrix runner. It crosses named tutor
  policies with named learner profiles, and it prints its plan with no
  call:

  ```bash
  node scripts/run-tutor-stub-qa-matrix.js --policies <board_policy>,<blind_policy> --profiles low_agency,overconfident --runs 12 --turns 8 --model claude-code.claude-sonnet-5 --model-call-budget <n> --trace-dir <new dir> --print-plan
  ```

  The board tutor is a new policy registered in
  `scripts/tutor-stub-policy-suites.js` and the response-policy runtime.
  The blind tutor is the same policy with the board input removed. The
  learner profiles live in `scripts/tutor-stub-learner-profile-contracts.js`;
  `low_agency` is the §6.25 learner and `overconfident` is the §6.26
  learner. Do not use the launchers listed in
  `services/retiredPaidLauncher.js`; they refuse to launch. Do not re-enter
  their reviewer-note admission machinery. The repo rule of 2026-08-21 bans
  it.
- Worlds: two, the same two the §6.25 run used. World-101 is the kestrel
  signal lamp and world-102 is the marigold archive box.
- Dialogues: eight turns.
- Learners: the permission-seeking learner and the overconfident learner, each
  cast as a policy over the board, not as a voice. Preflight produces each
  shape's trigger from the board with no model call, or the cast fails at
  preflight and you stop.
- Tutor conditions: the tutor whose move table reads the board, against the
  same tutor with the board hidden from it. Same prompt otherwise. Same seed
  schedule.
- Cells: 2 shapes × 2 tutor conditions × 12 dialogues = 48 dialogues.
- Models: codex `gpt-5.6-luna` or claude-code Sonnet 5 in every seat.
  Never nemotron/kimi in any seat. Then one pair of about 100 calls per arm
  with Opus 5 or codex Sol in the tutor seat, and a few reader calls on Opus
  or Fable, so the result is not bound to the first model.
- Readers: two reader seats over all 384 turns; the board reader is the
  program, the model readers rule delivery and decision correctness.

Endpoints, fixed here:

- Board change on each shape's own channel. Permission-seeking: a commitment
  undertaken with no licence in force. Overconfident: an entitlement status
  that moves from pending to warranted after a challenge.
- Decision correctness by the reader consensus method of §6.25.
- Warranted shift share by the method of §6.26.

Predicted direction: the board tutor above the blind tutor on both channels.

Kill: the board tutor does not beat the blind tutor on either channel. Also a
kill: any dialogue where the board tutor issues a move whose licence is not in
force, as read by the program. That is a defect. A defect stops the run; do
not patch a live run.

Rules for the run:

- Write a short GO note in the house shape (see
  `notes/2026-09-03-tutor-stub-action-outcome-model-judge-shadow-v2-go.md`
  for the shape): what is licensed, the planned calls, the hard ceiling that
  fails before the call, retries 0, and what the note does not license. Record
  provenance: the commit, the tree, and whether the checkout was dirty. Do not
  bind the approval to a commit, a digest or a hash, and do not build any
  freeze, void or re-sign machinery. The user's word "go" in the chat covers
  the study; a bug fix does not void it.
- Attended. The user says go before the first paid call. Spend ceiling stated
  and enforced before the call. No resampling after a failure. No top-up. No
  self-judging: the tutor's model never scores its own dialogue. Indeterminate
  means stop.
- Estimated calls: 48 × 16 for generation, about 768 for two reader seats,
  about 200 for the second-model pair. State the exact figure in the GO note
  from the launcher's `--print-plan` output, not from this estimate.
- After the run, first `npm run archive:runs`, then commit in the private
  archive repo, then write the report.

Write the Step 2 report as `notes/<date>-scoreboard-crossed-run-report.md`.
First line: which model held each seat and whether the second-model check ran.
Then the per-cell numbers, the results of the two kill rules, three quoted dialogues (one
where the board tutor won, one where it lost, one licence check), and what the
result licenses the paper to say. The result is a conduct claim. It is never a
learning claim.

## What to hand back

1. The board reader, its tests, the replay script, and the reports, on one
   branch off `main`, named `claude/scoreboard-replay`.
2. Commits with the trailer `Workplan-item: scoreboard-reader-replay-and-crossed-run` and the attribution
   trailer `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
3. `npm run lint:all`, `npm test`, `npm run test:ratchets` and
   `npm run wp:source-check` green. Self-heal mechanical failures without
   asking; stop on anything that touches the design, the ceiling or the
   endpoints.
4. Update the card `workplan/items/scoreboard-reader-replay-and-crossed-run.md` (status, verification,
   links to the notes and the run ids). Never stage `workplan/BOARD.md` or
   `workplan/board.json`.
5. Open the PR with the house wrapper and report the URL:

```bash
npm run pr:create -- --title "scoreboard: reader, replay and crossed run" --workplan scoreboard-reader-replay-and-crossed-run
```

The PR body ends with the line `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
Do not edit `docs/research/paper-full-2.0.md` in this session. The paper
fold-in is a separate card after the reports are read.
