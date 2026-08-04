export function createTutorStubInteractiveTurnController(dependencies) {
  const {
    C,
    aggregateTutorStubLearnerResponseProvenance,
    analyzeLearnerTurn,
    appendTraceEvent,
    assertTutorStubTurnAttemptCurrent,
    auditTutorStubDialogueClosureResponse,
    automaticTechnicalDetailsEnabled,
    buildHumanDiscourseFrame,
    buildTutorInterimContext,
    clearStatusLine,
    cloneStateForInteractiveLearnerAttempt,
    commitInteractiveLearnerAttempt,
    commitTutorStubTurnFeedback,
    createTutorStubLearnerResponseProvenance,
    deterministicTutorStubClosureResponse,
    discardPendingInteractiveAuto,
    getActiveAutoRun,
    getActiveLearnerTurn,
    getPendingAutoRequest,
    isExiting,
    isProcessingTurn,
    jsonClone,
    mixedLearner,
    offerAnotherScenario,
    pauseInterimAnimation,
    pendingLearnerLines,
    printDirectorPreludeBeforeFirstTutor,
    printExplanatoryDebugTurn,
    printResponseDetails,
    printTurnDebugLine,
    printTutorDagSnapshot,
    printTutorFeedbackRequest,
    printTutorResponse,
    printWithConcurrentTerminal,
    promptIfIdle,
    publishAcceptedTutorToVoice,
    queueCoachGuidance,
    recordTutorStubCurriculumEvidence,
    resetMixedLearnerSuggestion,
    resumeInterimAnimation,
    runOneTurn,
    sessionRuntime,
    setActiveLearnerTurn,
    setProcessingTurn,
    startInterimAnimation,
    startMixedLearnerPrefetch,
    startPendingInteractiveAuto,
    state,
    stopInterimAnimation,
    takeMixedLearnerAnalysisPrefetch,
    takeMixedLearnerTutorPrefetch,
    turnDebugId,
    tutorDialogueClosureFrameForTurn,
    tutorStubClosureAcknowledgement,
    tutorStubTurnFeedbackEnvelope,
    writeFieldVisualization,
  } = dependencies;

  function humanLearnerResponseProvenance(source = 'terminal') {
    return createTutorStubLearnerResponseProvenance({
      authorship: 'human',
      origin: source === 'voice' ? 'human_voice' : 'human_direct',
      inputMethod: source === 'voice' ? 'voice_transcription' : 'terminal',
      humanInLoop: true,
    });
  }

  function mixedDraftLearnerResponseProvenance(insertion, submittedText) {
    if (!insertion?.suggestion) return null;
    const suggestion = insertion.suggestion;
    const acceptedUnchanged = String(submittedText || '').trim() === String(suggestion.text || '').trim();
    return createTutorStubLearnerResponseProvenance({
      authorship: acceptedUnchanged ? 'ai' : 'hybrid',
      origin: acceptedUnchanged ? 'mixed_suggestion_accepted' : 'mixed_suggestion_edited',
      inputMethod: acceptedUnchanged ? 'tab_completion' : 'tab_completion_then_edit',
      humanInLoop: true,
      modelRef: state.autoLearner?.modelRef || null,
      provider: suggestion.provider || mixedLearner.resolved?.provider || null,
      model: suggestion.model || mixedLearner.resolved?.model || null,
      learnerProfileId: suggestion.profileId || mixedLearner.profileId || null,
      suggestion: {
        requestId: suggestion.requestId,
        turn: suggestion.turn,
        turnId: suggestion.turnId,
        acceptedUnchanged,
        edited: !acceptedUnchanged,
      },
    });
  }

  function compoundLearnerInput(active, revision = active.revision) {
    const messages = active.fragments.map((fragment, index) => ({
      index: index + 1,
      text: fragment.text,
      receivedAt: fragment.receivedAt,
      provenance: jsonClone(fragment.provenance),
      tutorFeedback: jsonClone(active.tutorFeedback),
    }));
    const provenance = aggregateTutorStubLearnerResponseProvenance(messages.map((message) => message.provenance));
    return {
      schema: 'machinespirits.tutor-stub.compound-learner-turn.v1',
      compoundTurnId: active.id,
      turn: active.turn,
      turnId: active.turnId,
      revision,
      messageCount: messages.length,
      messages,
      tutorFeedback: jsonClone(active.tutorFeedback),
      combinedText: messages.map((message) => message.text).join('\n'),
      coalescedBeforeTutorReply: messages.length > 1,
      provenance,
    };
  }

  function extendActiveLearnerTurn(text, provenance = humanLearnerResponseProvenance()) {
    const active = getActiveLearnerTurn();
    if (!active || active.responseDisplayed || active.committed) return false;
    const previousRevision = active.revision;
    const receivedAt = new Date().toISOString();
    active.fragments.push({ text, receivedAt, provenance: jsonClone(provenance) });
    active.revision += 1;
    resetMixedLearnerSuggestion('learner_turn_extended');
    appendTraceEvent(state.trace, {
      type: 'learner_turn_fragment_received',
      schema: 'machinespirits.tutor-stub.compound-learner-turn.v1',
      turn: active.turn,
      turnId: active.turnId,
      compoundTurnId: active.id,
      fragmentIndex: active.fragments.length,
      revision: active.revision,
      text,
      receivedAt,
      learnerResponseProvenance: jsonClone(provenance),
      tutorFeedback: jsonClone(active.tutorFeedback),
      whileTutorPending: true,
      publicTranscriptStatus: 'pending_compound_turn',
    });
    appendTraceEvent(state.trace, {
      type: 'learner_turn_attempt_superseded',
      turn: active.turn,
      turnId: active.turnId,
      compoundTurnId: active.id,
      previousRevision,
      revision: active.revision,
      messageCount: active.fragments.length,
      reason: 'additional_learner_message_before_tutor_reply',
    });
    active.abortController?.abort();
    console.log(
      `${C.cyan}learner turn updated >${C.reset} added message ${active.fragments.length}; restarting the tutor with all ${active.fragments.length} messages`,
    );
    console.log(`${C.dim}  the messages stay separate in the trace and count as one learner turn${C.reset}\n`);
    return true;
  }

  async function processLearnerLine(
    initialText,
    provenance = humanLearnerResponseProvenance(),
    { throwOnError = false } = {},
  ) {
    if (isExiting()) return;
    if (state.dialogueClosure?.phase === 'closed') {
      offerAnotherScenario('dialogue_grounded_closure');
      return;
    }

    const tutorTurn = state.turns.length + 1;
    const turnId = turnDebugId(state, tutorTurn);
    const active = {
      id: `${turnId}:learner`,
      turn: tutorTurn,
      turnId,
      revision: 1,
      fragments: [{ text: initialText, receivedAt: new Date().toISOString(), provenance: jsonClone(provenance) }],
      tutorFeedback: tutorStubTurnFeedbackEnvelope(state.turnFeedback),
      abortController: null,
      responseDisplayed: false,
      committed: false,
    };
    setActiveLearnerTurn(active);
    setProcessingTurn(true);
    let completedTurn = false;
    let committedTurn = null;
    appendTraceEvent(state.trace, {
      type: 'learner_turn_fragment_received',
      schema: 'machinespirits.tutor-stub.compound-learner-turn.v1',
      turn: tutorTurn,
      turnId,
      compoundTurnId: active.id,
      fragmentIndex: 1,
      revision: 1,
      text: initialText,
      receivedAt: active.fragments[0].receivedAt,
      learnerResponseProvenance: jsonClone(provenance),
      tutorFeedback: jsonClone(active.tutorFeedback),
      whileTutorPending: false,
      publicTranscriptStatus: 'pending_compound_turn',
    });

    try {
      while (!isExiting() && !completedTurn && getActiveLearnerTurn() === active) {
        const learnerInput = compoundLearnerInput(active);
        const revision = learnerInput.revision;
        const learnerText = learnerInput.combinedText;
        const abortController = new AbortController();
        active.abortController = abortController;
        const isCurrent = () =>
          !isExiting() &&
          getActiveLearnerTurn() === active &&
          active.revision === revision &&
          !abortController.signal.aborted;
        const attemptState = cloneStateForInteractiveLearnerAttempt();
        const baseline = {
          comprehension: structuredClone(state.comprehension),
          directorGuidance: structuredClone(state.directorGuidance),
          coach: structuredClone(state.coach),
        };
        const startedAtMs = Date.now();
        const turnTiming = {
          startedAtMs,
          analysisStartedAtMs: startedAtMs,
          analysisCompletedAtMs: startedAtMs,
          tutorStartedAtMs: startedAtMs,
          analysisSource: 'disabled',
          tutorSource: 'foreground',
        };
        appendTraceEvent(state.trace, {
          type: 'learner_turn_attempt_started',
          turn: tutorTurn,
          turnId,
          compoundTurnId: active.id,
          revision,
          messageCount: learnerInput.messageCount,
          messages: learnerInput.messages,
          learnerResponseProvenance: learnerInput.provenance,
        });

        try {
          const closureAcknowledgement = Boolean(
            attemptState.dialogueClosure?.phase === 'awaiting_checkin' && tutorStubClosureAcknowledgement(learnerText),
          );
          if (!closureAcknowledgement && !attemptState.passthrough?.enabled) {
            turnTiming.analysisStartedAtMs = Date.now();
          }
          const prefetchedAnalysis =
            closureAcknowledgement || attemptState.passthrough?.enabled
              ? null
              : await takeMixedLearnerAnalysisPrefetch(learnerText, learnerInput.tutorFeedback);
          assertTutorStubTurnAttemptCurrent({ signal: abortController.signal, isCurrent });
          resetMixedLearnerSuggestion('learner_turn_started', {
            preserveAnalysisCache: Boolean(prefetchedAnalysis?.entry),
          });

          let response;
          let completionReason = 'turn_complete';
          if (attemptState.passthrough?.enabled) {
            turnTiming.tutorStartedAtMs = Date.now();
            startInterimAnimation(attemptState, 'calling speaker', { learnerText, tutorTurn });
            try {
              response = await runOneTurn(learnerText, attemptState, null, null, null, null, null, {
                signal: abortController.signal,
                isCurrent,
                learnerInput,
                turnTiming,
              });
            } finally {
              stopInterimAnimation(attemptState);
            }
            completionReason = 'passthrough_turn_complete';
          } else if (closureAcknowledgement) {
            turnTiming.analysisSource = 'deterministic';
            turnTiming.analysisCompletedAtMs = Date.now();
            turnTiming.tutorStartedAtMs = Date.now();
            turnTiming.tutorSource = 'deterministic';
            const inheritedModel = attemptState.turns.at(-1)?.tutorLearnerDagModel || null;
            const tutorLearnerDag = { model: inheritedModel };
            const { frame } = tutorDialogueClosureFrameForTurn({
              state: attemptState,
              tutorTurn,
              tutorLearnerDag,
            });
            const text = deterministicTutorStubClosureResponse(frame, { acknowledgement: true });
            const closureAudit = auditTutorStubDialogueClosureResponse({ text, frame });
            printWithConcurrentTerminal(state, () => printTurnDebugLine(state, tutorTurn));
            response = await runOneTurn(
              learnerText,
              attemptState,
              {
                turn: {
                  summary: 'Learner declines the optional final check-in.',
                  request_type: 'off_task_or_mixed',
                  discourse_move: 'claim',
                  evidence_use: 'none',
                  epistemic_stance: 'grounded',
                  affect: 'settled',
                  agency: 'steering',
                  scores: {},
                  pedagogical_need: 'Close the inquiry without another question.',
                },
                overall: {
                  summary: 'The learner accepts dialogue closure.',
                  trajectory: 'terminal closure',
                  current_state: 'settled',
                  next_best_tutor_move: 'Close the inquiry.',
                },
              },
              tutorLearnerDag,
              null,
              null,
              {
                text,
                provider: attemptState.resolved.provider,
                model: attemptState.resolved.model,
                latencyMs: 0,
                usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, cost: 0 },
                leakAudit: { ok: true, leaks: [] },
                scaffoldAudit: { ok: true, issues: [], similarity: 0 },
                closureAudit,
                deterministicClosure: true,
              },
              { signal: abortController.signal, isCurrent, learnerInput, turnTiming },
            );
            completionReason = 'dialogue_closure_acknowledgement';
          } else {
            const { classification, tutorLearnerDag, registerSelection, previousRegisterEfficacy } =
              await analyzeLearnerTurn(learnerText, attemptState, {
                precomputedRaw: prefetchedAnalysis?.raw || null,
                signal: abortController.signal,
                isCurrent,
                tutorFeedback: learnerInput.tutorFeedback,
              });
            turnTiming.analysisCompletedAtMs = Date.now();
            turnTiming.analysisSource = prefetchedAnalysis?.entry ? 'prefetched' : 'foreground';
            assertTutorStubTurnAttemptCurrent({ signal: abortController.signal, isCurrent });
            const humanDiscourseFrame = buildHumanDiscourseFrame({
              state: attemptState,
              tutorTurn,
              tutorLearnerDag,
              classification,
              learnerText,
            });
            const { frame: dialogueClosureFrame } = tutorDialogueClosureFrameForTurn({
              state: attemptState,
              tutorTurn,
              tutorLearnerDag,
            });
            turnTiming.tutorStartedAtMs = Date.now();
            const prefetchedResponse = await takeMixedLearnerTutorPrefetch(prefetchedAnalysis?.entry, {
              learnerText,
              classification,
              tutorLearnerDag,
              registerSelection,
              humanDiscourseFrame,
              dialogueClosureFrame,
              tutorFeedback: learnerInput.tutorFeedback,
            });
            turnTiming.tutorSource = prefetchedResponse ? 'prefetched' : 'foreground';
            assertTutorStubTurnAttemptCurrent({ signal: abortController.signal, isCurrent });
            if (!prefetchedResponse) {
              startInterimAnimation(
                attemptState,
                'calling tutor',
                buildTutorInterimContext({
                  learnerText,
                  state: attemptState,
                  classification,
                  tutorLearnerDag,
                  registerSelection,
                  previousRegisterEfficacy,
                }),
              );
            }
            try {
              response = await runOneTurn(
                learnerText,
                attemptState,
                classification,
                tutorLearnerDag,
                registerSelection,
                previousRegisterEfficacy,
                prefetchedResponse,
                { signal: abortController.signal, isCurrent, learnerInput, turnTiming },
              );
            } finally {
              stopInterimAnimation(attemptState);
            }
          }

          assertTutorStubTurnAttemptCurrent({ signal: abortController.signal, isCurrent });
          commitInteractiveLearnerAttempt(attemptState, baseline);
          const committedTutorFeedback = commitTutorStubTurnFeedback(state.turnFeedback, {
            learnerTurn: tutorTurn,
            learnerTurnId: turnId,
          });
          active.committed = true;
          active.responseDisplayed = true;
          appendTraceEvent(state.trace, {
            type: 'learner_turn_compound_committed',
            schema: learnerInput.schema,
            turn: tutorTurn,
            turnId,
            compoundTurnId: active.id,
            revision,
            messageCount: learnerInput.messageCount,
            messages: learnerInput.messages,
            combinedText: learnerInput.combinedText,
            tutorFeedback: learnerInput.tutorFeedback,
            learnerResponseProvenance: learnerInput.provenance,
          });
          if (state.curriculum?.runtime) {
            recordTutorStubCurriculumEvidence(state.curriculum.runtime, {
              text: learnerInput.combinedText,
              turnId,
            });
            appendTraceEvent(state.trace, {
              type: 'curriculum_phase_evidence_recorded',
              schema: 'machinespirits.tutor-stub.curriculum-progression.v1',
              moduleId: state.curriculum.runtime.currentModuleId,
              phase: state.curriculum.runtime.currentPhase,
              turn: tutorTurn,
              turnId,
              source: 'public_learner_turn',
              publicTranscriptChanged: false,
              externalCompletionInferred: false,
            });
          }
          appendTraceEvent(state.trace, {
            type: 'learner_turn_tutor_feedback_committed',
            turn: tutorTurn,
            turnId,
            compoundTurnId: active.id,
            feedback: committedTutorFeedback,
            publicTranscriptChanged: false,
          });
          printWithConcurrentTerminal(state, () => {
            if (automaticTechnicalDetailsEnabled(state)) printTutorDagSnapshot(response.dagSnapshot);
            printResponseDetails(response, state);
            if (!state.passthrough?.enabled) {
              printDirectorPreludeBeforeFirstTutor(state, {
                reason: closureAcknowledgement
                  ? 'closure_response_without_opening'
                  : 'generated_response_without_opening',
              });
            }
            printTutorResponse(response, state.stream);
            printTutorFeedbackRequest({ tutorTurn, tutorTurnId: turnId, kind: 'tutor_response' });
          });
          publishAcceptedTutorToVoice({
            text: response.text,
            turn: tutorTurn,
            turnId,
            response,
            reason: 'accepted_guarded_tutor_response',
          });
          await printExplanatoryDebugTurn(state, { signal: abortController.signal, isCurrent });
          if (state.dialogueClosure?.phase === 'awaiting_checkin') {
            printWithConcurrentTerminal(state, () => {
              console.log(
                `${C.cyan}dialogue closing >${C.reset} the verdict has reached closure; one optional learner check-in remains`,
              );
              console.log(
                `${C.dim}  reply once to revisit a link, or say “no thanks” to close immediately${C.reset}\n`,
              );
            });
          }
          writeFieldVisualization(state, { reason: completionReason });
          completedTurn = true;
          committedTurn = {
            turn: tutorTurn,
            turnId,
            learner: learnerInput.combinedText,
            tutor: response.text,
            provider: response.provider || state.resolved?.provider || null,
            model: response.model || state.resolved?.model || null,
            completionReason,
          };
          if (sessionRuntime.status === 'active') sessionRuntime.sync('learner_turn_committed');
        } catch (err) {
          stopInterimAnimation(attemptState);
          if (err?.name === 'AbortError' && getActiveLearnerTurn() !== active) {
            appendTraceEvent(state.trace, {
              type: 'learner_turn_attempt_discarded',
              turn: tutorTurn,
              turnId,
              compoundTurnId: active.id,
              revision,
              reason: active.cancelledReason || 'learner_turn_cancelled',
              error: null,
            });
            break;
          }
          if (active.revision !== revision) {
            appendTraceEvent(state.trace, {
              type: 'learner_turn_attempt_discarded',
              turn: tutorTurn,
              turnId,
              compoundTurnId: active.id,
              revision,
              replacedByRevision: active.revision,
              reason: 'additional_learner_message_before_tutor_reply',
              error: err?.name === 'AbortError' ? null : err.message,
            });
            continue;
          }
          if (isExiting() && err?.name === 'AbortError') break;
          throw err;
        } finally {
          if (active.abortController === abortController) active.abortController = null;
        }
      }
    } catch (err) {
      stopInterimAnimation(state);
      if (throwOnError) throw err;
      printWithConcurrentTerminal(state, () => {
        clearStatusLine();
        console.error(`${C.red}error:${C.reset} ${err.message}\n`);
      });
    } finally {
      const ownsActiveTurn = getActiveLearnerTurn() === active;
      if (ownsActiveTurn) setActiveLearnerTurn(null);
      if (!getActiveLearnerTurn() && !getActiveAutoRun()) setProcessingTurn(false);
      if (!isExiting() && ownsActiveTurn && !active.cancelledReason) {
        if (state.dialogueClosure?.phase === 'closed') {
          discardPendingInteractiveAuto('dialogue_closed', { source: 'turn_completion', announce: true });
          offerAnotherScenario('dialogue_grounded_closure');
        } else if (completedTurn && startPendingInteractiveAuto({ afterTurn: tutorTurn })) {
          // The deferred automation owns the next learner turn, so do not warm
          // or display a mixed-mode draft for the now-superseded manual prompt.
        } else {
          if (!completedTurn) {
            discardPendingInteractiveAuto('tutor_turn_failed', { source: 'turn_completion', announce: true });
          }
          const next = pendingLearnerLines.shift();
          if (next) {
            printWithConcurrentTerminal(state, () =>
              console.log(`${C.dim}running queued learner turn (${pendingLearnerLines.length} still queued)${C.reset}`),
            );
            void processLearnerLine(next.text, next.provenance);
          } else {
            if (completedTurn) startMixedLearnerPrefetch('turn_complete');
            promptIfIdle();
          }
        }
      }
    }
    return committedTurn;
  }

  function routeLearnerText(text, { source = 'terminal', provenance = null, awaitCompletion = false } = {}) {
    const trimmed = String(text || '').trim();
    if (!trimmed || isExiting()) return { accepted: false, reason: 'empty_or_exiting' };
    const interactionMode = state.interaction?.mode || 'learner';
    const learnerResponseProvenance =
      interactionMode === 'learner'
        ? provenance || humanLearnerResponseProvenance(source === 'voice' ? 'voice' : 'terminal')
        : null;
    appendTraceEvent(state.trace, {
      type: 'learner_input_routed',
      source,
      text: trimmed,
      duringTurn: isProcessingTurn(),
      interactionMode,
      ...(learnerResponseProvenance ? { learnerResponseProvenance } : {}),
      publicTranscriptStatus: 'pending_compound_turn',
    });
    if (interactionMode === 'coach') {
      const pausedInterim = isProcessingTurn() ? pauseInterimAnimation(state) : false;
      queueCoachGuidance(trimmed, { duringTurn: isProcessingTurn() });
      if (pausedInterim) resumeInterimAnimation(state);
      return { accepted: true, route: 'coach_guidance' };
    }
    if (isProcessingTurn() && interactionMode === 'auto') {
      console.log(`${C.dim}automation is running; enter a slash command, or wait for learner mode to resume${C.reset}`);
      appendTraceEvent(state.trace, {
        type: 'auto_mode_non_command_ignored',
        text: trimmed,
        turn: state.turns.length + 1,
        source,
      });
      return { accepted: false, reason: 'auto_mode_running' };
    }
    if (isProcessingTurn() && getPendingAutoRequest()) {
      console.log(
        `${C.dim}auto handoff is queued; enter a slash command, use /mode learner to cancel it, or wait for automation${C.reset}`,
      );
      appendTraceEvent(state.trace, {
        type: 'auto_queue_non_command_ignored',
        requestId: getPendingAutoRequest().id,
        text: trimmed,
        turn: state.turns.length + 1,
        source,
      });
      return { accepted: false, reason: 'auto_mode_queued' };
    }
    if (isProcessingTurn()) {
      const pausedInterim = pauseInterimAnimation(state);
      if (extendActiveLearnerTurn(trimmed, learnerResponseProvenance)) {
        if (pausedInterim) resumeInterimAnimation(state);
        return { accepted: true, route: 'compound_learner_turn' };
      }
      pendingLearnerLines.push({ text: trimmed, provenance: learnerResponseProvenance });
      console.log(
        `${C.dim}queued next learner turn (${pendingLearnerLines.length} queued); use /analysis, /transcript, /field, /viz, or /clarify while waiting${C.reset}`,
      );
      appendTraceEvent(state.trace, {
        type: 'learner_turn_queued',
        queued: pendingLearnerLines.length,
        reason: 'previous_tutor_response_already_displayed',
        source,
        learnerResponseProvenance,
      });
      if (pausedInterim) resumeInterimAnimation(state);
      return { accepted: true, route: 'next_learner_turn_queue' };
    }
    const pendingTurn = processLearnerLine(trimmed, learnerResponseProvenance, { throwOnError: awaitCompletion });
    if (awaitCompletion) {
      return pendingTurn.then((turn) => ({ accepted: true, route: 'new_learner_turn', turn }));
    }
    void pendingTurn;
    return { accepted: true, route: 'new_learner_turn' };
  }

  return {
    extendActiveLearnerTurn,
    humanLearnerResponseProvenance,
    mixedDraftLearnerResponseProvenance,
    processLearnerLine,
    routeLearnerText,
  };
}
