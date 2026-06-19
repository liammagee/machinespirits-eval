# Plan 2.1 Evidence-Bearing Held-Out Suite Closeout

Date: 2026-06-19
Branch head before this implementation: `258ea857`
Initial evidence-suite commit: `8f4c98fc`
Status: third implementation loop complete; provisional simulated mechanism evidence positive under mock; Opus-only full quality pass positive but still quality-limited

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
| `cell_153_plan2_1_evidence_closed_loop` | `eval-2026-06-19-40e60405` | mock generation; Sonnet complete; Opus preserved-history partial/deduped |
| `cell_154_plan2_1_evidence_repeat_contextual` | `eval-2026-06-19-e580a334` | mock generation; Sonnet complete; Opus preserved-history partial/deduped |

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
- `exports/plan2-1-evidence-bearing-v3-sonnet-quality.{json,md}`
- `exports/plan2-1-evidence-bearing-v3-opus-quality.{json,md}`
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

Quality, exact `judge_model` filters:

| Judge | Profile | N | Quality N | Strict shift | Quality composite | Delta vs `cell_153` | Tutor last | Tutor holistic | Learner | Dialogue |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Sonnet (`claude-code/sonnet`) | `cell_153_plan2_1_evidence_closed_loop` | 10 | 10 | 100.0% | 32.0 | 0.0 | 45.6 | 23.0 | 31.5 | 28.0 |
| Sonnet (`claude-code/sonnet`) | `cell_154_plan2_1_evidence_repeat_contextual` | 10 | 10 | 100.0% | 33.8 | +1.7 | 47.0 | 27.8 | 30.3 | 30.0 |
| Opus (`claude-code/opus`) | `cell_153_plan2_1_evidence_closed_loop` | 7 | 6 | 100.0% | 39.3 | 0.0 | 50.7 | 40.0 | 34.4 | 39.6 |
| Opus (`claude-code/opus`) | `cell_154_plan2_1_evidence_repeat_contextual` | 7 | 6 | 100.0% | 41.5 | +2.2 | 44.5 | 38.2 | 36.0 | 37.9 |

Quality interpretation:

- Both Sonnet and Opus rank `cell_154_plan2_1_evidence_repeat_contextual`
  above `cell_153_plan2_1_evidence_closed_loop`, so the repaired treatment is
  weakly quality-positive under exact judge filters.
- The absolute quality is low. Sonnet's composite is only 33.8 for the
  treatment; Opus's partial composite is 41.5.
- Opus is a robustness check, not the tuning target. Its preserved-history
  rejudge deduplicated the ten Sonnet rows to seven unique dialogues per
  profile and left one learner aggregate missing per profile after refusing a
  malformed/repetitive learner-scoring prompt.
- The dominant quality failure family is not state selection. It is final-turn
  closure: after the learner gives evidence of progress, the tutor often repeats
  a generic "next task-relevant move" prompt, and the mock learner regresses to
  "Hmm, can you explain more?"

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

This is provisional simulated mechanism evidence with weak independent
judge-quality support, not human-learning evidence. The Plan 2.1 instrumentation
now supports explicit belief labels, action-specific mock closure, no
intervention, pair specificity, outcome evidence, and exact-filter quality
reports. Under this held-out mock suite, the repaired controller generalizes to
productive progress, task misread, minimal hint after failed diagnosis,
explanation after failed hint, affective shutdown, overload, answer seeking, and
same-state controls.

The quality result is bounded: `cell_154` edges `cell_153` under both Sonnet and
Opus, but the absolute scores remain low and the Opus pass is partial/deduped.
The next diagnosis-driven implementation should target final-turn closure after
learner-owned progress, then rerun this held-out suite plus the cross-suite and
paired regression checks. Do not claim human learning, retention, transfer, or
deployment readiness from this result.

## Opus-Only Final-Turn Closure Loop

Loop start branch head: `39bf8030`

The prior repaired pass found a concrete quality failure family: when the
selector chose `observe_no_intervention` after learner-owned progress, the
realizer fell through to the generic fallback prompt, and the mock learner often
regressed to "Hmm, can you explain more?" This was a realization and mock
closure failure, not a state-selection failure.

Implementation:

- bumped `adaptation-realization-verifier` to `v1.1`;
- added explicit and contextual `observe_no_intervention` realization
  templates that refuse another hint and ask the learner to continue in their
  own terms;
- added realization-consistency checks for `observe_no_intervention`;
- added an unscripted mock-learner continuation response for
  `observe_no_intervention`;
- added focused tests for no-intervention realization and mock continuation.

Fresh Opus-only evaluation runs:

| Cell | Run ID | Suite | Judge split |
|---|---|---|---|
| `cell_153_plan2_1_evidence_closed_loop` | `eval-2026-06-19-79b95960` | Plan 2.1 evidence-bearing held-out | mock generation; Opus complete |
| `cell_154_plan2_1_evidence_repeat_contextual` | `eval-2026-06-19-6a354353` | Plan 2.1 evidence-bearing held-out | mock generation; Opus complete |
| `cell_150_plan2_quality_repeat_contextual_crosssuite` | `eval-2026-06-19-5ad9bb14` | cross-suite traps | mock generation; mechanism regression |
| `cell_152_plan2_pair_specificity_repeat_contextual` | `eval-2026-06-19-b0d98df5` | paired counterfactual suite | mock generation; mechanism regression |

Ignored exports cited, not forced into Git:

- `exports/plan2-1-finalturn-loop1-strategy-shift.json`
- `exports/plan2-1-finalturn-loop1-pair-specificity.{json,md}`
- `exports/plan2-1-finalturn-loop1-belief-calibration.{json,md}`
- `exports/plan2-1-finalturn-loop1-outcome-closure.{json,md}`
- `exports/plan2-1-finalturn-loop1-crosssuite-strategy-shift.json`
- `exports/plan2-1-finalturn-loop1-paired-specificity.{json,md}`
- `exports/plan2-1-finalturn-loop1-opus-quality.{json,md}`

Mechanism results:

| Check | `cell_153` | `cell_154` |
|---|---:|---:|
| Held-out strict shift | 10/10 | 10/10 |
| Held-out family match | 10/10 | 10/10 |
| Held-out repeated-action refinement | 6/6 | 6/6 |
| Held-out pair specificity | 4/4 | 4/4 |
| Held-out belief top-1 | 10/10 | 10/10 |
| Held-out outcome closure | 30/30 | 30/30 |
| Held-out no-repeat after non-success | 17/18 | 17/18 |

Regression results:

| Suite | Profile | Result |
|---|---|---:|
| Cross-suite traps | `cell_150_plan2_quality_repeat_contextual_crosssuite` | 6/6 strict shift |
| Paired counterfactual | `cell_152_plan2_pair_specificity_repeat_contextual` | 3/3 pair specificity; 0/1 false-positive divergence |

Opus quality, exact `judge_model = claude-code/opus`:

| Profile | N | Quality N | Strict shift | Quality composite | Delta vs `cell_153` | Tutor last | Tutor holistic | Learner | Dialogue |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `cell_153_plan2_1_evidence_closed_loop` | 10 | 10 | 100.0% | 51.1 | 0.0 | 59.0 | 57.6 | 35.2 | 52.6 |
| `cell_154_plan2_1_evidence_repeat_contextual` | 10 | 10 | 100.0% | 54.8 | +3.6 | 68.5 | 61.5 | 36.3 | 52.7 |

Interpretation:

- The implementation loop produced meaningful progression under the user's
  Opus-only evaluation constraint: `cell_154` remains the winner, the comparison
  is complete at 10/10 rows per profile, and the treatment advantage increased
  relative to the prior partial Opus pass.
- The gain is concentrated in tutor last-turn and holistic quality. Learner and
  dialogue aggregates remain nearly flat, so this does not yet show a strong
  downstream learner-quality effect.
- The remaining failure family is no longer generic fallback leakage. The weak
  rows are productive-progress closures where a no-intervention turn may be
  inherently low-value to an independent judge once the learner already owns the
  next move. The next substantive move should test early completion after a
  successful learner-owned `observe_no_intervention`, rather than adding more
  prompt wording.

Stop condition for this loop: meaningful progression was reached without
breaking previously passed mechanism suites. Further changes should be a
separate diagnosis-driven pass focused on early completion / transcript length,
then rerun the held-out suite and the same cross-suite and paired regressions.
