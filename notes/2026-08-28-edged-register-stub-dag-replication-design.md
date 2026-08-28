# Edged-register replication in the tutor-stub proof-DAG harness — design

**DRAFT FOR HUMAN REVIEW — NOT SIGNED. This note licenses no paid call.**

Workplan item: `edged-register-stub-dag-replication`. Parent evidence:
`notes/2026-08-16-edged-register-calibration-draft.md` §3.10–§3.11.1.

## 1. The question, and why it moves here

The 312-row edged-register block ended with a weak, unreplicated
whole-task gap (sharp 0.601 pooled against warm 0.712, p = 0.061, 48%
power) and one surviving lead: after a sharp reply the learner still
states its position but supplies less of the backing — making the case
0.333 against 0.700, naming the deciding feature 0.767 against 0.962.
Every one of those numbers came from a model reader that saw the tutor's
sharp text inside its read window. That design cannot separate "the
learner argued less" from "the reader marked the argument down".

The tutor-stub harness removes the reader from the outcome. Completion is
checked against the proof-DAG in the world file: a premise is either
grounded on the record or it is not. The question asked here:

> Does a sharp delivery policy change how much of the proof debt the
> learner discharges, when the world, the proof-DAG, the learner persona,
> and the seeds are held fixed and completion is machine-checked?

A null is a result. The claim, either way, is bounded to simulated
learners, this stack, one world, and the tested personas.

## 2. What the harness can already express, and what is missing

Already there (surveyed 2026-08-28, file references in the workplan card
log):

- A register can be pinned on every tutor turn: a one-register palette
  plus the `bland` policy fixes that register for the whole dialogue
  (`services/tutorStubResponsePolicySelectionRuntime.js`,
  `fixedBlandEngagementStanceSelection` falls through to the only
  palette member). `sarcastic` and `ironic` are reachable through an
  explicit comma-list palette; `face_threat` stays out.
- The outcome-only score and its parts exist
  (`scripts/analyze-tutor-stub-auto-evals.js`): row reliability, grounded
  closure, best-path coverage (grounded premises over total premises on
  the best proof path — the discharged-proof-debt measure), turn
  efficiency, leak discipline.
- The QA matrix runs profile × policy cells under one frozen plan
  (`qa-plan.json`), with `--policies`, `--interleave-policies`,
  `--run-seed`, and per-cell deterministic sampling keyed on
  {seed, profile, policy, repeat, jobId}. Repeats inside a cell are
  independent draws, so a registered half-split by repeat index is a true
  same-treatment control at no extra cost.
- The learner is a full LLM agent with persona contracts, including
  `bored` (effort-withholding boredom) and `affective_resistant` — the
  stub's nearest kin to the persona that carried the whole parent gap.

Missing, stated plainly:

1. **No named fixed-register policies.** Pinning through the palette
   labels both arms `bland` in every artifact, and the run-level palette
   flag cannot differ between cells of one plan — so a sharp arm and a
   warm arm cannot sit in one frozen, interleaved plan. This is the
   load-bearing gap: two separate launches would lose the concurrency
   the parent study lost (its §3.11 limit 1).
2. **No fidelity check on the delivery.** Nothing verifies that a
   pinned `sarcastic` turn is realized as sarcastic. The registry itself
   says an unrealized sharp arm "is only charismatic challenge in
   costume and must be excluded as noncompliance". The parent study's
   arm B silently ran as a twin of arm A for exactly this class of
   reason. A surface-match detector is banned by five measured failures
   of that class; the check must be a reader, arm-level, on the
   manipulation only — never on the outcome. The reader itself already
   exists and is validated: the merged edged-manner presence question
   (`services/registerMannerPresence.js`, prompt `manner-presence/1.0`,
   10/10 twice — human and Sonnet 5 independently — on the hand-marked
   eyeball set), with cached plumbing in
   `services/registerMannerPresenceReader.js`. Stage 0 composes it; it
   does not build a new instrument.
3. **Solve-time measures are not in the QA outputs.** Cap-death and the
   grounding turn live in the trace and in
   `scripts/analyze-tutor-stub-trajectories.js`, which the QA runner
   never invokes. They must be produced as a registered second pass.

## 3. Design

**Arms.** Two policies, new but small, mirroring the bland selector:

- `fixed_sarcastic` — every tutor turn delivered in the `sarcastic`
  register. Single register, not a sharp menu: the parent block
  delivered sarcastic three turns in four, and a menu would reintroduce
  a router-choice channel. The selector refuses to run if `sarcastic` is
  not in the active palette (fail closed, not substitute).
- `fixed_warm` — every tutor turn in `warm`, same machinery, same
  refusal rule.

Both are controls in the composition sense: no overlays, no model
choice. One QA plan holds both, interleaved. Run-level palette
`warm,sarcastic`; the palette does not leak into the tutor prompt (only
the policy line and the selected register's own contract are rendered).

A difference from the parent design, stated up front: the pin covers
every turn, including turns before the learner has resisted. This prices
a delivery **policy**, not a single turn's tone. Counterfactual replay —
the only design that prices one turn — stays out of scope.

**World and learner.** `world_005_marrick`, `--dag-mode` and turn cap as
in the headroom suite (binding `--safety-turns 40`). Learner personas:
`bored`, `affective_resistant`, `proof_skipper`, `diligent` — the two
personas the parent lead points at, one cognitive-failure anchor where
the sharp end *helped* in the headroom run, and the no-resistance
anchor. Auto-learner on, persona contracts unchanged.

**Seats.** Tutor, learner, and classifier all `codex.gpt-5.6-luna` (the
card's generation rule; the classifier is generation-side machinery).
Fidelity reader `claude-code` Sonnet 5. Never nemotron/kimi.

**Endpoints, fixed now.**

- Primary: best-path coverage per dialogue — the share of proof debt
  discharged — `fixed_sarcastic` against `fixed_warm`, pooled over the
  kept persona cells, two-sided permutation test on the difference of
  means, α = .05.
- Secondary (registered, reported, not selection): grounded closure
  within the cap (binary, exact test); cap-death rate; grounding turn
  T\* among grounded dialogues (trajectory-analyzer second pass).
- Report-only: the outcome-only composite, per-persona splits, register
  trace counts, mean turns, the fidelity reader's attack flags.

**Same-treatment control, fixed now.** Each arm's dialogues split into
two halves by repeat index, registered before any row exists. The two
same-treatment contrasts (sharp half against sharp half, warm half
against warm half) are computed on the primary and reported beside the
cross-arm contrast. A cross-arm difference smaller than either
same-treatment difference is recorded as noise, the way §3.10.3 caught
the verdict-measure false positive.

**Manipulation check, fixed now.** After generation, before any outcome
number is read, the fidelity reader (Sonnet 5,
`scripts/read-stub-fixed-register-fidelity.js`) reads **every tutor
turn in both arms**, blind to outcomes, and asks the validated merged
edged-manner presence question (`manner-presence/1.0`): does the
tutor's reply carry an edge? The question names no arm, no register,
and no outcome, so the read is blind by construction. All-turns-both-
arms replaces an earlier draft's "equal random sample" of warm turns:
the warm-arm reads are the leak check (a warm turn read as edged is a
delivery leak, report-only), and one plain rule beats a sampling rule.
Sharp turns go through the gated entry; warm turns go through the
ungated `readPresenceOfTurn`, a deliberate, documented, report-only
bypass that can never pass a floor.

Arm-level floor, registered: at least 80% of sharp-arm turns read as
edged (denominator: all sharp-arm turns). Below the floor the arm is
noncompliant and the study reports **no verdict** — not a null. While
any sharp-arm turn is unread the check reports **incomplete** and no
verdict exists: failed reader calls are retried on a re-run (they are
never cached), cached parse failures are not (cached on purpose) and
go to a person. A fixed-policy turn carrying the wrong register is a
pin violation — a harness defect that also withholds the verdict.

The same pass runs the parent block's harm scan report-only: the two
deterministic tutor-turn word-list families (`personAttackMatches`,
`statusShameMatches` in `services/registerStanceFidelity.js`) select
turns, and the person-vs-work harm reader
(`services/edgedRegisterHarmReader.js`) rules on each match; the
operator rules on any confirmed flag. The outcome channel never
touches any of these readers.

**Stages.**

- Stage 0 — build, zero-call, this worktree: the two policies, their
  dispatch, prompt lines, policy-list registrations, tests; the fidelity
  reader with fixture tests; the trajectory second pass wired into the
  runbook. No registry edit, no change to existing policies.
- Stage 1 — baseline, paid, own GO note and approval: `fixed_warm`
  only, 4 personas × 12 = 48 dialogues. Purpose: measure warm coverage
  mean and spread, closure rate, cap-death, and mean turns per persona
  on the pinned stack. Registered cell rule, fixed now: drop a persona
  cell whose warm closure is 0/12 (task unsolvable under warm for that
  persona) or whose coverage spread is zero (no discrimination); keep
  the rest. A high warm baseline is not a drop reason — the hypothesis
  runs downward. Stage-1 rows are calibration only and are never pooled
  into Stage 2 (the arms must be concurrent; that was the parent's
  limit 1).
- Stage 2 — main block, paid, own GO note and approval: both arms
  interleaved under one frozen plan, sized from Stage 1.

**Sizing rule, fixed now.** n per arm gives 80% power, two-sided
α = .05, against a minimum effect of interest of **0.15 absolute
coverage**, computed from the Stage-1 pooled coverage spread (standard
two-sample calculation, checked by simulation on the Stage-1 empirical
distribution). Hard ceiling: 240 dialogues total in Stage 2. If the
required n breaks the ceiling, the study stops and reports infeasible —
indeterminate means stop, not shrink the effect of interest.

**Scale estimate for the operator** (estimate, not a ceiling — ceilings
land in each GO note): a dialogue at cap 40 costs roughly 6 model calls
per turn across the three seats; grounded dialogues end early. Stage 1
is in the region of the headroom run (60 dialogues at the same cap,
attended, subscription quota). Attended and pausable, per the standing
rule for long runs.

## 4. Discipline carried over

- No paid call until the operator signs and commits a GO note for that
  stage and separately approves the launch. This note is not a GO note.
- No resampling after a failure; a failed row counts against
  reliability. No re-reading of `batch-main-2`. No promotion of the
  headroom run's numbers (closed exploratory, wrong model provenance).
- Work stays in this worktree, committed, never pushed. Trailer
  `Workplan-item: edged-register-stub-dag-replication`.
- Provenance recorded, not enforced: each stage records commit, tree,
  and dirty state. No approval binds to a SHA; fixing a code defect
  does not void the operator's go.

## 5. What this can and cannot settle

If sharp delivery costs the learner proof debt here, the claim is that a
sharp **policy** lowers machine-checked completion for these personas on
this stack — free of the reader confound, and consonant with the parent
block's direction. If it does not, the parent's weak gap stays what it
was: unresolved at 48% power, with the reader confound intact. Neither
result prices a single turn's tone, real learners, or other worlds.
