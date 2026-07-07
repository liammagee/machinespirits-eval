# Genuine Adaptation Runtime Loop: Detailed Implementation and Evaluation Plan

**Status:** Implementation-ready design
**Target repository:** `machinespirits-eval-derivation`
**Primary target:** `services/adaptiveTutor/`
**Date:** 2026-06-18

## 1. Executive summary

The repository has increasingly strong machinery for detecting adaptation-shaped behavior: bilateral traces, trap scenarios, strategy-shift scoring, learner-ownership measures, proof/release disqualifiers, counterfactual replay, and post-hoc analysis. The remaining gap is architectural rather than primarily evaluative.

The tutor still needs an explicit, binding control loop that separates:

1. learner-state estimation;
2. pedagogical action selection;
3. runtime constraint checking;
4. natural-language realization;
5. outcome observation;
6. learner-state and policy updating.

This plan implements that loop first in the LangGraph adaptive runner, behind a feature flag and with deterministic mock support. The central artifact is an **Adaptation Contract** attached to every tutor turn. It states what the tutor believes, what action it selected, what learner-state transition it expects, what moves are forbidden, and what evidence will count as success. The following learner turn closes the contract by recording whether the expected transition occurred.

The implementation deliberately avoids treating fluent variation, tone changes, or generic strategy switching as adaptation. A turn counts as adaptively successful only when the selected action is justified by the current learner-state belief and is followed by the predicted learner-state change.

## 2. Problem statement

The present system can often produce good, responsive tutoring and can detect several forms of pseudo-adaptation. It is nevertheless vulnerable to five recurrent failure modes:

- **Retrospective rationalization:** the tutor response is generated first and described as adaptive afterward.
- **State collapse:** one vague label such as “confused” substitutes for competing causal hypotheses.
- **Action ambiguity:** the system cannot reliably say what intervention it attempted because the pedagogical action is implicit in prose.
- **No outcome closure:** the next learner turn is read as conversation history rather than evidence about whether the prior intervention worked.
- **Proof/release/ownership mismatch:** the tutor obtains evidence by taking over, releases control without evidence, or elicits ownership-like language without learner-authored proof.

The implementation must make these failures structurally difficult, observable in traces, and directly testable.

## 3. Definition of genuine adaptation

For this project, a tutor turn is genuinely adaptive when all of the following hold:

1. **State grounding:** the tutor identifies one or more plausible learner-state hypotheses supported by concrete evidence from the dialogue.
2. **Uncertainty:** the tutor represents uncertainty and, when necessary, chooses an information-gathering move rather than pretending the state is known.
3. **Action commitment:** the tutor selects a typed pedagogical action before composing the utterance.
4. **State-action fit:** the selected action is appropriate for the current belief and the learner’s project.
5. **Prospective prediction:** the tutor states an expected observable learner-state transition.
6. **Control discipline:** the action uses the least tutor control compatible with likely progress.
7. **Outcome closure:** the next learner turn is scored against the predicted transition.
8. **Policy update:** success, failure, or inconclusive evidence changes the next state belief or action choice.
9. **Non-repetition:** a failed intervention is not repeated without an explicit new rationale.
10. **Joint proof/release/ownership integrity:** ownership credit requires learner-authored, task-relevant evidence under meaningful transfer of control.

A response can be pedagogically good without meeting this definition. That distinction should remain visible in both runtime traces and evaluation outputs.

## 4. Scope

### 4.1 In scope

- The LangGraph adaptive runner in `services/adaptiveTutor/`.
- Deterministic mock behavior for hermetic tests and smoke evaluations.
- Typed adaptation state and trace records.
- A finite pedagogical action registry.
- A proof/release/ownership runtime gate.
- An intervention ledger with expected and observed outcomes.
- Paired hidden-state discrimination scenarios.
- Turn-level and dialogue-level adaptation metrics.
- Counterfactual action comparison using the existing replay direction.
- Feature flags and ablations that preserve current behavior.

### 4.2 Out of scope for the first vertical slice

- Replacing the standard tutor-core dialogue engine.
- Learning a policy with online reinforcement learning.
- Claiming human-learning effectiveness from simulated learner results.
- Broad prompt redesign across all historical cells.
- Retrofitting historical evaluation rows to a new rubric version.
- Treating evaluator agreement as proof of causal adaptation.

## 5. Design principles

### 5.1 Separate policy from prose

The tutor must choose an action before it writes a message. The natural-language response is an implementation of a policy decision, not the policy decision itself.

### 5.2 Make predictions falsifiable

Every action must name an observable success signal. “Learner understands better” is invalid. “Learner independently selects a representation and justifies the choice without adopting tutor-supplied wording” is valid.

### 5.3 Maintain competing hypotheses

The learner-state model should support a small ranked set of hypotheses, not a single totalizing diagnosis. When top hypotheses imply different actions and confidence is low, the policy should prefer a discriminating action.

### 5.4 Minimize tutor control

Action selection should optimize expected learner-state improvement under a tutor-control budget. The same expected gain should favor the lower-control action.

### 5.5 Close every intervention

Each learner turn first closes the prior intervention record, then informs the next state estimate. No intervention should disappear into raw history without an explicit outcome.

### 5.6 Preserve bilateral symmetry where appropriate

Tutor and learner public/internal trace conventions must remain symmetric with the repository’s existing naming discipline. The new tutor policy records should not break learner trace consumers or old `user` labels.

### 5.7 Preserve backward compatibility

The new state fields are optional behind a feature flag. Existing adaptive cells and stored traces must remain readable. Schema migration must be additive.

## 6. Proposed runtime architecture

```text
learner turn
    │
    ▼
close_previous_intervention
    │  observed outcome: success | failure | inconclusive
    ▼
estimate_learner_state
    │  ranked hypotheses + confidence + evidence
    ▼
select_pedagogical_action
    │  typed action + expected transition + control cost
    ▼
validate_adaptation_contract
    │  proof/release/ownership gate + repetition guard
    ├── blocked → repair_action
    ▼
realize_tutor_utterance
    │  prose constrained by selected action and forbidden moves
    ▼
verify_realization
    │  structural and semantic checks
    ▼
persist_contract_and_pending_intervention
    │
    ▼
next learner turn
```

The runtime should never infer the selected action solely from the generated tutor prose. It may verify prose/action consistency, but the action is created first.

## 7. Core data structures

All structures should be JSON-serializable and versioned. JavaScript implementation should use runtime validation because the codebase is JavaScript rather than relying only on TypeScript types.

### 7.1 `LearnerStateBelief`

```json
{
  "version": "1.0",
  "turn_index": 2,
  "learner_project": {
    "goal": "choose and justify a fraction-comparison strategy",
    "current_plan": "convert both fractions to a common denominator",
    "commitment": "tentative",
    "next_authorship_opportunity": "choose the representation"
  },
  "hypotheses": [
    {
      "id": "procedure_without_rationale",
      "probability": 0.55,
      "evidence": [
        "Learner selected the common-denominator procedure",
        "Learner could not explain why it preserves order"
      ],
      "disconfirming_evidence": []
    },
    {
      "id": "approval_dependency",
      "probability": 0.35,
      "evidence": [
        "Learner asked whether the step was acceptable before committing"
      ],
      "disconfirming_evidence": []
    },
    {
      "id": "notation_overload",
      "probability": 0.10,
      "evidence": [],
      "disconfirming_evidence": [
        "Learner manipulated notation accurately"
      ]
    }
  ],
  "axes": {
    "proof": 0.35,
    "release": 0.45,
    "ownership": 0.30,
    "conceptual_mastery": 0.45,
    "metacognitive_accuracy": 0.40,
    "affective_readiness": 0.65
  },
  "uncertainty": {
    "entropy": 0.91,
    "needs_discrimination": true,
    "reason": "Top hypotheses imply different interventions"
  }
}
```

Rules:

- Hypothesis probabilities sum to 1 within a small tolerance.
- Evidence entries must refer to observable dialogue behavior.
- `axes` values are bounded to `[0, 1]` and should not be treated as ground truth.
- A high-confidence state estimate requires more than fluent evaluator prose.
- `learner_project` is required for ownership-targeting actions.

### 7.2 `PedagogicalAction`

```json
{
  "version": "1.0",
  "id": "action-turn-2",
  "action_type": "request_evidence",
  "target_axes": ["proof", "ownership"],
  "rationale": "Distinguish procedural recall from independent rationale while preserving learner control",
  "preconditions": [
    "Learner has selected a candidate strategy",
    "Tutor has not supplied the decisive rationale"
  ],
  "expected_transition": {
    "proof": 0.20,
    "release": 0.05,
    "ownership": 0.15
  },
  "success_signal": {
    "description": "Learner gives an independent reason tied to the mathematical invariant",
    "required_evidence": ["learner-authored rationale"],
    "forbidden_evidence": ["mere agreement", "verbatim adoption of tutor rationale"]
  },
  "control_cost": 0.20,
  "information_gain": 0.55,
  "forbidden_moves": [
    "supply_decisive_step",
    "premature_correctness_validation",
    "replace_learner_plan"
  ]
}
```

### 7.3 `AdaptationContract`

```json
{
  "version": "1.0",
  "contract_id": "dialogue-7-turn-2",
  "state_belief": {},
  "selected_action": {},
  "candidate_actions": [
    {
      "action_type": "request_evidence",
      "utility": 0.61
    },
    {
      "action_type": "explain_principle",
      "utility": 0.28,
      "rejected_reason": "Higher control cost and likely ownership suppression"
    }
  ],
  "gate_result": {
    "allowed": true,
    "violations": [],
    "repairs": []
  },
  "realization_checks": {
    "action_consistent": true,
    "forbidden_move_detected": false
  }
}
```

### 7.4 `InterventionRecord`

```json
{
  "version": "1.0",
  "contract_id": "dialogue-7-turn-2",
  "hypothesis_ids": ["procedure_without_rationale", "approval_dependency"],
  "action_type": "request_evidence",
  "expected_transition": {
    "proof": 0.20,
    "release": 0.05,
    "ownership": 0.15
  },
  "status": "pending",
  "observed_transition": null,
  "outcome": null,
  "evidence": [],
  "policy_update": null
}
```

On the next learner turn, `status` becomes `closed` and `outcome` becomes `success`, `failure`, or `inconclusive`.

## 8. Pedagogical action registry

Implement a deliberately small and testable action space first. Avoid dozens of overlapping labels.

| Action | Primary purpose | Typical control cost | Typical information gain |
|---|---|---:|---:|
| `diagnose_with_discriminating_question` | Distinguish competing learner-state hypotheses | 0.15 | 0.80 |
| `elicit_prediction` | Externalize current model before instruction | 0.15 | 0.65 |
| `request_evidence` | Test and strengthen learner-authored proof | 0.20 | 0.55 |
| `ask_strategy_choice` | Create a consequential ownership opportunity | 0.15 | 0.55 |
| `contrast_models` | Expose consequences of two candidate conceptions | 0.35 | 0.65 |
| `fade_hint` | Reduce support after partial success | 0.20 | 0.35 |
| `minimal_hint` | Unblock without taking over | 0.30 | 0.30 |
| `repair_overconfidence` | Elicit checking when confidence exceeds evidence | 0.25 | 0.55 |
| `challenge_without_telling` | Surface contradiction while preserving control | 0.25 | 0.60 |
| `reanchor_goal` | Restore learner project after drift | 0.20 | 0.35 |
| `summarize_and_release` | Consolidate demonstrated learning and return control | 0.20 | 0.20 |
| `explain_principle` | Supply needed conceptual material when lower-control moves are insufficient | 0.60 | 0.25 |
| `model_worked_example` | Provide high support after diagnosed prerequisite failure | 0.80 | 0.20 |

Each action definition should contain:

- allowed target axes;
- required and forbidden preconditions;
- default control cost;
- default information gain;
- compatible success signals;
- incompatible surface behaviors;
- fallback/repair actions.

## 9. Proof/release/ownership runtime gate

The runtime gate converts current post-hoc disqualification logic into action-time constraints.

### 9.1 Required invariants

1. **Ownership cannot be claimed from preference alone.** The learner must make a task-relevant decision or produce task-relevant reasoning.
2. **Proof must be learner-authored for ownership credit.** Tutor-supplied decisive reasoning may improve proof but cannot simultaneously count as learner ownership.
3. **Release requires a bounded opportunity.** The tutor must transfer a meaningful decision, explanation, check, or next step—not merely ask an open-ended social question.
4. **Release must be calibrated to proof.** Full release is blocked when there is insufficient evidence of readiness unless the action is explicitly diagnostic and low-risk.
5. **No premature validation.** The tutor cannot announce correctness before the learner commits and supplies evidence on ownership-targeting turns.
6. **No hidden takeover.** A question that embeds the decisive step is treated as high tutor control.
7. **Minimum sufficient intervention.** When candidate actions have similar predicted utility, choose the lower-control action.
8. **Failed-action repetition guard.** An action that failed under the same dominant hypothesis cannot be repeated without a stated changed condition or new rationale.

### 9.2 Gate result

The gate returns:

```json
{
  "allowed": false,
  "violations": [
    {
      "code": "OWNERSHIP_WITH_TUTOR_SUPPLIED_PROOF",
      "message": "The proposed action supplies the decisive rationale while targeting ownership"
    }
  ],
  "repairs": [
    {
      "replace_action_with": "request_evidence",
      "reason": "Elicit learner-authored proof before explanation"
    }
  ]
}
```

Blocked actions must be repaired before utterance generation. A maximum repair count prevents loops and produces a visible hard failure rather than silently falling back to unconstrained generation.

## 10. State estimation and uncertainty

### 10.1 Ranked hypothesis approach

The estimator should output two to four hypotheses. Examples:

- missing prerequisite concept;
- procedure known but rationale fragile;
- task misread;
- notation overload;
- low confidence despite adequate understanding;
- approval dependency;
- answer-seeking/game behavior;
- correct alternative model;
- affective resistance;
- goal drift.

### 10.2 Discriminating action rule

If:

- the top two hypotheses are close in probability; and
- they imply materially different best actions;

then `needs_discrimination` is true and the policy should favor a diagnostic action unless safety or task constraints require direct support.

### 10.3 Calibration

Where scenarios provide a hidden causal state, store predicted probabilities and calculate:

- Brier score;
- log loss;
- top-1 and top-2 accuracy;
- expected calibration error;
- discrimination-action appropriateness.

These metrics distinguish genuine state tracking from generic helpfulness.

## 11. Policy selection

### 11.1 Candidate generation

Generate three to five valid candidate actions from the registry based on:

- learner-state hypotheses;
- current learner project;
- prior interventions and outcomes;
- target axes;
- remaining tutor-control budget;
- scenario safety/task constraints.

### 11.2 Utility function

Use an explicit, inspectable utility function for deterministic policy comparison:

```text
utility(action) =
    expected_state_gain
  + uncertainty_weight × information_gain
  + ownership_weight × expected_ownership_gain
  - control_weight × control_cost
  - repetition_penalty
  - mismatch_risk
  - constraint_violation_penalty
```

The LLM may estimate components, but the final calculation should be programmatic and persisted.

### 11.3 Minimum sufficient intervention tie-breaker

When candidate utilities are within a configured epsilon, select the action with lower control cost. If control costs tie, select higher information gain. This makes the autonomy commitment operational rather than rhetorical.

### 11.4 Policy modes for ablation

Support these modes behind configuration:

- `legacy`: current state-policy behavior;
- `contract`: typed state and action, no gate;
- `contract_gate`: add proof/release/ownership gate;
- `closed_loop`: add outcome closure and intervention ledger;
- `closed_loop_counterfactual`: add turn-level counterfactual comparison.

## 12. Outcome observation

### 12.1 Outcome categories

- `success`: required success evidence appears and forbidden evidence does not.
- `failure`: predicted transition does not occur, or the learner response directly contradicts it.
- `inconclusive`: the learner turn does not provide enough evidence.

### 12.2 Observed transition record

```json
{
  "proof": 0.15,
  "release": 0.05,
  "ownership": 0.20,
  "conceptual_mastery": 0.10,
  "metacognitive_accuracy": 0.05
}
```

The observer should record evidence spans or structured references, not only scalar changes.

### 12.3 Policy update rules

Examples:

- If `request_evidence` fails because the learner only agrees, increase `approval_dependency` probability.
- If a discriminating question reveals accurate independent reasoning, reduce `missing_prerequisite` probability and consider `summarize_and_release`.
- If a low-control hint fails twice under a high-confidence prerequisite-gap hypothesis, allow `explain_principle` despite its higher control cost.
- If an intervention is inconclusive, avoid treating the learner state as improved.

## 13. Intervention ledger

The ledger is not a transcript summary. It is a compact action-outcome history.

Required operations:

- `appendPending(contract)`;
- `closePending(learnerTurn, observation)`;
- `recentFailures(hypothesisId, actionType)`;
- `hasMateriallyChangedCondition(record, stateBelief)`;
- `actionRepetitionPenalty(action, stateBelief)`;
- `summarizeForPolicy(maxRecords)`.

The ledger should be included in the graph state and persisted to dialogue logs. Store only the bounded recent history needed for policy choice to control prompt size.

## 14. Natural-language realization

The utterance generator receives:

- learner public turn;
- learner-state belief summary;
- selected pedagogical action;
- expected transition;
- success signal;
- forbidden moves;
- relevant intervention history;
- normal tutor persona/prompt context.

It must not choose a different action. After generation, a verifier checks:

- whether the message implements the selected action;
- whether it contains a forbidden move;
- whether it accidentally supplies the decisive step;
- whether it transfers the promised decision or reasoning opportunity;
- whether it prematurely validates correctness.

On verification failure, perform one constrained rewrite. A second failure should be persisted as an explicit policy-realization error.

## 15. Repository integration plan

The exact edits should be adjusted after reading current files, but the expected integration points are:

### 15.1 Existing files to modify

- `services/adaptiveTutor/stateSchema.js`
  - Add optional versioned fields for learner-state beliefs, pending contract, intervention ledger, policy mode, and budgets.
  - Preserve old state shape and defaults.

- `services/adaptiveTutor/policyActions.js`
  - Convert or extend current actions into a typed registry.
  - Add metadata: control cost, information gain, preconditions, target axes, forbidden moves.

- `services/adaptiveTutor/graph.js`
  - Split existing decision/generation node into explicit nodes:
    - `close_previous_intervention`;
    - `estimate_learner_state`;
    - `select_pedagogical_action`;
    - `validate_adaptation_contract`;
    - `realize_tutor_utterance`;
    - `verify_realization`;
    - `persist_pending_intervention`.
  - Keep the `legacy` route unchanged.

- `services/adaptiveTutor/runner.js`
  - Read policy mode from profile/config/environment.
  - Expose contract and ledger summaries in run results.
  - Ensure deterministic mock seeds propagate through all new nodes.

- `services/adaptiveTutor/persistence.js`
  - Persist adaptation contracts and intervention outcomes without breaking old logs.
  - Prefer a versioned JSON field/table over many unstable scalar columns.

- `services/adaptiveTutor/realLLM.js`
  - Add structured-output prompts/calls for state estimation, action candidates, and outcome observation.
  - Validate and repair malformed JSON once.

- `services/adaptiveTutor/mockLLM.js`
  - Add deterministic fixtures for all new calls.
  - Support hidden-state scenario identifiers for tests without exposing hidden state to the tutor path.

- `services/evaluationRunner.js`
  - Register new cells if new canonical profile names are introduced.

- `config/tutor-agents.yaml`
  - Add policy-mode profiles/cells and explicit feature flags.

### 15.2 New files to add

- `services/adaptiveTutor/adaptationContract.js`
  - constructors, validation, versioning, normalization.

- `services/adaptiveTutor/actionPolicy.js`
  - candidate filtering, utility calculation, tie-breaking, repetition penalties.

- `services/adaptiveTutor/proofReleaseOwnershipGate.js`
  - runtime invariants, violation codes, repair proposals.

- `services/adaptiveTutor/interventionLedger.js`
  - pending/closed intervention lifecycle and repetition checks.

- `services/adaptiveTutor/outcomeObserver.js`
  - expected-versus-observed transition logic.

- `services/adaptiveTutor/realizationVerifier.js`
  - action/prose consistency and forbidden-move checks.

- `services/adaptiveTutor/adaptationMetrics.js`
  - dialogue metrics and aggregation.

- `config/adaptation-discrimination-scenarios.yaml`
  - paired scenarios with identical surface learner utterances and different hidden causes.

- `scripts/evaluate-adaptation-policy.js`
  - deterministic and real-LLM evaluation harness, paired comparisons, bootstrap intervals.

- `tests/adaptation-contract.test.js`
- `tests/adaptation-policy.test.js`
- `tests/adaptation-gate.test.js`
- `tests/intervention-ledger.test.js`
- `tests/adaptation-closed-loop.test.js`
- `tests/adaptation-discrimination.test.js`

## 16. Configuration and feature flags

Recommended profile fields:

```yaml
adaptive_policy:
  mode: closed_loop
  contract_version: "1.0"
  max_hypotheses: 3
  max_action_candidates: 5
  uncertainty_weight: 0.35
  ownership_weight: 0.30
  control_weight: 0.40
  repetition_penalty: 0.50
  utility_tie_epsilon: 0.05
  max_gate_repairs: 1
  max_realization_repairs: 1
  intervention_history_limit: 5
  counterfactual_candidates: 3
```

Environment override for smoke testing:

```bash
ADAPTIVE_POLICY_MODE=closed_loop
```

The resolved mode must be written to run metadata and result provenance.

## 17. Persistence and provenance

### 17.1 Recommended persistence shape

Prefer a versioned JSON payload attached to each adaptive turn/log entry:

```json
{
  "adaptation_contract_version": "1.0",
  "adaptation_contract": {},
  "intervention_outcome": {},
  "policy_mode": "closed_loop"
}
```

If the SQLite schema requires a new column, use an additive migration such as:

- `adaptation_trace TEXT` containing versioned JSON.

Do not overload `id_construction_trace` or historical score columns.

### 17.2 Hashes and reproducibility

Include policy configuration in `config_hash` or an equivalent adaptive-policy hash. Persist:

- policy mode;
- contract version;
- action-registry version;
- gate-rule version;
- mock/real LLM mode;
- model identifiers;
- random seed;
- scenario hidden-state version, but never expose hidden state to tutor prompts.

## 18. Test plan

### 18.1 Unit tests

#### Contract validation

- Valid contract passes.
- Hypothesis probabilities outside tolerance fail.
- Missing evidence for a high-confidence hypothesis fails.
- Axis values outside `[0,1]` fail.
- Unknown action type fails.
- Ownership-targeting action without a learner project fails.

#### Action policy

- Filters actions whose preconditions are unmet.
- Selects a diagnostic action under high uncertainty.
- Selects lower-control action when utility is tied.
- Applies repetition penalty after failed intervention.
- Permits escalation when lower-control actions repeatedly fail and state evidence is strong.

#### Proof/release/ownership gate

- Blocks tutor-supplied decisive reasoning on an ownership turn.
- Blocks premature correctness validation.
- Blocks empty release such as “What do you think?” without a consequential task.
- Blocks full release without readiness evidence, except bounded diagnostics.
- Allows learner-authored strategy choice plus evidence request.
- Returns deterministic repair suggestions.

#### Intervention ledger

- Appends one pending intervention.
- Prevents multiple unresolved pending interventions.
- Closes pending record on next learner turn.
- Correctly marks success, failure, or inconclusive.
- Detects repeated failure under materially equivalent state.
- Allows repetition when the state or rationale materially changes.

#### Realization verifier

- Detects answer leakage in a nominal question.
- Detects embedded decisive steps.
- Detects premature validation.
- Accepts a faithful low-control realization.

### 18.2 Integration tests

- Full deterministic graph turn produces a valid contract.
- Next learner turn closes the previous intervention before selecting a new action.
- Failed action changes next policy choice.
- Legacy policy path produces byte-equivalent or semantically equivalent output to pre-change fixtures.
- Persistence round-trip preserves contracts and outcomes.
- Hermetic DB/log paths remain respected.

### 18.3 Hidden-state discrimination tests

Construct paired cases where the public dialogue is the same but the underlying scenario mechanism differs. The tutor does not see the hidden label.

Example surface turn:

> “I don’t get why that works.”

Hidden variants:

1. missing prerequisite concept;
2. correct concept but low confidence;
3. task misread;
4. notation overload;
5. approval dependency;
6. answer-seeking behavior;
7. correct alternative model.

The first action should often be discriminating rather than explanatory. After one controlled evidence turn, the policy should diverge appropriately by hidden state.

### 18.4 Regression tests

- Current adaptive smoke scripts pass unchanged in `legacy` mode.
- Existing trap and cross-suite scenario schemas remain accepted.
- Existing result readers tolerate absent adaptation traces.
- Historical dialogue logs with old labels remain readable.

## 19. Evaluation design

### 19.1 Experimental conditions

Introduce a compact ablation family, using final cell numbers only after checking the current registry:

- **Legacy adaptive:** current state-policy architecture.
- **Contract only:** typed state/action contract, no runtime gate or outcome update.
- **Contract + gate:** adds proof/release/ownership gate.
- **Closed loop:** adds outcome closure and intervention ledger.
- **Closed loop + counterfactual:** adds candidate-action replay/regret measurement.

Keep all non-policy factors constant: model, prompt family, learner mechanism, scenario set, seed, budget, and judge.

### 19.2 Scenario suites

Run on:

1. existing adaptive trap suite;
2. existing clean cross-suite trap scenarios;
3. new paired hidden-state discrimination suite;
4. a small non-trap ordinary tutoring suite to detect over-diagnosis and unnecessary questioning.

### 19.3 Primary metrics

#### State/action metrics

- `state_top1_accuracy` where hidden state exists;
- `state_top2_accuracy`;
- `state_brier_score`;
- `state_log_loss`;
- `discrimination_action_rate` when uncertainty requires it;
- `state_action_fit` judged against scenario policy annotations;
- `expected_transition_attainment`.

#### Closed-loop metrics

- `intervention_success_rate`;
- `intervention_failure_rate`;
- `intervention_inconclusive_rate`;
- `failed_action_repeat_rate`;
- `policy_update_after_failure_rate`;
- `time_to_correct_policy_shift`;
- `counterfactual_regret`.

#### Proof/release/ownership metrics

- proof gain;
- release gain;
- ownership gain;
- strict joint proof/release/ownership success;
- proof-without-release mismatch rate;
- release-without-proof mismatch rate;
- ownership-with-tutor-supplied-proof rate;
- premature-validation rate.

#### Efficiency and quality metrics

- tutor control cost per successful transition;
- minimum-sufficient-intervention rate;
- content accuracy;
- tutor rubric score;
- learner rubric score;
- dialogue quality;
- latency and token cost;
- structured-output failure/repair rate.

### 19.4 Strict joint success definition

A dialogue opportunity is a strict joint success only if:

1. the learner performs a task-relevant action or supplies task-relevant reasoning;
2. the evidence is learner-authored rather than tutor-completed;
3. the tutor transferred meaningful control;
4. content is correct or productively self-corrected;
5. no forbidden takeover or premature validation occurred;
6. the observed transition matches the adaptation contract.

### 19.5 Counterfactual evaluation

At selected critical turns:

1. preserve the exact pre-action graph state;
2. realize the selected action and two or more valid alternatives;
3. run each against controlled learner continuations or the existing counterfactual learner mechanism;
4. measure the same state-transition outcomes;
5. calculate regret relative to the best observed alternative.

Counterfactual evaluation should be reported separately from the live trajectory because simulated continuations are model-dependent.

### 19.6 Statistical analysis

Use paired analysis wherever the same scenario/seed is run across conditions.

- Binary outcomes: paired bootstrap interval and McNemar test where appropriate.
- Continuous metrics: paired mean/median difference with bootstrap confidence interval; report effect size.
- Calibration: reliability curves, Brier decomposition where sample size permits.
- Multiple ablations: control false discovery rate for secondary metrics.
- Report raw Ns, exclusions, structured-output failures, and scenario-level variance.

Do not pool across rubric versions or judges without an explicit matched design.

## 20. Acceptance criteria

The vertical slice is complete when all of the following hold:

### 20.1 Engineering acceptance

- All new unit and integration tests pass.
- Existing tests pass in hermetic mode.
- Legacy adaptive behavior remains available and current smoke tests pass.
- Every closed-loop tutor turn has a valid adaptation contract.
- Every non-final pending intervention is closed by the next learner turn.
- Gate violations are either repaired or surfaced as explicit failures; none are silently ignored.
- Persisted traces round-trip and include version/provenance fields.

### 20.2 Behavioral acceptance

On deterministic hidden-state fixtures:

- the policy chooses a discriminating action when competing hypotheses require one;
- the policy diverges appropriately after evidence reveals different hidden causes;
- failed interventions alter subsequent action selection;
- repeated failed actions under unchanged state are eliminated;
- ownership-targeting turns do not supply decisive proof;
- lower-control actions win near-ties.

### 20.3 Empirical acceptance

Relative to the matched legacy adaptive condition:

- strict proof/release/ownership joint success improves with a paired confidence interval excluding zero, or the result is explicitly treated as inconclusive;
- failed-action repetition falls materially;
- proof/release mismatch does not increase;
- content accuracy and current trap strategy-shift correctness do not materially regress;
- tutor control cost per successful transition decreases;
- counterfactual regret decreases on critical turns;
- gains replicate on the clean cross-suite and are not confined to the development traps.

Avoid fixing arbitrary success thresholds before baseline measurement. Record baselines first, then preregister meaningful deltas for the confirmatory run.

## 21. Implementation sequence

### Phase 0: Baseline and safeguards

1. Record current commit and dirty status.
2. Run existing adaptive and hermetic smoke tests.
3. Capture baseline outputs for selected trap and cross-suite scenarios.
4. Confirm current schema, graph nodes, action definitions, persistence format, and cell registry.
5. Add feature flag with default `legacy` and no behavior change.

**Exit criterion:** clean baseline with reproducible commands and artifacts.

### Phase 1: Contracts and validation

1. Add `adaptationContract.js`.
2. Extend graph state additively.
3. Add action registry metadata.
4. Add runtime validators and unit tests.
5. Persist contract skeletons in mock mode only.

**Exit criterion:** every contract-mode turn emits a valid typed contract without changing tutor prose.

### Phase 2: Policy selection and control cost

1. Add candidate filtering and utility calculation.
2. Add uncertainty-driven diagnostic selection.
3. Add minimum-sufficient-intervention tie-breaker.
4. Add deterministic candidate fixtures.
5. Compare policy decisions with legacy decisions on baseline states.

**Exit criterion:** typed action is selected prospectively and reproducibly.

### Phase 3: Runtime gate and realization verification

1. Implement proof/release/ownership gate.
2. Add repair path.
3. Constrain utterance generation to selected action.
4. Verify action/prose consistency and forbidden moves.
5. Add leakage and premature-validation tests.

**Exit criterion:** known mismatch fixtures are blocked or repaired before output.

### Phase 4: Outcome closure and ledger

1. Implement intervention ledger.
2. Close prior intervention at the start of each learner turn.
3. Add outcome observer.
4. Feed outcome and failure history into next policy selection.
5. Add non-repetition and escalation logic.

**Exit criterion:** failed interventions change future behavior in deterministic integration tests.

### Phase 5: Discrimination suite and metrics

1. Add paired hidden-state scenarios.
2. Add state calibration and action-fit metrics.
3. Add strict joint proof/release/ownership metric.
4. Add control-cost and repeated-failure metrics.
5. Create evaluation script and machine-readable report.

**Exit criterion:** deterministic evaluation differentiates legacy, contract, gate, and closed-loop modes for the intended reasons.

### Phase 6: Counterfactual replay

1. Reuse exact pre-action state.
2. Generate alternative valid actions.
3. Run controlled continuations.
4. Calculate selected-action rank and regret.
5. Persist counterfactual provenance separately.

**Exit criterion:** action quality is evaluated relative to alternatives, not in isolation.

### Phase 7: Real-LLM pilot and confirmatory run

1. Run a small real-LLM pilot to measure JSON reliability, latency, and qualitative failure modes.
2. Freeze action registry, gate rules, scenario version, and metrics.
3. Predeclare primary outcomes and exclusions.
4. Run matched conditions with paired seeds.
5. Analyze with confidence intervals and scenario-level breakdowns.
6. Add any new empirical claims to `docs/research/paper-full-2.0.md` before spin-offs.

**Exit criterion:** either credible cross-suite evidence of improved closed-loop adaptation or a precise failure diagnosis linked to trace data.

## 22. Suggested command workflow

Commands must be adjusted to actual profile names and current scripts after inspection.

```bash
# Baseline
npm run test:hermetic
ADAPTIVE_TUTOR_LLM=mock node scripts/run-adaptive-cell-smoke.js
ADAPTIVE_TUTOR_LLM=mock node scripts/run-adaptive-persistence-smoke.js

# New focused tests
node --test \
  tests/adaptation-contract.test.js \
  tests/adaptation-policy.test.js \
  tests/adaptation-gate.test.js \
  tests/intervention-ledger.test.js \
  tests/adaptation-closed-loop.test.js \
  tests/adaptation-discrimination.test.js

# Deterministic policy evaluation
ADAPTIVE_TUTOR_LLM=mock \
ADAPTIVE_POLICY_MODE=closed_loop \
node scripts/evaluate-adaptation-policy.js \
  --suite adaptation-discrimination \
  --compare legacy,contract,contract_gate,closed_loop \
  --output exports/adaptation-policy-mock.json

# Existing suites
ADAPTIVE_TUTOR_LLM=mock node scripts/evaluate-adaptation-policy.js \
  --suite adaptive-traps,cross-suite \
  --compare legacy,closed_loop \
  --output exports/adaptation-policy-crosssuite-mock.json

# Full regression
npm run test:hermetic
```

## 23. Evaluation report format

The evaluation script should write:

```json
{
  "schema_version": "1.0",
  "git_commit": "...",
  "policy_versions": {},
  "scenario_versions": {},
  "conditions": [],
  "primary_metrics": {},
  "secondary_metrics": {},
  "paired_differences": {},
  "confidence_intervals": {},
  "scenario_breakdown": [],
  "gate_violations": [],
  "structured_output_failures": [],
  "counterfactual_results": [],
  "costs": {},
  "exclusions": []
}
```

Also produce a concise Markdown report with:

- baseline and treatment conditions;
- primary result table;
- failure taxonomy;
- representative trace excerpts;
- regression checks;
- limitations;
- next decision.

## 24. Likely risks and mitigations

### Risk: structured state becomes confident fiction

**Mitigation:** require evidence, represent multiple hypotheses, score calibration on hidden-state scenarios, and favor diagnostic actions under uncertainty.

### Risk: policy layer adds latency without behavioral gain

**Mitigation:** deterministic utility calculation, bounded candidates, bounded repair passes, report cost per successful transition, and retain ablations.

### Risk: gate produces stilted Socratic questioning

**Mitigation:** include ordinary non-trap scenarios, allow direct explanation after diagnosed need, measure unnecessary-question rate, and treat minimum intervention as calibrated—not dogmatic—release.

### Risk: simulated learner rewards prompt artifacts

**Mitigation:** hidden-state pairing, multiple learner models/seeds, cross-suite tests, counterfactual reporting separated from live results, and eventual human pilot validation.

### Risk: action labels become another post-hoc fiction

**Mitigation:** select action before prose, verify realization, and score expected outcomes prospectively.

### Risk: evaluator and policy share the same blind spots

**Mitigation:** use programmatic invariants where possible, independent judge models for semantic checks, deterministic fixtures, and hand-audited trace samples.

### Risk: adaptation improves ownership while reducing content accuracy

**Mitigation:** strict joint success requires task-relevant correctness or productive self-correction; content accuracy remains a non-inferiority constraint.

## 25. First implementation milestone

The first commit should be intentionally narrow:

1. add versioned `AdaptationContract` and validators;
2. add a small typed action registry;
3. add proof/release/ownership gate rules;
4. add an intervention ledger;
5. integrate these into the deterministic adaptive graph under `ADAPTIVE_POLICY_MODE=closed_loop`;
6. add unit and one end-to-end mock test demonstrating:
   - an ownership-threatening explanation is blocked;
   - `request_evidence` is selected instead;
   - the next learner turn closes the intervention;
   - a failed outcome changes the next action;
7. run existing smoke tests and the focused evaluation.

This milestone is enough to test the central causal claim: explicit prospective action contracts plus outcome closure produce more genuine adaptation than response generation followed by post-hoc scoring.

## 26. Decision rule after the first evaluation

Proceed to broader real-LLM evaluation only if the implementation shows all three in deterministic and pilot traces:

1. **policy sensitivity:** different evidence leads to different actions;
2. **outcome sensitivity:** failed actions alter subsequent choices;
3. **control integrity:** proof/release/ownership mismatches are reduced without content-accuracy regression.

If only surface action diversity increases, stop and inspect the state estimator and utility function. If state inference improves but learner outcomes do not, inspect action effectiveness and realization fidelity. If ownership improves while proof falls, strengthen readiness calibration rather than weakening the gate.

---

## Appendix A: Violation code registry

Suggested stable codes:

- `OWNERSHIP_WITH_TUTOR_SUPPLIED_PROOF`
- `RELEASE_WITHOUT_MEANINGFUL_OPPORTUNITY`
- `RELEASE_WITHOUT_READINESS_OR_DIAGNOSTIC_BOUND`
- `PREMATURE_CORRECTNESS_VALIDATION`
- `DECISIVE_STEP_EMBEDDED_IN_QUESTION`
- `FAILED_ACTION_REPEATED_WITHOUT_NEW_RATIONALE`
- `ACTION_PRECONDITION_UNMET`
- `ACTION_TARGET_MISMATCH`
- `CONTROL_COST_EXCEEDS_MINIMUM_SUFFICIENT_ACTION`
- `MISSING_OBSERVABLE_SUCCESS_SIGNAL`
- `STATE_HYPOTHESIS_UNGROUNDED`
- `HIGH_CONFIDENCE_WITH_HIGH_UNCERTAINTY`
- `REALIZATION_ACTION_MISMATCH`

## Appendix B: Initial action-to-axis expectations

| Action | Proof | Release | Ownership | Information | Control |
|---|---:|---:|---:|---:|---:|
| diagnose with discriminating question | 0.05 | 0.05 | 0.05 | 0.80 | 0.15 |
| elicit prediction | 0.10 | 0.10 | 0.15 | 0.65 | 0.15 |
| request evidence | 0.20 | 0.05 | 0.15 | 0.55 | 0.20 |
| ask strategy choice | 0.10 | 0.20 | 0.25 | 0.55 | 0.15 |
| contrast models | 0.20 | 0.00 | 0.05 | 0.65 | 0.35 |
| fade hint | 0.10 | 0.20 | 0.15 | 0.35 | 0.20 |
| minimal hint | 0.15 | -0.05 | 0.00 | 0.30 | 0.30 |
| challenge without telling | 0.15 | 0.10 | 0.15 | 0.60 | 0.25 |
| summarize and release | 0.05 | 0.25 | 0.20 | 0.20 | 0.20 |
| explain principle | 0.30 | -0.20 | -0.10 | 0.25 | 0.60 |
| model worked example | 0.35 | -0.35 | -0.20 | 0.20 | 0.80 |

These are initialization priors, not empirical truths. Persist them by registry version and revise only with explicit evidence.
