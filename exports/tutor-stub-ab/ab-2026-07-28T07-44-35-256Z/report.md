# Tutor instrumentation A/B

- Status: **complete**
- Preset: `default`
- Baseline arm: `baseline`
- Calls: 6/16
- Commit: `0b67bdc53dba19e6630e41663ea9816e24301537`

## Arms

Failure clusters are the headline. Pass is all-or-nothing per turn and can read
0/N for every arm at once; the cluster tallies say how far each arm is from clean.

| Arm | Features | Turns | Clusters (hard) | vs baseline | Pass | Safety | Advisory chars | Reply chars | Latency |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Bare tutor _(baseline)_ | none | 3 | 17 (17) | — | 0/3 (0%) | 0 | 0 | 197 | 5468 ms |
| Fully instrumented | context_continuity, evidence_window, learner_classifier, learner_dag, human_scaffold, first_draft_contract | 3 | 6 (6) | -11 (-11) | 0/3 (0%) | 0 | 6205 | 431 | 7526 ms |

## Fully instrumented vs baseline

| Failure cluster | Baseline | Arm | Delta |
| --- | ---: | ---: | ---: |
| actorialRealizationAudit:missing_selected_performance_tactic | 2 | 0 | -2 |
| dramaticReleaseAudit:opaque_clue_release | 2 | 0 | -2 |
| liveSourceActionAlignmentAudit:due_source_exact_occurrence_count | 2 | 0 | -2 |
| actorialRealizationAudit:missing_selected_actorial_part | 3 | 2 | -1 |
| dramaticReleaseAudit:missing_exhibit_action | 1 | 0 | -1 |
| dramaticReleaseAudit:missing_in_scene_enactment | 1 | 0 | -1 |
| liveTurnProgressionAudit:learner_uptake_not_realized | 3 | 2 | -1 |
| responseCompositionAudit:unlicensed_requested_entry | 1 | 0 | -1 |
| liveTurnProgressionAudit:handoff_loses_turn_focus | 2 | 2 | 0 |

Frozen-replay comparison over a recorded dialogue. Learner utterances, public prefix, world, and evidence state are identical across arms; only the private planner context the speaker receives varies. Every arm is graded by the same pinned guard set. This is a visual and regression instrument, not evidence about human learning.
