import { createHash } from 'node:crypto';
import { estimateLearnerStateBelief } from './actionPolicy.js';
import { createDifficultyAwareBelief, difficultyAwareBeliefFeatures } from './difficultyAwareBelief.js';
import { analyzeEvidenceContract, detectOutcomeEvidence } from './outcomeObserver.js';

export const TUTOR_STUB_STATE_OBSERVATION_SCHEMA = 'machinespirits.tutor-stub.state-observation.v1';
export const ADAPTIVE_STATE_BENCHMARK_ROW_SCHEMA = 'machinespirits.adaptive-state-benchmark-row.v1';
export const ADAPTIVE_STATE_TARGET_HORIZON_SCHEMA = 'machinespirits.adaptive-state-target-horizon.v1';

const FORBIDDEN_PRIVATE_KEYS =
  /^(hidden|hidden_state|answer_key|actual_misconception|private_profile|profile_contract)$/iu;

function clamp01(value, fallback = 0.5) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.min(1, numeric));
}

function normalizedScore(value, fallback = 0.5) {
  const source = value && typeof value === 'object' ? value.score : value;
  const numeric = Number(source);
  if (!Number.isFinite(numeric)) return fallback;
  return clamp01(numeric > 1 ? numeric / 5 : numeric, fallback);
}

function isObservedNumber(value) {
  const source = value && typeof value === 'object' ? value.score : value;
  return source !== null && source !== undefined && source !== '' && Number.isFinite(Number(source));
}

function normalizedNumber(value, fallback = 0) {
  const source = value && typeof value === 'object' ? value.score : value;
  return isObservedNumber(value) ? Number(source) : fallback;
}

function isObservedValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== '';
}

function shortHash(value) {
  return createHash('sha256')
    .update(String(value || ''))
    .digest('hex')
    .slice(0, 12);
}

function exactEvidence(turn, learnerText) {
  const quote = String(learnerText || '');
  if (!quote) return [];
  return [
    {
      obs_id: `t${turn}-learner-${shortHash(quote)}`,
      turn,
      quote,
      type: 'learner_action',
      validated: true,
      source: 'public_learner_utterance',
    },
  ];
}

function normalizedClassifier(turnRecord = {}) {
  const source = turnRecord.classification?.turn || turnRecord.classifier || turnRecord.learnerState || {};
  const scores = source.scores || {};
  const conceptualScore =
    scores.conceptual_engagement ?? scores.conceptual ?? source.conceptual_score ?? source.conceptualScore;
  const epistemicReadinessScore =
    scores.epistemic_readiness ??
    scores.epistemicReadiness ??
    source.epistemic_readiness_score ??
    source.epistemicReadinessScore;
  const requestType = source.request_type ?? source.requestType;
  const discourseMove = source.discourse_move ?? source.discourseMove;
  const evidenceUse = source.evidence_use ?? source.evidenceUse;
  const epistemicStance = source.epistemic_stance ?? source.epistemicStance;
  const pedagogicalNeed = source.pedagogical_need ?? source.pedagogicalNeed;
  return {
    request_type: isObservedValue(requestType) ? String(requestType) : 'unknown',
    discourse_move: isObservedValue(discourseMove) ? String(discourseMove) : 'unknown',
    evidence_use: isObservedValue(evidenceUse) ? String(evidenceUse) : 'unknown',
    epistemic_stance: isObservedValue(epistemicStance) ? String(epistemicStance) : 'unknown',
    agency: source.agency || 'unknown',
    affect: source.affect || 'unknown',
    conceptual_score: normalizedScore(conceptualScore),
    epistemic_readiness_score: normalizedScore(epistemicReadinessScore),
    pedagogical_need: isObservedValue(pedagogicalNeed) ? String(pedagogicalNeed) : '',
    missingness: {
      request_type: !isObservedValue(requestType),
      discourse_move: !isObservedValue(discourseMove),
      evidence_use: !isObservedValue(evidenceUse),
      epistemic_stance: !isObservedValue(epistemicStance),
      agency: !isObservedValue(source.agency),
      affect: !isObservedValue(source.affect),
      conceptual_score: !isObservedNumber(conceptualScore),
      epistemic_readiness_score: !isObservedNumber(epistemicReadinessScore),
      pedagogical_need: !isObservedValue(pedagogicalNeed),
    },
  };
}

function normalizedDag(turnRecord = {}) {
  const model = turnRecord.tutorLearnerDagModel || turnRecord.dag || {};
  const assessment = model.assessment || model;
  const metrics = model.metrics || {};
  const bestPathCoverage = assessment.bestPathCoverage ?? assessment.best_path_coverage;
  const missingPremiseCount =
    metrics.missingPremiseCount ??
    metrics.missing_premise_count ??
    assessment.missingPremiseCount ??
    assessment.missing_premise_count;
  const groundedCount =
    metrics.groundedCount ?? metrics.grounded_count ?? assessment.groundedCount ?? assessment.grounded_count;
  const voicedDerivedCount =
    metrics.voicedDerivedCount ??
    metrics.voiced_derived_count ??
    assessment.voicedDerivedCount ??
    assessment.voiced_derived_count;
  const unsupportedAssertionCount = assessment.unsupportedAssertionCount ?? assessment.unsupported_assertion_count;
  const finalSecretEntailed = assessment.finalSecretEntailed ?? assessment.final_secret_entailed;
  const assertedSecret = assessment.assertedSecret ?? assessment.asserted_secret;
  const assertedMirror = assessment.assertedMirror ?? assessment.asserted_mirror;
  return {
    status: assessment.status || null,
    bottleneck: assessment.bottleneck || 'unknown',
    best_path_coverage: clamp01(bestPathCoverage, 0),
    missing_premise_count: normalizedNumber(missingPremiseCount),
    grounded_count: normalizedNumber(groundedCount),
    voiced_derived_count: normalizedNumber(voicedDerivedCount),
    unsupported_assertion_count: normalizedNumber(unsupportedAssertionCount),
    final_secret_entailed: finalSecretEntailed === true,
    asserted_secret: assertedSecret === true,
    asserted_mirror: assertedMirror === true,
    missingness: {
      status: !isObservedValue(assessment.status),
      bottleneck: !isObservedValue(assessment.bottleneck),
      best_path_coverage: !isObservedNumber(bestPathCoverage),
      missing_premise_count: !isObservedNumber(missingPremiseCount),
      grounded_count: !isObservedNumber(groundedCount),
      voiced_derived_count: !isObservedNumber(voicedDerivedCount),
      unsupported_assertion_count: !isObservedNumber(unsupportedAssertionCount),
      final_secret_entailed: typeof finalSecretEntailed !== 'boolean',
      asserted_secret: typeof assertedSecret !== 'boolean',
      asserted_mirror: typeof assertedMirror !== 'boolean',
    },
  };
}

function acceptedEvents(turnRecord = {}) {
  const accepted = turnRecord.tutorLearnerDagUpdate?.accepted || turnRecord.accepted || {};
  const events = [];
  for (const premiseId of accepted.adopt || []) {
    if (typeof premiseId !== 'string' || !premiseId.trim()) continue;
    events.push({ event_id: `adopt:${premiseId}`, kind: 'adopt', fact_id: premiseId });
  }
  for (const premiseId of accepted.retract || []) {
    if (typeof premiseId !== 'string' || !premiseId.trim()) continue;
    events.push({ event_id: `retract:${premiseId}`, kind: 'retract', fact_id: premiseId });
  }
  for (const fact of accepted.derive || []) {
    if (!Array.isArray(fact) || fact.some((part) => typeof part !== 'string')) continue;
    const factId = `fact-${shortHash(JSON.stringify(fact))}`;
    events.push({ event_id: `derive:${factId}`, kind: 'derive', fact_id: factId });
  }

  // Imported historical fixtures sometimes expose normalized event objects in
  // another accepted-event bucket. Preserve only their explicit public ids.
  for (const [bucket, values] of Object.entries(accepted)) {
    if (['adopt', 'retract', 'derive'].includes(bucket) || !Array.isArray(values)) continue;
    for (const value of values) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
      const factId = value.id || value.key || value.fact_id || value.factId || value.obs_id || null;
      if (factId) events.push({ event_id: `${bucket}:${factId}`, kind: bucket, fact_id: String(factId) });
    }
  }
  return [...new Map(events.map((event) => [event.event_id, event])).values()].sort((left, right) =>
    left.event_id.localeCompare(right.event_id),
  );
}

function proofDebtSummary(turnRecord = {}) {
  const debt = turnRecord.proofDebt || turnRecord.humanDiscourseFrame?.proofDebt || {};
  const openCount = debt.counts?.open ?? (Array.isArray(debt.open) ? debt.open.length : undefined);
  const harmfulCount = debt.counts?.harmful;
  return {
    status: debt.status || 'unknown',
    open_count: normalizedNumber(openCount),
    harmful_count: normalizedNumber(harmfulCount),
    missingness: {
      status: !isObservedValue(debt.status),
      open_count: !isObservedNumber(openCount),
      harmful_count: !isObservedNumber(harmfulCount),
    },
  };
}

function publicAxes(classifier, dag, previous = null) {
  const ownershipByAgency = {
    steering: 0.9,
    collaborative: 0.75,
    questioning: 0.65,
    exploring: 0.65,
    complying: 0.35,
    compliant: 0.35,
    passive: 0.2,
    answer_seeking: 0.15,
  };
  const affectRisk = /frustrat|shame|anxious|withdraw|shutdown|angry/iu.test(classifier.affect) ? 0.75 : 0.2;
  const evidenceOwned = /links|revises|grounded|independent|rationale|evidence/iu.test(classifier.evidence_use);
  const coverageDelta = previous ? dag.best_path_coverage - Number(previous.dag?.best_path_coverage || 0) : 0;
  return {
    proof: dag.best_path_coverage,
    release: dag.final_secret_entailed ? (dag.asserted_secret ? 1 : 0.8) : clamp01(dag.best_path_coverage * 0.65),
    ownership: clamp01(ownershipByAgency[classifier.agency] ?? (evidenceOwned ? 0.65 : 0.4)),
    conceptual_mastery: clamp01(classifier.conceptual_score * 0.55 + dag.best_path_coverage * 0.45),
    metacognitive_accuracy: clamp01(
      classifier.epistemic_readiness_score * 0.55 + (classifier.epistemic_stance === 'grounded' ? 0.3 : 0.1),
    ),
    affective_readiness: clamp01(1 - affectRisk),
    confidence: clamp01(classifier.epistemic_readiness_score),
    proof_velocity: clamp01(0.5 + coverageDelta),
  };
}

function assertPublicOnly(value, path = 'observation') {
  if (!value || typeof value !== 'object') return;
  for (const [key, nested] of Object.entries(value)) {
    if (FORBIDDEN_PRIVATE_KEYS.test(key))
      throw new Error(`tutorStubStateAdapter: forbidden private field ${path}.${key}`);
    assertPublicOnly(nested, `${path}.${key}`);
  }
}

export function buildTutorStubStateObservation({ turnRecord, previousObservation = null, provenance = {} } = {}) {
  if (!turnRecord || typeof turnRecord !== 'object') {
    throw new Error('tutorStubStateAdapter: turnRecord is required');
  }
  const turn = Number(turnRecord.turn || 0);
  const learnerText = String(turnRecord.learner || turnRecord.learner_text || '');
  const classifier = normalizedClassifier(turnRecord);
  const dag = normalizedDag(turnRecord);
  const events = acceptedEvents(turnRecord);
  const proofDebt = proofDebtSummary(turnRecord);
  const scaffoldStatus =
    turnRecord.scaffoldState?.status || turnRecord.humanDiscourseFrame?.scaffoldState?.status || null;
  const warrantStatus =
    turnRecord.warrantPremiseAudit?.proofStatus ||
    turnRecord.humanDiscourseFrame?.warrantPremiseAudit?.proofStatus ||
    null;
  const observation = {
    schema: TUTOR_STUB_STATE_OBSERVATION_SCHEMA,
    version: '1.0',
    turn,
    learner_text: learnerText,
    classifier,
    dag,
    accepted_events: events,
    accepted_event_ids: events.map((event) => event.event_id),
    public_evidence: exactEvidence(turn, learnerText),
    human_discourse: {
      proof_debt: proofDebt,
      scaffold_status: scaffoldStatus || 'unknown',
      warrant_status: warrantStatus || 'unknown',
    },
    missingness: {
      learner_text: !isObservedValue(turnRecord.learner ?? turnRecord.learner_text),
      classifier: { ...classifier.missingness },
      dag: { ...dag.missingness },
      human_discourse: {
        proof_debt: { ...proofDebt.missingness },
        scaffold_status: !isObservedValue(scaffoldStatus),
        warrant_status: !isObservedValue(warrantStatus),
      },
    },
    axes: publicAxes(classifier, dag, previousObservation),
    provenance: {
      ...provenance,
      policy_invariant: true,
      excluded_channels: ['registerSelection', 'responseConfiguration', 'tutor_output', 'hidden_learner_state'],
      source_channels: [
        'learner_utterance',
        'public_classifier',
        'public_learner_dag',
        'public_human_discourse_audits',
      ],
    },
  };
  assertPublicOnly(observation);
  return observation;
}

function hypothesesFeatureMap(belief) {
  return Object.fromEntries((belief?.hypotheses || []).map((hypothesis) => [hypothesis.id, hypothesis.probability]));
}

function beliefFeatures(belief, lean, { includeAffect = true, includeDifficulty = true } = {}) {
  const axes = { ...(belief.axes || {}) };
  if (!includeAffect) delete axes.affective_readiness;
  const task = { ...difficultyAwareBeliefFeatures(lean) };
  if (!includeDifficulty) {
    delete task.item_difficulty;
    delete task.item_discrimination;
  }
  return {
    hypotheses: hypothesesFeatureMap(belief),
    evidence: Object.fromEntries(
      (belief.hypotheses || []).map((hypothesis) => [
        hypothesis.id,
        {
          supporting_ids: [...(hypothesis.evidence_ids || [])],
          supporting: [...(hypothesis.evidence || [])],
          contradicting: [...(hypothesis.disconfirming_evidence || [])],
        },
      ]),
    ),
    axes,
    uncertainty: {
      entropy: belief.uncertainty?.entropy ?? null,
      needs_discrimination: belief.uncertainty?.needs_discrimination ?? null,
    },
    task,
  };
}

function plan4FieldFeatures(observation, { includeDynamics = true } = {}) {
  const base = {
    learner: {
      mastery: observation.axes.conceptual_mastery,
      proof: observation.axes.proof,
      ownership: observation.axes.ownership,
      confidence: observation.axes.confidence,
      affective_readiness: observation.axes.affective_readiness,
    },
    tutor: {
      prior_alignment: observation.axes.metacognitive_accuracy,
    },
    discourse: {
      request_type: observation.classifier.request_type,
      discourse_move: observation.classifier.discourse_move,
      evidence_use: observation.classifier.evidence_use,
      epistemic_stance: observation.classifier.epistemic_stance,
      proof_debt_status: observation.human_discourse.proof_debt.status,
      warrant_status: observation.human_discourse.warrant_status,
    },
    joint: {
      best_path_coverage: observation.dag.best_path_coverage,
      missing_premise_count: observation.dag.missing_premise_count,
      unsupported_assertion_count: observation.dag.unsupported_assertion_count,
    },
  };
  if (includeDynamics) {
    base.dynamics = {
      proof_velocity: observation.axes.proof_velocity,
      accepted_event_count: observation.accepted_event_ids.length,
    };
  }
  return base;
}

function shuffledEvidenceBelief(belief) {
  const cloned = JSON.parse(JSON.stringify(belief));
  const evidence = cloned.hypotheses.flatMap((hypothesis) => hypothesis.evidence || []);
  if (evidence.length > 1) evidence.push(evidence.shift());
  let offset = 0;
  for (const hypothesis of cloned.hypotheses) {
    const count = (hypothesis.evidence || []).length;
    hypothesis.evidence = evidence.slice(offset, offset + count);
    offset += count;
  }
  return cloned;
}

export function alignedScrambleTutorStubBelief(belief, seed = 0) {
  const cloned = JSON.parse(JSON.stringify(belief));
  const hypotheses = cloned.hypotheses || [];
  if (hypotheses.length > 1) {
    const offset = Math.abs(Math.trunc(Number(seed) || 0)) % hypotheses.length || 1;
    const bundles = hypotheses.map((hypothesis) => ({
      probability: hypothesis.probability,
      evidence: hypothesis.evidence,
      evidence_ids: hypothesis.evidence_ids,
      disconfirming_evidence: hypothesis.disconfirming_evidence,
    }));
    hypotheses.forEach((hypothesis, index) => {
      const source = bundles[(index + offset) % bundles.length];
      hypothesis.probability = source.probability;
      hypothesis.evidence = source.evidence;
      hypothesis.evidence_ids = source.evidence_ids;
      hypothesis.disconfirming_evidence = source.disconfirming_evidence;
    });
    hypotheses.sort((left, right) => Number(right.probability || 0) - Number(left.probability || 0));
  }
  const axes = Object.keys(cloned.axes || {});
  if (axes.length > 1) {
    const offset = Math.abs(Math.trunc(Number(seed) || 0)) % axes.length || 1;
    const values = axes.map((key) => cloned.axes[key]);
    axes.forEach((key, index) => {
      cloned.axes[key] = values[(index + offset) % values.length];
    });
  }
  return cloned;
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function additionalState(value) {
  if (value && typeof value === 'object' && Object.hasOwn(value, 'additional_state')) {
    return value.additional_state;
  }
  return value;
}

function augmentedRepresentation(leanBaseline, state) {
  return {
    lean_baseline: cloneJson(leanBaseline),
    additional_state: cloneJson(state),
  };
}

export function validateCommonLeanBaselineRepresentations(representations) {
  const leanBaseline = representations?.lean?.lean_baseline;
  if (!leanBaseline || typeof leanBaseline !== 'object' || Array.isArray(leanBaseline)) {
    throw new Error('tutorStubStateAdapter: lean representation needs a lean_baseline block');
  }
  const expectedBytes = JSON.stringify(leanBaseline);
  for (const [name, representation] of Object.entries(representations || {})) {
    if (name === 'lean') continue;
    if (!representation || typeof representation !== 'object' || Array.isArray(representation)) {
      throw new Error(`tutorStubStateAdapter: representation ${name} must be an object`);
    }
    if (!Object.hasOwn(representation, 'lean_baseline') || !Object.hasOwn(representation, 'additional_state')) {
      throw new Error(
        `tutorStubStateAdapter: representation ${name} must contain lean_baseline and additional_state blocks`,
      );
    }
    if (JSON.stringify(representation.lean_baseline) !== expectedBytes) {
      throw new Error(`tutorStubStateAdapter: representation ${name} does not preserve the byte-equal lean baseline`);
    }
  }
  return true;
}

export function buildTutorStubStateRepresentations({
  observation,
  task,
  previousRepresentations = null,
  scrambleSeed = 0,
  oracleState = null,
} = {}) {
  if (observation?.schema !== TUTOR_STUB_STATE_OBSERVATION_SCHEMA) {
    throw new Error(`tutorStubStateAdapter: unsupported observation schema ${JSON.stringify(observation?.schema)}`);
  }
  const leanBelief = createDifficultyAwareBelief({ task, observation });
  const plan2Belief = estimateLearnerStateBelief({
    dialogue: [{ role: 'learner', content: observation.learner_text }],
    turnIndex: observation.turn,
  });
  plan2Belief.axes = {
    ...plan2Belief.axes,
    proof: observation.axes.proof,
    release: observation.axes.release,
    ownership: observation.axes.ownership,
    conceptual_mastery: observation.axes.conceptual_mastery,
    metacognitive_accuracy: observation.axes.metacognitive_accuracy,
    affective_readiness: observation.axes.affective_readiness,
  };
  plan2Belief.hypotheses = plan2Belief.hypotheses.map((hypothesis) => ({
    ...hypothesis,
    evidence_ids: observation.public_evidence.map((entry) => entry.obs_id),
  }));
  const scrambled = alignedScrambleTutorStubBelief(plan2Belief, scrambleSeed);
  const shuffled = shuffledEvidenceBelief(plan2Belief);
  const leanBaseline = difficultyAwareBeliefFeatures(leanBelief);
  const representations = {
    lean: { lean_baseline: cloneJson(leanBaseline) },
    plan2_belief: augmentedRepresentation(leanBaseline, beliefFeatures(plan2Belief, leanBelief)),
    plan4_fields: augmentedRepresentation(leanBaseline, plan4FieldFeatures(observation)),
    field_without_dynamics: augmentedRepresentation(
      leanBaseline,
      plan4FieldFeatures(observation, { includeDynamics: false }),
    ),
    belief_without_affect: augmentedRepresentation(
      leanBaseline,
      beliefFeatures(plan2Belief, leanBelief, { includeAffect: false }),
    ),
    belief_without_task_difficulty: augmentedRepresentation(
      leanBaseline,
      beliefFeatures(plan2Belief, leanBelief, { includeDifficulty: false }),
    ),
    state_scramble: augmentedRepresentation(leanBaseline, beliefFeatures(scrambled, leanBelief)),
    shuffled_evidence_ids: augmentedRepresentation(leanBaseline, beliefFeatures(shuffled, leanBelief)),
    stale_state: augmentedRepresentation(
      leanBaseline,
      previousRepresentations?.plan2_belief ? additionalState(previousRepresentations.plan2_belief) : { missing: true },
    ),
  };
  if (oracleState) representations.oracle = augmentedRepresentation(leanBaseline, oracleState);
  validateCommonLeanBaselineRepresentations(representations);
  return {
    representations,
    artifacts: {
      lean_belief: leanBelief,
      plan2_belief: plan2Belief,
    },
  };
}

function ownedAgency(agency) {
  return /steering|self.directed|collaborative|questioning|exploring/iu.test(String(agency || ''));
}

const KNOWN_ERROR_FAMILIES = new Set([
  'release_or_pacing_gap',
  'inference_gap',
  'learner_integration_gap',
  'assertion_gap',
  'premature_assertion',
  'unsupported_assertion',
  'grounded_asserted_secret',
]);

function normalizedErrorFamily(observation) {
  if (Number(observation?.dag?.unsupported_assertion_count || 0) > 0) return 'unsupported_assertion';
  const bottleneck = String(observation?.dag?.bottleneck || 'other');
  return KNOWN_ERROR_FAMILIES.has(bottleneck) ? bottleneck : 'other';
}

function targetedFeedbackUptake(action, nextObservation) {
  const expected = action?.expected_evidence?.success || action?.expectedEvidence?.success || [];
  if (!Array.isArray(expected) || expected.length === 0) return 'inconclusive';
  const observed = detectOutcomeEvidence(nextObservation?.learner_text || '');
  const contract = analyzeEvidenceContract({ required_evidence: expected }, observed.categories);
  return contract.satisfied ? 'uptake_observed' : 'no_observed_uptake';
}

function normalizedDropoutRepair(value) {
  if (value == null) return 'not_applicable';
  if (typeof value === 'string') {
    if (['repaired', 'not_repaired', 'not_applicable'].includes(value)) return value;
    throw new Error(`tutorStubStateAdapter: invalid dropout repair target ${JSON.stringify(value)}`);
  }
  const active = new Set((value.activePremiseIds || value.active_premise_ids || []).map(String));
  if (!active.size) return 'not_applicable';
  const repaired = (value.repairedPremiseIds || value.repaired_premise_ids || []).map(String);
  return repaired.some((premiseId) => active.has(premiseId)) ? 'repaired' : 'not_repaired';
}

function benchmarkObservationTurn(observation, label) {
  const turn = Number(observation?.turn);
  if (!Number.isInteger(turn) || turn < 0) {
    throw new Error(`tutorStubStateAdapter: ${label} needs a non-negative integer turn`);
  }
  return turn;
}

export function buildAdaptiveStateTargetHorizon({
  kind,
  currentObservation,
  nextObservation,
  horizonObservation = null,
  requestedTurn = null,
} = {}) {
  const predictionTurn = benchmarkObservationTurn(currentObservation, 'current observation');
  const nextTurn = benchmarkObservationTurn(nextObservation, 'next observation');
  const sourceObservation = horizonObservation || nextObservation;
  const sourceObservationTurn = benchmarkObservationTurn(sourceObservation, 'horizon source observation');
  const normalizedKind = String(kind || '').trim();
  let normalizedRequestedTurn;
  let sourcePolicy;

  if (normalizedKind === 'immediate_next_observation') {
    normalizedRequestedTurn = nextTurn;
    if (sourceObservationTurn !== nextTurn) {
      throw new Error('tutorStubStateAdapter: immediate-next horizon must use the exact next observation');
    }
    sourcePolicy = 'exact_next_observation';
  } else if (normalizedKind === 'fixed_learner_turn') {
    normalizedRequestedTurn = Number(requestedTurn);
    if (!Number.isInteger(normalizedRequestedTurn) || normalizedRequestedTurn < 1) {
      throw new Error('tutorStubStateAdapter: fixed learner-turn horizon needs a positive requested turn');
    }
    if (sourceObservationTurn > normalizedRequestedTurn) {
      throw new Error(
        `tutorStubStateAdapter: fixed turn ${normalizedRequestedTurn} cannot use later observation turn ${sourceObservationTurn}`,
      );
    }
    sourcePolicy =
      sourceObservationTurn === normalizedRequestedTurn
        ? 'exact_fixed_turn_observation'
        : 'last_observation_carried_forward';
  } else {
    throw new Error(`tutorStubStateAdapter: unsupported target horizon kind ${JSON.stringify(kind)}`);
  }

  const turnOffset = normalizedRequestedTurn - predictionTurn;
  return {
    schema: ADAPTIVE_STATE_TARGET_HORIZON_SCHEMA,
    target: 'task_success_at_horizon',
    kind: normalizedKind,
    prediction_turn: predictionTurn,
    requested_turn: normalizedRequestedTurn,
    source_observation_turn: sourceObservationTurn,
    source_policy: sourcePolicy,
    prediction_relation: turnOffset > 0 ? 'future' : turnOffset === 0 ? 'at_horizon' : 'past_horizon',
    prediction_precedes_horizon: turnOffset > 0,
    turn_offset: turnOffset,
  };
}

export function buildTutorStubNextEventTargets({
  currentObservation,
  nextObservation,
  horizonObservation = null,
  targetHorizon = null,
  diagnosticResolved = null,
  action = null,
  dropoutRepair = null,
} = {}) {
  if (!currentObservation || !nextObservation) return null;
  const exactNextEvents = nextObservation.accepted_events || [];
  const horizon = horizonObservation || nextObservation;
  const independentlyOwnedEvent = exactNextEvents.some(
    (event) => !['retract', 'hypothesis', 'assertAnswer'].includes(event.kind),
  );
  const agency = String(nextObservation.classifier?.agency || 'unknown');
  const ownershipKnown = agency !== 'unknown';
  return {
    next_error_family: normalizedErrorFamily(nextObservation),
    next_evidence_edge: exactNextEvents[0]?.event_id || 'none',
    dropout_repair: normalizedDropoutRepair(dropoutRepair),
    targeted_feedback_uptake: targetedFeedbackUptake(action, nextObservation),
    learner_owned_next_move: !ownershipKnown
      ? 'inconclusive'
      : ownedAgency(agency) && independentlyOwnedEvent
        ? 'owned'
        : 'not_owned',
    task_success_at_horizon:
      targetHorizon?.prediction_precedes_horizon === false
        ? null
        : horizon.dag.final_secret_entailed &&
            horizon.dag.asserted_secret &&
            Number(horizon.dag.unsupported_assertion_count || 0) === 0 &&
            Number(horizon.human_discourse?.proof_debt?.harmful_count || 0) === 0
          ? 'success'
          : 'not_success',
    diagnostic_resolves_ambiguity:
      diagnosticResolved == null ? 'not_applicable' : diagnosticResolved ? 'resolved' : 'not_resolved',
  };
}

export function buildAdaptiveStateBenchmarkRow({
  id,
  groups,
  observation,
  task,
  nextObservation,
  horizonObservation = null,
  targetHorizon = null,
  previousRepresentations = null,
  scrambleSeed = 0,
  oracleState = null,
  action = null,
  dropoutRepair = null,
  featureProvenance = {},
} = {}) {
  if (!targetHorizon && horizonObservation && Number(horizonObservation.turn) !== Number(nextObservation?.turn)) {
    throw new Error('tutorStubStateAdapter: a non-next horizon observation needs explicit targetHorizon semantics');
  }
  const resolvedTargetHorizon = buildAdaptiveStateTargetHorizon({
    kind: targetHorizon?.kind || 'immediate_next_observation',
    currentObservation: observation,
    nextObservation,
    horizonObservation,
    requestedTurn: targetHorizon?.requested_turn ?? targetHorizon?.requestedTurn ?? null,
  });
  const state = buildTutorStubStateRepresentations({
    observation,
    task,
    previousRepresentations,
    scrambleSeed,
    oracleState,
  });
  return {
    schema: ADAPTIVE_STATE_BENCHMARK_ROW_SCHEMA,
    id: String(id || `${groups?.dialogue_id || 'dialogue'}-t${observation?.turn || 0}`),
    groups: { ...(groups || {}) },
    turn: observation.turn,
    action: action ? JSON.parse(JSON.stringify(action)) : null,
    target_horizon: resolvedTargetHorizon,
    targets: buildTutorStubNextEventTargets({
      currentObservation: observation,
      nextObservation,
      horizonObservation,
      targetHorizon: resolvedTargetHorizon,
      action,
      dropoutRepair,
    }),
    representations: state.representations,
    feature_provenance: {
      ...featureProvenance,
      hidden_state_used: Boolean(oracleState),
      non_oracle_hidden_state_used: false,
      oracle_upper_bound_only: Boolean(oracleState),
      policy_invariant: observation.provenance.policy_invariant === true,
      input_missingness: cloneJson(state.representations.lean.lean_baseline.input_missingness || {}),
      missingness: Object.fromEntries(
        Object.entries(state.representations).map(([name, value]) => [name, value?.additional_state?.missing === true]),
      ),
    },
  };
}
