export function createTutorStubTraceRuntime(dependencies = {}) {
  const {
    ROOT,
    advanceTutorStubDialogueClosure,
    answerTermForWorld,
    applyLearnerRecordUpdate,
    auditTutorStubDialogueClosureResponse,
    buildTutorStubDialogueClosureFrame,
    buildTutorStubTurnFailureTraceEvents,
    captureGitProvenanceSummary,
    captureTutorStubRunProvenance,
    formatTurnDebugId,
    fs,
    getSelectedLabModelCallBudget,
    hashCanonicalJson,
    learnerPublicEvidenceState,
    openingDebugId,
    path,
    printTutorStubAutomaticTechnicalDetails,
    printWithConcurrentTerminal,
    program2ProviderBudget,
    redactTraceSecrets,
    replayTutorStubLearnerDagFromTurns,
    resolveWorkspacePath,
    restoreComprehensionState,
    restoreDirectorGuidanceState,
    restoreRegisterStateFromTurns,
    restoreTypedActionState,
    safeTimestampForFile,
    selectedLabModelCallBudget,
    tutorStubTraceDisplayPath,
  } = dependencies;

  function captureTraceProvenance(metadata) {
    // Step 0.2 of PRECONSCIOUS-FINAL-STRETCH-PLAN.md: every run header carries
    // the commit and a hash of the resolved configuration, so model/config
    // drift is detectable from the trace alone (the terra flag-forwarding
    // incident was only caught by cross-checking run_start metadata by hand).
    // Failure-tolerant: an unreadable git state must never block the CLI.
    return captureTutorStubRunProvenance(metadata, { hashCanonicalJson, captureGitProvenanceSummary, repoRoot: ROOT });
  }

  function createTraceState({ enabled, traceDir, metadata }) {
    if (!enabled) return { enabled: false };
    const dir = resolveWorkspacePath(traceDir);
    const runId = safeTimestampForFile();
    const filePath = path.join(dir, `${runId}.jsonl`);
    fs.mkdirSync(dir, { recursive: true });
    const enrichedMetadata = { ...(metadata || {}), provenance: captureTraceProvenance(metadata) };
    const trace = {
      enabled: true,
      dir,
      filePath,
      runId,
      seq: 0,
      metadata: enrichedMetadata,
    };
    appendTraceEvent(trace, {
      type: 'run_start',
      metadata: enrichedMetadata,
    });
    return trace;
  }

  function appendTraceEvent(trace, event) {
    if (!trace?.enabled) return;
    const entry = {
      ts: new Date().toISOString(),
      runId: trace.runId,
      seq: ++trace.seq,
      ...event,
    };
    if (!entry.turnId && entry.turn !== undefined && entry.turn !== null) {
      entry.turnId = formatTurnDebugId(trace.runId, entry.turn);
    } else if (!entry.turnId && entry.type === 'tutor_opening') {
      entry.turnId = openingDebugId(trace.runId);
    }
    fs.appendFileSync(trace.filePath, `${JSON.stringify(redactTraceSecrets(entry))}\n`);
  }

  function appendTutorStubTurnFailureTraceRecords(state, { sealed = false } = {}) {
    if (!state?.trace?.enabled || !state.turns?.length) return [];
    try {
      const events = buildTutorStubTurnFailureTraceEvents({
        runStart: {
          runId: state.trace.runId,
          metadata: state.trace.metadata || {},
        },
        turnRecords: state.turns,
        tracePath: traceDisplayPath(state.trace),
        traceSealed: sealed,
        opening: state.openingRealization?.text || '',
        phase: sealed ? 'sealed' : 'incremental',
        feedbackRecords: state.turnFailureFeedbackRecords || [],
      });
      for (const event of events) appendTraceEvent(state.trace, event);
      return events;
    } catch (error) {
      appendTraceEvent(state.trace, {
        type: 'turn_failure_recording_error',
        phase: sealed ? 'sealed' : 'incremental',
        turn: state.turns.at(-1)?.turn ?? null,
        error: String(error?.message || error),
        publicTranscriptChanged: false,
      });
      return [];
    }
  }

  function reserveTutorStubMeteredModelCall({ trace = null, role = 'unknown', turn = null } = {}) {
    const modelCallBudget = getSelectedLabModelCallBudget?.() ?? selectedLabModelCallBudget;
    if (!modelCallBudget) return null;
    try {
      const reservation = modelCallBudget.reserve({ role, turn });
      appendTraceEvent(trace, {
        type: 'model_call_budget_reserved',
        role,
        turn,
        admission: reservation,
      });
      return reservation;
    } catch (error) {
      appendTraceEvent(trace, {
        type: 'model_call_budget_exhausted',
        role,
        turn,
        admission: modelCallBudget.snapshot(),
      });
      throw error;
    }
  }

  function reserveProgram2ProviderBudget({ maxTokens, trace = null, role = 'unknown', turn = null } = {}) {
    if (!program2ProviderBudget) return null;
    try {
      const reservation = program2ProviderBudget.reserve({ maxTokens });
      appendTraceEvent(trace, { type: 'program2_provider_budget_reserved', role, turn, ...reservation });
      return reservation;
    } catch (error) {
      appendTraceEvent(trace, {
        type: 'program2_provider_budget_denied',
        role,
        turn,
        requestedOutputTokens: Math.max(0, Number(maxTokens || 0)),
        ...program2ProviderBudget.snapshot(),
      });
      throw error;
    }
  }

  function printAutomaticTechnicalDetails(state, render) {
    return printTutorStubAutomaticTechnicalDetails(state, render, { print: printWithConcurrentTerminal });
  }

  function traceDisplayPath(trace) {
    return tutorStubTraceDisplayPath(trace, { relativePath: path.relative, repoRoot: ROOT });
  }

  function jsonClone(value) {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value));
  }

  function restoreDialogueFromTrace(state, resume, { currentWorld, restoreOpening = false }) {
    if (!resume?.turns?.length) return null;
    const turns = resume.turns.map((turn) => jsonClone(turn));
    state.turns = turns;
    state.history = [];
    if (restoreOpening) {
      const lastClearIndex = (resume.events || []).reduce(
        (index, event, candidate) => (event?.type === 'history_clear' ? candidate : index),
        -1,
      );
      const activeEvents = (resume.events || []).slice(lastClearIndex + 1);
      const opening = activeEvents.find(
        (event) => event?.type === 'tutor_opening' && typeof event.text === 'string' && event.text.trim(),
      );
      const openingRestatement = [...activeEvents]
        .reverse()
        .find(
          (event) =>
            event?.type === 'tutor_character_restatement_completed' &&
            event?.target?.targetKind === 'opening' &&
            typeof event.text === 'string' &&
            event.text.trim(),
        );
      if (opening) {
        state.history.push({ role: 'assistant', content: openingRestatement?.text || opening.text });
        if (openingRestatement) {
          state.openingRealization = {
            schema: 'machinespirits.tutor-stub.resumed-character-restated-opening.v1',
            originalText: opening.text,
            text: openingRestatement.text,
            characterRestatements: [jsonClone(openingRestatement)],
            source: 'resume_trace',
          };
        }
      }
    }
    for (const turn of turns) {
      if (turn.learner) state.history.push({ role: 'user', content: turn.learner });
      if (turn.tutor) state.history.push({ role: 'assistant', content: turn.tutor });
    }

    const register = restoreRegisterStateFromTurns(state, turns);
    const comprehension = restoreComprehensionState(state, turns, resume.events || []);
    const directorGuidance = restoreDirectorGuidanceState(state, resume.events || []);
    const learnerDag = replayTutorStubLearnerDagFromTurns(state, turns, {
      applyLearnerRecordUpdate,
      learnerPublicEvidenceState,
    });
    const typedActions = restoreTypedActionState(state, turns, resume.events || []);
    const storedClosure = turns.at(-1)?.dialogueClosure?.lifecycle || null;
    if (storedClosure && state.dialogueClosure?.enabled) {
      state.dialogueClosure = {
        ...state.dialogueClosure,
        ...jsonClone(storedClosure),
        enabled: true,
        allowCheckIn: state.dialogueClosure.allowCheckIn,
        allowAuthoredDagClosure: state.dialogueClosure.allowAuthoredDagClosure,
      };
    } else if (state.dialogueClosure?.enabled && turns.length) {
      const last = turns.at(-1);
      const frame = buildTutorStubDialogueClosureFrame({
        lifecycle: state.dialogueClosure,
        learnerDagModel: last?.tutorLearnerDagModel || null,
        tutorDagSnapshot: last?.tutorDag || null,
        answerTerm: answerTermForWorld(state.world),
      });
      const audit = auditTutorStubDialogueClosureResponse({ text: last?.tutor || '', frame });
      if (audit.ok && audit.closesDialogue) {
        state.dialogueClosure = advanceTutorStubDialogueClosure(state.dialogueClosure, {
          frame,
          audit,
          turn: last.turn,
        });
      } else if (audit.closesDialogue && state.dialogueClosure.allowCheckIn) {
        state.dialogueClosure = {
          ...state.dialogueClosure,
          phase: 'awaiting_checkin',
          reachedAtTurn: Number(last.turn) || null,
          basis: frame.basis || 'legacy_conversational_closure',
        };
      }
    }
    const warnings = [];
    const resumedWorld = resume.metadata?.world?.id || null;
    if (resumedWorld && currentWorld?.id && resumedWorld !== currentWorld.id) {
      warnings.push(`trace world ${resumedWorld} differs from current world ${currentWorld.id}`);
    }
    return {
      source: resume.filePath,
      turns: turns.length,
      register,
      comprehension,
      directorGuidance,
      learnerDag,
      typedActions,
      dialogueClosure: state.dialogueClosure,
      metadata: resume.metadata || null,
      warnings,
    };
  }

  return {
    appendTraceEvent,
    appendTutorStubTurnFailureTraceRecords,
    createTraceState,
    jsonClone,
    printAutomaticTechnicalDetails,
    reserveProgram2ProviderBudget,
    reserveTutorStubMeteredModelCall,
    restoreDialogueFromTrace,
    traceDisplayPath,
  };
}
