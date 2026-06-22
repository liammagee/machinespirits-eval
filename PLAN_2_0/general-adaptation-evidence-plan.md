# General Adaptation Evidence Plan

Date: 2026-06-18

Status: follow-up plan and sibling-agent handoff

This plan follows the Plan 2.0 closeout. The current branch claim is deliberately narrow: `cell_149_plan2_quality_repeat_contextual` preserves strict adaptive strategy shifting and improves simulated tutoring quality on the adaptive-trap suite, with Sonnet as the primary judge and Opus as a robustness check. That is evidence of strict adaptive control in the current harness. It is not yet evidence of general adaptation.

## Working Definition

For this branch, evidence of general adaptation means a frozen adaptive policy transfers beyond the scenarios and parameter loops that produced the current result. The tutor must respond to inferred learner state, not merely to surface wording, and that response must improve independent tutoring outcomes.

A claim of general adaptation requires all of the following:

1. Frozen policy: the tested treatment is fixed before held-out evaluation. No parameter tuning inside the target suite.
2. Held-out transfer: the treatment is evaluated on scenario families not used to tune `cell_149`.
3. Counterfactual specificity: surface-similar dialogues with different learner states produce different appropriate actions, and surface-different dialogues with the same learner state produce compatible actions.
4. Outcome closure: each selected action carries a predicted learner-state transition, and the following learner turn confirms, disconfirms, or complicates that prediction.
5. Policy update: failed or inconclusive interventions change the next state belief or action choice rather than causing unreasoned repetition.
6. Multiple intervention families: the effect holds across several action families, not only one repeated maneuver.
7. Independent outcome gain: strict shifting is paired with improved quality, ownership, proof progress, transfer, reduced leakage, or another independent endpoint.
8. Robustness: the result survives judge split, at least Sonnet primary plus Opus cross-check; Codex can remain tentative.
9. Ablation sensitivity: removing or corrupting the adaptive mechanism reduces performance.

## Evidence Ladder

### Stage 0: Freeze The Treatment

Freeze `cell_149_plan2_quality_repeat_contextual` as the source treatment. Do not tune its policy weights until the first held-out transfer pass is complete.

Record the exact branch head, cell definition, and current closeout artifacts in a new `PLAN_2_0/` closeout note before any new run. Use the existing Plan 2.0 note as the model:

- `PLAN_2_0/plan2-quality-repeat-contextual-closeout.md`
- `PLAN_2_0/GENUINE-ADAPTATION-IMPLEMENTATION-PLAN.md`

Primary treatment and baseline cells already registered:

- Treatment: `cell_149_plan2_quality_repeat_contextual`
- Treatment cross-suite sibling: `cell_150_plan2_quality_repeat_contextual_crosssuite`
- Prior closed-loop baseline: `cell_135_plan2_closed_loop`
- Closed-loop cross-suite sibling: `cell_136_plan2_closed_loop_crosssuite`

### Stage 1: Existing Cross-Suite Transfer

Run the frozen cross-suite sibling before inventing new scenarios. This is the cheapest near-held-out test because `cell_150` already points at `config/cross-suite-trap-scenarios.yaml`.

Run:

```bash
node scripts/eval-cli.js run \
  --profiles cell_136_plan2_closed_loop_crosssuite,cell_150_plan2_quality_repeat_contextual_crosssuite \
  --runs 1
```

Then judge with Sonnet:

```bash
node scripts/eval-cli.js evaluate <RUN_ID> \
  --judge-cli claude --model sonnet \
  --skip-deliberation --parallelism 1 --verbose
```

Analyze strict shift and quality with exact judge filtering:

```bash
node scripts/analyze-strategy-shift.js \
  --run-id <RUN_ID> \
  --profile cell_150_plan2_quality_repeat_contextual_crosssuite \
  --judge-model claude-code/sonnet \
  --out exports/plan2-general-adaptation-stage1-strategy-shift.json

node scripts/analyze-adaptation-quality.js \
  --run-id <RUN_ID> \
  --judge-model claude-code/sonnet \
  --baseline cell_136_plan2_closed_loop_crosssuite \
  --out exports/plan2-general-adaptation-stage1-sonnet-quality.json \
  --markdown exports/plan2-general-adaptation-stage1-sonnet-quality.md
```

If Stage 1 fails, do not start parameter search. Write a failure-family note first. Identify whether the collapse is strict shift, quality, outcome closure, repeated-action realization, or scenario-family mismatch.

### Stage 2: Counterfactual Specificity Suite

Add a small paired scenario suite that separates surface form from learner state. This is the first direct test of general adaptation.

Create a new scenario file, for example:

- `config/adaptive-generalization-counterfactual-scenarios.yaml`

Each pair should have explicit metadata:

- `pair_id`
- `pair_type`: `same_surface_different_state` or `different_surface_same_state`
- `expected_strategy_shift`
- `expected_strategy_family`
- `hidden_state_contrast`
- `surface_features`
- `learner_state_evidence`

Minimum pairs:

1. Same surface, different state:
   - Learner says the same approval-seeking phrase, but one case is genuine confusion and the other is strategic answer-seeking.
   - Expected actions should diverge.
2. Same surface, different state:
   - Learner gives a correct procedure, but one case lacks rationale and the other lacks transfer confidence.
   - Expected actions should diverge.
3. Different surface, same state:
   - Different topic wording but the same ownership gap.
   - Expected actions should match by family.
4. Different surface, same state:
   - Different affective style but the same proof/release failure.
   - Expected actions should match by family.

Implement or extend an analyzer, preferably:

- `scripts/analyze-adaptation-generalization.js`

Required metrics:

- strict shift rate
- family match rate
- pair specificity rate
- same-state action compatibility
- different-state action divergence
- counterfactual false-positive rate
- scenario-family breakdown

Add tests for the analyzer before running paid evaluations.

### Stage 3: Outcome Closure Scoring

General adaptation requires more than selecting the right action label. Score whether the selected action predicted a learner-state transition and whether the next turn changed the policy state.

Implement or extend an analyzer for the Plan 2.0 adaptation contract traces:

- preferred: `scripts/analyze-adaptation-outcome-closure.js`
- acceptable: extend `scripts/analyze-adaptation-generalization.js`

Required metrics:

- contract completeness rate
- predicted-transition observability rate
- confirmed transition rate
- disconfirmed transition rate
- inconclusive transition rate
- failure update rate
- no-unreasoned-repeat rate
- action-family coverage
- tutor-control trend

The analyzer should read traces directly from existing adaptive dialogue logs or persisted adaptive traces. It should not use judge prose as the source of truth for the selected action.

### Stage 4: Broader Held-Out Generalization Suite

Only after Stage 1 and Stage 2 are implemented should the agent add a broader held-out scenario file:

- `config/adaptive-generalization-scenarios.yaml`

This suite should include new domains and new trap shapes while preserving the same schema used by the adaptive runner. Keep it small enough to evaluate fully, but broad enough to avoid one-family overfit.

Recommended minimum:

- 12 scenarios total
- at least 4 action families
- at least 4 task domains
- at least 3 learner-state ambiguity types
- at least 3 cases where the correct action is to withhold or release control
- at least 3 cases where the correct action is to ask for discriminating evidence

Register frozen treatment and baseline siblings:

- `cell_151_plan2_generalization_frozen`
- `cell_152_plan2_generalization_closed_loop_baseline`

Both should point at `config/adaptive-generalization-scenarios.yaml`. `cell_151` should copy the `cell_149` policy without tuning. `cell_152` should copy the `cell_135` policy without tuning.

### Stage 5: Ablations And Negative Controls

If the frozen policy transfers, add ablations to test whether the mechanism is doing the work.

Minimum negative controls:

1. State-scramble control: learner-state hypotheses or expected action labels are shuffled within the suite before policy selection or scoring.
2. Outcome-closure-off control: selected action can be realized, but previous intervention outcomes do not update the next state.
3. Context-realization-off control: same policy as `cell_149`, but repeated-action context realization disabled.

The expected result is not that every ablation collapses on every metric. The expected result is targeted degradation:

- state-scramble should reduce pair specificity and family match
- outcome-closure-off should reduce failure update and no-repeat behavior
- context-realization-off should reduce quality when the same action repeats

If ablations do not reduce the targeted metrics, the evidence does not support a mechanism claim.

### Stage 6: Judge Split And Robustness

Use Sonnet as the primary judge for final tables. After Sonnet completes, run Opus as a preserved-history cross-check. Keep Codex tentative only.

Commands should follow the established Plan 2.0 pattern:

```bash
node scripts/eval-cli.js rejudge <RUN_ID> \
  --judge-cli claude --model opus \
  --source-judge claude-code/sonnet \
  --skip-deliberation --verbose
```

All analysis must use exact `--judge-model` filters. Never average Sonnet, Opus, and Codex rows together.

## Decision Rules

### Provisional Evidence Of General Adaptation

The branch may claim provisional simulated evidence of general adaptation only if all of the following hold:

1. Stage 1 cross-suite transfer preserves strict shift at >= 85%.
2. Stage 1 quality composite is above the cross-suite closed-loop baseline.
3. Stage 2 pair specificity is >= 80%.
4. Stage 3 contract completeness is >= 90%.
5. Stage 3 failure update or no-unreasoned-repeat rate is >= 75%.
6. The broader held-out suite preserves strict shift at >= 80%.
7. The broader held-out suite improves at least one independent outcome over baseline without a content-accuracy or dialogue-quality collapse.
8. Opus agrees on the direction of the main quality or development result.
9. At least one targeted ablation produces the predicted degradation.

The claim must remain bounded:

- simulated learner evidence only
- no human-learning claim
- no deployment claim
- no retroactive rescoring claim
- no claim that all forms of adaptation are solved

### Strong Failure Signal

Treat the Plan 2.0 generalization attempt as failed, or at least not yet generalized, if any of the following occur:

1. Cross-suite `cell_150` fails strict shift below 85%.
2. Cross-suite `cell_150` preserves strict shift but falls below baseline quality.
3. Pair specificity is near chance or dominated by one action family.
4. Outcome closure cannot be recovered from traces without post-hoc judge interpretation.
5. The broader held-out suite collapses on strict shift or independent quality.
6. Ablations do not degrade targeted metrics.
7. Opus reverses the primary Sonnet direction on last-turn or development quality.

If a strong failure signal appears, stop the loop and write a failure-family note. Do not tune blindly.

## Loop Discipline

The sibling agent should loop, but not by unconstrained parameter search.

Allowed loop:

1. Run a frozen-policy evaluation.
2. Analyze the exact failure family.
3. Write a short failure-family note in `PLAN_2_0/`.
4. Make one diagnosis-driven change.
5. Re-run the failed held-out suite and at least one prior passed suite.
6. Accept the change only if it fixes the target failure without erasing the previous evidence.

Disallowed loop:

- sweeping policy weights without a failure-family hypothesis
- changing scenario labels after looking at model outputs
- tuning on the same held-out suite and then calling it held-out
- mixing judge rows
- claiming general adaptation from strict shift alone

## Sibling-Agent Handoff

Use the following instructions for the implementation/evaluation agent.

```text
You are implementing the Plan 2.0 general-adaptation follow-up in /Users/lmagee/Dev/machinespirits/machinespirits-eval-derivation.

Read first:
- PLAN_2_0/plan2-quality-repeat-contextual-closeout.md
- PLAN_2_0/GENUINE-ADAPTATION-IMPLEMENTATION-PLAN.md
- PLAN_2_0/general-adaptation-evidence-plan.md
- config/tutor-agents.yaml around cells 135-150
- scripts/analyze-strategy-shift.js
- scripts/analyze-adaptation-quality.js
- tests/adaptation-quality-analysis.test.js

Goal:
Find concrete evidence of general adaptation, or strong evidence that the Plan 2.0 approach does not generalize beyond the current trap suite.

Constraints:
- Start with frozen-policy transfer. Do not tune cell_149 or cell_150 before Stage 1.
- Keep Sonnet, Opus, and Codex judge histories separate with exact judge-model filters.
- Treat Opus as robustness, not the tuning target.
- Do not claim human learning.
- Do not claim deployment readiness.
- Do not force ignored exports into Git. Cite export paths in closeout notes.
- If a run fails from limits or transient CLI issues, resume/retry the same command. If the result fails substantively, write the failure-family note before changing parameters.

Stage 1:
Run and judge cell_136 vs cell_150 on config/cross-suite-trap-scenarios.yaml. Analyze strict shift and adaptation quality. If cell_150 does not preserve strict shift and improve quality over cell_136, stop and write the failure-family note.

Stage 2:
Implement config/adaptive-generalization-counterfactual-scenarios.yaml and an analyzer for pair specificity. Add tests before paid evaluation. Evaluate the frozen treatment on the paired suite.

Stage 3:
Implement outcome-closure analysis from adaptive traces: contract completeness, predicted-transition observability, confirmation/disconfirmation/inconclusive rates, failure update, no-unreasoned-repeat, and action-family coverage.

Stage 4:
Create config/adaptive-generalization-scenarios.yaml plus frozen treatment/baseline cells. Evaluate strict shift, pair specificity if applicable, outcome closure, and independent quality.

Stage 5:
Add targeted ablations or negative controls only after a frozen-policy positive. The ablations must test mechanism claims: state scramble, outcome closure off, and context realization off.

Closeout:
Write a concise note in PLAN_2_0/ with branch head, run ids, cells, judge split, strict-shift table, quality table, pair-specificity table, outcome-closure table, ablation table, and bounded claim. The closeout should say either:
- "provisional simulated evidence of general adaptation", with explicit limits; or
- "Plan 2.0 did not generalize under these tests", with failure families.

Loop:
Iterate only through diagnosis-driven changes. After any change, re-run the failed held-out suite and at least one previously passed suite to avoid overfitting.
```

## Initial Test Plan For Implementation

Run these before committing any analyzer or cell-registry changes:

```bash
node --check scripts/analyze-adaptation-generalization.js
node --check scripts/analyze-adaptation-outcome-closure.js
node --test tests/adaptation-quality-analysis.test.js
node --test tests/adaptation-generalization-analysis.test.js
node --test tests/adaptation-outcome-closure-analysis.test.js
git diff --check
```

If only one analyzer is implemented, omit the unavailable checks until the file exists.
