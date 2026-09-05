import {
  createTutorStubArtifactArchiveMirror as createArtifactArchiveMirror,
  normalizeTutorStubArtifactArchivePolicy,
} from './tutorStubArtifactArchive.js';
import { sharedModelAttemptLedgerClientFromEnv } from './durableAttemptJournal.js';

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
    createTutorStubArtifactArchiveMirror = createArtifactArchiveMirror,
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

  function createTraceState({ enabled, traceDir, metadata, artifactArchivePolicy = 'off' }) {
    const normalizedArchivePolicy = normalizeTutorStubArtifactArchivePolicy(artifactArchivePolicy);
    if (!enabled) {
      if (normalizedArchivePolicy === 'required') {
        throw new Error('required tutor-stub artifact archival cannot be used with tracing disabled');
      }
      return { enabled: false };
    }
    const dir = resolveWorkspacePath(traceDir);
    const runId = safeTimestampForFile();
    const assetId = `tutor-stub-trace:${runId}`;
    const filePath = path.join(dir, `${runId}.jsonl`);
    fs.mkdirSync(dir, { recursive: true });
    const enrichedMetadata = {
      ...(metadata || {}),
      sourceAssetId: assetId,
      provenance: captureTraceProvenance(metadata),
    };
    const trace = {
      enabled: true,
      dir,
      filePath,
      runId,
      assetId,
      seq: 0,
      metadata: enrichedMetadata,
      meteredAttempts: [],
      sharedAttemptLedger: sharedModelAttemptLedgerClientFromEnv(),
    };
    trace.artifactArchive = createTutorStubArtifactArchiveMirror({
      policy: normalizedArchivePolicy,
      sourceTracePath: filePath,
      repoRoot: ROOT || process.cwd(),
      metadata: enrichedMetadata,
    });
    trace.metadata.artifactArchive = trace.artifactArchive.snapshot();
    appendTraceEvent(trace, {
      type: 'run_start',
      metadata: enrichedMetadata,
    });
    return trace;
  }

  function appendTraceEvent(trace, event) {
    if (!trace?.enabled) return;
    const enrichedEvent = { ...event };
    if (event.type === 'model_call_budget_reserved' && event.admission?.call) {
      enrichedEvent.attemptId =
        event.attemptId ||
        event.sharedAttemptReservation?.attemptId ||
        `${trace.runId}:model-attempt:${event.admission.call}`;
      trace.meteredAttempts ||= [];
      trace.meteredAttempts.push({
        attemptId: enrichedEvent.attemptId,
        role: event.role,
        turn: event.turn,
        dispatched: false,
        terminal: false,
      });
    } else if (event.type === 'model_call_dispatch_started' && event.attemptId) {
      const attempt = trace.meteredAttempts?.find((candidate) => candidate.attemptId === event.attemptId);
      if (attempt) attempt.dispatched = true;
    } else if (['model_call', 'model_call_error', 'model_call_aborted'].includes(event.type)) {
      const attempt = trace.meteredAttempts?.find(
        (candidate) =>
          !candidate.terminal && candidate.dispatched && candidate.role === event.role && candidate.turn === event.turn,
      );
      if (attempt) {
        attempt.terminal = true;
        enrichedEvent.attemptId = attempt.attemptId;
        enrichedEvent.attemptDisposition = event.type === 'model_call' ? 'completed' : 'failed';
      }
    }
    const entry = {
      ts: new Date().toISOString(),
      runId: trace.runId,
      seq: ++trace.seq,
      ...enrichedEvent,
    };
    if (!entry.turnId && entry.turn !== undefined && entry.turn !== null) {
      entry.turnId = formatTurnDebugId(trace.runId, entry.turn);
    } else if (!entry.turnId && entry.type === 'tutor_opening') {
      entry.turnId = openingDebugId(trace.runId);
    }
    const line = `${JSON.stringify(redactTraceSecrets(entry))}\n`;
    try {
      trace.artifactArchive?.append(line, entry);
    } catch (error) {
      // Keep the local recovery copy even when required durable storage fails.
      fs.appendFileSync(trace.filePath, line);
      throw error;
    }
    const descriptor = fs.openSync(trace.filePath, 'a');
    try {
      fs.writeSync(descriptor, line);
      if (
        [
          'model_call_budget_reserved',
          'model_call_dispatch_started',
          'model_call',
          'model_call_error',
          'model_call_aborted',
          'turn_complete',
          'run_end',
        ].includes(entry.type)
      ) {
        fs.fsyncSync(descriptor);
      }
    } finally {
      fs.closeSync(descriptor);
    }
    if (enrichedEvent.attemptDisposition && enrichedEvent.attemptId && trace.sharedAttemptLedger) {
      if (enrichedEvent.attemptDisposition === 'completed') {
        // The shared ledger refuses to close an attempt as completed until the
        // response is on disk inside the run directory (durableAttemptJournal).
        // Write the redacted model_call record there and register it first.
        trace.sharedAttemptLedger.persistResponse({
          attemptId: enrichedEvent.attemptId,
          responsePath: writeSharedAttemptResponse(trace, entry),
          role: enrichedEvent.role,
          turn: enrichedEvent.turn,
        });
      }
      trace.sharedAttemptLedger.terminalize({
        attemptId: enrichedEvent.attemptId,
        disposition: enrichedEvent.attemptDisposition,
        role: enrichedEvent.role,
        turn: enrichedEvent.turn,
        traceSequence: entry.seq,
      });
    }
  }

  function writeSharedAttemptResponse(trace, entry) {
    const responseDir = path.join(trace.dir, 'attempt-responses');
    fs.mkdirSync(responseDir, { recursive: true });
    const fileName = `${String(entry.attemptId).replace(/[^A-Za-z0-9._-]+/gu, '_')}.json`;
    const responsePath = path.resolve(responseDir, fileName);
    const descriptor = fs.openSync(responsePath, 'w');
    try {
      fs.writeSync(descriptor, `${JSON.stringify(redactTraceSecrets(entry), null, 2)}\n`);
      fs.fsyncSync(descriptor);
    } finally {
      fs.closeSync(descriptor);
    }
    return responsePath;
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
      const snapshot = typeof modelCallBudget.snapshot === 'function' ? modelCallBudget.snapshot() : null;
      if (snapshot && snapshot.remaining < 1) {
        const error = new Error(
          `lab ${snapshot.labId} exhausted its ${snapshot.limit}-call model budget before ${role}`,
        );
        error.code = 'model_call_budget_exhausted';
        throw error;
      }
      const sharedAttemptReservation = trace?.sharedAttemptLedger?.reserve({ role, turn }) || null;
      const reservation = modelCallBudget.reserve({ role, turn });
      appendTraceEvent(trace, {
        type: 'model_call_budget_reserved',
        role,
        turn,
        admission: reservation,
        sharedAttemptReservation,
        attemptId: sharedAttemptReservation?.attemptId || null,
      });
      const attemptId =
        sharedAttemptReservation?.attemptId ||
        (trace?.enabled ? `${trace.runId}:model-attempt:${reservation.call}` : null);
      return Object.freeze(attemptId ? { ...reservation, attemptId } : { ...reservation });
    } catch (error) {
      appendTraceEvent(trace, {
        type: 'model_call_budget_exhausted',
        role,
        turn,
        admission: typeof modelCallBudget.snapshot === 'function' ? modelCallBudget.snapshot() : null,
      });
      throw error;
    }
  }

  function markTutorStubMeteredModelCallDispatched({
    trace = null,
    reservation = null,
    role = 'unknown',
    turn = null,
  } = {}) {
    if (!reservation?.attemptId) return;
    trace?.sharedAttemptLedger?.markDispatched({ attemptId: reservation.attemptId, role, turn });
    appendTraceEvent(trace, {
      type: 'model_call_dispatch_started',
      attemptId: reservation.attemptId,
      role,
      turn,
      publicTranscriptChanged: false,
    });
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
    const acceptedStateEvents = resume.acceptedStateEvents || resume.events || [];
    state.turns = turns;
    state.history = [];
    if (restoreOpening) {
      const lastClearIndex = acceptedStateEvents.reduce(
        (index, event, candidate) => (event?.type === 'history_clear' ? candidate : index),
        -1,
      );
      const activeEvents = acceptedStateEvents.slice(lastClearIndex + 1);
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
    const comprehension = restoreComprehensionState(state, turns, acceptedStateEvents);
    const directorGuidance = restoreDirectorGuidanceState(state, acceptedStateEvents);
    const learnerDag = replayTutorStubLearnerDagFromTurns(state, turns, {
      applyLearnerRecordUpdate,
      learnerPublicEvidenceState,
    });
    const typedActions = restoreTypedActionState(state, turns, acceptedStateEvents);
    state.resumePendingAutomatedLearnerTurn = resume.pendingAutomatedLearnerTurn
      ? jsonClone(resume.pendingAutomatedLearnerTurn)
      : null;
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
        world: state.world,
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
      pendingAutomatedLearnerTurn: state.resumePendingAutomatedLearnerTurn,
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
    markTutorStubMeteredModelCallDispatched,
    reserveProgram2ProviderBudget,
    reserveTutorStubMeteredModelCall,
    restoreDialogueFromTrace,
    traceDisplayPath,
  };
}
