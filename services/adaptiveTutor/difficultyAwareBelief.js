export const DIFFICULTY_AWARE_BELIEF_SCHEMA = 'adaptive-tutor.difficulty-aware-belief.v1';

function clamp01(value, fallback = 0.5) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.min(1, numeric));
}

function normalizedScore(value, fallback = 0.5) {
  const direct = Number(value);
  if (!Number.isFinite(direct)) return fallback;
  return clamp01(direct > 1 ? direct / 5 : direct, fallback);
}

function isObservedNumber(value) {
  return value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
}

function missingFlag(explicit, value) {
  return typeof explicit === 'boolean' ? explicit : !isObservedNumber(value);
}

function requiredString(value, label) {
  const normalized = String(value || '').trim();
  if (!normalized) throw new Error(`difficultyAwareBelief: ${label} is required`);
  return normalized;
}

function taskRecord(task = {}) {
  const difficulty = Number(task.itemDifficulty ?? task.item_difficulty);
  const discriminationSource = task.itemDiscrimination ?? task.item_discrimination;
  const discrimination = Number(discriminationSource ?? 1);
  if (!Number.isFinite(difficulty) || difficulty < 0 || difficulty > 1) {
    throw new Error('difficultyAwareBelief: itemDifficulty must be in [0, 1]');
  }
  if (!Number.isFinite(discrimination) || discrimination <= 0) {
    throw new Error('difficultyAwareBelief: itemDiscrimination must be positive');
  }
  return {
    task_id: requiredString(task.taskId ?? task.task_id, 'taskId'),
    knowledge_component: requiredString(task.knowledgeComponent ?? task.knowledge_component, 'knowledgeComponent'),
    prerequisite_path: Array.isArray(task.prerequisitePath ?? task.prerequisite_path)
      ? [...(task.prerequisitePath ?? task.prerequisite_path)].map(String)
      : [],
    item_difficulty: difficulty,
    item_discrimination: discrimination,
    missingness: {
      item_difficulty: !isObservedNumber(task.itemDifficulty ?? task.item_difficulty),
      item_discrimination: !isObservedNumber(discriminationSource),
      prerequisite_path: !Array.isArray(task.prerequisitePath ?? task.prerequisite_path),
    },
  };
}

function prerequisiteStatus({ missingPremiseCount, coverage }) {
  if (Number(missingPremiseCount) <= 0 && coverage >= 0.8) return 'ready';
  if (Number(missingPremiseCount) >= 3 || coverage < 0.25) return 'missing';
  return 'partial';
}

export function createDifficultyAwareBelief({ task, observation } = {}) {
  if (!observation || typeof observation !== 'object') {
    throw new Error('difficultyAwareBelief: observation is required');
  }
  const normalizedTask = taskRecord(task);
  const classifier = observation.classifier || {};
  const dag = observation.dag || {};
  const coverage = clamp01(dag.best_path_coverage ?? dag.bestPathCoverage, 0);
  const conceptual = normalizedScore(
    classifier.conceptual_score ?? classifier.conceptualScore ?? classifier.scores?.conceptual,
  );
  const readiness = normalizedScore(
    classifier.epistemic_readiness_score ?? classifier.epistemicReadinessScore ?? classifier.scores?.epistemicReadiness,
  );
  const mastery = clamp01(coverage * 0.55 + conceptual * 0.3 + readiness * 0.15);
  const confidence = clamp01(
    observation.axes?.confidence ??
      classifier.confidence ??
      (classifier.epistemic_stance === 'grounded' ? 0.75 : readiness),
  );
  const ability = clamp01(
    mastery + (mastery - normalizedTask.item_difficulty) * normalizedTask.item_discrimination * 0.2,
  );
  const missingPremiseCount = Number(dag.missing_premise_count ?? dag.missingPremiseCount ?? 0);
  const lastPublicEvidence = observation.public_evidence?.at(-1) || null;
  const lastPublicEvidenceText = String(lastPublicEvidence?.quote || observation.learner_text || '');
  const inputMissingness = {
    classifier: {
      conceptual_score: missingFlag(
        observation.missingness?.classifier?.conceptual_score ?? classifier.missingness?.conceptual_score,
        classifier.conceptual_score ?? classifier.conceptualScore ?? classifier.scores?.conceptual,
      ),
      epistemic_readiness_score: missingFlag(
        observation.missingness?.classifier?.epistemic_readiness_score ??
          classifier.missingness?.epistemic_readiness_score,
        classifier.epistemic_readiness_score ??
          classifier.epistemicReadinessScore ??
          classifier.scores?.epistemicReadiness,
      ),
      epistemic_stance:
        observation.missingness?.classifier?.epistemic_stance ??
        classifier.missingness?.epistemic_stance ??
        !String(classifier.epistemic_stance || classifier.epistemicStance || '').trim(),
    },
    dag: {
      best_path_coverage: missingFlag(
        observation.missingness?.dag?.best_path_coverage ?? dag.missingness?.best_path_coverage,
        dag.best_path_coverage ?? dag.bestPathCoverage,
      ),
      missing_premise_count: missingFlag(
        observation.missingness?.dag?.missing_premise_count ?? dag.missingness?.missing_premise_count,
        dag.missing_premise_count ?? dag.missingPremiseCount,
      ),
    },
    task: { ...normalizedTask.missingness },
    learner_text: observation.missingness?.learner_text ?? !lastPublicEvidenceText.trim(),
  };
  return {
    schema: DIFFICULTY_AWARE_BELIEF_SCHEMA,
    version: '1.0',
    turn_index: Number(observation.turn ?? 0),
    task: normalizedTask,
    learner: {
      ability,
      mastery,
      confidence,
      prerequisite_status: prerequisiteStatus({ missingPremiseCount, coverage }),
      last_public_evidence: lastPublicEvidenceText,
      last_public_evidence_id: String(lastPublicEvidence?.obs_id || ''),
      last_public_evidence_type: String(lastPublicEvidence?.type || 'unknown'),
      last_public_evidence_source: String(lastPublicEvidence?.source || 'learner_utterance'),
    },
    public_state: {
      best_path_coverage: coverage,
      missing_premise_count: Number.isFinite(missingPremiseCount) ? missingPremiseCount : null,
      request_type: classifier.request_type || classifier.requestType || 'unknown',
      evidence_use: classifier.evidence_use || classifier.evidenceUse || 'unknown',
      agency: classifier.agency || 'unknown',
      affect: classifier.affect || 'unknown',
    },
    input_missingness: inputMissingness,
    provenance: {
      hidden_state_used: false,
      sources: ['task_metadata', 'public_classifier', 'public_proof_state', 'learner_utterance'],
    },
  };
}

export function difficultyAwareBeliefFeatures(belief) {
  if (belief?.schema !== DIFFICULTY_AWARE_BELIEF_SCHEMA) {
    throw new Error(`difficultyAwareBelief: unsupported schema ${JSON.stringify(belief?.schema)}`);
  }
  return {
    knowledge_component: belief.task.knowledge_component,
    prerequisite_status: belief.learner.prerequisite_status,
    learner_ability: belief.learner.ability,
    mastery: belief.learner.mastery,
    item_difficulty: belief.task.item_difficulty,
    item_discrimination: belief.task.item_discrimination,
    confidence: belief.learner.confidence,
    last_public_evidence: belief.learner.last_public_evidence,
    last_public_evidence_id: belief.learner.last_public_evidence_id,
    last_public_evidence_type: belief.learner.last_public_evidence_type,
    last_public_evidence_source: belief.learner.last_public_evidence_source,
    last_public_evidence_present: Boolean(belief.learner.last_public_evidence),
    best_path_coverage: belief.public_state.best_path_coverage,
    missing_premise_count: belief.public_state.missing_premise_count,
    input_missingness: JSON.parse(JSON.stringify(belief.input_missingness || {})),
  };
}
