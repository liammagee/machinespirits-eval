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

Final-turn priority edge case fixed 2026-06-15/16: final assertion entitlement
now outranks visible-consolidation diagnostics while unsupported assertion
blocking and proof-debt repair remain higher priority.

Phase 5c Ravensmark diagnostic pair completed 2026-06-16 after that fix. Both
arms used selector-v4, zero decay, proof-debt guard, and conduct policy; S1
added enforcement. S0 and S1 both grounded at turn 13 with forced/asserted gap
0, no overreach, no lucky leap, no fabricated facts, and the same D curve
(`2->2->2->1->1->1->1->1->1->1->1->1->0`). S0 passed 8/12 checked conduct
decisions; S1 passed 12/12 and mechanically corrected two early
`ask_diagnostic` turns (`m_steward` at t2, `m_key` at t6). This gives a second
non-replay world where enforcement improves local conduct compliance without
observed final negative transfer.

Narrow promotion implemented 2026-06-16: fresh selector-v4 loop runs now imply
conduct-policy enforcement, and episode replay does the same when selector-v4 is
active unless `--conduct-policy-enforce off` is explicitly supplied. Hidden +
proofDebt remains unchanged: it does not imply conduct policy or enforcement.
Tests pin selector-v4 defaulting, hidden + proofDebt non-defaulting, and the
final-turn priority edge.

Phase 5d promoted selector-v4 mini-run completed 2026-06-16; see
`exports/dramatic-derivation/phase5d-promoted-v4-mini-report.md`. Because the
existing Ravensmark V-positive attempts did not separate hidden from visible,
this was run as a negative-transfer retest on the two known v4-risk worlds:
Lantern and Marrick. Hidden + proofDebt and promoted selector-v4 + proofDebt
both grounded in both worlds, with matched final D=0, forced/asserted gap 0, no
fabrication, no overreach, and no lucky leap. The promoted selector-v4 arms
selected hidden with visible consolidation/answer-gate shadowing, enforced five
`ask_diagnostic` corrections in each world, and passed post-enforcement conduct
compliance. This reduces the immediate negative-transfer concern for the
promoted clamp, but it is not evidence that adaptive H/V selection works:
selector-v4 still behaved as hidden-plus-extra-gates, and no true V-positive
world was identified.

Current next gate: do not broaden conduct enforcement to hidden + proofDebt. Do
not claim selector-v4 as an adaptive-selector success. The next paid work should
either (a) repeat the promoted clamp on these two negative-transfer worlds only
if we need stability evidence, or (b) first construct/mine a real V-positive or
hidden-hurts fixture before any mixed-world selector matrix.

Fixture mining completed 2026-06-16; see
`exports/dramatic-derivation/selector-fixture-mining-report.md`. Hethel r2 is
the primary fixture: baseline aporia, hidden disengagement at D=5, visible
grounded, and selective-v1 selected visible by `mirror_dead_predicate_visible`.
Withercombe r2 is demoted to a secondary unstable lead because the broader
Withercombe record remains visible-negative/decay-sensitive. Next gate: use
prefix-controlled Hethel r2 replay around t7 before any new mixed-world matrix.

Phase 5e Hethel r2 prefix replay completed 2026-06-16; see
`exports/dramatic-derivation/hethel-vpositive-r2-promoted-v4-replay-report.md`.
The short t7/window-8 replay was prefix-identical but exhausted at D=2. The
extended t7/window-16 replay was also prefix-identical and grounded at t20 with
gap 0. Current selector-v4 selected hidden, not visible, but proofDebt repaired
`p_point` twice and conduct enforcement applied nine `ask_diagnostic`
corrections. This means promoted v4 can survive the Hethel r2 visible-prefix
fixture in replay, but it does not preserve the old visible route; the old
V-positive signal is now partly absorbed by proofDebt plus release authority.
Next gate: run one fresh first-pass Hethel promoted-v4 + proofDebt loop only if
we want to know whether the current stack can survive without the visible prefix.

Phase 5f fresh Hethel promoted-v4 + proofDebt completed 2026-06-16; see
`exports/dramatic-derivation/hethel-promoted-v4-proofdebt-fresh-report.md`.
The fresh first-pass loop grounded at t20 with final D=0, forced/asserted gap
0, no fabricated facts, no overreach, and no lucky leap. Selector-v4 still
selected hidden despite the mirror-dead-predicate decoy being present
(`builtUnder`, `liableFor`) and rejected visible release acceleration. ProofDebt
repaired `p_point` once at t6; promoted conduct enforcement passed 18/18 checked
turns and applied four `ask_diagnostic` corrections. This neutralizes the old
Hethel first-pass negative-transfer concern for the current stack, but it is not
evidence that adaptive H/V selection works. The old visible benefit appears to
be absorbed by hidden proof continuity plus proofDebt, release authority, and
the promoted conduct clamp. Next decision: either treat hidden + proofDebt +
promoted conduct as the reliability baseline and stop selector claims there, or
create a separately labelled v5 diagnostic route if we still need a genuine
adaptive H/V selector claim.

Phase 5g A20 fresh validation completed 2026-06-16 after the replayable fixture
increment; see
`exports/dramatic-derivation/phase5g-a20-fresh-report.md`. The paired
Hethel/Withercombe/Ravensmark first-pass run compared hidden+proofDebt against
promoted selector-v4+proofDebt. Hidden grounded 3/3. Promoted selector-v4
selected hidden in all three worlds, grounded Withercombe at the same turn and
Ravensmark one turn later, but failed Hethel by disengagement at t11 with final
D=4. Conduct enforcement passed its local compliance checks in all promoted
arms, so the Hethel failure is not a generator-compliance failure; it is a
policy-level negative transfer from repeated `visible_hidden_conflict`
`ask_diagnostic` moves and delayed releases (`p_point` t4->t6, `p_surface`
t9->t11). This supersedes the Phase 5f promotion decision: do not treat
promoted selector-v4/conduct enforcement as a general reliability baseline.
Keep hidden+proofDebt as the reliability baseline, and either de-promote
selector-v4's default conduct enforcement or add a strict diagnostic budget
before any fresh paid retest.

Phase 5h completed 2026-06-16; see
`exports/dramatic-derivation/phase5h-v4-depromotion-budget-replay-report.md`.
The selector-v4 default was de-promoted so v4 no longer implies conduct-policy
logging or enforcement; both must now be requested explicitly. A shallow
diagnostic budget was added for repeated `visible_hidden_conflict`
`ask_diagnostic` triggers, including a public transcript fallback for adjacent
diagnostic tutor moves when replay prefixes do not carry conduct-policy metadata.
Focused tests passed (`node --test
tests/dramaticDerivationConductPolicy.test.js
tests/dramaticDerivationReplay.test.js`: 29/29).

Two prefix-preserving Hethel replays from the Phase 5g failure did not clear the
gate. The first replay still failed by disengagement at t11, final D=4, with
four `ask_diagnostic` moves. The stronger budget reduced the diagnostic count to
one and improved release timing (`p_point` t6->t5, `p_surface` t11->t10), but
still failed by aporia at t10, final D=4. Therefore no fresh paid Hethel retest
was launched. Current decision: keep hidden+proofDebt as the reliability
baseline, do not promote selector-v4/conduct enforcement, and only continue this
line if the next change targets progress/release pressure rather than another
visible/hidden diagnostic taxonomy.

Phase 5 is closed. It produced useful infrastructure and one important negative
result: local conduct compliance is not enough if the policy starves proof
progress. Do not run another selector-v4/conduct promotion retest unless a
separately labelled progress policy first clears replay against hidden+proofDebt.

### Phase 6: Progress-Aware Conduct Policy

Status: opt-in runtime slice implemented and replay-gated 2026-06-16.

First replay screen completed 2026-06-16; see
`exports/dramatic-derivation/phase6-progress-policy-replay-report.md`.
The first Hethel replay from the Phase 5g failure prefix preserved prefix
integrity and improved the failure substantially: no aporia/disengagement within
the t4--t15 window, D progressed to 1, and `p_point`/`p_surface` both released
on cue. However, the episode ended `cap_reached`, not grounded, with one early
release (`p_brand` t15 vs planned t17). A follow-up safe-now patch blocked
optional early-window releases without adding a move family, but the controlled
replay then failed by aporia at t9 with D stuck at 4. This is a valid negative
replay gate. Do not run the no-harm replay or fresh paid retest from this policy
state.

Learner-entitlement increment completed 2026-06-16; see
`exports/dramatic-derivation/phase6-learner-entitlement-report.md`. It adds a
small deterministic public `deriveEntitlementState(...)` object and routes normal
conduct-policy decisions through it without adding move families. Focused and
full tests pass. The Hethel prefix replay improved over safe-now by clearing the
t9 aporia and reaching D=2 by t15 with no release deviations, but it still ended
`cap_reached`, not grounded. Treat this as useful infrastructure and a partial
local repair, not a cleared replay gate. Do not run the no-harm replay or fresh
paid retest from this policy state.

Goal: test whether the conduct layer can stop asking diagnostics and press
forward when repeated visible/hidden conflict probes have exhausted their local
budget.

Implementation boundary:

- No new move-family taxonomy.
- `--conduct-progress-policy` is opt-in and implies conduct-policy logging, not
  enforcement.
- The policy reuses existing `release_next_evidence` and `consolidate_subproof`
  families.
- It fires only when repeated visible/hidden diagnostics are budget-exhausted.
- It now treats scheduled-current or force-play releases as current-authorized;
  tempo solvency inside an early window is not by itself enough for progress
  pressure to release.
- Normal conduct decisions now consume a public learner-entitlement object
  instead of independently reconstructing proof-debt, release, visible-uptake,
  diagnostic-history, final-assertion, and uncertainty signals.
- Enforcement still requires explicit `--conduct-policy-enforce`.

Candidate comparison:

- S0: hidden + proofDebt.
- S1: hidden + proofDebt + conduct policy + progress policy.
- Optional diagnostic: selector-v4 shadowing only when replaying an existing
  selector-v4 failure prefix; do not promote it as the arm under test.

Candidate worlds/prefixes:

- Hethel Phase 5g failure prefix from t4.
- One non-Hethel hidden+proofDebt success prefix as a no-harm replay check only
  after the Hethel replay gate clears.
- Only if replay passes: one fresh first-pass Hethel paired retest.

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
- If Hethel replay remains final D>0 or fails by aporia/disengagement, stop and
  report it as another valid negative; do not run the fresh paid retest.
- If an entitlement variant improves local failure but remains D>0 at window
  end, record it as a partial repair and stop before the no-harm replay.

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

Status 2026-06-16: steps 1-5 completed; see
`exports/dramatic-derivation/a20-conduct-policy-step1-5-report.md`. The corpus
miner now emits frozen first-fixture JSON as well as the trigger corpus summary.
The refreshed zero-paid corpus mined 492 completed runs and emitted 1000
candidate triggers, selecting the same two first fixtures: Withercombe
`p_rill` dependency repair at t14 as the conservative positive control, and the
Hethel v1 r2 `p_point` valid-alternative candidate as the hidden/proofDebt
counterweight. `conductPolicy.js` now lets a predeclared
`valid_alternative_route_candidate` ask a diagnostic before ordinary proofDebt
repair, while proofDebt still outranks final assertion entitlement. Focused A20
tests passed, full `npm test` passed, and a no-cost Withercombe episode replay
from t14 preserved prefix integrity with conduct policy active and 4/4 live
conduct decisions compliant. No paid first-pass run was launched.

Follow-up replayability step completed 2026-06-16; see
`exports/dramatic-derivation/a20-conduct-policy-replayable-fixtures-report.md`.
Two local commands now make the first fixtures reproducible:
`npm run derivation:a20-fixtures` and `npm run derivation:a20-replay-panel`.
The pure fixture gate passed 2/2. The zero-cost replay panel passed 2/2 with
prefix integrity true for both fixtures. Withercombe t14 preserved
`repair_dependency`; Hethel now replays from the actual hidden-failure source
(`hethel-selector-v1-hidden-r2`) and injects the predeclared
`valid_alternative_route_candidate` only at t4, where conduct policy selects a
compliant `ask_diagnostic` with no release. This is still local debugging
evidence, not held-out paid evidence, and it does not create selector-v5.

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
