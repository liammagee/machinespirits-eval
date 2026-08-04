export function createTutorStubCharacterControlController(dependencies) {
  const {
    C,
    TUTOR_STUB_CHARACTER_RESTATEMENT_SCHEMA,
    TUTOR_STUB_CHARACTER_RESTATEMENT_SYSTEM_PROMPT,
    appendTraceEvent,
    auditTutorResponseLeak,
    auditTutorStubCharacterRestatement,
    buildTutorStubCharacterRestatementPrompt,
    callPromptModel,
    cleanTutorStubCharacterRestatement,
    clearStatusLine,
    displayDiagnosticLabel,
    explicitPerformanceDirectiveValue,
    getActorialPartDefinitions,
    handleExplicitPerformanceDirectiveCommand,
    handleMixedLearnerProfileCommand,
    isExiting,
    isProcessingTurn,
    jsonClone,
    latestTutorFeedbackTarget,
    latestTutorMessage,
    liveSettingsPickerAvailable,
    mixedLearner,
    openingDebugId,
    pickInitialMixedLearnerProfileWithKeyboard,
    pickLiveCharacterTargetWithKeyboard,
    pickLiveTutorCharacterWithKeyboard,
    printTutorFeedbackRequest,
    publicWorldSummary,
    publishAcceptedTutorToVoice,
    sessionRuntime,
    startInterimAnimation,
    startMixedLearnerPrefetch,
    state,
    stateRunDebugId,
    stopInterimAnimation,
    turnDebugId,
  } = dependencies;

  function deterministicTutorCharacterRestatement(previousText, characterId) {
    const lead =
      {
        scene_partner: 'Let us take the same point together:',
        examiner: 'Inspect the same point directly:',
        record_keeper: 'Enter the same point this way:',
        advocate: 'Here is the strongest form of the same case:',
        skeptic: 'Test the same point before accepting it:',
        adversarial_teacher: 'Challenge the same idea within the subject itself:',
        exacting_schoolmaster: 'Show the same required learning step precisely:',
      }[characterId] || 'Put the same point another way:';
    return cleanTutorStubCharacterRestatement(`${lead} ${String(previousText || '').trim()}`);
  }

  function applyTutorCharacterRestatementToState({ previousText, text, record }) {
    const historyIndex = [...(state.history || [])]
      .map((message, index) => ({ message, index }))
      .reverse()
      .find(({ message }) => message.role === 'assistant')?.index;
    if (!Number.isInteger(historyIndex)) return null;
    state.history[historyIndex] = { ...state.history[historyIndex], content: text };

    const lastTurn = state.turns.at(-1);
    let targetKind = 'opening';
    let targetTurn = 0;
    let targetTurnId = openingDebugId(stateRunDebugId(state));
    if (lastTurn?.tutor === previousText) {
      targetKind = 'tutor_response';
      targetTurn = lastTurn.turn;
      targetTurnId = lastTurn.turnId || turnDebugId(state, lastTurn.turn);
      lastTurn.tutorOriginal = lastTurn.tutorOriginal || previousText;
      lastTurn.tutor = text;
      lastTurn.characterRestatements = [...(lastTurn.characterRestatements || []), jsonClone(record)];
    } else if (state.openingRealization) {
      state.openingRealization = {
        ...state.openingRealization,
        originalText: state.openingRealization.originalText || previousText,
        text,
        characterRestatements: [...(state.openingRealization.characterRestatements || []), jsonClone(record)],
      };
    }
    return { targetKind, targetTurn, targetTurnId, historyIndex };
  }

  async function restateLatestTutorForCharacter(characterId, { source = '/character tutor' } = {}) {
    const previousText = String(latestTutorMessage(state) || '').trim();
    if (!previousText || !characterId || isExiting()) return { suppressReprise: false, restated: false };
    const definitions = getActorialPartDefinitions();
    const definition = definitions[characterId] || {};
    const lastTurn = state.turns.at(-1);
    const tutorTurn = lastTurn?.tutor === previousText ? Number(lastTurn.turn) || state.turns.length : 0;
    const learnerText = lastTurn?.tutor === previousText ? lastTurn.learner || '' : '';
    const permittedText = (state.history || []).map((message) => message.content).join('\n');
    const prompt = buildTutorStubCharacterRestatementPrompt({
      previousText,
      characterId,
      characterLabel: definition.label,
      characterContract: definition.contract,
      publicWorld: publicWorldSummary(state.world),
    });
    appendTraceEvent(state.trace, {
      type: 'tutor_character_restatement_started',
      schema: TUTOR_STUB_CHARACTER_RESTATEMENT_SCHEMA,
      source,
      turn: tutorTurn,
      characterId,
      previousText,
      publicTranscriptChanged: false,
    });

    let response = null;
    let candidate = '';
    let generationError = null;
    startInterimAnimation(state, 'rephrasing tutor', { tutorTurn });
    try {
      response = await callPromptModel({
        prompt,
        resolved: state.resolved,
        systemPrompt: TUTOR_STUB_CHARACTER_RESTATEMENT_SYSTEM_PROMPT,
        role: 'tutor_stub_character_clarifier',
        maxTokens: Math.min(Number(state.maxTokens) || 420, 420),
        trace: state.trace,
        stream: { enabled: false },
        cliEffort: state.cliEffort,
        turn: tutorTurn,
      });
      candidate = cleanTutorStubCharacterRestatement(response.text);
    } catch (error) {
      generationError = error;
    } finally {
      stopInterimAnimation(state);
    }

    let restatementAudit = auditTutorStubCharacterRestatement({
      previousText,
      text: candidate,
      characterId,
      permittedText,
    });
    let leakAudit =
      candidate && state.dag && state.world
        ? auditTutorResponseLeak({
            text: candidate,
            world: state.world,
            tutorTurn,
            learnerText,
            state,
          })
        : { ok: true, leaks: [] };
    let deterministicFallback = false;
    if (generationError || !candidate || !restatementAudit.ok || !leakAudit.ok) {
      deterministicFallback = true;
      candidate = deterministicTutorCharacterRestatement(previousText, characterId);
      restatementAudit = auditTutorStubCharacterRestatement({
        previousText,
        text: candidate,
        characterId,
        permittedText,
      });
      leakAudit =
        state.dag && state.world
          ? auditTutorResponseLeak({
              text: candidate,
              world: state.world,
              tutorTurn,
              learnerText,
              state,
            })
          : { ok: true, leaks: [] };
    }

    const record = {
      schema: TUTOR_STUB_CHARACTER_RESTATEMENT_SCHEMA,
      source,
      characterId,
      characterLabel: definition.label || displayDiagnosticLabel(characterId),
      previousText,
      text: candidate,
      deterministicFallback,
      generationError: generationError?.message || null,
      provider: response?.provider || (deterministicFallback ? 'harness' : null),
      model: response?.model || (deterministicFallback ? 'deterministic-character-restatement-v1' : null),
      latencyMs: response?.latencyMs || 0,
      usage: response?.usage || null,
      promptSnapshot: response?.promptSnapshot || null,
      audit: {
        ...restatementAudit,
        leakAudit,
        ok: restatementAudit.ok && leakAudit.ok,
      },
    };
    const target = applyTutorCharacterRestatementToState({ previousText, text: candidate, record });
    appendTraceEvent(state.trace, {
      type: 'tutor_character_restatement_completed',
      ...record,
      target,
      publicTranscriptChanged: true,
      transcriptOperation: 'replace_latest_tutor_utterance',
    });
    sessionRuntime.sync('tutor_character_restatement_completed');
    clearStatusLine();
    console.log(`${C.brightMagenta}${C.bold}tutor ↻ >${C.reset} ${candidate}\n`);
    publishAcceptedTutorToVoice({
      text: candidate,
      turn: target?.targetTurn ?? tutorTurn,
      turnId: target?.targetTurnId || null,
      reason: 'accepted_tutor_character_restatement',
    });
    printTutorFeedbackRequest(latestTutorFeedbackTarget());
    if (mixedLearner.enabled && latestTutorMessage(state)) {
      startMixedLearnerPrefetch('explicit_character_directive_changed');
      console.log(
        `${C.dim}  rebuilding the learner suggestion and next tutor response from this restatement${C.reset}\n`,
      );
    }
    return { suppressReprise: true, restated: true, record, target };
  }

  function applyTutorCharacterChoice(argument, { duringTurn = false, source = '/character tutor' } = {}) {
    const previous = explicitPerformanceDirectiveValue(state, 'character');
    const canRestate = Boolean(!duringTurn && !isProcessingTurn() && latestTutorMessage(state));
    const result = handleExplicitPerformanceDirectiveCommand('character', argument, {
      duringTurn,
      deferMixedPrefetch: canRestate,
    });
    const current = explicitPerformanceDirectiveValue(state, 'character');
    if (current !== previous && current && canRestate) {
      return restateLatestTutorForCharacter(current, { source });
    }
    return result;
  }

  function handleCharacterCommand(argument = '', { duringTurn = false } = {}) {
    const requested = String(argument || '').trim();
    const [target = '', ...rest] = requested.split(/\s+/u);
    const normalizedTarget = target.toLowerCase();
    const targetArgument = rest.join(' ');

    if (!requested && liveSettingsPickerAvailable() && !duringTurn) {
      clearStatusLine();
      return pickLiveCharacterTargetWithKeyboard().then((selection) => {
        if (!selection) return { suppressReprise: true, selected: false };
        return Promise.resolve(handleCharacterCommand(selection.id, { duringTurn: false })).then((outcome) => ({
          ...(outcome && typeof outcome === 'object' ? outcome : {}),
          suppressReprise: true,
          selected: outcome?.selected !== false,
          target: outcome?.target || selection.id,
        }));
      });
    }
    if (!requested || normalizedTarget === 'status') {
      clearStatusLine();
      const learnerCharacter = mixedLearner.enabled
        ? mixedLearner.profileId || 'custom'
        : state.autoLearner?.enabled
          ? state.autoLearner.profileId || 'custom'
          : 'human learner';
      const tutorCharacter = state.register?.enabled
        ? explicitPerformanceDirectiveValue(state, 'character') || 'auto'
        : 'adaptive delivery off';
      console.log(`${C.brightMagenta}${C.bold}character controls >${C.reset}`);
      console.log(`${C.cyan}  learner character >${C.reset} ${learnerCharacter}`);
      console.log(`${C.brightMagenta}  tutor character >${C.reset} ${tutorCharacter}`);
      console.log(
        `${C.dim}  /learner [profile] · /tutor [part] · full /character learner|tutor forms and legacy /profile still work${C.reset}\n`,
      );
      return !requested ? { handled: true, suppressReprise: true } : true;
    }
    if (normalizedTarget === 'learner') {
      if (!targetArgument && mixedLearner.enabled && liveSettingsPickerAvailable() && !duringTurn) {
        clearStatusLine();
        console.log(`${C.cyan}${C.bold}Learner character · choose with ↑/↓ and Enter${C.reset}`);
        return pickInitialMixedLearnerProfileWithKeyboard(mixedLearner.profileId || 'custom').then((selection) => {
          if (!selection) return { suppressReprise: true, selected: false };
          const requestedProfile = selection.id ? selection.id : `custom ${mixedLearner.profile}`;
          handleMixedLearnerProfileCommand(requestedProfile, { duringTurn: false });
          return { suppressReprise: true, selected: true, target: 'learner', value: selection.id || 'custom' };
        });
      }
      handleMixedLearnerProfileCommand(targetArgument, { duringTurn });
      return true;
    }
    if (normalizedTarget === 'tutor') {
      if (!targetArgument && liveSettingsPickerAvailable() && !duringTurn) {
        clearStatusLine();
        console.log(`${C.brightMagenta}${C.bold}Tutor character · choose with ↑/↓ and Enter${C.reset}`);
        return pickLiveTutorCharacterWithKeyboard(explicitPerformanceDirectiveValue(state, 'character') || 'auto').then(
          (selection) => {
            if (!selection) return { suppressReprise: true, selected: false };
            return Promise.resolve(
              applyTutorCharacterChoice(selection.id, {
                duringTurn: false,
                source: '/character tutor selector',
              }),
            ).then((outcome) => ({
              ...(outcome && typeof outcome === 'object' ? outcome : {}),
              suppressReprise: true,
              selected: true,
              target: 'tutor',
              value: selection.id,
            }));
          },
        );
      }
      return applyTutorCharacterChoice(targetArgument, { duringTurn });
    }
    return applyTutorCharacterChoice(requested, { duringTurn, source: '/character legacy' });
  }

  return { handleCharacterCommand };
}
