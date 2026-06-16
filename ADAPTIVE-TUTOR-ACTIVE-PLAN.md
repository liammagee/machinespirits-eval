# Adaptive Tutor Active Plan: A20 Conduct-Policy Compiler

Status: canonical active plan, 2026-06-15. This consolidates the adaptive
tutor planning notes into one current roadmap. It is a planning artifact only:
it does not authorize new paid runs, and it does not overwrite historical
selector, replay, recognition, or learned-adaptation results.

This file is the active plan. The other plan-like notes remain evidence ledgers
or closed arcs, not competing roadmaps.

## Source Ledgers

| Source | Use in this plan |
|---|---|
| `adaptive-tutor-trajectory-analysis-note.md` | Main diagnosis: we have regulation, not yet robust adaptation; the missing object is policy, not representation selection. |
| `docs/research/adaptive-tutelage-next-stage-development-plan.md` | GPT Pro synthesis: keep the dynamic guard compiler idea, but narrow it to a conduct-policy compiler layered onto the existing guard/runtime substrate. |
| `ADAPTIVE-TUTOR-GENERALIZATION-PLAN.md` | Historical selector/generalization evidence. Use as a ledger, not as a new selector plan. |
| `ADAPTIVE-TUTOR-BOUNDARY-PLAN.md` | Historical boundary, corridor, conduct-mining, and guard-isolation evidence. Reuse its artifacts and detector discipline. |
| `LEARNED-ADAPTATION-PLAN.md` | Closed fitted-policy arc. Do not revive as the next adaptive mechanism. |
| `ADAPTATION-PLAN-2.0.md` | Closed concealment/interiority arc. Keep its signal-boundary lesson, not the mechanism. |
| `DRAMATIC-RECOGNITION-PLAN.md` | Recent drama/recognition work is a mature engine layer, not the next adaptive-reliability workstream. |

## What Is Explicitly Excluded

The next arc should not re-plan work that has just landed or already failed its
gate.

- No H/V selector v5 as the main effort. The selector arc remains evidence that
  hidden and visible channels are real, but the current selector has not earned
  an adaptive-success claim.
- No "always hidden" victory lap. Hidden proof state is the reliability
  substrate, not a sufficient theory of tutoring.
- No fresh taxonomy of many situation types. Keep typed moves few and force
  each new distinction to earn its place in tests.
- No learned fitted-policy rerun. The offline gate closed that arc.
- No concealment/interiority rerun. That arc is closed as a separate result.
- No extension of the recent scene, phatic, recognition-pressure, register, or
  director-silence work inside this plan. Those features can stay in the
  general derivation arm, but they are not the next adaptive-policy lever.
- No same-turn assertion promotion as the first A20 component. The replay and
  same-turn affordance work is useful debugging infrastructure and a local
  suffix affordance, not yet the central adaptive policy.
- No paid validation until the trigger corpus, policy fixtures, and replay
  harness pass locally.

## Current Read

The strongest reading of the recent evidence is:

- We can regulate proof continuity with hidden proof state, proofDebt, pacing,
  and runtime-monitor constraints.
- We cannot yet show that the tutor adapts in the strong sense: a learner-state
  signal changes the tutor's next move, the change is locally correct, and the
  policy transfers under predeclared conditions.
- Visible/public conduct remains important, but only as evidence to be
  certified against the hidden reference when formal proof state exists.
- Recognition, scene texture, phatic exchange, and register improve the dramatic
  surface and may aid readers, but they do not by themselves establish adaptive
  reliability.
- Episode replay is now a cost-control and debugging tool. It can screen local
  policy changes from frozen prefixes, but promoted claims still require fresh
  first-pass validation.

The active hypothesis is:

> Adaptive tutoring is auditable conduct-policy selection over a consolidated
> proof board: hidden proof state supplies the reference, proofDebt supplies the
> constraint, public learner conduct supplies evidence, and a typed policy
> chooses the next pedagogical move before text generation.

## Target Architecture

The GPT Pro guard-compiler proposal is retained, but scoped to the current
codebase:

```text
WorldIR / GuardSpec
  + ProofDebtReport
  + PublicLearnerEvidence
  -> EntitlementState
  -> ConductPolicySpec
  -> RuntimeMonitor decision
  -> Tutor generation constraint
  -> Local uptake audit
```

Existing anchors:

- `services/dramaticDerivation/guardCompiler.js`
- `services/dramaticDerivation/runtimeMonitor.js`
- `services/dramaticDerivation/proofDebt.js`
- `services/dramaticDerivation/replay.js`
- `services/dramaticDerivation/rhetoricalMovePolicy.js`
- `scripts/run-derivation-episode.js`
- `scripts/derivation-mine-conduct.js`
- `tests/dramaticDerivationGuardCompiler.test.js`
- `tests/dramaticDerivationRuntimeMonitor.test.js`
- `tests/dramaticDerivationProofDebt.test.js`
- `tests/dramaticDerivationReplay.test.js`

Do not build a parallel adaptive tutor subsystem. Extend this surface.

## Core Objects

### `WorldIR`

Already exists through the guard compiler. It is the formal account of proof
topology, release schedule, branch/join structure, and visible projection
candidate status.

### `GuardSpec`

Already exists. It remains the compiled reference for hidden pacing,
proof-debt exposure, non-leak rules, and visible-projection certification.

### `EntitlementState`

New or lightly factored object. It should represent what the learner is
publicly entitled to do next, without exposing hidden proof paths.

Minimum fields:

- `canAssertFinal`: the learner has enough public support to attempt the final
  answer.
- `needsDependencyRepair`: a released/decayed or missing support must be
  restored before the next step.
- `ownsCurrentStep`: public evidence suggests ownership rather than echoing.
- `localFluencyOnly`: the learner sounds fluent but lacks proof entitlement.
- `validAlternativeCandidate`: the learner may be pursuing a valid route not
  identical to the authored route.
- `recognitionRupture`: the exchange needs interpersonal repair before proof
  pressure continues.
- `uncertain`: evidence is too weak; ask a diagnostic instead of pretending.

### `ConductPolicySpec`

New compiled policy surface. It maps `WorldIR + GuardSpec + EntitlementState`
to a typed move family and blocked actions.

Minimum move families:

- `repair_dependency`
- `ask_diagnostic`
- `ask_scope_test`
- `consolidate_subproof`
- `release_next_evidence`
- `block_assertion`
- `invite_final_assertion`
- `repair_recognition_rupture`

Each move must declare:

- required preconditions
- blocked conditions
- permitted tutor-facing fields
- expected local uptake at the next learner turn
- non-leak audit notes

### `RuntimeMonitor`

Existing executable layer. It should remain responsible for enforcing the
compiled policy and logging decisions. It should not let the LLM write or revise
guard predicates online.

### `LocalUptakeAudit`

New report layer, not a new judge. The primary unit is:

```text
trigger state -> expected move family -> actual tutor move at t+1 -> learner uptake at t+2
```

Final grounding remains necessary, but it is not the only success measure.

## Work Arc

### Phase 0: Consolidate and Freeze Scope

Status: this document.

Deliverable:

- `ADAPTIVE-TUTOR-ACTIVE-PLAN.md` is the only active adaptive tutor plan.

Exit rule:

- The next implementation begins from the first work packet below, not from the
  old selector, learned-policy, concealment, or recent drama-recognition plans.

### Phase 1: Trigger Corpus and Fixture Set

Status: local first slice implemented 2026-06-15.

Goal: build a free, local corpus of states where a policy decision matters.

Inputs:

- existing derivation loop artifacts under `exports/dramatic-derivation/`
- selector and stress reports
- episode replay metadata
- conduct-mining output from `scripts/derivation-mine-conduct.js`
- existing guard/proofDebt diagnostics

Deliverables:

- `exports/dramatic-derivation/a20-conduct-policy/trigger-corpus.jsonl`
- `exports/dramatic-derivation/a20-conduct-policy/trigger-corpus-report.md`
- 8-12 fixture cases added to tests or test fixtures

Fixture classes should stay shallow:

- dependency repair needed
- final assertion invited too late or too early
- local fluency without entitlement
- visible/public confidence conflicts with hidden proof debt
- valid alternative route candidate
- recognition rupture blocks proof pressure
- implementation artifact such as detector false positive

Do not introduce a larger taxonomy at this stage.

Exit rule:

- Each fixture has a source artifact, expected move family, blocked actions, and
  local uptake expectation before any new runtime policy is implemented.

### Phase 2: Entitlement State and Move Compiler

Status: local first slice implemented 2026-06-15.

Goal: implement the smallest deterministic policy layer that can classify the
fixture set before text generation.

Likely implementation surface:

- `services/dramaticDerivation/conductPolicy.js`
- `tests/dramaticDerivationConductPolicy.test.js`

Required behavior:

- consumes public learner evidence, `proofDebtReport`, and safe guard metadata
- emits one typed move family before generation
- logs preconditions, blocked conditions, and uncertainty
- refuses to expose hidden proof path, secret, D arithmetic, or raw board state
- falls back to `ask_diagnostic` when visible evidence is underdetermined

Exit rule:

- Unit tests pass on all Phase 1 fixtures without calling any LLM.

### Phase 3: Runtime-Monitor Integration

Status: runtime logging, generator-compliance audit, and opt-in enforcement
slices implemented 2026-06-15. `--conduct-policy` records policy decisions in
tutor-turn metadata and diagnosis reports without constraining generation.
`--conduct-policy-enforce` implies logging and mechanically rewrites tutor
move/release metadata when a selected move family can be satisfied without
bypassing a forced release. Enforcement is covered by mock/smoke tests only so
far; it still needs replay screening on known failure episodes.

Goal: wire the policy into the existing derivation runtime without changing
historical selector behavior.

Likely flag:

- `--conduct-policy` or `--entitlement-policy`

Required behavior:

- opt-in only
- compatible with hidden + proofDebt substrate
- selector flags remain unchanged
- runtime logs include policy input summary, selected move, blocked actions,
  non-leak audit result, and generator compliance result
- generator noncompliance is classified as implementation failure, not policy
  success or world failure

Exit rule:

- mock/smoke tests prove the policy can constrain the tutor and preserve replay
  prefix fidelity. Generator noncompliance is now audited, so constraint
  failures must be reported as implementation failures rather than policy
  successes.

### Phase 4: Episode-Replay Screen

Status: partial mock replay screens run 2026-06-15; see
`exports/dramatic-derivation/phase4-conduct-policy-replay-screen.md` and
`exports/dramatic-derivation/phase4b-conduct-policy-replay-screen.md`.
The first screen showed no clear negative transfer, but no value-add because the
sampled dependency-repair moves were already enforced by `proofDebtGuard`.
The Phase 4b observation-only fixture disabled `proofDebtGuard` for the replay
suffix and did show enforcement mechanics: S0 logged 0/3 compliance on a
`repair_dependency` obligation and regressed from D=4 to D=5, while S1 rewrote
one tutor move to restore `p_bearing`, passed compliance, and held D=4 through
the suffix. This is still not first-pass evidence and still not proof of
value-add over hidden + proofDebt. A small enforcement-text punctuation issue
observed in the Phase 4b replay was fixed after the screen and covered by the
conduct-policy test. The acts-mode final-assertion trigger gap was then fixed
with a sanitized `conductEntitlement.canAssertFinal` signal and checked in
`exports/dramatic-derivation/phase4c-final-entitlement-replay-check.md`:
Ravensmark replay from t16 selected `invite_final_assertion`, passed compliance,
and preserved prefix identity. The remaining non-proofDebt replay gate then
passed in `exports/dramatic-derivation/phase4d-nonproofdebt-replay-screen.md`:
Withercombe no-decay replay from t7 improved conduct compliance from 1/3 to
3/3 by enforcing `ask_diagnostic` on visible/hidden conflicts, while preserving
prefix identity and the local D curve.

Goal: use the new replay facility to screen the policy from known failure
prefixes without paying to regenerate the prefix.

Comparison:

- S0: hidden + proofDebt baseline from the same frozen prefix
- S1: hidden + proofDebt + conduct policy from the same frozen prefix

Rules:

- replay is a debugging screen, not final evidence
- one policy delta at a time
- no reclassifying worlds after outcomes
- failures keep their label: policy failure, guard failure, generator
  compliance failure, detector artifact, or world instability

Exit rule:

- S1 improves the targeted local move on replay fixtures without creating clear
  negative transfer against S0.

Current next gate:

- Phase 5 fresh first-pass validation, if paid runs are authorized. Keep the
  first pass small: S0 hidden + proofDebt versus S1 hidden + proofDebt +
  conduct policy on a mixed set containing one dependency-repair case, one
  final-entitlement case, and one diagnostic/visible-hidden-conflict case.

### Phase 5: Fresh First-Pass Validation

Status: first-pass canary run 2026-06-15/16; see
`exports/dramatic-derivation/phase5-conduct-policy-first-pass-report.md`.
The main hidden + proofDebt matrix completed without final negative transfer:
Withercombe dependency repair, Ravensmark final entitlement, and Hethel
zero-decay all matched S0 on final grounding, turn count, forced/asserted gap,
overreach, and lucky-leap counts. However, the main matrix did not show
incremental value because all S0 conduct-triggered moves were already
generator-compliant. The intended Hethel diagnostic case was an experiment-design
miss: plain hidden + proofDebt does not arm selector-v4 visible-consolidation
evidence, so no `ask_diagnostic` trigger appeared.

Diagnostic add-on: a separate selector-v4/zero-decay Withercombe pair did arm
visible consolidation. There S0 passed 11/17 checked conduct decisions, while
S1 passed 17/17 and enforced five `ask_diagnostic` corrections, with matched
final grounding at turn 19 and no overreach/lucky-leap increase. This is useful
local evidence for conduct enforcement as a visible-consolidation clamp, but it
is not yet default-promotion evidence for the whole hidden + proofDebt arm.

Current next gate: fix or decide the final-turn diagnostic priority edge case
observed in the selector-v4 add-on. S1 enforced `ask_diagnostic` on the final
forced turn; the run still grounded, but the policy should not
over-diagnosticize an entitlement turn unless the learner's public assertion is
unsupported. After that, run one more small selector-v4 diagnostic pair on a
different world before defaulting enforcement for visible-consolidation cases.

Goal: test whether the policy survives outside replay.

Only run this after Phases 1-4 pass.

Candidate arms:

- S0: hidden + proofDebt
- S1: hidden + proofDebt + conduct policy
- optional diagnostic: visible projection only where pre-certified by the
  `GuardSpec`

Candidate worlds:

- one hidden-positive branch/depth world
- one visible-positive or hidden-hurts world
- one mixed decay world
- one valid-alternative-route fixture if available

Primary metrics:

- local move correctness at trigger + 1
- final grounding
- regret and negative transfer against S0
- generator compliance with typed move
- non-leak audit pass rate
- failure-class relocation, not just success rate

Decision rule:

- Promote only if S1 beats or matches S0 on final grounding, improves targeted
  local move correctness, and does not introduce first-pass negative transfer on
  held-out worlds.

## First Work Packet

Start here.

1. Extend or wrap `scripts/derivation-mine-conduct.js` to emit an A20 trigger
   corpus under `exports/dramatic-derivation/a20-conduct-policy/`.
2. Mine only existing artifacts. No new LLM calls.
3. Produce a compact markdown report with each trigger, source artifact, world,
   current arm, expected move family, actual move family when inferable, and
   failure class.
4. Choose the first two policy fixtures:
   - one dependency-repair case where hidden + proofDebt is already right;
   - one case where hidden + proofDebt plausibly over-repairs or delays a valid
     learner-owned move.
5. Only after those fixtures are frozen, implement `conductPolicy.js`.

## Failure Labels

Use the same labels across replay and fresh runs:

- `policy_failure`: the policy selected the wrong typed move.
- `guard_failure`: the guard/proofDebt substrate supplied the wrong constraint.
- `generator_compliance_failure`: the policy selected the right move but the
  public tutor text ignored it.
- `visible_projection_failure`: public signals were not faithful to hidden
  topology.
- `detector_artifact`: a local detector or uptake classifier misread the state.
- `world_instability`: decay/adaptive release changed the effective constraint.
- `valid_negative`: S1 fails honestly; the policy does not generalize.

Misroutes are evidence. Do not rename them into successes after seeing the
outcome.

## Reporting Standard

Every A20 report should include:

- exact command or artifact path
- zero-paid versus paid status
- arms compared
- fixture list and predeclared expectations
- local trigger table
- final grounding table
- regret or negative-transfer table against S0
- failure labels
- caveats
- whether the result changes `docs/research/paper-full-2.0.md`

Paper discipline still holds: new empirical claims go to
`docs/research/paper-full-2.0.md` before sidecars inherit them.

## Working Claim If This Succeeds

Do not claim "adaptive selector works." The strongest allowed claim would be:

> The system can compile a small, auditable conduct policy from formal task
> state plus public learner evidence; when the policy selects the tutor's next
> move before generation, it improves local repair/advance decisions over a
> hidden + proofDebt substrate without increasing first-pass negative transfer.

That is the next adaptive tutor claim worth trying to earn.
