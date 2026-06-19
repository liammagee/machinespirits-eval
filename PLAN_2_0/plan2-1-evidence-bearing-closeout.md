# Plan 2.1 Evidence-Bearing Held-Out Suite Closeout

Date: 2026-06-19
Branch head before this implementation: `258ea857`
Initial evidence-suite commit: `8f4c98fc`
Status: second implementation loop complete; provisional simulated mechanism evidence positive under mock

## Implemented

- Added `config/adaptive-plan2-1-evidence-bearing-scenarios.yaml`, a ten-scenario
  held-out suite with explicit `expected_belief_hypothesis`,
  `expected_adaptation_action`, pair metadata, and mock-only action-specific
  closure replies.
- Registered frozen-policy cells:
  - `cell_153_plan2_1_evidence_closed_loop`
  - `cell_154_plan2_1_evidence_repeat_contextual`
- Extended adaptive hidden state with optional `scriptedResponses`, consumed
  only by mock learner generation after the trigger turn.
- Added a targeted escalation rule: after a non-successful `minimal_hint` under
  a high-confidence `missing_prerequisite` belief, select `explain_principle`
  and allow that higher-control move through the proof/release/ownership gate.
- Added tests for scenario metadata, scripted mock learner behavior,
  no-intervention closure, transfer/application closure, and failed-hint
  escalation.

## Evaluation Runs

Evidence-bearing held-out suite, initial mixed pass:

| Cell | Run ID | Judge split |
|---|---|---|
| `cell_153_plan2_1_evidence_closed_loop` | `eval-2026-06-19-a4288b54` | mock generation, no judge |
| `cell_154_plan2_1_evidence_repeat_contextual` | `eval-2026-06-19-2fcd40be` | mock generation, no judge |

Evidence-bearing held-out suite, final repaired pass:

| Cell | Run ID | Judge split |
|---|---|---|
| `cell_153_plan2_1_evidence_closed_loop` | `eval-2026-06-19-40e60405` | mock generation, no judge |
| `cell_154_plan2_1_evidence_repeat_contextual` | `eval-2026-06-19-e580a334` | mock generation, no judge |

Regression checks on previously passed suites after the repair:

| Cell | Run ID | Suite |
|---|---|---|
| `cell_150_plan2_quality_repeat_contextual_crosssuite` | `eval-2026-06-19-74b88e79` | cross-suite traps |
| `cell_152_plan2_pair_specificity_repeat_contextual` | `eval-2026-06-19-8a498ffb` | paired counterfactual suite |

Ignored exports were not forced into Git:

- `exports/plan2-1-evidence-bearing-strategy-shift.json`
- `exports/plan2-1-evidence-bearing-pair-specificity.{json,md}`
- `exports/plan2-1-evidence-bearing-belief-calibration.{json,md}`
- `exports/plan2-1-evidence-bearing-outcome-closure.{json,md}`
- `exports/plan2-1-evidence-bearing-outcome-closure-reobserved.{json,md}`
- `exports/plan2-1-evidence-bearing-v3-strategy-shift.json`
- `exports/plan2-1-evidence-bearing-v3-pair-specificity.{json,md}`
- `exports/plan2-1-evidence-bearing-v3-belief-calibration.{json,md}`
- `exports/plan2-1-evidence-bearing-v3-outcome-closure.{json,md}`
- `exports/plan2-1-regression-crosssuite-strategy-shift.json`
- `exports/plan2-1-regression-paired-specificity.{json,md}`
- `exports/plan2-1-regression-crosssuite-belief-calibration.{json,md}`
- `exports/plan2-1-regression-outcome-closure-reobserved.{json,md}`
- `exports/plan2-1-regression-v2-crosssuite-strategy-shift.json`
- `exports/plan2-1-regression-v2-paired-specificity.{json,md}`
- `exports/plan2-1-regression-v2-crosssuite-belief-calibration.{json,md}`
- `exports/plan2-1-regression-v2-outcome-closure-reobserved.{json,md}`

## Held-Out Results

Strict shift:

| Profile | Strict shift | Shift window | Family match | Repeated-action refinement |
|---|---:|---:|---:|---:|
| `cell_153_plan2_1_evidence_closed_loop` | 10/10 | 10/10 | 10/10 | 2/5 |
| `cell_154_plan2_1_evidence_repeat_contextual` | 10/10 | 10/10 | 10/10 | 2/5 |

Belief calibration:

| Profile | Evaluable | Top-1 | Top-2 | Top-3 | Brier | ECE | Unsupported high-conf |
|---|---:|---:|---:|---:|---:|---:|---:|
| `cell_153_plan2_1_evidence_closed_loop` | 10/10 | 100.0% | 100.0% | 100.0% | 0.282 | 0.402 | 0.0% |
| `cell_154_plan2_1_evidence_repeat_contextual` | 10/10 | 100.0% | 100.0% | 100.0% | 0.282 | 0.402 | 0.0% |

Pair specificity:

| Profile | Scenario exact | Family | Pair specificity | Different-state divergence | Same-state compatible | False-positive divergence |
|---|---:|---:|---:|---:|---:|---:|
| `cell_153_plan2_1_evidence_closed_loop` | 10/10 | 10/10 | 4/4 | 4/4 | 1/1 | 0/1 |
| `cell_154_plan2_1_evidence_repeat_contextual` | 10/10 | 10/10 | 4/4 | 4/4 | 1/1 | 0/1 |

Outcome closure:

| Profile | Contract complete | Closed | Observable | Evidence-bearing outcome | Success | Failure | Inconclusive | Failure update | No repeat after non-success |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `cell_153_plan2_1_evidence_closed_loop` | 40/40 | 30/30 | 30/30 | 24/30 | 12 | 12 | 6 | 18/18 | 18/18 |
| `cell_154_plan2_1_evidence_repeat_contextual` | 40/40 | 30/30 | 30/30 | 24/30 | 12 | 12 | 6 | 18/18 | 18/18 |

Action-family coverage on the held-out suite:

| Profile | Families covered | Main action counts |
|---|---:|---|
| `cell_153_plan2_1_evidence_closed_loop` | 4 | diagnostic=10, scaffolding=16, agency_preservation=13, repair_affective=1 |
| `cell_154_plan2_1_evidence_repeat_contextual` | 4 | diagnostic=10, scaffolding=16, agency_preservation=13, repair_affective=1 |

## Diagnosed Failure and Repair

The first pass exposed the same failure in both frozen-policy cells:

| Scenario | Expected | Actual | Trace |
|---|---|---|---|
| `p21_explanation_transfer_after_hint_failure` | `explain_principle` (`lower_cognitive_load` legacy family) | `diagnose_with_discriminating_question` | `ask_diagnostic_question -> provide_hint -> ask_diagnostic_question -> provide_hint` |

Interpretation: the controller detected state labels correctly, but the policy
did not escalate from a non-successful hint into explanation or worked-example
support. It returned to diagnosis. Trace inspection showed the outcome observer
marked "need the prerequisite idea" as inconclusive, so the selector did not
see a failed hint.

Repair:

- classify "need the prerequisite idea" / "small hint is still not enough" as
  deeper-gap evidence for `minimal_hint`;
- treat a non-successful `minimal_hint` under high-confidence
  `missing_prerequisite` as an escalation condition;
- suppress diagnostic insertion under that condition;
- allow `explain_principle` through the proof/release/ownership gate when it is
  the escalation after a lower-control hint non-success.

The final repaired pass cleared the scenario: 10/10 strict shift and 4/4
pair-specificity in both cells.

## Regression Check

- `cell_150_plan2_quality_repeat_contextual_crosssuite` remained 6/6 strict
  shift on `eval-2026-06-19-74b88e79`.
- `cell_152_plan2_pair_specificity_repeat_contextual` remained pair-specific:
  3/3 divergent pair specificity, 1/1 same-state compatibility, 0/1
  false-positive divergence on `eval-2026-06-19-8a498ffb`.

## Claim

This is provisional simulated mechanism evidence, not judge-rated tutoring
quality evidence and not human-learning evidence. The Plan 2.1 instrumentation
now supports explicit belief labels, action-specific mock closure, no
intervention, pair specificity, and outcome evidence. Under this held-out mock
suite, the repaired controller generalizes to productive progress, task
misread, minimal hint after failed diagnosis, explanation after failed hint,
affective shutdown, overload, answer seeking, and same-state controls.

The next step should move from mock mechanism evidence to independent quality
evaluation on the repaired held-out suite, keeping Sonnet, Opus, and Codex
judge histories separated by exact `judge_model` filters. Do not claim human
learning, retention, transfer, or deployment readiness from this result.
