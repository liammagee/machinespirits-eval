export function createTutorStubResponsePolicy(dependencies = {}) {
  const {
    DEFAULT_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE,
    DEFAULT_TUTOR_STUB_REGISTER_OVERLAY_THRESHOLD,
    DYNAMICAL_SYSTEM_REGISTER_AFFINITY,
    DYNAMICAL_SYSTEM_TEMPERATURE,
    EXPLICIT_PERFORMANCE_CLEAR_WORDS,
    NEGATIVE_FLOOR_REGISTERS,
    TUTOR_STUB_REGISTER_POLICY_COMPOSITION_SCHEMA,
    args,
    automatedLearnerProfileId,
    buildContinuousEngagementStanceVector,
    buildContinuousRegisterPolicyMetadata,
    buildDynamicalSystemRegisterScores,
    buildFieldRegisterScores,
    buildStateRegisterScores,
    buildTrajectoryRegisterScores,
    buildTutorStubLightAdaptationDecision,
    buildTutorStubResponseConfiguration,
    committedReleaseRows,
    continuousEngagementStanceInstruction,
    currentReleaseRows,
    displayDiagnosticLabel,
    evaluateTutorStubRegisterPolicyOverlay,
    getActorialPartDefinitions,
    getEngagementStanceDefinition,
    getEngagementStanceDefinitions,
    getRegisterOntologyVersion,
    hasExplicitStepwiseSignal,
    latestFieldStateMismatch,
    latestRegisterSelection,
    normalizeEngagementStanceDistribution,
    normalizeTutorStubActorialPartId,
    numberOr,
    oneLine,
    preferredLegacyRegister,
    recentRegisterCount,
    registerAffinityContributions,
    registerEfficacyFromDagProgress,
    registerTemperatureApplies,
    resolveEngagementStance,
    resolveTutorStubDiscoursePlane,
    roundField,
    sampleTutorStubPolicyDistribution,
    selectTutorStubActorialPart,
    topNumericEntries,
    tutorStubComprehensionFeatures,
    tutorStubConfigurableActorialPartIds,
    tutorStubRandomizableActorialPartIds,
    tutorStubRegisterPolicyStackId,
    tutorStubReleasePacingSnapshot,
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

  function expectedFieldMoveForRegister(selected, features) {
    const relation = features.field?.relation || 'unknown';
    if (Number(features.comprehension?.pressure || 0) > 0) {
      return 'Repair the wording gap with one immediate plain-language gloss before advancing the proof.';
    }
    if (features.dag.finalSecretEntailed && features.dag.assertedSecret) {
      return 'Close the now-warranted inquiry without opening another proof step.';
    }
    if (features.dag.finalSecretEntailed) return 'Invite the compact warranted verdict without adding another premise.';
    if (features.dag.assertedSecret) return 'Test the public warrant for the proposed verdict before accepting it.';
    if (features.advance?.accelerated) {
      return 'Credit the learner’s compressed chain, keep the quicker pace, and test only the next unresolved edge.';
    }
    if (relation === 'field_without_dag') {
      return 'Convert the learner field movement into one public evidence claim or warrant.';
    }
    if (relation === 'dag_without_field') {
      return 'Recover learner agency and ownership around the proof step that just moved.';
    }
    if (relation === 'neither_progress') {
      return 'Change the interaction posture enough to make either learner agency or evidence use move next.';
    }
    if (selected === 'witnessing') return 'Lower affective risk while preserving one concrete check.';
    if (selected === 'charismatic') return 'Interrupt low-agency compliance and create a learner-owned public move.';
    if (selected === 'ironic')
      return 'Let the learner notice the mismatch without turning the learner into the target.';
    if (selected === 'sarcastic')
      return 'Test whether a dry edge disrupts rote performance while leaving a repair path.';
    if (selected === 'face_threat')
      return 'Measure whether local face threat changes uptake while preserving a minimal repair path.';
    if (selected === 'brisk') return 'Increase pace without turning the next inference into an answer dump.';
    if (selected === 'plain') return "Make the next move sayable in the learner's own words.";
    return 'Sharpen the learner field toward one accountable public statement.';
  }

  function fallbackPolicySamplingContext(decisionKind) {
    // Every run path supplies state; this fixed context exists so that even a
    // state-less draw stays seeded and replayable (it is deterministic and
    // constant by construction — there is no turn identity without state).
    return {
      runSeed: 1,
      profile: 'interactive',
      policy: 'unknown',
      repeat: 1,
      learnerTurn: 1,
      decisionKind,
      jobId: null,
    };
  }

  function sampleEngagementStanceDistribution(distribution, { state = null, decisionKind = 'engagement_stance' } = {}) {
    const context = state ? policySamplingContext(state, decisionKind) : fallbackPolicySamplingContext(decisionKind);
    const sampled = sampleTutorStubPolicyDistribution(distribution, context);
    return { entry: sampled.entry, random: sampled.audit };
  }

  function selectEngagementStanceDistribution(
    distribution,
    { deterministic = false, state = null, decisionKind = 'engagement_stance' } = {},
  ) {
    if (!deterministic) return sampleEngagementStanceDistribution(distribution, { state, decisionKind });
    return {
      entry: distribution[0] || null,
      random: {
        method: 'argmax_policy_overlay',
        value: null,
        threshold: null,
      },
    };
  }

  function formatEngagementStanceDistribution(distribution, { limit = 5 } = {}) {
    const entries = Array.isArray(distribution) ? distribution : [];
    if (!entries.length) return '';
    return entries
      .slice(0, limit)
      .map((entry) => `${entry.register}:${Math.round(Number(entry.probability || 0) * 100)}%`)
      .join(', ');
  }

  function fieldEngagementStanceSelection({ state, classification, tutorLearnerDag, deterministic = false }) {
    const { features, scores, drivers } = buildFieldRegisterScores({ state, classification, tutorLearnerDag });
    const distribution = normalizeEngagementStanceDistribution(scores, { temperature: state.register?.temperature });
    const sampled = selectEngagementStanceDistribution(distribution, {
      deterministic,
      state,
      decisionKind: 'field_engagement_stance',
    });
    const selected =
      sampled.entry?.register || firstAvailableRegister(new Set(state.register?.palette || []), ['precise', 'plain']);
    const actionFamily = null;
    const selectedProbability = sampled.entry?.probability ?? null;
    const driverText = drivers.slice(0, 5).join('; ') || 'base field-policy weights only';
    return {
      selected_register: selected,
      request_type: features.requestType,
      action_family: actionFamily,
      legacy_selected_register: preferredLegacyRegister({
        register: selected,
        requestType: features.requestType,
        actionFamily,
      }),
      reviewer_signal: `${features.field.relation}; ${features.discourseMove}; ${features.epistemicStance}; ${features.agency}`,
      register_reason: `Field policy sampled from local engagement-stance distribution. Main drivers: ${driverText}.`,
      evidence_span: classification?.turn?.summary || '',
      risk_flags: [],
      expected_dag_move:
        Number(features.comprehension?.pressure || 0) > 0
          ? 'Hold learner-DAG advancement while the wording gap is repaired.'
          : features.dag.finalSecretEntailed && features.dag.assertedSecret
            ? 'Close the warranted proof without asking for another premise.'
            : features.dag.finalSecretEntailed
              ? 'Invite the learner’s compact warranted verdict without adding another premise.'
              : features.dag.assertedSecret
                ? 'Test the warrant for the proposed verdict before accepting it.'
                : features.advance?.accelerated
                  ? 'Accept every warranted learner-supplied premise and inference already made; probe only the next unresolved proof edge.'
                  : features.field.relation === 'field_without_dag'
                    ? 'Elicit one public evidence claim that converts learner-field movement into proof-state movement.'
                    : 'Elicit one public, checkable learner move that can update the learner-DAG record.',
      expected_field_move: expectedFieldMoveForRegister(selected, features),
      expected_progress_marker:
        'Next learner turn should show movement in agency, evidence use, epistemic stance, or learner-DAG coverage.',
      confidence: selectedProbability,
      source: 'field_register_policy',
      distribution,
      selected_probability: selectedProbability,
      field_policy: {
        schema: 'machinespirits.tutor-stub.field-register-policy.v1',
        features,
        scores: Object.fromEntries(Object.entries(scores).map(([register, score]) => [register, roundField(score)])),
        drivers,
        random: sampled.random,
      },
    };
  }

  function trajectoryRiskFlags(trajectory) {
    return Object.entries(trajectory.flags || {})
      .filter(([, value]) => value)
      .map(([key]) => `trajectory_${key}`);
  }

  function expectedTrajectoryDagMove(features, trajectory) {
    const flags = trajectory.flags || {};
    if (features.dag.finalSecretEntailed && features.dag.assertedSecret) {
      return 'Close the proof path without adding another premise or making the learner repeat the completed chain.';
    }
    if (features.dag.finalSecretEntailed) return 'Invite the compact warranted verdict without adding another premise.';
    if (features.dag.assertedSecret) return 'Test the warrant for the proposed verdict before accepting it.';
    if (flags.learnerAcceleration) {
      return 'Preserve every warranted step in the learner’s compressed chain and move directly to its next unresolved edge.';
    }
    if (flags.coerciveProgress) {
      return 'Hold proof-state progress until the learner can own the warrant without rising recognition risk.';
    }
    if (flags.fieldOnlyDrift) {
      return 'Convert improving learner posture into one public evidence adoption or warranted claim.';
    }
    if (flags.dagOnlyDrift) {
      return 'Ask the learner to explain the proof step already moving in the learner-DAG.';
    }
    if (flags.plateau) {
      return 'Change the local posture enough to create either learner-field movement or proof-state movement.';
    }
    if (features.dag.finalSecretEntailed || features.dag.assertedSecret) {
      return 'Close the proof path by having the learner state the public warrant for the answer.';
    }
    return 'Elicit one public, checkable learner move that changes the recent learner-field or learner-DAG trajectory.';
  }

  function expectedTrajectoryMoveForRegister(selected, features, trajectory) {
    const flags = trajectory.flags || {};
    if (features.dag.finalSecretEntailed && features.dag.assertedSecret) {
      return 'Use the learner’s completed chain for a concise, accountable closeout.';
    }
    if (features.dag.finalSecretEntailed) return 'Turn the completed chain into one compact learner-owned verdict.';
    if (features.dag.assertedSecret) return 'Slow only enough to test the warrant behind the proposed verdict.';
    if (flags.learnerAcceleration && !flags.nearClosure) {
      return 'Match the learner’s faster pace: acknowledge the chain once, then extend or test its next edge.';
    }
    if (flags.coerciveProgress) {
      return 'Trade speed for learner ownership: reduce risk while keeping one accountable public check.';
    }
    if (flags.riskRising) {
      return 'Lower rising field risk before asking for another proof-state advance.';
    }
    if (flags.plateau) {
      return 'Break a flat recent trajectory with a different learner-owned commitment.';
    }
    if (flags.fieldRegression) {
      return 'Recover agency, evidence use, or epistemic stance after negative field movement.';
    }
    if (flags.fieldOnlyDrift) {
      return 'Turn improved orientation into a sayable public claim.';
    }
    if (flags.dagOnlyDrift) {
      return 'Make the learner own the proof movement already appearing in the DAG.';
    }
    if (flags.stableConvergence) {
      return 'Preserve convergent field and DAG momentum without overprompting.';
    }
    return expectedFieldMoveForRegister(selected, features);
  }

  function trajectoryEngagementStanceSelection({ state, classification, tutorLearnerDag }) {
    const { features, trajectory, scores, drivers, baseScores, baseDrivers } = buildTrajectoryRegisterScores({
      state,
      classification,
      tutorLearnerDag,
    });
    const distribution = normalizeEngagementStanceDistribution(scores, { temperature: state.register?.temperature });
    const sampled = sampleEngagementStanceDistribution(distribution, {
      state,
      decisionKind: 'trajectory_engagement_stance',
    });
    const selected =
      sampled.entry?.register || firstAvailableRegister(new Set(state.register?.palette || []), ['precise', 'plain']);
    const actionFamily = null;
    const selectedProbability = sampled.entry?.probability ?? null;
    const driverText = drivers.slice(0, 6).join('; ') || 'trajectory policy used field baseline only';
    return {
      selected_register: selected,
      request_type: features.requestType,
      action_family: actionFamily,
      legacy_selected_register: preferredLegacyRegister({
        register: selected,
        requestType: features.requestType,
        actionFamily,
      }),
      reviewer_signal: `${features.field.relation}; fieldSlope=${trajectory.field.slope ?? 'n/a'}; dagSlope=${
        trajectory.dag.slope ?? 'n/a'
      }; riskSlope=${trajectory.risk.slope ?? 'n/a'}`,
      register_reason: `Trajectory policy sampled from field baseline plus recent finite-difference dynamics. Main drivers: ${driverText}.`,
      evidence_span: classification?.turn?.summary || '',
      risk_flags: trajectoryRiskFlags(trajectory),
      expected_dag_move: expectedTrajectoryDagMove(features, trajectory),
      expected_field_move: expectedTrajectoryMoveForRegister(selected, features, trajectory),
      expected_progress_marker:
        'Next learner turn should improve the recent trajectory: field score, proof coverage, ownership, or risk trend.',
      confidence: selectedProbability,
      source: 'trajectory_register_policy',
      distribution,
      selected_probability: selectedProbability,
      trajectory_policy: {
        schema: 'machinespirits.tutor-stub.trajectory-register-policy.v1',
        base_field_schema: 'machinespirits.tutor-stub.field-register-policy.v1',
        features,
        trajectory,
        base_scores: Object.fromEntries(
          Object.entries(baseScores).map(([register, score]) => [register, roundField(score)]),
        ),
        scores: Object.fromEntries(Object.entries(scores).map(([register, score]) => [register, roundField(score)])),
        base_drivers: baseDrivers,
        drivers,
        random: sampled.random,
      },
    };
  }

  function dynamicalSystemRiskFlags(system) {
    return Object.entries(system.state_vector || {})
      .filter(([key, value]) => Number(value) >= 0.7 && /risk|coercion|stagnation|regression|gap|deficit/iu.test(key))
      .map(([key]) => `dynamical_${key}`);
  }

  function expectedDynamicalDagMove(features, system) {
    const vector = system.state_vector || {};
    if (numberOr(vector.language_opacity) > 0) {
      return 'Hold proof-state advancement while the tutor repairs the learner-visible wording gap.';
    }
    if (numberOr(vector.coercion_risk) > 0.55) {
      return 'Stabilize learner ownership before taking more proof-state progress.';
    }
    if (numberOr(vector.warrant_gap) > 0.6) {
      return 'Elicit one public warrant that makes the current claim accountable.';
    }
    if (numberOr(vector.evidence_gap) > 0.6) {
      return 'Move one missing public premise into the learner-owned record.';
    }
    if (numberOr(vector.closure_pressure) > 0.65) {
      return 'Close by having the learner state the public evidence chain for the answer.';
    }
    if (features.dag.finalSecretEntailed || features.dag.assertedSecret) {
      return 'Convert near-closure into a public, warranted final statement.';
    }
    return 'Move the system toward evidence grounding, learner ownership, or accountable closure.';
  }

  function expectedDynamicalMoveForRegister(selected, features, system) {
    const vector = system.state_vector || {};
    if (numberOr(vector.language_opacity) > 0) {
      return 'Gloss the unresolved or recently queried term before applying further proof pressure.';
    }
    if (numberOr(vector.affective_risk) > 0.6 || numberOr(vector.coercion_risk) > 0.55) {
      return 'Reduce safety or coercion pressure while preserving one checkable public move.';
    }
    if (numberOr(vector.agency_deficit) > 0.65) {
      return 'Increase learner-owned commitment instead of supplying the next inference.';
    }
    if (numberOr(vector.warrant_gap) > 0.6) {
      return 'Turn the current claim into a warranted public statement.';
    }
    if (numberOr(vector.stagnation) > 0.6) {
      return 'Perturb a stuck trajectory without sacrificing recognition safety.';
    }
    if (numberOr(vector.momentum) > 0.55 && selected === 'brisk') {
      return 'Use the available pace to carry one learner-owned proof step.';
    }
    return expectedTrajectoryMoveForRegister(selected, features, system.trajectory || {});
  }

  function dynamicalSystemEngagementStanceSelection({
    state,
    classification,
    tutorLearnerDag,
    useCorpusPrior = false,
  }) {
    const { features, trajectory, system, empirical, corpusEmpirical, logits, scores, drivers } =
      buildDynamicalSystemRegisterScores({
        state,
        classification,
        tutorLearnerDag,
        useCorpusPrior,
      });
    const distribution = normalizeEngagementStanceDistribution(scores, { temperature: 1 });
    const sampled = sampleEngagementStanceDistribution(distribution, {
      state,
      decisionKind: useCorpusPrior
        ? 'empirical_dynamical_system_engagement_stance'
        : 'dynamical_system_engagement_stance',
    });
    const selected =
      sampled.entry?.register || firstAvailableRegister(new Set(state.register?.palette || []), ['precise', 'plain']);
    const actionFamily = null;
    const selectedProbability = sampled.entry?.probability ?? null;
    const selectedContributions = registerAffinityContributions(selected, system.state_vector).slice(0, 6);
    const driverText =
      [
        ...drivers.slice(0, 4),
        selectedContributions.length
          ? `selected ${selected}: ${selectedContributions
              .map((row) => `${row.axis}${row.contribution >= 0 ? '+' : ''}${roundField(row.contribution)}`)
              .join(', ')}`
          : null,
      ]
        .filter(Boolean)
        .join('; ') || 'dynamical-system base priors only';
    return {
      selected_register: selected,
      request_type: features.requestType,
      action_family: actionFamily,
      legacy_selected_register: preferredLegacyRegister({
        register: selected,
        requestType: features.requestType,
        actionFamily,
      }),
      reviewer_signal: `attractors=${topNumericEntries(system.attractors, { limit: 3 }).join(', ')}; vector=${topNumericEntries(
        system.state_vector,
        { limit: 3 },
      ).join(', ')}`,
      register_reason: `${
        useCorpusPrior ? 'Empirical dynamical-system' : 'Dynamical-system'
      } policy sampled from theory affinity matrix plus local${
        useCorpusPrior ? ' and cross-run' : ''
      } efficacy correction. Main drivers: ${driverText}.`,
      evidence_span: classification?.turn?.summary || '',
      risk_flags: dynamicalSystemRiskFlags(system),
      expected_dag_move: expectedDynamicalDagMove(features, system),
      expected_field_move: expectedDynamicalMoveForRegister(selected, features, system),
      expected_progress_marker:
        'Next learner turn should move the system vector toward lower gap/risk and higher ownership, grounding, or closure.',
      confidence: selectedProbability,
      source: useCorpusPrior ? 'empirical_dynamical_system_register_policy' : 'dynamical_system_register_policy',
      distribution,
      selected_probability: selectedProbability,
      dynamical_system_policy: {
        schema: 'machinespirits.tutor-stub.dynamical-system-register-policy.v1',
        mapping: {
          type: useCorpusPrior
            ? 'softmax_affinity_matrix_with_local_and_corpus_empirical_correction'
            : 'softmax_affinity_matrix_with_empirical_correction',
          temperature: state.register?.temperature ?? DYNAMICAL_SYSTEM_TEMPERATURE,
          theory_priors:
            'recognition safety, learner ownership, accountable warranting, proof-state closure, and controlled productive disruption',
          affinity_matrix_version: 'v1',
        },
        state_vector: system.state_vector,
        derivative_vector: system.derivative_vector,
        attractors: system.attractors,
        selected_affinity: DYNAMICAL_SYSTEM_REGISTER_AFFINITY[selected] || {},
        selected_contributions: selectedContributions.map((row) => ({
          axis: row.axis,
          weight: row.weight,
          value: roundField(row.value),
          contribution: roundField(row.contribution),
        })),
        empirical,
        corpus_empirical: corpusEmpirical,
        logits: Object.fromEntries(Object.entries(logits).map(([register, logit]) => [register, roundField(logit)])),
        scores: Object.fromEntries(Object.entries(scores).map(([register, score]) => [register, roundField(score)])),
        drivers,
        trajectory,
        features,
        random: sampled.random,
      },
    };
  }

  function continuousDynamicalSystemEngagementStanceSelection({
    state,
    classification,
    tutorLearnerDag,
    useCorpusPrior = false,
  }) {
    const { features, trajectory, system, empirical, corpusEmpirical, logits, scores, drivers } =
      buildDynamicalSystemRegisterScores({
        state,
        classification,
        tutorLearnerDag,
        useCorpusPrior,
      });
    const definitions = getEngagementStanceDefinitions();
    const blend = buildContinuousEngagementStanceVector({
      scores,
      palette: state.register?.palette || [],
      definitions,
      allowUnsafe: state.register?.continuousUnsafe === true,
    });
    const selected =
      blend.selectedRegister || firstAvailableRegister(new Set(state.register?.palette || []), ['precise', 'plain']);
    const actionFamily = null;
    const selectedProbability = blend.selectedProbability ?? null;
    const selectedContributions = registerAffinityContributions(selected, system.state_vector).slice(0, 6);
    const blendInstruction = continuousEngagementStanceInstruction(blend, definitions);
    const continuousPolicy = buildContinuousRegisterPolicyMetadata({
      blend,
      temperature: state.register?.temperature ?? DYNAMICAL_SYSTEM_TEMPERATURE,
      useCorpusPrior,
      empirical,
      corpusEmpirical,
      styleInstruction: blendInstruction,
    });
    const driverText =
      [
        `blend ${blend.dominantBlend || selected}`,
        ...drivers.slice(0, 4),
        selectedContributions.length
          ? `selected ${selected}: ${selectedContributions
              .map((row) => `${row.axis}${row.contribution >= 0 ? '+' : ''}${roundField(row.contribution)}`)
              .join(', ')}`
          : null,
      ]
        .filter(Boolean)
        .join('; ') || 'continuous dynamical-system base priors only';
    return {
      selected_register: selected,
      request_type: features.requestType,
      action_family: actionFamily,
      legacy_selected_register: preferredLegacyRegister({
        register: selected,
        requestType: features.requestType,
        actionFamily,
      }),
      reviewer_signal: `continuous blend=${blend.dominantBlend}; attractors=${topNumericEntries(system.attractors, {
        limit: 3,
      }).join(', ')}; vector=${topNumericEntries(system.state_vector, { limit: 3 }).join(', ')}`,
      register_reason: `${
        useCorpusPrior ? 'Continuous empirical dynamical-system' : 'Continuous dynamical-system'
      } policy blended register anchors from theory affinity matrix plus local${
        useCorpusPrior ? ' and cross-run' : ''
      } efficacy correction. Main drivers: ${driverText}.`,
      evidence_span: classification?.turn?.summary || '',
      risk_flags: dynamicalSystemRiskFlags(system),
      expected_dag_move: expectedDynamicalDagMove(features, system),
      expected_field_move: expectedDynamicalMoveForRegister(selected, features, system),
      expected_progress_marker:
        'Next learner turn should show the continuous stance blend moving the system vector toward lower gap/risk and higher ownership, grounding, or closure.',
      confidence: selectedProbability,
      source: useCorpusPrior
        ? 'continuous_empirical_dynamical_system_register_policy'
        : 'continuous_dynamical_system_register_policy',
      distribution: blend.rows,
      selected_probability: selectedProbability,
      register_vector: blend.vector,
      register_vector_entropy_bits: blend.entropyBits,
      continuous_register_policy: continuousPolicy,
      dynamical_system_policy: {
        schema: 'machinespirits.tutor-stub.dynamical-system-register-policy.v1',
        mapping: {
          type: useCorpusPrior
            ? 'softmax_affinity_matrix_with_local_and_corpus_empirical_correction'
            : 'softmax_affinity_matrix_with_empirical_correction',
          temperature: state.register?.temperature ?? DYNAMICAL_SYSTEM_TEMPERATURE,
          theory_priors:
            'recognition safety, learner ownership, accountable warranting, proof-state closure, and controlled productive disruption',
          affinity_matrix_version: 'v1',
        },
        state_vector: system.state_vector,
        derivative_vector: system.derivative_vector,
        attractors: system.attractors,
        selected_affinity: DYNAMICAL_SYSTEM_REGISTER_AFFINITY[selected] || {},
        selected_contributions: selectedContributions.map((row) => ({
          axis: row.axis,
          weight: row.weight,
          value: roundField(row.value),
          contribution: roundField(row.contribution),
        })),
        empirical,
        corpus_empirical: corpusEmpirical,
        logits: Object.fromEntries(Object.entries(logits).map(([register, logit]) => [register, roundField(logit)])),
        scores: Object.fromEntries(Object.entries(scores).map(([register, score]) => [register, roundField(score)])),
        drivers,
        trajectory,
        features,
        continuous_register_policy: {
          register_vector: continuousPolicy.register_vector,
          entropy_bits: continuousPolicy.entropy_bits,
          dominant_blend: continuousPolicy.dominant_blend,
        },
      },
    };
  }

  function expectedStateMoveForRegister(selected, features) {
    if (Number(features.comprehension?.pressure || 0) > 0) {
      return 'Resolve the current vocabulary or wording gap before asking for another proof move.';
    }
    if (features.dag.finalSecretEntailed || features.dag.assertedSecret) {
      return 'Move the current learner state toward accountable closure without adding new evidence.';
    }
    if (features.advance?.accelerated) {
      return 'Address the learner as an informed peer, credit the full chain, and test only the next unresolved distinction.';
    }
    if (features.dag.bottleneck === 'premature_assertion') {
      return 'Move the learner from naming a verdict to naming the public support that licenses it.';
    }
    if (features.dag.bottleneck === 'assertion_gap') {
      return 'Move the learner from held evidence to a warranted final assertion.';
    }
    if (
      /answer_seeking|passive|complying/iu.test(
        `${features.epistemicStance} ${features.agency} ${features.evidenceUse}`,
      )
    ) {
      return 'Move the learner from dependent answer-seeking to one small public commitment.';
    }
    if (selected === 'witnessing') return 'Lower current affective risk while keeping one concrete public test.';
    if (selected === 'warm') return 'Restore current learner readiness enough for the next evidence claim.';
    if (selected === 'charismatic') return 'Interrupt current low-agency posture and demand one owned move.';
    if (selected === 'precise') return 'Sharpen the current claim, distinction, or warrant into a checkable line.';
    if (selected === 'brisk') return 'Advance the current proof bottleneck with one learner-owned next step.';
    return 'Move the current learner state toward one public, checkable evidence statement.';
  }

  function stateEngagementStanceSelection({ state, classification, tutorLearnerDag, deterministic = false }) {
    const { features, scores, drivers } = buildStateRegisterScores({ state, classification, tutorLearnerDag });
    const distribution = normalizeEngagementStanceDistribution(scores, { temperature: state.register?.temperature });
    const sampled = selectEngagementStanceDistribution(distribution, {
      deterministic,
      state,
      decisionKind: 'state_engagement_stance',
    });
    const selected =
      sampled.entry?.register || firstAvailableRegister(new Set(state.register?.palette || []), ['precise', 'plain']);
    const actionFamily = null;
    const selectedProbability = sampled.entry?.probability ?? null;
    const driverText = drivers.slice(0, 5).join('; ') || 'base state-policy weights only';
    return {
      selected_register: selected,
      request_type: features.requestType,
      action_family: actionFamily,
      legacy_selected_register: preferredLegacyRegister({
        register: selected,
        requestType: features.requestType,
        actionFamily,
      }),
      reviewer_signal: `${features.dag.bottleneck}; ${features.discourseMove}; ${features.epistemicStance}; ${features.agency}`,
      register_reason: `State policy sampled from current classifier/DAG distribution. Main drivers: ${driverText}.`,
      evidence_span: classification?.turn?.summary || '',
      risk_flags: [],
      expected_dag_move:
        Number(features.comprehension?.pressure || 0) > 0
          ? 'Hold learner-DAG advancement while the wording gap is repaired.'
          : features.dag.finalSecretEntailed && features.dag.assertedSecret
            ? 'Close the warranted proof without asking for another premise.'
            : features.dag.finalSecretEntailed
              ? 'Invite the learner’s compact warranted verdict without adding another premise.'
              : features.dag.assertedSecret
                ? 'Test the warrant for the proposed verdict before accepting it.'
                : features.advance?.accelerated
                  ? 'Preserve the learner’s full multi-premise advance and ask only about the next unresolved proof edge.'
                  : 'Elicit one public, checkable learner move that addresses the current learner-DAG bottleneck.',
      expected_field_move: expectedStateMoveForRegister(selected, features),
      expected_progress_marker:
        'Next learner turn should improve the current state: public evidence use, agency, assertion quality, or learner-DAG coverage.',
      confidence: selectedProbability,
      source: 'state_register_policy',
      distribution,
      selected_probability: selectedProbability,
      state_policy: {
        schema: 'machinespirits.tutor-stub.state-register-policy.v1',
        features,
        scores: Object.fromEntries(Object.entries(scores).map(([register, score]) => [register, roundField(score)])),
        drivers,
        random: sampled.random,
      },
    };
  }

  function registerPolicySelectionSummary(selection) {
    return {
      selected_register: selection?.selected_register || selection?.engagement_stance || null,
      source: selection?.source || null,
      reason: selection?.register_reason || selection?.engagement_stance_reason || null,
      selected_probability: selection?.selected_probability ?? selection?.confidence ?? null,
      distribution: Array.isArray(selection?.distribution) ? selection.distribution : null,
    };
  }

  function composeRegisterPolicySelection({ primarySelection, state, classification, tutorLearnerDag }) {
    const overlays = Array.isArray(state.register?.overlays) ? state.register.overlays : [];
    if (!overlays.length) return primarySelection;
    const primaryRegister = primarySelection?.selected_register || primarySelection?.engagement_stance || null;
    const threshold = state.register?.overlayThreshold ?? DEFAULT_TUTOR_STUB_REGISTER_OVERLAY_THRESHOLD;
    const evaluated = overlays.map((overlay, index) => {
      const candidate =
        overlay === 'state'
          ? stateEngagementStanceSelection({
              state,
              classification,
              tutorLearnerDag,
              deterministic: true,
            })
          : fieldEngagementStanceSelection({
              state,
              classification,
              tutorLearnerDag,
              deterministic: true,
            });
      const evaluation = evaluateTutorStubRegisterPolicyOverlay({
        overlay,
        state,
        classification,
        candidate,
        primaryRegister,
        threshold,
      });
      return {
        ...evaluation,
        order: index,
        candidate,
        candidate_reason: candidate.register_reason || null,
        candidate_distribution: candidate.distribution || null,
      };
    });
    const winner = evaluated
      .filter((entry) => entry.eligible)
      .sort((a, b) => b.signal_strength - a.signal_strength || a.order - b.order)[0];
    const composition = {
      schema: TUTOR_STUB_REGISTER_POLICY_COMPOSITION_SCHEMA,
      policy_stack: tutorStubRegisterPolicyStackId(state.register.policy, overlays),
      primary_policy: state.register.policy,
      overlay_policies: [...overlays],
      overlay_threshold: threshold,
      primary_selection: registerPolicySelectionSummary(primarySelection),
      overlay_evaluations: evaluated.map(({ candidate: _candidate, order: _order, ...entry }) => entry),
      activated_overlay: winner?.policy || null,
      activated_strength: winner?.signal_strength ?? null,
    };
    if (!winner) {
      return {
        ...primarySelection,
        policy_composition: composition,
      };
    }
    const candidate = winner.candidate;
    const reason = `${winner.policy} overlay replaced the ${state.register.policy} choice ${primaryRegister} with ${
      candidate.selected_register
    }: turn-change strength ${winner.signal_strength} met threshold ${threshold}. ${candidate.register_reason || ''}`.trim();
    return {
      ...primarySelection,
      ...candidate,
      register_reason: reason,
      engagement_stance_reason: reason,
      source: `register_policy_overlay_${winner.policy}`,
      policy_composition: composition,
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

  function normalizeResponseConfigurationSelection(
    rawSelection,
    { state, classification, tutorLearnerDag, raw, learnerText = '' },
  ) {
    if (!state.register?.enabled) return null;
    const palette = new Set(state.register.palette || []);
    const policy = state.register?.policy || 'dynamic';
    const discoursePlane = resolveTutorStubDiscoursePlane({ learnerText, classification });
    const instructionalMetaRepair = discoursePlane.plane === 'instructional_meta';
    const explicitRegister = explicitPerformanceDirectiveValue(state, 'register');
    const explicitCharacter = explicitPerformanceDirectiveValue(state, 'character');
    const characterDefaultStance = explicitRegister
      ? null
      : characterDefaultEngagementStance(explicitCharacter, classification, tutorLearnerDag);
    const lightAdaptation = buildTutorStubLightAdaptationDecision({
      enabled: state.lightAdaptation?.enabled === true,
      threshold: state.lightAdaptation?.threshold,
      state,
      classification,
      learnerText,
    });
    const lightAdaptationTriggered = lightAdaptation.triggered === true;
    const randomPerformanceEnabled = state.randomPerformance?.enabled === true;
    const randomStanceEnabled = randomPerformanceEnabled && !explicitRegister && !lightAdaptationTriggered;
    const randomCharacterEnabled = randomPerformanceEnabled && !explicitCharacter && !lightAdaptationTriggered;
    const externalStanceDirective = Boolean(lightAdaptationTriggered || explicitRegister || randomStanceEnabled);
    if (lightAdaptationTriggered) {
      rawSelection = randomEngagementStanceSelection({ state, classification, lightAdaptation });
    } else if (explicitRegister) {
      rawSelection = explicitEngagementStanceSelection({ classification, stance: explicitRegister });
    } else if (randomStanceEnabled) {
      rawSelection = randomEngagementStanceSelection({ state, classification, performanceMode: true });
    } else if (policy === 'random') {
      rawSelection = randomEngagementStanceSelection({ state, classification });
    } else if (policy === 'negative') {
      rawSelection = negativeEngagementStanceSelection({ state, classification });
    } else if (policy === 'field') {
      rawSelection = fieldEngagementStanceSelection({ state, classification, tutorLearnerDag });
    } else if (policy === 'trajectory') {
      rawSelection = trajectoryEngagementStanceSelection({ state, classification, tutorLearnerDag });
    } else if (policy === 'dynamical_system') {
      rawSelection = dynamicalSystemEngagementStanceSelection({ state, classification, tutorLearnerDag });
    } else if (policy === 'empirical_dynamical_system') {
      rawSelection = dynamicalSystemEngagementStanceSelection({
        state,
        classification,
        tutorLearnerDag,
        useCorpusPrior: true,
      });
    } else if (policy === 'continuous_dynamical_system') {
      rawSelection = continuousDynamicalSystemEngagementStanceSelection({ state, classification, tutorLearnerDag });
    } else if (policy === 'continuous_empirical_dynamical_system') {
      rawSelection = continuousDynamicalSystemEngagementStanceSelection({
        state,
        classification,
        tutorLearnerDag,
        useCorpusPrior: true,
      });
    } else if (policy === 'state') {
      rawSelection = stateEngagementStanceSelection({ state, classification, tutorLearnerDag });
    } else if (policy === 'bland') {
      rawSelection = fixedBlandEngagementStanceSelection({ state, classification });
    }
    const normalizedRawSelection =
      typeof rawSelection === 'string' ? { engagement_stance: rawSelection } : rawSelection || {};
    const requested = String(
      normalizedRawSelection.engagement_stance ||
        normalizedRawSelection.selected_register ||
        normalizedRawSelection.register ||
        '',
    ).trim();
    const requestedResolution = resolveEngagementStance(requested);
    const requestedRegister = requestedResolution?.register || requested;
    const requestedIsKnown = Boolean(requestedRegister && palette.has(requestedRegister));
    const dynamicBriskBlocked = Boolean(
      !externalStanceDirective &&
      requestedIsKnown &&
      policy === 'dynamic' &&
      requestedRegister === 'brisk' &&
      !shouldUseDynamicBrisk({ state, classification, assessment: tutorLearnerDag?.model?.assessment || {} }),
    );
    let source =
      externalStanceDirective || policy === 'random'
        ? normalizedRawSelection
        : requestedIsKnown && !dynamicBriskBlocked
          ? normalizedRawSelection
          : fallbackRegisterSelection({ state, classification, tutorLearnerDag });
    if (!externalStanceDirective) {
      source = composeRegisterPolicySelection({
        primarySelection: source,
        state,
        classification,
        tutorLearnerDag,
      });
    }
    const comprehensionPressure = Number(
      tutorStubComprehensionFeatures(state.comprehension, {
        turn: tutorLearnerDag?.model?.turn ?? state.turns.length + 1,
      }).pressure || 0,
    );
    if (
      !externalStanceDirective &&
      policy === 'dynamic' &&
      comprehensionPressure > 0 &&
      !['plain', 'warm', 'precise'].includes(
        String(source.engagement_stance || source.selected_register || source.register || ''),
      )
    ) {
      source = applyEngagementStanceOverride(source, 'plain', {
        register_reason: `Comprehension side-state overrode challenge pressure at ${comprehensionPressure}; use one immediate plain-language gloss.`,
        expected_dag_move: 'Hold learner-DAG advancement while the wording gap is repaired.',
        expected_field_move: 'Resolve the vocabulary or wording gap before asking for another proof move.',
        source: 'dynamic_comprehension_guard',
      });
    }
    const releasePacing = tutorStubReleasePacingSnapshot(state.releasePacing, state.world);
    if (
      !externalStanceDirective &&
      comprehensionPressure === 0 &&
      releasePacing?.signal?.direction &&
      releasePacing.signal.direction !== 'steady' &&
      releasePacing.signal.source !== 'no_current_signal'
    ) {
      const requestedPace = releasePacing.signal.direction;
      const paceStance =
        requestedPace === 'accelerate'
          ? palette.has('brisk')
            ? 'brisk'
            : palette.has('precise')
              ? 'precise'
              : null
          : palette.has('warm')
            ? 'warm'
            : palette.has('plain')
              ? 'plain'
              : null;
      if (paceStance) {
        source = applyEngagementStanceOverride(source, paceStance, {
          register_reason:
            requestedPace === 'accelerate'
              ? `The learner asked for faster progress, so the tutor shifts to ${paceStance} while the clue-release controller brings one public clue forward.`
              : `The learner asked for more time, so the tutor shifts to ${paceStance} while the clue-release controller holds back new evidence.`,
          engagement_stance_reason:
            requestedPace === 'accelerate'
              ? `The learner asked for faster progress, so the tutor shifts to ${paceStance} while the clue-release controller brings one public clue forward.`
              : `The learner asked for more time, so the tutor shifts to ${paceStance} while the clue-release controller holds back new evidence.`,
          reviewer_signal: releasePacing.signal.reason,
          expected_dag_move:
            requestedPace === 'accelerate'
              ? 'Stage one newly available public clue and advance without re-testing a settled premise.'
              : 'Consolidate one public premise without releasing another clue yet.',
          expected_field_move:
            requestedPace === 'accelerate'
              ? 'Convert learner impatience into visible forward motion.'
              : 'Reduce pace pressure while preserving learner agency.',
          source: `learner_release_pacing_${requestedPace}`,
        });
      }
    }
    const learnerAdvance = tutorLearnerDag?.advance || tutorLearnerDag?.model?.learnerAdvance || null;
    if (
      !externalStanceDirective &&
      policy === 'dynamic' &&
      comprehensionPressure === 0 &&
      learnerAdvance?.accelerated &&
      tutorLearnerDag?.model?.assessment?.finalSecretEntailed !== true &&
      tutorLearnerDag?.model?.assessment?.assertedSecret !== true
    ) {
      const currentStanceForAcceleration = String(
        source.engagement_stance || source.selected_register || source.register || 'plain',
      );
      const acceleratedStance = palette.has('brisk')
        ? 'brisk'
        : palette.has('precise')
          ? 'precise'
          : currentStanceForAcceleration;
      source = applyEngagementStanceOverride(source, acceleratedStance, {
        register_reason: `Learner-owned acceleration guard: ${learnerAdvance.supportedMoveCount} warranted proof moves were accepted, so the stance shifts to ${acceleratedStance} and tests only the next unresolved edge.`,
        engagement_stance_reason: `Learner-owned acceleration guard: ${learnerAdvance.supportedMoveCount} warranted proof moves were accepted, so the stance shifts to ${acceleratedStance} and tests only the next unresolved edge.`,
        reviewer_signal: `accelerating learner supplied ${learnerAdvance.supportedMoveCount} warranted proof moves`,
        expected_dag_move:
          'Preserve the entire learner-supplied chain and ask only about the next unresolved public proof edge.',
        expected_field_move:
          'Match the learner’s quicker pace without forcing a restatement of already warranted steps.',
        source: 'dynamic_learner_acceleration_guard',
      });
    }
    if (!externalStanceDirective && characterDefaultStance) {
      const definition = getEngagementStanceDefinition(characterDefaultStance) || {};
      source = applyEngagementStanceOverride(source, characterDefaultStance, {
        register_reason: `The explicitly selected ${explicitCharacter} character defaults to ${characterDefaultStance} so its recurring dramatic action can expose the current mismatch. Use /register to direct another voice independently.`,
        engagement_stance_reason: `The explicitly selected ${explicitCharacter} character defaults to ${characterDefaultStance}; an explicit /register choice still takes precedence.`,
        reviewer_signal: `character default engagement stance: ${explicitCharacter}`,
        risk_flags: Array.isArray(definition.risk_flags) ? [...definition.risk_flags] : [],
        expected_field_move:
          'Expose the gap in the learner-facing claim while preserving a concrete route to repair it.',
        source: 'explicit_character_default_engagement_stance',
        character_default_engagement_stance: true,
      });
    }
    const pressureProbeTurn = tutorLearnerDag?.model?.turn ?? state.turns.length + 1;
    if (!externalStanceDirective && predeclaredPressureTurns().has(pressureProbeTurn)) {
      source = applyEngagementStanceOverride(source, 'face_threat', {
        register_reason: `Predeclared pressure probe: hostile register forced at learner turn ${pressureProbeTurn} by design, independent of the register policy. The policy resumes control next turn.`,
        expected_dag_move: 'Learner-DAG advancement may stall or regress this turn; recovery is measured afterward.',
        expected_field_move: 'Interactional pressure spikes by design this turn.',
        source: 'predeclared_pressure_probe',
        predeclared_pressure: true,
      });
    }
    if (instructionalMetaRepair) {
      source = applyEngagementStanceOverride(source, 'plain', {
        register_reason:
          'Instructional repair overrides proof-facing performance pressure for this turn; use plain, unadorned language before returning to the inquiry.',
        engagement_stance_reason:
          'Instructional repair overrides proof-facing performance pressure for this turn; use plain, unadorned language before returning to the inquiry.',
        reviewer_signal: 'learner requested repair of the explanation itself',
        expected_dag_move: 'Keep learner-DAG state unchanged while the explanation is repaired.',
        expected_field_move: 'Resolve the wording gap without releasing evidence or asking another proof question.',
        source: 'instructional_meta_repair',
      });
    }
    const selectedRaw = String(source.engagement_stance || source.selected_register || source.register || '').trim();
    const selectedResolution = resolveEngagementStance(selectedRaw, { fallback: 'precise' });
    const selected = selectedResolution?.register || selectedRaw;
    const definition = getEngagementStanceDefinition(selected) || {};
    const requestType = String(
      source.request_type ||
        selectedResolution?.request_type ||
        classification?.turn?.request_type ||
        classification?.turn?.discourse_move ||
        'unknown',
    );
    const proposedActionFamily = String(source.action_family || selectedResolution?.action_family || '');
    const policyStack = tutorStubRegisterPolicyStackId(policy, state.register?.overlays || []);
    const configurationInputs = {
      engagementStance: selected,
      legacySelectedRegister: source.legacy_selected_register || selectedResolution?.legacy_selected_register || null,
      stanceDistribution: source.engagement_stance_distribution || source.distribution || null,
      stanceVector: source.engagement_stance_vector || source.register_vector || null,
      temperature: state.register?.temperature ?? DEFAULT_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE,
      policy: lightAdaptationTriggered
        ? 'light_adaptation'
        : explicitRegister
          ? 'explicit_register_directive'
          : characterDefaultStance
            ? 'character_default_engagement_stance'
            : randomStanceEnabled
              ? 'random_performance'
              : policyStack,
      learnerText,
      classification,
      tutorLearnerDag,
      comprehension: tutorStubComprehensionFeatures(state.comprehension, {
        turn: tutorLearnerDag?.model?.turn ?? state.turns.length + 1,
      }),
      world: state.world,
      proposedActionFamily: proposedActionFamily || null,
      releasePacing: tutorStubReleasePacingSnapshot(state.releasePacing, state.world),
      dueEvidence: discoursePlane.freeze_clue_release
        ? []
        : currentReleaseRows(state, tutorLearnerDag?.model?.turn ?? state.turns.length + 1),
      recentActorialParts: (state.register?.history || [])
        .map((entry) => entry.actorial_part || entry.response_configuration?.actorial_part)
        .filter(Boolean),
      discoursePlane,
    };
    let responseConfiguration = buildTutorStubResponseConfiguration(configurationInputs);
    const actorialInputs = {
      engagementStance: configurationInputs.engagementStance,
      stanceDistribution: configurationInputs.stanceDistribution,
      actionFamily: responseConfiguration.action_family,
      temperature: configurationInputs.temperature,
      classification,
      tutorLearnerDag,
      comprehension: configurationInputs.comprehension,
      world: state.world,
      dueEvidence: configurationInputs.dueEvidence,
      recentActorialParts: configurationInputs.recentActorialParts,
    };
    if (lightAdaptationTriggered) {
      const sampledSelection = randomPerformanceActorialPartSelection({
        state,
        inputs: actorialInputs,
        baseSelection: responseConfiguration.actorial_part_selection,
        lightAdaptation,
      });
      responseConfiguration = buildTutorStubResponseConfiguration({
        ...configurationInputs,
        actorialPartOverride: sampledSelection,
      });
      responseConfiguration.selection_reasons.actorial_part = sampledSelection?.reason || 'structural closeout lock';
    } else if (explicitCharacter) {
      const directedSelection = explicitPerformanceActorialPartSelection({
        inputs: actorialInputs,
        baseSelection: responseConfiguration.actorial_part_selection,
        character: explicitCharacter,
      });
      responseConfiguration = buildTutorStubResponseConfiguration({
        ...configurationInputs,
        actorialPartOverride: directedSelection,
      });
      responseConfiguration.selection_reasons.actorial_part =
        directedSelection?.reason || 'The licensed closeout character takes structural priority.';
    } else if (randomCharacterEnabled) {
      const sampledSelection = randomPerformanceActorialPartSelection({
        state,
        inputs: actorialInputs,
        baseSelection: responseConfiguration.actorial_part_selection,
      });
      responseConfiguration = buildTutorStubResponseConfiguration({
        ...configurationInputs,
        actorialPartOverride: sampledSelection,
      });
      responseConfiguration.selection_reasons.actorial_part = sampledSelection?.reason || 'structural closeout lock';
    } else if (
      registerTemperatureApplies(policy) &&
      responseConfiguration.actorial_part_selection?.distribution?.length &&
      responseConfiguration.actorial_part_selection.locked !== true
    ) {
      const sampledPart = sampleTutorStubPolicyDistribution(
        responseConfiguration.actorial_part_selection.distribution.map((row) => ({
          register: row.part,
          weight: row.weight,
          probability: row.probability,
        })),
        policySamplingContext(state, 'actorial_part'),
      );
      const sampledSelection = selectTutorStubActorialPart({
        engagementStance: configurationInputs.engagementStance,
        stanceDistribution: configurationInputs.stanceDistribution,
        actionFamily: responseConfiguration.action_family,
        temperature: configurationInputs.temperature,
        classification,
        tutorLearnerDag,
        comprehension: configurationInputs.comprehension,
        world: state.world,
        dueEvidence: configurationInputs.dueEvidence,
        recentActorialParts: configurationInputs.recentActorialParts,
        selectedPartOverride: sampledPart.entry?.register || responseConfiguration.actorial_part,
      });
      sampledSelection.random = sampledPart.audit;
      responseConfiguration = buildTutorStubResponseConfiguration({
        ...configurationInputs,
        actorialPartOverride: sampledSelection,
      });
    }
    const randomPerformanceActive = randomStanceEnabled || randomCharacterEnabled;
    if (randomPerformanceEnabled) {
      responseConfiguration.random_performance = {
        schema: 'machinespirits.tutor-stub.random-performance-selection.v1',
        enabled: randomPerformanceActive,
        configured: true,
        active_axes: [
          randomStanceEnabled ? 'engagement_stance' : null,
          randomCharacterEnabled ? 'actorial_part' : null,
        ].filter(Boolean),
        explicitly_directed_axes: [
          explicitRegister ? 'engagement_stance' : null,
          explicitCharacter ? 'actorial_part' : null,
        ].filter(Boolean),
        assessment_influence: {
          engagement_stance: false,
          actorial_part: false,
          other_axes: true,
        },
        stance_random: randomStanceEnabled ? source.random || null : null,
        actorial_part_random: randomCharacterEnabled
          ? responseConfiguration.actorial_part_selection?.random || null
          : null,
        hard_constraints_preserved: ['dialogue_closure', 'evidence_release', 'response_safety'],
      };
    }
    responseConfiguration.light_adaptation = {
      ...lightAdaptation,
      engagement_stance_draw: source.light_adaptation || null,
      actorial_part_draw: responseConfiguration.actorial_part_selection?.light_adaptation || null,
      engagement_stance_random: lightAdaptationTriggered ? source.random || null : null,
      actorial_part_random: lightAdaptationTriggered
        ? responseConfiguration.actorial_part_selection?.random || null
        : null,
      applied: lightAdaptationTriggered,
      applied_axes: lightAdaptationTriggered
        ? [
            'engagement_stance',
            responseConfiguration.actorial_part_selection?.locked === true ? null : 'actorial_part',
          ].filter(Boolean)
        : [],
      overridden_directives: lightAdaptationTriggered
        ? [
            explicitRegister ? 'engagement_stance' : null,
            explicitCharacter ? 'actorial_part' : null,
            randomPerformanceEnabled ? 'random_performance' : null,
          ].filter(Boolean)
        : [],
    };
    if (explicitRegister || explicitCharacter) {
      responseConfiguration.performance_directives = {
        schema: 'machinespirits.tutor-stub.explicit-performance-directives.v1',
        register: explicitRegister
          ? {
              value: explicitRegister,
              applied: !lightAdaptationTriggered,
              outcome: lightAdaptationTriggered ? 'overridden_by_light_adaptation' : 'applied',
              assessment_influence: false,
            }
          : null,
        character: explicitCharacter
          ? {
              value: explicitCharacter,
              applied:
                !lightAdaptationTriggered &&
                responseConfiguration.actorial_part_selection?.explicit_directive?.applied !== false,
              outcome: lightAdaptationTriggered
                ? 'overridden_by_light_adaptation'
                : responseConfiguration.actorial_part_selection?.explicit_directive?.outcome || 'applied',
              assessment_influence: false,
            }
          : null,
        hard_constraints_preserved: [
          'dialogue_closure',
          'authored_evidence_source',
          'evidence_release',
          'response_safety',
        ],
      };
    }
    const temperatureSelection = performanceTemperatureScope({
      policy,
      explicitRegister: explicitRegister || characterDefaultStance,
      explicitCharacter,
      randomStance: randomStanceEnabled,
      randomCharacter: randomCharacterEnabled,
      lightStance: lightAdaptationTriggered,
      lightCharacter: lightAdaptationTriggered,
    });
    responseConfiguration.temperature_scope = temperatureSelection.scope;
    const actionFamily = responseConfiguration.action_family;
    const reviewerSignal = String(
      source.reviewer_signal ||
        source.register_signal ||
        source.learner_signal ||
        source.learnerSignal ||
        classification?.turn?.pedagogical_need ||
        requestType,
    );
    const selection = {
      schema: 'machinespirits.tutor-stub.response-configuration-selection.v5',
      register_ontology_version: getRegisterOntologyVersion(),
      policy: policyStack,
      primary_policy: policy,
      overlay_policies: [...(state.register?.overlays || [])],
      activated_policy: lightAdaptationTriggered
        ? 'light_adaptation'
        : explicitRegister
          ? 'explicit_register_directive'
          : randomStanceEnabled
            ? 'random_performance'
            : source.policy_composition?.activated_overlay || policy,
      policy_composition: source.policy_composition || null,
      turn: tutorLearnerDag?.model?.turn ?? state.turns.length + 1,
      engagement_stance: selected,
      selected_register: selected,
      selected_mode: selected,
      legacy_selected_register:
        source.legacy_selected_register ||
        selectedResolution?.legacy_selected_register ||
        preferredLegacyRegister({ register: selected, requestType, actionFamily }),
      action_family: actionFamily || null,
      discourse_plane: structuredClone(discoursePlane),
      addressee_profile: responseConfiguration.addressee_profile,
      audience_register: responseConfiguration.audience_register,
      register_pragmatics: responseConfiguration.register_pragmatics,
      lexical_accessibility: responseConfiguration.lexical_accessibility,
      scene_immersion: responseConfiguration.scene_immersion,
      actorial_part: responseConfiguration.actorial_part,
      actorial_part_label: responseConfiguration.actorial_part_label,
      actorial_part_selection: responseConfiguration.actorial_part_selection,
      actorial_performance: responseConfiguration.actorial_performance,
      unresolved_terms: responseConfiguration.unresolved_terms,
      valence: definition.valence || null,
      router_selectable: definition.router_selectable === true,
      simulated_only: definition.simulated_only === true,
      request_type: requestType,
      reviewer_signal: reviewerSignal,
      learner_signal: requestType,
      engagement_stance_reason: String(
        source.engagement_stance_reason || source.stance_reason || source.register_reason || source.reason || '',
      ),
      register_reason: String(
        source.engagement_stance_reason || source.stance_reason || source.register_reason || source.reason || '',
      ),
      evidence_span: String(source.evidence_span || source.evidence || ''),
      risk_flags: Array.isArray(source.risk_flags) ? source.risk_flags.map(String) : [],
      expected_dag_move: String(source.expected_dag_move || ''),
      expected_field_move: String(source.expected_field_move || source.expected_learner_field_move || ''),
      expected_progress_marker: String(source.expected_progress_marker || ''),
      temperature: state.register?.temperature ?? DEFAULT_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE,
      engagement_stance_temperature: state.register?.temperature ?? DEFAULT_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE,
      temperature_scope: temperatureSelection.scope,
      temperature_applied: temperatureSelection.applied,
      confidence: Number.isFinite(Number(source.confidence)) ? Number(source.confidence) : null,
      selected_probability: Number.isFinite(Number(source.selected_probability))
        ? Number(source.selected_probability)
        : null,
      distribution: Array.isArray(source.distribution) ? source.distribution : null,
      engagement_stance_distribution: Array.isArray(source.engagement_stance_distribution)
        ? source.engagement_stance_distribution
        : Array.isArray(source.distribution)
          ? source.distribution
          : null,
      pre_override_engagement_stance_distribution: Array.isArray(source.pre_override_engagement_stance_distribution)
        ? source.pre_override_engagement_stance_distribution
        : null,
      register_vector:
        source.register_vector && typeof source.register_vector === 'object' ? source.register_vector : null,
      engagement_stance_vector:
        source.engagement_stance_vector && typeof source.engagement_stance_vector === 'object'
          ? source.engagement_stance_vector
          : source.register_vector && typeof source.register_vector === 'object'
            ? source.register_vector
            : null,
      register_vector_entropy_bits: Number.isFinite(Number(source.register_vector_entropy_bits))
        ? Number(source.register_vector_entropy_bits)
        : null,
      field_policy: source.field_policy || null,
      trajectory_policy: source.trajectory_policy || null,
      dynamical_system_policy: source.dynamical_system_policy || null,
      continuous_register_policy: source.continuous_register_policy || null,
      response_configuration: responseConfiguration,
      light_adaptation: responseConfiguration.light_adaptation,
      state_policy: source.state_policy || null,
      source: source.source || 'combined_learner_analysis',
      ...(source.predeclared_pressure === true ? { predeclared_pressure: true } : {}),
      random: source.random || null,
      random_performance: randomPerformanceEnabled
        ? {
            schema: 'machinespirits.tutor-stub.random-performance-selection.v1',
            enabled: randomPerformanceActive,
            configured: true,
            active_axes: [
              randomStanceEnabled ? 'engagement_stance' : null,
              randomCharacterEnabled ? 'actorial_part' : null,
            ].filter(Boolean),
            explicitly_directed_axes: [
              explicitRegister ? 'engagement_stance' : null,
              explicitCharacter ? 'actorial_part' : null,
            ].filter(Boolean),
            assessment_influence: {
              engagement_stance: false,
              actorial_part: false,
              action_family: true,
              audience_register: true,
              lexical_accessibility: true,
              scene_immersion: true,
            },
            engagement_stance: randomStanceEnabled ? source.random || null : null,
            actorial_part: randomCharacterEnabled
              ? responseConfiguration.actorial_part_selection?.random || null
              : null,
            hard_constraints_preserved: ['dialogue_closure', 'evidence_release', 'response_safety'],
          }
        : null,
      performance_directives:
        explicitRegister || explicitCharacter
          ? {
              schema: 'machinespirits.tutor-stub.explicit-performance-directives.v1',
              precedence: 'light_adaptation_then_explicit_axis_then_random_axis_then_adaptive_policy',
              register: explicitRegister
                ? {
                    value: explicitRegister,
                    applied: !lightAdaptationTriggered,
                    outcome: lightAdaptationTriggered ? 'overridden_by_light_adaptation' : 'applied',
                    assessment_influence: false,
                  }
                : null,
              character: explicitCharacter
                ? {
                    value: explicitCharacter,
                    applied:
                      !lightAdaptationTriggered &&
                      responseConfiguration.actorial_part_selection?.explicit_directive?.applied !== false,
                    outcome: lightAdaptationTriggered
                      ? 'overridden_by_light_adaptation'
                      : responseConfiguration.actorial_part_selection?.explicit_directive?.outcome || 'applied',
                    assessment_influence: false,
                  }
                : null,
              assessment_influence: {
                engagement_stance: !explicitRegister,
                actorial_part: !explicitCharacter,
                action_family: true,
                audience_register: true,
                lexical_accessibility: true,
                scene_immersion: true,
              },
              hard_constraints_preserved: [
                'dialogue_closure',
                'authored_evidence_source',
                'evidence_release',
                'response_safety',
              ],
            }
          : null,
      model: raw ? { provider: raw.provider, model: raw.model, latencyMs: raw.latencyMs, usage: raw.usage } : null,
      selectedAtDag: tutorLearnerDag?.model || null,
      efficacy: null,
    };
    if (source.warning) {
      selection.warning = source.warning;
    } else if (!requestedIsKnown && selection.source === 'combined_learner_analysis') {
      selection.warning = source.warning || `invalid_register_selection:${requested || 'missing'}`;
    } else if (dynamicBriskBlocked) {
      selection.warning = 'dynamic_policy_brisk_demoted';
      selection.original_register = requested;
    }
    selection.response_configuration.compatibility.legacy_selected_register = selection.legacy_selected_register;
    state.register.history.push(selection);
    state.register.current = selection;
    return selection;
  }

  return Object.freeze({
    registerSelectionFromCombinedAnalysis,
    evaluatePendingRegisterEfficacy,
    policySamplingContext,
    explicitPerformanceDirectiveValue,
    resolveTutorStubCharacterChoice,
    explicitPerformanceActorialPartSelection,
    performanceTemperatureScope,
    randomPerformanceActorialPartSelection,
    formatEngagementStanceDistribution,
    normalizeResponseConfigurationSelection,
  });
}
