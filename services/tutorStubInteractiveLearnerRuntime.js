export function createTutorStubInteractiveLearnerRuntime(dependencies) {
  const {
    C,
    DEFAULT_TUTOR_STUB_LIGHT_ADAPTATION_THRESHOLD,
    appendTraceEvent,
    applyConversationalCompletionForLearnerTurn,
    applyLearnerAdvanceAssessment,
    applyLearnerRecordUpdate,
    applyTutorStubComprehensionRequest,
    applyTutorStubComprehensionResponse,
    automaticTechnicalDetailsEnabled,
    buildHumanDiscourseFrame,
    callTutor,
    classificationFromCombinedAnalysis,
    classifierTutorContext,
    clearStatusLine,
    cliEffort,
    committedReleaseRows,
    consumeMixedLearnerReadyAnnouncement,
    dagTurnContext,
    dialogueClosureTutorContext,
    evaluatePendingRegisterEfficacy,
    explicitPerformanceDirectiveValue,
    extractCombinedLearnerAnalysis,
    freezeTutorStubLearnerRecordUpdateForDiscoursePlane,
    generateMixedLearnerArtifacts,
    getConcurrentTerminal,
    getReadline,
    humanDiscourseTutorContext,
    invalidateMixedLearnerCache,
    isExiting,
    isProcessingTurn,
    learnerDagPreflightForTurn,
    learnerPublicEvidenceState,
    learnerRecordFromCombinedAnalysis,
    mergeConcurrentTutorStubDirectorGuidance,
    mixedLearner,
    mixedLearnerAnalysisCacheKey,
    mixedLearnerSuggestionMove,
    mixedLearnerTutorPrefetchDecision,
    normalizeResponseConfigurationSelection,
    printMixedLearnerProfilePresentation,
    printWithConcurrentTerminal,
    refreshMixedLearnerPrompt,
    registerSelectionFromCombinedAnalysis,
    resolveConversationalCompletionForLearnerTurn,
    resolveTutorStubDiscoursePlane,
    responseConfigurationContext,
    startInterimAnimation,
    state,
    stopInterimAnimation,
    tutorCoachGuidanceContext,
    tutorDialogueClosureFrameForTurn,
    tutorLearnerDagModelContext,
    tutorStubComprehensionPrompt,
    tutorStubComprehensionSnapshot,
    tutorStubDagFactDropoutSnapshot,
    tutorStubDirectorGuidancePrompt,
    tutorStubDirectorGuidanceSnapshot,
    tutorStubRegisterPolicyStackId,
    tutorStubReleasePacingSnapshot,
    turnDebugId,
    updateComprehensionForLearnerTurn,
    updateReleasePacingForLearnerTurn,
  } = dependencies;

  function resetMixedLearnerSuggestion(reason, { preserveAnalysisCache = false } = {}) {
    if (!mixedLearner.enabled) return;
    mixedLearner.draftInsertion = null;
    const cachedAnalysis = mixedLearner.analysisCache;
    const cachedAnalysisSnapshot = cachedAnalysis
      ? {
          key: cachedAnalysis.key,
          status: cachedAnalysis.status,
          tutorStatus: cachedAnalysis.tutorStatus,
          turn: cachedAnalysis.turn,
          turnId: cachedAnalysis.turnId,
        }
      : null;
    const invalidated = invalidateMixedLearnerCache(mixedLearner, { preserveAnalysisCache });
    if (invalidated.discardedAnalysis) {
      mixedLearner.cacheStats.discarded += 1;
      appendTraceEvent(state.trace, {
        type: 'mixed_learner_analysis_cache_discarded',
        reason,
        turn: cachedAnalysisSnapshot.turn,
        turnId: cachedAnalysisSnapshot.turnId,
        status: cachedAnalysisSnapshot.status,
        tutorStatus: cachedAnalysisSnapshot.tutorStatus,
        tutorResponseDiscarded: invalidated.discardedTutorResponse,
        key: cachedAnalysisSnapshot.key,
      });
    }
    if (invalidated.hadState) {
      appendTraceEvent(state.trace, {
        type: 'mixed_learner_suggestion_cleared',
        reason,
        turns: state.turns.length,
      });
    }
    return invalidated;
  }

  function currentMixedLearnerAnalysisKey(answer, turnNumber = state.turns.length + 1, tutorFeedback = null) {
    const dagPreflight = learnerDagPreflightForTurn(state, turnNumber);
    return mixedLearnerAnalysisCacheKey({
      answer: String(answer || '').trim(),
      turn: turnNumber,
      history: state.history,
      world: state.world?.id || null,
      learnerDag: state.learnerDag?.lastModel
        ? {
            turn: state.learnerDag.lastModel.turn || null,
            metrics: state.learnerDag.lastModel.metrics || null,
            assessment: state.learnerDag.lastModel.assessment || null,
          }
        : null,
      learnerDagPreflightHash: dagPreflight?.contentSha256 || null,
      registerPolicy: tutorStubRegisterPolicyStackId(state.register?.policy, state.register?.overlays),
      randomPerformance: Boolean(state.randomPerformance?.enabled),
      lightAdaptation: {
        enabled: Boolean(state.lightAdaptation?.enabled),
        threshold: state.lightAdaptation?.threshold ?? DEFAULT_TUTOR_STUB_LIGHT_ADAPTATION_THRESHOLD,
      },
      performanceDirectives: {
        register: explicitPerformanceDirectiveValue(state, 'register'),
        character: explicitPerformanceDirectiveValue(state, 'character'),
      },
      directorGuidance: tutorStubDirectorGuidanceSnapshot(state.directorGuidance),
      registerOverlayThreshold: state.register?.overlayThreshold ?? null,
      registerTemperature: state.register?.temperature ?? null,
      dagFactDropout: tutorStubDagFactDropoutSnapshot(state.learnerDag?.dropout),
      releasePacing: tutorStubReleasePacingSnapshot(state.releasePacing, state.world),
      comprehension: tutorStubComprehensionSnapshot(state.comprehension, { turn: turnNumber }),
      registerHistory: (state.register?.history || []).map((entry) => ({
        turn: entry.turn || null,
        selectedRegister: entry.selected_register || null,
        source: entry.source || null,
      })),
      tutorFeedback: tutorFeedback?.supplied ? { rating: tutorFeedback.rating } : null,
      analysisModel: state.learnerDag?.resolved || state.classifier?.resolved || null,
      learnerProfile: mixedLearner.profile,
      dagMode: state.dagMode,
      systemPrompt: state.systemPrompt,
      schema: 'mixed-learner-analysis-cache.v1',
    });
  }

  function cloneStateForMixedLearnerSpeculation() {
    return {
      ...state,
      history: structuredClone(state.history),
      turns: structuredClone(state.turns),
      world: structuredClone(state.world),
      learnerDag: structuredClone(state.learnerDag),
      comprehension: structuredClone(state.comprehension),
      releasePacing: structuredClone(state.releasePacing),
      register: structuredClone(state.register),
      randomPerformance: structuredClone(state.randomPerformance),
      lightAdaptation: structuredClone(state.lightAdaptation),
      performanceDirectives: structuredClone(state.performanceDirectives),
      dialogueClosure: structuredClone(state.dialogueClosure),
      directorGuidance: structuredClone(state.directorGuidance),
      coach: structuredClone(state.coach),
      stream: { enabled: false, interim: state.interim },
    };
  }

  function cloneStateForInteractiveLearnerAttempt() {
    return {
      ...state,
      history: structuredClone(state.history),
      turns: structuredClone(state.turns),
      learnerDag: structuredClone(state.learnerDag),
      comprehension: structuredClone(state.comprehension),
      releasePacing: structuredClone(state.releasePacing),
      register: structuredClone(state.register),
      lightAdaptation: structuredClone(state.lightAdaptation),
      randomPerformance: structuredClone(state.randomPerformance),
      performanceDirectives: structuredClone(state.performanceDirectives),
      dialogueClosure: structuredClone(state.dialogueClosure),
      typedActions: structuredClone(state.typedActions),
      directorGuidance: structuredClone(state.directorGuidance),
      coach: structuredClone(state.coach),
      stream: { ...state.stream, interim: state.interim, deferOutput: true },
    };
  }

  function replayConcurrentComprehensionChanges(target, baseline, current) {
    const baselineHistoryLength = baseline?.history?.length || 0;
    const concurrentEntries = (current?.history || []).slice(baselineHistoryLength);
    for (const entry of concurrentEntries) {
      if (entry?.type === 'request') {
        applyTutorStubComprehensionRequest(target, {
          ...entry,
          detected: true,
          schema: 'machinespirits.tutor-stub.comprehension-request.v1',
        });
      } else if (entry?.type === 'response') {
        applyTutorStubComprehensionResponse(target, {
          text: entry.text,
          turn: entry.turn,
          source: entry.source,
          force: true,
          terms: entry.terms,
        });
      }
    }
    return target;
  }

  function mergeConcurrentCoachChanges(attemptCoach, baselineCoach, currentCoach) {
    const merged = structuredClone(attemptCoach || { pending: [], history: [] });
    const baselinePendingIds = new Set((baselineCoach?.pending || []).map((entry) => entry.id));
    const baselineHistoryKeys = new Set(
      (baselineCoach?.history || []).map((entry) => `${entry.turn || 0}:${entry.appliedAt || ''}`),
    );
    const mergedPendingIds = new Set((merged.pending || []).map((entry) => entry.id));
    for (const entry of currentCoach?.pending || []) {
      if (!baselinePendingIds.has(entry.id) && !mergedPendingIds.has(entry.id)) {
        merged.pending.push(structuredClone(entry));
        mergedPendingIds.add(entry.id);
      }
    }
    const mergedHistoryKeys = new Set(
      (merged.history || []).map((entry) => `${entry.turn || 0}:${entry.appliedAt || ''}`),
    );
    for (const entry of currentCoach?.history || []) {
      const key = `${entry.turn || 0}:${entry.appliedAt || ''}`;
      if (!baselineHistoryKeys.has(key) && !mergedHistoryKeys.has(key)) {
        merged.history.push(structuredClone(entry));
        mergedHistoryKeys.add(key);
      }
    }
    return merged;
  }

  function commitInteractiveLearnerAttempt(attemptState, baseline) {
    const currentComprehension = state.comprehension;
    const currentDirectorGuidance = state.directorGuidance;
    const currentCoach = state.coach;
    state.history = attemptState.history;
    state.turns = attemptState.turns;
    state.learnerDag = attemptState.learnerDag;
    state.releasePacing = attemptState.releasePacing;
    state.register = attemptState.register;
    state.dialogueClosure = attemptState.dialogueClosure;
    state.typedActions = attemptState.typedActions;
    state.comprehension = replayConcurrentComprehensionChanges(
      attemptState.comprehension,
      baseline.comprehension,
      currentComprehension,
    );
    state.directorGuidance = mergeConcurrentTutorStubDirectorGuidance(
      attemptState.directorGuidance,
      baseline.directorGuidance,
      currentDirectorGuidance,
    );
    state.coach = mergeConcurrentCoachChanges(attemptState.coach, baseline.coach, currentCoach);
  }

  function mixedLearnerTutorContextKey({
    learnerText,
    classification,
    tutorLearnerDag,
    registerSelection,
    humanDiscourseFrame,
    dialogueClosureFrame,
    tutorFeedback = null,
    comprehensionState = state.comprehension,
    runtimeState = state,
  }) {
    return mixedLearnerAnalysisCacheKey({
      learnerText,
      history: runtimeState.history,
      classifier: classifierTutorContext(classification),
      learnerDag: tutorLearnerDagModelContext(tutorLearnerDag?.model || tutorLearnerDag, {
        releasedEvidence: committedReleaseRows(runtimeState, runtimeState.turns.length + 1),
      }),
      learnerDagPreflightHash: tutorLearnerDag?.preflight?.contentSha256 || null,
      dagFactDropout: tutorStubDagFactDropoutSnapshot(runtimeState.learnerDag?.dropout),
      releasePacing: tutorStubReleasePacingSnapshot(runtimeState.releasePacing, runtimeState.world),
      register: responseConfigurationContext(registerSelection, {
        world: runtimeState?.world || null,
        multipleChoice: runtimeState.multipleChoice,
        humanDiscourseFrame,
        dialogueClosureFrame,
      }),
      humanDiscourse: humanDiscourseTutorContext(humanDiscourseFrame),
      dialogueClosure: dialogueClosureTutorContext(dialogueClosureFrame),
      comprehension: tutorStubComprehensionPrompt(comprehensionState, {
        turn: runtimeState.turns.length + 1,
      }),
      dagTurn:
        runtimeState.dag && runtimeState.world
          ? dagTurnContext(runtimeState, runtimeState.turns.length + 1, tutorLearnerDag)
          : null,
      coachGuidance: tutorCoachGuidanceContext(runtimeState),
      directorGuidance: tutorStubDirectorGuidancePrompt(runtimeState.directorGuidance, {
        tutorTurn: runtimeState.turns.length + 1,
      }),
      tutorFeedback: tutorFeedback?.supplied ? { rating: tutorFeedback.rating } : null,
      systemPrompt: runtimeState.systemPrompt,
      tutorModel: runtimeState.resolved,
      temperature: runtimeState.temperature,
      maxTokens: runtimeState.maxTokens,
      historyTurns: runtimeState.historyTurns,
      schema: 'mixed-learner-tutor-cache.v1',
    });
  }

  async function startMixedLearnerTutorPrefetch(entry, raw) {
    if (mixedLearner.analysisCache !== entry || isExiting()) return null;
    const prefetchDecision = mixedLearnerTutorPrefetchDecision({
      policy: state.mixedTutorPrefetchPolicy,
      typedActionsEnabled: state.typedActions?.enabled,
    });
    if (!prefetchDecision.enabled) {
      entry.tutorStatus = 'disabled';
      appendTraceEvent(state.trace, {
        type: 'mixed_learner_tutor_prefetch_skipped',
        turn: entry.turn,
        turnId: entry.turnId,
        reason: prefetchDecision.reason,
      });
      return null;
    }
    entry.tutorStatus = 'pending';
    entry.tutorStartedAt = Date.now();
    mixedLearner.cacheStats.tutorStarted += 1;
    try {
      const speculativeState = cloneStateForMixedLearnerSpeculation();
      const classification = classificationFromCombinedAnalysis(raw, speculativeState);
      const discoursePlane = resolveTutorStubDiscoursePlane({ learnerText: entry.answer, classification });
      const update = freezeTutorStubLearnerRecordUpdateForDiscoursePlane({
        update: learnerRecordFromCombinedAnalysis(raw),
        discoursePlane,
      });
      const tutorLearnerDag = applyLearnerRecordUpdate({
        update,
        state: speculativeState,
        tutorTurn: entry.turn,
        learnerText: entry.answer,
        ...learnerPublicEvidenceState(speculativeState, entry.turn),
      });
      tutorLearnerDag.preflight = raw.dagPreflight || null;
      applyLearnerAdvanceAssessment(classification, tutorLearnerDag);
      resolveConversationalCompletionForLearnerTurn({
        learnerText: entry.answer,
        state: speculativeState,
        classification,
        tutorLearnerDag,
      });
      speculativeState.learnerDag.lastModel = tutorLearnerDag.model;
      updateComprehensionForLearnerTurn({
        learnerText: entry.answer,
        state: speculativeState,
        classification,
        tutorTurn: entry.turn,
        recordTrace: false,
      });
      updateReleasePacingForLearnerTurn({
        learnerText: entry.answer,
        state: speculativeState,
        classification,
        tutorLearnerDag,
        tutorTurn: entry.turn,
        recordTrace: false,
      });
      evaluatePendingRegisterEfficacy(speculativeState, tutorLearnerDag, classification);
      let registerSelection = normalizeResponseConfigurationSelection(registerSelectionFromCombinedAnalysis(raw), {
        state: speculativeState,
        classification,
        tutorLearnerDag,
        raw,
        learnerText: entry.answer,
      });
      registerSelection = applyConversationalCompletionForLearnerTurn(
        speculativeState,
        registerSelection,
        tutorLearnerDag?.conversationalCompletion || null,
      );
      const humanDiscourseFrame = buildHumanDiscourseFrame({
        state: speculativeState,
        tutorTurn: entry.turn,
        tutorLearnerDag,
        classification,
        learnerText: entry.answer,
      });
      const { frame: dialogueClosureFrame } = tutorDialogueClosureFrameForTurn({
        state: speculativeState,
        tutorTurn: entry.turn,
        tutorLearnerDag,
      });
      entry.tutorContextKey = mixedLearnerTutorContextKey({
        learnerText: entry.answer,
        classification,
        tutorLearnerDag,
        registerSelection,
        humanDiscourseFrame,
        dialogueClosureFrame,
        comprehensionState: speculativeState.comprehension,
        runtimeState: speculativeState,
      });
      appendTraceEvent(state.trace, {
        type: 'mixed_learner_tutor_prefetch_start',
        turn: entry.turn,
        turnId: entry.turnId,
        requestId: entry.requestId,
        analysisKey: entry.key,
        tutorContextKey: entry.tutorContextKey,
      });
      entry.tutorPromise = callTutor({
        learnerText: entry.answer,
        history: speculativeState.history,
        state: speculativeState,
        systemPrompt: speculativeState.systemPrompt,
        resolved: speculativeState.resolved,
        temperature: speculativeState.temperature,
        maxTokens: speculativeState.maxTokens,
        historyTurns: speculativeState.historyTurns,
        world: speculativeState.world,
        dag: speculativeState.dag,
        classification,
        tutorLearnerDagModel: tutorLearnerDag,
        registerSelection,
        humanDiscourseFrame,
        dialogueClosureFrame,
        trace: state.trace,
        stream: { enabled: false, interim: state.interim },
        cliEffort: speculativeState.cliEffort,
        multipleChoice: speculativeState.multipleChoice,
        roleBase: 'tutor_stub_tutor_prefetch',
        signal: entry.abortController.signal,
      });
      const response = await entry.tutorPromise;
      if (mixedLearner.analysisCache !== entry || isExiting()) return null;
      entry.tutorStatus = 'ready';
      entry.tutorResponse = response;
      appendTraceEvent(state.trace, {
        type: 'mixed_learner_tutor_prefetch_ready',
        turn: entry.turn,
        turnId: entry.turnId,
        requestId: entry.requestId,
        tutorContextKey: entry.tutorContextKey,
        latencyMs: Date.now() - entry.tutorStartedAt,
      });
      return response;
    } catch (err) {
      if (err?.name === 'AbortError') return null;
      if (mixedLearner.analysisCache === entry) {
        entry.tutorStatus = 'error';
        entry.tutorError = err.message;
      }
      mixedLearner.cacheStats.errors += 1;
      appendTraceEvent(state.trace, {
        type: 'mixed_learner_tutor_prefetch_error',
        turn: entry.turn,
        turnId: entry.turnId,
        requestId: entry.requestId,
        error: err.message,
      });
      return null;
    }
  }

  async function takeMixedLearnerTutorPrefetch(
    entry,
    {
      learnerText,
      classification,
      tutorLearnerDag,
      registerSelection,
      humanDiscourseFrame,
      dialogueClosureFrame,
      tutorFeedback = null,
    },
  ) {
    if (!entry || mixedLearner.analysisCache !== entry) return null;
    const liveContextKey = mixedLearnerTutorContextKey({
      learnerText,
      classification,
      tutorLearnerDag,
      registerSelection,
      humanDiscourseFrame,
      dialogueClosureFrame,
      tutorFeedback,
    });
    if (!entry.tutorContextKey || entry.tutorContextKey !== liveContextKey) {
      mixedLearner.cacheStats.tutorMisses += 1;
      appendTraceEvent(state.trace, {
        type: 'mixed_learner_tutor_cache_miss',
        turn: entry.turn,
        turnId: entry.turnId,
        reason: !entry.tutorContextKey ? 'not_prefetched' : 'context_changed',
        cachedKey: entry.tutorContextKey || null,
        liveKey: liveContextKey,
      });
      mixedLearner.analysisCache = null;
      return null;
    }
    const waited = entry.tutorStatus === 'pending';
    if (waited) {
      startInterimAnimation(state, 'awaiting prefetched tutor response', {
        learnerText,
        tutorTurn: entry.turn,
        classification,
        tutorLearnerDag,
        registerSelection,
      });
      await entry.tutorPromise;
      stopInterimAnimation(state);
    }
    if (!entry.tutorResponse || entry.tutorStatus !== 'ready') {
      mixedLearner.cacheStats.tutorMisses += 1;
      appendTraceEvent(state.trace, {
        type: 'mixed_learner_tutor_cache_miss',
        turn: entry.turn,
        turnId: entry.turnId,
        reason: entry.tutorError ? 'prefetch_error' : 'prefetch_unavailable',
        key: liveContextKey,
      });
      mixedLearner.analysisCache = null;
      return null;
    }
    const response = { ...entry.tutorResponse, speculativeCacheHit: true };
    mixedLearner.analysisCache = null;
    mixedLearner.cacheStats.tutorHits += 1;
    appendTraceEvent(state.trace, {
      type: 'mixed_learner_tutor_cache_hit',
      turn: entry.turn,
      turnId: entry.turnId,
      key: liveContextKey,
      waited,
      ageMs: Date.now() - entry.tutorStartedAt,
    });
    return response;
  }

  function startMixedLearnerAnalysisPrefetch({ answer, turnNumber, turnId, requestId }) {
    if (!state.classifier.enabled || !state.learnerDag.enabled || !state.world || !answer) return false;
    const key = currentMixedLearnerAnalysisKey(answer, turnNumber);
    const analysisState = cloneStateForMixedLearnerSpeculation();
    updateComprehensionForLearnerTurn({
      learnerText: answer,
      state: analysisState,
      classification: null,
      tutorTurn: turnNumber,
      recordTrace: false,
    });
    const entry = {
      key,
      answer,
      turn: turnNumber,
      turnId,
      requestId,
      status: 'pending',
      startedAt: Date.now(),
      raw: null,
      error: null,
      promise: null,
      tutorStatus: 'idle',
      tutorContextKey: null,
      tutorPromise: null,
      tutorResponse: null,
      tutorError: null,
      abortController: new AbortController(),
    };
    mixedLearner.analysisCache = entry;
    mixedLearner.cacheStats.analysisStarted += 1;
    appendTraceEvent(state.trace, {
      type: 'mixed_learner_analysis_prefetch_start',
      turn: turnNumber,
      turnId,
      requestId,
      key,
    });
    entry.promise = extractCombinedLearnerAnalysis({
      learnerText: answer,
      state: analysisState,
      tutorTurn: turnNumber,
      role: 'tutor_stub_learner_analysis_prefetch',
      preflightSource: 'mixed_learner_analysis_prefetch',
      stream: { enabled: false, interim: state.interim },
      signal: entry.abortController.signal,
    })
      .then((raw) => {
        if (mixedLearner.analysisCache !== entry) return null;
        entry.status = 'ready';
        entry.raw = raw;
        appendTraceEvent(state.trace, {
          type: 'mixed_learner_analysis_prefetch_ready',
          turn: turnNumber,
          turnId,
          requestId,
          key,
          latencyMs: Date.now() - entry.startedAt,
        });
        void startMixedLearnerTutorPrefetch(entry, raw);
        return raw;
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return null;
        if (mixedLearner.analysisCache === entry) {
          entry.status = 'error';
          entry.error = err.message;
        }
        mixedLearner.cacheStats.errors += 1;
        appendTraceEvent(state.trace, {
          type: 'mixed_learner_analysis_prefetch_error',
          turn: turnNumber,
          turnId,
          requestId,
          key,
          error: err.message,
        });
        return null;
      });
    return true;
  }

  async function takeMixedLearnerAnalysisPrefetch(learnerText, tutorFeedback = null) {
    if (!mixedLearner.enabled) return null;
    const entry = mixedLearner.analysisCache;
    const answer = String(learnerText || '').trim();
    const expectedKey = currentMixedLearnerAnalysisKey(answer, state.turns.length + 1, tutorFeedback);
    if (!entry || entry.answer !== answer || entry.key !== expectedKey) {
      mixedLearner.cacheStats.analysisMisses += 1;
      appendTraceEvent(state.trace, {
        type: 'mixed_learner_analysis_cache_miss',
        turn: state.turns.length + 1,
        reason: !entry ? 'not_prefetched' : entry.answer !== answer ? 'answer_changed' : 'state_changed',
        cachedKey: entry?.key || null,
        submittedKey: expectedKey,
      });
      return null;
    }
    const waited = entry.status === 'pending';
    if (waited) {
      startInterimAnimation(state, 'awaiting prefetched learner analysis', {
        learnerText: answer,
        tutorTurn: state.turns.length + 1,
      });
      await entry.promise;
      stopInterimAnimation(state);
    }
    if (!entry.raw || entry.status !== 'ready') {
      mixedLearner.cacheStats.analysisMisses += 1;
      appendTraceEvent(state.trace, {
        type: 'mixed_learner_analysis_cache_miss',
        turn: entry.turn,
        turnId: entry.turnId,
        reason: entry.error ? 'prefetch_error' : 'prefetch_unavailable',
        key: entry.key,
      });
      return null;
    }
    mixedLearner.cacheStats.analysisHits += 1;
    appendTraceEvent(state.trace, {
      type: 'mixed_learner_analysis_cache_hit',
      turn: entry.turn,
      turnId: entry.turnId,
      key: entry.key,
      waited,
      ageMs: Date.now() - entry.startedAt,
    });
    return { raw: entry.raw, entry };
  }

  function startMixedLearnerPrefetch(reason = 'turn_complete', { force = false, refreshPrompt = true } = {}) {
    if (!mixedLearner.enabled || isExiting() || state.dialogueClosure?.phase === 'closed') return false;
    const turnNumber = state.turns.length + 1;
    const turnId = turnDebugId(state, turnNumber);
    if (!force && (mixedLearner.pending?.turn === turnNumber || mixedLearner.suggestion?.turn === turnNumber)) {
      return false;
    }
    if (force) resetMixedLearnerSuggestion(reason);
    const requestId = mixedLearner.seq + 1;
    mixedLearner.seq = requestId;
    mixedLearner.pending = { requestId, turn: turnNumber, turnId };
    mixedLearner.suggestion = null;
    mixedLearner.error = null;
    const artifactAbortController = new AbortController();
    mixedLearner.artifactAbortController = artifactAbortController;
    appendTraceEvent(state.trace, {
      type: 'mixed_learner_prefetch_start',
      turn: turnNumber,
      turnId,
      requestId,
      reason,
      model: mixedLearner.resolved,
    });
    const prefetchPromise = generateMixedLearnerArtifacts({
      state,
      resolved: mixedLearner.resolved,
      profile: mixedLearner.profile,
      turnNumber,
      cliEffort,
      signal: artifactAbortController.signal,
    })
      .then((generated) => {
        if (mixedLearner.artifactAbortController === artifactAbortController) {
          mixedLearner.artifactAbortController = null;
        }
        const text = String(generated.answer || '').trim();
        const clue = String(generated.clue || '').trim();
        const move = mixedLearnerSuggestionMove(text, generated.move);
        const profileSignal = String(generated.profileSignal || '').trim() || null;
        if (!mixedLearner.enabled || mixedLearner.seq !== requestId || isExiting()) {
          appendTraceEvent(state.trace, {
            type: 'mixed_learner_prefetch_discarded',
            turn: turnNumber,
            turnId,
            requestId,
            reason: isExiting() ? 'exiting' : 'stale',
          });
          return;
        }
        mixedLearner.pending = null;
        const promptSnapshot = generated.promptSnapshot
          ? {
              ...generated.promptSnapshot,
              requestId,
              profileId: mixedLearner.profileId,
            }
          : null;
        if (promptSnapshot) {
          mixedLearner.promptHistory.push(promptSnapshot);
          if (mixedLearner.promptHistory.length > 100) mixedLearner.promptHistory.shift();
        }
        mixedLearner.suggestion = {
          requestId,
          turn: turnNumber,
          turnId,
          text,
          clue: clue || null,
          move,
          profileId: mixedLearner.profileId,
          profile: mixedLearner.profile,
          profileSignal,
          provider: generated.provider,
          model: generated.model,
          latencyMs: generated.latencyMs,
          usage: generated.usage,
          promptSnapshot,
        };
        appendTraceEvent(state.trace, {
          type: 'mixed_learner_suggestion_ready',
          turn: turnNumber,
          turnId,
          requestId,
          text,
          clue: clue || null,
          move,
          profileId: mixedLearner.profileId,
          profileSignal,
          parsedArtifacts: generated.parsedArtifacts,
          provider: generated.provider,
          model: generated.model,
          latencyMs: generated.latencyMs,
          usage: generated.usage,
        });
        const analysisWarming = startMixedLearnerAnalysisPrefetch({
          answer: text,
          turnNumber,
          turnId,
          requestId,
        });
        if (!isProcessingTurn() && !isExiting()) {
          printWithConcurrentTerminal(state, () => {
            clearStatusLine();
            if (consumeMixedLearnerReadyAnnouncement(mixedLearner)) {
              const technicalSuffix = automaticTechnicalDetailsEnabled(state)
                ? ` · ${turnId}${analysisWarming ? ' · learner analysis running' : ''}`
                : '';
              console.log(
                `${C.brightGreen}learner suggestion ready >${C.reset} ${move === 'ask_question' ? 'ask a question' : 'respond'}${technicalSuffix}`,
              );
              console.log(
                `${C.dim}  dark text is a preview · Tab inserts it for editing · /clue guides · /suggest shows · /use sends${C.reset}`,
              );
              printMixedLearnerProfilePresentation(mixedLearner.suggestion);
              appendTraceEvent(state.trace, {
                type: 'mixed_learner_ready_announcement',
                turn: turnNumber,
                turnId,
                profileId: mixedLearner.profileId,
                move,
              });
            }
            if (refreshPrompt && !getConcurrentTerminal().enabled) refreshMixedLearnerPrompt(getReadline());
          });
        }
      })
      .catch((err) => {
        if (mixedLearner.artifactAbortController === artifactAbortController) {
          mixedLearner.artifactAbortController = null;
        }
        if (err?.name === 'AbortError') return;
        if (!mixedLearner.enabled || mixedLearner.seq !== requestId) return;
        mixedLearner.pending = null;
        mixedLearner.error = { turn: turnNumber, turnId, message: err.message };
        appendTraceEvent(state.trace, {
          type: 'mixed_learner_prefetch_error',
          turn: turnNumber,
          turnId,
          requestId,
          error: err.message,
        });
        if (!isProcessingTurn() && !isExiting()) {
          printWithConcurrentTerminal(state, () => {
            clearStatusLine();
            console.log(
              `${C.red}learner suggestion error:${C.reset} ${err.message}${C.dim} · use /regen to retry${C.reset}`,
            );
            if (refreshPrompt && !getConcurrentTerminal().enabled) refreshMixedLearnerPrompt(getReadline());
          });
        }
      });
    return prefetchPromise;
  }

  return {
    cloneStateForInteractiveLearnerAttempt,
    cloneStateForMixedLearnerSpeculation,
    commitInteractiveLearnerAttempt,
    currentMixedLearnerAnalysisKey,
    mixedLearnerTutorContextKey,
    resetMixedLearnerSuggestion,
    startMixedLearnerAnalysisPrefetch,
    startMixedLearnerPrefetch,
    startMixedLearnerTutorPrefetch,
    takeMixedLearnerAnalysisPrefetch,
    takeMixedLearnerTutorPrefetch,
  };
}
