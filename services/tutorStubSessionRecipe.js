import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const TUTOR_STUB_SESSION_RECIPE_SCHEMA = 'machinespirits.tutor-stub.session-recipe.v1';
export const TUTOR_STUB_SESSION_RECIPE_VERSION = 1;
export const TUTOR_STUB_RESUME_SOURCE_SCHEMA = 'machinespirits.tutor-stub.resume-source.v1';
export const TUTOR_STUB_RESUME_DRIFT_SCHEMA = 'machinespirits.tutor-stub.resume-drift.v1';

export const TUTOR_STUB_RECIPE_OPTION_KEYS = Object.freeze([
  'tutor',
  'tuning',
  'all-models',
  'model',
  'classifier-model',
  'no-classifier',
  'passthrough',
  'tutor-learner-dag',
  'learner-record-model',
  'no-register-selection',
  'register-palette',
  'register-policy',
  'point-of-action-arm',
  'committee-mini-model',
  'committee-ollama-url',
  'committee-fallback-policy',
  'register-overlay-threshold',
  'pressure-turns',
  'register-temperature',
  'light-adaptation',
  'light-adaptation-threshold',
  'dag-fact-dropout',
  'dag-fact-dropout-seed',
  'release-speed',
  'run-seed',
  'eval-repeat',
  'eval-job-id',
  'loop-mode',
  'typed-actions',
  'typed-action-task-id',
  'typed-action-knowledge-component',
  'typed-action-prerequisites',
  'typed-action-item-difficulty',
  'typed-action-support-level',
  'register-empirical-prior',
  'safe-registers',
  'topic',
  'world',
  'curriculum',
  'module',
  'dag',
  'dag-mode',
  'launch-mode',
  'labelling-game',
  'label-dataset',
  'label-coder',
  'learner',
  'goal',
  'style',
  'system',
  'auto-learner',
  'auto-learner-model',
  'auto-learner-profile',
  'auto-turns',
  'auto-safety-turns',
  'model-call-budget',
  'no-auto-stop-on-grounded',
  'mixed-learner',
  'mixed-mode',
  'demo',
  'prompt-book-context',
  'no-memory-summary',
  'multiple-choice',
  'no-opening',
  'opening-realizer',
  'no-closeout-report',
  'no-turn-feedback',
  'voice',
  'voice-model',
  'voice-name',
  'cli-effort',
  'temperature',
  'max-tokens',
  'history-turns',
]);

const IDENTITY_OPTION_KEYS = new Set([
  'world',
  'curriculum',
  'module',
  'tutor',
  'all-models',
  'model',
  'classifier-model',
  'learner-record-model',
  'auto-learner-model',
  'system',
  'prompt-book-context',
]);

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
}

function canonicalValue(value) {
  if (Array.isArray(value)) return value.map((entry) => canonicalValue(entry));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonicalValue(value[key])]),
  );
}

export function tutorStubRecipeConfigHash(config) {
  return createHash('sha256')
    .update(JSON.stringify(canonicalValue(config ?? null)))
    .digest('hex');
}

export function captureTutorStubRecipeOptions(args = {}) {
  return Object.fromEntries(
    TUTOR_STUB_RECIPE_OPTION_KEYS.filter((key) => args[key] !== undefined).map((key) => [key, args[key]]),
  );
}

export function buildTutorStubSessionRecipe({
  args = {},
  lab = null,
  identity = {},
  createdAt = new Date().toISOString(),
} = {}) {
  const config = canonicalValue({
    lab: lab || null,
    options: captureTutorStubRecipeOptions(args),
    identity: {
      schema: identity.schema || null,
      world: identity.world || null,
      prompt: identity.prompt || null,
      tutor: identity.tutor || null,
      models: identity.models || null,
    },
  });
  return deepFreeze({
    schema: TUTOR_STUB_SESSION_RECIPE_SCHEMA,
    version: TUTOR_STUB_SESSION_RECIPE_VERSION,
    createdAt,
    config,
    configHash: tutorStubRecipeConfigHash(config),
  });
}

export function normalizeTutorStubSessionRecipe(value, { source = 'recipe' } = {}) {
  if (!value || typeof value !== 'object') throw new Error(`${source} is not a tutor-stub session recipe`);
  if (value.schema !== TUTOR_STUB_SESSION_RECIPE_SCHEMA) {
    throw new Error(`${source} uses unsupported recipe schema ${value.schema || '(missing)'}`);
  }
  if (value.version !== TUTOR_STUB_SESSION_RECIPE_VERSION) {
    throw new Error(`${source} uses unsupported recipe version ${value.version || '(missing)'}`);
  }
  const expected = tutorStubRecipeConfigHash(value.config);
  if (value.configHash !== expected) {
    throw new Error(
      `${source} recipe config hash mismatch: expected ${expected}, received ${value.configHash || '(missing)'}`,
    );
  }
  return deepFreeze({
    schema: value.schema,
    version: value.version,
    createdAt: value.createdAt || null,
    config: canonicalValue(value.config),
    configHash: value.configHash,
  });
}

export function readTutorStubSessionRecipe(filePath) {
  const absolute = path.resolve(filePath);
  const recipe = normalizeTutorStubSessionRecipe(JSON.parse(fs.readFileSync(absolute, 'utf8')), {
    source: absolute,
  });
  return deepFreeze({ ...recipe, filePath: absolute });
}

export function writeTutorStubSessionRecipe({ recipe, filePath }) {
  const normalized = normalizeTutorStubSessionRecipe(recipe);
  const absolute = path.resolve(filePath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8');
  return absolute;
}

export function applyTutorStubRecipeOptions(target, recipe, { optionProvided = () => false } = {}) {
  const normalized = normalizeTutorStubSessionRecipe(recipe);
  const applied = [];
  const explicitOverrides = [];
  for (const [key, value] of Object.entries(normalized.config.options || {})) {
    if (!TUTOR_STUB_RECIPE_OPTION_KEYS.includes(key)) continue;
    if (optionProvided(key)) {
      if (IDENTITY_OPTION_KEYS.has(key) && JSON.stringify(target[key]) !== JSON.stringify(value)) {
        explicitOverrides.push({ axis: key, expected: value, actual: target[key] });
      }
      continue;
    }
    target[key] = value;
    applied.push(key);
  }
  return deepFreeze({ applied, explicitOverrides });
}

function parseTraceEvents(filePath) {
  const events = [];
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/u)) {
    if (!line.trim()) continue;
    try {
      const event = JSON.parse(line);
      if (event && typeof event === 'object') events.push(event);
    } catch (_) {
      // Read-only recovery intentionally keeps later valid JSONL entries usable.
    }
  }
  return events;
}

function turnsFromEvents(events) {
  const turns = [];
  for (const event of events) {
    if (event?.type === 'history_clear') turns.length = 0;
    else if (event?.type === 'turn_complete' && event.turnRecord) turns.push(event.turnRecord);
    else if (
      event?.type === 'tutor_character_restatement_completed' &&
      event?.target?.targetKind === 'tutor_response' &&
      typeof event.text === 'string' &&
      event.text.trim()
    ) {
      const targetTurn = Number(event.target.targetTurn ?? event.turn);
      const turn = [...turns].reverse().find((candidate) => Number(candidate?.turn) === targetTurn);
      if (!turn) continue;
      turn.tutorOriginal = turn.tutorOriginal || turn.tutor || event.previousText || null;
      turn.tutor = event.text;
      turn.characterRestatements = [...(turn.characterRestatements || []), event];
    }
  }
  return turns;
}

function legacyRecipeFromMetadata(metadata = {}) {
  const options = {};
  const assign = (key, value) => {
    if (value !== undefined && value !== null && value !== '') options[key] = value;
  };
  assign('world', metadata.world?.id);
  assign(
    'tutor',
    metadata.tutorInstance?.activeRef || metadata.tutorInstance?.requestedRef || metadata.tutorInstance?.id,
  );
  assign('model', metadata.modelRef);
  assign('classifier-model', metadata.classifier?.classifierModelRef || metadata.classifier?.modelRef);
  assign('learner-record-model', metadata.tutorLearnerDag?.modelRef);
  assign('auto-learner-model', metadata.autoLearner?.modelRef || metadata.mixedLearner?.modelRef);
  const recipe = buildTutorStubSessionRecipe({
    args: options,
    lab: metadata.lab?.id || null,
    createdAt: null,
    identity: {
      schema: metadata.sessionRuntime?.schema || null,
      world: metadata.world?.id ? { id: metadata.world.id } : null,
      prompt: metadata.tutorInstance?.rolePromptHash
        ? { tutorRolePromptHash: metadata.tutorInstance.rolePromptHash }
        : null,
      tutor: metadata.tutorInstance
        ? {
            ref:
              metadata.tutorInstance.activeRef ||
              metadata.tutorInstance.requestedRef ||
              metadata.tutorInstance.id ||
              null,
            rolePromptHash: metadata.tutorInstance.rolePromptHash || null,
          }
        : null,
      models: {
        tutor: metadata.modelRef || null,
        classifier: metadata.classifier?.classifierModelRef || metadata.classifier?.modelRef || null,
        reasoning: metadata.tutorLearnerDag?.modelRef || null,
        learner: metadata.autoLearner?.modelRef || metadata.mixedLearner?.modelRef || null,
      },
    },
  });
  return recipe;
}

export function normalizeTutorStubResumeTrace(filePath) {
  const absolute = path.resolve(filePath);
  const events = parseTraceEvents(absolute);
  const start = events.find((event) => event?.type === 'run_start') || null;
  const turns = turnsFromEvents(events);
  if (!start && !turns.length) {
    throw new Error(`resume trace ${absolute} has no run_start event or resumable turns`);
  }
  const metadata = start?.metadata || {};
  const storedRecipe = metadata.sessionRecipe || metadata.recipe || null;
  const recipe = storedRecipe
    ? normalizeTutorStubSessionRecipe(storedRecipe, { source: `${absolute} run_start` })
    : legacyRecipeFromMetadata(metadata);
  return deepFreeze({
    schema: TUTOR_STUB_RESUME_SOURCE_SCHEMA,
    filePath: absolute,
    runId:
      start?.runId ||
      events.find((event) => event?.type === 'turn_complete' && event.runId)?.runId ||
      path.basename(absolute, '.jsonl'),
    metadata,
    events,
    turns,
    recipe,
    migration: storedRecipe
      ? null
      : {
          mode: 'read_only_normalization',
          from: start ? 'legacy_run_start_metadata' : 'legacy_turn_events',
          to: TUTOR_STUB_SESSION_RECIPE_SCHEMA,
          sourceModified: false,
        },
  });
}

function traceFileForSelector(selector, { traceDir, cwd }) {
  const raw = String(selector || '').trim();
  if (!raw) throw new Error('--resume requires a run id or trace path');
  const direct = path.isAbsolute(raw) ? raw : path.resolve(cwd, raw);
  if (fs.existsSync(direct) && fs.statSync(direct).isFile()) return direct;
  const named = path.resolve(traceDir, raw.endsWith('.jsonl') ? raw : `${raw}.jsonl`);
  if (fs.existsSync(named) && fs.statSync(named).isFile()) return named;
  throw new Error(`resume trace not found for "${raw}"`);
}

export function resolveTutorStubResumeSource(selector, { traceDir = '.tutor-stub-traces', cwd = process.cwd() } = {}) {
  return normalizeTutorStubResumeTrace(traceFileForSelector(selector, { traceDir, cwd }));
}

export function latestTutorStubResumeSource({ traceDir = '.tutor-stub-traces', cwd = process.cwd() } = {}) {
  const absoluteDir = path.isAbsolute(traceDir) ? traceDir : path.resolve(cwd, traceDir);
  if (!fs.existsSync(absoluteDir)) return null;
  const candidates = fs
    .readdirSync(absoluteDir)
    .filter((name) => name.endsWith('.jsonl'))
    .map((name) => path.join(absoluteDir, name))
    .filter((filePath) => fs.statSync(filePath).isFile())
    .map((filePath) => ({ filePath, mtimeMs: fs.statSync(filePath).mtimeMs }))
    .sort((left, right) => right.mtimeMs - left.mtimeMs);
  for (const candidate of candidates) {
    try {
      const source = normalizeTutorStubResumeTrace(candidate.filePath);
      if (source.turns.length) return source;
    } catch (_) {
      // Keep looking; a partial or unrelated JSONL file must not mask a usable trace.
    }
  }
  return null;
}

function comparableIdentity(recipe) {
  const identity = recipe?.config?.identity || {};
  return {
    lab: recipe?.config?.lab || null,
    schema: identity.schema || null,
    world: identity.world?.id || recipe?.config?.options?.world || null,
    prompt: {
      system: identity.prompt?.systemPromptHash || null,
      tutorRole: identity.prompt?.tutorRolePromptHash || null,
    },
    tutor: identity.tutor?.ref || recipe?.config?.options?.tutor || null,
    tutorPrompt: identity.tutor?.rolePromptHash || identity.prompt?.tutorRolePromptHash || null,
    models: identity.models || {
      tutor: recipe?.config?.options?.model || null,
      classifier: recipe?.config?.options?.['classifier-model'] || null,
      reasoning: recipe?.config?.options?.['learner-record-model'] || null,
      learner: recipe?.config?.options?.['auto-learner-model'] || null,
    },
  };
}

function comparableModelIdentity(value) {
  if (typeof value === 'string') {
    const ref = value.trim();
    return ref ? { legacy: true, ref } : null;
  }
  if (!value || typeof value !== 'object') return null;
  const knownFields = ['ref', 'provider', 'model', 'baseUrl', 'cli', 'routingHash'];
  const present = knownFields.filter((key) => Object.hasOwn(value, key));
  if (!present.length) return null;
  return {
    legacy: false,
    present,
    value: Object.fromEntries(present.map((key) => [key, value[key] ?? null])),
  };
}

function modelIdentityProjection(model) {
  if (!model) return null;
  return model.legacy ? model.ref : model.value;
}

function modelIdentitiesMatch(expectedValue, actualValue) {
  const expected = comparableModelIdentity(expectedValue);
  const actual = comparableModelIdentity(actualValue);
  if (!expected) return true;
  if (!actual) return false;
  if (expected.legacy) {
    const actualRef = actual.legacy ? actual.ref : actual.value.ref;
    return expected.ref === actualRef;
  }
  if (actual.legacy) {
    return expected.present.length === 1 && expected.present[0] === 'ref' && expected.value.ref === actual.ref;
  }
  return expected.present.every(
    (key) =>
      Object.hasOwn(actual.value, key) &&
      JSON.stringify(canonicalValue(expected.value[key])) === JSON.stringify(canonicalValue(actual.value[key])),
  );
}

export function compareTutorStubResumeRecipe(sourceRecipe, currentRecipe, { extraDrift = [] } = {}) {
  const source = normalizeTutorStubSessionRecipe(sourceRecipe, { source: 'resume source' });
  const current = normalizeTutorStubSessionRecipe(currentRecipe, { source: 'current session' });
  const expected = comparableIdentity(source);
  const actual = comparableIdentity(current);
  const drift = [...extraDrift];
  const compare = (axis, left, right) => {
    if (left === null || left === undefined || left === '') return;
    if (JSON.stringify(canonicalValue(left)) !== JSON.stringify(canonicalValue(right))) {
      drift.push({ axis, expected: left, actual: right });
    }
  };
  const compareExact = (axis, left, right) => {
    if (JSON.stringify(canonicalValue(left)) !== JSON.stringify(canonicalValue(right))) {
      drift.push({ axis, expected: left, actual: right });
    }
  };
  const compareModel = (axis, left, right) => {
    if (left === null || left === undefined || left === '') return;
    if (!modelIdentitiesMatch(left, right)) {
      drift.push({
        axis,
        expected: modelIdentityProjection(comparableModelIdentity(left)),
        actual: modelIdentityProjection(comparableModelIdentity(right)),
      });
    }
  };
  compare('lab', expected.lab, actual.lab);
  compare('schema', expected.schema, actual.schema);
  compare('world', expected.world, actual.world);
  compare('prompt', expected.prompt?.system, actual.prompt?.system);
  compare('tutor', expected.tutor, actual.tutor);
  compare('tutor_prompt', expected.prompt?.tutorRole, actual.prompt?.tutorRole);
  if (!expected.prompt?.tutorRole) compare('tutor_prompt', expected.tutorPrompt, actual.tutorPrompt);
  for (const role of ['tutor', 'classifier', 'reasoning', 'learner']) {
    compareModel(`model.${role}`, expected.models?.[role], actual.models?.[role]);
  }
  for (const [key, value] of Object.entries(source.config.options || {})) {
    if (IDENTITY_OPTION_KEYS.has(key)) continue;
    compareExact(`option.${key}`, value, current.config.options?.[key]);
  }
  return deepFreeze({
    schema: TUTOR_STUB_RESUME_DRIFT_SCHEMA,
    ok: drift.length === 0,
    sourceConfigHash: source.configHash,
    currentConfigHash: current.configHash,
    drift,
  });
}

export function assertTutorStubResumeCompatibility(report, { acknowledgeDrift = false, context = 'resume' } = {}) {
  if (report?.schema !== TUTOR_STUB_RESUME_DRIFT_SCHEMA) {
    throw new Error(`resume drift report must use ${TUTOR_STUB_RESUME_DRIFT_SCHEMA}`);
  }
  if (report.ok || acknowledgeDrift) return true;
  const axes = report.drift.map((entry) => entry.axis).join(', ');
  const error = new Error(
    `${context} configuration drift on ${axes}; rerun with --acknowledge-drift to proceed explicitly`,
  );
  error.code = 'TUTOR_STUB_RESUME_DRIFT';
  error.drift = report;
  throw error;
}

function shellQuote(value) {
  const raw = String(value ?? '');
  return `'${raw.replaceAll("'", `'\\''`)}'`;
}

export function tutorStubExactRelaunchCommand({ resume = null, recipePath = null, acknowledgeDrift = false } = {}) {
  const args = [];
  if (recipePath) args.push('--recipe', recipePath);
  if (resume) args.push('--resume', resume);
  if (acknowledgeDrift) args.push('--acknowledge-drift');
  if (!args.length) throw new Error('exact relaunch command requires a recipe path or resume trace');
  return `npm run tutor:stub -- ${args.map((value, index) => (index % 2 === 0 && value.startsWith('--') ? value : shellQuote(value))).join(' ')}`;
}
