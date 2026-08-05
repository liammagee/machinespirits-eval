export function createTutorStubTurnOrchestration(dependencies = {}) {
  const {
    C,
    ROOT,
    TUTOR_GUARD_ACCOUNTING_SCHEMA,
    TUTOR_STUB_DIAGNOSTIC_COLLECTION_MODE,
    TUTOR_STUB_QUARANTINE_CONTINUATION,
    acknowledgeTutorStubOpeningRelease,
    advanceTutorStubDialogueClosure,
    analyzeLearnerTurn,
    appendTraceEvent,
    appendTutorStubTurnFailureTraceRecords,
    applyTutorStubComprehensionResponse,
    applyTutorStubConversationalCompletionSelection,
    applyTutorStubPointOfActionConstraint,
    assertTutorStubTurnAttemptCurrent,
    auditTutorResponseLeak,
    auditTutorStubFeedbackAdaptation,
    auditTutorStubPointOfActionCompliance,
    auditTutorStubQuarantineContinuation,
    auditTutorStubReleaseDelivery,
    auditTutorStubRepetitionResponse,
    auditTutorStubResponseConfiguration,
    automatedLearnerProfileId,
    automaticTechnicalDetailsEnabled,
    buildDynamicalSystemState,
    buildHumanDiscourseFrame,
    buildTutorInterimContext,
    buildTutorOpening,
    buildTutorStubDramaticReleaseFrame,
    buildTutorStubFeedbackAdaptationPlan,
    buildTutorStubFeedbackObservation,
    buildTutorStubObservedAudits,
    buildTutorStubPointOfActionTurn,
    buildTutorStubStateObservation,
    callTutor,
    classifyTutorStubDiagnosticFailure,
    closePriorTypedAction,
    commitTutorStubReleasePacing,
    createTutorStubLearnerResponseProvenance,
    currentReleaseRows,
    deterministicAutomatedLearnerFallback,
    enforceAutomatedLearnerProfile,
    findTutorStubFeedbackTargetTurn,
    generateAutomatedLearnerTurn,
    jsonClone,
    learnerProfileSpeakerLabel,
    openingDebugId,
    path,
    planTypedAction,
    printDirectorPreludeBeforeFirstTutor,
    printExplanatoryDebugTurn,
    printOpeningDebugLine,
    printResponseDetails,
    printTurnDebugLine,
    printTutorDagSnapshot,
    printTutorResponse,
    printWithConcurrentTerminal,
    recordTutorStubTuningFeedback,
    recordTutorStubTurnTiming,
    restoreTutorStubDiagnosticTransaction,
    snapshotTutorStubDiagnosticTransaction,
    startInterimAnimation,
    stateRunDebugId,
    stopInterimAnimation,
    turnDebugId,
    tutorCoachGuidanceEntries,
    tutorDialogueClosureFrameForTurn,
    tutorMessageContext,
    tutorStubComprehensionSnapshot,
    tutorStubDirectorGuidanceEntry,
    tutorStubLearnerDagGrounded,
    tutorStubNewEvidenceAvailable,
    tutorStubReleasePacingSnapshot,
    writeFieldVisualization,
  } = dependencies;

  async function runPassthroughTurn(learnerText, state, runtimeOptions = {}) {
    assertTutorStubTurnAttemptCurrent(runtimeOptions);
    const tutorTurn = state.turns.length + 1;
    const turnId = turnDebugId(state, tutorTurn);
    const learnerInput = runtimeOptions.learnerInput ? jsonClone(runtimeOptions.learnerInput) : null;
    const learnerResponseProvenance = jsonClone(
      learnerInput?.provenance ||
        runtimeOptions.learnerResponseProvenance ||
        createTutorStubLearnerResponseProvenance(),
    );
    const response = await callTutor({
      learnerText,
      history: state.history,
      state,
      systemPrompt: state.systemPrompt,
      resolved: state.resolved,
      temperature: state.temperature,
      maxTokens: state.maxTokens,
      historyTurns: state.historyTurns,
      world: null,
      dag: false,
      classification: null,
      tutorLearnerDagModel: null,
      registerSelection: null,
      humanDiscourseFrame: null,
      dialogueClosureFrame: null,
      trace: state.trace,
      stream: state.stream,
      cliEffort: state.cliEffort,
      multipleChoice: false,
      roleBase: 'tutor_stub_passthrough',
      learnerMessages: learnerInput?.messages || null,
      deferStreamOutput: Boolean(runtimeOptions.isCurrent),
      passthrough: true,
      signal: runtimeOptions.signal || null,
    });
    response.tutorRef = state.tuning?.activeRef || state.tutorInstance?.ref || null;
    assertTutorStubTurnAttemptCurrent(runtimeOptions);
    const turnTiming = recordTutorStubTurnTiming({
      response,
      state,
      tutorTurn,
      timingContext: runtimeOptions.turnTiming,
    });

    // Observed audits, if asked for. They run here rather than inside `callTutor`
    // for a reason: by this point the draft is already the delivered line, so
    // there is no code path by which a result could send it back. The audits are
    // read-only witnesses to a turn that has already happened.
    //
    // Both are computed on exactly the inputs the guarded arm gives them — the
    // world, the turn index, the draft, the learner message, and the replayed
    // public assistant messages — and `recentTutorTexts` is read *before* this
    // turn is pushed onto the history, so the tutor is never compared with
    // itself.
    const observedAuditsRequested = Boolean(state.passthrough?.observedAudits);
    const observedLeakAudit =
      observedAuditsRequested && state.world
        ? auditTutorResponseLeak({
            text: response.text,
            world: state.world,
            tutorTurn,
            learnerText,
            state,
          })
        : null;
    const observedRepetitionAudit = observedAuditsRequested
      ? auditTutorStubRepetitionResponse({
          text: response.text,
          recentTutorTexts: tutorMessageContext(state, state.history)
            .messages.filter((message) => message.role === 'assistant')
            .map((message) => message.content),
          // Passthrough has no release schedule and no closure frame to consult,
          // so the advance channel runs on text alone here. That asymmetry is the
          // point of observing this arm rather than guarding it.
          advance: {},
        })
      : null;
    const observedAudits = observedAuditsRequested
      ? buildTutorStubObservedAudits({
          leakAudit: observedLeakAudit,
          repetitionAudit: observedRepetitionAudit,
          response,
        })
      : null;

    state.history.push({ role: 'user', content: learnerText });
    state.history.push({ role: 'assistant', content: response.text });
    const turnRecord = {
      turnId,
      turn: tutorTurn,
      tutorRef: response.tutorRef,
      learner: learnerText,
      learnerResponseProvenance,
      ...(learnerInput
        ? {
            learnerInput,
            learnerMessages: learnerInput.messages,
          }
        : {}),
      passthrough: true,
      observedAudits,
      tutorLeakAudit: observedLeakAudit,
      tutorRepetitionAudit: observedRepetitionAudit,
      // Named and left null on purpose. Each of these scores a draft against a
      // per-turn contract the bare arm never builds, so an absent value here
      // means "no referent", not "passed".
      tutorQuestionSupportAudit: null,
      tutorDramaticReleaseAudit: null,
      tutorHumanScaffoldAudit: null,
      tutorDialogueClosureAudit: null,
      tutorLiveSourceActionAlignmentAudit: null,
      tutorResponseRepaired: false,
      tutorDeterministicFallback: false,
      classification: null,
      tutorLearnerDagModel: null,
      registerSelection: null,
      responseConfiguration: null,
      responseComposition: null,
      tutor: response.text,
      prompts: {
        tutor: response.promptSnapshot || null,
      },
      provider: response.provider,
      model: response.model,
      latencyMs: response.latencyMs,
      usage: response.usage,
      tokenUsageAvailable: response.tokenUsageAvailable,
      turnTiming,
    };
    state.turns.push(turnRecord);
    appendTraceEvent(state.trace, {
      type: 'learner_response_provenance_recorded',
      turnId,
      turn: tutorTurn,
      provenance: learnerResponseProvenance,
    });
    appendTraceEvent(state.trace, {
      type: 'passthrough_turn_complete',
      turnId,
      turn: tutorTurn,
      modelCallCount: 1,
      requestSurface: ['system_setup', 'full_public_history', 'latest_learner_message'],
      observedAudits: Boolean(observedAudits),
    });
    if (observedAudits) {
      appendTraceEvent(state.trace, {
        type: 'passthrough_observed_audits',
        turnId,
        turn: tutorTurn,
        ...observedAudits,
      });
    }
    appendTraceEvent(state.trace, {
      type: 'turn_complete',
      turnId,
      turn: tutorTurn,
      turnRecord,
    });
    appendTutorStubTurnFailureTraceRecords(state);
    return {
      ...response,
      passthrough: true,
      observedAudits,
      dagSnapshot: null,
      registerSelection: null,
      releasePacing: null,
    };
  }

  async function runOneTurn(
    inputText,
    state,
    classification = null,
    tutorLearnerDag = null,
    registerSelection = null,
    previousRegisterEfficacy = null,
    precomputedResponse = null,
    runtimeOptions = {},
  ) {
    const learnerText = String(inputText || '').trim();
    if (!learnerText) {
      appendTraceEvent(state.trace, {
        type: 'empty_learner_turn_rejected',
        turn: state.turns.length + 1,
      });
      throw new Error('empty learner turn: no tutor response can be generated without learner text');
    }
    if (state.passthrough?.enabled) {
      return runPassthroughTurn(learnerText, state, runtimeOptions);
    }
    const learnerInput = runtimeOptions.learnerInput ? jsonClone(runtimeOptions.learnerInput) : null;
    const learnerResponseProvenance = jsonClone(
      learnerInput?.provenance ||
        runtimeOptions.learnerResponseProvenance ||
        createTutorStubLearnerResponseProvenance(),
    );
    assertTutorStubTurnAttemptCurrent(runtimeOptions);
    const tutorTurn = state.turns.length + 1;
    const turnId = turnDebugId(state, tutorTurn);
    const humanDiscourseFrame =
      buildHumanDiscourseFrame({
        state,
        tutorTurn,
        tutorLearnerDag,
        classification,
        learnerText,
      }) || {};
    const instructionalMetaRepair = humanDiscourseFrame?.discoursePlane?.plane === 'instructional_meta';
    const { tutorDagSnapshot: dagSnapshot, frame: dialogueClosureFrame } = tutorDialogueClosureFrameForTurn({
      state,
      tutorTurn,
      tutorLearnerDag,
    });
    const comprehensionBeforeTutor = tutorStubComprehensionSnapshot(state.comprehension, { turn: tutorTurn });
    const dagFactDropout = tutorLearnerDag?.dagFactDropout || null;
    const directorGuidance = tutorStubDirectorGuidanceEntry(state.directorGuidance, tutorTurn);
    const coachGuidance = precomputedResponse?.deterministicClosure
      ? []
      : tutorCoachGuidanceEntries(state, tutorTurn).map((entry) => ({ ...entry }));
    const stateObservation = buildTutorStubStateObservation({
      turnRecord: {
        turn: tutorTurn,
        learner: learnerText,
        learnerResponseProvenance,
        tutorFeedback: learnerInput?.tutorFeedback || null,
        classification,
        tutorLearnerDagModel: tutorLearnerDag?.model || null,
        tutorLearnerDagUpdate: tutorLearnerDag
          ? {
              preflight: tutorLearnerDag.preflight || null,
              accepted: tutorLearnerDag.accepted || null,
              rejected: tutorLearnerDag.rejected || [],
              extractor: tutorLearnerDag.extractor || null,
              dagFactDropout,
            }
          : null,
        humanDiscourseFrame,
        scaffoldState: humanDiscourseFrame.scaffoldState,
        proofDebt: humanDiscourseFrame.proofDebt,
        warrantPremiseAudit: humanDiscourseFrame.warrantPremiseAudit,
        releasePacing: tutorStubReleasePacingSnapshot(state.releasePacing, state.world),
      },
      previousObservation: state.turns.at(-1)?.stateObservation || null,
      previousTurnRecords: state.turns,
      provenance: {
        prediction_origin: 'after_learner_observation_before_tutor_realization',
        observed_before_tutor_call: true,
      },
    });

    const dynamicalState = state.pointOfAction?.enabled
      ? buildDynamicalSystemState({ state, classification, tutorLearnerDag })
      : null;
    let pointOfAction = state.pointOfAction?.enabled
      ? buildTutorStubPointOfActionTurn({
          arm: state.pointOfAction.arm,
          turn: tutorTurn,
          stagnation: dynamicalState?.state_vector?.stagnation || 0,
          proposedActionFamily:
            registerSelection?.action_family || registerSelection?.response_configuration?.action_family || null,
          previousActionFamilies: state.turns
            .map((turn) => turn?.registerSelection?.action_family || turn?.responseConfiguration?.action_family)
            .filter(Boolean),
          evidenceUse: classification?.turn?.evidence_use || null,
          unresolvedTerms: comprehensionBeforeTutor?.features?.unresolvedTerms || [],
          nearClosure: dynamicalState?.trajectory?.flags?.nearClosure === true,
          closeInquiry:
            registerSelection?.action_family === 'close_inquiry' || dialogueClosureFrame?.mandatory === true,
          duePremises: instructionalMetaRepair ? [] : currentReleaseRows(state, tutorTurn).map((row) => row.premise),
          opportunityProtocol: state.pointOfAction.opportunityProtocol,
          opportunityProtocolConsumed: state.pointOfAction.history.some(
            (entry) => entry?.opportunity_protocol?.activated === true,
          ),
        })
      : null;
    if (state.pointOfAction) state.pointOfAction.current = pointOfAction;
    if (pointOfAction) {
      appendTraceEvent(state.trace, {
        type: 'point_of_action_assignment',
        turn: tutorTurn,
        turnId,
        pointOfAction,
      });
      registerSelection = applyTutorStubPointOfActionConstraint(registerSelection, pointOfAction);
    }

    if (dagFactDropout?.droppedNow?.length || dagFactDropout?.repairedNow?.length) {
      appendTraceEvent(state.trace, {
        type: 'dag_fact_dropout_update',
        turn: tutorTurn,
        turnId,
        dropout: dagFactDropout,
      });
    }

    const typedAction =
      state.typedActions?.enabled && precomputedResponse?.deterministicClosure
        ? {
            registerSelection,
            decision: null,
            priorOutcome: closePriorTypedAction({ state, learnerText, turn: tutorTurn }),
          }
        : planTypedAction({
            state,
            learnerText,
            stateObservation,
            turn: tutorTurn,
            classification,
            tutorLearnerDag,
            registerSelection,
          });
    registerSelection = typedAction.registerSelection;
    registerSelection = applyTutorStubPointOfActionConstraint(registerSelection, pointOfAction);
    const completionSelection = applyTutorStubConversationalCompletionSelection(
      registerSelection,
      humanDiscourseFrame.conversationalCompletion,
      { newEvidenceAvailable: tutorStubNewEvidenceAvailable(state) },
    );
    registerSelection = completionSelection.selection;
    if (humanDiscourseFrame.conversationalCompletion?.resolved) {
      if (state.register?.enabled && registerSelection) {
        if (state.register.history.at(-1)?.turn === registerSelection.turn) {
          state.register.history[state.register.history.length - 1] = registerSelection;
        }
        state.register.current = registerSelection;
      }
      appendTraceEvent(state.trace, {
        type: 'conversational_completion_resolution',
        turn: tutorTurn,
        turnId,
        completion: humanDiscourseFrame.conversationalCompletion,
        actionFamilyBefore: completionSelection.previousActionFamily,
        actionFamilyAfter:
          registerSelection?.response_configuration?.action_family || registerSelection?.action_family || null,
        actionFamilyChanged: completionSelection.changed,
      });
    }
    const tutorFeedback = learnerInput?.tutorFeedback || null;
    const feedbackTargetTurn = findTutorStubFeedbackTargetTurn({
      feedback: tutorFeedback,
      turns: state.turns,
      opening: {
        turnId: openingDebugId(stateRunDebugId(state)),
        text: state.history.find((message) => message.role === 'assistant')?.content || '',
        provider: state.openingRealization?.provider || null,
        model: state.openingRealization?.model || null,
      },
    });
    const feedbackAdaptationPlan = buildTutorStubFeedbackAdaptationPlan({
      feedback: tutorFeedback,
      targetTurn: feedbackTargetTurn,
      nextSelection: registerSelection,
    });
    assertTutorStubTurnAttemptCurrent(runtimeOptions);
    if (
      precomputedResponse?.speculativeCacheHit &&
      pointOfAction?.assigned_trigger &&
      pointOfAction.arm !== 'standing_book'
    ) {
      appendTraceEvent(state.trace, {
        type: 'mixed_learner_tutor_prefetch_bypassed',
        turn: tutorTurn,
        reason: 'point_of_action_intervention_must_precede_tutor_output_generation',
      });
      precomputedResponse = null;
    }
    if (precomputedResponse?.speculativeCacheHit && typedAction.decision) {
      appendTraceEvent(state.trace, {
        type: 'mixed_learner_tutor_prefetch_bypassed',
        turn: tutorTurn,
        reason: 'typed_action_must_precede_tutor_output_generation',
      });
      precomputedResponse = null;
    }
    if (precomputedResponse?.speculativeCacheHit && feedbackAdaptationPlan) {
      appendTraceEvent(state.trace, {
        type: 'mixed_learner_tutor_prefetch_bypassed',
        turn: tutorTurn,
        reason: 'rated_response_adaptation_contract_must_precede_tutor_output_generation',
      });
      precomputedResponse = null;
    }
    const response =
      precomputedResponse ||
      (await callTutor({
        learnerText,
        history: state.history,
        state,
        systemPrompt: state.systemPrompt,
        resolved: state.resolved,
        temperature: state.temperature,
        maxTokens: state.maxTokens,
        historyTurns: state.historyTurns,
        world: state.world,
        dag: state.dag,
        classification,
        tutorLearnerDagModel: tutorLearnerDag,
        registerSelection,
        humanDiscourseFrame,
        dialogueClosureFrame,
        trace: state.trace,
        stream: state.stream,
        cliEffort: state.cliEffort,
        multipleChoice: state.multipleChoice,
        learnerMessages: learnerInput?.messages || null,
        tutorFeedback,
        feedbackAdaptationPlan,
        deferStreamOutput: Boolean(runtimeOptions.isCurrent),
        signal: runtimeOptions.signal || null,
      }));
    pointOfAction = state.pointOfAction?.current || pointOfAction;
    response.tutorRef = state.tuning?.activeRef || state.tutorInstance?.ref || null;
    assertTutorStubTurnAttemptCurrent(runtimeOptions);
    const priorDialogueClosure = state.dialogueClosure;
    state.dialogueClosure = advanceTutorStubDialogueClosure(priorDialogueClosure, {
      frame: dialogueClosureFrame,
      audit: response.closureAudit,
      turn: tutorTurn,
    });
    if (state.dialogueClosure?.phase !== priorDialogueClosure?.phase) {
      appendTraceEvent(state.trace, {
        type: 'dialogue_closure_transition',
        turn: tutorTurn,
        from: priorDialogueClosure?.phase || 'open',
        to: state.dialogueClosure.phase,
        basis: state.dialogueClosure.basis,
        audit: response.closureAudit || null,
      });
    }

    const selectedResponseConfiguration = registerSelection?.response_configuration || registerSelection || null;
    const deliveredResponseConfiguration = response.deliveryResponseConfiguration || selectedResponseConfiguration;
    const recordedFinalDeliveryAudit =
      response.guardAccounting?.finalDelivery?.audits?.responseConfigurationAudit || null;
    const responseConfigurationAudit =
      recordedFinalDeliveryAudit ||
      auditTutorStubResponseConfiguration({
        text: response.text,
        configuration: deliveredResponseConfiguration,
        world: state.world,
        composition: response.responseComposition,
      });
    const selectedResponseConfigurationAudit = response.deliveryResponseConfiguration
      ? auditTutorStubResponseConfiguration({
          text: response.text,
          configuration: selectedResponseConfiguration,
          world: state.world,
          composition: response.responseComposition,
        })
      : responseConfigurationAudit;
    if (responseConfigurationAudit) {
      appendTraceEvent(state.trace, {
        type: 'response_configuration_audit',
        turn: tutorTurn,
        turnId,
        configuration: deliveredResponseConfiguration,
        selectedConfiguration: selectedResponseConfiguration,
        deliveredConfiguration: deliveredResponseConfiguration,
        configurationTransition: response.responseConfigurationTransition || null,
        selectedAudit: selectedResponseConfigurationAudit,
        audit: responseConfigurationAudit,
      });
    }

    const feedbackAdaptationAudit = auditTutorStubFeedbackAdaptation({
      plan: feedbackAdaptationPlan,
      targetTurn: feedbackTargetTurn,
      currentTurn: {
        turn: tutorTurn,
        turnId,
        tutor: response.text,
        responseConfiguration: deliveredResponseConfiguration,
        responseConfigurationAudit,
        responseComposition: response.responseComposition || null,
        responseCompositionAudit: response.responseCompositionAudit || null,
      },
    });

    const comprehensionResponse = applyTutorStubComprehensionResponse(state.comprehension, {
      text: response.text,
      turn: tutorTurn,
      source: 'tutor_turn',
    });
    const comprehensionAfterTutor = comprehensionResponse.snapshot;
    if (comprehensionResponse.explainedTerms.length || comprehensionBeforeTutor.lastRequest?.turn === tutorTurn) {
      appendTraceEvent(state.trace, {
        type: 'comprehension_response',
        turn: tutorTurn,
        explainedTerms: comprehensionResponse.explainedTerms,
        unresolvedTerms: comprehensionAfterTutor?.features?.unresolvedTerms || [],
        comprehensionState: comprehensionAfterTutor,
      });
    }

    const dueReleaseRows = instructionalMetaRepair ? [] : currentReleaseRows(state, tutorTurn);
    const dramaticReleaseFrame = buildTutorStubDramaticReleaseFrame({
      dueEvidence: dueReleaseRows,
      world: state.world,
    });
    const duePremiseIds = dueReleaseRows.map((row) => row?.premise).filter(Boolean);
    const releaseDeliveryAudit =
      response.releaseDeliveryAudit ||
      auditTutorStubReleaseDelivery({
        text: response.text,
        world: state.world,
        premiseIds: duePremiseIds,
      });
    response.releaseDeliveryAudit = releaseDeliveryAudit;
    if (duePremiseIds.length) {
      appendTraceEvent(state.trace, {
        type: 'release_delivery_audit',
        turn: tutorTurn,
        turnId,
        audit: releaseDeliveryAudit,
      });
    }

    const releasePacing = commitTutorStubReleasePacing({
      pacing: state.releasePacing,
      world: state.world,
      turn: tutorTurn,
      deliveredPremises: releaseDeliveryAudit.deliveredPremises,
    });
    if (releasePacing) {
      appendTraceEvent(state.trace, {
        type: 'release_pacing_committed',
        turn: tutorTurn,
        turnId,
        releasedNow: releasePacing.releasedNow,
        notDeliveredNow: releasePacing.notDeliveredNow,
        direction: releasePacing.direction,
        effectiveSpeed: releasePacing.effectiveSpeed,
        nextRelease: releasePacing.nextRelease,
        releasePacing,
      });
    }

    const pointOfActionCompliance = auditTutorStubPointOfActionCompliance({
      turn: pointOfAction,
      tutorText: response.text,
      releasedPremiseCount: releasePacing?.releasedNow?.length || 0,
      realizedActionFamily:
        registerSelection?.action_family || registerSelection?.response_configuration?.action_family || null,
      guardsPassed:
        response.leakAudit?.ok !== false &&
        response.scaffoldAudit?.ok !== false &&
        response.questionSupportAudit?.ok !== false &&
        response.dramaticReleaseAudit?.ok !== false &&
        response.repetitionAudit?.ok !== false &&
        response.closureAudit?.ok !== false &&
        response.guardAccounting?.finalDelivery?.auditOk !== false,
    });
    if (pointOfAction) {
      const completedPointOfAction = { ...pointOfAction, compliance: pointOfActionCompliance };
      state.pointOfAction.current = completedPointOfAction;
      state.pointOfAction.history.push(completedPointOfAction);
      appendTraceEvent(state.trace, {
        type: 'point_of_action_compliance',
        turn: tutorTurn,
        turnId,
        compliance: pointOfActionCompliance,
      });
    }

    const feedbackObservation = buildTutorStubFeedbackObservation({
      feedback: tutorFeedback,
      targetTurn: feedbackTargetTurn,
      learnerTurn: {
        turn: tutorTurn,
        turnId,
        text: learnerText,
        messageCount: learnerInput?.messageCount || learnerInput?.messages?.length || 1,
        messages: learnerInput?.messages || null,
        learnerResponseProvenance,
        classification,
      },
      currentTurn: {
        turn: tutorTurn,
        turnId,
        tutor: response.text,
        responseConfiguration: deliveredResponseConfiguration,
        responseConfigurationAudit,
        responseComposition: response.responseComposition || null,
        responseCompositionAudit: response.responseCompositionAudit || null,
        tutorLeakAudit: response.leakAudit || null,
        tutorHumanScaffoldAudit: response.scaffoldAudit || null,
        tutorQuestionSupportAudit: response.questionSupportAudit || null,
        tutorDramaticReleaseAudit: response.dramaticReleaseAudit || null,
        tutorRepetitionAudit: response.repetitionAudit || null,
        tutorDialogueClosureAudit: response.closureAudit || null,
        tutorResponseRepaired: Boolean(response.repaired),
        tutorDeterministicFallback: Boolean(response.deterministicFallback),
      },
      previousRegisterEfficacy,
      adaptationPlan: feedbackAdaptationPlan,
      adaptationAudit: feedbackAdaptationAudit,
      provenance: {
        runId: stateRunDebugId(state),
        sourceAssetId: state.trace?.assetId || null,
        trace: state.trace?.filePath ? path.relative(ROOT, state.trace.filePath) : null,
        worldId: state.world?.id || null,
        learnerProfileId: state.learnerProfileId || null,
        interactionMode: state.interaction?.mode || 'learner',
        learnerResponseAuthorship: learnerResponseProvenance.authorship,
        trainingReuse: jsonClone(state.trainingReuse),
      },
    });

    const turnTiming = recordTutorStubTurnTiming({
      response,
      state,
      tutorTurn,
      classification,
      tutorLearnerDag,
      timingContext: runtimeOptions.turnTiming,
    });

    state.history.push({ role: 'user', content: learnerText });
    state.history.push({ role: 'assistant', content: response.text });
    if (directorGuidance) {
      appendTraceEvent(state.trace, {
        type: 'director_guidance_applied',
        turn: tutorTurn,
        turnId,
        guidance: directorGuidance,
        publicTranscriptChanged: false,
      });
    }
    if (coachGuidance.length && state.coach) {
      const appliedIds = new Set(coachGuidance.map((entry) => entry.id));
      state.coach.pending = state.coach.pending.filter((entry) => !appliedIds.has(entry.id));
      state.coach.history.push({
        turn: tutorTurn,
        turnId,
        guidance: coachGuidance,
        tutor: response.text,
        appliedAt: new Date().toISOString(),
      });
      appendTraceEvent(state.trace, {
        type: 'coach_guidance_applied',
        turn: tutorTurn,
        turnId,
        guidance: coachGuidance,
        publicTranscriptChanged: false,
      });
    }
    const turnRecord = {
      turnId,
      turn: tutorTurn,
      tutorRef: response.tutorRef,
      learner: learnerText,
      learnerResponseProvenance,
      ...(learnerInput
        ? {
            learnerInput,
            learnerMessages: learnerInput.messages,
          }
        : {}),
      directorGuidance,
      coachGuidance,
      stateObservation,
      classification,
      tutorLearnerDagModel: tutorLearnerDag?.model || null,
      learnerAdvance: tutorLearnerDag?.advance || tutorLearnerDag?.model?.learnerAdvance || null,
      tutorLearnerDagUpdate: tutorLearnerDag
        ? {
            preflight: tutorLearnerDag.preflight || null,
            accepted: tutorLearnerDag.accepted || null,
            rejected: tutorLearnerDag.rejected || [],
            extractor: tutorLearnerDag.extractor || null,
            advance: tutorLearnerDag.advance || tutorLearnerDag.model?.learnerAdvance || null,
            dagFactDropout,
          }
        : null,
      dagFactDropout,
      humanDiscourseFrame,
      scaffoldState: humanDiscourseFrame.scaffoldState,
      sideArc: humanDiscourseFrame.sideArc,
      proofDebt: humanDiscourseFrame.proofDebt,
      warrantPremiseAudit: humanDiscourseFrame.warrantPremiseAudit,
      generousInference: humanDiscourseFrame.generousInference,
      conversationalCompletion: humanDiscourseFrame.conversationalCompletion,
      questionSupport: humanDiscourseFrame.questionSupport,
      dramaticRelease: {
        frame: dramaticReleaseFrame,
        audit: response.dramaticReleaseAudit || null,
      },
      releasePacing,
      releaseDeliveryAudit,
      comprehension: {
        beforeTutor: comprehensionBeforeTutor,
        afterTutor: comprehensionAfterTutor,
      },
      dialogueClosure: {
        frame: dialogueClosureFrame,
        audit: response.closureAudit || null,
        lifecycle: state.dialogueClosure,
      },
      closureCheckIn: dialogueClosureFrame.phase === 'final_checkin_response',
      pointOfAction: state.pointOfAction?.current || null,
      registerSelection,
      responseConfiguration: jsonClone(registerSelection?.response_configuration || null),
      deliveredResponseConfiguration: jsonClone(
        response.deliveryResponseConfiguration || registerSelection?.response_configuration || null,
      ),
      responseConfigurationTransition: jsonClone(response.responseConfigurationTransition || null),
      selectedResponseConfigurationAudit,
      responseConfigurationAudit,
      firstDraftContract: jsonClone(response.firstDraftContract || null),
      feedbackAdaptationPlan,
      feedbackAdaptationAudit,
      feedbackObservation,
      responseComposition: {
        frame: jsonClone(response.responseCompositionFrame || null),
        audit: jsonClone(response.responseCompositionAudit || null),
        uptake: response.responseComposition?.uptake || null,
        development: response.responseComposition?.development || null,
        segmentation: response.responseComposition?.method || null,
        atomicAssistantTurn: true,
      },
      previousRegisterEfficacy,
      ...(typedAction.decision || typedAction.priorOutcome
        ? {
            typedActionDecision: jsonClone(typedAction.decision),
            typedActionPriorOutcome: jsonClone(typedAction.priorOutcome),
            scaffoldLifecycle: jsonClone(state.typedActions.scaffoldLifecycle),
            scaffoldLifecycleTransitions: [
              typedAction.priorOutcome?.scaffold_lifecycle_transition,
              typedAction.decision?.scaffold_lifecycle?.transition,
            ]
              .filter(Boolean)
              .map((transition) => jsonClone(transition)),
          }
        : {}),
      tutor: response.text,
      tutorDag: dagSnapshot,
      tutorLeakAudit: response.leakAudit || null,
      tutorHumanScaffoldAudit: response.scaffoldAudit || null,
      tutorQuestionSupportAudit: response.questionSupportAudit || null,
      tutorDramaticReleaseAudit: response.dramaticReleaseAudit || null,
      tutorLiveSourceActionAlignmentAudit: response.liveSourceActionAlignmentAudit || null,
      tutorSourceAccessibility: response.liveSourceActionAlignmentAudit
        ? {
            directAccessible: response.liveSourceActionAlignmentAudit.direct_accessible,
            compensationRequired: response.liveSourceActionAlignmentAudit.compensation_required,
            compensationContractReady: response.liveSourceActionAlignmentAudit.compensation_contract_ready,
            compensationVisible: response.liveSourceActionAlignmentAudit.compensation_visible,
            effectiveMode: response.liveSourceActionAlignmentAudit.effective_mode,
          }
        : null,
      tutorRepetitionAudit: response.repetitionAudit || null,
      tutorDialogueClosureAudit: response.closureAudit || null,
      tutorResponseRepaired: Boolean(response.repaired),
      tutorDeterministicFallback: Boolean(response.deterministicFallback),
      tutorDeterministicClosure: Boolean(response.deterministicClosure),
      prompts: {
        tutor: response.promptSnapshot || null,
      },
      tutorGuardAccounting: response.guardAccounting || null,
      provider: response.provider,
      model: response.model,
      latencyMs: response.latencyMs,
      usage: response.usage,
      tokenUsageAvailable: response.tokenUsageAvailable,
      turnTiming,
    };
    state.turns.push(turnRecord);
    appendTraceEvent(state.trace, {
      type: 'learner_response_provenance_recorded',
      turnId,
      turn: tutorTurn,
      provenance: learnerResponseProvenance,
    });
    if (feedbackObservation) {
      recordTutorStubTuningFeedback(state.tuning, feedbackObservation);
      appendTraceEvent(state.trace, {
        type: 'tutor_feedback_observation',
        turnId,
        turn: tutorTurn,
        observation: feedbackObservation,
        publicTranscriptChanged: false,
      });
    }
    appendTraceEvent(state.trace, {
      type: 'turn_complete',
      turnId,
      turn: tutorTurn,
      turnRecord,
    });
    appendTutorStubTurnFailureTraceRecords(state);
    return {
      ...response,
      dagSnapshot,
      registerSelection: jsonClone(registerSelection || null),
      releasePacing: jsonClone(releasePacing),
    };
  }

  async function runAnalyzedTutorTurn(
    learnerText,
    state,
    { precomputedRaw = null, signal = null, isCurrent = null, learnerInput = null } = {},
  ) {
    const startedAtMs = Date.now();
    const analysisStartedAtMs = Date.now();
    const { classification, tutorLearnerDag, registerSelection, previousRegisterEfficacy } = await analyzeLearnerTurn(
      learnerText,
      state,
      { precomputedRaw, signal, isCurrent },
    );
    const analysisCompletedAtMs = Date.now();
    assertTutorStubTurnAttemptCurrent({ signal, isCurrent });
    startInterimAnimation(
      state,
      'calling tutor',
      buildTutorInterimContext({
        learnerText,
        state,
        classification,
        tutorLearnerDag,
        registerSelection,
        previousRegisterEfficacy,
      }),
    );
    let response;
    const tutorStartedAtMs = Date.now();
    try {
      response = await runOneTurn(
        learnerText,
        state,
        classification,
        tutorLearnerDag,
        registerSelection,
        previousRegisterEfficacy,
        null,
        {
          signal,
          isCurrent,
          learnerInput,
          turnTiming: {
            startedAtMs,
            analysisStartedAtMs,
            analysisCompletedAtMs,
            tutorStartedAtMs,
            analysisSource: precomputedRaw?.dagPreflight ? 'precomputed' : 'foreground',
            tutorSource: 'foreground',
          },
        },
      );
    } catch (error) {
      error.tutorDiagnosticContext = jsonClone({
        learnerText,
        learnerResponseProvenance: learnerInput?.provenance || null,
        turn: state.turns.length + 1,
        classification,
        tutorLearnerDag,
        registerSelection,
        previousRegisterEfficacy,
        dueReleaseRows: currentReleaseRows(state, state.turns.length + 1),
        releasePacing: tutorStubReleasePacingSnapshot(state.releasePacing, state.world),
      });
      throw error;
    } finally {
      stopInterimAnimation(state);
    }
    assertTutorStubTurnAttemptCurrent({ signal, isCurrent });
    printWithConcurrentTerminal(state, () => {
      if (automaticTechnicalDetailsEnabled(state)) printTutorDagSnapshot(response.dagSnapshot);
      printResponseDetails(response, state);
      printDirectorPreludeBeforeFirstTutor(state, { reason: 'first_generated_tutor_response' });
      printTutorResponse(response, state.stream);
    });
    await printExplanatoryDebugTurn(state, { signal, isCurrent });
    assertTutorStubTurnAttemptCurrent({ signal, isCurrent });
    writeFieldVisualization(state, { reason: 'turn_complete' });
    return response;
  }

  async function emitTutorOpeningToState(state, { enabled = true, reason = 'start', signal = null } = {}) {
    if (!enabled || state.history.length) return null;
    const openingRealization = await buildTutorOpening(state, { signal });
    const opening = openingRealization.text;
    state.openingRealization = openingRealization;
    state.history.push({ role: 'assistant', content: opening });
    acknowledgeTutorStubOpeningRelease({ pacing: state.releasePacing, world: state.world });
    const turnId = openingDebugId(stateRunDebugId(state));
    appendTraceEvent(state.trace, {
      type: 'tutor_opening',
      turnId,
      reason,
      text: opening,
      realization: openingRealization,
    });
    printOpeningDebugLine(state);
    printDirectorPreludeBeforeFirstTutor(state, { reason });
    console.log(`${C.magenta}tutor >${C.reset} ${opening}\n`);
    return opening;
  }

  function learnerDagReachedGroundedClosure(state) {
    const model = state.turns.at(-1)?.tutorLearnerDagModel || null;
    return tutorStubLearnerDagGrounded(model);
  }

  function quarantinedGuardAccounting(error, quarantineAudit) {
    const exhausted = jsonClone(error?.tutorGuardAccounting || null);
    const safeText = TUTOR_STUB_QUARANTINE_CONTINUATION;
    return {
      ...(exhausted || {
        schema: TUTOR_GUARD_ACCOUNTING_SCHEMA,
        guards: {},
        attempts: [],
        repairsApplied: [],
        originalCandidate: null,
      }),
      outcome: 'quarantined_after_recoverable_turn_failure',
      exhaustedFinalDelivery: exhausted?.finalDelivery || null,
      finalDelivery: {
        source: 'mechanical_public_safe_quarantine',
        provider: 'harness',
        model: 'mechanical-quarantine-v1',
        deterministicFallback: false,
        deterministicClosure: false,
        candidate: {
          start: 0,
          end: safeText.length,
          text: safeText,
          offsetEncoding: 'utf16_code_units',
        },
        audits: quarantineAudit,
        auditOk: quarantineAudit.ok,
      },
    };
  }

  function commitTutorStubQuarantinedTurn({ state, learnerText, learnerInput = null, error, failure, transaction }) {
    const tutorTurn = state.turns.length + 1;
    const turnId = turnDebugId(state, tutorTurn);
    const text = TUTOR_STUB_QUARANTINE_CONTINUATION;
    const mechanicalAudit = auditTutorStubQuarantineContinuation(text);
    const leakAudit =
      state.dag && state.world
        ? auditTutorResponseLeak({ text, world: state.world, tutorTurn, learnerText, state })
        : { ok: true, leaks: [] };
    const quarantineAudit = {
      ...mechanicalAudit,
      leakAudit,
      ok: mechanicalAudit.ok && leakAudit.ok,
    };
    if (!quarantineAudit.ok) {
      const corruption = new Error('Mechanical quarantine continuation failed its public-safety audit');
      corruption.code = 'TUTOR_QUARANTINE_STATE_CORRUPTION';
      corruption.quarantineAudit = quarantineAudit;
      throw corruption;
    }

    const firstQuarantinedTurn = state.diagnosticCollection.firstQuarantinedTurn || tutorTurn;
    state.diagnosticCollection.firstQuarantinedTurn = firstQuarantinedTurn;
    state.diagnosticCollection.quarantinedTurns.push(tutorTurn);
    const accounting = quarantinedGuardAccounting(error, quarantineAudit);
    const lastValidModel = state.turns.at(-1)?.tutorLearnerDagModel || state.learnerDag?.lastModel || null;
    const releasePacing = tutorStubReleasePacingSnapshot(state.releasePacing, state.world);
    const learnerResponseProvenance = jsonClone(learnerInput?.provenance || createTutorStubLearnerResponseProvenance());
    const turnRecord = {
      turnId,
      turn: tutorTurn,
      learner: learnerText,
      learnerResponseProvenance,
      ...(learnerInput
        ? {
            learnerInput: jsonClone(learnerInput),
            learnerMessages: jsonClone(learnerInput.messages || []),
          }
        : {}),
      tutor: text,
      quarantined: true,
      trajectoryContaminated: true,
      contaminationOriginTurn: firstQuarantinedTurn,
      quarantine: {
        schema: 'machinespirits.tutor-stub.quarantined-turn.v1',
        failure,
        error: {
          name: error?.name || 'Error',
          code: error?.code || null,
          message: error?.message || String(error),
        },
        audit: quarantineAudit,
        transaction: {
          rolledBack: true,
          publicHistoryLengthBefore: transaction.history.length,
          completedTurnCountBefore: transaction.turns.length,
          clueReleaseCommitted: false,
          preservedLastValidPublicState: true,
        },
        attempted: jsonClone(error?.tutorDiagnosticContext || null),
      },
      classification: null,
      tutorLearnerDagModel: jsonClone(lastValidModel),
      tutorLearnerDagUpdate: null,
      registerSelection: null,
      responseConfiguration: null,
      responseConfigurationAudit: null,
      responseComposition: null,
      releasePacing,
      releaseDeliveryAudit: {
        schema: 'machinespirits.tutor-stub.release-delivery-audit.v1',
        ok: true,
        deliveredPremises: [],
        missingPremises: [],
        quarantined: true,
      },
      tutorLeakAudit: leakAudit,
      tutorResponseRepaired: false,
      tutorDeterministicFallback: false,
      tutorGuardAccounting: accounting,
      provider: 'harness',
      model: 'mechanical-quarantine-v1',
      latencyMs: 0,
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, cost: 0 },
      tokenUsageAvailable: true,
    };
    state.history.push({ role: 'user', content: learnerText });
    state.history.push({ role: 'assistant', content: text });
    state.turns.push(turnRecord);
    appendTraceEvent(state.trace, {
      type: 'learner_response_provenance_recorded',
      turn: tutorTurn,
      turnId,
      provenance: learnerResponseProvenance,
    });
    appendTraceEvent(state.trace, {
      type: 'diagnostic_turn_transaction_rolled_back',
      turn: tutorTurn,
      turnId,
      failure,
      clueReleaseCommitted: false,
      publicHistoryLengthRestored: transaction.history.length,
      completedTurnCountRestored: transaction.turns.length,
    });
    appendTraceEvent(state.trace, {
      type: 'tutor_quarantine_continuation',
      turn: tutorTurn,
      turnId,
      text,
      audit: quarantineAudit,
      guardAccounting: accounting,
      publicDelivery: 'mechanical_public_safe_quarantine',
    });
    appendTraceEvent(state.trace, {
      type: 'turn_complete',
      turn: tutorTurn,
      turnId,
      turnRecord,
    });
    appendTutorStubTurnFailureTraceRecords(state);
    return {
      text,
      provider: 'harness',
      model: 'mechanical-quarantine-v1',
      latencyMs: 0,
      usage: turnRecord.usage,
      tokenUsageAvailable: true,
      guardAccounting: accounting,
      quarantined: true,
    };
  }

  async function runAutomatedLearnerDialogue({
    state,
    firstMessage = '',
    openingEnabled = true,
    autoLearnerResolved,
    autoLearnerProfile,
    autoTurns,
    autoSafetyTurns,
    autoStopOnGrounded,
    cliEffort = null,
    signal = null,
    isCurrent = null,
  }) {
    assertTutorStubTurnAttemptCurrent({ signal, isCurrent });
    const autoLearnerSpeakerLabel = learnerProfileSpeakerLabel(automatedLearnerProfileId(autoLearnerProfile));
    appendTraceEvent(state.trace, {
      type: 'auto_learner_run_start',
      model: autoLearnerResolved,
      profile: autoLearnerProfile,
      maxTurns: autoTurns,
      untilGrounded: autoTurns === null,
      safetyTurns: autoSafetyTurns,
      stopOnGrounded: autoStopOnGrounded,
    });
    if (!firstMessage) {
      await emitTutorOpeningToState(state, { enabled: openingEnabled, reason: 'auto_start', signal });
    }

    let nextLearnerText = firstMessage.trim();
    let reason = 'auto_turn_cap';
    for (let i = 0; autoTurns === null || i < autoTurns; i += 1) {
      assertTutorStubTurnAttemptCurrent({ signal, isCurrent });
      if (autoTurns === null && i >= autoSafetyTurns) {
        reason = 'auto_safety_turn_cap';
        break;
      }
      const turnNumber = state.turns.length + 1;
      const turnId = turnDebugId(state, turnNumber);
      let precomputedRaw = null;
      let learnerResponseProvenance = nextLearnerText
        ? createTutorStubLearnerResponseProvenance({
            authorship: 'human',
            origin: 'launch_first_message',
            inputMethod: 'command_line_argument',
            humanInLoop: true,
          })
        : null;
      if (!nextLearnerText) {
        startInterimAnimation(state, 'calling auto learner', { tutorTurn: turnNumber });
        let generated;
        try {
          generated = await generateAutomatedLearnerTurn({
            state,
            resolved: autoLearnerResolved,
            profile: autoLearnerProfile,
            turnNumber,
            stream: { enabled: false, interim: state.interim },
            cliEffort,
            signal,
          });
        } finally {
          stopInterimAnimation(state);
        }
        const enforced = await enforceAutomatedLearnerProfile({
          state,
          resolved: autoLearnerResolved,
          profile: autoLearnerProfile,
          turnNumber,
          generated,
          cliEffort,
          signal,
          isCurrent,
        });
        assertTutorStubTurnAttemptCurrent({ signal, isCurrent });
        generated = enforced.generated;
        precomputedRaw = enforced.precomputedRaw;
        nextLearnerText = generated.text;
        let deterministicFallback = false;
        if (!nextLearnerText) {
          nextLearnerText = deterministicAutomatedLearnerFallback({ state });
          deterministicFallback = true;
          appendTraceEvent(state.trace, {
            type: 'auto_learner_empty_fallback',
            turn: turnNumber,
            text: nextLearnerText,
            provider: generated.provider,
            model: generated.model,
          });
        }
        learnerResponseProvenance = createTutorStubLearnerResponseProvenance({
          authorship: 'ai',
          origin: 'automated_learner',
          inputMethod: 'automated_learner',
          humanInLoop: false,
          modelRef: state.autoLearner?.modelRef || null,
          provider: generated.provider || autoLearnerResolved?.provider || null,
          model: generated.model || autoLearnerResolved?.model || null,
          learnerProfileId: automatedLearnerProfileId(autoLearnerProfile),
          automation: {
            profileRepaired: enforced.repaired,
            profileAdherencePassed: enforced.passed,
            deterministicFallback,
          },
        });
        appendTraceEvent(state.trace, {
          type: 'auto_learner_turn',
          turn: turnNumber,
          text: nextLearnerText,
          provider: generated.provider,
          model: generated.model,
          latencyMs: generated.latencyMs,
          usage: generated.usage,
          profileRepaired: enforced.repaired,
          profileAdherencePassed: enforced.passed,
          learnerResponseProvenance,
        });
        printWithConcurrentTerminal(state, () => {
          printTurnDebugLine(state, turnNumber);
          console.log(`${C.brightBlue}${C.bold}${autoLearnerSpeakerLabel} (auto) >${C.reset} ${nextLearnerText}\n`);
        });
      } else {
        printWithConcurrentTerminal(state, () => {
          printTurnDebugLine(state, turnNumber);
          console.log(`${C.brightBlue}${C.bold}${autoLearnerSpeakerLabel} (auto) >${C.reset} ${nextLearnerText}\n`);
        });
      }

      const receivedAt = new Date().toISOString();
      const learnerInput = {
        schema: 'machinespirits.tutor-stub.compound-learner-turn.v1',
        compoundTurnId: `${turnId}:learner`,
        turn: turnNumber,
        turnId,
        revision: 1,
        messageCount: 1,
        messages: [
          {
            index: 1,
            text: nextLearnerText,
            receivedAt,
            provenance: jsonClone(learnerResponseProvenance),
          },
        ],
        tutorFeedback: null,
        combinedText: nextLearnerText,
        coalescedBeforeTutorReply: false,
        provenance: jsonClone(learnerResponseProvenance),
      };

      const diagnosticCollection = state.loopMode === TUTOR_STUB_DIAGNOSTIC_COLLECTION_MODE;
      const transaction = diagnosticCollection ? snapshotTutorStubDiagnosticTransaction(state) : null;
      if (diagnosticCollection) {
        appendTraceEvent(state.trace, {
          type: 'diagnostic_turn_transaction_started',
          turn: turnNumber,
          publicHistoryLength: transaction.history.length,
          completedTurnCount: transaction.turns.length,
          releasePacing: tutorStubReleasePacingSnapshot(transaction.releasePacing, state.world),
        });
      }
      try {
        await runAnalyzedTutorTurn(nextLearnerText, state, {
          precomputedRaw,
          signal,
          isCurrent,
          learnerInput,
        });
        if (diagnosticCollection) {
          appendTraceEvent(state.trace, {
            type: 'diagnostic_turn_transaction_committed',
            turn: turnNumber,
            publicHistoryLength: state.history.length,
            completedTurnCount: state.turns.length,
          });
        }
      } catch (error) {
        if (!diagnosticCollection) throw error;
        const failure = classifyTutorStubDiagnosticFailure(error);
        if (failure.disposition !== 'quarantine') {
          appendTraceEvent(state.trace, {
            type: 'diagnostic_collection_aborted',
            turn: turnNumber,
            failure,
            error: { name: error?.name || 'Error', code: error?.code || null, message: error.message },
          });
          throw error;
        }
        restoreTutorStubDiagnosticTransaction(state, transaction);
        const quarantine = commitTutorStubQuarantinedTurn({
          state,
          learnerText: nextLearnerText,
          learnerInput,
          error,
          failure,
          transaction,
        });
        printWithConcurrentTerminal(state, () => {
          printResponseDetails(quarantine, state, { suffix: '; quarantined diagnostic turn' });
          printTutorResponse(quarantine, state.stream);
        });
      }
      assertTutorStubTurnAttemptCurrent({ signal, isCurrent });
      nextLearnerText = '';

      if (autoStopOnGrounded && learnerDagReachedGroundedClosure(state)) {
        reason = 'auto_grounded_closure';
        break;
      }
    }
    assertTutorStubTurnAttemptCurrent({ signal, isCurrent });
    appendTraceEvent(state.trace, {
      type: 'auto_learner_run_end',
      reason,
      turns: state.turns.length,
    });
    return { reason, turns: state.turns.length };
  }

  return Object.freeze({
    runOneTurn,
    runAutomatedLearnerDialogue,
  });
}
