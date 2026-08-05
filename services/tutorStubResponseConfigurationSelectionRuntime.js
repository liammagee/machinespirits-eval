export function createTutorStubResponseConfigurationSelectionRuntime(
  dependencies = {},
  selectionRuntime = {},
  adaptiveRuntime = {},
) {
  const {
    DEFAULT_TUTOR_STUB_ENGAGEMENT_STANCE_TEMPERATURE,
    buildTutorStubLightAdaptationDecision,
    buildTutorStubResponseConfiguration,
    currentReleaseRows,
    getEngagementStanceDefinition,
    getRegisterOntologyVersion,
    preferredLegacyRegister,
    registerTemperatureApplies,
    resolveEngagementStance,
    resolveTutorStubDiscoursePlane,
    sampleTutorStubPolicyDistribution,
    selectTutorStubActorialPart,
    tutorStubComprehensionFeatures,
    tutorStubRegisterPolicyStackId,
    tutorStubReleasePacingSnapshot,
  } = dependencies;
  const {
    applyEngagementStanceOverride,
    characterDefaultEngagementStance,
    explicitEngagementStanceSelection,
    explicitPerformanceActorialPartSelection,
    explicitPerformanceDirectiveValue,
    fallbackRegisterSelection,
    fixedBlandEngagementStanceSelection,
    negativeEngagementStanceSelection,
    performanceTemperatureScope,
    policySamplingContext,
    predeclaredPressureTurns,
    randomEngagementStanceSelection,
    randomPerformanceActorialPartSelection,
    shouldUseDynamicBrisk,
  } = selectionRuntime;
  const {
    composeRegisterPolicySelection,
    continuousDynamicalSystemEngagementStanceSelection,
    dynamicalSystemEngagementStanceSelection,
    fieldEngagementStanceSelection,
    stateEngagementStanceSelection,
    trajectoryEngagementStanceSelection,
  } = adaptiveRuntime;

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

  return Object.freeze({ normalizeResponseConfigurationSelection });
}
