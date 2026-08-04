export function createTutorStubPerformanceControlController(dependencies) {
  const {
    C,
    DEFAULT_TUTOR_STUB_LIGHT_ADAPTATION_THRESHOLD,
    EXPLICIT_PERFORMANCE_CLEAR_WORDS,
    TUTOR_STUB_LIGHT_ADAPTATION_SCHEMA,
    appendTraceEvent,
    args,
    clearStatusLine,
    displayDiagnosticLabel,
    explicitPerformanceDirectiveValue,
    getActorialPartDefinitions,
    getEngagementStanceDefinition,
    humanDirectedRegisterPalette,
    isProcessingTurn,
    latestTutorMessage,
    liveSettingsPickerAvailable,
    mixedLearner,
    oneLine,
    persistCurrentInteractiveSettings,
    pickLiveTutorRegisterWithKeyboard,
    plainPolicyLabel,
    resetMixedLearnerSuggestion,
    resolveEngagementStance,
    resolveTutorStubCharacterChoice,
    startMixedLearnerPrefetch,
    state,
  } = dependencies;

  function handleRandomPerformanceCommand(argument = '', { duringTurn = false } = {}) {
    clearStatusLine();
    const action = String(argument || '')
      .trim()
      .toLowerCase();
    if (!state.register?.enabled) {
      console.log(`${C.dim}random performance is unavailable because teaching-style selection is off${C.reset}`);
      console.log(`${C.dim}  start without --no-register-selection to use /random${C.reset}\n`);
      return true;
    }
    if (action && !['on', 'off', 'status'].includes(action)) {
      console.log(`${C.red}random error:${C.reset} use /random, /random on, /random off, or /random status\n`);
      return true;
    }
    const previous = state.randomPerformance?.enabled === true;
    const directedAxes = [
      explicitPerformanceDirectiveValue(state, 'register') ? 'style' : null,
      explicitPerformanceDirectiveValue(state, 'character') ? 'host character' : null,
    ].filter(Boolean);
    const randomAxes = ['style', 'host character'].filter((axis) => !directedAxes.includes(axis));
    if (action === 'status') {
      console.log(`${C.brightMagenta}${C.bold}random performance >${C.reset} ${previous ? 'on' : 'off'}`);
      console.log(
        `${C.dim}  ${
          previous
            ? randomAxes.length
              ? `${randomAxes.join(' and ')} ${randomAxes.length === 1 ? 'is' : 'are'} sampled without learner-assessment influence${directedAxes.length ? `; directed ${directedAxes.join(' and ')} remains locked` : ''}`
              : 'both performance axes are explicitly directed, so no random draw is currently active'
            : 'the configured adaptive teaching approach controls every axis that is not explicitly directed'
        }; evidence release, action choice, closure, and response safety remain active${C.reset}\n`,
      );
      return true;
    }
    const enabled = action === 'on' ? true : action === 'off' ? false : !previous;
    if (enabled === previous) {
      console.log(`${C.brightMagenta}${C.bold}random performance >${C.reset} already ${enabled ? 'on' : 'off'}\n`);
      return true;
    }
    state.randomPerformance = {
      schema: 'machinespirits.tutor-stub.random-performance-mode.v1',
      enabled,
      scope: ['engagement_stance', 'actorial_part'],
      assessmentInfluence: false,
      sessionOnly: true,
    };
    const turnInProgress = Boolean(duringTurn || isProcessingTurn());
    const effectiveTurn = state.turns.length + 1;
    const invalidated = turnInProgress ? null : resetMixedLearnerSuggestion('random_performance_mode_changed');
    appendTraceEvent(state.trace, {
      type: 'random_performance_mode_changed',
      schema: 'machinespirits.tutor-stub.random-performance-mode-change.v1',
      previous,
      enabled,
      effectiveTurn,
      effectiveSelection: turnInProgress ? 'next_not_yet_completed_selection' : 'next_selection',
      duringTurn: turnInProgress,
      assessmentInfluence: {
        engagementStance: false,
        actorialPart: false,
        actionAndSafetyPipeline: true,
      },
      cacheRefresh: invalidated
        ? {
            priorStateCleared: Boolean(invalidated.hadState),
            analysisDiscarded: Boolean(invalidated.discardedAnalysis),
            tutorResponseDiscarded: Boolean(invalidated.discardedTutorResponse),
          }
        : { deferredUntilCurrentTurnCompletes: turnInProgress },
      publicTranscriptChanged: false,
    });
    console.log(`${C.brightMagenta}${C.bold}random performance >${C.reset} ${enabled ? 'on' : 'off'}`);
    console.log(
      `${C.dim}  ${
        enabled
          ? randomAxes.length
            ? `${randomAxes.join(' and ')} will change randomly without learner-assessment influence${directedAxes.length ? `; directed ${directedAxes.join(' and ')} remains locked` : ''}`
            : 'both performance axes are explicitly directed, so /random is armed but has no active axis'
          : directedAxes.length
            ? `directed ${directedAxes.join(' and ')} remains locked; every other performance axis returns to ${plainPolicyLabel(state.register?.policy)}`
            : `style and host character return to ${plainPolicyLabel(state.register?.policy)}`
      }; applies to the ${turnInProgress ? 'next teaching-style selection not already completed' : `next turn (${effectiveTurn})`}${C.reset}`,
    );
    console.log(
      `${C.dim}  evidence release, teaching action, dialogue closure, and response safety still use the normal harness${C.reset}`,
    );
    if (mixedLearner.enabled && !turnInProgress && latestTutorMessage(state)) {
      startMixedLearnerPrefetch('random_performance_mode_changed');
      console.log(`${C.dim}  rebuilding the learner suggestion and next tutor response${C.reset}`);
    }
    console.log();
    return true;
  }

  function handleLightAdaptationCommand(argument = '', { duringTurn = false } = {}) {
    clearStatusLine();
    const action = String(argument || '')
      .trim()
      .toLowerCase();
    if (!state.register?.enabled) {
      console.log(`${C.dim}light adaptation is unavailable because teaching-style selection is off${C.reset}`);
      console.log(`${C.dim}  start without --no-register-selection to use /light${C.reset}\n`);
      return true;
    }
    if (action && !['on', 'off', 'status'].includes(action)) {
      console.log(`${C.red}light error:${C.reset} use /light, /light on, /light off, or /light status\n`);
      return true;
    }
    const previous = state.lightAdaptation?.enabled === true;
    const threshold = state.lightAdaptation?.threshold ?? DEFAULT_TUTOR_STUB_LIGHT_ADAPTATION_THRESHOLD;
    if (action === 'status') {
      console.log(`${C.brightMagenta}${C.bold}light adaptation >${C.reset} ${previous ? 'on' : 'off'}`);
      console.log(
        `${C.dim}  after ${threshold} consecutive learner turns showing confusion or frustration, style and host character are sampled with seeded replayable draws and must differ from the previous pair when alternatives exist${C.reset}`,
      );
      console.log(
        `${C.dim}  this trigger outranks /register, /character, /random, and the deeper adaptive policy for those two axes only; authored evidence, teaching action, closure, and response safety remain active${C.reset}\n`,
      );
      return true;
    }
    const enabled = action === 'on' ? true : action === 'off' ? false : !previous;
    if (enabled === previous) {
      console.log(`${C.brightMagenta}${C.bold}light adaptation >${C.reset} already ${enabled ? 'on' : 'off'}\n`);
      return true;
    }
    state.lightAdaptation = {
      ...state.lightAdaptation,
      schema: TUTOR_STUB_LIGHT_ADAPTATION_SCHEMA,
      enabled,
      threshold,
      scope: ['engagement_stance', 'actorial_part'],
      trigger: 'continued_learner_confusion_or_frustration',
      selectionMethod: 'seeded_uniform_excluding_previous',
      rememberedPreference: true,
    };
    const turnInProgress = Boolean(duringTurn || isProcessingTurn());
    const effectiveTurn = state.turns.length + 1;
    const invalidated = turnInProgress ? null : resetMixedLearnerSuggestion('light_adaptation_mode_changed');
    const remembered = persistCurrentInteractiveSettings('light_adaptation_mode_changed');
    appendTraceEvent(state.trace, {
      type: 'light_adaptation_mode_changed',
      schema: 'machinespirits.tutor-stub.light-adaptation-mode-change.v1',
      previous,
      enabled,
      threshold,
      effectiveTurn,
      effectiveSelection: turnInProgress ? 'next_not_yet_completed_selection' : 'next_selection',
      duringTurn: turnInProgress,
      publicTranscriptChanged: false,
      rememberedAt: remembered?.updatedAt || null,
      cacheRefresh: invalidated
        ? {
            priorStateCleared: Boolean(invalidated.hadState),
            analysisDiscarded: Boolean(invalidated.discardedAnalysis),
            tutorResponseDiscarded: Boolean(invalidated.discardedTutorResponse),
          }
        : { deferredUntilCurrentTurnCompletes: turnInProgress },
    });
    console.log(`${C.brightMagenta}${C.bold}light adaptation >${C.reset} ${enabled ? 'on' : 'off'}`);
    console.log(
      `${C.dim}  ${
        enabled
          ? `after ${threshold} consecutive confused/frustrated learner turns, the next style and host character shift stochastically`
          : `the configured ${plainPolicyLabel(state.register?.policy)} approach now controls adaptation without this unconditional shift`
      }; applies to the ${turnInProgress ? 'next teaching-style selection not already completed' : `next turn (${effectiveTurn})`}${C.reset}`,
    );
    console.log(
      `${C.dim}  seeded draws are replayable; authored evidence, teaching action, dialogue closure, and response safety stay in control${C.reset}`,
    );
    if (remembered) console.log(`${C.dim}  remembered as the default for the next interactive session${C.reset}`);
    if (mixedLearner.enabled && !turnInProgress && latestTutorMessage(state)) {
      startMixedLearnerPrefetch('light_adaptation_mode_changed');
      console.log(`${C.dim}  rebuilding the learner suggestion and next tutor response${C.reset}`);
    }
    console.log();
    return true;
  }

  function handleCommitteeCommand(argument = '', { duringTurn = false } = {}) {
    clearStatusLine();
    const action = String(argument || '')
      .trim()
      .toLowerCase();
    if (action && !['on', 'off', 'status'].includes(action)) {
      console.log(
        `${C.red}committee error:${C.reset} use /committee, /committee on, /committee off, or /committee status\n`,
      );
      return true;
    }
    const previous = state.committee?.enabled === true;
    if (action === 'status') {
      console.log(`${C.brightMagenta}${C.bold}learned committee >${C.reset} ${previous ? 'on' : 'off'}`);
      console.log(
        `${C.dim}  ${
          previous
            ? `${state.committee.miniModel} supplies a warrant question only when the detector finds a warrant gap; fallback ${state.committee.fallbackPolicy}`
            : 'the frontier tutor writes every response without the learned Qwen warrant specialist'
        } · /committee toggles${C.reset}\n`,
      );
      return true;
    }
    if (duringTurn || isProcessingTurn()) {
      console.log(`${C.dim}committee mode can change after the tutor response already in flight completes${C.reset}\n`);
      return true;
    }
    const enabled = action === 'on' ? true : action === 'off' ? false : !previous;
    if (enabled === previous) {
      console.log(`${C.brightMagenta}${C.bold}learned committee >${C.reset} already ${enabled ? 'on' : 'off'}\n`);
      return true;
    }
    state.committee.enabled = enabled;
    state.pointOfAction.enabled = enabled;
    state.pointOfAction.arm = enabled ? 'committee' : null;
    state.pointOfAction.current = null;
    args['point-of-action-arm'] = enabled ? 'committee' : '';
    const effectiveTurn = state.turns.length + 1;
    const invalidated = resetMixedLearnerSuggestion('committee_mode_changed');
    const remembered = persistCurrentInteractiveSettings('committee_mode_changed', { committeeEnabled: enabled });
    appendTraceEvent(state.trace, {
      type: 'committee_mode_changed',
      schema: 'machinespirits.tutor-stub.committee-mode-change.v1',
      previous,
      enabled,
      effectiveTurn,
      miniModel: state.committee.miniModel,
      spanInterface: state.committee.spanInterface,
      fallbackPolicy: state.committee.fallbackPolicy,
      cacheRefresh: {
        priorStateCleared: Boolean(invalidated?.hadState),
        analysisDiscarded: Boolean(invalidated?.discardedAnalysis),
        tutorResponseDiscarded: Boolean(invalidated?.discardedTutorResponse),
      },
      remembered: Boolean(remembered),
      publicTranscriptChanged: false,
    });
    console.log(`${C.brightMagenta}${C.bold}learned committee >${C.reset} ${enabled ? 'on' : 'off'}`);
    console.log(
      `${C.dim}  ${
        enabled
          ? `${state.committee.miniModel} will supply warrant-gap questions; the frontier composes around them and fallback ${state.committee.fallbackPolicy} remains fail-closed`
          : 'the frontier tutor will write every response without the learned Qwen specialist'
      }; applies from turn ${effectiveTurn}${remembered ? ' · remembered for next time' : ' · this session only'}${C.reset}`,
    );
    if (mixedLearner.enabled && latestTutorMessage(state)) {
      startMixedLearnerPrefetch('committee_mode_changed');
      console.log(`${C.dim}  rebuilding the learner suggestion and next tutor response${C.reset}`);
    }
    console.log();
    return true;
  }

  function tutorCharacterDisplayLabel(characterId, definitions = getActorialPartDefinitions()) {
    if (!characterId) return 'Automatic';
    const label = definitions[characterId]?.label || displayDiagnosticLabel(characterId);
    return String(label || '').replace(/^./u, (character) => character.toUpperCase());
  }

  function tutorCharacterPlainEffect(characterId) {
    return (
      {
        scene_partner: 'work through the problem alongside you',
        examiner: 'ask you to inspect and test the evidence',
        record_keeper: 'organize the shared record and keep its distinctions clear',
        advocate: 'present the strongest version of the live case',
        skeptic: 'test claims before accepting them',
        satirist: 'spot polished contradictions and expose them through irony or dry sarcasm',
        adversarial_teacher: 'actively test your ideas with subject-based counterexamples or alternatives',
        exacting_schoolmaster: 'ask for one precise, subject-appropriate piece of work',
      }[characterId] || 'use the selected character'
    );
  }

  function handleExplicitPerformanceDirectiveCommand(
    axis,
    argument = '',
    { duringTurn = false, deferMixedPrefetch = false } = {},
  ) {
    clearStatusLine();
    const command = axis === 'register' ? '/register' : '/character';
    const publicAxis = axis === 'register' ? 'teaching style' : 'tutor character';
    if (!state.register?.enabled) {
      console.log(`${C.dim}${publicAxis} direction is unavailable because teaching-style selection is off${C.reset}`);
      console.log(`${C.dim}  start without --no-register-selection to use ${command}${C.reset}\n`);
      return true;
    }

    if (axis === 'register' && !String(argument || '').trim() && liveSettingsPickerAvailable() && !duringTurn) {
      console.log(
        `${C.brightMagenta}${C.bold}Tutor register · choose how the voice sounds with ↑/↓ and Enter${C.reset}`,
      );
      return pickLiveTutorRegisterWithKeyboard(explicitPerformanceDirectiveValue(state, 'register') || 'auto').then(
        (selection) => {
          if (!selection) return { suppressReprise: true, selected: false };
          return Promise.resolve(
            handleExplicitPerformanceDirectiveCommand('register', selection.id, { duringTurn: false }),
          ).then((outcome) => ({
            ...(outcome && typeof outcome === 'object' ? outcome : {}),
            suppressReprise: true,
            selected: true,
            value: selection.id,
          }));
        },
      );
    }

    const rawAction = String(argument || '')
      .trim()
      .toLowerCase();
    const normalizedAction = rawAction.replace(/[\s-]+/gu, '_');
    const current = explicitPerformanceDirectiveValue(state, axis);
    const characterChoice = resolveTutorStubCharacterChoice(rawAction);
    const definitions = characterChoice.definitions;
    const characterOptions = characterChoice.options;
    const resolvedRegister = resolveEngagementStance(normalizedAction)?.register || normalizedAction;
    const requestedValue = axis === 'register' ? resolvedRegister : characterChoice.id;
    const options = axis === 'register' ? humanDirectedRegisterPalette() : characterOptions;

    if (!rawAction || rawAction === 'status') {
      console.log(`${C.brightMagenta}${C.bold}${publicAxis} direction >${C.reset} ${current || 'auto'}`);
      if (axis === 'register') {
        for (const option of options) {
          const definition = getEngagementStanceDefinition(option) || {};
          const group = definition.simulated_only
            ? 'simulated-only'
            : definition.router_selectable
              ? 'adaptive-core'
              : 'full-range';
          console.log(
            `${C.dim}  ${option.padEnd(13)} [${group}] ${oneLine(
              definition.public_signature || definition.stance_contract,
              { max: 120 },
            )}${C.reset}`,
          );
        }
        console.log(`${C.dim}  register changes how the tutor sounds; character changes what it does${C.reset}`);
      } else {
        for (const option of options) {
          console.log(
            `${C.dim}  ${option.padEnd(15)} ${definitions[option]?.label || displayDiagnosticLabel(option)}${C.reset}`,
          );
        }
      }
      console.log(
        `${C.dim}  ${command} <choice> locks this axis · ${command} auto returns it to ${state.randomPerformance?.enabled ? '/random or ' : ''}the adaptive teaching approach${C.reset}\n`,
      );
      return true;
    }

    const clearing = EXPLICIT_PERFORMANCE_CLEAR_WORDS.has(rawAction);
    if (axis === 'register' && !clearing && getEngagementStanceDefinition(requestedValue)?.simulated_only === true) {
      console.log(
        `${C.red}${publicAxis} error:${C.reset} ${requestedValue} is a simulated-only evaluation condition and cannot be used in an interactive learner session\n`,
      );
      return true;
    }
    if (!clearing && !options.includes(requestedValue)) {
      console.log(`${C.red}${publicAxis} error:${C.reset} choose ${options.join(', ')}, or use ${command} auto\n`);
      return true;
    }
    const next = clearing ? null : requestedValue;
    if (next === current) {
      const displayValue = axis === 'character' ? tutorCharacterDisplayLabel(next, definitions) : next || 'auto';
      console.log(`${C.brightMagenta}${C.bold}${publicAxis} >${C.reset} already ${displayValue}\n`);
      return true;
    }

    state.performanceDirectives = {
      ...state.performanceDirectives,
      schema: 'machinespirits.tutor-stub.explicit-performance-directives.v1',
      [axis]: next,
      sessionOnly: true,
      precedence: 'explicit_axis_then_random_axis_then_adaptive_policy',
    };
    const turnInProgress = Boolean(duringTurn || isProcessingTurn());
    const effectiveTurn = state.turns.length + 1;
    const reason = `explicit_${axis}_directive_changed`;
    const invalidated = turnInProgress ? null : resetMixedLearnerSuggestion(reason);
    appendTraceEvent(state.trace, {
      type: 'explicit_performance_directive_changed',
      schema: 'machinespirits.tutor-stub.explicit-performance-directive-change.v1',
      axis: axis === 'register' ? 'engagement_stance' : 'actorial_part',
      previous: current,
      value: next,
      effectiveTurn,
      effectiveSelection: turnInProgress ? 'next_not_yet_completed_selection' : 'next_selection',
      duringTurn: turnInProgress,
      randomPerformanceEnabled: state.randomPerformance?.enabled === true,
      precedence: 'explicit_axis_then_random_axis_then_adaptive_policy',
      assessmentInfluence: false,
      cacheRefresh: invalidated
        ? {
            priorStateCleared: Boolean(invalidated.hadState),
            analysisDiscarded: Boolean(invalidated.discardedAnalysis),
            tutorResponseDiscarded: Boolean(invalidated.discardedTutorResponse),
          }
        : { deferredUntilCurrentTurnCompletes: turnInProgress },
      publicTranscriptChanged: false,
    });

    if (axis === 'character') {
      console.log(
        `${C.brightMagenta}${C.bold}tutor character >${C.reset} ${tutorCharacterDisplayLabel(next, definitions)}`,
      );
      if (next) {
        console.log(`${C.dim}  Tutor replies will ${tutorCharacterPlainEffect(next)}.${C.reset}`);
        const defaultStances = getActorialPartDefinitions()[next]?.default_engagement_stances || [];
        if (defaultStances.length) {
          console.log(
            `${C.dim}  When /register is automatic, this character defaults to ${defaultStances.join(
              ' or ',
            )}; an explicit /register choice still wins.${C.reset}`,
          );
        }
        console.log(`${C.dim}  Clue-givers and the closing scene may temporarily use another character.${C.reset}`);
        console.log(`${C.dim}  Choose Tutor → Auto, or type /tutor auto, to return to adaptive selection.${C.reset}`);
      } else {
        console.log(
          `${C.dim}  The tutor can now choose its character ${
            state.randomPerformance?.enabled ? 'through random variation' : 'as the conversation changes'
          }.${C.reset}`,
        );
      }
      if (turnInProgress) {
        console.log(`${C.dim}  This starts after the current tutor reply.${C.reset}`);
      }
    } else {
      console.log(`${C.brightMagenta}${C.bold}${publicAxis} direction >${C.reset} ${next || 'auto'}`);
      const definition = next ? getEngagementStanceDefinition(next) : null;
      if (definition?.public_signature) {
        console.log(
          `${C.dim}  Tutor replies will sound distinct in this way: ${oneLine(definition.public_signature)}${C.reset}`,
        );
      }
      if (definition?.router_selectable === false) {
        console.log(
          `${C.dim}  This is a full-range ${definition.valence || 'dramatic'} register; conservative --safe-registers routing omits it, while full-range policies and /random may choose it.${C.reset}`,
        );
      }
      console.log(
        `${C.dim}  ${
          next
            ? `${publicAxis} is locked for subsequent tutor turns`
            : `${publicAxis} returns to ${state.randomPerformance?.enabled ? 'the /random draw' : plainPolicyLabel(state.register?.policy)}`
        }; applies to the ${turnInProgress ? 'next selection not already completed' : `next turn (${effectiveTurn})`}${C.reset}`,
      );
      console.log(
        `${C.dim}  the tutor character still follows its own command, /random, or the adaptive policy; evidence, closure, and response safety remain active${C.reset}`,
      );
    }
    if (mixedLearner.enabled && !turnInProgress && latestTutorMessage(state) && !deferMixedPrefetch) {
      startMixedLearnerPrefetch(reason);
      console.log(`${C.dim}  rebuilding the learner suggestion and next tutor response${C.reset}`);
    }
    console.log();
    return {
      handled: true,
      changed: true,
      axis,
      previous: current,
      value: next,
      reason,
      turnInProgress,
      mixedPrefetchDeferred: Boolean(deferMixedPrefetch && mixedLearner.enabled && !turnInProgress),
    };
  }

  return {
    handleCommitteeCommand,
    handleExplicitPerformanceDirectiveCommand,
    handleLightAdaptationCommand,
    handleRandomPerformanceCommand,
    tutorCharacterDisplayLabel,
    tutorCharacterPlainEffect,
  };
}
