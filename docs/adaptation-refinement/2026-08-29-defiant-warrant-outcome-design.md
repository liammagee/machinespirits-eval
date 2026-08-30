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
