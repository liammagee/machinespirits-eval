# A21 Proposed Policy Patch

Generated: 2026-06-16T15:23:38.780Z

## Boundary

- Status: proposed only.
- Runtime policy changes: none.
- Selector defaults changed: false.
- Conduct policy changed: false.
- Fresh paid run authorized: false.
- Next required gate: Phase 9 Hethel replay against hidden+proofDebt.

## Sources

- Analysis: `exports/dramatic-derivation/a21-action-value/action-value-report.json`
- Fixture: `exports/dramatic-derivation/a21-action-value/hethel-trigger-fixture.json`
- Fixture hash: `e4877f7c55a245ef65174a2480d246264552e735fd49fec899a26fd866706e4e`
- Decision category: `release_beats_diagnostic`
- Command: `node scripts/a21-report.js --analysis exports/dramatic-derivation/a21-action-value/action-value-report.json --out exports/dramatic-derivation/a21-action-value/policy-patch-proposal.md`

## Patch Spec

```yaml
policy_patch_id: a21_hethel_release_after_diagnostic_budget
status: proposed_only
promoted: false
runtime_behavior_changed: false
applies_when:
  world_class: "hethel_like_mirror_dead_predicate"
  worldId: "world_006_hethel"
  triggerTurn: 4
  triggerLabel: "release_starvation"
  secondaryLabels: ["diagnostic_overuse"]
  visible_hidden_conflict: true
  diagnostic_budget_exhausted: {"diagnosticHistoryCountAtLeast":2,"repeatedWithoutNewEvidenceAtLeast":1,"actualCount":2,"actualRepeatedWithoutNewEvidence":1}
  proofDebt_live: ["p_point"]
  current_release_target: "p_point"
  release_authorized_now: true
  learner_engagement_not_disengaged: true
  evidence_not_yet_seen: {"p_point":true}
  dependency_not_yet_owned: {"p_point":true}
prefer:
  actionId: "B_RELEASE_P_POINT"
  moveFamily: "release_next_evidence"
  release: ["p_point"]
  tutor_instruction: "Give the learner the next public piece and ask them to use that piece, rather than asking a further diagnostic about the already-discussed record."
  rationale: "In the frozen Hethel trigger fixture, release reduces proof distance and avoids aporia, while the repeated diagnostic is locally compliant but progress-starving."
block:
  - repeated_ask_diagnostic_without_new_evidence
  - consolidate_subproof_if_it_holds_current_authorized_release
  - repair_dependency_if_it_restages_unseen_current_release_instead_of_releasing_it
diagnostic_budget:
  maxVisibleHiddenConflictDiagnosticsBeforeRelease: 2
  noFurtherDiagnosticWhenRepeatedWithoutNewEvidenceAtLeast: 1
  resetOnlyAfterNewPublicEvidenceRelease: true
release_conditions:
  releaseOnlyPublicPremise: "p_point"
  requireCurrentAuthorizedRelease: true
  requireLearnerNotDisengaged: true
  doNotSupplyHiddenRelationOrAnswer: true
  doNotExposeDArithmetic: true
expected_transition:
  "evidenceSeen.p_point": true
  "transitionFlags.learnerCanUsePPoint": true
  "dependencyOwned.p_point": "not_required_same_turn"
  "D": "decrease_by_at_least_1_in_local_fixture"
  "engagement": "remain_engaged_or_strained"
  "releaseTiming": "on_schedule"
kill_if:
  - replay_final_D_gt_0
  - aporia_or_disengagement
  - leak
  - delayed_required_release
```

## Evidence

| comparator | action | reward | mean D delta | delayed release | aporia | notes |
|---|---|---:|---:|---:|---:|---|
| preferred | B_RELEASE_P_POINT | 9 | -1 | 0 | 0 | on-schedule public release |
| failed overlay pattern | A_DIAG_CONFLICT | -5 | 0 | 1 | 1 | repeated diagnostic after budget exhaustion |
| close alternative | C_RESTAGE_P_POINT | 7 |  | 1 |  | owns target but holds current release |
| lower alternative | D_CONSOLIDATE_THEN_RELEASE | 2 |  | 1 |  | release starvation risk |

## Replay Gate

- S0: hidden + proofDebt
- S1: hidden + proofDebt + a21_hethel_release_after_diagnostic_budget

Pass only if:
- S1 matches or beats S0 on final grounding
- S1 final D is 0
- S1 does not fail by aporia or disengagement
- S1 improves the targeted local transition over the failed diagnostic action
- S1 does not leak
- S1 does not delay the required release relative to S0

Stop if:
- replay_final_D_gt_0
- aporia_or_disengagement
- leak
- delayed_required_release

## Known Failure Modes

- released_evidence_not_taken_up_by_learner
- tutor_leaks_hidden_relation_or_answer_while_releasing_public_piece
- patch_fires_when_release_is_not_current_authorized
- patch_masks_a_needed_dependency_repair_in_a_non_hethel_world
- finite_state_simulator_overvalues_release_relative_to_real_dialogue
- hidden_proofDebt_baseline_already_solves_without_incremental_value

## Interpretation

The patch is deliberately narrower than A20 conduct policy: it applies only when a Hethel-like visible/hidden diagnostic loop has exhausted its public budget and the current public release is authorized. It proposes releasing the public `p_point` rather than repeating diagnostics or consolidating while the due release is held.

