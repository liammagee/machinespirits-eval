# Plan 2.1 Evidence-Bearing Held-Out Suite Closeout

Date: 2026-06-19
Branch head before this implementation: `258ea857`
Status: implementation loop complete; mechanism evidence mixed

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
- Added tests for scenario metadata, scripted mock learner behavior,
  no-intervention closure, and transfer/application closure.

## Evaluation Runs

Evidence-bearing held-out suite:

| Cell | Run ID | Judge split |
|---|---|---|
| `cell_153_plan2_1_evidence_closed_loop` | `eval-2026-06-19-a4288b54` | mock generation, no judge |
| `cell_154_plan2_1_evidence_repeat_contextual` | `eval-2026-06-19-2fcd40be` | mock generation, no judge |

Regression checks on previously passed suites:

| Cell | Run ID | Suite |
|---|---|---|
| `cell_150_plan2_quality_repeat_contextual_crosssuite` | `eval-2026-06-19-25d44b40` | cross-suite traps |
| `cell_152_plan2_pair_specificity_repeat_contextual` | `eval-2026-06-19-eee9e3a7` | paired counterfactual suite |

Ignored exports were not forced into Git:

- `exports/plan2-1-evidence-bearing-strategy-shift.json`
- `exports/plan2-1-evidence-bearing-pair-specificity.{json,md}`
- `exports/plan2-1-evidence-bearing-belief-calibration.{json,md}`
- `exports/plan2-1-evidence-bearing-outcome-closure.{json,md}`
- `exports/plan2-1-evidence-bearing-outcome-closure-reobserved.{json,md}`
- `exports/plan2-1-regression-crosssuite-strategy-shift.json`
- `exports/plan2-1-regression-paired-specificity.{json,md}`
- `exports/plan2-1-regression-crosssuite-belief-calibration.{json,md}`
- `exports/plan2-1-regression-outcome-closure-reobserved.{json,md}`

## Held-Out Results

Strict shift:

| Profile | Strict shift | Shift window | Family match | Repeated-action refinement |
|---|---:|---:|---:|---:|
| `cell_153_plan2_1_evidence_closed_loop` | 9/10 | 9/10 | 9/10 | 2/5 |
| `cell_154_plan2_1_evidence_repeat_contextual` | 9/10 | 9/10 | 9/10 | 2/5 |

Belief calibration:

| Profile | Evaluable | Top-1 | Top-2 | Top-3 | Brier | ECE | Unsupported high-conf |
|---|---:|---:|---:|---:|---:|---:|---:|
| `cell_153_plan2_1_evidence_closed_loop` | 10/10 | 100.0% | 100.0% | 100.0% | 0.288 | 0.409 | 0.0% |
| `cell_154_plan2_1_evidence_repeat_contextual` | 10/10 | 100.0% | 100.0% | 100.0% | 0.288 | 0.409 | 0.0% |

Pair specificity:

| Profile | Scenario exact | Family | Pair specificity | Different-state divergence | Same-state compatible | False-positive divergence |
|---|---:|---:|---:|---:|---:|---:|
| `cell_153_plan2_1_evidence_closed_loop` | 9/10 | 9/10 | 3/4 | 4/4 | 1/1 | 0/1 |
| `cell_154_plan2_1_evidence_repeat_contextual` | 9/10 | 9/10 | 3/4 | 4/4 | 1/1 | 0/1 |

Outcome closure:

| Profile | Contract complete | Closed | Observable | Evidence-bearing outcome | Success | Failure | Inconclusive | Failure update | No repeat after non-success |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `cell_153_plan2_1_evidence_closed_loop` | 40/40 | 30/30 | 30/30 | 23/30 | 11 | 12 | 7 | 19/19 | 19/19 |
| `cell_154_plan2_1_evidence_repeat_contextual` | 40/40 | 30/30 | 30/30 | 23/30 | 11 | 12 | 7 | 19/19 | 19/19 |

Action-family coverage on the held-out suite:

| Profile | Families covered | Main action counts |
|---|---:|---|
| `cell_153_plan2_1_evidence_closed_loop` | 4 | diagnostic=11, scaffolding=16, agency_preservation=12, repair_affective=1 |
| `cell_154_plan2_1_evidence_repeat_contextual` | 4 | diagnostic=11, scaffolding=16, agency_preservation=12, repair_affective=1 |

## Failure Family

Both frozen-policy cells fail the same case:

| Scenario | Expected | Actual | Trace |
|---|---|---|---|
| `p21_explanation_transfer_after_hint_failure` | `explain_principle` (`lower_cognitive_load` legacy family) | `diagnose_with_discriminating_question` | `ask_diagnostic_question -> provide_hint -> ask_diagnostic_question -> provide_hint` |

Interpretation: the controller detects state labels correctly, but the current
policy does not escalate from a failed hint into explanation or worked-example
support. It returns to diagnosis. This is a genuine policy limitation, not a
mock-learner plumbing failure.

## Regression Check

- `cell_150_plan2_quality_repeat_contextual_crosssuite` remained 6/6 strict
  shift on `eval-2026-06-19-25d44b40`.
- `cell_152_plan2_pair_specificity_repeat_contextual` remained pair-specific:
  3/3 divergent pair specificity, 1/1 same-state compatibility, 0/1
  false-positive divergence on `eval-2026-06-19-eee9e3a7`.

## Claim

This is provisional simulated mechanism evidence, not judge-rated tutoring
quality evidence and not human-learning evidence. The Plan 2.1 instrumentation
now supports explicit belief labels, action-specific mock closure, no
intervention, pair specificity, and outcome evidence. Under this held-out mock
suite, the frozen controller generalizes to productive progress, task misread,
minimal hint after failed diagnosis, affective shutdown, overload, answer
seeking, and same-state controls. It does not yet generalize to escalation from
failed hint into explanation or worked-example support.

The next diagnosis-driven implementation should target that escalation family
only, then rerun this held-out suite plus the cross-suite and paired regression
checks. Do not tune toward Opus or judge quality until the mechanism failure is
closed under mock.
