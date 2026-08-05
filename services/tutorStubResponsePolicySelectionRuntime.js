export function createTutorStubResponsePolicySelectionRuntime(dependencies = {}) {
  const {
    EXPLICIT_PERFORMANCE_CLEAR_WORDS,
    NEGATIVE_FLOOR_REGISTERS,
    args,
    automatedLearnerProfileId,
    committedReleaseRows,
    currentReleaseRows,
    displayDiagnosticLabel,
    getActorialPartDefinitions,
    getEngagementStanceDefinition,
    hasExplicitStepwiseSignal,
    latestFieldStateMismatch,
    latestRegisterSelection,
    normalizeTutorStubActorialPartId,
    oneLine,
    preferredLegacyRegister,
    recentRegisterCount,
    registerEfficacyFromDagProgress,
    registerTemperatureApplies,
    sampleTutorStubPolicyDistribution,
    selectTutorStubActorialPart,
    tutorStubConfigurableActorialPartIds,
    tutorStubRandomizableActorialPartIds,
  } = dependencies;

  function registerSelectionFromCombinedAnalysis(raw) {
    const parsed = raw?.parsed || {};
    return parsed.register_selection || parsed.registerSelection || parsed.tutor_register || parsed.register || null;
  }

  function evaluatePendingRegisterEfficacy(state, currentDagResult, classification = null, tutorFeedback = null) {
    if (!state.register?.enabled || !currentDagResult?.model) return null;
    const pending = [...state.register.history]
      .reverse()
      .find((entry) => !entry.efficacy && entry.turn < currentDagResult.model.turn);
    if (!pending) return null;
    pending.efficacy = registerEfficacyFromDagProgress({
      selection: pending,
      currentModel: currentDagResult.model,
      accepted: currentDagResult.accepted,
      state,
      classification,
      tutorFeedback,
    });
    return pending.efficacy;
  }

  function firstAvailableRegister(palette, names, fallback = 'precise') {
    for (const name of names) {
      if (palette.has(name)) return name;
    }
    return palette.has(fallback) ? fallback : [...palette][0] || fallback;
  }

  function briskRepeatPenalty(state) {
    const latest = latestRegisterSelection(state);
    const latestBad =
      latest?.selected_register === 'brisk' &&
      /no_clear_progress|regression_or_overreach/.test(latest.efficacy?.label || '');
    return Boolean(latestBad || recentRegisterCount(state, 'brisk') >= 2);
  }

  function shouldUseDynamicBrisk({ state, classification, assessment }) {
    const bottleneck = assessment.bottleneck || '';
    const hasDagGap = /release_or_pacing_gap|inference_gap/.test(bottleneck);
    const explicitStepwise = hasExplicitStepwiseSignal(classification);
    const latestMismatch = latestFieldStateMismatch(state);
    if (/field_without_dag|dag_without_field/.test(latestMismatch || '') && !explicitStepwise) return false;
    if (!hasDagGap || !explicitStepwise) return false;
    if (briskRepeatPenalty(state) && !explicitStepwise) return false;
    return true;
  }

  function fallbackRegisterSelection({ state, classification, tutorLearnerDag }) {
    const palette = new Set(state.register?.palette || []);
    const policy = state.register?.policy || 'dynamic';
    const assessment = tutorLearnerDag?.model?.assessment || {};
    const requestType = classification?.turn?.request_type || 'unknown_request';
    const move = classification?.turn?.discourse_move || 'unknown';
    const stance = classification?.turn?.epistemic_stance || 'unknown';
    const evidenceUse = classification?.turn?.evidence_use || 'unknown';
    const agency = classification?.turn?.agency || 'unknown';
    const latestMismatch = latestFieldStateMismatch(state);
    let selected = 'precise';
    let actionFamily = 'clarify_distinction';
    let reason = '';
    let expectedFieldMove = '';

    if (palette.has('witnessing') && /vulnerable|affective/.test(`${move} ${stance}`)) {
      selected = 'witnessing';
      actionFamily = 'receive_vulnerability';
      reason = 'The reviewer sees affective exposure as the strongest current public cue.';
      expectedFieldMove = 'Lower learner risk enough for a concrete public-evidence move to become possible.';
    } else if (
      palette.has('precise') &&
      /challenge|omits_warrant|overleaps_evidence|distorts_public_evidence/.test(`${move} ${evidenceUse}`)
    ) {
      selected = 'precise';
      actionFamily = 'answer_accountably';
      reason =
        'The learner is challenging or overleaping the public evidence, so the tutor should hold the bid accountable.';
      expectedFieldMove = 'Shift from unsupported assertion toward a publicly warranted claim.';
    } else if (policy === 'dynamic' && latestMismatch === 'field_without_dag') {
      selected = firstAvailableRegister(palette, ['plain', 'precise', 'charismatic']);
      actionFamily = requestType === 'transfer_demand_or_named_material' ? 'ground_in_material' : 'compress_sayback';
      reason =
        'The previous register improved the learner field without proof-DAG movement; convert that preparatory movement into one public evidence claim.';
      expectedFieldMove = 'Turn improved orientation or agency into a learner-owned public-record statement.';
    } else if (policy === 'dynamic' && latestMismatch === 'dag_without_field') {
      selected = firstAvailableRegister(palette, ['plain', 'precise', 'witnessing']);
      actionFamily = 'compress_sayback';
      reason =
        'The proof-DAG advanced while learner field movement flattened; ask the learner to own the reason for the step before pushing another premise.';
      expectedFieldMove = 'Recover agency and explanatory ownership around the evidence just adopted.';
    } else if (
      palette.has('charismatic') &&
      /resistant|overconfident|answer_seeking|complying|passive/.test(`${stance} ${evidenceUse} ${agency}`)
    ) {
      selected = 'charismatic';
      actionFamily = 'challenge_resistance';
      reason =
        'Low-agency, answer-seeking, or overconfident posture warrants a compact challenge rather than another stepwise hint.';
      expectedFieldMove = 'Increase learner agency or evidence-seeking without supplying the concealed answer.';
    } else if (
      policy === 'dynamic' &&
      palette.has('brisk') &&
      shouldUseDynamicBrisk({ state, classification, assessment })
    ) {
      selected = 'brisk';
      actionFamily = 'stage_next_step';
      reason = 'The learner is explicitly asking for stepwise help on the immediate evidence move.';
      expectedFieldMove = 'Make the next learner-owned inference easier without turning it into a menu or answer.';
    } else if (!palette.has(selected)) {
      selected = firstAvailableRegister(palette, ['precise', 'charismatic', 'plain', 'warm', 'witnessing', 'brisk']);
    }

    if (!reason) {
      reason =
        policy === 'dynamic' && selected !== 'brisk'
          ? 'Dynamic fallback selected after missing or invalid model register output; brisk pacing is non-default.'
          : 'Fallback register selected after missing or invalid model register output.';
    }
    if (!expectedFieldMove) {
      expectedFieldMove = 'Improve the learner field enough that the next public evidence move becomes more likely.';
    }

    return {
      selected_register: selected,
      request_type: requestType,
      action_family: actionFamily,
      legacy_selected_register: preferredLegacyRegister({ register: selected, requestType, actionFamily }),
      reviewer_signal: `${requestType}; ${move}`,
      register_reason: reason,
      evidence_span: classification?.turn?.summary || '',
      risk_flags: [],
      expected_dag_move: 'Elicit one public, checkable learner move that can update the learner-DAG record.',
      expected_field_move: expectedFieldMove,
      expected_progress_marker:
        'Next learner turn adopts staged evidence, voices a derivable inference, or corrects an overreach.',
      confidence: 0.25,
      warning: 'fallback_register_selection',
      source: 'local_fallback_register_selection',
    };
  }

  function fixedBlandEngagementStanceSelection({ state, classification }) {
    const palette = new Set(state.register?.palette || []);
    const selected = firstAvailableRegister(palette, ['plain', 'precise', 'brisk']);
    const requestType = classification?.turn?.request_type || 'bland_baseline';
    return {
      selected_register: selected,
      request_type: requestType,
      action_family: 'baseline_plain_response',
      legacy_selected_register: preferredLegacyRegister({
        register: selected,
        requestType,
        actionFamily: 'baseline_plain_response',
      }),
      reviewer_signal: 'fixed_bland_policy',
      register_reason:
        selected === 'plain'
          ? 'Bland policy fixes a plain non-adaptive baseline register.'
          : 'Bland policy requested plain, but the active palette did not include it; selected the nearest available baseline register.',
      evidence_span: classification?.turn?.summary || '',
      risk_flags: [],
      expected_dag_move: 'No adaptive register-specific DAG move is predicted for the bland baseline.',
      expected_field_move:
        'Use the fixed plain stance as a control condition for comparison with adaptive register policies.',
      expected_progress_marker: 'Observe learner-DAG and field movement without adaptive register selection.',
      confidence: null,
      source: 'fixed_bland_register_policy',
    };
  }

  function policySamplingContext(state, decisionKind, { policy = null } = {}) {
    const experiment = state.experiment || {};
    return {
      runSeed: experiment.runSeed ?? 1,
      profile: experiment.profile || automatedLearnerProfileId(args['auto-learner-profile']) || 'custom',
      policy: policy || state.register?.policy || 'unknown',
      repeat: experiment.repeat ?? 1,
      learnerTurn: state.turns.length + 1,
      decisionKind,
      jobId: experiment.jobId || null,
    };
  }

  function uniformEngagementStanceDistribution(registers) {
    const probability = registers.length ? 1 / registers.length : 0;
    return registers.map((register) => ({ register, weight: 1, probability }));
  }

  function explicitPerformanceDirectiveValue(state, axis) {
    const value = String(state.performanceDirectives?.[axis] || '').trim();
    return value || null;
  }

  function resolveTutorStubCharacterChoice(value) {
    const raw = String(value || '')
      .trim()
      .toLowerCase();
    const normalized = raw.replace(/[\s-]+/gu, '_');
    const definitions = getActorialPartDefinitions();
    const options = tutorStubConfigurableActorialPartIds();
    const byLabel = Object.fromEntries(
      options.map((id) => [
        String(definitions[id]?.label || id)
          .toLowerCase()
          .replace(/[\s-]+/gu, '_'),
        id,
      ]),
    );
    return {
      raw,
      normalized,
      definitions,
      options,
      clearing: EXPLICIT_PERFORMANCE_CLEAR_WORDS.has(raw),
      id: normalizeTutorStubActorialPartId(byLabel[normalized] || normalized),
    };
  }

  function explicitEngagementStanceSelection({ classification, stance }) {
    const definition = getEngagementStanceDefinition(stance) || {};
    const distribution = [
      {
        engagement_stance: stance,
        register: stance,
        weight: 1,
        probability: 1,
        sourceScore: 1,
      },
    ];
    const requestType = classification?.turn?.request_type || 'explicit_register_directive';
    return {
      selected_register: stance,
      engagement_stance: stance,
      request_type: requestType,
      action_family: null,
      legacy_selected_register: preferredLegacyRegister({
        register: stance,
        requestType,
        actionFamily: null,
      }),
      reviewer_signal: 'explicit_register_directive',
      register_reason: `The session explicitly directed the engagement stance to ${stance} with /register; learner assessment still selects the independent teaching action, audience, language, and scene axes.`,
      evidence_span: classification?.turn?.summary || '',
      risk_flags: Array.isArray(definition.risk_flags) ? [...definition.risk_flags] : [],
      expected_dag_move: 'Follow the normal public-evidence and learner-DAG plan without changing the directed stance.',
      expected_field_move: 'Observe the learner response without letting the assessment replace the directed stance.',
      expected_progress_marker: 'Measure the next learner move under the explicitly directed stance.',
      confidence: 1,
      source: 'explicit_register_directive',
      distribution,
      engagement_stance_distribution: distribution,
      selected_probability: 1,
      explicit_directive: {
        schema: 'machinespirits.tutor-stub.explicit-performance-directive.v1',
        axis: 'engagement_stance',
        value: stance,
        applied: true,
        assessment_influence: false,
      },
    };
  }

  function explicitPerformanceActorialPartSelection({ inputs, baseSelection, character }) {
    if (!baseSelection) return baseSelection;
    if (baseSelection.locked === true) {
      return {
        ...baseSelection,
        explicit_directive: {
          schema: 'machinespirits.tutor-stub.explicit-performance-directive.v1',
          axis: 'actorial_part',
          value: character,
          applied: false,
          assessment_influence: false,
          outcome: 'structural_lock',
          reason: baseSelection.lock_reason || 'licensed_closeout',
        },
      };
    }
    const selected = tutorStubRandomizableActorialPartIds().includes(character)
      ? selectTutorStubActorialPart({
          ...inputs,
          selectedPartOverride: character,
        })
      : {
          ...baseSelection,
          id: character,
          label: oneLine(getActorialPartDefinitions()[character]?.label) || displayDiagnosticLabel(character),
          contract: oneLine(getActorialPartDefinitions()[character]?.contract),
        };
    return {
      ...selected,
      probability: 1,
      score: null,
      temperature: null,
      pre_directive_distribution: selected.distribution,
      distribution: [{ part: character, weight: 1, probability: 1 }],
      drivers: [],
      reason: `The session explicitly directed the host character to ${character} with /character; learner assessment still selects the independent teaching action, audience, language, and scene axes.`,
      selection_method: 'explicit_character_directive',
      explicit_directive: {
        schema: 'machinespirits.tutor-stub.explicit-performance-directive.v1',
        axis: 'actorial_part',
        value: character,
        applied: true,
        assessment_influence: false,
      },
    };
  }

  function performanceTemperatureScope({
    policy,
    explicitRegister,
    explicitCharacter,
    randomStance,
    randomCharacter,
    lightStance = false,
    lightCharacter = false,
  }) {
    const axes = [];
    if (!explicitRegister && !randomStance && !lightStance) axes.push('engagement_stance');
    if (!explicitCharacter && !randomCharacter && !lightCharacter) axes.push('actorial_part');
    if (!axes.length) {
      return {
        applied: false,
        scope:
          lightStance && lightCharacter
            ? 'bypassed_for_light_adaptation_engagement_stance_and_actorial_part'
            : randomStance && randomCharacter
              ? 'bypassed_for_random_engagement_stance_and_actorial_part'
              : 'bypassed_by_explicit_or_random_directives',
      };
    }
    if (!registerTemperatureApplies(policy)) {
      return { applied: false, scope: 'saved_but_not_used_by_policy' };
    }
    return {
      applied: true,
      scope: axes.join('_and_'),
    };
  }

  function randomEngagementStanceSelection({ state, classification, performanceMode = false, lightAdaptation = null }) {
    const lightMode = lightAdaptation?.triggered === true;
    const activePalette = state.register?.palette || [];
    const humanUsablePalette = activePalette.filter(
      (register) => getEngagementStanceDefinition(register)?.simulated_only !== true,
    );
    const eligiblePalette = humanUsablePalette.length ? humanUsablePalette : activePalette;
    const tutorTurn = state.turns.length + 1;
    const publicEvidenceAvailable = Boolean(
      committedReleaseRows(state, tutorTurn).length || currentReleaseRows(state, tutorTurn).length,
    );
    const previousRegister = state.register?.history?.at(-1)?.selected_register || null;
    const palette =
      (performanceMode || lightMode) && eligiblePalette.length > 1
        ? eligiblePalette.filter((register) => register !== previousRegister)
        : eligiblePalette;
    const distribution = uniformEngagementStanceDistribution(palette);
    const policyId = lightMode ? 'light_adaptation' : performanceMode ? 'random_performance' : null;
    const sampled = sampleTutorStubPolicyDistribution(
      distribution,
      policySamplingContext(
        state,
        lightMode
          ? 'light_adaptation_engagement_stance'
          : performanceMode
            ? 'random_performance_engagement_stance'
            : 'random_engagement_stance',
        policyId ? { policy: policyId } : {},
      ),
    );
    const selected = sampled.entry?.register || firstAvailableRegister(new Set(palette), ['precise', 'plain', 'brisk']);
    const requestType = lightMode
      ? 'continued_learner_difficulty'
      : performanceMode
        ? 'random_performance'
        : classification?.turn?.request_type || 'random_policy';
    return {
      selected_register: selected,
      request_type: requestType,
      action_family: null,
      legacy_selected_register: preferredLegacyRegister({
        register: selected,
        requestType,
        actionFamily: null,
      }),
      reviewer_signal: lightMode
        ? 'continued_learner_confusion_or_frustration'
        : performanceMode
          ? 'random_performance_mode'
          : 'random_policy',
      register_reason: lightMode
        ? `Light adaptation activated after ${lightAdaptation.streak} consecutive learner-difficulty turns and sampled a different non-simulated stance when possible; the assessment triggered the draw but did not choose its result.`
        : performanceMode
          ? 'Random performance mode sampled uniformly from the full non-simulated stance palette, excluding the immediately previous stance when alternatives exist. Learner assessment did not influence this choice.'
          : 'Random register policy sampled uniformly from the active palette; this choice is not a classifier- or learner-DAG-based recommendation.',
      evidence_span: performanceMode || lightMode ? '' : classification?.turn?.summary || '',
      risk_flags: [],
      expected_dag_move:
        'No register-specific DAG move is predicted; preserve evidence safety while following the sampled register stance.',
      expected_field_move:
        'Observe whether the sampled stance changes learner agency, evidence use, stance, or conceptual engagement.',
      expected_progress_marker:
        'Use the next learner turn to observe whether this random register coincides with learner-DAG progress.',
      confidence: null,
      source: lightMode
        ? 'light_stochastic_adaptation'
        : performanceMode
          ? 'random_performance_mode'
          : 'random_register_policy',
      distribution,
      selected_probability: sampled.entry?.probability ?? null,
      random: sampled.audit,
      ...(lightMode
        ? {
            light_adaptation: {
              ...lightAdaptation,
              previous_register_excluded: palette.length < eligiblePalette.length ? previousRegister : null,
              eligible_registers: eligiblePalette,
              public_evidence_available: publicEvidenceAvailable,
              structural_filter: 'simulated_only_excluded',
            },
          }
        : performanceMode
          ? {
              random_performance: {
                enabled: true,
                assessment_influence: false,
                previous_register_excluded: palette.length < eligiblePalette.length ? previousRegister : null,
                eligible_registers: eligiblePalette,
                public_evidence_available: publicEvidenceAvailable,
                structural_filter: 'simulated_only_excluded',
              },
            }
          : {}),
    };
  }

  function randomPerformanceActorialPartSelection({ state, inputs, baseSelection, lightAdaptation = null }) {
    const lightMode = lightAdaptation?.triggered === true;
    const modeKey = lightMode ? 'light_adaptation' : 'random_performance';
    if (!baseSelection || baseSelection.locked === true) {
      return baseSelection
        ? {
            ...baseSelection,
            [modeKey]: {
              ...(lightMode ? lightAdaptation : {}),
              enabled: true,
              assessment_influence: false,
              outcome: 'structural_lock',
              reason: baseSelection.lock_reason || 'licensed_closeout',
            },
          }
        : baseSelection;
    }
    const allParts = tutorStubRandomizableActorialPartIds();
    const previousPart = inputs.recentActorialParts?.at(-1) || null;
    const parts = allParts.length > 1 ? allParts.filter((part) => part !== previousPart) : allParts;
    const probability = parts.length ? 1 / parts.length : 0;
    const distribution = parts.map((part) => ({ part, weight: 1, probability }));
    const sampled = sampleTutorStubPolicyDistribution(
      distribution.map((row) => ({ register: row.part, weight: row.weight, probability: row.probability })),
      policySamplingContext(state, lightMode ? 'light_adaptation_actorial_part' : 'random_performance_actorial_part', {
        policy: modeKey,
      }),
    );
    const selectedPart = sampled.entry?.register || parts[0] || baseSelection.id;
    const selected = selectTutorStubActorialPart({
      ...inputs,
      selectedPartOverride: selectedPart,
    });
    return {
      ...selected,
      probability: sampled.entry?.probability ?? probability,
      score: null,
      temperature: null,
      distribution,
      drivers: [],
      reason: lightMode
        ? `Light adaptation activated after ${lightAdaptation.streak} consecutive learner-difficulty turns and sampled a different host character when possible; the assessment triggered the draw but did not choose its result.`
        : 'Random performance mode sampled uniformly from the full host-character range, excluding the immediately previous part when alternatives exist. Learner assessment did not influence this choice.',
      selection_method: lightMode ? 'light_adaptation_seeded_uniform' : 'random_performance_seeded_uniform',
      random: sampled.audit,
      [modeKey]: {
        ...(lightMode ? lightAdaptation : {}),
        enabled: true,
        assessment_influence: false,
        previous_part_excluded: parts.length < allParts.length ? previousPart : null,
        eligible_parts: allParts,
      },
    };
  }

  function negativeEngagementStanceSelection({ state, classification }) {
    const active = new Set(state.register?.palette || []);
    const palette = NEGATIVE_FLOOR_REGISTERS.filter((register) => active.has(register));
    const population = palette.length ? palette : NEGATIVE_FLOOR_REGISTERS;
    const distribution = uniformEngagementStanceDistribution(population);
    const sampled = sampleTutorStubPolicyDistribution(
      distribution,
      policySamplingContext(state, 'negative_floor_engagement_stance'),
    );
    const selected = sampled.entry?.register || 'ironic';
    return {
      selected_register: selected,
      request_type: classification?.turn?.request_type || 'negative_floor_policy',
      action_family: null,
      legacy_selected_register: preferredLegacyRegister({
        register: selected,
        requestType: classification?.turn?.request_type || 'negative_floor_policy',
        actionFamily: null,
      }),
      reviewer_signal: 'negative_floor_policy',
      register_reason:
        'Negative register floor sampled uniformly from ironic, sarcastic, and face_threat; this is a deliberate floor/control, not a recommended adaptive stance.',
      evidence_span: classification?.turn?.summary || '',
      risk_flags: ['negative_floor'],
      expected_dag_move:
        'No beneficial register-specific DAG move is predicted; preserve evidence safety while measuring whether negative stance harms uptake or agency.',
      expected_field_move:
        'Measure recognition cost, learner agency narrowing, disengagement, or coerced progress under a negative-only register floor.',
      expected_progress_marker:
        'Compare learner-DAG progress against field movement and recognition-cost signals after the negative stance.',
      confidence: null,
      source: 'negative_register_policy',
      distribution,
      selected_probability: sampled.entry?.probability ?? null,
      random: { ...sampled.audit, floor: NEGATIVE_FLOOR_REGISTERS },
    };
  }
  let cachedPressureTurns = null;

  function predeclaredPressureTurns() {
    if (cachedPressureTurns) return cachedPressureTurns;
    cachedPressureTurns = new Set(
      String(args['pressure-turns'] || '')
        .split(',')
        .map((part) => Number.parseInt(part.trim(), 10))
        .filter((value) => Number.isFinite(value) && value > 0),
    );
    return cachedPressureTurns;
  }

  function applyEngagementStanceOverride(source, stance, patch = {}) {
    const priorDistribution =
      source?.engagement_stance_distribution || (Array.isArray(source?.distribution) ? source.distribution : null);
    const lockedDistribution = [
      {
        engagement_stance: stance,
        register: stance,
        weight: 1,
        probability: 1,
        sourceScore: 1,
      },
    ];
    return {
      ...source,
      ...patch,
      engagement_stance: stance,
      selected_register: stance,
      pre_override_engagement_stance_distribution: priorDistribution,
      distribution: lockedDistribution,
      engagement_stance_distribution: lockedDistribution,
      selected_probability: 1,
    };
  }

  function characterDefaultEngagementStance(character, classification, tutorLearnerDag) {
    const definition = getActorialPartDefinitions()[character] || {};
    const defaults = Array.isArray(definition.default_engagement_stances)
      ? definition.default_engagement_stances.filter(
          (stance) =>
            getEngagementStanceDefinition(stance) && getEngagementStanceDefinition(stance)?.simulated_only !== true,
        )
      : [];
    if (!defaults.length) return null;
    const signal = [
      classification?.turn?.request_type,
      classification?.turn?.discourse_move,
      classification?.turn?.evidence_use,
      classification?.turn?.epistemic_stance,
      classification?.turn?.agency,
      tutorLearnerDag?.model?.assessment?.bottleneck,
    ]
      .filter(Boolean)
      .join(' ');
    const sharperMismatch =
      /(?:answer_seeking|challenge_resistance|distorts_public_evidence|overconfident|overleaps_evidence|premature_assertion|resistant|resistance_or_low_agency)/iu.test(
        signal,
      );
    return sharperMismatch && defaults.includes('sarcastic')
      ? 'sarcastic'
      : defaults.includes('ironic')
        ? 'ironic'
        : defaults[0];
  }

  return Object.freeze({
    registerSelectionFromCombinedAnalysis,
    evaluatePendingRegisterEfficacy,
    firstAvailableRegister,
    shouldUseDynamicBrisk,
    fallbackRegisterSelection,
    fixedBlandEngagementStanceSelection,
    policySamplingContext,
    explicitPerformanceDirectiveValue,
    resolveTutorStubCharacterChoice,
    explicitEngagementStanceSelection,
    explicitPerformanceActorialPartSelection,
    performanceTemperatureScope,
    randomEngagementStanceSelection,
    randomPerformanceActorialPartSelection,
    negativeEngagementStanceSelection,
    predeclaredPressureTurns,
    applyEngagementStanceOverride,
    characterDefaultEngagementStance,
  });
}
