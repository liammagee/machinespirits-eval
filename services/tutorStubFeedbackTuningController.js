export function createTutorStubFeedbackTuningController(dependencies) {
  const {
    C,
    ROOT,
    TUTOR_STUB_FEEDBACK_REASONS,
    appendTraceEvent,
    appendTutorStubTurnFailureTraceRecords,
    approveTutorStubTuningCandidate,
    buildTutorStubFeedbackRatingRecord,
    clearStatusLine,
    clearTutorStubTurnFeedbackRating,
    displayDiagnosticLabel,
    findTutorStubFeedbackTargetTurn,
    hashCanonicalJson,
    isExiting,
    isProcessingTurn,
    jsonClone,
    latestTutorMessage,
    listTutorStubTuningCandidates,
    openingDebugId,
    path,
    persistCurrentInteractiveSettings,
    promoteTutorStubTuningCandidate,
    readTutorStubTuningCandidate,
    recordTutorStubTuningNote,
    rejectTutorStubTuningCandidate,
    requestTutorStubTurnFeedback,
    responseDetailsConfig,
    rollbackTutorStubTutorVersion,
    setTutorStubTuningMode,
    setTutorStubTurnFeedbackEnabled,
    setTutorStubTurnFeedbackRating,
    state,
    stateRunDebugId,
    synthesizeTutorStubTuningCandidate,
    turnDebugId,
    tutorStubCommandReturnsToScene,
    tutorStubTuningReplayPath,
    tutorStubTuningSnapshot,
    tutorStubTurnFeedbackEnvelope,
    tutorStubTurnFeedbackLabel,
    validateTutorStubTuningCandidate,
  } = dependencies;

  function repriseLatestTutorUtterance(command, { duringTurn = false } = {}) {
    if (duringTurn || isExiting() || !tutorStubCommandReturnsToScene(command)) return false;
    const utterance = String(latestTutorMessage(state) || '').trim();
    if (!utterance) return false;
    console.log(`${C.brightMagenta}${C.bold}tutor ↻ >${C.reset} ${utterance}\n`);
    appendTraceEvent(state.trace, {
      type: 'tutor_utterance_reprise',
      command,
      turn: state.turns[state.turns.length - 1]?.turn || 0,
      text: utterance,
      publicTranscriptChanged: false,
    });
    return true;
  }

  function latestTutorFeedbackTarget() {
    const turn = state.turns.at(-1);
    if (turn?.tutor) {
      return {
        tutorTurn: turn.turn,
        tutorTurnId: turn.turnId || turnDebugId(state, turn.turn),
        kind: 'tutor_response',
      };
    }
    if (state.history?.[0]?.role === 'assistant') {
      return {
        tutorTurn: 0,
        tutorTurnId: openingDebugId(stateRunDebugId(state)),
        kind: 'opening',
      };
    }
    return null;
  }

  function handleResponseDetailsCommand(action = '', { duringTurn = false, source = 'command' } = {}) {
    clearStatusLine();
    const normalized = String(action || 'status')
      .trim()
      .toLowerCase();
    if (!normalized || normalized === 'status') {
      console.log(`${C.accent}${C.bold}response details >${C.reset} ${state.responseDetails?.enabled ? 'on' : 'off'}`);
      console.log(
        `${C.dim}  compact model, foreground timing, token, and tutor-style details appear before tutor speech; /details on|off${C.reset}\n`,
      );
      return true;
    }
    if (normalized !== 'on' && normalized !== 'off') {
      console.log(`${C.danger}details error:${C.reset} use /details on, /details off, or /details status\n`);
      return true;
    }
    const previous = Boolean(state.responseDetails?.enabled);
    const enabled = normalized === 'on';
    state.responseDetails = {
      ...(state.responseDetails || responseDetailsConfig),
      enabled,
    };
    appendTraceEvent(state.trace, {
      type: 'terminal_response_details_changed',
      source,
      previous,
      enabled,
      duringTurn,
      effectiveTurn: state.turns.length + 1,
      publicTranscriptChanged: false,
    });
    console.log(`${C.accent}${C.bold}response details >${C.reset} ${enabled ? 'on' : 'off'}`);
    console.log(
      `${C.dim}  ${enabled ? 'compact details will appear before tutor speech' : 'model and timing details are hidden for the rest of this session unless re-enabled'}${C.reset}\n`,
    );
    return true;
  }

  function printTutorFeedbackRequest(target = latestTutorFeedbackTarget()) {
    if (!target || !state.turnFeedback?.enabled || state.interaction?.mode === 'auto' || isExiting()) return false;
    const feedback = requestTutorStubTurnFeedback(state.turnFeedback, target);
    if (!feedback) return false;
    console.log(
      `${C.brightYellow}optional tutor feedback >${C.reset} ${C.red}← 👎 not helpful${C.reset} · ${C.brightGreen}👍 helpful →${C.reset} · ${C.dim}empty prompt; no Enter · Esc hides for session · or just reply${C.reset}\n`,
    );
    appendTraceEvent(state.trace, {
      type: 'tutor_turn_feedback_requested',
      turn: target.tutorTurn,
      turnId: target.tutorTurnId,
      kind: target.kind,
      feedback,
      publicTranscriptChanged: false,
    });
    return true;
  }

  function handleTutorFeedbackCommand(action = '', { duringTurn = false, source = 'command' } = {}) {
    clearStatusLine();
    const rawAction = String(action || '').trim();
    const [ratingAction = '', reasonAction = '', ...commentParts] = rawAction.split(/\s+/u);
    const normalized = ratingAction.toLowerCase();
    if (!normalized) {
      const feedback = tutorStubTurnFeedbackEnvelope(state.turnFeedback);
      console.log(
        `${C.brightYellow}${C.bold}tutor feedback >${C.reset} ${state.turnFeedback?.enabled ? 'on' : 'off'} · ${tutorStubTurnFeedbackLabel(feedback)}`,
      );
      console.log(
        `${C.dim}  optional and private · on an empty prompt use ← for down, → for up, or Esc to hide for the session; 👍, 👎, /up, /down, and /feedback also work${C.reset}\n`,
      );
      return true;
    }
    if (normalized === 'on') {
      setTutorStubTurnFeedbackEnabled(state.turnFeedback, true);
      appendTraceEvent(state.trace, {
        type: 'tutor_turn_feedback_setting_changed',
        enabled: true,
        source,
        duringTurn,
        effectiveTurn: state.turns.length + 1,
        publicTranscriptChanged: false,
      });
      console.log(`${C.brightYellow}${C.bold}tutor feedback >${C.reset} on · optional`);
      if (!duringTurn && latestTutorFeedbackTarget()) printTutorFeedbackRequest();
      else console.log(`${C.dim}  the next displayed tutor message will invite a rating${C.reset}\n`);
      return true;
    }
    if (normalized === 'off') {
      setTutorStubTurnFeedbackEnabled(state.turnFeedback, false);
      appendTraceEvent(state.trace, {
        type: 'tutor_turn_feedback_setting_changed',
        enabled: false,
        source,
        duringTurn,
        effectiveTurn: state.turns.length + 1,
        publicTranscriptChanged: false,
      });
      console.log(`${C.brightYellow}${C.bold}tutor feedback >${C.reset} off`);
      console.log(`${C.dim}  no rating will be attached to later learner messages${C.reset}\n`);
      return true;
    }
    if (duringTurn || isProcessingTurn()) {
      console.log(`${C.dim}the tutor is already responding; rate the next tutor message after it appears${C.reset}\n`);
      return true;
    }
    if (normalized === 'clear') {
      const feedback = clearTutorStubTurnFeedbackRating(state.turnFeedback);
      console.log(`${C.brightYellow}${C.bold}tutor feedback >${C.reset} ${tutorStubTurnFeedbackLabel(feedback)}`);
      console.log(`${C.dim}  no rating will accompany your next learner message unless you choose one${C.reset}\n`);
      appendTraceEvent(state.trace, {
        type: 'tutor_turn_feedback_cleared',
        turn: feedback?.targetTutorTurn ?? null,
        turnId: feedback?.targetTutorTurnId || null,
        publicTranscriptChanged: false,
      });
      return true;
    }
    if (normalized !== 'up' && normalized !== 'down') {
      console.log(
        `${C.red}feedback error:${C.reset} use /feedback up [reason], /feedback down [reason] [comment], /feedback clear, /feedback on, or /feedback off\n`,
      );
      return true;
    }
    let reason = null;
    let comment = '';
    if (reasonAction) {
      const candidateReason = reasonAction.toLowerCase().replace(/[\s-]+/gu, '_');
      if (TUTOR_STUB_FEEDBACK_REASONS[candidateReason]) {
        reason = candidateReason;
        comment = commentParts.join(' ');
      } else {
        reason = 'custom';
        comment = [reasonAction, ...commentParts].join(' ');
      }
    }
    let feedback;
    try {
      feedback = setTutorStubTurnFeedbackRating(state.turnFeedback, normalized, { reason, comment });
    } catch (error) {
      console.log(`${C.red}feedback error:${C.reset} ${error.message}\n`);
      return true;
    }
    if (!feedback) {
      console.log(`${C.dim}no tutor message is awaiting feedback; continue the dialogue first${C.reset}\n`);
      return true;
    }
    console.log(
      `${C.brightYellow}${C.bold}tutor feedback >${C.reset} ${tutorStubTurnFeedbackLabel(feedback)} · ${C.dim}private; send your learner reply whenever ready${C.reset}\n`,
    );
    const feedbackTargetTurn = findTutorStubFeedbackTargetTurn({
      feedback,
      turns: state.turns,
      opening: {
        turnId: openingDebugId(stateRunDebugId(state)),
        text: state.history.find((message) => message.role === 'assistant')?.content || '',
        provider: state.openingRealization?.provider || null,
        model: state.openingRealization?.model || null,
      },
    });
    const ratingRecord = buildTutorStubFeedbackRatingRecord({
      feedback,
      targetTurn: feedbackTargetTurn,
      provenance: {
        runId: stateRunDebugId(state),
        sourceAssetId: state.trace?.assetId || null,
        trace: state.trace?.filePath ? path.relative(ROOT, state.trace.filePath) : null,
        worldId: state.world?.id || null,
        learnerProfileId: state.learnerProfileId || null,
        interactionMode: state.interaction?.mode || 'learner',
        inputSource: source,
        trainingReuse: jsonClone(state.trainingReuse),
      },
    });
    appendTraceEvent(state.trace, {
      type: 'tutor_turn_feedback_selected',
      turn: feedback.targetTutorTurn,
      turnId: feedback.targetTutorTurnId,
      rating: feedback.rating,
      supplied: feedback.supplied,
      inputSource: source,
      publicTranscriptChanged: false,
    });
    if (ratingRecord) {
      state.turnFailureFeedbackRecords.push(ratingRecord);
      appendTraceEvent(state.trace, {
        type: 'tutor_feedback_rating_recorded',
        turn: feedback.targetTutorTurn,
        turnId: feedback.targetTutorTurnId,
        record: ratingRecord,
        publicTranscriptChanged: false,
      });
      appendTutorStubTurnFailureTraceRecords(state);
      const ratedPromptSnapshot =
        feedbackTargetTurn?.prompts?.tutor ||
        (feedback.targetKind === 'opening' ? state.openingRealization?.promptSnapshot || null : null);
      const replaySystemPrompt = ratedPromptSnapshot?.systemPrompt || state.systemPrompt;
      const replayMessageHistory = Array.isArray(ratedPromptSnapshot?.messageHistory)
        ? ratedPromptSnapshot.messageHistory
        : state.history.slice(0, -1).map((message) => ({ role: message.role, content: message.content }));
      const tuningCandidate = synthesizeTutorStubTuningCandidate(state.tuning, {
        rating: feedback.rating,
        reason: feedback.reason,
        comment: feedback.comment,
        observation: ratingRecord,
        publicMessages: replayMessageHistory,
        runId: stateRunDebugId(state),
        targetTurnId: feedback.targetTutorTurnId,
        systemPromptHash: hashCanonicalJson({ systemPrompt: replaySystemPrompt }),
        systemPrompt: replaySystemPrompt,
        speaker: {
          userPrompt: ratedPromptSnapshot?.userPrompt || '',
          modelRef: state.modelRef,
          provider: state.resolved.provider,
          model: state.resolved.model,
          temperature: state.temperature,
          maxTokens: state.maxTokens,
          effort: state.cliEffort,
        },
      });
      if (tuningCandidate) {
        appendTraceEvent(state.trace, {
          type: 'tutor_tuning_candidate_created',
          candidate: tuningCandidate,
          publicTranscriptChanged: false,
        });
        console.log(
          `${C.brightCyan}tuning candidate >${C.reset} ${tuningCandidate.id} · ${displayDiagnosticLabel(tuningCandidate.status)} · ${tuningCandidate.evidence.reasonLabel}`,
        );
        console.log(
          `${C.dim}  /tune review · raw comment retained as evidence, never inserted into the tutor prompt${C.reset}\n`,
        );
      }
    }
    return true;
  }

  function printTutorTuningStatus() {
    const snapshot = tutorStubTuningSnapshot(state.tuning);
    console.log(
      `${C.brightCyan}${C.bold}tutor tuning >${C.reset} ${snapshot.mode} · ${snapshot.activeRef} · stable v${snapshot.stableVersion}${snapshot.canaryVersion ? ` · canary v${snapshot.canaryVersion}` : ''}`,
    );
    console.log(
      `${C.dim}  ${snapshot.sessionFeedbackCount} feedback observation${snapshot.sessionFeedbackCount === 1 ? '' : 's'} this session · ${snapshot.sessionCandidateIds.length} candidate${snapshot.sessionCandidateIds.length === 1 ? '' : 's'} · ${snapshot.policyRuleCount} active learned rule${snapshot.policyRuleCount === 1 ? '' : 's'}${C.reset}`,
    );
    console.log(
      `${C.dim}  evidence store: ${path.relative(ROOT, snapshot.storeDir)} · /tune reasons · /tune review${C.reset}\n`,
    );
    return snapshot;
  }

  function handleTutorTuningCommand(argument = '') {
    clearStatusLine();
    const raw = String(argument || '').trim();
    const [actionRaw = 'status', id = '', value = '', ...rest] = raw.split(/\s+/u).filter(Boolean);
    const action = actionRaw.toLowerCase();
    try {
      if (action === 'status') {
        printTutorTuningStatus();
        return true;
      }
      if (action === 'on' || action === 'capture' || action === 'off' || action === 'canary') {
        const snapshot = setTutorStubTuningMode(state.tuning, action, { instance: state.tutorInstance });
        persistCurrentInteractiveSettings('tuning_mode_changed');
        appendTraceEvent(state.trace, {
          type: 'tutor_tuning_mode_changed',
          mode: snapshot.mode,
          activeRef: snapshot.activeRef,
          publicTranscriptChanged: false,
        });
        console.log(`${C.brightCyan}${C.bold}tutor tuning >${C.reset} ${snapshot.mode}`);
        console.log(
          `${C.dim}  ${snapshot.mode === 'capture' ? 'feedback is recorded as evidence, but no candidates are synthesized' : snapshot.enabled ? 'feedback is captured and typed candidates can be reviewed' : 'no tuning evidence or candidates will be written'}; the current tutor remains pinned to ${snapshot.activeRef}${C.reset}\n`,
        );
        return true;
      }
      if (action === 'reasons') {
        console.log(`${C.brightCyan}${C.bold}feedback reasons >${C.reset}`);
        for (const [reason, definition] of Object.entries(TUTOR_STUB_FEEDBACK_REASONS)) {
          console.log(`  ${reason.padEnd(24)} ${definition.label}`);
        }
        console.log(
          `${C.dim}  example: /down too_abstract Uses labels instead of the objects in the scene${C.reset}\n`,
        );
        return true;
      }
      if (action === 'note') {
        const text = [id, value, ...rest].filter(Boolean).join(' ');
        const note = recordTutorStubTuningNote(state.tuning, text, {
          runId: stateRunDebugId(state),
          turn: state.turns.length + 1,
        });
        appendTraceEvent(state.trace, { type: 'tutor_tuning_note', note, publicTranscriptChanged: false });
        console.log(`${C.brightCyan}${C.bold}tuning note >${C.reset} ${note.text}`);
        console.log(`${C.dim}  provisional in this session; it is not a promoted tutor rule${C.reset}\n`);
        return true;
      }
      if (action === 'review') {
        const candidates = listTutorStubTuningCandidates(state.tuning);
        console.log(`${C.brightCyan}${C.bold}tuning candidates >${C.reset} ${candidates.length}`);
        if (!candidates.length)
          console.log(`${C.dim}  none yet; use /tune on and add a reason to a thumbs-down${C.reset}`);
        for (const candidate of candidates.slice(-12)) {
          console.log(
            `  ${candidate.id} · ${displayDiagnosticLabel(candidate.status)} · ${candidate.evidence?.reasonLabel || 'manual review'}`,
          );
          console.log(`${C.dim}    ${candidate.proposal?.rule || candidate.proposal?.explanation || ''}${C.reset}`);
        }
        console.log();
        return true;
      }
      if (!id && action !== 'rollback') throw new Error(`/tune ${action} needs a candidate id`);
      if (action === 'show') {
        const candidate = readTutorStubTuningCandidate(state.tuning, id);
        console.log(JSON.stringify(candidate, null, 2));
        return true;
      }
      if (action === 'approve') {
        const result = approveTutorStubTuningCandidate(state.tuning, id);
        console.log(
          `${C.brightYellow}${C.bold}candidate approved >${C.reset} ${id} → canary ${state.tutorInstance.id}@v${result.version.version}`,
        );
        console.log(
          `${C.dim}  test with --tutor ${state.tutorInstance.id}@v${result.version.version} or --tuning canary; then /tune validate ${id} up|down${C.reset}\n`,
        );
        return true;
      }
      if (action === 'reject') {
        const candidate = rejectTutorStubTuningCandidate(state.tuning, id, [value, ...rest].join(' '));
        console.log(`${C.brightYellow}${C.bold}candidate rejected >${C.reset} ${candidate.id}\n`);
        return true;
      }
      if (action === 'replay') {
        const replayPath = tutorStubTuningReplayPath(state.tuning, id);
        console.log(`${C.brightCyan}${C.bold}frozen-prefix replay >${C.reset} ${path.relative(ROOT, replayPath)}`);
        console.log(
          `${C.dim}  exact public messages, tutor version, prompt hash, target turn, and candidate overlay are preserved${C.reset}\n`,
        );
        return true;
      }
      if (action === 'validate') {
        const candidate = validateTutorStubTuningCandidate(state.tuning, id, value, rest.join(' '));
        console.log(
          `${C.brightYellow}${C.bold}candidate validation >${C.reset} ${candidate.id} · ${candidate.validation.rating === 'up' ? 'helpful' : 'not helpful'}\n`,
        );
        return true;
      }
      if (action === 'promote') {
        const candidate = promoteTutorStubTuningCandidate(state.tuning, id);
        console.log(
          `${C.brightGreen}${C.bold}tutor promoted >${C.reset} ${state.tutorInstance.id}@v${candidate.promotedVersion} is now stable`,
        );
        console.log(
          `${C.dim}  this running dialogue stays pinned to ${state.tuning.activeRef}; the next run uses the promoted version${C.reset}\n`,
        );
        return true;
      }
      if (action === 'rollback') {
        const requested = id === 'previous' ? null : id;
        const result = rollbackTutorStubTutorVersion(state.tuning, requested);
        console.log(
          `${C.brightYellow}${C.bold}tutor rolled back >${C.reset} v${result.fromVersion} → v${result.toVersion}`,
        );
        console.log(
          `${C.dim}  this running dialogue remains pinned; the next run uses the restored stable version${C.reset}\n`,
        );
        return true;
      }
      throw new Error(
        'use /tune status|on|off|reasons|note|review|show|approve|reject|replay|validate|promote|rollback',
      );
    } catch (error) {
      console.log(`${C.red}tuning error:${C.reset} ${error.message}\n`);
      return true;
    }
  }

  return {
    handleResponseDetailsCommand,
    handleTutorFeedbackCommand,
    handleTutorTuningCommand,
    latestTutorFeedbackTarget,
    printTutorFeedbackRequest,
    printTutorTuningStatus,
    repriseLatestTutorUtterance,
  };
}
