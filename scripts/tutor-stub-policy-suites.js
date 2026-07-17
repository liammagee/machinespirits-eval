const DISCRETE_ADAPTIVE_POLICIES = Object.freeze([
  'dynamic',
  'state',
  'field',
  'trajectory',
  'dynamical_system',
  'empirical_dynamical_system',
]);

const CONTINUOUS_ADAPTIVE_POLICIES = Object.freeze([
  'continuous_dynamical_system',
  'continuous_empirical_dynamical_system',
]);

export const TUTOR_STUB_POLICY_SUITES = Object.freeze({
  controls: Object.freeze({
    id: 'controls',
    label: 'Controls and floors',
    purpose: 'Non-adaptive baseline, random control, and negative floor for calibration checks.',
    cost: 'cheap',
    policies: Object.freeze(['negative', 'bland', 'random']),
    aliases: Object.freeze([]),
  }),
  core: Object.freeze({
    id: 'core',
    label: 'Core policy comparison',
    purpose: 'Routine policy QA: baseline plus the main discrete adaptive register policies.',
    cost: 'standard',
    policies: Object.freeze(['bland', ...DISCRETE_ADAPTIVE_POLICIES]),
    aliases: Object.freeze(['focused']),
  }),
  pressure: Object.freeze({
    id: 'pressure',
    label: 'Pressure screen',
    purpose: 'Cheap pressure arm for learner-profile sentinel checks, especially affective resistance.',
    cost: 'screen',
    policies: Object.freeze(['field', 'negative']),
    aliases: Object.freeze([]),
  }),
  sentinel: Object.freeze({
    id: 'sentinel',
    label: 'Representative policy ladder',
    purpose: 'Compact baseline, field, temporal, system, and pressure comparison for learner-profile discrimination.',
    cost: 'standard',
    policies: Object.freeze(['bland', 'field', 'trajectory', 'dynamical_system', 'negative']),
    aliases: Object.freeze([]),
  }),
  headroom: Object.freeze({
    id: 'headroom',
    label: 'Outcome-headroom contrast',
    purpose:
      'Controls plus representative adaptive arms for outcome contrasts on discriminable stress profiles under a binding turn cap. At the release-schedule floor every policy grounds 100%, so adaptive-vs-bland differences are only observable here.',
    cost: 'targeted',
    policies: Object.freeze(['bland', 'negative', 'dynamic', 'field', 'dynamical_system']),
    aliases: Object.freeze([]),
  }),
  adaptive: Object.freeze({
    id: 'adaptive',
    label: 'Adaptive-only sweep',
    purpose: 'Adaptive register-policy family without controls; use when controls are already established elsewhere.',
    cost: 'targeted',
    policies: Object.freeze([...DISCRETE_ADAPTIVE_POLICIES, ...CONTINUOUS_ADAPTIVE_POLICIES]),
    aliases: Object.freeze([]),
  }),
  frontier: Object.freeze({
    id: 'frontier',
    label: 'Frontier policy comparison',
    purpose:
      'Baseline plus field/trajectory/dynamical and continuous policies for comparing increasingly rich state maps.',
    cost: 'targeted',
    policies: Object.freeze([
      'bland',
      'field',
      'trajectory',
      'dynamical_system',
      'empirical_dynamical_system',
      ...CONTINUOUS_ADAPTIVE_POLICIES,
    ]),
    aliases: Object.freeze([]),
  }),
  audit: Object.freeze({
    id: 'audit',
    label: 'Full policy audit',
    purpose: 'Expensive all-policy sweep; not a routine policy-comparison default.',
    cost: 'expensive',
    policies: Object.freeze([
      'negative',
      'bland',
      'random',
      ...DISCRETE_ADAPTIVE_POLICIES,
      ...CONTINUOUS_ADAPTIVE_POLICIES,
    ]),
    aliases: Object.freeze(['full', 'all']),
  }),
});

const POLICY_SUITE_ALIASES = Object.freeze({
  focused: 'core',
  full: 'audit',
  all: 'audit',
});

export function normalizePolicyName(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/-/gu, '_');
}

export function normalizePolicySuiteId(value) {
  const id = normalizePolicyName(value || 'core');
  return POLICY_SUITE_ALIASES[id] || id;
}

export function tutorStubPolicySuite(id) {
  const suite = TUTOR_STUB_POLICY_SUITES[normalizePolicySuiteId(id)];
  if (!suite) return null;
  return {
    ...suite,
    policies: [...suite.policies],
    aliases: [...(suite.aliases || [])],
  };
}

export function tutorStubPolicySuitePolicies(id) {
  const suite = tutorStubPolicySuite(id);
  return suite ? suite.policies : null;
}

export function tutorStubPolicySuiteNames({ includeAliases = false } = {}) {
  const names = Object.keys(TUTOR_STUB_POLICY_SUITES);
  if (!includeAliases) return names;
  return [...names, ...Object.keys(POLICY_SUITE_ALIASES)];
}

export function tutorStubPolicySuiteListText() {
  return Object.values(TUTOR_STUB_POLICY_SUITES)
    .map((suite) => {
      const aliasText = suite.aliases.length ? ` (alias: ${suite.aliases.join(', ')})` : '';
      return `${suite.id}${aliasText}: ${suite.label}; ${suite.purpose} Policies: ${suite.policies.join(', ')}`;
    })
    .join('\n');
}
