export function createTutorStubMixedLearnerController(dependencies) {
  const {
    C,
    CUSTOM_LEARNER_PROFILE_EXAMPLE,
    DEFAULT_TUTOR_STUB_DAG_FACT_DROPOUT_RATE,
    DEFAULT_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE,
    DEFAULT_TUTOR_STUB_RELEASE_SPEED,
    MAX_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE,
    MAX_TUTOR_STUB_RELEASE_SPEED,
    MIN_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE,
    MIN_TUTOR_STUB_RELEASE_SPEED,
    STUB,
    appendTraceEvent,
    applyTutorModelSelection,
    args,
    automatedLearnerProfileId,
    clearStatusLine,
    createTutorStubLearnerResponseProvenance,
    extendActiveLearnerTurn,
    initialDropoutPromptEnabled,
    initialMixedLearnerSetupEnabled,
    initialProfilePromptEnabled,
    initialReleaseSpeedPromptEnabled,
    initialTemperaturePromptEnabled,
    input,
    isExiting,
    isProcessingTurn,
    learnerProfileDescription,
    learnerProfileIds,
    learnerProfileListText,
    learnerProfilePrompt,
    learnerProfileSuiteIds,
    latestTutorMessage,
    mixedLearner,
    mixedLearnerPromptText,
    normalizeTutorStubDagFactDropoutRate,
    normalizeTutorStubEngagementStanceTemperature,
    normalizeTutorStubReleaseSpeed,
    oneLine,
    openingEnabled,
    output,
    pendingLearnerLines,
    persistCurrentInteractiveSettings,
    pickInitialMixedLearnerProfileWithKeyboard,
    printMixedLearnerProfilePresentation,
    processLearnerLine,
    registerTemperatureApplies,
    requestExit,
    resetMixedLearnerSuggestion,
    rl,
    setInitialSetupStage,
    setTutorStubReleaseSpeed,
    startMixedLearnerPrefetch,
    state,
  } = dependencies;

  function showMixedLearnerSuggestion({ duringTurn = false } = {}) {
    clearStatusLine();
    if (!mixedLearner.enabled) {
      console.log(`${C.dim}learner suggestions are off; start with --mixed-learner to enable them${C.reset}\n`);
      return;
    }
    if (mixedLearner.suggestion?.text) {
      console.log(
        `${C.cyan}learner suggestion >${C.reset} ${mixedLearner.suggestion.move === 'ask_question' ? 'ask a question' : 'respond'}`,
      );
      printMixedLearnerProfilePresentation(mixedLearner.suggestion);
      console.log(`${mixedLearner.suggestion.text}\n`);
      return;
    }
    if (mixedLearner.pending) {
      console.log(`${C.dim}the learner suggestion is still being drafted; use /suggest again shortly${C.reset}\n`);
      return;
    }
    if (mixedLearner.error) {
      console.log(
        `${C.red}learner suggestion error:${C.reset} ${mixedLearner.error.message}${C.dim} · use /regen to retry${C.reset}\n`,
      );
      return;
    }
    if (duringTurn) {
      console.log(`${C.dim}the tutor is still responding; the next learner suggestion starts afterward${C.reset}\n`);
      return;
    }
    console.log(`${C.dim}no learner suggestion is ready; starting one now${C.reset}\n`);
    startMixedLearnerPrefetch('suggest');
  }

  function showMixedLearnerClue({ duringTurn = false } = {}) {
    clearStatusLine();
    if (!mixedLearner.enabled) {
      console.log(`${C.dim}learner suggestions are off; start with --mixed-learner to use /clue${C.reset}\n`);
      return;
    }
    if (mixedLearner.suggestion?.clue) {
      console.log(
        `${C.cyan}learner clue >${C.reset} ${mixedLearner.suggestion.move === 'ask_question' ? 'ask a question' : 'respond'}`,
      );
      console.log(`${mixedLearner.suggestion.clue}\n`);
      return;
    }
    if (mixedLearner.suggestion?.text) {
      console.log(
        `${C.dim}the answer is ready, but no safe non-revealing clue was returned; /regen retries the pair${C.reset}\n`,
      );
      return;
    }
    if (mixedLearner.pending) {
      console.log(`${C.dim}the clue and learner suggestion are still being drafted${C.reset}\n`);
      return;
    }
    if (mixedLearner.error) {
      console.log(
        `${C.red}learner suggestion error:${C.reset} ${mixedLearner.error.message}${C.dim} · use /regen to retry${C.reset}\n`,
      );
      return;
    }
    if (duringTurn) {
      console.log(`${C.dim}the tutor is still responding; clue generation starts afterward${C.reset}\n`);
      return;
    }
    console.log(`${C.dim}no learner clue is ready; starting the clue and suggestion now${C.reset}\n`);
    startMixedLearnerPrefetch('clue');
  }

  function printMixedLearnerProfileList(listScope = 'core', { picker = false } = {}) {
    const scopeConfig = {
      core: { suite: 'core', label: 'ordinary choices' },
      stress: { suite: 'stress', label: 'specialist failure modes' },
      all: { suite: 'audit', label: 'complete v3 registry' },
      audit: { suite: 'audit', label: 'complete v3 registry' },
    }[
      String(listScope || 'core')
        .trim()
        .toLowerCase()
    ];
    if (!scopeConfig) return false;
    const profileIds = learnerProfileSuiteIds(scopeConfig.suite);
    console.log(`${C.cyan}learner profiles > ${scopeConfig.label} (${profileIds.length})${C.reset}`);
    console.log(learnerProfileListText({ ids: profileIds, includeSuites: false }));
    if (picker) {
      console.log(
        `${C.dim}  choose a learner by entering one profile id above; browse list (ordinary), stress, or all${C.reset}\n`,
      );
    } else if (scopeConfig.suite === 'core') {
      console.log(
        `${C.dim}  specialist profiles: /profile list stress · complete registry: /profile list all${C.reset}\n`,
      );
    } else {
      console.log(`${C.dim}  ordinary choices: /profile list · complete registry: /profile list all${C.reset}\n`);
    }
    return true;
  }

  function handleMixedLearnerProfileCommand(argument = '', { duringTurn = false } = {}) {
    clearStatusLine();
    if (!mixedLearner.enabled) {
      console.log(`${C.dim}learner suggestions are off; start with --mixed-learner to use /profile${C.reset}\n`);
      return;
    }
    const requested = String(argument || '').trim();
    if (!requested) {
      const label = mixedLearner.profileId
        ? `${mixedLearner.profileId}: ${learnerProfileDescription(mixedLearner.profileId)}`
        : `custom: ${oneLine(mixedLearner.profile, { max: 180 })}`;
      console.log(`${C.cyan}learner profile >${C.reset} ${label}`);
      console.log(
        `${C.dim}  use /profile list, /profile list stress, /profile list all, /profile example, /profile <id>, /profile default, or /profile custom <description>${C.reset}\n`,
      );
      return;
    }
    if (requested === 'list' || requested.startsWith('list ')) {
      const listScope = requested.slice('list'.length).trim().toLowerCase() || 'core';
      if (!printMixedLearnerProfileList(listScope)) {
        console.log(`${C.red}unknown learner profile list: ${listScope}${C.reset}`);
        console.log(`${C.dim}  use /profile list, /profile list stress, or /profile list all${C.reset}\n`);
      }
      return;
    }
    if (requested === 'example') {
      console.log(`${C.cyan}custom learner profile example >${C.reset}`);
      console.log(`/profile custom ${CUSTOM_LEARNER_PROFILE_EXAMPLE}`);
      console.log(
        `${C.dim}  describe an observable pattern, its trigger, and the tutor support that permits progress; do not add hidden case facts${C.reset}\n`,
      );
      return;
    }

    let nextProfile;
    let nextProfileId = null;
    if (requested === 'default') {
      nextProfile = mixedLearner.defaultProfile;
      nextProfileId = automatedLearnerProfileId(nextProfile);
    } else if (requested.startsWith('custom ')) {
      nextProfile = requested.slice('custom '.length).trim();
      if (!nextProfile) {
        console.log(`${C.red}profile error:${C.reset} custom profile text is empty\n`);
        return;
      }
    } else {
      nextProfileId = requested.toLowerCase().replace(/-/gu, '_');
      if (!learnerProfileIds().includes(nextProfileId)) {
        console.log(`${C.red}unknown learner profile:${C.reset} ${requested}`);
        console.log(
          `${C.dim}  use /profile list, /profile list stress, or /profile list all to see valid ids${C.reset}\n`,
        );
        return;
      }
      nextProfile = learnerProfilePrompt(nextProfileId);
    }

    const previousProfileId = mixedLearner.profileId;
    const invalidated = resetMixedLearnerSuggestion('profile_changed');
    mixedLearner.profile = nextProfile;
    mixedLearner.profileId = nextProfileId;
    state.learnerProfile = nextProfile;
    state.learnerProfileId = nextProfileId;
    args['auto-learner-profile'] = nextProfile;
    rl.setPrompt(mixedLearnerPromptText());
    const remembered = persistCurrentInteractiveSettings('learner_profile_changed');
    appendTraceEvent(state.trace, {
      type: 'mixed_learner_profile_changed',
      previousProfileId,
      profileId: nextProfileId,
      custom: !nextProfileId,
      duringTurn,
      turn: state.turns.length + 1,
      cacheRefresh: {
        priorStateCleared: Boolean(invalidated?.hadState),
        analysisDiscarded: Boolean(invalidated?.discardedAnalysis),
        tutorResponseDiscarded: Boolean(invalidated?.discardedTutorResponse),
      },
      rememberedAt: remembered?.updatedAt || null,
    });
    const label = nextProfileId ? `${nextProfileId}: ${learnerProfileDescription(nextProfileId)}` : 'custom profile';
    console.log(`${C.cyan}learner profile >${C.reset} switched to ${label}`);
    if (duringTurn) {
      console.log(`${C.dim}  applies when the current tutor response completes${C.reset}\n`);
    } else if (latestTutorMessage(state)) {
      startMixedLearnerPrefetch('profile_changed');
      console.log(
        `${C.dim}  discarded the old clue and suggestion; rebuilding them for the current turn; Tab activates when the new suggestion is ready${C.reset}\n`,
      );
    } else {
      console.log(`${C.dim}  applies after the next tutor message${C.reset}\n`);
    }
  }

  function applyInitialMixedLearnerProfile(profileId, { usedDefault = false, selectionMethod = 'typed' } = {}) {
    if (profileId) {
      mixedLearner.profileId = profileId;
      mixedLearner.profile = learnerProfilePrompt(profileId);
    }
    state.learnerProfileId = mixedLearner.profileId || null;
    state.learnerProfile = mixedLearner.profile;
    args['auto-learner-profile'] = mixedLearner.profile;
    appendTraceEvent(state.trace, {
      type: 'mixed_learner_initial_profile_selected',
      profileId: profileId || null,
      custom: !profileId,
      usedDefault,
      selectionMethod,
    });
  }

  async function runInitialMixedLearnerSetup() {
    if (!initialMixedLearnerSetupEnabled || !mixedLearner.enabled || !openingEnabled || state.history.length)
      return true;
    const defaultProfileId = mixedLearner.profileId || 'custom';
    const keyboardMenuEnabled = Boolean(input.isTTY && output.isTTY && typeof input.setRawMode === 'function');
    if (initialProfilePromptEnabled) {
      console.log(`${C.cyan}Pick a learner profile${C.reset}`);
      if (keyboardMenuEnabled) {
        console.log(
          `${C.dim}  ↑/↓ scroll · Enter select · highlighted learner described below · Esc quit · ${defaultProfileId} selected by default${C.reset}`,
        );
      } else {
        console.log(`${C.dim}  enter a profile id and press Enter, or press Enter for ${defaultProfileId}${C.reset}`);
        console.log(
          `${C.dim}  browse groups: list = ordinary profiles · stress = stress profiles · all = every profile${C.reset}`,
        );
      }
    }

    const queuedLines = [];
    let resolveNextLine = null;
    const enqueueLine = (line) => {
      if (resolveNextLine) {
        const resolve = resolveNextLine;
        resolveNextLine = null;
        resolve(line);
      } else {
        queuedLines.push(line);
      }
    };
    const nextLine = () =>
      queuedLines.length
        ? Promise.resolve(queuedLines.shift())
        : new Promise((resolve) => {
            resolveNextLine = resolve;
          });
    const onLine = (line) => enqueueLine(line);
    const onSigint = () => enqueueLine('/quit');
    let lineListenersAttached = false;
    const attachLineListeners = () => {
      if (lineListenersAttached) return;
      rl.on('line', onLine);
      rl.on('SIGINT', onSigint);
      lineListenersAttached = true;
    };
    try {
      let profileSelected = !initialProfilePromptEnabled;
      if (initialProfilePromptEnabled && keyboardMenuEnabled) {
        const selection = await pickInitialMixedLearnerProfileWithKeyboard(defaultProfileId);
        if (!selection) {
          requestExit('initial_profile_picker_exit');
          return false;
        }
        applyInitialMixedLearnerProfile(selection.id, {
          usedDefault: (selection.id || 'custom') === defaultProfileId,
          selectionMethod: 'keyboard_menu',
        });
        const selectedLabel = selection.id ? `${selection.id} — ${selection.label}` : `custom — ${selection.label}`;
        console.log(`${C.cyan}learner profile >${C.reset} ${selectedLabel}\n`);
        profileSelected = true;
      } else if (initialProfilePromptEnabled) {
        setInitialSetupStage('profile');
        attachLineListeners();
        while (!isExiting()) {
          rl.setPrompt(`${C.bold}learner profile [${defaultProfileId}] >${C.reset} `);
          rl.prompt();
          const answer = await nextLine();
          const rawRequested = String(answer || '')
            .trim()
            .toLowerCase();
          if (rawRequested === '/quit' || rawRequested === 'quit' || rawRequested === 'exit') {
            requestExit('initial_profile_picker_exit');
            return false;
          }
          const requested = rawRequested.replace(/^\/profile(?:\s+|$)/u, '');
          const browseScope =
            requested === 'list' || requested === 'core'
              ? 'core'
              : requested === 'stress' || requested === 'list stress'
                ? 'stress'
                : requested === 'all' || requested === 'audit' || requested === 'list all'
                  ? 'all'
                  : null;
          if (browseScope) {
            printMixedLearnerProfileList(browseScope, { picker: true });
            continue;
          }
          if (!requested) {
            applyInitialMixedLearnerProfile(mixedLearner.profileId, {
              usedDefault: true,
              selectionMethod: 'typed_default',
            });
            console.log();
            profileSelected = true;
            break;
          }
          const profileId = requested.replace(/-/gu, '_');
          if (!learnerProfileIds().includes(profileId)) {
            console.log(`${C.red}unknown learner profile: ${requested}${C.reset}`);
            console.log(`${C.dim}  type list, stress, or all to browse; press Enter for ${defaultProfileId}${C.reset}`);
            continue;
          }
          applyInitialMixedLearnerProfile(profileId, {
            usedDefault: false,
            selectionMethod: 'typed_profile_id',
          });
          console.log();
          profileSelected = true;
          break;
        }
      }
      if (!profileSelected || isExiting()) return false;

      const temperaturePromptEnabled = Boolean(
        initialTemperaturePromptEnabled && state.register?.enabled && registerTemperatureApplies(state.register.policy),
      );
      const dropoutPromptEnabled = Boolean(initialDropoutPromptEnabled && state.learnerDag?.enabled);
      const releaseSpeedPromptEnabled = Boolean(initialReleaseSpeedPromptEnabled && state.world && state.releasePacing);

      const promptForSetting = async ({ stage, label, defaultValue, recommendedValue, guidance, normalize }) => {
        console.log(`${C.dim}  ${guidance}${C.reset}`);
        while (!isExiting()) {
          setInitialSetupStage(stage);
          const defaultLabel =
            defaultValue === recommendedValue
              ? `${defaultValue}; recommended`
              : `${defaultValue}; recommended ${recommendedValue}`;
          rl.setPrompt(`${C.bold}${label} [${defaultLabel}] >${C.reset} `);
          rl.prompt();
          const answer = String((await nextLine()) || '').trim();
          if (['/quit', 'quit', 'exit'].includes(answer.toLowerCase())) {
            requestExit('initial_settings_exit');
            return null;
          }
          if (!answer) return { value: defaultValue, usedDefault: true };
          try {
            return { value: normalize(answer), usedDefault: false };
          } catch (error) {
            console.log(`${C.red}setting error:${C.reset} ${error.message}`);
          }
        }
        return null;
      };

      // First-run model selection was removed (user directive 2026-07-12): the
      // launch/default model is used as-is and stays changeable at runtime via
      // `/settings model`. Record the default in the trace so provenance is
      // unchanged; applying the same ref is a no-op that skips the prefetch.
      const appliedTutorModel = applyTutorModelSelection(state.modelRef, {
        source: 'initial_settings',
        usedDefault: true,
      });
      attachLineListeners();

      if (temperaturePromptEnabled || dropoutPromptEnabled || releaseSpeedPromptEnabled) {
        console.log(`${C.cyan}Tune the dialogue${C.reset}`);
        console.log(`${C.dim}  press Enter to accept each launch value; recommendations are shown beside it${C.reset}`);
      }

      let temperatureSelection = null;
      if (temperaturePromptEnabled) {
        temperatureSelection = await promptForSetting({
          stage: 'temperature',
          label: 'teaching-style range',
          defaultValue: state.register.temperature,
          recommendedValue: DEFAULT_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE,
          guidance: `0.15 strongly concentrates the leading teaching style and part to play; higher values mix in more alternatives (${MIN_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE}-${MAX_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE})`,
          normalize: (value) =>
            normalizeTutorStubEngagementStanceTemperature(value, {
              label: 'teaching-style range',
            }),
        });
        if (!temperatureSelection) return false;
        state.register.temperature = temperatureSelection.value;
        console.log();
      }

      let dropoutSelection = null;
      if (dropoutPromptEnabled) {
        dropoutSelection = await promptForSetting({
          stage: 'dropout',
          label: 'evidence-memory dropout',
          defaultValue: state.learnerDag.dropout.rate,
          recommendedValue: DEFAULT_TUTOR_STUB_DAG_FACT_DROPOUT_RATE,
          guidance:
            '0 keeps previously understood evidence reliable; values above 0 simulate occasional, recoverable forgetting (0-1)',
          normalize: (value) => normalizeTutorStubDagFactDropoutRate(value, { label: 'evidence-memory dropout' }),
        });
        if (!dropoutSelection) return false;
        state.learnerDag.dropout.rate = dropoutSelection.value;
        console.log();
      }

      let releaseSpeedSelection = null;
      if (releaseSpeedPromptEnabled) {
        releaseSpeedSelection = await promptForSetting({
          stage: 'release_speed',
          label: 'clue release speed',
          defaultValue: state.releasePacing.baseSpeed,
          recommendedValue: DEFAULT_TUTOR_STUB_RELEASE_SPEED,
          guidance: `1 follows the authored clue schedule; lower slows it and higher brings clues forward (${MIN_TUTOR_STUB_RELEASE_SPEED}-${MAX_TUTOR_STUB_RELEASE_SPEED}). Direct learner requests can adapt it further.`,
          normalize: (value) => normalizeTutorStubReleaseSpeed(value, { label: 'clue release speed' }),
        });
        if (!releaseSpeedSelection) return false;
        setTutorStubReleaseSpeed({
          pacing: state.releasePacing,
          world: state.world,
          speed: releaseSpeedSelection.value,
          turn: state.turns.length + 1,
        });
        console.log();
      }

      appendTraceEvent(state.trace, {
        type: 'mixed_learner_initial_settings_selected',
        schema: 'machinespirits.tutor-stub.initial-dialogue-settings.v1',
        tutorModel: {
          modelRef: appliedTutorModel.modelRef,
          provider: appliedTutorModel.resolved.provider,
          model: appliedTutorModel.resolved.model,
          recommended: STUB.model,
          usedDefault: true,
          selectionSkipped: true,
        },
        engagementStanceTemperature: temperatureSelection
          ? {
              value: temperatureSelection.value,
              recommended: DEFAULT_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE,
              usedDefault: temperatureSelection.usedDefault,
            }
          : null,
        dagFactDropout: dropoutSelection
          ? {
              value: dropoutSelection.value,
              recommended: DEFAULT_TUTOR_STUB_DAG_FACT_DROPOUT_RATE,
              seed: state.learnerDag.dropout.seed,
              usedDefault: dropoutSelection.usedDefault,
            }
          : null,
        clueReleaseSpeed: releaseSpeedSelection
          ? {
              value: releaseSpeedSelection.value,
              recommended: DEFAULT_TUTOR_STUB_RELEASE_SPEED,
              adaptive: true,
              usedDefault: releaseSpeedSelection.usedDefault,
            }
          : null,
      });
      return true;
    } finally {
      setInitialSetupStage('off');
      if (lineListenersAttached) {
        rl.removeListener('line', onLine);
        rl.removeListener('SIGINT', onSigint);
      }
      resolveNextLine = null;
      rl.setPrompt(mixedLearnerPromptText());
    }
  }

  function acceptMixedLearnerSuggestion({ duringTurn = false } = {}) {
    clearStatusLine();
    if (!mixedLearner.enabled) {
      console.log(`${C.dim}learner suggestions are off; start with --mixed-learner to use /use${C.reset}\n`);
      return;
    }
    if (duringTurn) {
      console.log(
        `${C.dim}tutor is still thinking; /use is available once the current tutor response completes${C.reset}\n`,
      );
      return;
    }
    const suggestion = mixedLearner.suggestion;
    if (!suggestion?.text) {
      showMixedLearnerSuggestion({ duringTurn });
      return;
    }
    const provenance = createTutorStubLearnerResponseProvenance({
      authorship: 'ai',
      origin: 'mixed_suggestion_accepted',
      inputMethod: 'slash_use',
      humanInLoop: true,
      modelRef: state.autoLearner?.modelRef || null,
      provider: suggestion.provider || mixedLearner.resolved?.provider || null,
      model: suggestion.model || mixedLearner.resolved?.model || null,
      learnerProfileId: suggestion.profileId || mixedLearner.profileId || null,
      suggestion: {
        requestId: suggestion.requestId,
        turn: suggestion.turn,
        turnId: suggestion.turnId,
        acceptedUnchanged: true,
        edited: false,
      },
    });
    mixedLearner.suggestion = null;
    mixedLearner.draftInsertion = null;
    appendTraceEvent(state.trace, {
      type: 'mixed_learner_suggestion_accepted',
      turn: suggestion.turn,
      turnId: suggestion.turnId,
      requestId: suggestion.requestId,
      text: suggestion.text,
      move: suggestion.move,
      profileId: suggestion.profileId,
      profileSignal: suggestion.profileSignal,
      learnerResponseProvenance: provenance,
      duringTurn,
    });
    printMixedLearnerProfilePresentation(suggestion, { verb: 'visible in response' });
    console.log(`${C.bold}learner(mixed) >${C.reset} ${suggestion.text}\n`);
    if (isProcessingTurn() || duringTurn) {
      if (extendActiveLearnerTurn(suggestion.text, provenance)) return;
      pendingLearnerLines.push({ text: suggestion.text, provenance });
      console.log(`${C.dim}learner reply queued (${pendingLearnerLines.length} waiting)${C.reset}`);
      return;
    }
    void processLearnerLine(suggestion.text, provenance);
  }

  return {
    acceptMixedLearnerSuggestion,
    applyInitialMixedLearnerProfile,
    handleMixedLearnerProfileCommand,
    printMixedLearnerProfileList,
    runInitialMixedLearnerSetup,
    showMixedLearnerClue,
    showMixedLearnerSuggestion,
  };
}
