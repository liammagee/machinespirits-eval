# Plan 2.1 Belief-State and Evidence-Bearing Closure Technical Plan

Date: 2026-06-19
Status: implementation plan and first vertical slice
Source: `PLAN_2_0/adaptation-extension-deep-research.md`

## Purpose

The Plan 2.0 general-adaptation branch now has a narrow positive: the repaired
closed-loop policy preserves strict state-action shifts on trap-derived held-out
suites and improves Sonnet-scored quality modestly. The extension report argues
that the next standard is not another prompt-tuning loop. It is adaptation
validity: whether the system's state belief is calibrated, whether action choice
uses the remaining uncertainty appropriately, whether no-intervention is
available, and whether closure records evidence-bearing learner changes rather
than merely marking an intervention as closed.

This technical plan implements the first no-cost, trace-first slice of that
standard.

## Constraints

- Preserve the Plan 2.0 positive cells as frozen baselines.
- Do not tune `cell_149`, `cell_150`, `cell_151`, or `cell_152` from these
  metrics.
- Keep Sonnet, Opus, and Codex rows separated by exact `judge_model` filters
  when judge scores are involved.
- Treat existing mock-generated traces as mechanism evidence only.
- Do not claim human learning, retention, transfer, or deployment readiness.
- Do not learn from inconclusive closure records.

## Implemented Slice

### 1. Belief calibration analyzer

Add `scripts/analyze-adaptation-belief-calibration.js`.

The analyzer reads scenario definitions and adaptive dialogue traces, then
scores the learner-state belief at the trigger-plus-one policy turn. Because
current scenario files do not yet carry a canonical hidden-state label, the
analyzer first uses an explicit `expected_belief_hypothesis` field when present
and otherwise applies a deterministic fallback from scenario metadata and hidden
state text.

Metrics:

- top-1, top-2, and top-3 hidden-state coverage;
- Brier score against the inferred hidden-state label;
- expected calibration error over top-hypothesis confidence;
- mean top-two probability margin;
- unsupported high-confidence rate;
- missing belief trace rate;
- per-profile and per-scenario outputs.

Acceptance for this slice is diagnostic, not promotional. The analyzer must be
stable, tested, and able to show whether current Plan 2.0 positives rest on
well-calibrated beliefs or merely correct action routing.

### 2. Evidence-bearing closure refinement

Extend `scripts/analyze-adaptation-outcome-closure.js`.

Existing Plan 2.0 closure analysis reports that interventions close and that
some evidence span is present. The extension report requires a sharper split:
success or failure should be counted as observed only when the action-specific
success/forbidden evidence rule produces a non-inconclusive outcome. Polite
agreement and immediate acknowledgment must not silently count as learning.

New metrics:

- observed success/failure rate;
- evidence-bearing success rate;
- evidence-bearing failure rate;
- inconclusive-with-evidence rate;
- false-success-from-agreement count;
- action-specific closure status counts.

### 3. First-class no-intervention action

Add an explicit `observe_no_intervention` action to the typed Plan 2.0 action
registry.

The action is not silent absence. It is a low-control move that names the tutor's
decision to hold back and asks the learner to continue authoring the next move.
It should be selected when the learner already shows productive, learner-owned
progress and another tutor intervention would reduce agency.

Implementation requirements:

- add the action to the typed adaptation action registry;
- add a productive-progress hypothesis with evidence cues;
- map the typed action to a legacy policy label for existing strict-shift
  analyzers;
- include it in action-family analyzers;
- test selection under productive-progress evidence;
- ensure uncertainty and explicit learner need still override it.

### 4. No-cost evaluation pass

Run tests and analyzers before any paid generation or judging:

```bash
node --check services/adaptiveTutor/actionPolicy.js
node --check scripts/analyze-adaptation-outcome-closure.js
node --check scripts/analyze-adaptation-belief-calibration.js
node --test tests/adaptation-policy.test.js tests/adaptation-outcome-closure.test.js tests/adaptation-belief-calibration.test.js
```

Then run the new analyzers on the final Plan 2.0 cross-suite and paired runs:

```bash
node scripts/analyze-adaptation-belief-calibration.js \
  --run-id eval-2026-06-19-6c59b6e9,eval-2026-06-19-044225fd \
  --scenario-file config/cross-suite-trap-scenarios.yaml \
  --judge-model claude-code/sonnet \
  --out exports/plan2-1-crosssuite-belief-calibration.json \
  --markdown exports/plan2-1-crosssuite-belief-calibration.md

node scripts/analyze-adaptation-belief-calibration.js \
  --run-id eval-2026-06-19-08df153e,eval-2026-06-19-c2bf8146 \
  --scenario-file config/adaptive-generalization-counterfactual-scenarios.yaml \
  --judge-model claude-code/sonnet \
  --out exports/plan2-1-paired-belief-calibration.json \
  --markdown exports/plan2-1-paired-belief-calibration.md
```

Regenerate outcome-closure reports with the refined metrics for the same runs.

## Interpretation Gates

This slice can support one of three outcomes:

1. **Stronger mechanism support:** strict shifts remain positive and belief
   coverage is high with low unsupported confidence.
2. **Policy-routing-only support:** actions are correct but belief calibration
   is weak. The next step is state-estimation repair before policy learning.
3. **Closure bottleneck confirmed:** most records remain inconclusive under the
   evidence-bearing definition. The next step is action-specific delayed tasks,
   not policy optimization.

## Out of Scope For This Slice

- contextual bandits or reinforcement learning;
- human-learning claims;
- new Opus/paid judge passes;
- new generalization scenarios;
- retroactive historical rescoring;
- changing the frozen Plan 2.0 treatment parameters.

