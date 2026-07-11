import { deterministicChoice } from './deterministicExperimentSampler.js';

export const TUTOR_STUB_POLICY_DRAW_SCHEMA = 'machinespirits.tutor-stub.policy-draw.v1';
export const TUTOR_STUB_STOCHASTIC_POLICY_IDS = Object.freeze([
  'random',
  'negative',
  'field',
  'trajectory',
  'state',
  'dynamical_system',
  'empirical_dynamical_system',
]);
const STOCHASTIC_POLICIES = new Set(TUTOR_STUB_STOCHASTIC_POLICY_IDS);

export function tutorStubPolicyRequiresDeterministicDraw(policy) {
  return STOCHASTIC_POLICIES.has(
    String(policy || '')
      .trim()
      .toLowerCase(),
  );
}

function nonEmpty(value, label) {
  const normalized = String(value ?? '').trim();
  if (!normalized) throw new Error(`${label} is required for tutor-stub policy sampling`);
  return normalized;
}

function safeInteger(value, label, { minimum = 0 } = {}) {
  const normalized = Number(value);
  if (!Number.isSafeInteger(normalized) || normalized < minimum) {
    throw new Error(`${label} must be a safe integer >= ${minimum}`);
  }
  return normalized;
}

export function tutorStubPolicyDecisionMaterial({
  profile,
  policy,
  repeat,
  learnerTurn,
  decisionKind,
  jobId = null,
} = {}) {
  return {
    profile: nonEmpty(profile, 'profile'),
    policy: nonEmpty(policy, 'policy'),
    repeat: safeInteger(repeat, 'repeat', { minimum: 1 }),
    learnerTurn: safeInteger(learnerTurn, 'learnerTurn', { minimum: 1 }),
    decisionKind: nonEmpty(decisionKind, 'decisionKind'),
    jobId: jobId === null || jobId === undefined || jobId === '' ? null : nonEmpty(jobId, 'jobId'),
  };
}

export function sampleTutorStubPolicyDistribution(
  distribution,
  { runSeed, profile, policy, repeat, learnerTurn, decisionKind, jobId = null } = {},
) {
  const masterSeed = safeInteger(runSeed, 'runSeed');
  const material = tutorStubPolicyDecisionMaterial({
    profile,
    policy,
    repeat,
    learnerTurn,
    decisionKind,
    jobId,
  });
  const source = distribution.map((entry, index) => {
    if (!entry || typeof entry !== 'object' || !entry.register) {
      throw new Error(`distribution[${index}].register is required`);
    }
    return {
      entry,
      value: entry.register,
      weight: entry.weight,
    };
  });
  const decision = deterministicChoice(
    source.map(({ value, weight }) => ({ value, weight })),
    { masterSeed, material },
  );
  const selected = source[decision.selectedIndex];
  return {
    entry: selected.entry,
    audit: {
      schema: TUTOR_STUB_POLICY_DRAW_SCHEMA,
      method: decision.algorithm,
      runSeed: masterSeed,
      // Preserve the canonical sampler record verbatim so run-level evidence
      // can replay the exact choice rather than reverse-engineering this
      // tutor-stub compatibility envelope.
      decision,
      material: decision.material,
      seedMaterial: decision.seedMaterial,
      seed: decision.seed,
      draw: decision.draw,
      distribution: decision.distribution,
      selectedIndex: decision.selectedIndex,
      selectedValue: decision.selectedValue,
    },
  };
}
