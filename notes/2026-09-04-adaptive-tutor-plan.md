# One adaptive tutor: the plan from here

Date: 2026-09-04. Companion to `notes/2026-09-04-theoretical-blueprint.md`.
Inherits from `docs/research/paper-full-2.0.md` at v3.0.307. Originates no
empirical claim. It names the work between the current standpoint and one
tutor that adapts to resistant learners, in phases with gates. Live work is
carded: `scoreboard-reader-replay-and-crossed-run` for Phases 0 and 1, `one-adaptive-tutor-plan-line` for the line as a whole, and `a1-human-learner-validation` for the human seat. The paper stays the single paper; each phase folds into
sections named at its end.

## 0. The destination, stated so it can fail

One tutor. One dialogue. Five resistant shapes and the cooperative learner,
cast from one schema, met in the same session, with no prompt for each shape chosen
by hand before the run. The tutor keeps a public score of what each party has
claimed, earned, challenged, named, offered and been granted. It adapts on that
score: it grants, withholds, challenges and releases at the time the score
calls for. A program reads the endpoint from the score. A human seat follows.

Three words in that sentence get definitions, so the plan can fail on each.

- **Adaptive** means the three sorting questions of the blueprint answer yes:
  the tutor's move keys to a structure the model cannot infer from the
  transcript; the move changes standing or timing, not manner; the endpoint is
  a change in a record a program checks. A tutor that changes tone by learner
  type is not adaptive in this sense, and the paper's §6.29 shows why.
- **Comprehensive** means coverage of a stated set of shapes, worlds and model
  stacks. It does not mean a rubric maximum. The tutor is comprehensive when no
  shape loses more than a stated margin on its own channel against the best
  specialist tutor the project built for that shape (§6.24 to §6.28). The
  margin is stated before the run. The tutor may lose a dialogue. It must not
  lose the score.
- **One** means one runtime, one move table, one detector, one schema for the
  learner cast, and one endpoint program. It does not mean one prompt. The
  tutor stub already composes several guards; §6.14 showed that stacking
  more mechanisms on one reply pays less each time, so composition happens on
  the score and the schedule, not in the prompt.

Excluded from the destination: a learning claim. The board records conduct and
standing. Learning is claimed only from the human seat and from a transfer
instrument, and §6.24's cold-baseline result says the conduct key cannot show
it. The plan does not confuse the two.

## 1. Where we stand

**Proven and reusable.** Each entry has a section and a number; each answers
yes to the three questions.

| asset | what it does | section | evidence |
|---|---|---|---|
| pacing guard | holds the next premise until the last landed | 6.13.10 | grounds 4/5 on the frozen recipe; page-only guard matches it |
| proof-debt guard | carries `{premiseId, surface, sinceTurn}`, nothing else | 6.13.10 | removes early-pull death in the guarded arms |
| prosecutor charter | binds a procedure to an event, not a clock | 6.13.8, 6.13.18 | defended 2/2 against bare template 0/2 |
| repair clause | one-step rule at the race the plan loses | 6.13.9 | grounded t20 against plan aporia t8 |
| typed quiet card | a card that names the state, not the voice | 6.24 | 14/18 against 10/18 untyped |
| licence exception inside the contract | one sentence that changes rights | 6.24 | 6/6 frozen against 0/6 contract alone |
| live warrant gate | steers every turn from turn 1 | 6.25, 6.26 | breaks 19/24 vs 10/24; warranted shifts 40.8 vs 17.8 |
| delivered discriminating question | re-engages the bored learner | 6.28 | 45/49 re-engage |
| form-v3 detector | reads closed-class form, no calls | 6.24 | 231/295 on world 030; 16/24 on unseen lesson worlds |
| stance classifier crossed with the DAG | reads chain-level stance | 6.13.19 | 87.2% |
| oracle and router | detector plus card table equals the oracle | 6.24 | 11/12 vs 12/12 |

**Instruments that already produce board fields.**

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

**Learner casts.** Five shapes have a working cast.

- The permission-seeking learner, §6.25.
- The overconfident learner, §6.26, under persona contract v3.3.
- The bored learner, §6.27 and face A of §6.28.
- The frame-refuser, face B of §6.28.
- The defiant learner, §6.30.

Two limits carry forward. The cast pins voice and not state (§6.26). A learner
told to sound hesitant broke deference in 19/24 gated dialogues. A cast whose
trigger depends on the dialogue may never produce it. The satisfiable-condition
design stopped in all 48 dialogues because the trigger never appeared (§6.28).

**Sealed archives.** All sealed dialogues sit in the private repo
`../machinespirits-eval-private`, in three storage formats: one gzip file per
dialogue, one tar file per job, or unpacked traces. By section: §6.25 holds
72 plus 48 dialogues of the permission-seeking learner; §6.26 holds 72 of the
overconfident learner; §6.27 holds the bored-learner batches of v5, v7 and v8
with their combined reports; §6.28 holds the powered run (216 jobs, 120
transcripts) and five rung calibrations of 20 to 48 jobs; §6.29 holds three
cells of 24, half warm and half sarcastic; §6.30 holds 18 jobs with the
conduct read. The §6.24 dialogues are gone. The eval repo ignores `exports/`,
and only the hold and form-state exports of that line survive. The exact
paths are in the hand-off prompt. One fragility: the §6.28 satisfiable
calibration and eleven other run roots sit in git worktrees flagged prunable
under `/private/tmp`, and one `git worktree prune` in the private repo deletes
them.

**Readers and the reporting rule.** Model readers sit in Sonnet 5, Opus 5,
codex Luna and codex Sol. A result first seen with Sonnet 5 or Luna in a seat
is bound to that model until one Opus 5 or Sol run in the same seat repeats it
(model-bound rule). Readers agree at κ=0.69 on state (§6.24); on cumulative
counts they drift apart with every turn (review of 2026-09-04, below).

**Closed lines.** Each stays closed under this plan. No card in this plan
re-runs any of them.

- The trajectory null, §6.3 and A12. Effect d at or under 0.15 at N=432.
- Theory-of-mind and state-schema scaffolds, §6.8.5, §6.8.6 and §6.10. The
  interior is not recoverable from the page.
- The adaptive-state sensor program, §6.19. Same reason.
- The strategy ledger, the outer loops and the selector, §6.13.15 to §6.13.17.
- The register router, §6.13.19.
- The green room, §6.16. Cited 3/17.
- Composition by stacking, §6.14. Each added mechanism paid less.
- The bored-learner action and register series, §6.27.
- The frame-refuser depth line and its two successors, §6.28.
- The edged register with the moves frozen, §6.29.
- The defiant withholding control, §6.30. The model cannot produce that arm.
- The dramatic transfer, §7.9.

## 2. What the theory tells us to build

The blueprint states recognition as a scorekeeping act with four parts. Each
part is a subsystem the runtime already half has.

| part of the act | theorist | subsystem | what exists | what is missing |
|---|---|---|---|---|
| standing | Honneth (rights), Weber (the tutor's own standing) | the licence layer: what the tutor grants, withholds, and the jurisdiction it holds | licences in the contract (§6.24); the warrant gate (§6.25); the conduct gate (§6.30) | licences are not logged as state; jurisdiction disputes are read by hand |
| content | Hegel, Brandom | the proof DAG with a commitment column per party | the DAG, the release ledger, the checker's forced entries (§6.13) | who has claimed which node, and whether the claim is entitled or pending |
| time | Aristotle | the harness clock: due lines, debt, arming, challenge timing | due line (§6.23), proof-debt (§6.13.10), sensor arming (§6.25) | the clock does not read a shared board; each guard keeps its own |
| uptake | Hegel, Honneth (esteem) | the endpoint: a learner-side change in the score | warranted shifts (§6.26), rung reader (§6.28), decision correctness (§6.25) | one program over one record, instead of one reader per arc |

Two more parts sit beside the four.

- **The second seat (Freud).** The superego reads the board, not the reply. The
  error-correction result (§6.2, §6.4) says a second seat pays when it corrects
  content with the ego holding authority. A second seat that reads the board
  can veto a move whose licence is not in force, or whose target node is
  already entitled. It does not need a third seat; §6.14 prices that.
- **Manner (Goffman).** Manner is measured as leak and reported, never as a
  lever. §6.29 fixed that: warm and sarcastic deliveries of the same moves gave
  the same coverage. The tutor's own face is a design boundary: it cannot
  withhold the warrant of its frame (§6.30, §7.16), so no arm in this plan asks
  it to.

The board is where the four parts meet. The proof DAG already records content
and time for the tutor. The board adds standing and uptake, for both parties.

## 3. The scoreboard, refined

The blueprint's schema, with two refinements from reading today's review of
the frame-refuser narrowing construct (`notes/2026-09-04-frame-refuser-narrowing-construct-review.md`).

1. **Key to the DAG.** A commitment or a named condition is keyed to a proof-DAG
   node id where one applies, and to `other` where none does. The review found
   that readers split one learner sentence into one or two demands; a fixed
   list per world removes that split. The world file already holds the list.
2. **Silence changes nothing.** A demand, debt or dispute stays open until a
   test discharges it or the speaker withdraws it in words. A reader marks only
   the current turn's events, each with a quoted span. The harness derives the
   state. The review found that three fifths of the demand mismatches and seven
   eighths of the concession mismatches between reader seats were about turns
   where the learner said nothing about the item. Under this rule those turns
   produce no mark and no mismatch.

§7.14 gives the board its second reason. On 122 carded turns, no figure
separated on the features the harness logs. Of the five makeup dimensions the
ontology names, dose and rights were near-constant and act, register and
footing were not logged at all. The board logs act as commitment, challenge and
test. It logs rights as the licence in force. It logs footing as the standing
dispute. Whether the
figures then separate is a zero-call test on the same corpus, and it is in
Phase 0.

The schema:

```
turn, speaker
commitment_undertaken    node id or other      (learner-record extractor, §6.26)
entitlement_status       warranted | unwarranted | pending
                                               (warrant gate analysis layer, §6.25)
challenge                issued | answered | defaulted | none, both directions
condition_named          node id or other      (rung reader naming tag, §6.28)
test                     offered | accepted | declined | begun, keyed to a node
release, debt            premiseId, surface, sinceTurn   (proof-debt ledger, §6.13.10)
forced_entry             S or a lemma forced by the checker
standing_dispute         open | settled        (defiant conduct gate, §6.30)
licence_in_force         the rights the tutor holds this turn (§6.24)
```

## 4. The phases

Each phase has build items, an endpoint a program reads, a kill rule, and a
cost in calls. Zero-call work comes first in every phase. A phase opens one
card; the card names its endpoint before any call.

### Phase 0. The board reader over sealed archives (zero calls)

Build: a reader that turns a stored dialogue plus its world file into one board
row per turn, by joining the existing instruments listed in §1 and adding one
event reader for challenges, tests and disputes over public text. Tests over
fixtures. A replay over the §6.24 to §6.30 archives.

Endpoints, fixed now:

- Shapes separate. With the cast label hidden, a fixed rule per shape (written
  in the hand-off prompt, not tuned on the data) assigns each dialogue a shape
  from its board rows. Agreement with the cast at or above 0.8 across the
  pooled archives, and no pair of shapes below 0.7 pairwise.
- Delivered moves show. In every dialogue where the readers ruled a move
  delivered, the board shows the matching change at or after the move turn
  (a licence appearing, a challenge issued, a test offered, a condition named
  back). Rate at or above 0.8.
- Secondary, reported without a test: the §7.14 lattice re-run with board
  attributes added, on its frozen 122 objects. Baseline 0 of 7.

Kill: either primary endpoint under its bar closes the board as a detector.
The board may still serve as an endpoint record; that is a separate card.

Cost: zero model calls. One worktree. Hand-off prompt: `notes/2026-09-04-scoreboard-replay-prompt.md`.

### Phase 1. One crossed live run, two shapes

Design, mirroring §6.25 and §6.26: the live tutor stub through the QA-matrix
runner, since the pinned runtime of earlier arcs is gone; two worlds; eight-turn dialogues; the permission-seeking learner and the overconfident
learner, each cast as a policy over the board (the trigger is produced at
preflight with no call, or the cast fails there); two tutor conditions, the
tutor whose move table reads the board against the same tutor with the board
hidden from it; 12 dialogues per cell, 48 in all.

Endpoints. First, a board change on each shape's own channel. For the
permission-seeking learner that change is a commitment undertaken with no
licence in force. For the overconfident learner it is an entitlement status
that moves from pending to warranted after a challenge. Second, decision
correctness by the reader consensus method of §6.25. Third, the warranted
shift share of §6.26. Predicted direction: the board tutor above the blind
tutor on both channels.

Kill: the board tutor does not beat the blind tutor on either channel. Also a
kill: any dialogue where the board tutor issues a move whose licence is not in
force, read by the program. That is a defect, and a defect stops the run.

Model-bound rule: Sonnet 5 or codex Luna in the seats; one pair of about 100
calls per arm on Opus 5 or codex Sol in the tutor seat; a few reader calls on
Fable or Opus. Reported as bound to the first model until the check runs.

Cost: about 48 dialogues × 16 generation calls, plus two reader seats over
384 turns, plus the second-model pair. Ceiling set in the go. Attended. No
resampling after a failure. Indeterminate means stop. `npm run archive:runs`
at the end.

### Phase 2. One tutor, all shapes

Opens only if Phase 1 passes. The same tutor, one world family, all five
shapes plus the cooperative learner, cast from the schema, each shape in its
own dialogues first (the tutor does not know which). Comparison: the best
specialist tutor per shape from §6.24 to §6.28, and the naive baseline
(cell 71, `config/tutor-agents.yaml`).

Endpoint: no shape loses more than the stated margin on its own channel
against its specialist; the licence check reads zero violations. Margin
stated in the card before the run.

Kill: a shape loses by more than the margin, and the loss is on the channel
where the specialist's move was proven. That shape's move goes back to the
move table as a separate card; the tutor does not widen its prompt.

### Phase 3. Transfer: worlds, stacks, authors

The lesson-worlds bench (worlds 038 to 043) and one unseen world family. The
author confound is a planned cross: dialogues generated on Claude and on codex,
read on the other. The model-bound check at each seat.

Endpoint: the Phase 2 margins hold on the unseen worlds. Kill: they do not, on
the same channels. This is the phase where "comprehensive" is either earned or
bounded to named worlds.

### Phase 4. The human seat (gated)

The pilot infrastructure exists (`services/pilotStore.js`, `routes/pilotRoutes.js`,
workplan card a1). The board makes a human transcript readable by the same
program as a simulated one. This is the only door to a learning claim. It stays
gated on IRB approval, real consent text and real item content. Nothing in
Phases 0 to 3 waits on it, and nothing in it waits on Phase 3.

### Phase 5. The paper and the surfaces

Per the blueprint's §9: §3 gets the scorekeeping paragraph; §7.12 and §7.16
get the three questions; Appendix E gets the deontic layer; `/theory` gets the
wins-and-losses panel; `HOW-TO-BUILD-A-TUTOR.md` gets the sixth rule. Each
phase's result lands in the existing section it extends, with a version bump.
No new paper.

## 5. How we go faster without more churn

- **Zero calls first.** Every instrument runs on sealed archives before a paid
  call. A defect found in replay costs a worktree; the same defect found live
  costs the run (§6.27, five recorded instances).
- **One schema, one interface.** The board schema is the only contract between
  tutor, learner cast, harness and readers. Parallel agents work in lanes
  (reader, tutor move table, learner cast, harness clock, paper) and meet at
  the schema. A lane may not change the schema without a card.
- **Three questions at the card stage.** A proposed run that answers no to any
  of the three questions is refused before it is designed. This is the rule
  that stops the next register study and the next sensor.
- **Reuse before rebuild.** The live tutor stub, the move library, the readers
  and the archives are the assets. A new numbered copy of any of them is banned
  (repo rule of 2026-09-03).
- **The rails that cost nothing.** Spend ceilings, attended runs, no resampling
  after a failure, no self-judging, indeterminate means stop. No approval bound
  to a commit or a digest (repo rule of 2026-08-21).
- **One synthesis note a week.** Each new result is placed in the blueprint's
  tables (carries weight, or refused, and on which question). The `/theory`
  panel renders the tables. The board of 610 cards is read through them.

**The stop list.** Work this plan does not fund: register studies where
register cannot change move selection or timing; prompt for each shape tuning;
new sensors of the interior; new outer loops or selectors; a third seat;
re-runs of any closed line; a spin-off paper.

## 6. Risks, and the answer fixed now

| risk | where it bit | the fixed answer |
|---|---|---|
| a registration binds the run only where the code reads it | §6.27, five instances | every board field a study names is read by the generating path and by a floor over delivered text; a preflight fails if any named field is unread |
| the judge ranks the never-adapting tutor top | §6.24 | the endpoint is a board change read by a program; rubric scores are reported, never the endpoint |
| the cast is a voice, not a state | §6.24, §6.26 | the learner is a policy over the board; preflight produces the trigger or fails |
| the trigger never appears | §6.28, 0/48 | same |
| the model cannot produce the control arm | §6.30, §7.16 | no arm asks the model to be less helpful than its training; delivered conduct is checked before scoring |
| the author confound | critic mirror result | Phase 3 crosses generator and reader models |
| reader drift on cumulative counts | review of 2026-09-04 | readers mark current-turn events with spans; the harness keeps the state |
| a floor that cannot fail | §6.27 | each floor has a recorded failure case in its tests |
| agentic overrun | §7.15 | regression tests, not gates; the two repo rules |

## 7. What each gate lets us say

- After Phase 0: the resistant shapes are signatures on a public score, on
  sealed simulated dialogues. Development-tier. No tutor claim.
- After Phase 1: a tutor that reads the score moves two shapes on their own
  channels, on one stack, two worlds. Bound to the model until the check runs.
  Outcome, 2026-09-05: not licensed. The run closed on its kill rule (1 of 12
  against 1 of 12; 5 of 12 against 6 of 12). What the paper says instead, in
  §6.31: a tutor whose moves the board licenses made no move outside its
  licence in 192 audited turns where the blind tutor made three. A conduct
  fact on one stack. Phase 2 does not open on this result.
- After Phase 2: one tutor meets five shapes within a stated margin of the
  specialists, on one world family. This is the first claim of one adaptive
  tutor, and it is a conduct claim.
- After Phase 3: the same, on unseen worlds and a second stack.
- After Phase 4: the first learning claim, if any, and only there.

## 8. Cards

| card | phase | status | opens when |
|---|---|---|---|
| `scoreboard-reader-replay-and-crossed-run` | 0 and 1 | done, Kill 1 fired | closed 2026-09-05; folded into §6.31 |
| `one-adaptive-tutor-plan-line` | all | triaged | now; holds this plan and the gate record |
| Phase 2 card, one tutor for all shapes | 2 | not written; does not open | the Phase 1 report reads FAIL on its outcome rule |
| Phase 3 card, transfer | 3 | not yet written | the Phase 2 report reads PASS |
| `a1-human-learner-validation` | 4 | blocked | IRB approval, real consent text, real items |
| `scoreboard-crossed-run-paper-fold` | 5 | done | the Phase 0 and Phase 1 reports; §6.31 at v3.0.307 |
| further Phase 5 cards, framing folds | 5 | not yet written | the blueprint's §9 list; one card per fold, on the user's word |

Each new card names its endpoint and its kill before any call, links the
report note it consumes, and names the paper section it folds into. A card
that answers no to any of the three sorting questions is refused at triage.
