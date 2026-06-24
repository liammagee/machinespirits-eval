// Shared drama-machine parameter catalog for Scriptorium surfaces.
//
// The taxonomy/spec docs name many slots. This module keeps two layers:
//   1. functional components: architecture-facing subsystems such as recognition
//      and proof DAG;
//   2. parameter components: low-level form facets used to render dense controls.
// Compose, launch, and future tools can use either layer without inventing their
// own parameter map.

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

export const DRAMA_PARAMETER_COMPONENTS = deepFreeze([
  {
    id: 'matter',
    label: 'Learning matter',
    shortLabel: 'matter',
    summary: 'Course binding, topic, hamartia, hidden fact, and other content-level commitments.',
  },
  {
    id: 'form',
    label: 'Dramatic engine',
    shortLabel: 'form',
    summary: 'Targets, plot devices, reversal policy, act/beat structure, and per-turn move plans.',
  },
  {
    id: 'agents',
    label: 'Agents',
    shortLabel: 'agents',
    summary: 'Tutor and learner character, persona, prompt stance, and ego/superego/id architecture.',
  },
  {
    id: 'scene',
    label: 'Scene',
    shortLabel: 'scene',
    summary: 'Pedagogical approach, dialogue approach, diction, stage setting, relationship, and props.',
  },
  {
    id: 'cast',
    label: 'Cast',
    shortLabel: 'cast',
    summary: 'Which human, LLM backend, model, or mock plays each role; cast.director is the scene-author/staging compatibility key.',
  },
  {
    id: 'audience',
    label: 'Audience',
    shortLabel: 'audience',
    summary: 'Critic panel, consensus rule, scoring mode, blinding, rubric, and structure critic.',
  },
  {
    id: 'runtime',
    label: 'Runtime',
    shortLabel: 'runtime',
    summary: 'IDs, turn caps, launch safety, cost mode, output paths, concurrency, and process controls.',
  },
]);

export const DRAMA_PARAMETER_COMPONENT_ORDER = deepFreeze(DRAMA_PARAMETER_COMPONENTS.map((c) => c.id));

export const DRAMA_FUNCTIONAL_COMPONENTS = deepFreeze([
  {
    id: 'recognition',
    label: 'Recognition',
    shortLabel: 'recognition',
    summary:
      'Recognition-theory stance, recognition targets, anagnorisis/catharsis pressure, and recognition-sensitive scoring.',
    parameterComponents: ['agents', 'form', 'scene', 'audience'],
    fieldPaths: [
      'drama.targets',
      'drama.tutor.prompt_type',
      'drama.tutor.recognition_mode',
      'drama.learner.architecture',
      'drama.learner.superego_disposition',
      'drama.pedagogical_approach',
      'drama.dialogue_approach',
      'audience.rubric',
    ],
    runParams: ['recognition', 'charisma'],
  },
  {
    id: 'superego_critic',
    label: 'Superego critic',
    shortLabel: 'superego',
    summary:
      'Tutor and learner ego/superego deliberation, critic dispositions, structure critics, and stall-watch self-monitoring.',
    parameterComponents: ['agents', 'audience', 'cast', 'runtime'],
    fieldPaths: [
      'drama.tutor.architecture',
      'drama.tutor.superego_disposition',
      'drama.learner.architecture',
      'drama.learner.superego_disposition',
      'cast.tutor_superego',
      'audience.structure_critic',
    ],
    runParams: ['superego', 'stallWatch'],
  },
  {
    id: 'adaptation',
    label: 'Adaptation',
    shortLabel: 'adaptation',
    summary:
      'Continuation policies, tutor adaptation policies, turn-plan moves, triggers, and dramaturgical route changes.',
    parameterComponents: ['form', 'agents', 'scene'],
    fieldPaths: [
      'drama.targets',
      'drama.continuation_policy',
      'drama.continuation_anchor',
      'drama.tutor_adaptation_policy',
      'turn_plan',
      'turn_plan.at',
      'turn_plan.role',
      'turn_plan.moves',
      'turn_plan.when_trigger',
      'turn_plan.forbid',
      'turn_plan.route_change',
      'drama.pedagogical_approach',
      'drama.dialogue_approach',
    ],
    runParams: ['mode', 'itemId', 'runId', 'transcript', 'dramaturgy'],
  },
  {
    id: 'proof_dag',
    label: 'Proof DAG',
    shortLabel: 'proof DAG',
    summary:
      'Worlds, tutor scripts, hidden facts, premise ledgers, proof progress, and fixed-rule derivation outcomes.',
    parameterComponents: ['matter', 'form', 'runtime'],
    fieldPaths: [
      'drama.secret',
      'drama.secret.fact',
      'drama.secret.premise_ledger',
      'drama.secret.symbolic',
      'drama.act_structure',
    ],
    runParams: ['world', 'script', 'answers'],
  },
  {
    id: 'cast_layer',
    label: 'Cast layer',
    shortLabel: 'cast',
    summary: 'Human, LLM, model, backend, role-map, and mock bindings, including the scene-author/director role.',
    parameterComponents: ['cast', 'agents', 'runtime'],
    fieldPaths: [
      'cast.director',
      'cast.tutor',
      'cast.tutor_superego',
      'cast.learner',
      'cast.critic',
      'cast.default_backend',
      'cast.role_map',
      'cast.generator',
      'cast.model',
    ],
    runParams: ['generator', 'model', 'roleMap'],
  },
  {
    id: 'audience_critic',
    label: 'Audience critic',
    shortLabel: 'audience',
    summary: 'Judge panels, consensus, grading, blinding, rubrics, structure critics, and scoring backfills.',
    parameterComponents: ['audience', 'cast', 'runtime'],
    fieldPaths: [
      'audience.panel',
      'audience.consensus',
      'audience.grading',
      'audience.blinding',
      'audience.rubric',
      'audience.structure_critic',
      'cast.critic',
    ],
    runParams: [
      'checker',
      'critic',
      'key',
      'sampleDir',
      'rootDir',
      'scoreConcurrency',
      'allowQualityWarnings',
      'failOnViolation',
    ],
  },
  {
    id: 'run_orchestration',
    label: 'Run orchestration',
    shortLabel: 'runtime',
    summary:
      'IDs, specs, limits, output paths, dry-run/force controls, concurrency, cost gates, and process launch state.',
    parameterComponents: ['matter', 'runtime'],
    fieldPaths: [
      'drama.id',
      'drama.max_turns',
      'run.kind',
      'run.mock',
      'run.dry_run',
      'run.force',
      'run.cost_class',
      'run.output',
      'run.concurrency',
    ],
    runParams: [
      'id',
      'spec',
      'only',
      'title',
      'limit',
      'maxTurns',
      'db',
      'out',
      'outDir',
      'outRoot',
      'outBase',
      'concurrency',
      'batchSize',
      'dryRun',
      'force',
      'mock',
      'real',
      'specOnly',
      'claudePersistentWorkers',
      'label',
      'effort',
    ],
  },
]);

export const DRAMA_FUNCTIONAL_COMPONENT_ORDER = deepFreeze(DRAMA_FUNCTIONAL_COMPONENTS.map((c) => c.id));

export const DRAMA_PARAMETER_FIELDS = deepFreeze([
  // matter
  { path: 'syllabus.course', component: 'matter', surfaces: ['compose', 'live'] },
  { path: 'syllabus.lesson', component: 'matter', surfaces: ['compose', 'live'] },
  { path: 'drama.topic', component: 'matter', surfaces: ['compose', 'live', 'run'] },
  { path: 'drama.hamartia', component: 'matter', surfaces: ['compose', 'live'] },
  { path: 'drama.learner.start_state', component: 'matter', surfaces: ['compose'] },
  { path: 'drama.secret', component: 'matter', surfaces: ['spec'] },
  { path: 'drama.secret.fact', component: 'matter', surfaces: ['spec'] },
  { path: 'drama.secret.premise_ledger', component: 'matter', surfaces: ['spec'] },
  { path: 'drama.secret.symbolic', component: 'matter', surfaces: ['spec'] },

  // form
  { path: 'drama.targets', component: 'form', surfaces: ['compose', 'spec'] },
  { path: 'drama.continuation_policy', component: 'form', surfaces: ['compose', 'run'] },
  { path: 'drama.continuation_anchor', component: 'form', surfaces: ['spec'] },
  { path: 'drama.tutor_adaptation_policy', component: 'form', surfaces: ['compose', 'run'] },
  { path: 'drama.act_structure', component: 'form', surfaces: ['spec'] },
  { path: 'turn_plan', component: 'form', surfaces: ['compose', 'run'] },
  { path: 'turn_plan.at', component: 'form', surfaces: ['compose'] },
  { path: 'turn_plan.role', component: 'form', surfaces: ['compose'] },
  { path: 'turn_plan.moves', component: 'form', surfaces: ['compose'] },
  { path: 'turn_plan.when_trigger', component: 'form', surfaces: ['spec'] },
  { path: 'turn_plan.forbid', component: 'form', surfaces: ['spec'] },
  { path: 'turn_plan.route_change', component: 'form', surfaces: ['spec'] },

  // agents
  { path: 'drama.tutor.prompt_type', component: 'agents', surfaces: ['compose', 'live', 'run'] },
  { path: 'drama.tutor.architecture', component: 'agents', surfaces: ['compose', 'live'] },
  { path: 'drama.tutor.superego_disposition', component: 'agents', surfaces: ['compose'] },
  { path: 'drama.tutor.recognition_mode', component: 'agents', surfaces: ['compose'] },
  { path: 'drama.tutor.id_tuning', component: 'agents', surfaces: ['spec'] },
  { path: 'drama.tutor.register_classifier', component: 'agents', surfaces: ['spec'] },
  { path: 'drama.tutor.witness_exemplars', component: 'agents', surfaces: ['spec'] },
  { path: 'drama.tutor.conversation_mode', component: 'agents', surfaces: ['spec'] },
  { path: 'drama.tutor.goal', component: 'agents', surfaces: ['spec'] },
  { path: 'drama.learner.persona', component: 'agents', surfaces: ['compose', 'live'] },
  { path: 'drama.learner.architecture', component: 'agents', surfaces: ['compose', 'live'] },
  { path: 'drama.learner.superego_disposition', component: 'agents', surfaces: ['compose'] },
  { path: 'drama.learner.goal', component: 'agents', surfaces: ['spec'] },
  { path: 'drama.learners', component: 'agents', surfaces: ['spec'] },

  // scene
  { path: 'drama.pedagogical_approach', component: 'scene', surfaces: ['compose', 'run'] },
  { path: 'drama.dialogue_approach', component: 'scene', surfaces: ['compose', 'run'] },
  { path: 'drama.voice.locale', component: 'scene', surfaces: ['spec'] },
  { path: 'drama.voice.register', component: 'scene', surfaces: ['compose'] },
  { path: 'drama.voice.person_policy', component: 'scene', surfaces: ['spec'] },
  { path: 'drama.voice.constraints', component: 'scene', surfaces: ['spec'] },
  { path: 'drama.voice.side_constraints', component: 'scene', surfaces: ['spec'] },
  { path: 'drama.scene.setting', component: 'scene', surfaces: ['compose'] },
  { path: 'drama.scene.relationship', component: 'scene', surfaces: ['compose'] },
  { path: 'drama.scene.stakes', component: 'scene', surfaces: ['compose'] },
  { path: 'drama.scene.opening_speaker', component: 'scene', surfaces: ['compose', 'live'] },
  { path: 'drama.scene.ending_speaker', component: 'scene', surfaces: ['compose'] },
  { path: 'drama.scene.object', component: 'scene', surfaces: ['compose'] },
  { path: 'drama.scene.stage_direction_policy', component: 'scene', surfaces: ['compose'] },
  { path: 'drama.scene.stage_direction_style', component: 'scene', surfaces: ['compose'] },
  { path: 'drama.scene.reader_context', component: 'scene', surfaces: ['spec'] },

  // cast
  { path: 'cast.director', component: 'cast', surfaces: ['compose', 'run'] },
  { path: 'cast.tutor', component: 'cast', surfaces: ['compose', 'live', 'run'] },
  { path: 'cast.tutor_superego', component: 'cast', surfaces: ['spec'] },
  { path: 'cast.learner', component: 'cast', surfaces: ['compose', 'live', 'run'] },
  { path: 'cast.critic', component: 'cast', surfaces: ['compose', 'run'] },
  { path: 'cast.default_backend', component: 'cast', surfaces: ['compose', 'run'] },
  { path: 'cast.role_map', component: 'cast', surfaces: ['run'] },
  { path: 'cast.generator', component: 'cast', surfaces: ['run'] },
  { path: 'cast.model', component: 'cast', surfaces: ['run', 'live'] },

  // audience
  { path: 'audience.panel', component: 'audience', surfaces: ['compose', 'run'] },
  { path: 'audience.consensus', component: 'audience', surfaces: ['compose', 'run'] },
  { path: 'audience.grading', component: 'audience', surfaces: ['compose', 'run'] },
  { path: 'audience.blinding', component: 'audience', surfaces: ['compose', 'run'] },
  { path: 'audience.rubric', component: 'audience', surfaces: ['compose', 'run'] },
  { path: 'audience.structure_critic', component: 'audience', surfaces: ['run'] },

  // runtime
  { path: 'drama.id', component: 'runtime', surfaces: ['compose', 'run'] },
  { path: 'drama.max_turns', component: 'runtime', surfaces: ['compose', 'live', 'run'] },
  { path: 'run.kind', component: 'runtime', surfaces: ['run'] },
  { path: 'run.mock', component: 'runtime', surfaces: ['run', 'live'] },
  { path: 'run.dry_run', component: 'runtime', surfaces: ['run'] },
  { path: 'run.force', component: 'runtime', surfaces: ['run'] },
  { path: 'run.cost_class', component: 'runtime', surfaces: ['run', 'live'] },
  { path: 'run.output', component: 'runtime', surfaces: ['run'] },
  { path: 'run.concurrency', component: 'runtime', surfaces: ['run'] },
]);

export const COMPOSER_BASE_VOCAB = deepFreeze({
  forms: [
    'peripeteia',
    'anagnorisis',
    'catharsis',
    'surprise_inevitability',
    'unity_of_action',
    'hamartia_integration',
  ],
  promptTypes: ['recognition', 'base', 'placebo', 'naive', 'dialectical_suspicious', 'matched_recognition'],
  tutorArch: ['ego_superego', 'ego_only', 'id_director'],
  superego: ['suspicious', 'standard', 'adversary', 'advocate', 'strict', 'coupling'],
  continuationPolicy: ['none', 'anchor', 'revoice', 'reconsider', 'reframe'],
  adaptationPolicy: [
    'none',
    'routine',
    'uptake',
    'peripeteia',
    'uptake+peripeteia',
    'socratic_discovery',
    'reveal_secret',
  ],
  speakers: ['learner', 'tutor', 'director'],
  stagePolicy: ['sparse', 'none', 'none_except_required_cue', 'short', 'interventionist', 'rich'],
  stageStyle: [
    'object_business',
    'bare_transcript',
    'scene_heading',
    'ambient_pressure',
    'placard_caption',
    'thread_metadata',
    'choric_margin',
    'rich_scene_work',
  ],
  grading: ['graded', 'binary'],
  blinding: ['arm-blind', 'omniscient', 'fully-blind'],
  roles: ['tutor', 'learner', 'director'],
  roleLabels: { tutor: 'Tutor', learner: 'Learner', director: 'Scene author / director' },
  movesByRole: {
    tutor: [
      'stock_take',
      'route_change',
      'action_gate',
      'uptake',
      'meter',
      'recognition_press',
      'withhold',
      'reveal',
      'register_shift',
      'status_shift',
      'foreshadow',
    ],
    learner: ['revoice', 'reconsider', 'reframe', 'perform_device', 'voice_misfit', 'genuine_anagnorisis', 'aporia'],
    director: ['inject_revisit_cue', 'inject_reversal_pressure', 'scene_interruption'],
  },
  antiPatterns: ['hold', 'pseudo_catharsis'],
  castSuggest: ['llm:api:sonnet', 'llm:claude:opus', 'llm:codex', 'llm:gemini', 'human', 'mock'],
  panelSuggest: ['gpt', 'deepseek-v4-pro', 'qwen3.7-max', 'gemini-3.5-flash'],
});

export const RUN_PARAM_COMPONENT_BY_NAME = deepFreeze({
  // input / matter
  mode: 'matter',
  itemId: 'matter',
  runId: 'matter',
  transcript: 'matter',
  spec: 'matter',
  only: 'matter',
  world: 'matter',
  script: 'matter',
  sampleDir: 'matter',
  rootDir: 'matter',
  title: 'matter',
  answers: 'matter',

  // form
  dramaturgy: 'form',

  // agents
  recognition: 'agents',
  charisma: 'agents',
  superego: 'agents',

  // cast
  generator: 'cast',
  model: 'cast',
  roleMap: 'cast',

  // audience
  checker: 'audience',
  critic: 'audience',
  key: 'audience',
  allowQualityWarnings: 'audience',
  failOnViolation: 'audience',

  // runtime
  id: 'runtime',
  effort: 'runtime',
  limit: 'runtime',
  maxTurns: 'runtime',
  db: 'runtime',
  out: 'runtime',
  outDir: 'runtime',
  outRoot: 'runtime',
  outBase: 'runtime',
  concurrency: 'runtime',
  batchSize: 'runtime',
  scoreConcurrency: 'runtime',
  mock: 'runtime',
  dryRun: 'runtime',
  force: 'runtime',
  specOnly: 'runtime',
  real: 'runtime',
  stallWatch: 'runtime',
  claudePersistentWorkers: 'runtime',
  label: 'runtime',
});

const COMPONENT_BY_ID = new Map(DRAMA_PARAMETER_COMPONENTS.map((component) => [component.id, component]));
const FUNCTIONAL_COMPONENT_BY_ID = new Map(DRAMA_FUNCTIONAL_COMPONENTS.map((component) => [component.id, component]));
const FIELD_BY_PATH = new Map(DRAMA_PARAMETER_FIELDS.map((field) => [field.path, field]));
const RUN_ORCHESTRATION_FALLBACK = deepFreeze(['run_orchestration']);

function addMapValue(map, key, value) {
  if (!key) return;
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(value);
}

function mapEntriesToFrozenObject(map) {
  return deepFreeze(
    Object.fromEntries(Array.from(map.entries()).map(([key, values]) => [key, Array.from(new Set(values))])),
  );
}

function buildFunctionalFieldMap() {
  const map = new Map();
  for (const component of DRAMA_FUNCTIONAL_COMPONENTS) {
    for (const path of component.fieldPaths || []) addMapValue(map, path, component.id);
  }
  return mapEntriesToFrozenObject(map);
}

function buildFunctionalRunParamMap() {
  const map = new Map();
  for (const component of DRAMA_FUNCTIONAL_COMPONENTS) {
    for (const name of component.runParams || []) addMapValue(map, name, component.id);
  }
  return mapEntriesToFrozenObject(map);
}

export const FUNCTIONAL_COMPONENTS_BY_FIELD_PATH = buildFunctionalFieldMap();
export const FUNCTIONAL_COMPONENTS_BY_RUN_PARAM = buildFunctionalRunParamMap();
export const RUN_PARAM_FUNCTIONAL_COMPONENT_BY_NAME = deepFreeze(
  Object.fromEntries(
    Object.entries(FUNCTIONAL_COMPONENTS_BY_RUN_PARAM).map(([name, components]) => [name, components[0]]),
  ),
);

export function dramaParameterComponent(id) {
  return COMPONENT_BY_ID.get(id) || COMPONENT_BY_ID.get('runtime');
}

export function dramaFunctionalComponent(id) {
  return FUNCTIONAL_COMPONENT_BY_ID.get(id) || null;
}

export function componentForRunParam(name) {
  return RUN_PARAM_COMPONENT_BY_NAME[name] || 'runtime';
}

export function functionalComponentsForField(path) {
  return FUNCTIONAL_COMPONENTS_BY_FIELD_PATH[path] || [];
}

export function functionalComponentsForRunParam(name) {
  return FUNCTIONAL_COMPONENTS_BY_RUN_PARAM[name] || RUN_ORCHESTRATION_FALLBACK;
}

export function buildComposerVocab(liveVocab = {}) {
  return deepFreeze({
    ...COMPOSER_BASE_VOCAB,
    personas: [...(liveVocab.personas || [])],
    learnerArch: [...(liveVocab.learnerArch || [])],
    components: DRAMA_PARAMETER_COMPONENTS,
    componentOrder: DRAMA_PARAMETER_COMPONENT_ORDER,
    componentFields: DRAMA_PARAMETER_FIELDS,
    functionalComponents: DRAMA_FUNCTIONAL_COMPONENTS,
    functionalComponentOrder: DRAMA_FUNCTIONAL_COMPONENT_ORDER,
    functionalComponentFields: FUNCTIONAL_COMPONENTS_BY_FIELD_PATH,
    runFunctionalComponents: FUNCTIONAL_COMPONENTS_BY_RUN_PARAM,
  });
}

export function fieldsForComponent(componentId, { surface } = {}) {
  return DRAMA_PARAMETER_FIELDS.filter(
    (field) => field.component === componentId && (!surface || field.surfaces.includes(surface)),
  );
}

export function fieldsForFunctionalComponent(functionalId, { surface } = {}) {
  const component = dramaFunctionalComponent(functionalId);
  if (!component) return [];
  return component.fieldPaths
    .map((path) => FIELD_BY_PATH.get(path))
    .filter(Boolean)
    .filter((field) => !surface || field.surfaces.includes(surface));
}
