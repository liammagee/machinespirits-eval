# Tutor instrumentation A/B

- Status: **complete**
- Preset: `leave_one_in`
- Baseline arm: `baseline`
- Calls: 21/24
- Commit: `c37992c6c32506e3671748932ea9a8df78233837`

## Arms

Failure clusters are the headline. Pass is all-or-nothing per turn and can read
0/N for every arm at once; the cluster tallies say how far each arm is from clean.

| Arm | Features | Turns | Clusters (hard) | vs baseline | Pass | Safety | Advisory chars | Reply chars | Latency |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Bare tutor _(baseline)_ | none | 3 | 19 (19) | — | 0/3 (0%) | 0 | 0 | 220 | 4870 ms |
| Context continuity only | context_continuity | 3 | 19 (19) | 0 (0) | 0/3 (0%) | 0 | 161 | 238 | 4726 ms |
| Evidence window only | evidence_window | 3 | 13 (13) | -6 (-6) | 0/3 (0%) | 0 | 1077 | 247 | 4785 ms |
| Learner classifier only | learner_classifier | 3 | 14 (14) | -5 (-5) | 0/3 (0%) | 0 | 483 | 236 | 4698 ms |
| Learner DAG only | learner_dag | 3 | 13 (13) | -6 (-6) | 0/3 (0%) | 0 | 589 | 216 | 7419 ms |
| Human scaffold only | human_scaffold | 3 | 19 (19) | 0 (0) | 0/3 (0%) | 0 | 2267 | 209 | 6341 ms |
| First-draft contract only | first_draft_contract | 3 | 4 (4) | -15 (-15) | 0/3 (0%) | 0 | 1628 | 483 | 14388 ms |

## Context continuity only vs baseline

| Failure cluster | Baseline | Arm | Delta |
| --- | ---: | ---: | ---: |
| actorialRealizationAudit:missing_selected_performance_tactic | 3 | 2 | -1 |
| dramaticReleaseAudit:missing_return_to_inquiry | 1 | 0 | -1 |
| liveTurnProgressionAudit:required_handoff_question_missing | 1 | 0 | -1 |
| dramaticReleaseAudit:missing_exhibit_action | 1 | 1 | 0 |
| dramaticReleaseAudit:missing_in_scene_enactment | 1 | 1 | 0 |
| dramaticReleaseAudit:opaque_clue_release | 2 | 2 | 0 |
| liveSourceActionAlignmentAudit:due_source_exact_occurrence_count | 2 | 2 | 0 |
| liveTurnProgressionAudit:learner_uptake_not_realized | 3 | 3 | 0 |
| responseCompositionAudit:unlicensed_requested_entry | 1 | 1 | 0 |
| actorialRealizationAudit:missing_selected_actorial_part | 2 | 3 | +1 |
| liveTurnProgressionAudit:handoff_loses_turn_focus | 2 | 3 | +1 |
| liveTurnProgressionAudit:question_forbidden_by_handoff_contract | 0 | 1 | +1 |

## Evidence window only vs baseline

| Failure cluster | Baseline | Arm | Delta |
| --- | ---: | ---: | ---: |
| liveTurnProgressionAudit:handoff_loses_turn_focus | 2 | 0 | -2 |
| actorialRealizationAudit:missing_selected_performance_tactic | 3 | 2 | -1 |
| dramaticReleaseAudit:missing_exhibit_action | 1 | 0 | -1 |
| dramaticReleaseAudit:missing_return_to_inquiry | 1 | 0 | -1 |
| dramaticReleaseAudit:opaque_clue_release | 2 | 1 | -1 |
| liveTurnProgressionAudit:required_handoff_question_missing | 1 | 0 | -1 |
| dramaticReleaseAudit:missing_in_scene_enactment | 1 | 1 | 0 |
| liveSourceActionAlignmentAudit:due_source_exact_occurrence_count | 2 | 2 | 0 |
| liveTurnProgressionAudit:learner_uptake_not_realized | 3 | 3 | 0 |
| responseCompositionAudit:unlicensed_requested_entry | 1 | 1 | 0 |
| actorialRealizationAudit:missing_selected_actorial_part | 2 | 3 | +1 |

## Learner classifier only vs baseline

| Failure cluster | Baseline | Arm | Delta |
| --- | ---: | ---: | ---: |
| actorialRealizationAudit:missing_selected_performance_tactic | 3 | 2 | -1 |
| dramaticReleaseAudit:missing_return_to_inquiry | 1 | 0 | -1 |
| dramaticReleaseAudit:opaque_clue_release | 2 | 1 | -1 |
| liveTurnProgressionAudit:handoff_loses_turn_focus | 2 | 1 | -1 |
| liveTurnProgressionAudit:required_handoff_question_missing | 1 | 0 | -1 |
| actorialRealizationAudit:missing_selected_actorial_part | 2 | 2 | 0 |
| dramaticReleaseAudit:missing_exhibit_action | 1 | 1 | 0 |
| dramaticReleaseAudit:missing_in_scene_enactment | 1 | 1 | 0 |
| liveSourceActionAlignmentAudit:due_source_exact_occurrence_count | 2 | 2 | 0 |
| liveTurnProgressionAudit:learner_uptake_not_realized | 3 | 3 | 0 |
| responseCompositionAudit:unlicensed_requested_entry | 1 | 1 | 0 |

## Learner DAG only vs baseline

| Failure cluster | Baseline | Arm | Delta |
| --- | ---: | ---: | ---: |
| actorialRealizationAudit:missing_selected_performance_tactic | 3 | 2 | -1 |
| dramaticReleaseAudit:missing_in_scene_enactment | 1 | 0 | -1 |
| dramaticReleaseAudit:missing_return_to_inquiry | 1 | 0 | -1 |
| dramaticReleaseAudit:opaque_clue_release | 2 | 1 | -1 |
| liveTurnProgressionAudit:handoff_loses_turn_focus | 2 | 1 | -1 |
| liveTurnProgressionAudit:required_handoff_question_missing | 1 | 0 | -1 |
| actorialRealizationAudit:missing_selected_actorial_part | 2 | 2 | 0 |
| dramaticReleaseAudit:missing_exhibit_action | 1 | 1 | 0 |
| liveSourceActionAlignmentAudit:due_source_exact_occurrence_count | 2 | 2 | 0 |
| liveTurnProgressionAudit:learner_uptake_not_realized | 3 | 3 | 0 |
| responseCompositionAudit:unlicensed_requested_entry | 1 | 1 | 0 |

## Human scaffold only vs baseline

| Failure cluster | Baseline | Arm | Delta |
| --- | ---: | ---: | ---: |
| actorialRealizationAudit:missing_selected_performance_tactic | 3 | 2 | -1 |
| dramaticReleaseAudit:missing_exhibit_action | 1 | 0 | -1 |
| dramaticReleaseAudit:opaque_clue_release | 2 | 1 | -1 |
| actorialRealizationAudit:missing_selected_actorial_part | 2 | 2 | 0 |
| dramaticReleaseAudit:missing_in_scene_enactment | 1 | 1 | 0 |
| liveSourceActionAlignmentAudit:due_source_exact_occurrence_count | 2 | 2 | 0 |
| liveTurnProgressionAudit:learner_uptake_not_realized | 3 | 3 | 0 |
| responseCompositionAudit:unlicensed_requested_entry | 1 | 1 | 0 |
| dramaticReleaseAudit:missing_return_to_inquiry | 1 | 2 | +1 |
| liveTurnProgressionAudit:handoff_loses_turn_focus | 2 | 3 | +1 |
| liveTurnProgressionAudit:required_handoff_question_missing | 1 | 2 | +1 |

## First-draft contract only vs baseline

| Failure cluster | Baseline | Arm | Delta |
| --- | ---: | ---: | ---: |
| actorialRealizationAudit:missing_selected_performance_tactic | 3 | 0 | -3 |
| dramaticReleaseAudit:opaque_clue_release | 2 | 0 | -2 |
| liveTurnProgressionAudit:handoff_loses_turn_focus | 2 | 0 | -2 |
| actorialRealizationAudit:missing_selected_actorial_part | 2 | 1 | -1 |
| dramaticReleaseAudit:missing_exhibit_action | 1 | 0 | -1 |
| dramaticReleaseAudit:missing_in_scene_enactment | 1 | 0 | -1 |
| dramaticReleaseAudit:missing_return_to_inquiry | 1 | 0 | -1 |
| liveSourceActionAlignmentAudit:due_source_exact_occurrence_count | 2 | 1 | -1 |
| liveTurnProgressionAudit:learner_uptake_not_realized | 3 | 2 | -1 |
| liveTurnProgressionAudit:required_handoff_question_missing | 1 | 0 | -1 |
| responseCompositionAudit:unlicensed_requested_entry | 1 | 0 | -1 |

Frozen-replay comparison over a recorded dialogue. Learner utterances, public prefix, world, and evidence state are identical across arms; only the private planner context the speaker receives varies. Every arm is graded by the same pinned guard set. This is a visual and regression instrument, not evidence about human learning.
