# Tutor instrumentation A/B

- Status: **complete**
- Preset: `ablation`
- Baseline arm: `baseline`
- Calls: 12/16
- Commit: `0b67bdc53dba19e6630e41663ea9816e24301537`

## Arms

Failure clusters are the headline. Pass is all-or-nothing per turn and can read
0/N for every arm at once; the cluster tallies say how far each arm is from clean.

| Arm | Features | Turns | Clusters (hard) | vs baseline | Pass | Safety | Advisory chars | Reply chars | Latency |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Bare tutor _(baseline)_ | none | 3 | 17 (17) | — | 0/3 (0%) | 0 | 0 | 195 | 5782 ms |
| No learner DAG | context_continuity, evidence_window, learner_classifier, human_scaffold, first_draft_contract | 3 | 5 (5) | -12 (-12) | 0/3 (0%) | 0 | 5616 | 476 | 12649 ms |
| No human scaffold | context_continuity, evidence_window, learner_classifier, learner_dag, first_draft_contract | 3 | 7 (7) | -10 (-10) | 0/3 (0%) | 0 | 3938 | 434 | 9972 ms |
| Fully instrumented | context_continuity, evidence_window, learner_classifier, learner_dag, human_scaffold, first_draft_contract | 3 | 5 (5) | -12 (-12) | 0/3 (0%) | 0 | 6205 | 468 | 12691 ms |

## No learner DAG vs baseline

| Failure cluster | Baseline | Arm | Delta |
| --- | ---: | ---: | ---: |
| actorialRealizationAudit:missing_selected_performance_tactic | 3 | 0 | -3 |
| liveTurnProgressionAudit:handoff_loses_turn_focus | 2 | 0 | -2 |
| actorialRealizationAudit:missing_selected_actorial_part | 3 | 2 | -1 |
| dramaticReleaseAudit:missing_in_scene_enactment | 1 | 0 | -1 |
| dramaticReleaseAudit:opaque_clue_release | 1 | 0 | -1 |
| liveSourceActionAlignmentAudit:due_source_exact_occurrence_count | 2 | 1 | -1 |
| liveTurnProgressionAudit:learner_uptake_not_realized | 3 | 2 | -1 |
| responseCompositionAudit:missing_learner_uptake | 1 | 0 | -1 |
| responseCompositionAudit:unlicensed_requested_entry | 1 | 0 | -1 |

## No human scaffold vs baseline

| Failure cluster | Baseline | Arm | Delta |
| --- | ---: | ---: | ---: |
| actorialRealizationAudit:missing_selected_performance_tactic | 3 | 0 | -3 |
| liveSourceActionAlignmentAudit:due_source_exact_occurrence_count | 2 | 0 | -2 |
| actorialRealizationAudit:missing_selected_actorial_part | 3 | 2 | -1 |
| dramaticReleaseAudit:missing_in_scene_enactment | 1 | 0 | -1 |
| liveTurnProgressionAudit:handoff_loses_turn_focus | 2 | 1 | -1 |
| liveTurnProgressionAudit:learner_uptake_not_realized | 3 | 2 | -1 |
| responseCompositionAudit:missing_learner_uptake | 1 | 0 | -1 |
| responseCompositionAudit:unlicensed_requested_entry | 1 | 0 | -1 |
| dramaticReleaseAudit:opaque_clue_release | 1 | 1 | 0 |
| dramaticReleaseAudit:missing_exhibit_action | 0 | 1 | +1 |

## Fully instrumented vs baseline

| Failure cluster | Baseline | Arm | Delta |
| --- | ---: | ---: | ---: |
| actorialRealizationAudit:missing_selected_performance_tactic | 3 | 0 | -3 |
| liveTurnProgressionAudit:handoff_loses_turn_focus | 2 | 0 | -2 |
| actorialRealizationAudit:missing_selected_actorial_part | 3 | 2 | -1 |
| dramaticReleaseAudit:missing_in_scene_enactment | 1 | 0 | -1 |
| dramaticReleaseAudit:opaque_clue_release | 1 | 0 | -1 |
| liveSourceActionAlignmentAudit:due_source_exact_occurrence_count | 2 | 1 | -1 |
| liveTurnProgressionAudit:learner_uptake_not_realized | 3 | 2 | -1 |
| responseCompositionAudit:missing_learner_uptake | 1 | 0 | -1 |
| responseCompositionAudit:unlicensed_requested_entry | 1 | 0 | -1 |

Frozen-replay comparison over a recorded dialogue. Learner utterances, public prefix, world, and evidence state are identical across arms; only the private planner context the speaker receives varies. Every arm is graded by the same pinned guard set. This is a visual and regression instrument, not evidence about human learning.
