import { closure, factKey, matchPattern } from './chainer.js';

export const LEARNER_PROXY_DAG_MEMORY_SCHEMA = 'machinespirits.derivation.learner-proxy-dag-memory.v1';
export const PROXY_DAG_PACING_SCHEMA = 'machinespirits.derivation.proxy-dag-pacing.v1';

function text(value) {
  return String(value ?? '')
    .replace(/\s+/gu, ' ')
    .trim();
}

function formatFact(fact) {
  if (!Array.isArray(fact) || !fact.length) return '';
  const [predicate, ...args] = fact;
  return args.length ? `${predicate}: ${args.join(', ')}` : String(predicate ?? '');
}

function surfaceFor(fact, factSurface) {
  const surface = text(typeof factSurface === 'function' ? factSurface(fact) : '');
  return surface || formatFact(fact);
}

function uniqueRows(rows, key = 'surface') {
  const seen = new Set();
  const out = [];
  for (const row of rows) {
    const value = text(row?.[key]);
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push({ ...row, [key]: value });
  }
  return out;
}

function answerFromBinding(binding) {
  if (!binding || typeof binding !== 'object') return null;
  const value = Object.values(binding).find((entry) => typeof entry === 'string' && entry.trim());
  return value ? value.trim() : null;
}

function hypothesisRows(hypotheses = []) {
  return (hypotheses || [])
    .map((entry) => ({
      turn: Number.isFinite(entry?.turn) ? entry.turn : null,
      text: text(entry?.text),
    }))
    .filter((entry) => entry.text);
}

export function buildLearnerProxyDagMemory({
  turn,
  questionPattern,
  rules = [],
  groundedFacts = [],
  voiced = [],
  hypotheses = [],
  factSurface = null,
} = {}) {
  const grounded = groundedFacts.filter((fact) => Array.isArray(fact) && fact.length);
  const groundedKeys = new Set(grounded.map(factKey));
  const cl = closure(grounded, rules);
  const voicedRows = (voiced || [])
    .filter((entry) => Array.isArray(entry?.fact))
    .map((entry) => ({
      turn: Number.isFinite(entry.turn) ? entry.turn : null,
      surface: surfaceFor(entry.fact, factSurface),
    }));
  const voicedKeys = new Set(
    (voiced || []).filter((entry) => Array.isArray(entry?.fact)).map((entry) => factKey(entry.fact)),
  );
  const candidateConclusions = [];
  const answerCandidates = [];

  for (const [key, fact] of cl.facts) {
    const binding = matchPattern(questionPattern, fact);
    if (binding) {
      answerCandidates.push({
        surface: surfaceFor(fact, factSurface),
        answer: answerFromBinding(binding),
      });
      continue;
    }
    if (!cl.proofs.get(key) || voicedKeys.has(key)) continue;
    candidateConclusions.push({
      surface: surfaceFor(fact, factSurface),
      source: groundedKeys.has(key) ? 'grounded' : 'derived_from_record',
    });
  }

  const memory = {
    schema: LEARNER_PROXY_DAG_MEMORY_SCHEMA,
    publicOnly: true,
    turn: Number.isFinite(turn) ? turn : null,
    grounded: uniqueRows(
      grounded.map((fact, index) => ({
        index,
        surface: surfaceFor(fact, factSurface),
      })),
    ),
    voicedDerived: uniqueRows(voicedRows),
    hypotheses: hypothesisRows(hypotheses),
    candidateConclusions: uniqueRows(candidateConclusions),
    answerCandidates: uniqueRows(answerCandidates),
  };
  memory.metrics = {
    groundedCount: memory.grounded.length,
    voicedDerivedCount: memory.voicedDerived.length,
    hypothesisCount: memory.hypotheses.length,
    candidateConclusionCount: memory.candidateConclusions.length,
    answerCandidateCount: memory.answerCandidates.length,
  };
  memory.audit = {
    authoredProofPathsIncluded: false,
    unreleasedPremiseIdsIncluded: false,
    authoredMissingPremiseIdsIncluded: false,
    secretLabelIncluded: false,
    factArraysIncluded: false,
    ruleIdsIncluded: false,
  };
  return memory;
}

function nextReleaseSummary(nextScheduledRelease) {
  if (!nextScheduledRelease) return null;
  return {
    premiseId: nextScheduledRelease.premise || null,
    turn: nextScheduledRelease.turn ?? null,
    via: nextScheduledRelease.via || null,
  };
}

function recommendedAction({ turn, assessment, stallType, nextScheduledRelease }) {
  if (!assessment || assessment.status !== 'available') {
    return { action: 'unavailable', reason: 'learner DAG assessment is unavailable' };
  }
  const missing = assessment.missingPremises || [];
  const releasedButNotHeld = missing.filter((row) => row.bucket === 'released_but_not_held');
  const unreleased = missing.filter((row) => row.bucket === 'unreleased' || row.bucket === 'unscheduled');
  const dueUnreleased = unreleased.filter(
    (row) => row.bucket === 'unscheduled' || row.releaseTurn === null || row.releaseTurn <= turn,
  );
  const nextReleaseClosesGap = Boolean(
    nextScheduledRelease &&
    nextScheduledRelease.turn <= turn &&
    unreleased.some((row) => row.premiseId === nextScheduledRelease.premise),
  );
  if (assessment.bottleneck === 'grounded_asserted_secret') {
    return { action: 'complete', reason: 'learner has grounded and asserted the secret' };
  }
  if (assessment.finalSecretEntailed && !assessment.assertedSecret) {
    return {
      action: 'prompt_assertion',
      reason: 'learner board entails the answer, but the learner has not asserted it',
    };
  }
  if (releasedButNotHeld.length) {
    return {
      action: 'repair_uptake',
      reason: `released proof material is not held: ${releasedButNotHeld.map((row) => row.premiseId).join(', ')}`,
    };
  }
  if (unreleased.length && (stallType || dueUnreleased.length || nextReleaseClosesGap)) {
    return {
      action: 'release_evidence',
      reason: stallType
        ? `learner appears stalled with unreleased best-path material: ${unreleased.map((row) => row.premiseId).join(', ')}`
        : `best-path material is due or unscheduled: ${unreleased.map((row) => row.premiseId).join(', ')}`,
    };
  }
  if (unreleased.length) {
    return {
      action: 'hold_until_evidence_due',
      reason: `best-path gap remains unreleased but is not due on the current turn: ${unreleased
        .map((row) => row.premiseId)
        .join(', ')}`,
    };
  }
  if (assessment.bottleneck === 'inference_gap') {
    return {
      action: 'prompt_intermediate_inference',
      reason: 'all best-path material is held, but the learner has not connected the inference',
    };
  }
  return { action: 'continue', reason: assessment.bottleneck || 'no proxy-DAG pacing intervention recommended' };
}

export function deriveProxyDagPacingSignal({
  turn,
  role = null,
  assessment = null,
  stallType = null,
  nextScheduledRelease = null,
} = {}) {
  const recommendation = recommendedAction({ turn, assessment, stallType, nextScheduledRelease });
  const missingPremises = assessment?.missingPremises || [];
  return {
    schema: PROXY_DAG_PACING_SCHEMA,
    turn: Number.isFinite(turn) ? turn : null,
    role,
    advisoryOnly: true,
    recommendedAction: recommendation.action,
    reason: recommendation.reason,
    bottleneck: assessment?.bottleneck || 'unavailable',
    stalled: Boolean(stallType),
    stallType: stallType || null,
    bestPathId: assessment?.bestPathId || null,
    bestPathCoverage: assessment?.bestPathCoverage ?? null,
    finalSecretEntailed: assessment?.finalSecretEntailed === true,
    assertedSecret: assessment?.assertedSecret === true,
    assertedMirror: assessment?.assertedMirror === true,
    missingPremises,
    missingPremiseBuckets: assessment?.missingPremiseBuckets || {},
    nextScheduledRelease: nextReleaseSummary(nextScheduledRelease),
  };
}
