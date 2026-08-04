export function createTutorStubVoiceController(dependencies = {}) {
  const {
    C,
    TUTOR_STUB_VOICE_MODELS,
    appendTraceEvent,
    clearStatusLine,
    createTutorStubVoiceBridge,
    getActiveAutoRun,
    getActiveLearnerTurn,
    isProcessingTurn,
    latestTutorMessage,
    normalizeTutorStubVoiceModel,
    normalizeTutorStubVoiceName,
    openingDebugId,
    persistCurrentInteractiveSettings,
    printWithConcurrentTerminal,
    sessionRuntime,
    setInteractionMode,
    state,
    stateRunDebugId,
  } = dependencies;
  let voiceBridge = null;

  function voiceRuntimeSnapshot() {
    return {
      schema: state.voice.schema,
      enabled: Boolean(voiceBridge && state.voice.enabled),
      model: state.voice.model,
      voice: state.voice.voice,
      transcriptionModel: state.voice.transcriptionModel,
      apiKeyConfigured: Boolean(process.env.OPENAI_API_KEY),
      bridge: voiceBridge?.snapshot() || state.voice.bridge || null,
      lastStartedAt: state.voice.lastStartedAt,
      lastStoppedAt: state.voice.lastStoppedAt,
      deliveryCount: state.voice.deliveries.length,
      interruptions: state.voice.interruptions,
      authority: 'existing_cli_analysis_dag_register_guard_pipeline',
      automaticRealtimeResponses: false,
    };
  }

  function publishAcceptedTutorToVoice({
    text,
    turn = null,
    turnId = null,
    response = null,
    reason = 'accepted_tutor_text',
  } = {}) {
    if (!voiceBridge || !state.voice.enabled || !String(text || '').trim()) return null;
    const selection = response?.registerSelection || null;
    const delivery = voiceBridge.publishTutor({
      text,
      turn,
      turnId,
      register: selection?.engagement_stance || selection?.selected_register || null,
      character:
        selection?.actorial_part_label ||
        selection?.response_configuration?.actorial_part_label ||
        selection?.actorial_part ||
        selection?.response_configuration?.actorial_part ||
        null,
      reason,
    });
    state.voice.deliveries.push({
      deliveryId: delivery.deliveryId,
      turn,
      turnId,
      reason,
      acceptedAt: delivery.acceptedAt,
      text,
    });
    appendTraceEvent(state.trace, {
      type: 'voice_tutor_delivery',
      schema: delivery.schema,
      delivery,
      canonicalTextSource: reason,
      publicTranscriptChanged: false,
    });
    return delivery;
  }

  async function stopVoiceBridge(reason = 'voice_disabled') {
    if (!voiceBridge) return null;
    const bridge = voiceBridge;
    voiceBridge = null;
    state.voice.enabled = false;
    state.voice.lastStoppedAt = new Date().toISOString();
    try {
      const snapshot = await bridge.stop(reason);
      state.voice.bridge = snapshot;
      return snapshot;
    } catch (error) {
      appendTraceEvent(state.trace, {
        type: 'voice_bridge_stop_error',
        reason,
        error: error.message,
        publicTranscriptChanged: false,
      });
      return null;
    }
  }

  async function startVoiceBridge({ open = true, restart = false, source = 'slash' } = {}) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured in this worktree');
    }
    if (restart && voiceBridge) await stopVoiceBridge('voice_configuration_changed');
    if (!voiceBridge) {
      voiceBridge = createTutorStubVoiceBridge({
        apiKey: process.env.OPENAI_API_KEY,
        model: state.voice.model,
        voice: state.voice.voice,
        title: state.world?.title ? `${state.world.title} · Voice` : 'Tutor Stub Voice',
        runId: state.debugRunId,
        onLearnerTranscript: async ({ text, itemId, receivedAt, source: transcriptSource }) => {
          printWithConcurrentTerminal(state, () => {
            clearStatusLine();
            console.log(`${C.brightGreen}${C.bold}learner · voice >${C.reset} ${text}\n`);
          });
          appendTraceEvent(state.trace, {
            type: 'voice_learner_transcript',
            schema: 'machinespirits.tutor-stub.voice-learner-transcript.v1',
            text,
            itemId,
            receivedAt,
            source: transcriptSource,
            whileTutorPending: Boolean(isProcessingTurn()),
            compoundTurnPolicy: 'same_as_typed_learner_input',
            publicTranscriptStatus: 'pending_compound_turn',
          });
          const routed = sessionRuntime.step(text, { kind: 'learner', context: { source: 'voice' } });
          return {
            ...routed,
            turn: getActiveLearnerTurn()?.turn || state.turns.length + 1,
          };
        },
        onInterrupt: async ({ reason, receivedAt }) => {
          state.voice.interruptions += 1;
          appendTraceEvent(state.trace, {
            type: 'voice_learner_barge_in',
            schema: 'machinespirits.tutor-stub.voice-interruption.v1',
            reason,
            receivedAt,
            tutorSpeechCancelledImmediately: true,
            modelAttemptCancellation: 'when_the_completed_transcript_fragment_joins_the_compound_turn',
            activeLearnerTurnId: getActiveLearnerTurn()?.id || null,
            publicTranscriptChanged: false,
          });
          return { tutorSpeechCancelled: true, awaitingTranscript: true };
        },
        onSpokenTranscript: async ({ deliveryId, transcript, canonical, matchesCanonical, receivedAt }) => {
          appendTraceEvent(state.trace, {
            type: 'voice_spoken_transcript_audit',
            schema: 'machinespirits.tutor-stub.voice-spoken-transcript-audit.v1',
            deliveryId,
            transcript,
            canonical,
            matchesCanonical,
            receivedAt,
            canonicalTextRemainsAuthoritative: true,
            publicTranscriptChanged: false,
          });
          return { matchesCanonical, canonicalTextRemainsAuthoritative: true };
        },
        onEvent: (event) => {
          appendTraceEvent(state.trace, {
            ...event,
            type: `voice_${String(event.type || 'event').replace(/^voice_/u, '')}`,
            publicTranscriptChanged: false,
          });
        },
      });
      const started = await voiceBridge.start();
      state.voice.enabled = true;
      state.voice.lastStartedAt = new Date().toISOString();
      state.voice.bridge = voiceBridge.snapshot();
      appendTraceEvent(state.trace, {
        type: 'voice_runtime_enabled',
        source,
        voice: voiceRuntimeSnapshot(),
        publicTranscriptChanged: false,
      });
      const latest = latestTutorMessage(state);
      if (latest) {
        const latestTurn = state.turns.at(-1);
        publishAcceptedTutorToVoice({
          text: latest,
          turn: latestTurn?.turn || 0,
          turnId: latestTurn?.turnId || openingDebugId(stateRunDebugId(state)),
          response: latestTurn,
          reason: latestTurn ? 'latest_accepted_tutor_text_on_voice_start' : 'accepted_opening_on_voice_start',
        });
      }
      if (open && process.env.TUTOR_STUB_VOICE_OPEN !== '0') voiceBridge.open();
      return { ...started, opened: Boolean(open && process.env.TUTOR_STUB_VOICE_OPEN !== '0') };
    }
    if (open && process.env.TUTOR_STUB_VOICE_OPEN !== '0') voiceBridge.open();
    return { ...voiceBridge.snapshot(), url: voiceBridge.browserUrl(), opened: Boolean(open) };
  }

  async function handleVoiceCommand(argument = '', { source = 'slash' } = {}) {
    clearStatusLine();
    const [actionRaw = 'on', valueRaw = '', ...rest] = String(argument || '')
      .trim()
      .split(/\s+/u);
    const action = actionRaw.toLowerCase() || 'on';
    const value = [valueRaw, ...rest].filter(Boolean).join(' ');
    try {
      if (action === 'off' || action === 'stop') {
        if (!voiceBridge) {
          console.log(`${C.dim}voice is already off${C.reset}\n`);
          return true;
        }
        await stopVoiceBridge('voice_command_off');
        console.log(`${C.brightCyan}${C.bold}voice >${C.reset} off`);
        console.log(`${C.dim}  the text dialogue remains active in this terminal${C.reset}\n`);
        return true;
      }
      if (action === 'status') {
        const snapshot = voiceRuntimeSnapshot();
        console.log(
          `${C.brightCyan}${C.bold}voice >${C.reset} ${snapshot.enabled ? 'on' : 'off'} · ${snapshot.model} · ${snapshot.voice}`,
        );
        console.log(
          `${C.dim}  ${snapshot.apiKeyConfigured ? 'API key available server-side' : 'OPENAI_API_KEY missing'} · Realtime cannot answer independently · ${snapshot.deliveryCount} accepted tutor deliveries · ${snapshot.interruptions} interruptions${C.reset}`,
        );
        if (snapshot.bridge?.url) console.log(`${C.dim}  ${snapshot.bridge.url}${C.reset}`);
        console.log();
        return true;
      }
      if (action === 'model') {
        if (!value) {
          console.log(`${C.brightCyan}${C.bold}voice models >${C.reset} ${TUTOR_STUB_VOICE_MODELS.join(' · ')}`);
          console.log(
            `${C.dim}  current: ${state.voice.model}; changing it restarts an active voice session${C.reset}\n`,
          );
          return true;
        }
        const previous = state.voice.model;
        state.voice.model = normalizeTutorStubVoiceModel(value);
        const remembered = persistCurrentInteractiveSettings('realtime_voice_model_changed');
        if (voiceBridge) await startVoiceBridge({ open: true, restart: true, source: 'voice_model_changed' });
        console.log(`${C.brightCyan}${C.bold}voice model >${C.reset} ${previous} → ${state.voice.model}`);
        console.log(
          `${C.dim}  separate from the four text-model roles${remembered ? '; remembered for next time' : ''}${C.reset}\n`,
        );
        return true;
      }
      if (action === 'speaker' || action === 'name') {
        if (!value) {
          console.log(`${C.brightCyan}${C.bold}voice speaker >${C.reset} ${state.voice.voice}\n`);
          return true;
        }
        const previous = state.voice.voice;
        state.voice.voice = normalizeTutorStubVoiceName(value);
        const remembered = persistCurrentInteractiveSettings('realtime_voice_name_changed');
        if (voiceBridge) await startVoiceBridge({ open: true, restart: true, source: 'voice_name_changed' });
        console.log(`${C.brightCyan}${C.bold}voice speaker >${C.reset} ${previous} → ${state.voice.voice}`);
        console.log(
          `${C.dim}  ${remembered ? 'remembered for next time' : 'applies to the next voice session'}${C.reset}\n`,
        );
        return true;
      }
      if (!['on', 'open', 'start'].includes(action)) {
        throw new Error(
          'use /voice, /voice open, /voice status, /voice off, /voice model <model>, or /voice speaker <name>',
        );
      }
      if (getActiveAutoRun())
        throw new Error('automation is running; use /reset or wait for it to finish before opening learner voice');
      if (state.interaction?.mode !== 'learner') setInteractionMode('learner', { announce: false });
      const started = await startVoiceBridge({ open: true, source });
      console.log(
        `${C.brightCyan}${C.bold}voice >${C.reset} ${voiceBridge ? 'ready' : 'off'} · ${state.voice.model} · ${state.voice.voice}`,
      );
      console.log(`${C.dim}  ${started.url}${C.reset}`);
      console.log(
        `${C.dim}  microphone speech joins the normal learner turn; only accepted tutor text is spoken; browser ${started.opened ? 'opened' : 'opening is disabled by TUTOR_STUB_VOICE_OPEN=0'}${C.reset}\n`,
      );
      return true;
    } catch (error) {
      console.log(`${C.red}voice error:${C.reset} ${error.message}\n`);
      appendTraceEvent(state.trace, {
        type: 'voice_command_error',
        action,
        value: value || null,
        error: error.message,
        publicTranscriptChanged: false,
      });
      return true;
    }
  }

  return Object.freeze({
    voiceRuntimeSnapshot,
    publishAcceptedTutorToVoice,
    stopVoiceBridge,
    startVoiceBridge,
    handleVoiceCommand,
  });
}
