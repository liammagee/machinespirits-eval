export const TUTOR_STUB_CAPABILITY_REGISTRY_SCHEMA = 'machinespirits.tutor-stub.capability-registry.v1';
export const TUTOR_STUB_CAPABILITY_REGISTRY_VERSION = 1;
export const TUTOR_STUB_CAPABILITY_SNAPSHOT_SCHEMA = 'machinespirits.tutor-stub.capability-snapshot.v1';
export const TUTOR_STUB_CAPABILITY_FLAG_IDS = Object.freeze([
  'session',
  'harness',
  'passthrough',
  'interactive',
  'world',
  'curriculum',
  'dag',
  'learnerDag',
  'classifier',
  'registerSelection',
  'mixedLearner',
  'autoLearner',
  'demo',
  'turnFeedback',
  'tuning',
  'voice',
  'trace',
  'fieldVisualization',
  'learningSummary',
  'responseChecks',
  'evaluation',
]);

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
}

function condition({ all = [], any = [], none = [] } = {}) {
  return { all, any, none };
}

function capability({ id, group, label, description, availableWhen = {}, activeWhen = {} }) {
  return {
    id,
    group,
    label,
    description,
    availableWhen: condition(availableWhen),
    activeWhen: condition(activeWhen),
  };
}

const GROUPS = [
  {
    id: 'participate',
    label: 'participate',
    description: 'human learner · private coach · automated learner · mixed AI drafting · guided demo',
  },
  {
    id: 'teach',
    label: 'teach',
    description: 'open topics · proof-DAG scenarios · reflective curricula · versioned tutor instances',
  },
  {
    id: 'adapt',
    label: 'adapt',
    description: 'learner reading · public reasoning map · typed actions · teaching style · clue and memory pacing',
  },
  {
    id: 'control',
    label: 'control',
    description: 'per-role models · live settings · learner profiles · tutor tuning · guarded response checks',
  },
  {
    id: 'access',
    label: 'access',
    description: 'command palette · editable terminal · themes and motion · voice companion · compound turns',
  },
  {
    id: 'inspect',
    label: 'inspect',
    description: 'plain/technical analysis · field view · transcript/replay · director notes · learning summary',
  },
  {
    id: 'evaluate',
    label: 'evaluate',
    description: 'auto-eval · policy/profile QA matrices · ABM panels · frozen replay · SQL ingest',
  },
];

const CAPABILITIES = [
  capability({
    id: 'public_dialogue',
    group: 'participate',
    label: 'public dialogue',
    description: 'One speaking tutor and one public learner history.',
    availableWhen: { all: ['session'] },
    activeWhen: { all: ['session'] },
  }),
  capability({
    id: 'speaker_only',
    group: 'participate',
    label: 'speaker-only baseline',
    description: 'Exactly one speaking-model call per learner turn.',
    availableWhen: { all: ['passthrough'] },
    activeWhen: { all: ['passthrough'] },
  }),
  capability({
    id: 'interactive_roles',
    group: 'participate',
    label: 'learner and coach roles',
    description: 'Live learner, private coach, and bounded auto handoff roles.',
    availableWhen: { all: ['interactive', 'harness'] },
    activeWhen: { all: ['interactive', 'harness'] },
  }),
  capability({
    id: 'automated_learner',
    group: 'participate',
    label: 'automated learner',
    description: 'Model-backed learner turns with a bounded profile contract.',
    availableWhen: { all: ['harness'], any: ['interactive', 'autoLearner'] },
    activeWhen: { all: ['autoLearner'] },
  }),
  capability({
    id: 'mixed_drafting',
    group: 'participate',
    label: 'mixed learner drafting',
    description: 'Profile-aware clue, draft, analysis, and tutor prefetch artifacts.',
    availableWhen: { all: ['interactive', 'harness'] },
    activeWhen: { all: ['mixedLearner'] },
  }),
  capability({
    id: 'guided_demo',
    group: 'participate',
    label: 'guided demo',
    description: 'A bounded live tour that returns to the current session.',
    availableWhen: { all: ['interactive', 'harness'] },
    activeWhen: { all: ['demo'] },
  }),
  capability({
    id: 'scenario',
    group: 'teach',
    label: 'scenario world',
    description: 'A selected dramatic-derivation world.',
    availableWhen: { all: ['session'] },
    activeWhen: { all: ['world'] },
  }),
  capability({
    id: 'curriculum',
    group: 'teach',
    label: 'reflective curriculum',
    description: 'A public non-DAG curriculum module or workplan card.',
    availableWhen: { all: ['interactive', 'harness'] },
    activeWhen: { all: ['curriculum'] },
  }),
  capability({
    id: 'proof_dag',
    group: 'teach',
    label: 'proof DAG',
    description: 'Authored private proof structure with staged public evidence.',
    availableWhen: { all: ['world', 'harness'] },
    activeWhen: { all: ['dag'] },
  }),
  capability({
    id: 'learner_reading',
    group: 'adapt',
    label: 'learner reading',
    description: 'Public-discourse classification for the latest learner move.',
    availableWhen: { all: ['harness'] },
    activeWhen: { all: ['classifier'] },
  }),
  capability({
    id: 'learner_reasoning',
    group: 'adapt',
    label: 'public reasoning map',
    description: 'Deterministically validated public learner-DAG updates.',
    availableWhen: { all: ['world', 'harness'] },
    activeWhen: { all: ['learnerDag'] },
  }),
  capability({
    id: 'adaptive_delivery',
    group: 'adapt',
    label: 'adaptive delivery',
    description: 'Learner-responsive teaching stance and independent response axes.',
    availableWhen: { all: ['harness'] },
    activeWhen: { all: ['registerSelection'] },
  }),
  capability({
    id: 'response_checks',
    group: 'control',
    label: 'guarded response checks',
    description: 'Evidence, scaffold, question, and closure checks before public output.',
    availableWhen: { all: ['harness'] },
    activeWhen: { all: ['responseChecks'] },
  }),
  capability({
    id: 'turn_feedback',
    group: 'control',
    label: 'turn feedback',
    description: 'Optional human helpfulness ratings and one-turn adaptation contracts.',
    availableWhen: { all: ['interactive', 'harness'], none: ['autoLearner'] },
    activeWhen: { all: ['turnFeedback'] },
  }),
  capability({
    id: 'tutor_tuning',
    group: 'control',
    label: 'tutor tuning',
    description: 'Bounded evidence capture, candidate review, canary, and promotion.',
    availableWhen: { all: ['harness'] },
    activeWhen: { all: ['tuning'] },
  }),
  capability({
    id: 'presentation',
    group: 'access',
    label: 'terminal presentation',
    description: 'Themes, motion preferences, command palette, and editable input.',
    availableWhen: { all: ['session'] },
    activeWhen: { all: ['session'] },
  }),
  capability({
    id: 'voice',
    group: 'access',
    label: 'voice companion',
    description: 'Optional browser microphone and accepted-text voice rendering.',
    availableWhen: { all: ['session'] },
    activeWhen: { all: ['voice'] },
  }),
  capability({
    id: 'trace',
    group: 'inspect',
    label: 'technical trace',
    description: 'Versioned JSONL run and turn provenance.',
    availableWhen: { all: ['session'] },
    activeWhen: { all: ['trace'] },
  }),
  capability({
    id: 'transcript',
    group: 'inspect',
    label: 'transcript and replay',
    description: 'Self-contained transcript views and public replay payload.',
    availableWhen: { all: ['session'] },
    activeWhen: { all: ['session'] },
  }),
  capability({
    id: 'field_inspection',
    group: 'inspect',
    label: 'field inspection',
    description: 'Learner-state, field, and response-configuration inspection.',
    availableWhen: { all: ['harness'] },
    activeWhen: { any: ['classifier', 'learnerDag', 'registerSelection'] },
  }),
  capability({
    id: 'field_visualization',
    group: 'inspect',
    label: 'field visualization',
    description: 'SVG and JSON interaction-field artifacts.',
    availableWhen: { all: ['harness'] },
    activeWhen: { all: ['fieldVisualization'] },
  }),
  capability({
    id: 'learning_summary',
    group: 'inspect',
    label: 'learning summary',
    description: 'Public-evidence-only HTML closeout report.',
    availableWhen: { all: ['harness'] },
    activeWhen: { all: ['learningSummary'] },
  }),
  capability({
    id: 'evaluation_harnesses',
    group: 'evaluate',
    label: 'evaluation harnesses',
    description: 'Auto-eval, policy/profile matrices, panels, replay, and SQL ingest.',
    availableWhen: { all: ['session'] },
    activeWhen: { all: ['evaluation'] },
  }),
];

const COMPATIBILITY_RULES = [
  {
    id: 'passthrough_isolation',
    when: condition({ all: ['passthrough'] }),
    conflictsAny: [
      'curriculum',
      'dag',
      'learnerDag',
      'classifier',
      'registerSelection',
      'mixedLearner',
      'autoLearner',
      'turnFeedback',
      'tuning',
      'fieldVisualization',
      'learningSummary',
      'responseChecks',
    ],
    message: 'Passthrough is speaker-only; disable curriculum, analysis, adaptation, feedback, and report mechanisms.',
  },
  {
    id: 'curriculum_excludes_world',
    when: condition({ all: ['curriculum'] }),
    conflictsAny: ['world', 'dag', 'learnerDag'],
    message: 'Curriculum sessions are public non-DAG inquiries; remove the active world and proof-DAG options.',
  },
  {
    id: 'dag_requires_world',
    when: condition({ all: ['dag'] }),
    requiresAll: ['world'],
    message: 'Proof-DAG mode requires an authored scenario world.',
  },
  {
    id: 'learner_dag_requires_world',
    when: condition({ all: ['learnerDag'] }),
    requiresAll: ['world'],
    message: 'The learner reasoning map requires an active scenario world.',
  },
  {
    id: 'learner_mode_is_exclusive',
    when: condition({ all: ['mixedLearner'] }),
    conflictsAny: ['autoLearner'],
    message: 'Mixed learner drafting and the unattended automated learner cannot both be active.',
  },
  {
    id: 'automated_feedback_is_disabled',
    when: condition({ all: ['autoLearner'] }),
    conflictsAny: ['turnFeedback'],
    message: 'Turn feedback is a human-session signal and must be disabled for the automated learner.',
  },
];

export const TUTOR_STUB_CAPABILITY_REGISTRY = deepFreeze({
  schema: TUTOR_STUB_CAPABILITY_REGISTRY_SCHEMA,
  version: TUTOR_STUB_CAPABILITY_REGISTRY_VERSION,
  groups: GROUPS,
  capabilities: CAPABILITIES,
  compatibilityRules: COMPATIBILITY_RULES,
});

export const TUTOR_STUB_CAPABILITY_IDS = Object.freeze(CAPABILITIES.map((entry) => entry.id));

function normalizedFlags(config = {}) {
  const passthrough = Boolean(config.passthrough);
  return {
    session: config.session !== false,
    harness: !passthrough,
    passthrough,
    interactive: Boolean(config.interactive),
    world: Boolean(config.world),
    curriculum: Boolean(config.curriculum),
    dag: Boolean(config.dag),
    learnerDag: Boolean(config.learnerDag),
    classifier: Boolean(config.classifier),
    registerSelection: Boolean(config.registerSelection),
    mixedLearner: Boolean(config.mixedLearner),
    autoLearner: Boolean(config.autoLearner),
    demo: Boolean(config.demo),
    turnFeedback: Boolean(config.turnFeedback),
    tuning: Boolean(config.tuning),
    voice: Boolean(config.voice),
    trace: Boolean(config.trace),
    fieldVisualization: Boolean(config.fieldVisualization),
    learningSummary: Boolean(config.learningSummary),
    responseChecks: Boolean(config.responseChecks),
    evaluation: Boolean(config.evaluation),
  };
}

function conditionMatches(rule, flags) {
  if (!rule) return true;
  if ((rule.all || []).some((key) => !flags[key])) return false;
  if ((rule.any || []).length && !(rule.any || []).some((key) => flags[key])) return false;
  if ((rule.none || []).some((key) => flags[key])) return false;
  return true;
}

function compatibilityIssue(rule, flags) {
  if (!conditionMatches(rule.when, flags)) return null;
  const missing = (rule.requiresAll || []).filter((key) => !flags[key]);
  const conflicts = (rule.conflictsAny || []).filter((key) => flags[key]);
  if (!missing.length && !conflicts.length) return null;
  return {
    id: rule.id,
    message: rule.message,
    missing,
    conflicts,
  };
}

function resolvedMode(flags) {
  if (flags.passthrough) return 'passthrough';
  if (flags.curriculum) return 'curriculum';
  if (flags.autoLearner) return 'auto';
  if (flags.mixedLearner) return 'mixed';
  if (flags.learnerDag || flags.dag) return 'scaffold';
  return 'direct';
}

export function resolveTutorStubCapabilities(config = {}) {
  const flags = normalizedFlags(config);
  const entries = CAPABILITIES.map((definition) => ({
    id: definition.id,
    group: definition.group,
    label: definition.label,
    available: conditionMatches(definition.availableWhen, flags),
    active: conditionMatches(definition.activeWhen, flags),
  }));
  const issues = COMPATIBILITY_RULES.map((rule) => compatibilityIssue(rule, flags)).filter(Boolean);
  const byId = Object.fromEntries(entries.map((entry) => [entry.id, entry]));
  const snapshot = {
    schema: TUTOR_STUB_CAPABILITY_SNAPSHOT_SCHEMA,
    registrySchema: TUTOR_STUB_CAPABILITY_REGISTRY_SCHEMA,
    registryVersion: TUTOR_STUB_CAPABILITY_REGISTRY_VERSION,
    mode: resolvedMode(flags),
    flags,
    capabilities: byId,
    available: entries.filter((entry) => entry.available).map((entry) => entry.id),
    active: entries.filter((entry) => entry.active).map((entry) => entry.id),
    compatibility: {
      valid: issues.length === 0,
      issues,
    },
  };
  return deepFreeze(snapshot);
}

export function tutorStubCapabilityAvailable(snapshot, id) {
  return snapshot?.capabilities?.[id]?.available === true;
}

export function tutorStubCapabilityActive(snapshot, id) {
  return snapshot?.capabilities?.[id]?.active === true;
}

export function assertTutorStubCapabilityCompatibility(snapshot) {
  if (snapshot?.schema !== TUTOR_STUB_CAPABILITY_SNAPSHOT_SCHEMA) {
    throw new Error(`capability snapshot must use ${TUTOR_STUB_CAPABILITY_SNAPSHOT_SCHEMA}`);
  }
  if (snapshot.compatibility?.valid) return true;
  const details = (snapshot.compatibility?.issues || []).map((issue) => `${issue.id}: ${issue.message}`).join(' ');
  throw new Error(`Incompatible tutor-stub capabilities. ${details}`);
}

export function tutorStubCapabilityFeatureRows(snapshot = null) {
  return Object.freeze(
    GROUPS.map((group) => {
      const members = CAPABILITIES.filter((entry) => entry.group === group.id);
      return Object.freeze({
        id: group.id,
        label: group.label,
        description: group.description,
        active: Object.freeze(
          snapshot
            ? members.filter((entry) => tutorStubCapabilityActive(snapshot, entry.id)).map((entry) => entry.label)
            : [],
        ),
        available: Object.freeze(
          snapshot
            ? members.filter((entry) => tutorStubCapabilityAvailable(snapshot, entry.id)).map((entry) => entry.label)
            : members.map((entry) => entry.label),
        ),
      });
    }),
  );
}

export function assertTutorStubCapabilityRegistryInvariants(registry = TUTOR_STUB_CAPABILITY_REGISTRY) {
  if (registry?.schema !== TUTOR_STUB_CAPABILITY_REGISTRY_SCHEMA) {
    throw new Error(`capability registry must use ${TUTOR_STUB_CAPABILITY_REGISTRY_SCHEMA}`);
  }
  if (registry?.version !== TUTOR_STUB_CAPABILITY_REGISTRY_VERSION) {
    throw new Error(`capability registry version must be ${TUTOR_STUB_CAPABILITY_REGISTRY_VERSION}`);
  }
  const groupIds = new Set();
  for (const group of registry.groups || []) {
    if (!/^[a-z][a-z0-9_]*$/u.test(group.id || '')) throw new Error(`invalid capability group id: ${group.id}`);
    if (groupIds.has(group.id)) throw new Error(`duplicate capability group id: ${group.id}`);
    groupIds.add(group.id);
  }
  const capabilityIds = new Set();
  const assertCondition = (entry, label) => {
    for (const key of [...(entry?.all || []), ...(entry?.any || []), ...(entry?.none || [])]) {
      if (!TUTOR_STUB_CAPABILITY_FLAG_IDS.includes(key)) throw new Error(`unknown capability flag in ${label}: ${key}`);
    }
  };
  for (const entry of registry.capabilities || []) {
    if (!/^[a-z][a-z0-9_]*$/u.test(entry.id || '')) throw new Error(`invalid capability id: ${entry.id}`);
    if (capabilityIds.has(entry.id)) throw new Error(`duplicate capability id: ${entry.id}`);
    if (!groupIds.has(entry.group)) throw new Error(`unknown capability group for ${entry.id}: ${entry.group}`);
    assertCondition(entry.availableWhen, `${entry.id}.availableWhen`);
    assertCondition(entry.activeWhen, `${entry.id}.activeWhen`);
    capabilityIds.add(entry.id);
  }
  const ruleIds = new Set();
  for (const rule of registry.compatibilityRules || []) {
    if (!/^[a-z][a-z0-9_]*$/u.test(rule.id || '')) throw new Error(`invalid compatibility rule id: ${rule.id}`);
    if (ruleIds.has(rule.id)) throw new Error(`duplicate compatibility rule id: ${rule.id}`);
    assertCondition(rule.when, `${rule.id}.when`);
    for (const key of [...(rule.requiresAll || []), ...(rule.conflictsAny || [])]) {
      if (!TUTOR_STUB_CAPABILITY_FLAG_IDS.includes(key)) {
        throw new Error(`unknown capability flag in ${rule.id}: ${key}`);
      }
    }
    ruleIds.add(rule.id);
  }
  return true;
}

assertTutorStubCapabilityRegistryInvariants();
