# TODO: Adaptive recognition and Psyche-v2 exploration

Generated: 2026-04-30  
Scope: Smaller, high-signal adaptive tutor experiments using explicit state, policy selection, and tutor-side psyche deliberation.

## Phase 0: Guardrails

- [ ] Confirm this exploration remains separate from existing paper reproduction logic.
- [ ] Create or confirm branch name, e.g. `adaptive-psyche-probe`.
- [ ] Add a note in project board that A13/A14 supersede further large ablation-extension work for now.
- [ ] Define hard cost ceiling before any frontier-model execution.
- [ ] Require human inspection packet before making paper claims.

## Phase 1: Core adaptive state and policy

- [ ] Create `services/adaptiveTutor/`.
- [ ] Add `stateSchema.js`.
- [ ] Add `stateUpdater.js`.
- [ ] Add `validators.js`.
- [ ] Add `policySelector.js`.
- [ ] Add tests for state update after resistance, affective shutdown, false mastery, and sophistication upgrade.
- [ ] Create `config/adaptive-policy-actions.yaml`.
- [ ] Validate policy actions against taxonomy.
- [ ] Ensure policy selector cannot return free-form actions.

## Phase 2: Adaptive trap scenarios

- [ ] Create `config/adaptive-trap-scenarios.yaml`.
- [ ] Add `false_confusion` scenario.
- [ ] Add `polite_false_mastery` scenario.
- [ ] Add `resistance_to_insight` scenario.
- [ ] Add `answer_seeking_to_productive_struggle` scenario.
- [ ] Add `metaphor_boundary_case` scenario.
- [ ] Add `affective_shutdown` scenario.
- [ ] Add `repair_after_misrecognition` scenario.
- [ ] Add `sophistication_upgrade` scenario.
- [ ] Ensure every scenario has `hidden_learner_state`, `trigger_turn`, `expected_state_update`, `expected_strategy_shift`, `failure_mode`, and `success_criteria`.
- [ ] Add scenario validation script.

## Phase 3: Dry-run infrastructure

- [ ] Add `services/adaptiveTutor/adaptiveTutorRunner.js`.
- [ ] Add `scripts/run-adaptive-dry.js`.
- [ ] Produce dry-run JSON traces under `exports/adaptive-dry/`.
- [ ] Add tests for output schema.
- [ ] Run dry-run on two scenarios.
- [ ] Confirm no external LLM calls occur in dry-run mode.

## Phase 4: Psyche-v2 deliberation

- [ ] Create `services/adaptiveTutor/psyche/`.
- [ ] Add `psyche/schemas.js`.
- [ ] Add `psyche/realityAgent.js`.
- [ ] Add `psyche/idAgent.js`.
- [ ] Add `psyche/superegoAgent.js`.
- [ ] Add `psyche/otherEgoAgent.js`.
- [ ] Add `psyche/egoMediator.js`.
- [ ] Add `psyche/responseGenerator.js`.
- [ ] Add `psyche/workingThroughMemory.js`.
- [ ] Add `psyche/runPsycheDeliberation.js`.
- [ ] Ensure id proposes candidate moves but never final response.
- [ ] Ensure superego critiques policy/norms before prose.
- [ ] Ensure other-ego predicts learner reception.
- [ ] Ensure ego mediator chooses valid action from taxonomy.
- [ ] Ensure ego may accept, partially accept, or reject superego feedback with justification.
- [ ] Ensure final response cannot leak internal labels or JSON.
- [ ] Add tests for id diversity.
- [ ] Add tests for superego evidence requirement.
- [ ] Add tests for valid ego action selection.
- [ ] Add tests for final-response non-leakage.
- [ ] Add tests for deliberation trace validation.

## Phase 5: Analysis scripts

- [ ] Add `scripts/analyze-adaptive-traps.js`.
- [ ] Compute `trigger_detection`.
- [ ] Compute `state_update_accuracy`.
- [ ] Compute `strategy_shift_correctness`.
- [ ] Compute `counterfactual_divergence`.
- [ ] Compute `uptake_score`.
- [ ] Compute `repair_success`.
- [ ] Compute `delayed_task_success`.
- [ ] Output `exports/adaptive-trap-results.md`.
- [ ] Output `exports/adaptive-trap-results.csv`.
- [ ] Add `scripts/analyze-psyche-deliberation.js`.
- [ ] Compute `deliberation_to_output_coupling`.
- [ ] Compute `id_candidate_diversity`.
- [ ] Compute `superego_grounding_rate`.
- [ ] Compute `ego_rejection_rate_of_weak_critique`.
- [ ] Compute `other_ego_prediction_accuracy`.
- [ ] Compute `internal_leakage_rate`.
- [ ] Output `exports/psyche-v2-results.md`.
- [ ] Output `exports/psyche-v2-results.csv`.

## Phase 6: Human inspection and paper delta

- [ ] Add `scripts/export-adaptive-human-packet.js`.
- [ ] Include hidden learner state and expected strategy shift in packet.
- [ ] Include selected action, state delta, final response, and judge scores.
- [ ] Add blank coding fields for human review.
- [ ] Add `scripts/generate-adaptive-paper-delta.js`.
- [ ] Produce claim-status table: supported / suggestive / exploratory / null / contradicted.
- [ ] Explicitly distinguish tutor-output quality from human learning outcomes.

## Phase 7: Claude Code workflow

- [ ] Add `.claude/commands/adaptive-plan.md`.
- [ ] Add `.claude/commands/adaptive-implement.md`.
- [ ] Add `.claude/commands/adaptive-eval-review.md`.
- [ ] Add `.claude/commands/adaptive-paper-delta.md`.
- [ ] Add `adaptive-architect` subagent.
- [ ] Add `eval-minimalist` subagent.
- [ ] Add `claim-superego` subagent.
- [ ] Add optional `.claude/hooks/adaptive-guard.sh`.
- [ ] Ensure hook does not block intentional paper edits unless adaptive mode is active.

## Phase 8: A13 small eval

- [ ] Pre-register A13 question.
- [ ] Lock A13 conditions: recognition-only, current ego/superego, adaptive-state policy, adaptive-state policy + validator.
- [ ] Lock scenarios and expected shifts.
- [ ] Confirm model aliases for GPT 5.5 and Claude 4.7-class generators/judges.
- [ ] Set max dialogues and max cost.
- [ ] Run a 4-dialogue smoke test.
- [ ] Review traces manually before full A13.
- [ ] Run full A13 only if smoke test passes.
- [ ] Generate adaptive-trap results.
- [ ] Generate human inspection packet.
- [ ] Review at least 24 sampled dialogues before claim updates.

## Phase 9: A14 Psyche-v2 small eval

- [ ] Pre-register A14 question.
- [ ] Lock A14 conditions: recognition-only, current ego/superego, strategy-level superego + mediator, full Psyche-v2.
- [ ] Lock primary endpoint: strategy_shift_correctness.
- [ ] Lock secondary endpoints: deliberation_to_output_coupling, id diversity, superego grounding, other-ego prediction, ego rejection, leakage.
- [ ] Run a 4-dialogue smoke test.
- [ ] Inspect for internal leakage and meta-narration.
- [ ] Run full A14 only if smoke test passes.
- [ ] Generate psyche-v2 results.
- [ ] Generate human inspection packet.
- [ ] Review at least 24 sampled dialogues before claim updates.

## Phase 10: Stop conditions

- [ ] Stop if internal leakage exceeds 5% in smoke test.
- [ ] Stop if state updates do not affect policy selection in dry-run.
- [ ] Stop if strategy_shift_correctness cannot be scored reliably.
- [ ] Stop if frontier-model costs exceed budget estimate.
- [ ] Stop if human inspection shows mostly rhetorical reframing rather than genuine strategy change.
- [ ] Do not add more cells until A13/A14 produce diagnostic results.

## Claim discipline

- [ ] Do not claim adaptive responsiveness from warmth, question-asking, or higher holistic quality alone.
- [ ] Require visible chain: learner signal -> state update -> policy change -> output coupling.
- [ ] Treat all synthetic learner results as mechanism probes, not human learning evidence.
- [ ] Keep id-director / full prompt-rewrite variants exploratory until Psyche-v2 trace coupling is demonstrated.
- [ ] Preserve the Paper 2.0 claim that recognition calibration and superego error correction are supported, while adaptive responsiveness remains unresolved/null under current architecture.

---

## Resource planning

- [ ] Review `03-resource-list.md` before starting A13/A14 implementation.
- [ ] Choose one orchestration approach for the first prototype: plain Node services, LangGraph-style graph, or OpenAI Agents SDK style manager/tools.
- [ ] Check current GPT-5.5 / Claude Opus 4.7 availability and pricing immediately before any frontier-model run.
- [ ] Revisit the POMDP/dialogue-management resources before finalizing hidden learner-state scenarios.


## Related planning resources

- [03-resource-list.md](03-resource-list.md) — curated resources for adaptive recognition, Psyche-v2, agent orchestration, tutoring evals, and Codex/Claude Code workflows.
