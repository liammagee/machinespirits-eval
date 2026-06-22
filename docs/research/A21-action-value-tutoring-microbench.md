# A21 Action-Value Tutoring Microbench: Detailed Implementation Plan

**Status:** proposed next active arc
**Date:** 2026-06-16
**Predecessor:** A20 Conduct-Policy Compiler
**Primary baseline:** `hidden + proofDebt`
**Primary kill-gate world:** Hethel, especially the Phase 5g failure prefix and the hidden-success contrast

---

## 0. One-sentence shift

A20 regulated what the tutor was allowed to say. A21 tests what the tutor's saying *does* to a durable learner state.

A21 should therefore stop treating typed move compliance as the primary evidence of adaptivity. The new unit is:

```text
fixed trigger state
  -> concrete tutor action
  -> learner-state transition
  -> progress-sensitive reward
  -> action-value estimate
  -> only then policy compilation
```

---

## 1. Evidence basis and rationale

### 1.1 What A20 established

A20 built useful infrastructure:

- trigger corpus and replayable fixtures;
- `EntitlementState` / `ConductPolicySpec` style machinery;
- opt-in runtime logging and enforcement;
- replay screens from frozen prefixes;
- first-pass validation discipline;
- local conduct compliance audits;
- progress-aware and learner-entitlement increments.

But the A20 active plan's Phase 5 and Phase 6 results show the core limitation: local conduct compliance can improve while adaptive tutoring still fails. In Phase 5g, the promoted selector-v4/conduct arm passed local compliance but failed Hethel by disengagement with final `D=4`, while hidden+proofDebt grounded all three paired worlds. The active plan labels this as policy-level negative transfer from repeated visible/hidden-conflict diagnostics and delayed releases. Phase 6 then repaired some replay symptoms but still failed to clear the local grounding gate. The plan's closing diagnosis is the right starting point for A21: **local conduct compliance is not enough if the policy starves proof progress**.

### 1.2 What the selector trajectory established

The selector arc from v0 to v4 did not establish adaptive hidden/visible representation selection. It established that hidden pacing plus proofDebt is a strong reliability mechanism: it preserves proof continuity under decay, repairs before advance, disciplines final assertion, and resists misleading visible fluency. The H/V distinction remains real, but it is the wrong hinge for the next implementation. The live control problem is not hidden versus visible. It is **which pedagogical action has the best expected learner-state transition under proof-debt constraints**.

### 1.3 What the broader paper established

The consolidated mechanism paper repeatedly points in the same direction:

- recognition and error correction are supported mechanisms;
- adaptive responsiveness is null in the primary trajectory analysis;
- insight often fails to become action under lightweight bridges;
- learned `state -> action` policies and retrieval policies fail against the strong implicit base on the transfer-valid channel;
- concealed learner interiors do not provide a privileged signal;
- A18-style policy transfer works only under gated per-card headroom where S0 would otherwise take a decoy.

A21 should preserve the methodological discipline of A18 and the reliability substrate of hidden+proofDebt, while changing the target from **move compliance** to **action value**.

---

## 2. Research question for A21

> From a fixed tutoring trigger state, can we estimate which concrete pedagogical action produces the best learner-state transition, and then compile a policy only after the action-value evidence exists?

### Operational hypothesis

A tutoring policy becomes genuinely adaptive only when it can satisfy this causal contract:

```text
learner state is durable enough to constrain the tutor
  -> tutor chooses among real alternative actions
  -> action changes learner state or fails to
  -> reward measures the state transition and progress cost
  -> the next policy is selected because it improved that outcome
```

### Minimal promotable claim

The strongest claim A21 should try to earn is:

> On a fixed Hethel-class trigger state, an action-value microbench identifies a concrete action that improves learner-state transition and proof progress over the action preferred by the failed A20 overlay, while matching or not harming hidden+proofDebt on final grounding in replay.

A21 should **not** claim general adaptive tutoring, human learning, model-weight learning, or broad H/V selector success.

---

## 3. Non-goals and hard exclusions

Do **not** implement A21 as any of the following:

1. Another H/V selector.
2. Another visible/hidden diagnostic taxonomy.
3. Another conduct-policy promotion attempt.
4. Another fitted policy over logged traces without logged propensities.
5. Another generic reflection, critic, or superego layer.
6. Another LLM-learner-only synthetic dyad where the learner can self-recohere.
7. Another paid first-pass run before offline and replay gates pass.
8. Another post-hoc Hethel explanation that changes the fixture after observing the result.

A21 should be a microbench, not a new production controller.

---

## 4. Core design principle

A20 asked:

```text
Is this tutor move licensed by the policy?
```

A21 asks:

```text
Compared with the alternatives available at the same trigger state,
what did this tutor action change in the learner state,
and what did it cost in proof progress?
```

This requires four new load-bearing objects:

1. `LearnerState`: a durable, updateable state not reducible to transcript style.
2. `A21Action`: concrete alternatives, not just broad move families.
3. `TransitionOutcome`: observed changes from `LearnerState_t` to `LearnerState_t+1`.
4. `RewardBreakdown`: a progress-sensitive reward with explicit opportunity costs.

---

## 5. Target architecture

A21 should sit beside the A20 conduct-policy stack, not replace the derivation harness.

```text
Frozen prefix / trigger state
  + WorldIR
  + GuardSpec
  + ProofDebtReport
  + PublicLearnerEvidence
  + DurableLearnerState
  + CandidateActionSet
      -> A21TrialRunner
      -> TutorActionExecutor
      -> PersistentLearnerSimulator or constrained learner
      -> TransitionAuditor
      -> RewardScorer
      -> ActionValueReport
      -> optional PolicyPatchProposal
```

### Relationship to A20

A20 remains useful infrastructure for:

- locating trigger states;
- replaying frozen prefixes;
- exposing proofDebt and guard metadata;
- logging conduct decisions;
- auditing non-leak and generator compliance;
- comparing against hidden+proofDebt.

A21 should **not** treat A20 policy compliance as reward. It should consume A20 logs as context and then measure action consequences.

---

## 6. New or modified repository surfaces

Assuming the existing dramatic-derivation code layout, Codex should add these files.

```text
services/dramaticDerivation/a21/
  actionSet.js
  learnerState.js
  learnerSimulator.js
  transitionAudit.js
  rewardScorer.js
  trialRunner.js
  analysis.js

scripts/
  a21-hethel-autopsy.js
  a21-build-trigger-fixture.js
  a21-run-microbench.js
  a21-analyze-microbench.js
  a21-report.js

tests/
  dramaticDerivationA21ActionSet.test.js
  dramaticDerivationA21LearnerState.test.js
  dramaticDerivationA21LearnerSimulator.test.js
  dramaticDerivationA21TransitionAudit.test.js
  dramaticDerivationA21RewardScorer.test.js
  dramaticDerivationA21TrialRunner.test.js

exports/dramatic-derivation/a21-action-value/
  hethel-autopsy.md
  hethel-trigger-fixture.json
  action-set.json
  microbench-trials.jsonl
  transition-outcomes.jsonl
  action-value-report.md
  policy-patch-proposal.md
```

Use the existing code style and test runner conventions. Do not create a parallel adaptive tutor subsystem.

---

## 7. Data model

### 7.1 `A21TriggerFixture`

A trigger fixture freezes the state at which an action choice matters.

```ts
export type A21TriggerFixture = {
  fixtureId: string;
  worldId: string;
  sourceRunId: string;
  sourceArtifact: string;
  prefixThroughTurn: number;
  triggerTurn: number;
  triggerLabel: string;
  baselineArm: "hidden_proofDebt" | string;
  failedOverlayArm?: string;

  proofState: {
    D: number;
    liveDebts: string[];
    decayedDebts: string[];
    currentReleaseWindow: string[];
    blockedReleases: string[];
    forcedReleases: string[];
  };

  publicEvidence: {
    learnerLastUtterance: string;
    tutorLastUtterance?: string;
    visibleConflictSignals: string[];
    assertedClaims: string[];
    ownedClaims: string[];
    echoOnlyClaims: string[];
  };

  hiddenSuccessContrast?: {
    runId: string;
    firstDivergentTurn: number;
    actionSummary: string;
    outcomeSummary: string;
  };

  failedOverlayContrast?: {
    runId: string;
    firstDivergentTurn: number;
    actionSummary: string;
    outcomeSummary: string;
  };

  expectedDecisionPoint: {
    candidateActions: string[];
    knownBadPattern: string;
    hypothesizedBetterPattern: string;
    nonLeakConstraints: string[];
  };
};
```

### 7.2 `DurableLearnerState`

The learner state must be external to the tutor's public text. Start with a deterministic finite-state learner, then optionally add a constrained LLM surface renderer.

```ts
export type DurableLearnerState = {
  stateId: string;
  misconception: "mirror_dead_predicate" | "missing_dependency" | "none";
  frustration: "low" | "medium" | "high";
  engagement: "engaged" | "strained" | "aporia" | "disengaged";
  confidence: "low" | "medium" | "high";

  evidenceSeen: Record<string, boolean>;
  dependencyOwned: Record<string, boolean>;
  dependencyEchoedOnly: Record<string, boolean>;
  alternativeRouteCandidate: boolean;

  diagnosticHistory: {
    count: number;
    lastDiagnosticTurn?: number;
    answeredSubstantively: number;
    repeatedWithoutNewEvidence: number;
  };

  proofProgress: {
    D: number;
    lastDDelta: number;
    turnsSinceDDecrease: number;
    releasesOnSchedule: string[];
    delayedReleases: string[];
    earlyReleases: string[];
  };

  transitionFlags: {
    targetDependencyRepaired: boolean;
    learnerCanUsePPoint: boolean;
    learnerCanUsePSurface: boolean;
    learnerReadyForFinalAssertion: boolean;
  };
};
```

### 7.3 `A21Action`

Actions are concrete interventions. They may map onto A20 move families, but they must be more specific than the family name.

```ts
export type A21Action = {
  actionId: string;
  moveFamily:
    | "ask_diagnostic"
    | "release_next_evidence"
    | "repair_dependency"
    | "consolidate_subproof"
    | "invite_final_assertion"
    | "block_assertion";

  description: string;
  tutorInstruction: string;
  releaseDirectives: {
    releaseNow: string[];
    hold: string[];
    noLeak: string[];
  };
  expectedStateChange: Partial<DurableLearnerState>;
  knownRisks: string[];
  opportunityCost: {
    consumesTurn: boolean;
    delaysRelease: string[];
    mayIncreaseFrustration: boolean;
    mayLeak: boolean;
  };
};
```

### 7.4 `TransitionOutcome`

```ts
export type TransitionOutcome = {
  trialId: string;
  fixtureId: string;
  actionId: string;
  seed?: number;
  learnerStateBefore: DurableLearnerState;
  learnerStateAfter: DurableLearnerState;
  tutorText: string;
  learnerText: string;

  observed: {
    DBefore: number;
    DAfter: number;
    DDelta: number;
    targetDependencyOwnedBefore: boolean;
    targetDependencyOwnedAfter: boolean;
    targetDependencyEchoedOnlyAfter: boolean;
    engagementAfter: DurableLearnerState["engagement"];
    releaseDeviations: string[];
    nonLeakPassed: boolean;
    generatorCompliant: boolean;
  };

  failureLabel?:
    | "none"
    | "policy_failure"
    | "generator_compliance_failure"
    | "learner_state_noop"
    | "release_starvation"
    | "over_scaffolding"
    | "aporia"
    | "disengagement"
    | "leak"
    | "world_instability"
    | "detector_artifact";
};
```

### 7.5 `RewardBreakdown`

Use a transparent scalar reward only for ranking actions inside the microbench. Always report the component table.

```ts
export type RewardBreakdown = {
  trialId: string;
  actionId: string;
  total: number;
  components: {
    finalGrounding?: number;
    DDecrease: number;
    targetDependencyOwned: number;
    learnerUsesReleasedEvidence: number;
    engagementMaintained: number;
    noLeak: number;
    generatorCompliance: number;
    releaseOnSchedule: number;
    diagnosticRepetitionPenalty: number;
    delayedReleasePenalty: number;
    earlyReleasePenalty: number;
    aporiaPenalty: number;
    disengagementPenalty: number;
    overScaffoldingPenalty: number;
  };
};
```

Initial scoring weights should be deliberately simple and frozen before running:

```js
const DEFAULT_A21_REWARD_WEIGHTS = {
  DDecrease: 2,
  targetDependencyOwned: 3,
  learnerUsesReleasedEvidence: 2,
  engagementMaintained: 1,
  noLeak: 2,
  generatorCompliance: 1,
  releaseOnSchedule: 1,
  diagnosticRepetitionPenalty: -2,
  delayedReleasePenalty: -2,
  earlyReleasePenalty: -1,
  aporiaPenalty: -4,
  disengagementPenalty: -6,
  overScaffoldingPenalty: -2,
};
```

---

## 8. Candidate action set for the Hethel kill gate

Start with exactly four actions. Freeze them before running.

| Action ID | Move family | Concrete action | Hypothesized upside | Known risk |
|---|---|---|---|---|
| `A_DIAG_CONFLICT` | `ask_diagnostic` | Ask the learner to name the visible/hidden conflict or dead-predicate mismatch. | May surface misconception without leaking. | A20 showed repeated diagnostics can starve release and trigger aporia. |
| `B_RELEASE_P_POINT` | `release_next_evidence` | Release `p_point` now and ask the learner to use it in the next relation. | May reduce proof debt and restore progress. | Could leak or advance before ownership. |
| `C_RESTAGE_P_POINT` | `repair_dependency` | Restage `p_point` without accelerating the release schedule. | May repair dependency while preserving pacing. | May repeat hidden+proofDebt behavior without new value. |
| `D_CONSOLIDATE_THEN_RELEASE` | `consolidate_subproof` | Ask learner to consolidate the current subproof, then authorize release only if consolidation succeeds. | May preserve ownership and progress. | May become another maintenance move that delays proof advance. |

A21 succeeds only if the action-value table gives a reason to prefer one action under explicit preconditions. It is acceptable if the result is that hidden+proofDebt's action is already best.

---

## 9. Implementation phases

## Phase 0 — Freeze A20 and open A21

### Goal

Prevent A21 from becoming another A20 promotion patch.

### Codex tasks

1. Create `docs/research/A21-action-value-tutoring-microbench.md` from this plan.
2. Add a short status note to `ADAPTIVE-TUTOR-ACTIVE-PLAN.md`:
   - A20 is frozen as conduct-policy infrastructure.
   - Hethel Phase 5g/6 is a valid negative against conduct/progress/entitlement overlay promotion.
   - A21 is a separate action-value microbench arc.
3. Do not modify selector defaults.
4. Do not enable conduct enforcement by default in hidden+proofDebt.
5. Add an A21 section to the project task index if one exists.

### Exit rule

A20 remains frozen; no default runtime behavior changes.

---

## Phase 1 — Contrastive Hethel autopsy

### Goal

Locate the first action point where the successful hidden+proofDebt transcript and failed A20/Phase 6 transcripts diverge in action-value terms.

### Inputs

- `exports/dramatic-derivation/phase5g-a20-fresh-report.md`
- `hethel` / `Hethel` Phase 5g hidden success run, especially `hethel-phase5g-a20-fresh-hidden-r1`
- failed promoted selector-v4/conduct run
- Phase 6 progress-policy replay
- Phase 6 learner-entitlement replay
- any persisted per-turn `D`, releases, proofDebt, conduct, and learner text metadata

### Codex tasks

1. Implement `scripts/a21-hethel-autopsy.js`.
2. Parse the successful hidden+proofDebt run and the failed A20/Phase 6 runs.
3. Emit a turn-by-turn table with:
   - turn index;
   - tutor action family;
   - concrete action summary;
   - learner response summary;
   - `D` before/after;
   - releases due, released, delayed, early;
   - conduct-policy decision if present;
   - proofDebt repairs;
   - engagement/aporia/disengagement markers.
4. Detect the first divergent action choice between hidden success and overlay failure.
5. Classify the divergence:
   - `release_starvation`;
   - `diagnostic_overuse`;
   - `consolidation_overuse`;
   - `learner_uptake_failure`;
   - `runtime_overconstraint`;
   - `proofDebt_guard_difference`;
   - `detector_artifact`.
6. Write:
   - `exports/dramatic-derivation/a21-action-value/hethel-autopsy.md`
   - `exports/dramatic-derivation/a21-action-value/hethel-autopsy.json`

### Acceptance criteria

- The autopsy identifies one primary trigger state, not a list of possible triggers.
- The report names the action S0 took, the action S1 took, and the observed downstream effect.
- The result is zero-paid and reproducible from existing artifacts.

### Command target

```bash
node scripts/a21-hethel-autopsy.js \
  --hidden-run exports/dramatic-derivation/<hidden-success>.json \
  --failed-run exports/dramatic-derivation/<failed-overlay>.json \
  --out exports/dramatic-derivation/a21-action-value/hethel-autopsy.md
```

---

## Phase 2 — Build the A21 trigger fixture

### Goal

Freeze the Hethel trigger state as a reusable microbench context.

### Codex tasks

1. Implement `scripts/a21-build-trigger-fixture.js`.
2. Read the autopsy JSON.
3. Extract the prefix through the chosen trigger turn.
4. Persist safe public fields and non-leaking proof summaries.
5. Store the candidate action set separately from observed outcomes.
6. Validate that the fixture does not include hidden proof paths or secret solution text in tutor-facing fields.

### Output

```text
exports/dramatic-derivation/a21-action-value/hethel-trigger-fixture.json
exports/dramatic-derivation/a21-action-value/action-set.json
```

### Acceptance criteria

- The fixture is deterministic and stable under repeated loading.
- The fixture names exactly four candidate actions.
- No action has been selected as winner inside the fixture.
- The fixture can be loaded by tests without LLM calls.

### Test target

```bash
node --test tests/dramaticDerivationA21ActionSet.test.js
```

---

## Phase 3 — Implement a durable learner-state simulator

### Goal

Make learner resistance external enough to constrain the tutor.

The first simulator should be deterministic and finite-state. An LLM can later render learner prose, but it must not own the hidden misconception update.

### Codex tasks

1. Add `services/dramaticDerivation/a21/learnerState.js`.
2. Add `services/dramaticDerivation/a21/learnerSimulator.js`.
3. Implement `initialHethelLearnerState(fixture)`.
4. Implement `applyTutorActionToLearnerState(state, action, tutorText, releaseInfo)`.
5. Enforce update rules such as:
   - repeated diagnostics without new evidence increase `diagnosticHistory.repeatedWithoutNewEvidence` and may move engagement toward `aporia`;
   - `release_next_evidence` can set `evidenceSeen[p_point] = true` only if the action actually releases `p_point`;
   - `repair_dependency` can set `dependencyOwned[p_point] = true` only if the evidence has been seen or the restaging text contains a permitted public restatement;
   - `consolidate_subproof` can improve ownership only when the learner already owns the immediate predecessor dependency;
   - the learner cannot self-recohere from `mirror_dead_predicate` to `none` without a targeted evidence or repair action.
6. Add tests for every transition rule.

### Acceptance criteria

- The simulator state changes only through explicit action effects.
- The learner cannot spontaneously repair the target misconception.
- Repeated diagnostics become costly.
- Release and ownership are separate variables.
- Tests cover at least one no-op action, one successful repair, one release, and one aporia transition.

### Test target

```bash
node --test tests/dramaticDerivationA21LearnerState.test.js \
  tests/dramaticDerivationA21LearnerSimulator.test.js
```

---

## Phase 4 — Implement concrete action execution

### Goal

Generate or assemble tutor turns for each candidate action while keeping the action controlled.

### Codex tasks

1. Add `services/dramaticDerivation/a21/actionSet.js`.
2. Implement `loadActionSet(fixtureId)`.
3. Implement a deterministic tutor-action template mode for zero-cost tests.
4. Optionally implement an LLM tutor-action mode later, but keep it opt-in.
5. Ensure each action emits:
   - move family;
   - tutor-facing instruction;
   - release directive;
   - non-leak constraints;
   - expected transition claims.
6. Integrate with existing non-leak audit if available.

### Acceptance criteria

- Each action can be executed without an LLM.
- Each action produces a tutor text stub and release metadata.
- The action executor never mutates the fixture.
- The action executor logs the selected action and action probability.

### Why log probability now?

Prior off-policy attempts lacked logged propensities, which forced conservative direct-method and on-policy-agreement evaluations. A21 should log assignment probabilities from the start, even in a tiny balanced design, so later analysis can use proper contextual-bandit estimators if the microbench expands.

### Test target

```bash
node --test tests/dramaticDerivationA21ActionSet.test.js
```

---

## Phase 5 — Transition audit and reward scorer

### Goal

Score what the action changed, not whether the move label looked correct.

### Codex tasks

1. Add `services/dramaticDerivation/a21/transitionAudit.js`.
2. Add `services/dramaticDerivation/a21/rewardScorer.js`.
3. Implement `auditTransition(before, action, tutorText, learnerText, after)`.
4. Implement `scoreReward(outcome, weights)`.
5. Emit both scalar reward and component table.
6. Freeze the default weights in code and in the report.
7. Add tests for:
   - diagnostic overuse penalty;
   - delayed release penalty;
   - target dependency ownership reward;
   - aporia/disengagement penalty;
   - no-leak pass/fail;
   - final D improvement.

### Acceptance criteria

- No hidden outcome label is used as an input to the action selector.
- Reward components sum exactly to the scalar reward.
- The reward table is understandable without reading code.
- The scorer can classify a locally compliant `ask_diagnostic` as low-value if it delays release and increases aporia risk.

### Test target

```bash
node --test tests/dramaticDerivationA21TransitionAudit.test.js \
  tests/dramaticDerivationA21RewardScorer.test.js
```

---

## Phase 6 — Balanced microbench runner

### Goal

Run the same trigger state against each candidate action and estimate local action value.

### Codex tasks

1. Add `services/dramaticDerivation/a21/trialRunner.js`.
2. Implement `scripts/a21-run-microbench.js`.
3. Accept arguments:
   - `--fixture`;
   - `--actions`;
   - `--k` learner draws per action;
   - `--mode deterministic|llm-rendered`;
   - `--seed`;
   - `--out`.
4. For deterministic mode:
   - run each action once or for a small fixed set of deterministic learner variants;
   - log action probability as `1 / numberOfActions`.
5. For optional LLM-rendered mode:
   - keep the finite-state learner as ground truth;
   - use the LLM only to verbalize the next learner utterance from the updated state;
   - never let LLM prose update hidden learner state directly.
6. Emit JSONL rows for all trials.

### Minimal design

```text
fixture: Hethel trigger state
candidate actions: 4
learner variants: deterministic base + optional 4 stochastic surface renders
total trials: 4 to 20
primary analysis: component reward and transition table, not significance
```

### Acceptance criteria

- Every action is evaluated from the same fixture.
- Action order is randomized or balanced and logged.
- Assignment probabilities are logged.
- The runner can be executed zero-paid in deterministic mode.
- The microbench report does not select a production policy by default.

### Command target

```bash
node scripts/a21-run-microbench.js \
  --fixture exports/dramatic-derivation/a21-action-value/hethel-trigger-fixture.json \
  --actions exports/dramatic-derivation/a21-action-value/action-set.json \
  --mode deterministic \
  --k 1 \
  --seed 20260616 \
  --out exports/dramatic-derivation/a21-action-value/microbench-trials.jsonl
```

---

## Phase 7 — Analysis and action-value report

### Goal

Produce the smallest credible action-value result.

### Codex tasks

1. Add `services/dramaticDerivation/a21/analysis.js`.
2. Implement `scripts/a21-analyze-microbench.js`.
3. Aggregate by action:
   - mean reward;
   - reward component totals;
   - D delta;
   - target dependency ownership rate;
   - engagement/aporia/disengagement rate;
   - release deviations;
   - generator compliance;
   - non-leak audit.
4. Compare each action to:
   - the A20 failed overlay action pattern;
   - the hidden+proofDebt success action if identifiable;
   - the do-nothing/no-op template if included.
5. Emit:
   - `action-value-report.md`;
   - `action-value-report.json`;
   - optional CSV summary.

### Decision categories

| Category | Meaning | Next step |
|---|---|---|
| `hidden_action_best` | Hidden+proofDebt action has best or tied-best transition value. | Stop. Report A21 as explaining why baseline is strong. |
| `release_beats_diagnostic` | Release action improves D/ownership and avoids aporia relative to diagnostic. | Draft a narrow policy patch proposal. |
| `repair_beats_release` | Repair action improves ownership without leak or progress starvation. | Draft repair-first policy patch with release budget. |
| `all_actions_fail` | No action improves learner state or progress. | The trigger fixture is not a useful adaptive wedge; stop. |
| `simulator_artifact` | Result depends on arbitrary simulator rule. | Revise simulator before policy patch; do not run fresh validation. |

### Acceptance criteria

- The report includes component rewards, not just winners.
- The report identifies opportunity cost for the top action.
- The report either proposes a narrow policy patch or explicitly stops.

### Command target

```bash
node scripts/a21-analyze-microbench.js \
  --trials exports/dramatic-derivation/a21-action-value/microbench-trials.jsonl \
  --out exports/dramatic-derivation/a21-action-value/action-value-report.md
```

---

## Phase 8 — Policy patch proposal, not automatic promotion

### Goal

Convert action-value evidence into a narrow candidate policy only if the microbench justifies it.

### Codex tasks

1. Implement `scripts/a21-report.js` to create `policy-patch-proposal.md`.
2. The proposal must specify:
   - exact trigger preconditions;
   - preferred action;
   - blocked actions;
   - diagnostic budget;
   - release conditions;
   - non-leak constraints;
   - expected learner-state transition;
   - known failure modes;
   - replay gate before fresh validation.
3. Do **not** modify runtime policy in this phase unless explicitly authorized.

### Patch template

```yaml
policy_patch_id: a21_hethel_release_after_diagnostic_budget
status: proposed_only
applies_when:
  world_class: heth_el_like_mirror_dead_predicate
  visible_hidden_conflict: true
  diagnostic_budget_exhausted: true
  proofDebt_live: [p_point]
  release_authorized_now: true
  learner_engagement_not_disengaged: true
prefer:
  action: release_next_evidence
  release: [p_point]
  tutor_instruction: "Give the learner the next public piece and ask them to use it, rather than asking a further diagnostic."
block:
  - repeated_ask_diagnostic_without_new_evidence
  - consolidate_subproof_if_it_delays_authorized_release
expected_transition:
  dependencyOwned[p_point]: increase
  D: decrease_or_remain_solvable
  engagement: remain_engaged_or_strained
kill_if:
  - replay_final_D_gt_0
  - aporia_or_disengagement
  - leak
  - delayed_required_release
```

### Acceptance criteria

- The patch is narrower than A20's conduct policy.
- The patch is backed by an action-value table.
- The patch is not promoted by the same script that proposes it.

---

## Phase 9 — Replay gate against hidden+proofDebt

### Goal

Test whether the proposed policy patch survives the Hethel replay gate before any fresh paid run.

### Candidate arms

```text
S0: hidden + proofDebt
S1: hidden + proofDebt + A21 proposed policy patch
```

Do not include selector-v4 unless replaying a historical selector-v4 prefix as a diagnostic. The promoted claim is against hidden+proofDebt.

### Codex tasks

1. Add an opt-in flag such as `--a21-policy-patch <patch-id>`.
2. Integrate the patch only for replay mode first.
3. Replay from the frozen Hethel trigger prefix.
4. Preserve prefix identity.
5. Log:
   - selected action;
   - release timing;
   - D curve;
   - learner-state transition;
   - reward components;
   - final grounding;
   - aporia/disengagement;
   - leak/generator compliance.

### Replay pass rule

S1 must satisfy all of these:

- matches or beats S0 on final grounding;
- does not end with `D > 0`;
- does not fail by aporia or disengagement;
- improves the targeted local transition over the failed A20 action;
- does not introduce a release leak;
- does not delay a required release relative to S0.

### Replay fail rule

If S1 ends `D > 0`, fails by aporia/disengagement, leaks, or delays required release, stop. Do not run a fresh paid retest. Report `valid_negative`.

---

## Phase 10 — No-harm replay screen

Only run this phase after Hethel replay passes.

### Goal

Ensure the A21 patch does not damage a non-Hethel hidden+proofDebt success prefix.

### Candidate prefixes

- one Withercombe hidden+proofDebt success;
- one Ravensmark hidden+proofDebt success;
- optionally Lantern/Marrick if selector-v4 risk remains relevant.

### Pass rule

S1 must match S0 on:

- final grounding;
- final `D=0`;
- forced/asserted gap;
- no overreach;
- no lucky leap;
- no fabrication;
- no new aporia/disengagement.

If no-harm replay fails, keep the policy as a Hethel-local experimental result only.

---

## Phase 11 — Fresh first-pass validation

Only run this phase if Phase 9 and Phase 10 pass.

### Goal

Check whether the replay result survives fresh generation.

### Candidate minimal run

```text
worlds: Hethel only first, then one no-harm world if Hethel passes
arms:
  S0 = hidden + proofDebt
  S1 = hidden + proofDebt + A21 patch
replicates:
  small first-pass canary only
```

### Promotion threshold

A21 earns a narrow promoted claim only if:

1. S1 matches or beats S0 on final grounding in Hethel.
2. S1 improves the targeted local learner-state transition.
3. S1 does not introduce aporia/disengagement.
4. S1 does not delay required releases.
5. S1 survives at least one no-harm world.
6. The report preserves all failures and does not relabel them after seeing outcomes.

---

## 10. Testing plan

### Unit tests

```bash
node --test \
  tests/dramaticDerivationA21ActionSet.test.js \
  tests/dramaticDerivationA21LearnerState.test.js \
  tests/dramaticDerivationA21LearnerSimulator.test.js \
  tests/dramaticDerivationA21TransitionAudit.test.js \
  tests/dramaticDerivationA21RewardScorer.test.js \
  tests/dramaticDerivationA21TrialRunner.test.js
```

### Integration tests

```bash
node scripts/a21-hethel-autopsy.js --fixture-smoke
node scripts/a21-build-trigger-fixture.js --smoke
node scripts/a21-run-microbench.js --mode deterministic --k 1 --smoke
node scripts/a21-analyze-microbench.js --smoke
```

### Regression tests

Run existing A20 and proofDebt tests after each integration change:

```bash
node --test \
  tests/dramaticDerivationConductPolicy.test.js \
  tests/dramaticDerivationReplay.test.js \
  tests/dramaticDerivationProofDebt.test.js \
  tests/dramaticDerivationRuntimeMonitor.test.js
```

Full suite only after unit/integration tests pass:

```bash
npm test
```

---

## 11. Reporting standard

Every A21 report must include:

1. Exact command(s).
2. Zero-paid versus paid status.
3. Source runs and artifact paths.
4. Frozen fixture hash or checksum.
5. Candidate action set.
6. Learner-state model version.
7. Transition rules.
8. Reward weights.
9. Action assignment probabilities.
10. Per-action transition table.
11. Per-action reward component table.
12. Failure labels.
13. Comparison to hidden+proofDebt.
14. Whether a policy patch is proposed.
15. Whether fresh validation is blocked or authorized.

---

## 12. Failure labels

Reuse A20 labels where possible, but add action-value-specific labels.

```text
policy_failure
  The proposed policy selected the wrong action.

generator_compliance_failure
  The selected action was right, but the tutor text did not execute it.

learner_state_noop
  The learner state did not change in the targeted variable.

release_starvation
  The action delayed a necessary release and progress stalled.

diagnostic_overuse
  The action repeated diagnostics after the budget was exhausted.

over_scaffolding
  The action maintained support after the learner needed release or transfer.

aporia
  Learner enters unresolved confusion while proof progress stalls.

disengagement
  Learner exits productive participation.

leak
  Tutor exposes hidden proof path or solution-only content.

world_instability
  Effective constraints changed due to decay/release mechanics rather than the policy.

detector_artifact
  A classifier, detector, or parser produced the apparent effect.

valid_negative
  The experiment was well-formed and the action simply did not help.
```

---

## 13. Kill rules

A21 should stop rather than iterate if any of the following occurs:

1. The Hethel autopsy cannot identify a single primary divergent action point.
2. The trigger fixture requires hidden solution leakage to represent the state.
3. The durable learner simulator cannot prevent self-recoherence.
4. The best action wins only because of an arbitrary simulator rule.
5. No action improves target learner-state transition over the baseline.
6. Replay with the proposed policy ends `D > 0`.
7. Replay fails by aporia or disengagement.
8. No-harm replay damages a hidden+proofDebt success.
9. A policy patch requires adding a new broad move-family taxonomy.
10. The implementation begins to promote selector-v4 or conduct enforcement by default.

A clean negative is a successful A21 outcome if it explains why hidden+proofDebt remains hard to beat.

---

## 14. Codex checklist

### Work packet A — planning and freeze

- [ ] Add `docs/research/A21-action-value-tutoring-microbench.md`.
- [ ] Add A21 status note to `ADAPTIVE-TUTOR-ACTIVE-PLAN.md`.
- [ ] Confirm selector-v4 does not imply conduct enforcement by default.
- [ ] Confirm hidden+proofDebt remains the baseline.

### Work packet B — autopsy

- [ ] Create `scripts/a21-hethel-autopsy.js`.
- [ ] Parse hidden success and failed overlay transcripts.
- [ ] Emit turn-level divergence table.
- [ ] Freeze primary trigger state.
- [ ] Write `hethel-autopsy.md` and `.json`.

### Work packet C — fixture and action set

- [ ] Create `scripts/a21-build-trigger-fixture.js`.
- [ ] Create `services/dramaticDerivation/a21/actionSet.js`.
- [ ] Emit `hethel-trigger-fixture.json`.
- [ ] Emit `action-set.json` with four actions.
- [ ] Add action-set tests.

### Work packet D — learner state

- [ ] Create `learnerState.js`.
- [ ] Create `learnerSimulator.js`.
- [ ] Implement deterministic Hethel learner state.
- [ ] Implement transition rules.
- [ ] Add no-self-recoherence tests.

### Work packet E — transition and reward

- [ ] Create `transitionAudit.js`.
- [ ] Create `rewardScorer.js`.
- [ ] Freeze reward weights.
- [ ] Add component-sum tests.
- [ ] Add diagnostic-overuse and release-starvation tests.

### Work packet F — microbench runner

- [ ] Create `trialRunner.js`.
- [ ] Create `scripts/a21-run-microbench.js`.
- [ ] Log action probabilities.
- [ ] Emit `microbench-trials.jsonl`.
- [ ] Add trial-runner tests.

### Work packet G — analysis and report

- [ ] Create `analysis.js`.
- [ ] Create `scripts/a21-analyze-microbench.js`.
- [ ] Emit action-value table.
- [ ] Emit reward component table.
- [ ] Emit failure labels.
- [ ] Decide stop / patch proposal.

### Work packet H — optional policy patch

- [ ] Generate `policy-patch-proposal.md`.
- [ ] Do not apply patch automatically.
- [ ] Require explicit authorization before runtime integration.

### Work packet I — replay and validation gates

- [ ] Add opt-in replay-only patch flag.
- [ ] Run Hethel replay gate.
- [ ] Stop on D>0, aporia, disengagement, or leak.
- [ ] Run no-harm replay only if Hethel passes.
- [ ] Run fresh first-pass only if replay gates pass.

---

## 15. Expected outputs

```text
exports/dramatic-derivation/a21-action-value/
  hethel-autopsy.md
  hethel-autopsy.json
  hethel-trigger-fixture.json
  action-set.json
  microbench-trials.jsonl
  transition-outcomes.jsonl
  action-value-report.md
  action-value-report.json
  policy-patch-proposal.md          # only if justified
```

Suggested npm scripts:

```json
{
  "derivation:a21-autopsy": "node scripts/a21-hethel-autopsy.js",
  "derivation:a21-fixture": "node scripts/a21-build-trigger-fixture.js",
  "derivation:a21-microbench": "node scripts/a21-run-microbench.js",
  "derivation:a21-analyze": "node scripts/a21-analyze-microbench.js",
  "derivation:a21-report": "node scripts/a21-report.js"
}
```

---

## 16. How to read possible outcomes

### Outcome 1: Hidden+proofDebt action is best

This is a useful result. It means A21 explains why the reliability substrate is hard to beat. Report:

> In the Hethel kill-gate trigger, the hidden+proofDebt action has the best action-value profile; A20 failed because its overlay replaced a high-value progress action with locally compliant maintenance.

Stop without policy patch.

### Outcome 2: Release beats diagnostic

This is the most likely useful positive. Report:

> Repeated diagnostic pressure after visible/hidden conflict has negative action value once release is authorized; `release_next_evidence` improves proof progress and learner-state ownership without leak.

Draft a narrow policy patch with diagnostic budget and release authorization preconditions.

### Outcome 3: Repair beats release

Report:

> The adaptive failure was not diagnostics per se but a missing repair form; the useful action is a dependency repair that creates ownership before release.

Draft a repair-first patch with a strict turn budget.

### Outcome 4: All actions fail

Report:

> The Hethel trigger fixture does not contain an adaptive wedge under the current state model.

Stop. Do not expand taxonomy until the fixture is better understood.

### Outcome 5: Simulator artifact

Report:

> The apparent action-value difference depends on arbitrary learner-state rules.

Revise simulator and repeat only the zero-paid microbench. Do not run replay or paid validation.

---

## 17. Literature anchors for implementation choices

A21 borrows its engineering shape from established adaptive-tutoring and policy-evaluation ideas:

- VanLehn's ITS framing separates the inner loop over student steps from the outer loop over task selection; A21 is an inner-loop action-value microbench, not an outer-loop curriculum planner.
- Bayesian knowledge tracing models changing learner knowledge state during skill acquisition; A21 starts with a small hand-built durable learner state rather than claiming a full KT model.
- The assistance dilemma motivates the reward penalties for repeated diagnostics, over-scaffolding, and delayed release.
- Contextual-bandit policy evaluation motivates logging action probabilities from the start; prior project OPE was limited by missing propensities.
- LLM dialogue knowledge tracing and tutor-DPO work show the direction of travel for later phases: tutor utterances should ultimately be optimized against predicted student correctness/state transitions plus pedagogical quality, not just move labels.
- The self-correction literature motivates using external learner-state feedback rather than trusting intrinsic LLM reflection.

References are listed at the end so this note can live in the repository without depending on ChatGPT citation markup.

---

## 18. References

- VanLehn, K. (2006). *The Behavior of Tutoring Systems*. International Journal of Artificial Intelligence in Education. https://cs.uky.edu/~sgware/reading/papers/vanlehn2006behavior.pdf
- Corbett, A. T., & Anderson, J. R. (1995). *Knowledge tracing: Modeling the acquisition of procedural knowledge*. User Modeling and User-Adapted Interaction. https://link.springer.com/article/10.1007/BF01099821
- Koedinger, K. R., & Aleven, V. (2007). *Exploring the Assistance Dilemma in Experiments with Cognitive Tutors*. Educational Psychology Review. https://link.springer.com/article/10.1007/s10648-007-9049-0
- Dudik, M., Langford, J., & Li, L. (2011). *Doubly Robust Policy Evaluation and Learning*. ICML / arXiv. https://arxiv.org/abs/1103.4601
- Scarlatos, A., Baker, R. S., & Lan, A. (2024). *Exploring Knowledge Tracing in Tutor-Student Dialogues using LLMs*. arXiv. https://arxiv.org/abs/2409.16490
- Scarlatos, A., Liu, N., Lee, J., Baraniuk, R., & Lan, A. (2025). *Training LLM-based Tutors to Improve Student Learning Outcomes in Dialogues*. arXiv. https://arxiv.org/abs/2503.06424
- Kamoi, R., Zhang, Y., Zhang, N., Han, J., & Zhang, R. (2024). *When Can LLMs Actually Correct Their Own Mistakes? A Critical Survey of Self-Correction of LLMs*. TACL / arXiv. https://arxiv.org/abs/2406.01297
