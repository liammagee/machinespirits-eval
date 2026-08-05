export function createTutorStubAdaptiveResponsePolicyRuntime(dependencies = {}, selectionRuntime = {}) {
  const {
    DEFAULT_TUTOR_STUB_REGISTER_OVERLAY_THRESHOLD,
    DYNAMICAL_SYSTEM_REGISTER_AFFINITY,
    DYNAMICAL_SYSTEM_TEMPERATURE,
    TUTOR_STUB_REGISTER_POLICY_COMPOSITION_SCHEMA,
    buildContinuousEngagementStanceVector,
    buildContinuousRegisterPolicyMetadata,
    buildDynamicalSystemRegisterScores,
    buildFieldRegisterScores,
    buildStateRegisterScores,
    buildTrajectoryRegisterScores,
    continuousEngagementStanceInstruction,
    evaluateTutorStubRegisterPolicyOverlay,
    getEngagementStanceDefinitions,
    normalizeEngagementStanceDistribution,
    numberOr,
    preferredLegacyRegister,
    registerAffinityContributions,
    roundField,
    sampleTutorStubPolicyDistribution,
    topNumericEntries,
    tutorStubRegisterPolicyStackId,
  } = dependencies;
  const { firstAvailableRegister, policySamplingContext } = selectionRuntime;

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

  return Object.freeze({
    formatEngagementStanceDistribution,
    fieldEngagementStanceSelection,
    trajectoryEngagementStanceSelection,
    dynamicalSystemEngagementStanceSelection,
    continuousDynamicalSystemEngagementStanceSelection,
    stateEngagementStanceSelection,
    composeRegisterPolicySelection,
  });
}
