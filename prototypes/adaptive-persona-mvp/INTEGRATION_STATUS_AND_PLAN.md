# Adaptive Persona Prototype: Results And Integration Plan

This note distinguishes the prototype evidence from parent-framework
integration. The prototype shows a genuine stateful adaptation mechanism under
LLM learner stress tests. It does **not** yet add that mechanism to the parent
`services/adaptiveTutor/` runtime.

## Current Integration Status

The current committed branch is:

```text
experiment/adversarial-superego-promotion
```

Latest pushed prototype commits:

```text
b495b41 Calibrate adaptive tutor ready-branch transfer
5adeb9c Confirm adaptive tutor post-repair replication
```

What exists now:

- isolated prototype under `prototypes/adaptive-persona-mvp/`;
- runnable LLM learner trap sweeps and revalidation;
- challenge-state finite state machine;
- hidden-state transfer gates;
- Ego/Superego reflexive critique;
- reflexive memory;
- action-family outcome validators;
- parent-stack replay adapters for read-only diagnosis.

What does not exist yet:

- no parent `services/adaptiveTutor/` production path consumes the prototype
  `challengeState`, `transferGate`, or prototype policy labels;
- no parent evaluation-runner condition has been promoted as the integrated
  adaptive-persona architecture;
- no parent harness claim should be made until the port passes parent-stack
  replay and live parent-run validation.

## Result 1: Smaller Strict Confirmation

Artifact:

```text
outputs/action-family-full-traps-replicated-live-post-science-repair-revalidated/
variant-sweep-revalidated-2026-05-17T04-10-17-452Z.html
```

This is the report currently open in the browser. It is the stronger-looking
result, but it is smaller.

Run shape:

- four hidden-state disciplinary traps;
- `static_codex` baseline versus `controller_reflexive_psychodynamic_codex`;
- LLM learner proxy;
- `n=16` paired branches;
- deterministic revalidation changed `0` outcomes.

| Metric | n | Mean Diff | 95% CI | p | Gate |
|---|---:|---:|---:|---:|---|
| MVP adaptation | `16` | `+18.234` | `12.373..24.033` | `0.0002` | pass |
| Parent dialogue | `16` | `+7.031` | `3.359..10.000` | `0.004` | pass |
| Trap outcome | `16` | `+81.250` | `50..100` | `0.001` | pass |

Interpretation:

- strict all-public-metric confirmation passed in this smaller run;
- the adapted tutor passed all original false-mastery outcome branches and most
  counterfactual ready branches;
- remaining failures pointed to already-ready learner calibration, not lack of
  repair pressure.

Use this as evidence that the mechanism can work cleanly, not as the only
headline result.

## Result 2: Larger Post-Calibration Replication

Artifact:

```text
outputs/post-calibration-full-traps-replicated-live-revalidated/
variant-sweep-revalidated-2026-05-17T10-53-36-582Z.html
```

Robustness artifact:

```text
outputs/robustness-post-calibration-full-traps-replicated-live/
robustness-evaluation-2026-05-17T10-53-43-600Z.html
```

Run shape:

- same four hidden-state disciplinary traps;
- `static_codex` baseline versus `controller_reflexive_psychodynamic_codex`;
- LLM learner proxy;
- `n=24` paired branches;
- deterministic revalidation changed `0` outcomes.

| Metric | n | Mean Diff | 95% CI | p | Gate |
|---|---:|---:|---:|---:|---|
| MVP adaptation | `24` | `+10.760` | `5.177..16.375` | `0.002` | pass |
| Parent dialogue | `24` | `+1.417` | `-3.219..6.157` | `0.569` | fail |
| Trap outcome | `24` | `+66.667` | `45.833..83.333` | `0.000` | pass |

Robustness verdict:

```text
Adaptive primary robust positive effect established: yes
Strict all-public-metric confirmation: no
```

Interpretation:

- the prototype establishes adaptive-primary robustness at larger scale;
- strict all-public confirmation does not hold at larger scale because parent
  dialogue is positive but statistically unstable;
- residual target failures concentrate in programming transfer evidence and
  social-measurement ready-branch validity transfer.

Use this as the main conservative status claim.

## What The Prototype Adds

The working adaptation chain is:

```text
learner evidence
-> challenge / mastery / transfer state
-> policy selection
-> persona delta
-> Ego draft
-> Superego critique
-> Ego revision
-> public tutor move
-> learner transfer/outcome evidence
```

This is adaptation without weight updates. The tutor changes because explicit
state and memory change, not because the base model learns new parameters.

The important mechanisms are:

- `challengeState`: detects resistance, forgetfulness, skepticism,
  disinterest, and reversion;
- `transferGate`: blocks premature closure until learner-owned transfer is
  visible in the transcript;
- readiness calibration: moves already-ready learners to transfer or agency
  handoff instead of repeated repair;
- reflexive memory: carries Superego critique across turns so the next Ego
  draft is constrained by prior adaptation risks;
- action-family validators: score semantic transfer rather than exact phrase
  matching.

## Parent-Framework Mapping

The parent framework already has useful pieces:

- `services/adaptiveTutor/stateSchema.js` has `learnerProfile`, `evidenceLog`,
  `hypotheses`, `tutorInternal`, and `revisionLedger`;
- `services/adaptiveTutor/graph.js` already supports LangGraph architectures,
  evidence-bound updater nodes, grounding validation, Ego/Superego paths, and
  `superego_revise_*` variants;
- `services/adaptiveTutor/runner.js` already supports counterfactual replay for
  architectures with learner-profile updates;
- `services/adaptiveTutor/policyActions.js` has the parent policy-action
  taxonomy that should be preserved or carefully extended.

The prototype should therefore be ported as a parent-compatible architecture,
not as a direct copy of prototype labels.

## Integration Steps

### Step 1. Add Parent State Fields

Extend `services/adaptiveTutor/stateSchema.js` with parent-native equivalents
of:

- `challengeState`;
- `transferState` / `transferGate`;
- compact reflexive memory or reuse `revisionLedger` where possible;
- policy-trace metadata needed for post-hoc evaluation.

Keep defaults empty/backward-compatible so existing cells remain schema-valid.

### Step 2. Map Prototype Policies To Parent Actions

Create an explicit mapping layer before touching prompts:

| Prototype Policy | Parent-Compatible Family |
|---|---|
| `teach_back` | `ask_diagnostic_question` / `request_elaboration` |
| `misconception_repair` | `pose_counterexample` / `provide_hint` / `name_the_disagreement` |
| `transfer_challenge` | `scope_test` |
| `transfer_repair` | `scope_test` plus repair constraint |
| `repair_misrecognition` | `repair_misrecognition` |
| `productive_struggle_hold` | `withhold_answer` / `summarize_and_check` |
| `summarize_and_check` | `summarize_and_check` |

This layer should live beside the existing parent action taxonomy, not replace
it. The parent action labels are what the parent rubrics understand.

### Step 3. Add Challenge And Transfer Nodes

In `services/adaptiveTutor/graph.js`, add a new architecture such as:

```text
state_policy_challenge_transfer_reflexive
```

Proposed topology:

```text
evidenceExtractor
-> hypothesisUpdater
-> groundingValidator
-> learnerProfileUpdate
-> challengeObserver
-> transferGateUpdater
-> policySelector
-> tutorEgoInitial
-> tutorSuperegoReview
-> constraintCheck
-> tutorEgoRevision?
-> tutorEmit
-> learnerTurn
```

If graph churn is too high, first implement `challengeObserver` and
`transferGateUpdater` as pure helper calls inside the existing
`learnerProfileUpdate` or `constraintCheck` path, then split them into nodes
once tests are stable.

### Step 4. Enforce Transfer In The Validator

Update the parent `constraintCheck` / `tutorValidator` path so hidden-state
trap scenarios cannot close with only tutor explanation.

The validator must distinguish:

- tutor asked a transfer question;
- learner performed transfer;
- learner rejected the near miss;
- learner produced a portable rule;
- learner was already ready and should not be over-repaired.

This is the main lesson from the prototype: adaptation must be certified by
learner-owned transcript evidence.

### Step 5. Port Reflexive Prompt Contracts

Port only the load-bearing prompt constraints:

- Superego must flag rescue, over-repair, compliance collusion, premature
  closure, and unsupported learner diagnosis;
- Ego must revise into a single public tutor voice;
- internal labels must never be exposed to the learner;
- ready learners must receive transfer or agency handoff, not repeated repair;
- transfer prompts must use the scenario's named transfer case.

Do not port the entire prototype prose wholesale. Parent prompts should remain
aligned with the existing parent action taxonomy and scenario format.

### Step 6. Persist Audit Evidence

Update `services/adaptiveTutor/persistence.js` so each tutor turn records:

- parent policy action;
- mapped prototype family, if used;
- `challengeState`;
- `transferGate`;
- evidence obs ids;
- hypothesis ids/statuses;
- Superego critique and memory/revision ledger entry.

Without this, the integration cannot be audited or replayed.

### Step 7. Add Parent-Stack Replay Gate

Before live parent experiments, use the prototype replay adapter as a template
for a parent-native replay check:

```bash
node prototypes/adaptive-persona-mvp/scripts/replay-parent-stack.js \
  --run-id eval-2026-05-12-de6d48ab \
  --limit 24 \
  --out prototypes/adaptive-persona-mvp/outputs/parent-stack-replay-integration-check
```

Acceptance before live parent runs:

- trigger compatibility does not regress;
- parent-compatible family agreement improves over the current transition
  model;
- challenge and transfer state changes are visible in replay traces;
- no scenario answer key leaks into tutor prompts.

### Step 8. Add Focused Parent Tests

Add parent-level tests before live runs:

- state schema defaults remain backward-compatible;
- challenge state escalates and resolves;
- transfer gate blocks premature closure;
- ready branches avoid over-repair;
- Superego critique can force Ego revision;
- persistence captures state and critique fields;
- existing parent cells still run.

Prototype verification remains:

```bash
node --test prototypes/adaptive-persona-mvp/tests/*.test.js
npx eslint prototypes/adaptive-persona-mvp/**/*.js
```

Parent verification should add focused `services/adaptiveTutor` tests and then
the repo's broader test/static checks.

### Step 9. Run A Small Parent Live Comparison

Only after replay and tests pass, add one parent architecture condition and run
a small parent comparison:

```text
baseline parent state_policy or current best parent tutor
vs state_policy_challenge_transfer_reflexive
```

Use the same reporting discipline:

- paired branches;
- original and counterfactual hidden learner states;
- transcript-level transfer evidence;
- parent dialogue rubric;
- adaptation-primary gate;
- strict public gate reported separately.

### Step 10. Claim Integration Only After Gate Passage

The integration claim should require:

```text
parent runtime uses the new state/action loop
AND parent traces persist the mechanism
AND replay shows expected divergence
AND live parent comparison passes adaptive-primary gates
AND no existing parent baseline/regression tests fail
```

Until then, the correct wording is:

```text
The prototype demonstrates a portable adaptation mechanism that is ready for
parent-framework integration.
```

not:

```text
The parent framework now has the adaptive tutor feature.
```

## Immediate Next Work

1. Repair residual programming transfer failures in the prototype so root-cause
   debugging reliably produces transcript-supported regression and transfer
   evidence.
2. Repair social-measurement ready branches so learners explicitly reject the
   single-item validity shortcut.
3. Stabilize parent-dialogue quality on ready branches without weakening hidden
   trap outcome gates.
4. Start a parent-compatible mapping/state branch using the staged integration
   plan above.
