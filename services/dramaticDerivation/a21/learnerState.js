export const A21_LEARNER_STATE_SCHEMA = 'dramatic-derivation.a21.learner-state.v0';

const ENGAGEMENT_STATES = Object.freeze(['engaged', 'strained', 'aporia', 'disengaged']);
const FRUSTRATION_STATES = Object.freeze(['low', 'medium', 'high']);
const CONFIDENCE_STATES = Object.freeze(['low', 'medium', 'high']);
const MISCONCEPTIONS = Object.freeze(['mirror_dead_predicate', 'missing_dependency', 'none']);

const FORBIDDEN_PUBLIC_STATE_KEYS = Object.freeze([
  'secret',
  'proofPath',
  'proof_path',
  'rawBoard',
  'raw_board',
  'corruptionLedger',
  'corruption_ledger',
  'hiddenBoard',
  'hidden_board',
]);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function requireObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`a21.learnerState: ${label} must be an object`);
  }
  return value;
}

function finiteNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function assertKnown(value, allowed, label) {
  if (!allowed.includes(value)) {
    throw new Error(`a21.learnerState: unsupported ${label} ${JSON.stringify(value)}`);
  }
}

function mergePlain(base, override) {
  if (!override || typeof override !== 'object' || Array.isArray(override)) return clone(base);
  const merged = clone(base);
  for (const [key, value] of Object.entries(override)) {
    if (value && typeof value === 'object' && !Array.isArray(value) && merged[key] && typeof merged[key] === 'object') {
      merged[key] = mergePlain(merged[key], value);
    } else {
      merged[key] = clone(value);
    }
  }
  return merged;
}

function scanForbiddenKeys(value, path = []) {
  if (!value || typeof value !== 'object') return [];
  const found = [];
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_PUBLIC_STATE_KEYS.includes(key)) found.push([...path, key].join('.'));
    found.push(...scanForbiddenKeys(child, [...path, key]));
  }
  return found;
}

export function createDurableLearnerState(overrides = {}) {
  const base = {
    schema: A21_LEARNER_STATE_SCHEMA,
    stateId: 'durable-learner-state',
    misconception: 'mirror_dead_predicate',
    frustration: 'medium',
    engagement: 'engaged',
    confidence: 'low',
    evidenceSeen: {
      p_surface: true,
      p_point: false,
    },
    dependencyOwned: {
      p_surface: true,
      p_point: false,
    },
    dependencyEchoedOnly: {
      p_point: true,
    },
    alternativeRouteCandidate: false,
    diagnosticHistory: {
      count: 0,
      lastDiagnosticTurn: null,
      answeredSubstantively: 0,
      repeatedWithoutNewEvidence: 0,
    },
    proofProgress: {
      D: 4,
      lastDDelta: 0,
      turnsSinceDDecrease: 0,
      releasesOnSchedule: [],
      delayedReleases: [],
      earlyReleases: [],
    },
    transitionFlags: {
      targetDependencyRepaired: false,
      learnerCanUsePPoint: false,
      learnerCanUsePSurface: true,
      learnerReadyForFinalAssertion: false,
    },
  };
  return validateDurableLearnerState(mergePlain(base, overrides));
}

export function initialHethelLearnerState(fixture = {}) {
  const publicState = fixture?.publicLearnerState || fixture?.learnerState || {};
  return createDurableLearnerState({
    stateId: fixture?.fixtureId ? `${fixture.fixtureId}:learner` : 'hethel-trigger:learner',
    proofProgress: {
      D: finiteNumber(fixture?.publicProofSummary?.D ?? publicState?.proofProgress?.D, 4),
    },
    ...publicState,
  });
}

export function cloneDurableLearnerState(state) {
  return validateDurableLearnerState(clone(state));
}

export function validateDurableLearnerState(state) {
  requireObject(state, 'state');
  if (state.schema !== A21_LEARNER_STATE_SCHEMA) {
    throw new Error(`a21.learnerState: unsupported schema ${JSON.stringify(state.schema)}`);
  }
  assertKnown(state.misconception, MISCONCEPTIONS, 'misconception');
  assertKnown(state.frustration, FRUSTRATION_STATES, 'frustration');
  assertKnown(state.engagement, ENGAGEMENT_STATES, 'engagement');
  assertKnown(state.confidence, CONFIDENCE_STATES, 'confidence');
  for (const key of [
    'evidenceSeen',
    'dependencyOwned',
    'dependencyEchoedOnly',
    'diagnosticHistory',
    'proofProgress',
    'transitionFlags',
  ]) {
    requireObject(state[key], key);
  }
  const leaks = scanForbiddenKeys(state);
  if (leaks.length) throw new Error(`a21.learnerState: forbidden hidden fields: ${leaks.join(', ')}`);
  state.proofProgress.D = Math.max(0, finiteNumber(state.proofProgress.D, 0));
  state.proofProgress.lastDDelta = finiteNumber(state.proofProgress.lastDDelta, 0);
  state.proofProgress.turnsSinceDDecrease = Math.max(0, finiteNumber(state.proofProgress.turnsSinceDDecrease, 0));
  return state;
}

export function worsenEngagement(engagement) {
  const current = ENGAGEMENT_STATES.indexOf(engagement);
  if (current < 0) return 'strained';
  return ENGAGEMENT_STATES[Math.min(ENGAGEMENT_STATES.length - 1, current + 1)];
}

export function improveConfidence(confidence) {
  const current = CONFIDENCE_STATES.indexOf(confidence);
  if (current < 0) return 'medium';
  return CONFIDENCE_STATES[Math.min(CONFIDENCE_STATES.length - 1, current + 1)];
}

export function statePublicSummary(state) {
  const validated = validateDurableLearnerState(clone(state));
  return {
    schema: A21_LEARNER_STATE_SCHEMA,
    stateId: validated.stateId,
    misconception: validated.misconception,
    frustration: validated.frustration,
    engagement: validated.engagement,
    confidence: validated.confidence,
    evidenceSeen: clone(validated.evidenceSeen),
    dependencyOwned: clone(validated.dependencyOwned),
    dependencyEchoedOnly: clone(validated.dependencyEchoedOnly),
    alternativeRouteCandidate: validated.alternativeRouteCandidate,
    diagnosticHistory: clone(validated.diagnosticHistory),
    proofProgress: clone(validated.proofProgress),
    transitionFlags: clone(validated.transitionFlags),
  };
}
