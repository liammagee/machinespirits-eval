import {
  ADAPTATION_ACTIONS,
  estimateLearnerStateBelief,
  selectPedagogicalAction,
} from './adaptiveTutor/actionPolicy.js';
import { createAdaptationContract } from './adaptiveTutor/adaptationContract.js';
import { appendPendingIntervention, closePendingIntervention } from './adaptiveTutor/interventionLedger.js';
import {
  buildTutorStubTypedActionDecision,
  tutorStubMoveFamilyForAction,
} from './adaptiveTutor/tutorStubActionAdapter.js';
import { advanceScaffoldLifecycle, allowedMoveFamiliesForScaffoldPhase } from './adaptiveTutor/scaffoldLifecycle.js';
import { buildTutorStubDialogueClosureFrame } from './tutorStubDialogueClosure.js';
import { DEFAULT_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE } from './tutorStubRegisterTemperature.js';
import { tutorStubComprehensionFeatures } from './tutorStubComprehensionState.js';
import {
  buildTutorStubResponseConfiguration,
  selectTutorStubActorialPart,
  selectTutorStubActorialPerformance,
} from './tutorStubResponseConfiguration.js';
import { getEngagementStanceDefinition } from './engagementRegisterRegistry.js';
import { sampleTutorStubPolicyDistribution } from './tutorStubPolicySampler.js';

const TUTOR_TYPED_ACTION_OUTCOME_SCHEMA = 'machinespirits.tutor-stub.typed-action-outcome.v1';

export function createTutorStubTypedActionPlanningRuntime({
  C,
  answerTermForWorld,
  appendTraceEvent,
  buildTutorDagSnapshot,
  currentReleaseRows,
  explicitPerformanceActorialPartSelection,
  explicitPerformanceDirectiveValue,
  jsonClone,
  policySamplingContext,
  randomPerformanceActorialPartSelection,
  registerTemperatureApplies,
  stateRunDebugId,
  writeLine = console.log,
}) {
  function tutorDialogueClosureFrameForTurn({ state, tutorTurn, tutorLearnerDag }) {
    const tutorDagSnapshot = buildTutorDagSnapshot(state, tutorTurn);
    return {
      tutorDagSnapshot,
      frame: buildTutorStubDialogueClosureFrame({
        lifecycle: state.dialogueClosure,
        learnerDagModel: tutorLearnerDag?.model || tutorLearnerDag || null,
        tutorDagSnapshot,
        answerTerm: answerTermForWorld(state.world),
      }),
    };
  }

  function typedActionStateBelief({ state, learnerText, stateObservation, turn }) {
    const dialogue = state.turns.flatMap((row) => [
      { role: 'learner', content: row.learner || '' },
      { role: 'tutor', content: row.tutor || '' },
    ]);
    dialogue.push({ role: 'learner', content: learnerText });
    const belief = estimateLearnerStateBelief({
      dialogue,
      interventionLedger: state.typedActions.ledger,
      turnIndex: turn,
    });
    belief.axes = {
      ...belief.axes,
      proof: stateObservation.axes.proof,
      release: stateObservation.axes.release,
      ownership: stateObservation.axes.ownership,
      conceptual_mastery: stateObservation.axes.conceptual_mastery,
      metacognitive_accuracy: stateObservation.axes.metacognitive_accuracy,
      affective_readiness: stateObservation.axes.affective_readiness,
    };
    return belief;
  }

  function advanceRuntimeScaffoldLifecycle(state, event) {
    if (!state.typedActions?.enabled) return null;
    const result = advanceScaffoldLifecycle(state.typedActions.scaffoldLifecycle, event);
    state.typedActions.scaffoldLifecycle = result.lifecycle;
    appendTraceEvent(state.trace, {
      type: 'tutor_scaffold_lifecycle_transition',
      turn: event.turn,
      transition: result.transition,
      lifecycle: result.lifecycle,
    });
    return result;
  }

  function scaffoldLifecycleActionGate(lifecycle) {
    const phase = lifecycle?.phase || 'diagnose';
    const allowedMoveFamilies = allowedMoveFamiliesForScaffoldPhase(phase);
    const allowedActionTypes = ADAPTATION_ACTIONS.filter((action) =>
      allowedMoveFamilies.includes(tutorStubMoveFamilyForAction(action.action_type)),
    ).map((action) => action.action_type);
    if (!allowedActionTypes.length) {
      throw new Error(`typed scaffold lifecycle phase ${phase} has no permitted pedagogical actions`);
    }
    return {
      phase,
      allowedMoveFamilies,
      allowedActionTypes,
      policySpec: {
        id: `tutor-stub-scaffold-lifecycle-${phase}`,
        version: '1.0',
        module_id: `scaffold_lifecycle:${phase}`,
        spec_hash: `scaffold-lifecycle.v1:${phase}:${allowedActionTypes.join(',')}`,
        action_policy: {
          allowed_action_families: allowedActionTypes,
          preferred_action_families: allowedActionTypes,
          disallowed_action_families: ADAPTATION_ACTIONS.map((action) => action.action_type).filter(
            (actionType) => !allowedActionTypes.includes(actionType),
          ),
        },
      },
    };
  }

  function closePriorTypedAction({ state, learnerText, turn }) {
    if (!state.typedActions?.enabled) return null;
    const result = closePendingIntervention({
      ledger: state.typedActions.ledger,
      learnerTurn: learnerText,
      turnIndex: turn,
      config: { semanticOutcomeObserver: true },
    });
    state.typedActions.ledger = result.ledger;
    if (!result.closedRecord) return null;
    const envelope = {
      schema: TUTOR_TYPED_ACTION_OUTCOME_SCHEMA,
      contract_id: result.closedRecord.contract_id,
      decision_turn: result.closedRecord.turn_index,
      observation_turn: turn,
      public_learner_observation: learnerText,
      outcome: result.closedRecord.outcome,
      observed_transition: result.closedRecord.observed_transition,
      evidence: result.closedRecord.evidence,
      evidence_contract: result.closedRecord.evidence_contract || null,
      policy_update: result.closedRecord.policy_update || null,
      closed_record: result.closedRecord,
    };
    const lifecycle = advanceRuntimeScaffoldLifecycle(state, {
      kind: 'closed_public_outcome',
      turn,
      outcome: envelope,
    });
    envelope.scaffold_lifecycle_transition = lifecycle?.transition || null;
    envelope.scaffold_lifecycle = lifecycle?.lifecycle || null;
    const priorTurn = [...state.turns]
      .reverse()
      .find((row) => Number(row.turn) === Number(result.closedRecord.turn_index));
    if (priorTurn?.typedActionDecision) priorTurn.typedActionOutcomeAfterNextLearner = jsonClone(envelope);
    appendTraceEvent(state.trace, {
      type: 'tutor_typed_action_outcome_closed',
      turn,
      decisionTurn: result.closedRecord.turn_index,
      outcome: envelope,
    });
    return envelope;
  }

  function typedActionRegisterSelection({
    state,
    learnerText,
    classification,
    tutorLearnerDag,
    registerSelection,
    decision,
  }) {
    const register =
      registerSelection?.engagement_stance ||
      registerSelection?.selected_register ||
      decision.register_selection.engagement_stance ||
      'precise';
    const baseConfiguration =
      registerSelection?.response_configuration ||
      buildTutorStubResponseConfiguration({
        engagementStance: register,
        legacySelectedRegister: register,
        temperature: state.register?.temperature ?? DEFAULT_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE,
        policy: state.register?.policy || 'typed_action',
        learnerText,
        classification,
        tutorLearnerDag,
        comprehension: tutorStubComprehensionFeatures(state.comprehension, { turn: state.turns.length + 1 }),
        world: state.world,
      });
    const patch = decision.response_configuration_patch;
    const actorialInputs = {
      engagementStance: register,
      stanceDistribution:
        baseConfiguration.engagement_stance_distribution || registerSelection?.engagement_stance_distribution || null,
      actionFamily: patch.action_family,
      temperature: state.register?.temperature ?? DEFAULT_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE,
      classification,
      tutorLearnerDag,
      comprehension: tutorStubComprehensionFeatures(state.comprehension, { turn: state.turns.length + 1 }),
      world: state.world,
      dueEvidence: currentReleaseRows(state, state.turns.length + 1),
      recentActorialParts: (state.register?.history || [])
        .filter((entry) => Number(entry.turn) < state.turns.length + 1)
        .map((entry) => entry.actorial_part || entry.response_configuration?.actorial_part)
        .filter(Boolean),
    };
    let actorialPart = selectTutorStubActorialPart(actorialInputs);
    const explicitRegister = explicitPerformanceDirectiveValue(state, 'register');
    const explicitCharacter = explicitPerformanceDirectiveValue(state, 'character');
    const lightAdaptation = registerSelection?.light_adaptation || baseConfiguration.light_adaptation || null;
    const lightAdaptationTriggered = lightAdaptation?.triggered === true;
    const randomStanceEnabled =
      state.randomPerformance?.enabled === true && !explicitRegister && !lightAdaptationTriggered;
    const randomCharacterEnabled =
      state.randomPerformance?.enabled === true && !explicitCharacter && !lightAdaptationTriggered;
    if (lightAdaptationTriggered) {
      actorialPart = randomPerformanceActorialPartSelection({
        state,
        inputs: actorialInputs,
        baseSelection: actorialPart,
        lightAdaptation,
      });
    } else if (explicitCharacter) {
      actorialPart = explicitPerformanceActorialPartSelection({
        inputs: actorialInputs,
        baseSelection: actorialPart,
        character: explicitCharacter,
      });
    } else if (randomCharacterEnabled) {
      actorialPart = randomPerformanceActorialPartSelection({
        state,
        inputs: actorialInputs,
        baseSelection: actorialPart,
      });
    } else if (
      registerTemperatureApplies(state.register?.policy) &&
      actorialPart.distribution.length &&
      actorialPart.locked !== true
    ) {
      const sampledPart = sampleTutorStubPolicyDistribution(
        actorialPart.distribution.map((row) => ({
          register: row.part,
          weight: row.weight,
          probability: row.probability,
        })),
        policySamplingContext(state, 'typed_action_actorial_part'),
      );
      actorialPart = selectTutorStubActorialPart({
        ...actorialInputs,
        selectedPartOverride: sampledPart.entry?.register || actorialPart.id,
      });
      actorialPart.random = sampledPart.audit;
    }
    const responseConfiguration = {
      ...jsonClone(baseConfiguration),
      action_family: patch.action_family,
      actorial_part: actorialPart.id,
      actorial_part_label: actorialPart.label,
      actorial_part_selection: actorialPart,
      actorial_performance: selectTutorStubActorialPerformance({
        engagementStance: register,
        actorialPart: actorialPart.id,
      }),
      support_level: patch.support_level,
      task_id: patch.task_id,
      knowledge_component: patch.knowledge_component,
      item_difficulty: patch.item_difficulty,
      typed_action_schema: decision.schema,
      light_adaptation: lightAdaptation
        ? {
            ...lightAdaptation,
            engagement_stance_random: lightAdaptationTriggered ? registerSelection?.random || null : null,
            actorial_part_random: lightAdaptationTriggered ? actorialPart.random || null : null,
            applied: lightAdaptationTriggered,
            applied_axes: lightAdaptationTriggered
              ? ['engagement_stance', actorialPart.locked === true ? null : 'actorial_part'].filter(Boolean)
              : [],
          }
        : null,
      random_performance: state.randomPerformance?.enabled
        ? {
            schema: 'machinespirits.tutor-stub.random-performance-selection.v1',
            enabled: randomStanceEnabled || randomCharacterEnabled,
            configured: true,
            active_axes: [
              randomStanceEnabled ? 'engagement_stance' : null,
              randomCharacterEnabled ? 'actorial_part' : null,
            ].filter(Boolean),
            explicitly_directed_axes: [
              explicitRegister ? 'engagement_stance' : null,
              explicitCharacter ? 'actorial_part' : null,
            ].filter(Boolean),
            assessment_influence: {
              engagement_stance: false,
              actorial_part: false,
              other_axes: true,
            },
            stance_random: randomStanceEnabled ? registerSelection?.random || null : null,
            actorial_part_random: randomCharacterEnabled ? actorialPart.random || null : null,
            hard_constraints_preserved: ['dialogue_closure', 'evidence_release', 'response_safety'],
          }
        : baseConfiguration.random_performance || null,
      performance_directives:
        explicitRegister || explicitCharacter
          ? {
              schema: 'machinespirits.tutor-stub.explicit-performance-directives.v1',
              precedence: 'light_adaptation_then_explicit_axis_then_random_axis_then_adaptive_policy',
              register: explicitRegister
                ? {
                    value: explicitRegister,
                    applied: !lightAdaptationTriggered,
                    outcome: lightAdaptationTriggered ? 'overridden_by_light_adaptation' : 'applied',
                    assessment_influence: false,
                  }
                : null,
              character: explicitCharacter
                ? {
                    value: explicitCharacter,
                    applied: !lightAdaptationTriggered && actorialPart.explicit_directive?.applied !== false,
                    outcome: lightAdaptationTriggered
                      ? 'overridden_by_light_adaptation'
                      : actorialPart.explicit_directive?.outcome || 'applied',
                    assessment_influence: false,
                  }
                : null,
              hard_constraints_preserved: [
                'dialogue_closure',
                'authored_evidence_source',
                'evidence_release',
                'response_safety',
              ],
            }
          : baseConfiguration.performance_directives || null,
      selection_reasons: {
        ...(baseConfiguration.selection_reasons || {}),
        action_family: `Selected by the opt-in typed pedagogical-action policy as ${decision.chosen_action.action_type}.`,
        actorial_part: actorialPart.reason,
        support_level: 'Selected independently from move family, engagement stance, and task.',
        task: 'Supplied by the explicit typed-action task configuration.',
      },
    };
    const definition = getEngagementStanceDefinition(register) || {};
    const effective = {
      ...(registerSelection ? jsonClone(registerSelection) : {}),
      schema: registerSelection?.schema || 'machinespirits.tutor-stub.response-configuration-selection.v5',
      policy: registerSelection?.policy || state.register?.policy || 'typed_action',
      turn: registerSelection?.turn || state.turns.length + 1,
      engagement_stance: register,
      selected_register: register,
      selected_mode: register,
      legacy_selected_register: registerSelection?.legacy_selected_register || register,
      action_family: patch.action_family,
      support_level: patch.support_level,
      task_id: patch.task_id,
      knowledge_component: patch.knowledge_component,
      item_difficulty: patch.item_difficulty,
      addressee_profile: responseConfiguration.addressee_profile,
      audience_register: responseConfiguration.audience_register,
      register_pragmatics: responseConfiguration.register_pragmatics,
      lexical_accessibility: responseConfiguration.lexical_accessibility,
      scene_immersion: responseConfiguration.scene_immersion,
      actorial_part: responseConfiguration.actorial_part,
      actorial_part_label: responseConfiguration.actorial_part_label,
      actorial_part_selection: responseConfiguration.actorial_part_selection,
      actorial_performance: responseConfiguration.actorial_performance,
      unresolved_terms: responseConfiguration.unresolved_terms,
      light_adaptation: responseConfiguration.light_adaptation,
      performance_directives: responseConfiguration.performance_directives,
      valence: registerSelection?.valence || definition.valence || null,
      request_type:
        registerSelection?.request_type ||
        classification?.turn?.request_type ||
        classification?.turn?.discourse_move ||
        'unknown',
      reviewer_signal:
        registerSelection?.reviewer_signal || classification?.turn?.pedagogical_need || 'typed pedagogical action',
      register_reason: registerSelection?.register_reason || 'Default precise stance for the typed-action runtime.',
      response_configuration: responseConfiguration,
      typed_action_decision: decision,
      source: registerSelection?.source || 'typed_action_runtime',
    };
    if (state.register?.enabled) {
      if (state.register.history.length && state.register.history.at(-1)?.turn === effective.turn) {
        state.register.history[state.register.history.length - 1] = effective;
      } else {
        state.register.history.push(effective);
      }
      state.register.current = effective;
    }
    return effective;
  }

  function planTypedAction({
    state,
    learnerText,
    stateObservation,
    turn,
    classification,
    tutorLearnerDag,
    registerSelection,
  }) {
    if (!state.typedActions?.enabled) {
      return { registerSelection, decision: null, priorOutcome: null };
    }
    const priorOutcome = closePriorTypedAction({ state, learnerText, turn });
    const stateBelief = typedActionStateBelief({ state, learnerText, stateObservation, turn });
    const lifecycleBeforeDecision = jsonClone(state.typedActions.scaffoldLifecycle);
    const lifecycleGate = scaffoldLifecycleActionGate(lifecycleBeforeDecision);
    const selection = selectPedagogicalAction({
      stateBelief,
      interventionLedger: state.typedActions.ledger,
      mode: 'closed_loop',
      config: {
        maxActionCandidates: ADAPTATION_ACTIONS.length,
        worldAdaptationSpec: lifecycleGate.policySpec,
      },
    });
    const considered = new Set(selection.candidateActions.map((candidate) => candidate.action_type));
    const vetoes = ADAPTATION_ACTIONS.filter((action) => !considered.has(action.action_type)).map((action) => {
      const moveFamily = tutorStubMoveFamilyForAction(action.action_type);
      const lifecycleVeto = !lifecycleGate.allowedMoveFamilies.includes(moveFamily);
      return {
        action_type: action.action_type,
        move_family: moveFamily,
        stage: lifecycleVeto ? 'scaffold_lifecycle_gate' : 'state_conditioned_candidate_generation',
        disposition: lifecycleVeto ? 'vetoed' : 'not_considered',
        reason: lifecycleVeto
          ? `Move family ${moveFamily} is not permitted during scaffold phase ${lifecycleGate.phase}.`
          : 'The current public learner-state hypotheses did not place this action in the policy candidate set.',
      };
    });
    const register = registerSelection?.engagement_stance || registerSelection?.selected_register || 'precise';
    let decision = buildTutorStubTypedActionDecision({
      selection,
      stateBelief,
      task: state.typedActions.config.task,
      register,
      supportLevel: state.typedActions.config.supportLevel,
      selectionProbability: 1,
      vetoes,
      modelVersion: 'programmatic/adaptive-action-policy',
    });
    const contractId = `${stateRunDebugId(state)}-typed-action-t${turn}`;
    const contract = createAdaptationContract({
      contractId,
      dialogueId: stateRunDebugId(state),
      turnIndex: turn,
      stateBelief,
      selectedAction: decision.chosen_action,
      candidateActions: selection.candidateActions,
      gateResult: { allowed: true, violations: [], repairs: [] },
      policyMode: 'closed_loop',
      worldAdaptationSpec: selection.worldAdaptationSpec,
    });
    decision = jsonClone({
      ...decision,
      contract_id: contractId,
      decision_provenance: {
        timing: 'after_current_public_learner_observation_before_tutor_output',
        public_observation_schema: stateObservation.schema,
        public_only: true,
        selection_method: 'deterministic_closed_loop_argmax',
        propensity: {
          selected_action_probability: 1,
          method: 'deterministic_policy',
        },
        candidate_universe: ADAPTATION_ACTIONS.map((action) => action.action_type),
        considered_candidates: selection.candidateActions.map((candidate) => candidate.action_type),
        vetoed_or_not_considered: vetoes.map((row) => row.action_type),
        task_axis_source: 'explicit_typed_action_config',
        register_axis_source: registerSelection
          ? 'existing_tutor_stub_register_policy'
          : 'typed_action_precise_fallback',
        support_axis_source:
          state.typedActions.config.supportLevel === null ? 'action_default' : 'explicit_typed_action_config',
        scaffold_lifecycle_gate: {
          phase: lifecycleGate.phase,
          allowed_move_families: lifecycleGate.allowedMoveFamilies,
          allowed_action_types: lifecycleGate.allowedActionTypes,
          policy_spec: lifecycleGate.policySpec,
        },
      },
      adaptation_contract: contract,
    });
    const lifecycleDecision = advanceRuntimeScaffoldLifecycle(state, {
      kind: 'typed_action_decision',
      turn,
      decision,
    });
    decision = jsonClone({
      ...decision,
      scaffold_lifecycle: {
        before: lifecycleBeforeDecision,
        transition: lifecycleDecision.transition,
        after: lifecycleDecision.lifecycle,
      },
    });
    const pending = appendPendingIntervention(state.typedActions.ledger, contract);
    state.typedActions.ledger = pending.ledger;
    state.typedActions.currentDecision = decision;
    const effectiveRegisterSelection = typedActionRegisterSelection({
      state,
      learnerText,
      classification,
      tutorLearnerDag,
      registerSelection,
      decision,
    });
    appendTraceEvent(state.trace, {
      type: 'tutor_typed_action_decision',
      turn,
      phase: 'before_tutor_output',
      stateObservation,
      decision,
      pendingIntervention: pending.pendingIntervention,
    });
    writeLine(
      `${C.cyan}typed action >${C.reset} ${decision.chosen_action.action_type}; move ${
        decision.chosen_action.move_family
      }; support ${decision.chosen_action.support_level}; task ${decision.chosen_action.task_id}; stance ${register}`,
    );
    return { registerSelection: effectiveRegisterSelection, decision, priorOutcome };
  }

  return {
    closePriorTypedAction,
    planTypedAction,
    tutorDialogueClosureFrameForTurn,
  };
}
