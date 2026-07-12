export const TUTOR_STUB_REGISTER_POLICY_COMPOSITION_SCHEMA =
  'machinespirits.tutor-stub.register-policy-composition.v1';

export const TUTOR_STUB_REGISTER_PRIMARY_POLICIES = Object.freeze([
  'dynamic',
  'state',
  'field',
  'trajectory',
  'dynamical_system',
  'empirical_dynamical_system',
  'continuous_dynamical_system',
  'continuous_empirical_dynamical_system',
  'bland',
  'random',
  'negative',
]);

export const TUTOR_STUB_REGISTER_OVERLAY_POLICIES = Object.freeze(['state', 'field']);
export const DEFAULT_TUTOR_STUB_REGISTER_OVERLAY_THRESHOLD = 0.7;

const CONTROL_POLICIES = new Set(['bland', 'random', 'negative']);

function normalizePolicyName(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/-/gu, '_');
}

export function tutorStubRegisterPolicyStackId(policy, overlays = []) {
  return [normalizePolicyName(policy), ...(overlays || []).map(normalizePolicyName)].filter(Boolean).join('+');
}

export function parseTutorStubRegisterPolicyStack(value) {
  const parts = String(value || 'dynamic')
    .split('+')
    .map(normalizePolicyName)
    .filter(Boolean);
  const primary = parts.shift() || 'dynamic';
  if (!TUTOR_STUB_REGISTER_PRIMARY_POLICIES.includes(primary)) {
    throw new Error(
      `Unknown --register-policy primary: ${primary}. Expected ${TUTOR_STUB_REGISTER_PRIMARY_POLICIES.join(', ')}.`,
    );
  }
  const overlays = [...new Set(parts)];
  const unsupported = overlays.filter((policy) => !TUTOR_STUB_REGISTER_OVERLAY_POLICIES.includes(policy));
  if (unsupported.length) {
    throw new Error(
      `Unknown register-policy overlay: ${unsupported.join(', ')}. Expected ${TUTOR_STUB_REGISTER_OVERLAY_POLICIES.join(', ')}.`,
    );
  }
  if (overlays.includes(primary)) {
    throw new Error(`Register-policy overlay ${primary} duplicates the primary policy.`);
  }
  if (CONTROL_POLICIES.has(primary) && overlays.length) {
    throw new Error(`Register-policy control ${primary} cannot have overlays; controls must remain uncontaminated.`);
  }
  return {
    primary,
    overlays,
    id: tutorStubRegisterPolicyStackId(primary, overlays),
  };
}

export function normalizeTutorStubRegisterOverlayThreshold(value, { label = 'register overlay threshold' } = {}) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0 || numeric > 1) {
    throw new Error(`${label} must be between 0 and 1`);
  }
  return numeric;
}

function classifierScore(value) {
  const numeric = Number(value && typeof value === 'object' ? value.score : value);
  if (!Number.isFinite(numeric)) return null;
  return Math.max(0, Math.min(1, numeric > 1 ? numeric / 5 : numeric));
}

function changed(previous, current) {
  if (previous === undefined || previous === null || current === undefined || current === null) return false;
  return String(previous) !== String(current);
}

function stateChangeSignal({ state, classification }) {
  const previous = state?.turns?.at?.(-1)?.classification?.turn || null;
  const current = classification?.turn || null;
  if (!previous || !current) {
    return { strength: 0, reasons: ['no previous classified turn for a state-change comparison'] };
  }
  const weights = {
    request_type: 0.22,
    discourse_move: 0.1,
    evidence_use: 0.18,
    epistemic_stance: 0.2,
    affect: 0.16,
    agency: 0.18,
    reasoning_span: 0.16,
    learning_pace: 0.2,
  };
  const changedFields = Object.entries(weights)
    .filter(([field]) => changed(previous[field], current[field]))
    .map(([field, weight]) => ({ field, from: previous[field], to: current[field], weight }));
  const categorical = changedFields.reduce((sum, row) => sum + row.weight, 0);
  const previousConceptual = classifierScore(previous.scores?.conceptual_engagement);
  const currentConceptual = classifierScore(current.scores?.conceptual_engagement);
  const previousReadiness = classifierScore(previous.scores?.epistemic_readiness);
  const currentReadiness = classifierScore(current.scores?.epistemic_readiness);
  const scoreShift = Math.max(
    previousConceptual === null || currentConceptual === null ? 0 : Math.abs(currentConceptual - previousConceptual),
    previousReadiness === null || currentReadiness === null ? 0 : Math.abs(currentReadiness - previousReadiness),
  );
  let strength = Math.min(1, categorical + scoreShift * 0.4);
  const currentSignal = [
    current.request_type,
    current.discourse_move,
    current.evidence_use,
    current.epistemic_stance,
    current.affect,
    current.agency,
  ]
    .filter(Boolean)
    .join(' ');
  const previousSignal = [previous.request_type, previous.affect, previous.agency].filter(Boolean).join(' ');
  if (
    /plain_language_request|plain_simplification_followup|vulnerability_or_moral_exposure|affective_signal|shame|anxious/iu.test(
      currentSignal,
    ) &&
    !/plain_language_request|plain_simplification_followup|vulnerability_or_moral_exposure|affective_signal|shame|anxious/iu.test(
      previousSignal,
    )
  ) {
    strength = Math.max(strength, 0.9);
  }
  if (current.learning_pace === 'accelerating' && previous.learning_pace !== 'accelerating') {
    strength = Math.max(strength, 0.9);
  }
  return {
    strength: Number(strength.toFixed(3)),
    reasons: [
      changedFields.length
        ? `changed ${changedFields.map((row) => `${row.field}:${row.from}->${row.to}`).join(', ')}`
        : 'no categorical state labels changed',
      scoreShift > 0 ? `largest classifier-score shift ${scoreShift.toFixed(3)}` : null,
    ].filter(Boolean),
    details: { changedFields, scoreShift: Number(scoreShift.toFixed(3)) },
  };
}

function fieldChangeSignal(candidate) {
  const features = candidate?.field_policy?.features || {};
  const relation = features.field?.relation || 'unknown';
  const delta = Number(features.field?.delta);
  const absoluteDelta = Number.isFinite(delta) ? Math.abs(delta) : 0;
  const relationFloor = {
    field_without_dag: 0.8,
    dag_without_field: 0.75,
    both_progress: 0.7,
    neither_progress: 0.55,
    initial: 0,
  }[relation] ?? 0;
  let strength = Math.max(relationFloor, Math.min(1, absoluteDelta / 0.25));
  if (Number.isFinite(delta) && delta <= -0.1) strength = Math.max(strength, 0.85);
  if (features.advance?.accelerated) strength = Math.max(strength, 0.9);
  return {
    strength: Number(strength.toFixed(3)),
    reasons: [
      `field/DAG relation ${relation}`,
      Number.isFinite(delta) ? `field delta ${delta.toFixed(3)}` : 'no prior field delta',
      features.advance?.accelerated
        ? `${features.advance.supportedMoveCount} warranted learner-owned proof moves`
        : null,
    ].filter(Boolean),
    details: {
      relation,
      fieldDelta: Number.isFinite(delta) ? Number(delta.toFixed(3)) : null,
      dagProgressScore: Number(features.dag?.progressScore ?? 0),
      learnerAdvance: features.advance || null,
    },
  };
}

export function evaluateTutorStubRegisterPolicyOverlay({
  overlay,
  state,
  classification,
  candidate,
  primaryRegister,
  threshold = DEFAULT_TUTOR_STUB_REGISTER_OVERLAY_THRESHOLD,
}) {
  const normalizedOverlay = normalizePolicyName(overlay);
  const normalizedThreshold = normalizeTutorStubRegisterOverlayThreshold(threshold);
  const signal =
    normalizedOverlay === 'state'
      ? stateChangeSignal({ state, classification })
      : normalizedOverlay === 'field'
        ? fieldChangeSignal(candidate)
        : { strength: 0, reasons: [`unsupported overlay ${normalizedOverlay}`] };
  const selectedRegister = candidate?.selected_register || candidate?.engagement_stance || null;
  const differsFromPrimary = Boolean(selectedRegister && selectedRegister !== primaryRegister);
  return {
    policy: normalizedOverlay,
    selected_register: selectedRegister,
    signal_strength: signal.strength,
    threshold: normalizedThreshold,
    threshold_met: signal.strength >= normalizedThreshold,
    differs_from_primary: differsFromPrimary,
    eligible: signal.strength >= normalizedThreshold && differsFromPrimary,
    reasons: signal.reasons,
    details: signal.details || null,
  };
}
