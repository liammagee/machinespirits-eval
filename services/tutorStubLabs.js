import { resolveTutorStubCapabilities } from './tutorStubCapabilities.js';

export const TUTOR_STUB_LAB_CATALOG_SCHEMA = 'machinespirits.tutor-stub.lab-catalog.v1';
export const TUTOR_STUB_LAB_SCHEMA = 'machinespirits.tutor-stub.lab.v1';
export const TUTOR_STUB_LAB_RESOLUTION_SCHEMA = 'machinespirits.tutor-stub.lab-resolution.v1';
export const TUTOR_STUB_LAB_CATALOG_VERSION = 1;
export const TUTOR_STUB_LAB_AUDIENCES = Object.freeze(['learner_safe', 'research', 'internal']);
export const TUTOR_STUB_LAB_MATURITY = Object.freeze(['stable', 'beta', 'experimental']);

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
}

function surface({ terminal = 'supported', browser = 'supported', voice = 'not_applicable', relaunch = 'exact' } = {}) {
  return { terminal, browser, voice, relaunch };
}

function lab({
  id,
  title,
  summary,
  audience,
  maturity,
  prerequisites = [],
  conflicts = [],
  modelCalls,
  artifacts = [],
  costClass,
  transportSafety,
  cliDefaults = {},
  activationCommands = [],
  requiredOptions = [],
}) {
  return {
    schema: TUTOR_STUB_LAB_SCHEMA,
    version: TUTOR_STUB_LAB_CATALOG_VERSION,
    id,
    title,
    summary,
    audience,
    maturity,
    prerequisites,
    conflicts,
    modelCalls,
    artifacts,
    costClass,
    transportSafety,
    cliDefaults,
    activationCommands,
    requiredOptions,
  };
}

const LABS = [
  lab({
    id: 'pure_chat',
    title: 'Pure chat',
    summary: 'Speaker-only control with one tutor model call per learner turn and no teaching-policy machinery.',
    audience: 'learner_safe',
    maturity: 'stable',
    conflicts: ['proof DAG', 'automated learner', 'mixed drafting', 'tuning'],
    modelCalls: { pattern: 'one_per_learner_turn', roles: ['tutor'], minimumPerTurn: 1, maximumPerTurn: 1 },
    artifacts: ['public transcript', 'technical trace'],
    costClass: 'low',
    transportSafety: surface({ voice: 'opt_in_with_microphone_consent' }),
    cliDefaults: {
      passthrough: true,
      'no-classifier': true,
      'no-register-selection': true,
      'no-turn-feedback': true,
      'no-closeout-report': true,
      'no-opening': true,
    },
  }),
  lab({
    id: 'human_scaffold',
    title: 'Human scaffold',
    summary: 'Human learner session with staged evidence, public reasoning analysis, and guarded adaptive tutoring.',
    audience: 'learner_safe',
    maturity: 'stable',
    prerequisites: ['validated scenario world'],
    conflicts: ['curriculum module', 'automated learner', 'negative control policy'],
    modelCalls: { pattern: 'bounded_multi_role_per_turn', roles: ['tutor', 'learner_reasoning'], minimumPerTurn: 2 },
    artifacts: ['public transcript', 'technical trace', 'learning summary'],
    costClass: 'medium',
    transportSafety: surface({ voice: 'opt_in_with_microphone_consent' }),
    cliDefaults: {
      dag: true,
      'tutor-learner-dag': true,
      'dag-mode': 'defeasible_human_scaffold',
      'register-policy': 'field',
      'safe-registers': true,
    },
  }),
  lab({
    id: 'mixed_drafting',
    title: 'Mixed drafting',
    summary: 'Human-in-the-loop learner drafting with inspectable clue, draft, analysis, and tutor-prefetch artifacts.',
    audience: 'learner_safe',
    maturity: 'stable',
    prerequisites: ['validated scenario world', 'explicit human acceptance of AI-authored learner text'],
    conflicts: ['automated learner', 'negative control policy'],
    modelCalls: {
      pattern: 'bounded_multi_role_plus_prefetch',
      roles: ['tutor', 'learner_reasoning', 'learner_draft'],
      minimumPerTurn: 3,
    },
    artifacts: ['public transcript', 'draft provenance', 'technical trace', 'learning summary'],
    costClass: 'medium',
    transportSafety: surface({ voice: 'opt_in_with_microphone_consent' }),
    cliDefaults: {
      dag: true,
      'tutor-learner-dag': true,
      'dag-mode': 'defeasible_human_scaffold',
      'register-policy': 'field',
      'safe-registers': true,
      'mixed-learner': true,
    },
    activationCommands: ['/suggest', '/use', '/regen'],
  }),
  lab({
    id: 'coaching',
    title: 'Private coaching',
    summary: 'Human scaffold with private, evidence-bounded coach guidance kept outside public learner history.',
    audience: 'learner_safe',
    maturity: 'beta',
    prerequisites: ['validated scenario world', 'switch to the private coach role with /coach'],
    conflicts: ['automated learner', 'negative control policy'],
    modelCalls: { pattern: 'bounded_multi_role_per_turn', roles: ['tutor', 'learner_reasoning'], minimumPerTurn: 2 },
    artifacts: ['public transcript', 'private coach audit', 'technical trace'],
    costClass: 'medium',
    transportSafety: surface({ voice: 'learner_speech_only_coach_text_requires_explicit_private_input' }),
    cliDefaults: {
      dag: true,
      'tutor-learner-dag': true,
      'dag-mode': 'defeasible_human_scaffold',
      'register-policy': 'field',
      'safe-registers': true,
    },
    activationCommands: ['/coach'],
  }),
  lab({
    id: 'feedback_tuning',
    title: 'Feedback and tuning',
    summary: 'Capture bounded helpfulness evidence and typed tutor-version candidates without automatic promotion.',
    audience: 'internal',
    maturity: 'beta',
    prerequisites: ['reviewer identity', 'manual candidate review before canary or promotion'],
    conflicts: ['automated learner', 'passthrough'],
    modelCalls: { pattern: 'bounded_multi_role_per_turn', roles: ['tutor', 'learner_reasoning'], minimumPerTurn: 2 },
    artifacts: ['feedback observations', 'review candidates', 'frozen replay bundle', 'technical trace'],
    costClass: 'medium',
    transportSafety: surface({
      browser: 'supported_with_server_side_candidate_store',
      voice: 'opt_in_feedback_is_manual',
    }),
    cliDefaults: {
      dag: true,
      'tutor-learner-dag': true,
      'dag-mode': 'defeasible_human_scaffold',
      'register-policy': 'field',
      tuning: 'capture',
    },
    activationCommands: ['/up', '/down', '/tune'],
  }),
  lab({
    id: 'voice',
    title: 'Voice companion',
    summary: 'Human scaffold with opt-in microphone transcription and accepted-tutor-text rendering.',
    audience: 'learner_safe',
    maturity: 'beta',
    prerequisites: ['explicit microphone consent', 'local OpenAI Realtime credential'],
    conflicts: ['unattended automation'],
    modelCalls: {
      pattern: 'bounded_multi_role_plus_realtime',
      roles: ['tutor', 'learner_reasoning', 'realtime_transcription', 'realtime_voice'],
      minimumPerTurn: 2,
    },
    artifacts: ['public transcript', 'voice delivery audit', 'technical trace'],
    costClass: 'high',
    transportSafety: surface({ voice: 'explicit_consent_required_no_automatic_realtime_reply' }),
    cliDefaults: {
      dag: true,
      'tutor-learner-dag': true,
      'dag-mode': 'defeasible_human_scaffold',
      'register-policy': 'field',
      'safe-registers': true,
      voice: true,
    },
    activationCommands: ['/voice'],
  }),
  lab({
    id: 'curriculum',
    title: 'Curriculum inquiry',
    summary: 'Reflective, non-DAG tutoring over an explicitly selected curriculum module.',
    audience: 'learner_safe',
    maturity: 'beta',
    prerequisites: ['--curriculum <workplan|path>', '--module <id> when the curriculum has multiple modules'],
    conflicts: ['scenario world', 'proof DAG', 'negative control policy'],
    modelCalls: { pattern: 'bounded_multi_role_per_turn', roles: ['tutor', 'learner_analysis'], minimumPerTurn: 2 },
    artifacts: ['public transcript', 'technical trace', 'learning summary'],
    costClass: 'medium',
    transportSafety: surface(),
    cliDefaults: {
      dag: false,
      'tutor-learner-dag': false,
      world: 'none',
      'safe-registers': true,
    },
    requiredOptions: ['curriculum'],
  }),
  lab({
    id: 'labelling',
    title: 'Human labelling',
    summary: 'Consolidated human-labelling harness with explicit dataset and coder identity.',
    audience: 'research',
    maturity: 'stable',
    prerequisites: ['--label-dataset <id>', '--label-coder <id>'],
    conflicts: ['tutor chat', 'voice'],
    modelCalls: { pattern: 'zero', roles: [], minimumPerTurn: 0, maximumPerTurn: 0 },
    artifacts: ['label output sidecar'],
    costClass: 'none',
    transportSafety: surface({ voice: 'not_supported' }),
    cliDefaults: {
      'launch-mode': 'labelling-game',
      'labelling-game': true,
    },
    requiredOptions: ['label-dataset', 'label-coder'],
  }),
  lab({
    id: 'automated_eval',
    title: 'Automated evaluation',
    summary: 'Bounded model-backed learner loop for research evaluation, never presented as a human learner session.',
    audience: 'research',
    maturity: 'stable',
    prerequisites: ['validated scenario world', 'explicit model-call budget'],
    conflicts: ['human turn feedback', 'mixed drafting', 'voice'],
    modelCalls: {
      pattern: 'metered_automated_multi_role',
      roles: ['tutor', 'learner_reasoning', 'automated_learner'],
      minimumPerTurn: 3,
    },
    artifacts: ['public transcript', 'technical trace', 'learning summary', 'evaluation closeout'],
    costClass: 'metered_high',
    transportSafety: surface({ browser: 'privileged_bounded_launch_only', voice: 'not_supported' }),
    cliDefaults: {
      dag: true,
      'tutor-learner-dag': true,
      'dag-mode': 'strict_dag',
      'register-policy': 'field',
      'auto-learner': true,
      'auto-turns': 'until-grounded',
      'no-turn-feedback': true,
    },
  }),
  lab({
    id: 'research_controls',
    title: 'Research controls',
    summary:
      'Explicit simulated lower-bound/control session using the negative policy; never a learner-facing default.',
    audience: 'research',
    maturity: 'experimental',
    prerequisites: ['validated scenario world', 'explicit model-call budget', 'research-use acknowledgement'],
    conflicts: ['learner-facing deployment', 'human turn feedback', 'voice'],
    modelCalls: {
      pattern: 'metered_automated_multi_role',
      roles: ['tutor', 'learner_reasoning', 'automated_learner'],
      minimumPerTurn: 3,
    },
    artifacts: ['control-arm transcript', 'technical trace', 'evaluation closeout'],
    costClass: 'metered_high',
    transportSafety: surface({
      terminal: 'explicit_research_launch_only',
      browser: 'privileged_only',
      voice: 'not_supported',
    }),
    cliDefaults: {
      dag: true,
      'tutor-learner-dag': true,
      'dag-mode': 'strict_dag',
      'register-policy': 'negative',
      'register-palette': 'negative',
      'auto-learner': true,
      'auto-turns': 'until-grounded',
      'no-turn-feedback': true,
      'safe-registers': false,
    },
  }),
];

const CATALOG = deepFreeze({
  schema: TUTOR_STUB_LAB_CATALOG_SCHEMA,
  version: TUTOR_STUB_LAB_CATALOG_VERSION,
  labs: LABS,
});
const LAB_BY_ID = new Map(CATALOG.labs.map((entry) => [entry.id, entry]));

function publicProjection(entry) {
  if (!entry) return null;
  return deepFreeze({
    schema: entry.schema,
    version: entry.version,
    id: entry.id,
    title: entry.title,
    summary: entry.summary,
    audience: entry.audience,
    maturity: entry.maturity,
    prerequisites: [...entry.prerequisites],
    conflicts: [...entry.conflicts],
    modelCalls: { ...entry.modelCalls, roles: [...entry.modelCalls.roles] },
    artifacts: [...entry.artifacts],
    costClass: entry.costClass,
    transportSafety: { ...entry.transportSafety },
    activationCommands: [...entry.activationCommands],
  });
}

export function getTutorStubLab(id) {
  return publicProjection(LAB_BY_ID.get(String(id || '').trim()) || null);
}

export function listTutorStubLabs({ audience } = {}) {
  const normalizedAudience = audience ? String(audience).trim() : null;
  if (normalizedAudience && !TUTOR_STUB_LAB_AUDIENCES.includes(normalizedAudience)) {
    throw new Error(`unknown tutor-stub lab audience "${normalizedAudience}"`);
  }
  return Object.freeze(
    CATALOG.labs
      .filter((entry) => !normalizedAudience || entry.audience === normalizedAudience)
      .map((entry) => publicProjection(entry)),
  );
}

function capabilityConfig(options) {
  const passthrough = Boolean(options.passthrough);
  const curriculum = Boolean(options.curriculum) || options.world === 'none';
  const autoLearner = Boolean(options['auto-learner']);
  return {
    passthrough,
    interactive: !autoLearner && !options.once,
    world: !curriculum,
    curriculum,
    dag: Boolean(options.dag),
    learnerDag: Boolean(options['tutor-learner-dag']),
    classifier: !options['no-classifier'],
    registerSelection: !options['no-register-selection'],
    mixedLearner: Boolean(options['mixed-learner'] || options['mixed-mode']),
    autoLearner,
    demo: Boolean(options.demo),
    turnFeedback: !options['no-turn-feedback'] && !autoLearner,
    tuning: Boolean(options.tuning && options.tuning !== 'off'),
    voice: Boolean(options.voice),
    trace: !options['no-trace'],
    fieldVisualization: Boolean(options['field-viz']),
    learningSummary: !options['no-closeout-report'],
    responseChecks: !passthrough,
    evaluation: ['automated_eval', 'research_controls'].includes(options.lab),
  };
}

function tutorStubLabConflictViolations(entry, options = {}) {
  const violations = [];
  const add = (code, message) => violations.push({ code, message });
  const policy = String(options['register-policy'] || '').toLowerCase();
  const palette = String(options['register-palette'] || '').toLowerCase();
  const tuning = String(options.tuning || 'off').toLowerCase();

  if (entry.audience === 'learner_safe') {
    if (options['auto-learner']) add('simulated_learner', '--auto-learner is research-only');
    if (options.demo) add('simulated_demo', '--demo is research-only');
    if (/(^|,)(negative|random)(,|$)/u.test(policy)) {
      add('unsafe_register_policy', `--register-policy ${policy} is not learner-safe`);
    }
    if (
      !options['safe-registers'] &&
      !options['no-register-selection'] &&
      /(^|,)(negative|negative-floor|simulated|all)(,|$)/u.test(palette)
    ) {
      add('unsafe_register_palette', `--register-palette ${palette} is not learner-safe`);
    }
  }

  if (entry.id === 'pure_chat') {
    if (options.dag || options['tutor-learner-dag']) add('proof_dag', 'pure_chat cannot enable a proof DAG');
    if (options['mixed-learner'] || options['mixed-mode']) {
      add('mixed_drafting', 'pure_chat cannot enable mixed learner drafting');
    }
    if (tuning !== 'off') add('tuning', 'pure_chat cannot enable tutor tuning');
  }
  if (['human_scaffold', 'mixed_drafting', 'coaching', 'voice'].includes(entry.id) && options.curriculum) {
    add('curriculum', `${entry.id} requires a scenario world, not a curriculum module`);
  }
  if (entry.id === 'curriculum') {
    if (options.world && options.world !== 'none')
      add('scenario_world', 'curriculum cannot also select a scenario world');
    if (options.dag || options['tutor-learner-dag']) add('proof_dag', 'curriculum cannot enable a proof DAG');
  }
  if (entry.id === 'feedback_tuning') {
    if (options['auto-learner']) add('automated_learner', 'feedback_tuning requires a human reviewer');
    if (options.passthrough) add('passthrough', 'feedback_tuning requires the analyzed tutor pipeline');
  }
  if (entry.id === 'labelling' && options.voice) add('voice', 'labelling does not support voice');
  if (['automated_eval', 'research_controls'].includes(entry.id)) {
    if (options.voice) add('voice', `${entry.id} does not support voice`);
    if (options['mixed-learner'] || options['mixed-mode']) {
      add('mixed_drafting', `${entry.id} cannot enable mixed human drafting`);
    }
    if (!options['no-turn-feedback']) add('human_feedback', `${entry.id} cannot prompt for human turn feedback`);
  }
  return violations;
}

export function resolveTutorStubLab(id, { overrides = {} } = {}) {
  const entry = LAB_BY_ID.get(String(id || '').trim());
  if (!entry) throw new Error(`unknown tutor-stub lab "${id}"; use --list-labs`);
  const options = { ...entry.cliDefaults, ...overrides, lab: entry.id };
  const missingOptions = entry.requiredOptions.filter((key) => !String(options[key] ?? '').trim());
  const conflictViolations = tutorStubLabConflictViolations(entry, options);
  const capabilities = resolveTutorStubCapabilities(capabilityConfig(options));
  return deepFreeze({
    schema: TUTOR_STUB_LAB_RESOLUTION_SCHEMA,
    version: TUTOR_STUB_LAB_CATALOG_VERSION,
    lab: publicProjection(entry),
    cliOptions: options,
    requiredOptions: [...entry.requiredOptions],
    missingOptions,
    conflictViolations,
    capabilities,
    modelCalls: { ...entry.modelCalls, roles: [...entry.modelCalls.roles] },
    costClass: entry.costClass,
  });
}

export function assertTutorStubLabRequirements(resolution, options = {}) {
  if (resolution?.schema !== TUTOR_STUB_LAB_RESOLUTION_SCHEMA) {
    throw new Error(`lab resolution must use ${TUTOR_STUB_LAB_RESOLUTION_SCHEMA}`);
  }
  const missing = resolution.requiredOptions.filter((key) => !String(options[key] ?? '').trim());
  if (missing.length) {
    throw new Error(`lab ${resolution.lab.id} requires ${missing.map((key) => `--${key} <value>`).join(', ')}`);
  }
  const entry = LAB_BY_ID.get(resolution.lab.id);
  const conflicts = tutorStubLabConflictViolations(entry, { ...resolution.cliOptions, ...options });
  if (conflicts.length) {
    throw new Error(
      `lab ${resolution.lab.id} has incompatible options: ${conflicts.map((item) => item.message).join('; ')}`,
    );
  }
  return true;
}

export function tutorStubLabTraceMetadata(resolution) {
  if (!resolution) return null;
  return deepFreeze({
    schema: TUTOR_STUB_LAB_RESOLUTION_SCHEMA,
    catalogVersion: TUTOR_STUB_LAB_CATALOG_VERSION,
    id: resolution.lab.id,
    audience: resolution.lab.audience,
    maturity: resolution.lab.maturity,
    resolvedCapabilities: [...resolution.capabilities.active],
    modelCalls: { ...resolution.modelCalls, roles: [...resolution.modelCalls.roles] },
    costClass: resolution.costClass,
    transportSafety: { ...resolution.lab.transportSafety },
  });
}

export function formatTutorStubLabList({ audience } = {}) {
  const rows = listTutorStubLabs({ audience });
  return rows
    .map(
      (entry) =>
        `${entry.id}\t${entry.audience}\t${entry.maturity}\t${entry.costClass}\t${entry.title}\n  ${entry.summary}`,
    )
    .join('\n');
}

export function assertTutorStubLabCatalogInvariants(catalog = CATALOG) {
  if (catalog?.schema !== TUTOR_STUB_LAB_CATALOG_SCHEMA || catalog?.version !== TUTOR_STUB_LAB_CATALOG_VERSION) {
    throw new Error('invalid tutor-stub lab catalog schema or version');
  }
  const ids = new Set();
  for (const entry of catalog.labs || []) {
    if (!/^[a-z][a-z0-9_]*$/u.test(entry.id || '')) throw new Error(`invalid tutor-stub lab id: ${entry.id}`);
    if (ids.has(entry.id)) throw new Error(`duplicate tutor-stub lab id: ${entry.id}`);
    if (!TUTOR_STUB_LAB_AUDIENCES.includes(entry.audience)) throw new Error(`invalid audience for ${entry.id}`);
    if (!TUTOR_STUB_LAB_MATURITY.includes(entry.maturity)) throw new Error(`invalid maturity for ${entry.id}`);
    if (entry.audience === 'learner_safe') {
      const policy = String(entry.cliDefaults['register-policy'] || '').toLowerCase();
      if (['negative', 'random'].includes(policy) || entry.cliDefaults['auto-learner']) {
        throw new Error(`learner_safe lab ${entry.id} implicitly enables a simulated or negative mode`);
      }
    }
    ids.add(entry.id);
  }
  return true;
}

assertTutorStubLabCatalogInvariants();
