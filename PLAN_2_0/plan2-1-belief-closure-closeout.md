# Plan 2.1 Belief-State and Evidence-Bearing Closure Closeout

Date: 2026-06-19
Status: first implementation loop complete
Source plan: `PLAN_2_0/plan2-1-belief-closure-technical-plan.md`

## Implemented

- Added a Plan 2.1 technical plan from
  `PLAN_2_0/adaptation-extension-deep-research.md`.
- Added `scripts/analyze-adaptation-belief-calibration.js`, a read-only trace
  analyzer for trigger-plus-one learner-state belief coverage, Brier score,
  expected calibration error, top-two margin, and unsupported high confidence.
- Extended `scripts/analyze-adaptation-outcome-closure.js` with
  evidence-bearing observed success/failure metrics and a read-only
  `--reobserve` mode that reclassifies closure outcomes from stored dialogue
  text without mutating DB rows or trace files.
- Added `observe_no_intervention` as a first-class typed Plan 2.x action for
  learner-owned productive progress.
- Updated the proof/release/ownership gate so `observe_no_intervention` is not
  automatically repaired into `ask_strategy_choice` when it carries a meaningful
  learner-authorship opportunity.
- Extended the deterministic policy fixture with productive-progress cases.

## Evaluation Artifacts

Ignored exports were not forced into Git:

- `exports/plan2-1-policy-evaluation.json`
- `exports/plan2-1-policy-evaluation.md`
- `exports/plan2-1-crosssuite-belief-calibration.{json,md}`
- `exports/plan2-1-paired-belief-calibration.{json,md}`
- `exports/plan2-1-crosssuite-outcome-closure.{json,md}`
- `exports/plan2-1-paired-outcome-closure.{json,md}`
- `exports/plan2-1-crosssuite-outcome-closure-reobserved.{json,md}`
- `exports/plan2-1-paired-outcome-closure-reobserved.{json,md}`

## Deterministic Policy Check

Command:

```bash
node scripts/evaluate-adaptation-policy.js \
  --compare legacy,closed_loop \
  --output exports/plan2-1-policy-evaluation.json
```

Result:

| Condition | Strict joint success | State top-1 |
|---|---:|---:|
| legacy | 0.375 | 0.125 |
| closed_loop | 1.000 | 1.000 |

The new productive-progress fixtures now exercise `observe_no_intervention`
directly:

| Scenario | Legacy actions | Closed-loop actions |
|---|---|---|
| `productive-progress-1` | `explain_principle -> minimal_hint -> contrast_models` | `observe_no_intervention -> observe_no_intervention -> observe_no_intervention` |
| `productive-progress-2` | `explain_principle -> minimal_hint -> contrast_models` | `observe_no_intervention -> observe_no_intervention -> observe_no_intervention` |

This is a deterministic mechanics check only. It is not new simulated tutoring
evidence, judge-rated quality evidence, or human-learning evidence.

## Belief Calibration On Existing Final Runs

Sonnet rows only.

| Suite | Profile | Evaluable | Top-1 | Top-2 | Top-3 | Brier | ECE | Unsupported high-conf |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| Cross-suite | `cell_136_plan2_closed_loop_crosssuite` | 5/6 | 80.0% | 80.0% | 80.0% | 0.490 | 0.201 | 0.0% |
| Cross-suite | `cell_150_plan2_quality_repeat_contextual_crosssuite` | 5/6 | 80.0% | 80.0% | 80.0% | 0.490 | 0.201 | 0.0% |
| Paired | `cell_151_plan2_pair_specificity_closed_loop` | 8/8 | 100.0% | 100.0% | 100.0% | 0.296 | 0.417 | 0.0% |
| Paired | `cell_152_plan2_pair_specificity_repeat_contextual` | 8/8 | 100.0% | 100.0% | 100.0% | 0.296 | 0.417 | 0.0% |

Interpretation: the state labels usually cover the intended hidden state, but
the probabilities are not yet calibrated enough to support policy learning.
The baseline and treatment are identical on these belief metrics, so the
previous Sonnet quality gain is not explained by a better state estimator.

## Outcome Closure On Existing Final Runs

Stored closure labels:

| Suite | Profile | Observed success/failure | Success | Failure | Inconclusive |
|---|---|---:|---:|---:|---:|
| Cross-suite | `cell_136_plan2_closed_loop_crosssuite` | 6.7% | 1 | 0 | 14 |
| Cross-suite | `cell_150_plan2_quality_repeat_contextual_crosssuite` | 6.7% | 1 | 0 | 14 |
| Paired | `cell_151_plan2_pair_specificity_closed_loop` | 6.3% | 1 | 0 | 15 |
| Paired | `cell_152_plan2_pair_specificity_repeat_contextual` | 6.3% | 1 | 0 | 15 |

Reobserved from stored dialogue text with the refined action-specific observer:

| Suite | Profile | Observed success/failure | Success | Failure | Inconclusive | No repeat after non-success |
|---|---|---:|---:|---:|---:|---:|
| Cross-suite | `cell_136_plan2_closed_loop_crosssuite` | 80.0% | 6 | 6 | 3 | 88.9% |
| Cross-suite | `cell_150_plan2_quality_repeat_contextual_crosssuite` | 80.0% | 6 | 6 | 3 | 88.9% |
| Paired | `cell_151_plan2_pair_specificity_closed_loop` | 62.5% | 2 | 8 | 6 | 92.9% |
| Paired | `cell_152_plan2_pair_specificity_repeat_contextual` | 62.5% | 2 | 8 | 6 | 92.9% |

Interpretation: much of the old inconclusive bucket was observer
under-classification. Reobserved closure recovers useful failure signal,
especially when the mock learner replies with generic "can you explain more?"
after a diagnostic or hint. The result is still not a treatment-specific gain:
baseline and treatment remain identical on the closure metrics because they
share the same policy and learner simulator pathways.

## Tests

Passed:

```bash
node --check services/adaptiveTutor/actionPolicy.js
node --check services/adaptiveTutor/outcomeObserver.js
node --check services/adaptiveTutor/proofReleaseOwnershipGate.js
node --check scripts/analyze-adaptation-belief-calibration.js
node --check scripts/analyze-adaptation-outcome-closure.js
node --check scripts/evaluate-adaptation-policy.js
node --test \
  tests/adaptation-policy.test.js \
  tests/adaptation-gate.test.js \
  tests/adaptation-outcome-closure.test.js \
  tests/adaptation-belief-calibration.test.js \
  tests/outcome-observer.test.js \
  tests/adaptation-generalization-analysis.test.js \
  tests/adaptation-closed-loop.test.js \
  tests/adaptation-realization.test.js \
  tests/trapTurnConvention.test.js
git diff --check
```

## Current Claim

Plan 2.1 does not yet add a new tutoring-quality result. It adds a stronger
measurement and control layer:

- the existing Plan 2.0 final runs have mostly correct hidden-state label
  coverage but rough calibration;
- the previous "mostly inconclusive closure" result was partly an observer
  limitation;
- reobserved action-specific closure creates usable success/failure signal;
- explicit no-intervention is now available and passes the proof/release/
  ownership gate under productive-progress evidence.

## Next Diagnosis-Driven Step

Do not begin policy optimization yet. The next systematic step is an
evidence-bearing held-out suite where scenarios require delayed or near-transfer
closure rather than immediate acknowledgment. That suite should include:

- productive-progress cases where `observe_no_intervention` is the expected
  action;
- minimal-hint cases with an independent next-step check;
- worked-example or explanation cases with an isomorphic transfer item;
- affective-stabilization cases requiring re-engagement plus task progress;
- same-surface/different-state pairs with explicit `expected_belief_hypothesis`
  metadata, so calibration no longer depends on fallback inference.

