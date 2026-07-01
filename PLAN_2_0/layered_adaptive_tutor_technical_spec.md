# Layered Adaptive Tutor: Technical Specification and Implementation Plan

- **Date:** 2026-06-30
- **Status:** v0 in-dialogue layers merged; task/session scaffold and held-out task-loop artifact gate merged; human/hybrid handoff probe opened 2026-07-01
- **Primary substrate:** hidden + proofDebt proof-continuity control
- **Core decision:** do not build another proof-control overlay unless a predeclared hidden+proofDebt failure first clears a failure-atlas gate.
- **Current worktree scope:** `codex/layered-human-handoff-probe` adds a zero-paid local deployment-risk probe for advisory human/hybrid review recommendations. Runtime routing, deployment, and human-learning claims remain deferred.

## 1. Executive Summary

The next adaptive-tutor project should not be another H/V selector, conduct-policy promotion attempt, or proof-control overlay. A20 and A21 have already shown that hidden+proofDebt is a strong production proof-control arm. It releases safe public evidence, repairs proof debt, avoids treating fluent learner talk as ownership, and was not beaten by the A20/A21 overlays in the current artifact pool.

The next technical object should be **layered adaptive tutoring**:

```text
proof-control adaptation:
  hidden+proofDebt

discursive/didactic adaptation:
  proof-safe quality layer, including minimal presence

learner-state adaptation:
  ownership + uptake + self-regulation

task/session adaptation:
  mastery estimate + next-problem selection

deployment adaptation:
  human handoff / teacher review
```

The production proof-control kernel remains hidden+proofDebt. New work should add auditable quality and learner-state layers above that kernel, with proof-control no-harm as a hard gate. The first implementation targeted in-dialogue scopes: turn, dialogue block, scene, and act. The follow-on task/session scaffold added advisory next-task selection. The held-out gate showed that selector generalizes to frozen derivation artifacts under a local advisory boundary. The current handoff probe opens deployment-risk classification only as advisory metadata; it does not route learners or implement deployed escalation.

## 2. Current Status and Boundary Conditions

### 2.1 Closed as proof-control promotion paths

The following should be marked **closed / not promoted** for the current artifact pool:

- H/V selector revival.
- Selector-v4 conduct enforcement.
- Phase 6 progress-policy enforcement.
- A21 Hethel patch as default.
- Didactic mode as proof-control.
- Further mined-artifact rescoring from the same pool.

### 2.2 Retained as instrumentation

The following remain valuable research assets:

- Episode replay.
- A20 conduct objects.
- A21 action-value microbench.
- Ownership benchmark.
- Didactic-mode scaffold.
- Non-leak audit.
- Generator-compliance audit.
- Proof-matched transcript-pair scoring.

### 2.3 Closed v0 worktree scope

Completed in `codex/layered-adaptive-tutor-plan`:

1. Make the plan internally consistent after A20/A21 closeout.
2. Define nested adaptation scopes: turn, dialogue block, scene, act, and task/session.
3. Add shared public evidence and opportunity-cost objects.
4. Add minimal-presence as advisory conduct across turn/block/scene/act.
5. Add uptake and self-regulation evaluators as local, public-only scaffolds.
6. Add proof-matched quality-pair scoring, if the preceding gates are green.

Out of scope for that v0 worktree:

1. Any new proof-control policy.
2. Runtime promotion of A20/A21/didactic/ownership overlays.
3. Task/session mastery selection.
4. Human handoff or teacher-review routing.
5. Paid runs or human-learning claims unless a later plan explicitly opens them.

### 2.4 Closed task/session worktree scope

Completed by PR #71 from `codex/task-session-adaptation`:

1. Add a public-only `TaskMasteryState` scaffold.
2. Recommend next task actions from ownership, transfer, uptake, self-regulation, repair, and error signals.
3. Compare the adaptive recommendation against a fixed progression baseline on deterministic controls.
4. Keep recommendations advisory and unable to override hidden+proofDebt proof control.
5. Record a workplan item and zero-paid validation command.

Still out of scope after that merge:

1. Human or hybrid handoff execution.
2. Paid LLM runs.
3. Human-learning claims.
4. Runtime task assignment without a later validation gate.

### 2.5 Closed held-out artifact gate scope

Completed by PR #72 from `codex/taskloop-heldout-gate`:

1. Build a frozen held-out artifact fixture set from existing derivation traces, closeout reports, world specs, and episode outputs.
2. Run the public-only task/session selector against those artifacts.
3. Compare it against fixed progression without passing proof-control fingerprints into the selector.
4. Require proof-control fingerprints to remain identical between the fixed and adaptive arms.
5. Emit a zero-paid report that answers: does task/session selection still beat fixed progression on held-out artifacts?

Result:

```text
Adaptive task/session selector: 12/12
Fixed progression baseline: 2/12
Accuracy delta: 0.833
Public-only failures: 0
Proof-control drift rows: 0
```

Out of scope for this worktree:

1. Any proof-control behavior change.
2. Any hidden proof-state feature in `TaskMasteryState`.
3. Runtime task assignment or UI deployment.
4. Human handoff execution or human-learning claims.

### 2.6 Current human/hybrid handoff probe scope

Opened in `codex/layered-human-handoff-probe`:

1. Add a public-only `HumanHandoffState` scaffold.
2. Recommend conservative human/hybrid review actions from public signals:
   repeated non-uptake, low self-regulation, public affect risk, proof reliability
   issue labels, learner request, and model confidence.
3. Keep recommendations advisory and unable to override hidden+proofDebt proof
   control or replace proof-control logs.
4. Run a zero-paid deterministic probe over conservative trigger/no-trigger
   controls.

Out of scope for this worktree:

1. Actual learner routing, UI deployment, paging, notification, or teacher-review
   workflow execution.
2. Human-learning, safety, or clinical/welfare claims.
3. Proof-control behavior changes.
4. Hidden proof-state features in the handoff state.

### 2.7 Why this boundary matters

A20/A21 do not harm by existing. They harm only when promoted overlays gain runtime authority and spend scarce proof turns on diagnostics, consolidation, readback, or teach-back while proof-critical releases remain pending. Kept off the production path, they make the system more auditable.

The technical rule is:

```text
Hidden+proofDebt owns proof action.
Quality layers may change conduct only.
No overlay may starve proof progress.
```

## 3. Design Thesis

The tutor should be organized as distinct adaptation loops rather than as one monolithic “adaptive tutor” object.

### 3.1 Nested temporal scopes

Layered adaptation operates across nested temporal scopes. "Outer loop" should not mean only next-problem selection. There are in-dialogue outer loops before the task/session loop:

| Scope | Question | v0 authority |
|---|---|---|
| turn | What proof action and conduct move are safe now? | proof-control binding; conduct advisory |
| dialogue block | How should this local repair, uptake, resistance, or consolidation exchange close? | advisory; no proof-target changes |
| scene | What didactic/discursive regime and exit condition govern this bounded unit? | advisory defaults plus audit |
| act | How should the broader dramatic/pedagogical phase shape upcoming scenes? | planning/evaluation only in v0 |
| task/session | What should the learner attempt next, or who should help? | deferred outer-loop project |

The current v0 implements turn/block/scene/act conduct and learner-state layers. It leaves task/session sequencing for a separate project.

### 3.2 Step-loop proof control

This is the current derivation controller:

```text
given this proof state and learner board,
what proof action is safe now?
```

Actions include release, repair, hold, block, and invite assertion.

### 3.3 Discursive and didactic conduct

This layer asks:

```text
given the same proof obligation,
how should the tutor conduct the next exchange?
```

It may change tone, pressure, question shape, explanatory mode, rhetorical figure, recognition repair, or minimal presence. It may not change proof target or release authority.

### 3.4 Learner-state evaluation

This layer asks:

```text
did the learner use, own, accept, reject, or bypass the support?
```

It includes ownership, uptake negotiation, and self-regulation.

### 3.5 Task/session adaptation

This is future work at the task/session outer loop:

```text
given this learner’s mastery trace,
what should they attempt next?
```

This is not an A20/A21 continuation and not part of Layered Adaptive Tutor v0. It is a new project after the in-dialogue turn/block/scene/act layers are bounded.

### 3.6 Deployment adaptation

This is now opened only as a local probe:

```text
when should the system route to a human?
```

Human handoff should be treated as an adaptive action in deployment contexts,
but the current implementation stops at advisory classification. Actual routing
requires a later deployment plan and human validation.

## 4. Reference Architecture

```text
┌────────────────────────────────────────────────────────────┐
│ Learner public dialogue                                    │
└──────────────────────────────┬─────────────────────────────┘
                               │
                               ▼
┌────────────────────────────────────────────────────────────┐
│ Public Evidence Extraction                                 │
│ stance, uptake, resistance, echo, purpose gap, affect       │
└──────────────────────────────┬─────────────────────────────┘
                               │
         ┌─────────────────────┼─────────────────────┐
         ▼                     ▼                     ▼
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│ Proof Control   │   │ Quality Overlay │   │ Learner State   │
│ hidden+proofDebt│   │ discursive/did. │   │ ownership/uptake│
└────────┬────────┘   └────────┬────────┘   └────────┬────────┘
         │                     │                     │
         ▼                     ▼                     ▼
┌────────────────────────────────────────────────────────────┐
│ Runtime Arbiter                                             │
│ proof action is binding; quality layer is advisory          │
└──────────────────────────────┬─────────────────────────────┘
                               ▼
┌────────────────────────────────────────────────────────────┐
│ Tutor Generation Constraint                                │
│ same proof obligation, selected public conduct mode         │
└──────────────────────────────┬─────────────────────────────┘
                               ▼
┌────────────────────────────────────────────────────────────┐
│ Audit + Evaluation                                          │
│ proof gate, cost gate, ownership, uptake, self-regulation   │
└────────────────────────────────────────────────────────────┘
```

## 5. Core Runtime Objects

Shared scope vocabulary:

```ts
type AdaptationScope = "turn" | "dialogue_block" | "scene" | "act" | "task_session";
```

## 5.1 `ProofControlDecision`

The binding proof-control decision.

```ts
type ProofAction =
  | "release_next_evidence"
  | "repair_dependency"
  | "hold_release"
  | "block_assertion"
  | "invite_final_assertion"
  | "no_proof_action";

interface ProofControlDecision {
  schema: "adaptive-tutor.proof-control.v1";
  source: "hidden_proofDebt";
  scope: "turn";
  action: ProofAction;
  target?: string;
  proofCritical: boolean;
  releaseSafe: boolean;
  nonLeakAudit: AuditResult;
  explanationForLogs: string;
  tutorFacingSummary: string;
}
```

Rules:

- May consume hidden proof state.
- May consume proofDebt.
- May consume release schedule.
- Must not expose raw D arithmetic, hidden proof path, secret, board state, or corruption ledger to the tutor.

## 5.2 `PublicLearnerEvidence`

The shared public evidence substrate for non-proof overlays.

```ts
type LearnerStance =
  | "tentative_correct"
  | "defensive"
  | "fluent_echo"
  | "purpose_question"
  | "near_final"
  | "social_disengagement"
  | "confused"
  | "resistant"
  | "unknown";

interface PublicLearnerEvidence {
  schema: "adaptive-tutor.public-evidence.v1";
  publicOnly: true;
  scope: "turn" | "dialogue_block" | "scene" | "act";
  currentUtterance: string;
  recentUtterances: string[];
  stance: LearnerStance;
  uptakeMarkers: string[];
  resistanceMarkers: string[];
  affectMarkers: string[];
  purposeMarkers: string[];
  echoMarkers: string[];
  uncertaintyMarkers: string[];
  evidenceConfidence: number;
  inputAudit: AuditResult;
}
```

This object must represent bypass and redirection. It must not assume that a learner uses a scaffold merely because the tutor offered one.

## 5.3 `DiscursiveAdaptationState`

A public dialogue-state advisory layer.

```ts
type DiscursiveMode =
  | "minimal_presence"
  | "recognition_repair"
  | "low_pressure_prompt"
  | "permission_to_assert"
  | "purpose_acknowledgement"
  | "phatic_repair"
  | "firm_boundary"
  | "unknown";

interface DiscursiveAdaptationState {
  schema: "adaptive-tutor.discursive.v1";
  publicOnly: true;
  scope: "turn" | "dialogue_block" | "scene" | "act";
  mode: DiscursiveMode;
  pressure: "lower" | "hold" | "raise";
  acknowledgementNeed: "none" | "light" | "explicit";
  shouldAskQuestion: boolean;
  shouldAvoidIntervention: boolean;
  evidence: string[];
  opportunityCostBudget: OpportunityCostBudget;
  inputAudit: AuditResult;
}
```

The key addition is `minimal_presence`. This is a first-class anti-overintervention mode.

## 5.4 `DidacticModeState`

The current didactic mode object should be retained but extended with minimal presence and cost budgeting.

```ts
type DidacticMode =
  | "minimal_presence"
  | "teach_back"
  | "concrete_example"
  | "analogy_bridge"
  | "contrast_case"
  | "slow_recap"
  | "purpose_bridge"
  | "decompose_subtask"
  | "repair_vocabulary"
  | "unknown";

type LearningSignal =
  | "acquiring"
  | "stalled"
  | "misapplied"
  | "echo_only"
  | "purpose_gap"
  | "overloaded"
  | "resistant"
  | "ready_self_work"
  | "unknown";

interface DidacticModeState {
  schema: "adaptive-tutor.didactic-mode.v1";
  publicOnly: true;
  authority: "advisory";
  mayOverrideProofControl: false;
  currentObject?: string;
  learningSignal: LearningSignal;
  recommendedMode: DidacticMode;
  scope: "turn" | "dialogue_block" | "scene" | "act";
  evidence: string[];
  exitCondition: string;
  opportunityCostBudget: OpportunityCostBudget;
  inputAudit: AuditResult;
}
```

`minimal_presence` is selected when the learner is already doing productive work and tutor intervention would likely displace learner reasoning.

## 5.5 `OpportunityCostBudget`

The anti-starvation guard for overlays.

```ts
interface OpportunityCostBudget {
  schema: "adaptive-tutor.opportunity-cost.v1";
  scope: "turn" | "dialogue_block" | "scene" | "act";
  maxProofNeutralTutorTurns: number;
  maxProofNeutralLearnerTurns: number;
  currentProofNeutralTutorTurns: number;
  currentProofNeutralLearnerTurns: number;
  proofCriticalReleasePending: boolean;
  decayHeadroomRisk: "low" | "medium" | "high";
  counterReset: "on_proof_action" | "on_scene_exit" | "on_act_exit";
  onBudgetExhausted:
    | "return_to_proof_control"
    | "mark_ownership_unproven"
    | "ask_single_exit_probe";
}
```

Hard rule:

```text
No didactic, discursive, or ownership intervention may consume more than its budget while a proof-critical release is pending.
```

Default budgets:

| Context | Tutor | Learner |
|---|---:|---:|
| release pending | 0 | 1 |
| repair pending | 1 | 1 |
| no proof debt | 2 | 2 |
| near final | 0 | 0 |

Counting rule:

```text
Proof-neutral tutor turns include diagnostics, explanations, teach-back requests,
examples, contrasts, and metacognitive prompts that do not execute the binding
proof action. A minimal-presence acknowledgement paired with the binding proof
action does not consume a proof-neutral tutor turn. A standalone wait/continue
move does consume the relevant budget.
```

## 5.6 `ObjectOwnershipState`

Evaluation object and optional diagnostic. Not a runtime controller.

```ts
interface ObjectOwnershipState {
  schema: "adaptive-tutor.ownership.v1";
  publicOnly: true;
  objectId: string;
  restatesOwnWords: Score01;
  usesInCurrentPath: Score01;
  discriminatesNearMiss: Score01;
  transfersNearIsomorphic: Score01;
  recoversAfterBreak: Score01;
  explainsPurpose: Score01;
  ownershipScore: number;
  disqualified: boolean;
  disqualificationReason?:
    | "proof_release_mismatch"
    | "hidden_path_leak"
    | "prose_only_gain"
    | "unmatched_context"
    | "unknown";
  evidence: string[];
  inputAudit: AuditResult;
}
```

Ownership criteria:

1. Restate in own words.
2. Use in current proof path.
3. Discriminate from a near miss.
4. Transfer to near-isomorphic case.
5. Recover after a distractor or break.
6. Explain purpose.

## 5.7 `UptakeNegotiationState`

This is a new missing object.

```ts
type UptakeStatus =
  | "accepted_scaffold"
  | "bypassed_scaffold"
  | "redirected_goal"
  | "complied_verbally_only"
  | "resisted"
  | "transformed_task"
  | "unknown";

interface UptakeNegotiationState {
  schema: "adaptive-tutor.uptake.v0";
  publicOnly: true;
  scope: "dialogue_block" | "scene";
  status: UptakeStatus;
  scaffoldOffered?: DidacticMode | DiscursiveMode;
  learnerResponse: string;
  publicEvidence: string[];
  nextActionRecommendation:
    | "continue_same_scaffold"
    | "switch_mode"
    | "minimal_presence"
    | "return_to_proof_control"
    | "human_handoff_candidate";
  confidence: number;
}
```

Purpose: prevent “scaffold offered” from being confused with “scaffold used.”

## 5.8 `SelfRegulationState`

Metacognitive layer.

```ts
interface SelfRegulationState {
  schema: "adaptive-tutor.self-regulation.v0";
  publicOnly: true;
  scope: "dialogue_block" | "scene" | "act";
  plansNextStep: Score01;
  monitorsConfidence: Score01;
  detectsOwnGap: Score01;
  requestsSpecificHelp: Score01;
  checksAnswerConditions: Score01;
  reflectsOnStrategy: Score01;
  selfRegulationScore: number;
  recommendedCoachMove:
    | "minimal_presence"
    | "planning_prompt"
    | "monitoring_prompt"
    | "debugging_prompt"
    | "evaluation_prompt"
    | "return_to_task";
  opportunityCostBudget: OpportunityCostBudget;
}
```

This layer evaluates whether the learner is developing self-regulated learning behavior rather than merely completing the proof.

## 5.9 Deferred `TaskMasteryState`

Future task/session outer-loop object. Included here as a boundary marker, not as a v0 implementation requirement.

```ts
interface TaskMasteryState {
  schema: "adaptive-tutor.task-mastery.v0";
  learnerId: string;
  skillId: string;
  objectId: string;
  masteryEstimate: number;
  uncertainty: number;
  evidenceEvents: MasteryEvidenceEvent[];
  nextTaskRecommendation:
    | "repeat_same_object"
    | "near_transfer"
    | "contrast_case"
    | "increase_difficulty"
    | "review_prerequisite"
    | "pause_for_human";
}
```

This belongs to a separate outer-loop project. It should not be mixed into the current proof-control closeout.

## 5.10 Deferred `HumanHandoffState`

Deployment-layer object. Included here as a boundary marker, not as a v0 implementation requirement.

```ts
interface HumanHandoffState {
  schema: "adaptive-tutor.human-handoff.v0";
  trigger:
    | "repeated_non_uptake"
    | "low_self_regulation"
    | "affective_risk"
    | "proof_reliability_failure"
    | "learner_requests_human"
    | "low_confidence";
  severity: "watch" | "recommend" | "urgent";
  evidence: string[];
  suggestedHumanAction:
    | "teacher_review"
    | "tutor_followup"
    | "small_group_intervention"
    | "do_not_escalate";
}
```

This object adapts who should help, not just what the AI should say.

## 6. Runtime Arbitration Rules

### Rule 1: proof control is binding

```ts
if (proofControl.action !== "no_proof_action") {
  runtime.proofAction = proofControl.action;
  runtime.proofTarget = proofControl.target;
}
```

No quality-layer module may alter `proofAction` or `proofTarget`.

### Rule 1a: broader scopes cannot override narrower proof control

```ts
if (scope !== "turn") {
  runtime.proofAction = currentTurnProofControl.action;
  runtime.proofTarget = currentTurnProofControl.target;
}
```

Dialogue-block, scene, and act decisions may set conduct defaults, exit conditions,
and evaluation expectations. They may not rewrite the current turn's proof action,
proof target, proofDebt state, or release entitlement.

### Rule 2: quality layers alter conduct only

```ts
runtime.conduct = mergeConduct({
  discursiveMode,
  didacticMode,
  rhetoricalMove,
  ownershipDiagnostic,
  selfRegulationDiagnostic
});
```

Allowed changes:

- tone;
- pressure;
- question form;
- analogy / example / contrast framing;
- teach-back request;
- minimal presence;
- recognition repair;
- human-readable explanation.

Forbidden changes:

- release different evidence;
- reveal hidden proof path;
- override proofDebt;
- invite final assertion without proof entitlement;
- extend proof-neutral turns beyond budget.

### Rule 3: opportunity cost always applies

```ts
if (
  budget.proofCriticalReleasePending &&
  budget.currentProofNeutralTutorTurns >= budget.maxProofNeutralTutorTurns
) {
  runtime.conduct = "return_to_proof_control";
}
```

### Rule 4: no-intervention is a first-class action

```ts
if (discursive.shouldAvoidIntervention && proofControl.action === "no_proof_action") {
  runtime.conduct = "minimal_presence";
}
```

Minimal-presence examples:

- brief acknowledgement;
- invite learner to continue;
- no new hint;
- no diagnostic;
- no restatement;
- preserve learner reasoning momentum.

### Rule 5: every overlay emits an audit row

```ts
interface AdaptationTraceEnvelope {
  schema: "adaptive-tutor.trace.v1";
  turn: number;
  proofControl: ProofControlDecision;
  publicEvidence: PublicLearnerEvidence;
  discursive?: DiscursiveAdaptationState;
  didactic?: DidacticModeState;
  ownership?: ObjectOwnershipState;
  uptake?: UptakeNegotiationState;
  selfRegulation?: SelfRegulationState;
  selectedConduct: string;
  blockedActions: string[];
  nonLeakAudit: AuditResult;
  opportunityCostAudit: AuditResult;
}
```

## 7. Module and File Plan

### 7.1 New modules

```text
services/dramaticDerivation/publicEvidence.js
services/dramaticDerivation/discursiveAdaptation.js
services/dramaticDerivation/opportunityCost.js
services/dramaticDerivation/uptakeNegotiation.js
services/dramaticDerivation/selfRegulation.js
services/dramaticDerivation/taskMastery.js
services/dramaticDerivation/adaptationArbiter.js
```

### 7.2 Existing modules to modify

```text
services/dramaticDerivation/didacticMode.js
services/dramaticDerivation/rhetoricalMovePolicy.js
services/dramaticDerivation/engine.js
services/dramaticDerivation/runtimeMonitor.js
services/dramaticDerivation/replay.js
services/dramaticDerivation/index.js
scripts/run-derivation-loop.js
scripts/run-derivation-episode.js
```

### 7.3 New tests

```text
tests/dramaticDerivationPublicEvidence.test.js
tests/dramaticDerivationDiscursiveAdaptation.test.js
tests/dramaticDerivationOpportunityCost.test.js
tests/dramaticDerivationUptakeNegotiation.test.js
tests/dramaticDerivationSelfRegulation.test.js
tests/dramaticDerivationTaskMastery.test.js
tests/dramaticDerivationTaskLoopHeldoutGate.test.js
tests/dramaticDerivationAdaptationArbiter.test.js
```

### 7.4 New commands

```json
{
  "derivation:adaptation-gates": "node scripts/derivation-adaptation-gates.js",
  "derivation:uptake-benchmark": "node scripts/derivation-uptake-benchmark.js",
  "derivation:selfreg-benchmark": "node scripts/derivation-selfreg-benchmark.js",
  "derivation:taskloop-benchmark": "node scripts/derivation-taskloop-benchmark.js",
  "derivation:taskloop-heldout-gate": "node scripts/derivation-taskloop-heldout-gate.js",
  "derivation:human-handoff-probe": "node scripts/derivation-human-handoff-probe.js",
  "derivation:quality-pairs": "node scripts/derivation-quality-pairs.js"
}
```

### 7.5 New exports

```text
exports/dramatic-derivation/layered-adaptation/
  public-evidence-report.md
  opportunity-cost-report.md
  uptake-benchmark-report.md
  selfreg-benchmark-report.md
  taskloop-benchmark-report.md
  taskloop-heldout-gate-report.md
  human-handoff-probe-report.md
  quality-pair-report.md
```

### 7.6 Deferred modules

The task/session module is now opened in `codex/task-session-adaptation` after
the v0 turn/block/scene/act gates merged. The deployment-risk module is opened in
`codex/layered-human-handoff-probe` only as a local advisory probe. Runtime
routing remains deferred:

```text
services/dramaticDerivation/humanHandoff.js
scripts/derivation-human-handoff-probe.js
tests/dramaticDerivationHumanHandoff.test.js
exports/dramatic-derivation/layered-adaptation/human-handoff-probe-report.md
```

Human handoff should reopen only after the task/session layer has passed its
local benchmark and held-out artifact gate. The current deployment-risk gate is
zero-paid and local; it does not execute handoff.

## 8. Evaluation Gates

```text
Gate 0: no hidden/private leakage
Gate 1: proof-control no harm
Gate 2: opportunity-cost budget respected
Gate 3: target local evaluator passes controls
Gate 4: proof-matched transcript gain
Gate 5: held-out artifact gain
Gate 6: human or external validation
```

No policy may skip a gate.

For Layered Adaptive Tutor v0, Gates 0-5 define local completion. Gate 6 is required only for deployment or human-learning claims.

## 8.1 Proof-control gate

Metrics:

- final D;
- grounded assertion;
- release timing;
- proofDebt repair;
- forced/asserted gap;
- overreach;
- lucky leap;
- aporia/disengagement;
- prefix integrity;
- non-leak audit.

Pass condition:

```text
S1 must match S0 on final proof reliability.
```

## 8.2 Ownership gate

Pass condition:

```text
S1 ownership gain >= threshold
AND proof/release matched
AND no prose-only disqualification.
```

Controls:

- positive ownership gain;
- prose-only warmth;
- proof/release-confounded gain;
- hidden-leak disqualification.

## 8.3 Uptake gate

Controls:

| Control | Expected |
|---|---|
| scaffold accepted | positive |
| scaffold bypassed | not positive |
| verbal compliance | not positive |
| goal redirection | classified |
| resistance | classified |
| task transformation | classified |

Pass condition:

```text
12/12 controls pass before artifact scoring.
```

## 8.4 Minimal-presence gate

Controls:

| Pair | Expected |
|---|---|
| learner working, tutor interrupts | worse |
| learner working, tutor waits | better |
| learner stalled, tutor waits | worse |
| learner stalled, tutor prompts | better |

Pass condition:

```text
minimal-presence scorer detects when non-intervention preserves learner reasoning.
```

## 8.5 Self-regulation gate

Metrics:

- learner plans next step;
- monitors confidence;
- detects own gap;
- asks specific help;
- checks answer conditions;
- reflects on strategy.

Pass condition:

```text
S1 improves self-regulation without proof-control harm.
```

## 8.6 Task-loop gate

Candidate microbench:

```text
Given a mastery trace and a set of next tasks,
choose the next task.
```

Candidate actions:

- `repeat_same_object`;
- `near_transfer`;
- `contrast_case`;
- `review_prerequisite`;
- `increase_difficulty`;
- `human_followup`.

Pass condition:

```text
Task-loop selector improves simulated or human-scored task choice over fixed progression.
```

Current local gate:

```bash
npm run derivation:taskloop-benchmark
```

## 8.7 Human validation gate

Two human gates are needed later:

1. Human expert coding for tutor conduct, uptake, and ownership.
2. Human learner pre/post/transfer for actual learning.

## 9. Work Plan

## Phase 0: Completed Closeout and Plan Hygiene

**Goal:** prevent old proof-control arcs from reopening.

Status: completed by the A20/A21 closeout PR. This worktree should only re-check that no stale runtime-promotion language has reappeared.

Tasks:

1. Confirm the top-level "closed / not promoted" banner remains in `ADAPTIVE-TUTOR-ACTIVE-PLAN.md`.
2. Confirm legacy Phase 6/progress-policy continuation text remains under an archive heading.
3. Confirm ownership and didactic plans state:
   - evaluator exists;
   - benchmark controls passed;
   - mined artifact pool stayed negative;
   - no paid run warranted.
4. Confirm the regression command appendix remains present.

Exit rule:

```text
No document presents A20/A21/didactic/ownership as pending runtime promotion from the current artifact pool.
```

## Phase 1: Public Evidence and Opportunity Cost

**Goal:** make all overlays consume one shared public evidence substrate and one shared cost budget.

Scope coverage:

```text
turn, dialogue_block, scene, act
```

Implementation:

```text
publicEvidence.js
opportunityCost.js
adaptationArbiter.js
```

Tests:

```text
node --test tests/dramaticDerivationPublicEvidence.test.js
node --test tests/dramaticDerivationOpportunityCost.test.js
node --test tests/dramaticDerivationAdaptationArbiter.test.js
```

Fixtures:

- proof-critical release pending + teach-back request;
- learner already reasoning + tutor diagnostic;
- learner stuck + minimal prompt;
- purpose question + release pending;
- repeated echo + no proof debt.
- scene-level default that would overrun a turn-level proof-critical release.
- act-level recommendation that must stay advisory when current proof action is binding.

Exit rule:

```text
All overlays are blocked when their cost budget would starve proof progress.
```

## Phase 2: Minimal-Presence Extension

**Goal:** add “do not intervene” as an explicit conduct mode.

Implementation:

```text
discursiveAdaptation.js
didacticMode.js
rhetoricalMovePolicy.js
```

New mode:

```text
minimal_presence
```

Tutor-facing template:

```text
The learner is currently doing the reasoning work. Do not add a new explanation,
diagnostic, example, or proof content. Acknowledge briefly and invite them to
continue or complete their current line.
```

Exit rule:

```text
Minimal-presence controls pass at turn/block/scene scope, and proof-control fields remain unchanged.
```

## Phase 3: Uptake Negotiation Benchmark

**Goal:** prevent scaffold-offered from being mistaken for scaffold-used.

Implementation:

```text
uptakeNegotiation.js
scripts/derivation-uptake-benchmark.js
tests/dramaticDerivationUptakeNegotiation.test.js
```

Benchmark controls:

- accepted scaffold;
- bypassed scaffold;
- verbal compliance only;
- redirected goal;
- resistant learner;
- transformed task.

Example output:

```json
{
  "status": "bypassed_scaffold",
  "confidence": 0.86,
  "recommendedNextAction": "switch_mode",
  "evidence": ["learner asks for answer instead of using contrast case"]
}
```

Exit rule:

```text
12/12 controls pass before artifact scoring.
```

## Phase 4: Self-Regulation Microbench

**Goal:** test metacognitive adaptation separately from proof and ownership.

Implementation:

```text
selfRegulation.js
scripts/derivation-selfreg-benchmark.js
tests/dramaticDerivationSelfRegulation.test.js
```

Move set:

- minimal presence;
- planning prompt;
- monitoring prompt;
- debugging prompt;
- evaluation prompt;
- return to task.

Local evaluator:

```text
Did the next learner turn show planning, monitoring, gap detection, specific help-seeking, condition checking, or strategy reflection?
```

Exit rule:

```text
Evaluator passes controls and finds at least one proof-safe gain before runtime wiring.
```

## Phase 5: Proof-Matched Quality Pairing

**Goal:** evaluate transcript quality with proof held fixed.

Implementation:

```text
scripts/derivation-quality-pairs.js
config/evaluation-rubric-dialogue.yaml
config/evaluation-rubric-learner.yaml
config/evaluation-rubric-tutor-holistic.yaml
config/evaluation-rubric-poetics.yaml
```

Pair constraints:

- same world;
- same proof action sequence;
- same release timing;
- same final D;
- same assertion status;
- same learner model/provider;
- no hidden leakage.

Scored dimensions:

- dialogue quality;
- learner ownership;
- didactic clarity;
- uptake negotiation;
- recognition repair;
- minimal-presence appropriateness;
- dramatic form.

Exit rule:

```text
S1 wins quality pairwise by predeclared margin
AND proof-control no-harm holds.
```

## Phase 6: Task-Loop Adaptation Prototype

**Goal:** open a separate outer-loop adaptation project only after the step-loop is cleanly bounded.

Status: merged by PR #71 from `codex/task-session-adaptation`. This phase remains outside
the merged v0 in-dialogue worktree and did not reopen proof-control policy.

Implementation:

```text
services/dramaticDerivation/taskMastery.js
scripts/derivation-taskloop-benchmark.js
tests/dramaticDerivationTaskMastery.test.js
```

Initial data source:

- proof-object mastery traces;
- ownership scores;
- transfer probe results;
- error categories;
- number of repairs.

Candidate next-task actions:

```text
repeat_same_object, near_transfer, contrast_case, review_prerequisite, increase_difficulty, human_followup
```

Exit rule:

```text
Task-loop selector improves simulated or human-scored task choice over fixed progression.
```

Completion rule for this branch:

```text
The deterministic task-loop benchmark passes, adaptive recommendations beat the
fixed progression baseline, and `TaskMasteryState` remains public-only and
advisory.
```

## Phase 7: Held-Out Task-Loop Artifact Gate

**Goal:** test whether task/session selection still beats fixed progression on held-out derivation artifacts without hidden proof-state input and without proof-control behavior changes.

Status: merged by PR #72 from `codex/taskloop-heldout-gate`.

Implementation:

```text
services/dramaticDerivation/taskLoopHeldoutGate.js
scripts/derivation-taskloop-heldout-gate.js
tests/dramaticDerivationTaskLoopHeldoutGate.test.js
tests/fixtures/taskloop-heldout-artifacts.json
```

Gate inputs:

- public ownership, transfer, uptake, self-regulation, repair, and error signals;
- frozen artifact provenance;
- expected next-task labels;
- opaque proof-control fingerprints used only for equality/no-harm checks.

Exit rule:

```text
Adaptive task/session recommendations must beat fixed progression on the
held-out artifact set, all selector inputs must pass the public-only audit, and
fixed/adaptive proof-control fingerprints must be byte-equivalent.
```

Completion rule for this branch:

```text
`npm run derivation:taskloop-heldout-gate` writes a passing report, the focused
held-out gate test passes, workplan validation passes, and no runtime,
human-learning, or proof-control promotion claim is made.
```

Completion result:

```text
The zero-paid gate passed: 12/12 adaptive recommendations versus 2/12 fixed
progression, 0 public-only failures, and 0 proof-control drift rows.
```

## Deferred Project B: Human / Hybrid Escalation Probe

**Goal:** add “who should help?” as an adaptation action.

Status: active in `codex/layered-human-handoff-probe` as a zero-paid local
probe. Do not implement runtime routing in this branch.

Implementation:

```text
humanHandoff.js
scripts/derivation-human-handoff-probe.js
tests/dramaticDerivationHumanHandoff.test.js
```

Triggers:

- repeated non-uptake;
- low self-regulation;
- affective risk;
- proof reliability failure;
- learner requests human;
- low model confidence.

Exit rule:

```text
Handoff recommendations are conservative, auditable, and never replace proof-control logs.
```

Completion rule for this branch:

```text
`npm run derivation:human-handoff-probe` writes a passing report, the focused
handoff tests pass, workplan validation passes, and no runtime routing,
human-learning, safety, or proof-control promotion claim is made.
```

## 10. Reopening Criteria for Proof-Control Adaptation

Do not reopen proof-control policy unless all are true:

1. There is a predeclared hidden+proofDebt failure.
2. The failure is first-pass or replay-gated.
3. The limiting cause is classified:
   - action choice;
   - learner uptake;
   - discourse texture;
   - decay/repair continuity;
   - world instability;
   - runtime overconstraint.
4. A public signal exists before the failing action.
5. A candidate policy improves the outcome without held-out negative transfer.

## 11. Reporting Standard

Every report should include:

```text
Title
Date
Zero-paid / paid status
Substrate flags
Worlds / prefixes
S0 and S1 definitions
Proof-control gate
Opportunity-cost gate
Overlay decision table
Learner-state evaluator table
Transcript-quality table
Failure labels
Decision: closed / continue / promote / archive
Paper-impact note
```

Mandatory language when an overlay improves prose but not learning:

```text
This is a transcript-quality gain, not proof-control adaptation and not human-learning evidence.
```

Mandatory language when no qualifying gain is found:

```text
Closed as valid negative for this artifact pool. Do not rescore the same pool looking for a win.
```

## 12. Risk Register

| Risk | Mitigation |
|---|---|
| selector reopening | archive banner |
| progress starvation | cost budget |
| prose-only wins | ownership controls |
| uptake assumption | uptake state |
| LLM-student artifacts | human validation |
| overintervention | minimal presence |
| hidden leakage | recursive audit |
| task-loop confusion | separate project |
| learning overclaim | transfer gate |

## 13. Immediate Commit Sequence

### Commit 1: v0 scope and plan cleanup

```text
docs: scope layered adaptive tutor v0
```

Files:

```text
PLAN_2_0/layered_adaptive_tutor_technical_spec.md
```

### Commit 2: public evidence substrate

```text
derivation: add public evidence and opportunity-cost objects
```

Files:

```text
services/dramaticDerivation/publicEvidence.js
services/dramaticDerivation/opportunityCost.js
services/dramaticDerivation/adaptationArbiter.js
tests/dramaticDerivationPublicEvidence.test.js
tests/dramaticDerivationOpportunityCost.test.js
tests/dramaticDerivationAdaptationArbiter.test.js
```

### Commit 3: minimal presence

```text
derivation: add minimal-presence advisory mode
```

Files:

```text
services/dramaticDerivation/discursiveAdaptation.js
services/dramaticDerivation/didacticMode.js
services/dramaticDerivation/rhetoricalMovePolicy.js
tests/dramaticDerivationMinimalPresence.test.js
```

### Commit 4: uptake benchmark

```text
derivation: add uptake negotiation benchmark
```

Files:

```text
services/dramaticDerivation/uptakeNegotiation.js
scripts/derivation-uptake-benchmark.js
tests/dramaticDerivationUptakeNegotiation.test.js
exports/dramatic-derivation/layered-adaptation/uptake-benchmark-report.md
```

### Commit 5: self-regulation microbench

```text
derivation: add self-regulation evaluator scaffold
```

Files:

```text
services/dramaticDerivation/selfRegulation.js
scripts/derivation-selfreg-benchmark.js
tests/dramaticDerivationSelfRegulation.test.js
```

### Commit 6: quality-pair evaluator

```text
derivation: add proof-matched quality-pair scorer
```

Files:

```text
scripts/derivation-quality-pairs.js
exports/dramatic-derivation/layered-adaptation/quality-pair-report.md
```

The v0 commit sequence did not add task-loop or human-handoff modules. Those are
handled in later outer-loop worktrees.

### Task/session branch commit

For `codex/task-session-adaptation`:

```text
derivation: add task-session mastery benchmark
```

Files:

```text
PLAN_2_0/layered_adaptive_tutor_technical_spec.md
package.json
services/dramaticDerivation/index.js
services/dramaticDerivation/taskMastery.js
scripts/derivation-taskloop-benchmark.js
tests/dramaticDerivationTaskMastery.test.js
workplan/items/layered-task-session-adaptation.md
```

Validation:

```bash
node --test tests/dramaticDerivationTaskMastery.test.js
npm run derivation:taskloop-benchmark -- --out "$tmp/taskloop-benchmark"
npm run wp:validate
```

### Held-out task-loop gate branch commit

For `codex/taskloop-heldout-gate`:

```text
derivation: add held-out task-loop artifact gate
```

Files:

```text
PLAN_2_0/layered_adaptive_tutor_technical_spec.md
package.json
services/dramaticDerivation/index.js
services/dramaticDerivation/taskLoopHeldoutGate.js
scripts/derivation-taskloop-heldout-gate.js
tests/dramaticDerivationTaskLoopHeldoutGate.test.js
tests/fixtures/taskloop-heldout-artifacts.json
workplan/items/layered-taskloop-heldout-gate.md
```

Validation:

```bash
node --test tests/dramaticDerivationTaskLoopHeldoutGate.test.js
npm run derivation:taskloop-heldout-gate -- --out "$tmp/taskloop-heldout-gate"
npm run wp:validate
```

## 14. Success Claims by Layer

| Layer | Claim type |
|---|---|
| Proof | reliability |
| Discursive | conduct quality |
| Didactic | explanatory regime |
| Ownership | public use |
| Uptake | scaffold use |
| Self-reg | metacognition |
| Task-loop | sequencing |
| Human | escalation |

Do not collapse these into “adaptive tutor works.”

Layered Adaptive Tutor v0 may make claims only for proof, discursive, didactic,
ownership, uptake, self-regulation, and proof-matched transcript quality. The
task/session layer now adds one local advisory sequencing claim: under the
task-loop benchmark and held-out artifact gate, public learner/task signals beat
fixed progression for next-task recommendation while proof-control fingerprints
remain unchanged. It must not claim runtime task assignment, human escalation,
proof-control promotion, or human-learning evidence until those deferred
projects are opened and validated.

The human/hybrid handoff probe may add only a local advisory deployment-risk
classification claim: public signals can trigger conservative human/hybrid
review recommendations in deterministic controls. It must not claim actual
routing, safety coverage, deployed reliability, or human-learning evidence.

Correct claim form:

```text
At layer L, under gate G, signal S changed decision D and improved outcome O
without violating proof-control reliability.
```

## 15. Literature Anchors

The technical direction is consistent with several current research signals:

- LLM tutor adaptivity remains difficult; LLMs only marginally reproduce intelligent-tutoring-system adaptivity in benchmark scenarios.
- Metacognitive tutoring requires deciding when to intervene and when to remain minimally present; current models over-intervene.
- Simulated learners are fragile proxies for human learners.
- AI-assisted task completion can diverge from durable human learning.
- Human-AI hybrid tutoring may require adapting who helps, not only what the AI says.

Representative references:

- MetaCLASS: Metacognitive Coaching for Learning with Adaptive Self-regulation Support, arXiv:2602.02457. https://arxiv.org/abs/2602.02457
- Can Large Language Models Match Tutoring System Adaptivity? A Benchmarking Study, arXiv:2504.05570. https://arxiv.org/abs/2504.05570
- Generative AI alone may not be enough: Evaluating AI Support for Learning Mathematical Proof, arXiv:2509.16778. https://arxiv.org/abs/2509.16778
- Towards Valid Student Simulation with Large Language Models, arXiv:2601.05473. https://arxiv.org/abs/2601.05473
- Improving Hybrid Human-AI Tutoring by Differentiating Human Tutor Roles Based on Student Needs, arXiv:2605.11155. https://arxiv.org/abs/2605.11155
- Tutor CoPilot, arXiv:2410.03017. https://arxiv.org/abs/2410.03017

## 16. Final Recommendation

Build the next project as **Layered Adaptive Tutor v0**, with hidden+proofDebt frozen as the proof-control kernel and turn/block/scene/act scopes made explicit.

The first implementation should not add a new proof controller. It should add:

1. shared public evidence extraction across turn/block/scene/act;
2. opportunity-cost budgeting across turn/block/scene/act;
3. minimal-presence mode as advisory conduct;
4. uptake negotiation evaluation;
5. self-regulation evaluation;
6. proof-matched quality-pair scoring.

This route studies richer adaptation without undoing the main result of A20/A21. The current paper and closeout establish that proof-control overlays are not promotable from the artifact pool. The next technical object is an auditable set of in-dialogue quality and learner-state layers that can show gains while hidden+proofDebt remains untouched. Task/session sequencing and human handoff remain later outer-loop projects.
