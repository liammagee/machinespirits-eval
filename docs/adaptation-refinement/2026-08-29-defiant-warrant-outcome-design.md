# Defiant-Learner Warrant Study — DRAFT FOR HUMAN REVIEW

**Prepared:** 29 August 2026.
**Status:** draft registration. Zero model calls are made or licensed by
this document. The Gate-1 pilot runs only on the operator's plain GO.
**Workplan item:** `defiant-warrant-outcome-study`.

Authorization follows the 2026-08-21 hard rule. The operator's GO covers
the study — question, design, measurement rules, spend ceiling — and
stays valid until the study changes. A code-defect fix does not void it.
Provenance (commit, tree, dirty flag) is recorded at launch, never
enforced. There is no digest binding and no re-approval ceremony.

## 1. Question

The frame-defiant learner disputes the tutor's standing to set the frame
while still engaging one bounded test per turn. In the sealed held-out
baseline it also asks, nearly every turn, for the warrant of the frame
itself: "what makes this assay's frame binding?", "what would distinguish
access from the hand that struck it?". The learner runs a standing
warrant demand at the tutor.

Question: does a tutor that **serves that warrant** — states plainly what
the assigned test can and cannot establish, and offers the frame as
conditional on that scope — settle the frame and unblock the proof,
against a tutor that **presses the test without grounds**?

This inverts §6.26 (tutor demands warrants from an overconfident
learner). Here the learner demands them from the tutor.

## 2. Baseline facts (P0, zero-call, sealed data)

Source: the archived resistance-axis held-out run of 2026-08-19
(instrument gate PASSED; frame-jurisdiction dispute 14/24 = 0.583 over
the 0.40 floor, present by turn 2 in every dialogue, non-target maximum
0.000). Three frame_defiant dialogues, 8 turns each, world 005 Marrick,
field policy, strict DAG, Luna all seats.

Read of all 24 learner turns from the archived traces:

- 24/24 turns pair a jurisdiction dispute with a bounded merits
  engagement ("I will test the coin's metal, but I do not accept your
  authority to make that test the binding route to attribution").
- 0/3 dialogues settle the frame. Every dialogue ends with the dispute
  standing and the final attribution step refused or still conditional.
- The learner walks the evidence chain anyway (weight, alloy, crucible
  match, die flaw, graver, striking hand) while disputing each link's
  bindingness.
- First merits engagement is turn 1-2 in all three dialogues.

Channel-room conclusions:

- Dispute rate and merits engagement are near ceiling. Dead as endpoints.
  Descriptive only.
- Frame settlement is at floor (0/3) but not pinned shut: the persona
  contract forbids conceding "merely because the tutor explains the
  governing principle again" and allows one full repair per 8 turns. A
  warrant that is more than a re-explanation is exactly the treatment.
- DAG coverage has room: the contract expects coverage
  "blocked_until_frame_distinction". The strict DAG gives this channel a
  machine check with no reader in the loop.

## 3. Design

- **Learner:** `frame_defiant` (validated instrument, unchanged contract).
  Not `frame_refuser` — that learner and its cards belong to another
  session and share nothing with this study.
- **World / harness:** world 005 Marrick, tutor-stub field policy, strict
  DAG, 8 turns, safe register palette. Same pins as the instrument gate.
- **Arms (2):**
  - `warrant_serving`: at a jurisdiction dispute, the tutor answers the
    standing question directly — names what the assigned test can and
    cannot establish, and proceeds with the frame stated as conditional
    on that scope.
  - `warrant_withholding`: at a jurisdiction dispute, the tutor presses
    the assigned test and restates the task without granting the scope
    question. No mockery, no register change; manner stays warm/plain in
    both arms so only the warrant conduct differs.
- **Delivered-conduct rule:** arm membership is read from the tutor's own
  delivered text by a reader with a written codebook, never from the
  assignment. Fidelity floors are set from Gate-1 numbers, not guessed.
- **Driver surface:** a new small treatment seam on the stub field
  policy. The closed warrant-outcome driver is not extended (amendment
  2026-08-18). The Phase-4 study-only seam pattern of 2026-08-19 (typed
  move chosen before register, legacy path untouched) is the model.
- **Models:** codex.gpt-5.6-luna for tutor, learner, and analysis seats;
  claude-code Sonnet 5 for the conduct reader. Never nemotron/kimi.

## 4. Endpoints

Named now so the registered number that must move is in writing; numeric
thresholds are frozen after Gate 1 measures the baselines.

- **Co-primary A — frame settlement (dialogue-level binary):** the
  dialogue contains a full-repair event — the learner performs an
  assigned test without restating the jurisdictional objection, or
  explicitly grants the frame's standing. Expected direction: higher
  under `warrant_serving`. Baseline 0/3 sealed dialogues; contract
  ceiling one event per 8 turns.
- **Co-primary B — strict-DAG coverage at turn 8:** machine-checked, no
  reader. Expected direction: higher under `warrant_serving`.
- **Registered secondary — escalation guard:** per-turn dispute rate,
  late window (turns 5-8) minus early window (turns 1-4), by arm. The
  design doc's risk (b) says challenge can escalate; this measures it
  instead of avoiding it.
- **Descriptive only:** bounded-claim events, first-merits-engagement
  turn, dispute wording drift.

If the mechanism works, the number that moves is co-primary A: more
warrant-served dialogues settle the frame than warrant-withheld ones,
with co-primary B showing the unblocked proof behind it.

## 5. Phases and spend

- **P1 (zero-call):** build the seam, write the conduct codebook, mock
  smoke (`ADAPTIVE_TUTOR_LLM`-style mock where applicable). Free.
- **Gate 1 — calibration pilot (paid, after plain GO):** 18 dialogues,
  2 arms x 9, 8 turns, fresh seed. Measures: delivered-conduct fidelity
  per arm, frame-settlement base rates, DAG coverage means and spread,
  escalation trend. Ceiling: 48 model attempts per dialogue, 864 total
  generation attempts, plus a reader budget capped at 400 calls.
  Attended run, no resampling after a failure, indeterminate means stop.
- **Freeze:** main-block thresholds, floors, and power scan are written
  from Gate-1 numbers. If a registered channel is dead in the pilot
  (settlement 0/9 in both arms, or fidelity floors unreachable), the
  study re-registers or closes; it does not push on.
- **Gate 2 — main block (paid, after second GO):** sized from Gate 1,
  bounded by the profile doc's cost shape (about 1,850 generation and
  1,150 reader calls at most).
- **Closeout:** paper section in `docs/research/paper-full-2.0.md` under
  the single-paper discipline; `npm run archive:runs`; private-repo
  commit.

## 6. What this study cannot show

A positive settles only that serving the frame's warrant changes this
simulated learner's conduct under this stub and these pins. It does not
show transfer to humans, to the cell harness, or to any other resistant
profile, and it licenses no claim about register or tone — manner is held
fixed by design.

## 7. Design revision 2 — structural conduct enforcement (2026-08-29)

The v1 Gate-1 run (`.tutor-stub-auto-eval/defiant-warrant-gate1-2026-08-29-r3`)
completed 18 dialogues, but the blind Sonnet conduct reader found the
withholding conduct delivered in **0 of 8** read dialogues. The standing
conduct card was injected on every turn and read by no code on the
generating path; instruction alone could not subtract the tutor model's
default prosocial conduct. The v1 outcome numbers are uninterpretable
and license nothing. No threshold was frozen. The frame-refuser v4
lesson repeats: every registered instruction must be read by code on the
generating path.

Revision 2 (`config/tutor-stub-defiant-warrant-outcome-pilot.v2.json`)
adds a **conduct gate** at the same orchestration seam as the proven R1
tutor-delivery gate:

- **Trigger (deterministic):** the current learner turn carries
  `resistantLearnerObservationMarkers.frameJurisdictionDispute` — the
  same instrument the outcome measures use.
- **Check (semantic):** the private tutor candidate is adjudicated
  against the assigned arm's registered conduct by seat
  `codex.gpt-5.6-sol` at effort low. The seat is neither the generating
  model (`codex.gpt-5.6-luna`, so no self-judging) nor the post-run
  conduct reader (`claude-code.sonnet-5`, so the delivered-conduct
  instrument stays independent of the enforcement).
- **Evidence contract:** a verdict on the arm's quote-required label
  must quote a verbatim substring of the candidate; any other verdict
  must return quote null. A malformed or unverifiable verdict stops the
  dialogue as a typed indeterminate
  (`tutor_stub_defiant_warrant_conduct_adjudication_indeterminate`); it
  never passes open.
- **Repair:** up to 2 repairs per gated turn with the registered
  per-arm repair instruction plus the adjudicator's quoted violation
  span. Exhaustion emits `defiant_warrant_conduct_non_delivery` and
  throws the typed terminal code
  (`tutor_stub_defiant_warrant_conduct_non_delivery`): never scored,
  measurement indeterminate, no resample.
- **Symmetry:** both arms pass through the same machinery on the same
  trigger; only the registered question and repair text differ.
  Rejected drafts never enter public history and the learner is never
  charged a turn for them.

Budget consequences, registered up front: gate adjudications and repair
regenerations are metered model calls on the same per-dialogue budget,
so the per-dialogue cap rises from 48 to **72** (v1 mean was ~29; the
worst gated turn adds up to 5 calls on up to ~4 dispute-adjacent turns)
and the pilot generation ceiling becomes **1,296** attempts (72 x 18).
The reader budget stays 400. Under v2 the reader pass is a
delivered-conduct confirmation of the enforcement, not an independent
discovery instrument; its model independence from the gate seat is what
keeps it worth running.

The v2 re-run uses a **fresh master seed (20260830)**. The v1 attempt
froze nothing and none of its outcomes are reused, so this is a new
Gate-1 attempt, not a resample of a measured one. Everything else in
sections 1-6 stands unchanged: question, arms, endpoints, exclusions,
attended-run and indeterminate-means-stop rails, and the Gate-1 to
freeze to Gate-2 sequence. The operator's plain GO covers this study
and the structural-enforcement path was chosen by the operator in plain
words; per the 2026-08-21 rule, no re-approval ceremony attaches to
this revision.

## 8. Gate-1 v2 outcome — structural stop, study closed (2026-08-30)

The v2 run (`.tutor-stub-auto-eval/defiant-warrant-gate1-v2-2026-08-29`,
master seed 20260830) completed cleanly: 18 of 18 dialogues terminal,
~17 minutes wall clock, launcher exit 0, artifacts archived in the
private repo.

**Warrant-serving: 9 of 9 measured.** The conduct gate checked 38
disputed turns; 5 needed one repair each and every repair passed on the
first attempt; 0 stops. One dialogue settled the frame (first
settlement at turn 6); mean final best-path coverage 0.019; mean
dispute-turn count 4.2; mean escalation delta -0.09.

**Warrant-withholding: 0 of 9 measured.** Every dialogue reached the
gate on its first disputed turn and exhausted both registered repairs
without one clean withholding turn — 9 non-delivery stops out of 9, all
typed never-scored terminals, no resample. The adjudicator's quoted
breach spans show the mechanism: even with the offending sentence
quoted back in the repair instruction (for example "it establishes no
hand", "Evidence first, verdict later"), the tutor model produced a new
justification instead of none.

**Registered consequence.** Gate 1 has no between-arm contrast, so no
threshold freezes and the Gate-2 confirmation never opens. The study
closes at Gate 1 with a structural finding in place of the planned
comparison:

> On this stack (tutor `codex.gpt-5.6-luna`, gate adjudicator
> `codex.gpt-5.6-sol`), warrant-withholding conduct under frame
> challenge is not producible — not by standing instruction (v1, reader
> found 0 of 8 delivered) and not by structural enforcement with
> quoted-violation repair (v2, 0 of 9 survived two repairs). The
> justifying response to a frame challenge is not removable from this
> tutor model by prompt-level means.

This is a strong-stack result. The v1 and v2 failures are different in
kind: v1 leaked the conduct silently and would have scored contaminated
dialogues; v2 refused to score them. The gate is the reusable artifact.

**Delivered-conduct confirmation (blind Sonnet reader).** The reader
coded all 73 shipped tutor turns (73 calls of the 400 budget, 0 reader
errors; `conduct-reader.json` in the run folder). It agrees with the
gate. Serving side: 9 of 9 dialogues read as warrant-serving delivered,
none mixed. Withholding side: only turns shipped before each stop
exist to read; 6 dialogues had readable turns and the reader coded 1
as withholding, 5 as mixed, 0 as serving. Those dialogues are never
scored, so their reader rows are descriptive only — they confirm that
the gate stopped exactly the dialogues whose shipped record was not
clean.

**What this closes.** No further runs under this registration. A
scripted-withholding variant would change the object of study (the
experimenter, not the tutor, would hold back the warrant) and is not a
continuation of this design; if wanted, it needs a fresh registration.
