# Genuine Adaptation Runtime Loop: Implementation Plan

**Repository:** `machinespirits-eval-derivation`  
**Target area:** `services/adaptiveTutor/`, adaptive cells, trap-suite evaluation  
**Status:** implementation-ready plan  
**Purpose:** convert adaptation from a post-hoc scored property into an executable runtime policy.

---

## 1. Diagnosis

The project is close to genuine adaptation, but the remaining gap is not mainly measurement. The repository already has strong ingredients: bilateral tutor/learner traces, adaptive trap suites, cross-suite trap scenarios, proof/release/ownership analysis, ownership benchmarks, A20/A21-style disqualification logic, adaptive smoke tests, and hermetic evaluation support.

The missing piece is a binding runtime loop. The current architecture can still produce *adaptation-shaped dialogue*: the tutor changes tone, hint level, or strategy after a learner turn, and evaluators later judge whether that looked adaptive. Genuine adaptation requires a tutor to maintain a falsifiable model of the learner, choose an intervention intended to change that model, observe whether the change happened, and update policy accordingly.

The intended loop is:

```text
observe learner turn
→ infer learner state, including uncertainty
→ select a typed pedagogical action
→ check proof/release/ownership constraints
→ generate the tutor utterance as an implementation of that action
→ observe whether the expected state transition occurred
→ update the learner-state belief and intervention ledger
→ repeat
```

The core failure mode is proof/release/ownership mismatch:

- proof without release: the tutor explains well but keeps control;
- release without proof: the tutor backs off without evidence of understanding;
- ownership without proof: the learner expresses a preference but does not author task-relevant reasoning.

The scorer can already detect these mismatches. The next step is to prevent them at runtime.

---

## 2. Design goal

Add a **Genuine Adaptation Policy Layer** to the adaptive runner. The policy layer should separate:

1. learner-state estimation;
2. candidate pedagogical-action generation;
3. action scoring;
4. proof/release/ownership gating;
5. minimum-sufficient-intervention selection;
6. tutor utterance generation under an explicit adaptation contract;
7. outcome observation on the next learner turn;
8. intervention-ledger update;
9. counterfactual replay for evaluation.

The first implementation should be deterministic and hermetic, with later LLM-backed state estimation and utterance generation allowed behind flags.

---

## 3. New modules

Add these modules under `services/adaptiveTutor/`:

```text
adaptationPolicy.js
pedagogicalActions.js
learnerStateBelief.js
proofReleaseOwnershipGate.js
interventionLedger.js
outcomeObserver.js
counterfactualPolicyReplay.js
```

Add tests:

```text
tests/adaptiveTutorPolicy.test.js
```

Add an optional evaluation script:

```text
scripts/evaluate-adaptation-policy.js
```

Add generated outputs under:

```text
exports/adaptive-policy/
```

---

## 4. Adaptation contract

Every adaptive tutor turn should create a machine-readable contract before producing natural language:

```json
{
  "version": "genuine_adaptation_policy_v0.1",
  "turn_index": 2,
  "learner_state_belief": {
    "top_hypothesis": "approval_dependency",
    "confidence": 0.68,
    "alternatives": [
      { "state": "conceptual_gap", "confidence": 0.18 },
      { "state": "notation_overload", "confidence": 0.14 }
    ],
    "evidence": ["learner asks for confirmation before committing"]
  },
  "selected_action": {
    "id": "forced_choice_with_justification",
    "type": "transfer_control",
    "target_axis": "ownership",
    "secondary_axis": "proof",
    "control_cost": 0.35
  },
  "expected_transition": {
    "proof": "+",
    "release": "+",
    "ownership": "+"
  },
  "forbidden_moves": [
    "supply_decisive_step",
    "premature_validation"
  ],
  "success_signal": "learner chooses a strategy and gives a reason before tutor validation"
}
```

This contract must precede the tutor message. The tutor should not be allowed to retroactively rationalize what it was doing.

---

## 5. Learner-state belief model

Start with a compact operational state set:

```js
const LEARNER_STATES = {
  CONCEPTUAL_GAP: 'conceptual_gap',
  PROCEDURAL_WITHOUT_RATIONALE: 'procedural_without_rationale',
  MISREADING_TASK: 'misreading_task',
  NOTATION_OVERLOAD: 'notation_overload',
  APPROVAL_DEPENDENCY: 'approval_dependency',
  OVERCONFIDENT_ERROR: 'overconfident_error',
  PRODUCTIVE_STRUGGLE: 'productive_struggle',
  OWNED_STRATEGY_READY: 'owned_strategy_ready'
};
```

Each state belief should include:

```js
{
  conceptual: 'missing' | 'fragile' | 'adequate' | 'strong',
  procedural: 'none' | 'partial' | 'fluent',
  rationale: 'absent' | 'borrowed' | 'emerging' | 'owned',
  ownership: 'passive' | 'cue_responsive' | 'choice_ready' | 'self_directing',
  affect: 'neutral' | 'frustrated' | 'defensive' | 'confident' | 'overconfident',
  topHypothesis: string,
  confidence: number,
  alternatives: Array<{ state: string, confidence: number }>,
  evidence: string[]
}
```

The state estimator must preserve uncertainty. When confidence is low, the preferred action should often be discriminating rather than explanatory.

Initial deterministic signals:

| Learner signal | State evidence |
|---|---|
| “I don’t know why” | conceptual gap or rationale absence |
| correct procedure with no explanation | procedural without rationale |
| repeated “is that right?” | approval dependency |
| confident wrong assertion | overconfident error |
| focus on symbols/notation | notation overload |
| learner proposes a plan | owned strategy ready |

---

## 6. Pedagogical action registry

The tutor should choose from an explicit action space before generating text.

Initial action object:

```js
{
  id: 'request_evidence',
  type: 'proof_elicitation',
  description: 'Ask the learner to justify a step or choice before tutor validation.',
  targetAxis: 'proof',
  secondaryAxis: 'ownership',
  controlCost: 0.30,
  releaseEffect: 0.10,
  proofEffect: 0.35,
  ownershipEffect: 0.20,
  usefulFor: ['procedural_without_rationale', 'overconfident_error'],
  riskyFor: ['notation_overload']
}
```

Initial action set:

| Action ID | Type | Main use |
|---|---|---|
| `diagnose_misconception` | diagnosis | Identify conceptual gap. |
| `elicit_prediction` | diagnostic proof | Test anticipation and causal understanding. |
| `request_evidence` | proof elicitation | Require justification before validation. |
| `contrast_two_models` | conceptual repair | Compare misconception and target model. |
| `fade_hint` | scaffold fading | Reduce support while maintaining progress. |
| `forced_choice_with_justification` | ownership transfer | Make learner choose and defend a strategy. |
| `challenge_without_telling` | productive friction | Address overconfident error without giving answer. |
| `notation_translation` | representation repair | Reduce notation overload. |
| `summarize_and_release` | release | Hand control back after sufficient proof. |
| `reanchor_to_goal` | goal repair | Return learner to task objective. |
| `direct_explanation` | high-control repair | Use only when needed. |
| `worked_example` | high-control support | Use only when lower-control actions are insufficient. |

Action-state fit table:

| Learner state | Preferred actions | Avoid |
|---|---|---|
| conceptual gap | diagnose, contrast models, elicit prediction | premature release |
| procedural without rationale | request evidence, elicit prediction | direct validation |
| misreading task | reanchor to goal, diagnose | lengthy conceptual explanation |
| notation overload | notation translation, small repair | challenge without telling |
| approval dependency | forced choice, summarize and release | validation-first response |
| overconfident error | challenge without telling, request evidence | praise and move on |
| productive struggle | fade hint, request evidence | worked example |
| owned strategy ready | summarize and release, ask learner to execute | direct explanation |

---

## 7. Minimum sufficient intervention

Policy scoring should optimize learner-state improvement while penalizing tutor control:

```js
score =
  expectedProofGain * proofWeight +
  expectedReleaseGain * releaseWeight +
  expectedOwnershipGain * ownershipWeight -
  controlCost * controlPenalty -
  repeatFailurePenalty -
  mismatchRiskPenalty;
```

Tie-breaker:

```js
if (Math.abs(scoreA - scoreB) < 0.05) {
  choose lower controlCost;
}
```

The design principle is:

```text
maximize learner-state improvement with the minimum tutor control sufficient to produce proof.
```

---

## 8. Proof/release/ownership gate

The runtime gate should block actions that create known false positives.

Hard rules:

1. Do not release when proof evidence is below threshold.
2. Do not supply the decisive reasoning step during an ownership-transfer turn.
3. Do not validate correctness before learner commitment when ownership is the target.
4. Do not repeat a failed action for the same state unless a repair reason is recorded.
5. Do not use high-control actions if a lower-control action has comparable expected gain.
6. Do not count learner assent as proof.
7. Do not count learner preference as ownership unless it constrains the next task move.

Candidate gate output:

```js
{
  actionId: 'direct_explanation',
  allowed: false,
  reasons: [
    'supplies_decisive_step_during_ownership_transfer',
    'higher_control_than_needed'
  ]
}
```

Suggested thresholds:

```js
const PROOF_THRESHOLD_FOR_RELEASE = 0.60;
const OWNERSHIP_THRESHOLD_FOR_RELEASE = 0.45;
```

---

## 9. Intervention ledger

The ledger records what the tutor tried and whether it worked.

Ledger entry:

```js
{
  id: 'turn-2-action-forced-choice',
  turnIndex: 2,
  learnerStateBefore: { ... },
  selectedAction: { ... },
  expectedTransition: {
    proof: '+',
    release: '+',
    ownership: '+'
  },
  successSignal: 'learner chooses strategy and justifies it before validation',
  status: 'pending',
  observedTransition: null,
  learnerStateAfter: null,
  policyUpdate: null
}
```

Closing a ledger entry should:

1. observe whether the expected signal appeared;
2. estimate the new state;
3. compute proof/release/ownership deltas;
4. mark status as succeeded, failed, or inconclusive;
5. record what should change next.

If the same action fails for the same top hypothesis, subsequent scoring should apply a repeat-failure penalty.

---

## 10. Outcome observer

The observer should evaluate the next learner turn prospectively against the prior contract.

Example output:

```js
{
  proofDelta: 0.18,
  releaseDelta: 0.10,
  ownershipDelta: 0.24,
  success: true,
  evidence: [
    'learner selected denominator-conversion strategy',
    'learner justified choice using common units'
  ],
  mismatch: false
}
```

Mismatch detection should flag:

- release increased without proof;
- tutor supplied decisive proof while ownership was scored as increased;
- learner ownership increased only through preference or assent;
- proof appeared in tutor text but not learner text.

---

## 11. Counterfactual replay

For each critical learner state, compare the selected action against plausible alternatives.

Mechanism:

1. generate candidate actions;
2. estimate expected transition for each;
3. apply gates;
4. compare selected action to best allowed action and reactive baseline;
5. compute regret.

```js
regret = bestAllowedExpectedScore - selectedExpectedScore;
```

Report:

```json
{
  "mean_counterfactual_regret": 0.059,
  "selected_best_allowed_rate": 0.86,
  "blocked_high_control_false_positive_rate": 0.91
}
```

---

## 12. Integration plan

### Phase 1: documentation and trace schema

- Add this implementation plan to the root folder.
- Add the deterministic evaluation report to the root folder.
- Add `ADAPTATION_POLICY_TRACE_VERSION = 'genuine_adaptation_policy_v0.1'`.
- Define the trace object shape without changing production behavior.

### Phase 2: deterministic policy modules

Implement:

- `learnerStateBelief.js`
- `pedagogicalActions.js`
- `proofReleaseOwnershipGate.js`
- `interventionLedger.js`
- `outcomeObserver.js`
- `counterfactualPolicyReplay.js`
- `adaptationPolicy.js`

Keep these modules pure where possible.

### Phase 3: tests

Add tests for:

- state estimation with uncertainty;
- action-state fit;
- gate blocking proof/release/ownership mismatches;
- minimum-sufficient-intervention tie-breaks;
- ledger pending and closure states;
- repeat-failure penalty;
- outcome observation;
- counterfactual regret;
- baseline comparison.

Run:

```bash
npm test
npm run test:hermetic
```

### Phase 4: adaptive runner flag

Add feature flag in adaptive cell config:

```yaml
adaptation_policy:
  enabled: true
  version: genuine_adaptation_policy_v0_1
  gate_mode: hard
  counterfactual_replay: true
  min_sufficient_intervention: true
```

Do not modify historical adaptive cells silently. Add a new cell or explicit variant.

### Phase 5: smoke evaluation

Run deterministic smoke evaluation with mock LLM:

```bash
ADAPTIVE_TUTOR_LLM=mock node scripts/run-adaptive-cell-smoke.js
```

Then run policy-specific evaluation:

```bash
node scripts/evaluate-adaptation-policy.js
```

### Phase 6: trap-suite evaluation

Compare:

- current adaptive cell;
- new policy-loop adaptive cell;
- standard dialogue-engine baseline;
- cross-suite trap cell if applicable.

Metrics:

- strict proof/release/ownership success;
- state top-1 accuracy;
- action-state fit;
- tutor-control cost;
- proof/release mismatch rate;
- counterfactual regret;
- repeated failed intervention rate;
- ownership-with-proof rate.

### Phase 7: real-LLM evaluation

Only after deterministic tests pass:

```bash
ADAPTIVE_TUTOR_LLM=real node scripts/run-adaptive-cell-smoke.js
```

Then compare runs using existing analysis scripts. Always preserve judge-model filters and rubric-version discipline.

---

## 13. Acceptance criteria

A first implementation is acceptable if:

1. existing tests still pass;
2. new deterministic policy tests pass;
3. the adaptive runner can emit adaptation contracts without breaking existing traces;
4. the gate blocks direct explanation during ownership-transfer turns;
5. the ledger prevents repeated failed interventions;
6. counterfactual replay produces non-null regret metrics;
7. mock adaptive smoke runs complete;
8. no historical data is retroactively mutated;
9. new empirical claims are not added to spin-off documents unless reflected first in `docs/research/paper-full-2.0.md`.

A stronger implementation is acceptable if it shows, in mock and real runs:

- lower proof/release mismatch;
- lower control cost;
- equal or better proof;
- higher ownership-with-proof;
- lower counterfactual regret;
- fewer repeated failed interventions.

---

## 14. Risks

| Risk | Mitigation |
|---|---|
| Policy becomes another prompt wrapper | Make action selection explicit and typed before utterance generation. |
| Gate over-constrains tutor | Add soft mode after hard-mode tests. |
| State labels become brittle | Store alternatives and uncertainty, not just top label. |
| Tests overfit deterministic fixtures | Add same-surface/different-hidden-state scenarios. |
| Metrics inflate through scripted learners | Evaluate against dynamic learner cells and real-LLM runs after mock validation. |
| New paper claims drift | Follow root `AGENTS.md` paper-authoring discipline. |

---

## 15. Core thesis

The next breakthrough is not a better judge. It is making the tutor’s adaptation contract executable.

A genuine adaptive tutor must know, before it speaks:

```text
What state do I believe the learner is in?
What uncertainty remains?
What change am I trying to produce?
What action is most likely to produce it?
What am I forbidden from doing because it would fake ownership or proof?
How will I know whether the action worked?
What will I do differently if it fails?
```

Until that loop is explicit and binding, the system will keep producing convincing adaptive behavior without reliably producing adaptive state change.
