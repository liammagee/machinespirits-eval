import { TUTOR_STUB_CLI_MOTION_IDS, TUTOR_STUB_CLI_THEME_IDS } from './tutorStubCliTheme.js';
import { TUTOR_STUB_VOICE_MODELS } from './tutorStubVoiceBridge.js';

export const TUTOR_STUB_COMMAND_REGISTRY_SCHEMA = 'machinespirits.tutor-stub.command-registry.v1';
export const TUTOR_STUB_COMMAND_REGISTRY_VERSION = 1;
export const TUTOR_STUB_COMMAND_MODES = Object.freeze(['normal', 'passthrough']);

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
}

function command({
  id,
  token,
  aliases = [],
  passthroughOrder = null,
  sceneReturnOrder = null,
  completion = null,
}) {
  return {
    id,
    token,
    aliases,
    availability: {
      normal: true,
      passthrough: Number.isInteger(passthroughOrder),
    },
    order: {
      passthrough: passthroughOrder,
      sceneReturn: sceneReturnOrder,
    },
    sceneReturn: Number.isInteger(sceneReturnOrder),
    completion,
  };
}

const COMMANDS = [
  command({ id: 'demo', token: '/demo', completion: { normal: { suffixes: ['1', '3', '5'] } } }),
  command({
    id: 'theme',
    token: '/theme',
    passthroughOrder: 0,
    sceneReturnOrder: 1,
    completion: { normal: { suffixes: [...TUTOR_STUB_CLI_THEME_IDS] } },
  }),
  command({
    id: 'motion',
    token: '/motion',
    passthroughOrder: 1,
    sceneReturnOrder: 2,
    completion: { normal: { suffixes: [...TUTOR_STUB_CLI_MOTION_IDS] } },
  }),
  command({
    id: 'random',
    token: '/random',
    sceneReturnOrder: 3,
    completion: { normal: { suffixes: ['on', 'off', 'status'] } },
  }),
  command({
    id: 'register',
    token: '/register',
    sceneReturnOrder: 4,
    completion: { normal: { suffixes: ['auto', 'status'], dynamicProviders: ['register_palette'] } },
  }),
  command({
    id: 'character',
    token: '/character',
    sceneReturnOrder: 5,
    completion: { normal: { suffixes: ['auto', 'status'], dynamicProviders: ['actorial_parts'] } },
  }),
  command({
    id: 'analysis',
    token: '/analysis',
    aliases: ['/a'],
    sceneReturnOrder: 16,
    completion: { normal: { suffixes: ['technical'] } },
  }),
  command({ id: 'field', token: '/field', aliases: ['/f'], sceneReturnOrder: 17 }),
  command({
    id: 'visualization',
    token: '/viz',
    aliases: ['/v', '/visualization'],
    sceneReturnOrder: 18,
  }),
  command({
    id: 'clarify',
    token: '/clarify',
    aliases: ['/explain', '/c'],
    sceneReturnOrder: 19,
  }),
  command({ id: 'report', token: '/report', aliases: ['/r'], sceneReturnOrder: 20 }),
  command({
    id: 'transcript',
    token: '/transcript',
    aliases: ['/html'],
    passthroughOrder: 6,
    sceneReturnOrder: 12,
    completion: { normal: { suffixes: ['no-open', 'write'] } },
  }),
  command({
    id: 'voice',
    token: '/voice',
    passthroughOrder: 7,
    sceneReturnOrder: 13,
    completion: {
      normal: {
        suffixes: [
          'on',
          'open',
          'status',
          'off',
          ...TUTOR_STUB_VOICE_MODELS.map((model) => `model ${model}`),
          'speaker marin',
        ],
      },
    },
  }),
  command({
    id: 'director',
    token: '/director',
    aliases: ['/notes'],
    passthroughOrder: 8,
    sceneReturnOrder: 14,
  }),
  command({
    id: 'feedback_up',
    token: '/up',
    completion: { normal: { dynamicProviders: ['positive_feedback_reasons'] } },
  }),
  command({
    id: 'feedback_down',
    token: '/down',
    completion: { normal: { dynamicProviders: ['feedback_reasons'] } },
  }),
  command({
    id: 'feedback',
    token: '/feedback',
    completion: {
      normal: {
        suffixes: ['up', 'down', 'clear', 'on', 'off'],
        dynamicProviders: ['feedback_reasons'],
      },
    },
  }),
  command({
    id: 'tune',
    token: '/tune',
    completion: {
      normal: {
        suffixes: [
          'status',
          'on',
          'capture',
          'off',
          'canary',
          'reasons',
          'note ',
          'review',
          'show ',
          'approve ',
          'reject ',
          'replay ',
          'validate ',
          'promote ',
          'rollback',
        ],
      },
    },
  }),
  command({
    id: 'settings',
    token: '/settings',
    passthroughOrder: 2,
    sceneReturnOrder: 11,
    completion: {
      normal: {
        suffixes: [
          ...TUTOR_STUB_CLI_THEME_IDS.map((theme) => `theme ${theme}`),
          ...TUTOR_STUB_CLI_MOTION_IDS.map((motion) => `motion ${motion}`),
          'model ',
          'models',
          'models all ',
          'models tutor ',
          'models classifier ',
          'models reasoning ',
          'models learner ',
          'temp ',
          'dropout ',
          'release-speed ',
          'forget',
          'policy add state',
          'policy add field',
          'policy remove state',
          'policy remove field',
          'policy clear',
          'policy threshold ',
        ],
        dynamicProviders: ['tutor_model_refs'],
      },
      passthrough: {
        suffixes: [
          ...TUTOR_STUB_CLI_THEME_IDS.map((theme) => `theme ${theme}`),
          ...TUTOR_STUB_CLI_MOTION_IDS.map((motion) => `motion ${motion}`),
          'model ',
        ],
        dynamicProviders: ['tutor_model_refs'],
      },
    },
  }),
  command({ id: 'status', token: '/status', passthroughOrder: 3, sceneReturnOrder: 6 }),
  command({ id: 'features', token: '/features', passthroughOrder: 4, sceneReturnOrder: 7 }),
  command({
    id: 'release_notes',
    token: '/release-notes',
    passthroughOrder: 5,
    sceneReturnOrder: 8,
  }),
  command({
    id: 'debug',
    token: '/debug',
    sceneReturnOrder: 9,
    completion: {
      normal: {
        suffixes: [
          'on',
          'on prose',
          'on technical',
          'off',
          'show',
          'show prose',
          'show technical',
          'technical',
        ],
      },
    },
  }),
  command({
    id: 'mode',
    token: '/mode',
    completion: { normal: { suffixes: ['learner', 'coach', 'auto'] } },
  }),
  command({ id: 'learner', token: '/learner' }),
  command({ id: 'coach', token: '/coach' }),
  command({ id: 'auto', token: '/auto' }),
  command({
    id: 'id',
    token: '/id',
    aliases: ['/turn-id', '/debug-id'],
    passthroughOrder: 10,
    sceneReturnOrder: 21,
  }),
  command({ id: 'suggest', token: '/suggest' }),
  command({ id: 'clue', token: '/clue', aliases: ['/hint'] }),
  command({
    id: 'profile',
    token: '/profile',
    sceneReturnOrder: 22,
    completion: {
      normal: {
        suffixes: ['list', 'list stress', 'list all', 'example', 'default', 'custom '],
        dynamicProviders: ['learner_profile_ids'],
      },
    },
  }),
  command({
    id: 'scenario',
    token: '/scenario',
    passthroughOrder: 9,
    sceneReturnOrder: 23,
    completion: { normal: { dynamicProviders: ['world_ids'] } },
  }),
  command({ id: 'use', token: '/use', aliases: ['/accept'] }),
  command({ id: 'regen', token: '/regen' }),
  command({ id: 'reset', token: '/reset', aliases: ['/clear'], passthroughOrder: 11 }),
  command({ id: 'help', token: '/help', passthroughOrder: 12, sceneReturnOrder: 0 }),
  command({ id: 'quit', token: '/quit', aliases: ['/exit'], passthroughOrder: 13 }),
];

export const TUTOR_STUB_COMMAND_REGISTRY = deepFreeze({
  schema: TUTOR_STUB_COMMAND_REGISTRY_SCHEMA,
  version: TUTOR_STUB_COMMAND_REGISTRY_VERSION,
  commands: COMMANDS,
});

const COMMAND_BY_TOKEN = new Map();
const COMMAND_BY_ID = new Map();
for (const definition of TUTOR_STUB_COMMAND_REGISTRY.commands) {
  COMMAND_BY_ID.set(definition.id, definition);
  for (const token of [definition.token, ...definition.aliases]) COMMAND_BY_TOKEN.set(token, definition);
}

function normalizedMode(mode) {
  const value = String(mode || 'normal').trim().toLowerCase();
  if (!TUTOR_STUB_COMMAND_MODES.includes(value)) {
    throw new Error(`command mode must be one of: ${TUTOR_STUB_COMMAND_MODES.join(', ')}`);
  }
  return value;
}

function commandToken(value) {
  return String(value || '')
    .trimStart()
    .split(/\s+/u)[0];
}

function orderedTokens(definitions, orderKey = null) {
  const ordered = orderKey
    ? definitions
        .filter((definition) => Number.isInteger(definition.order[orderKey]))
        .toSorted((left, right) => left.order[orderKey] - right.order[orderKey])
    : definitions;
  return ordered.flatMap((definition) => [definition.token, ...definition.aliases]);
}

export const TUTOR_STUB_NORMAL_SLASH_COMMANDS = Object.freeze(
  orderedTokens(TUTOR_STUB_COMMAND_REGISTRY.commands),
);
export const TUTOR_STUB_PASSTHROUGH_SLASH_COMMANDS = Object.freeze(
  orderedTokens(TUTOR_STUB_COMMAND_REGISTRY.commands, 'passthrough'),
);
export const TUTOR_STUB_SCENE_RETURN_SLASH_COMMANDS = Object.freeze(
  orderedTokens(TUTOR_STUB_COMMAND_REGISTRY.commands, 'sceneReturn'),
);

export function resolveTutorStubCommand(value) {
  const token = commandToken(value);
  return COMMAND_BY_TOKEN.get(token) || COMMAND_BY_ID.get(token) || null;
}

export function resolveTutorStubCommandId(value) {
  return resolveTutorStubCommand(value)?.id || null;
}

export function tutorStubCanonicalCommandToken(value) {
  return resolveTutorStubCommand(value)?.token || null;
}

export function tutorStubCommandAvailable(value, { mode = 'normal' } = {}) {
  const definition = resolveTutorStubCommand(value);
  return Boolean(definition?.availability[normalizedMode(mode)]);
}

export function tutorStubCommandReturnsToScene(value) {
  return resolveTutorStubCommand(value)?.sceneReturn === true;
}

export function tutorStubCommandTokens({ mode = 'normal', sceneReturn = false } = {}) {
  const normalized = normalizedMode(mode);
  const source = sceneReturn
    ? TUTOR_STUB_SCENE_RETURN_SLASH_COMMANDS
    : normalized === 'passthrough'
      ? TUTOR_STUB_PASSTHROUGH_SLASH_COMMANDS
      : TUTOR_STUB_NORMAL_SLASH_COMMANDS;
  if (!sceneReturn || normalized === 'normal') return source;
  return Object.freeze(source.filter((token) => tutorStubCommandAvailable(token, { mode: normalized })));
}

export function tutorStubStaticCommandCompletions(value, { mode = 'normal' } = {}) {
  const normalized = normalizedMode(mode);
  const definition = resolveTutorStubCommand(value);
  if (!definition?.availability[normalized]) return Object.freeze([]);
  const metadata = definition.completion?.[normalized] || definition.completion?.normal || null;
  const token = commandToken(value);
  return Object.freeze((metadata?.suffixes || []).map((suffix) => `${token} ${suffix}`));
}

export function tutorStubCommandCompletionMetadata(value, { mode = 'normal' } = {}) {
  const normalized = normalizedMode(mode);
  const definition = resolveTutorStubCommand(value);
  if (!definition?.availability[normalized]) return null;
  return definition.completion?.[normalized] || definition.completion?.normal || null;
}

export function assertTutorStubCommandRegistryInvariants(registry = TUTOR_STUB_COMMAND_REGISTRY) {
  if (registry?.schema !== TUTOR_STUB_COMMAND_REGISTRY_SCHEMA) {
    throw new Error(`command registry schema must be ${TUTOR_STUB_COMMAND_REGISTRY_SCHEMA}`);
  }
  if (registry?.version !== TUTOR_STUB_COMMAND_REGISTRY_VERSION) {
    throw new Error(`command registry version must be ${TUTOR_STUB_COMMAND_REGISTRY_VERSION}`);
  }
  if (!Array.isArray(registry.commands) || !registry.commands.length) {
    throw new Error('command registry must contain commands');
  }

  const ids = new Set();
  const tokens = new Set();
  const definitionsByToken = new Map();
  const orders = { passthrough: new Set(), sceneReturn: new Set() };
  for (const definition of registry.commands) {
    if (!/^[a-z][a-z0-9_]*$/u.test(definition.id || '')) {
      throw new Error(`invalid canonical command id: ${definition.id}`);
    }
    if (ids.has(definition.id)) throw new Error(`duplicate canonical command id: ${definition.id}`);
    ids.add(definition.id);

    const commandTokens = [definition.token, ...(definition.aliases || [])];
    for (const token of commandTokens) {
      if (!/^\/[^\s/]+$/u.test(token || '')) throw new Error(`invalid slash command token: ${token}`);
      if (tokens.has(token)) throw new Error(`duplicate slash command token or alias: ${token}`);
      tokens.add(token);
      definitionsByToken.set(token, definition);
    }

    if (definition.availability?.normal !== true) {
      throw new Error(`normal mode must include command: ${definition.id}`);
    }
    if (definition.availability?.passthrough !== Number.isInteger(definition.order?.passthrough)) {
      throw new Error(`passthrough availability/order drift for command: ${definition.id}`);
    }
    if (definition.sceneReturn !== Number.isInteger(definition.order?.sceneReturn)) {
      throw new Error(`scene-return flag/order drift for command: ${definition.id}`);
    }
    for (const orderKey of Object.keys(orders)) {
      const order = definition.order?.[orderKey];
      if (!Number.isInteger(order)) continue;
      if (orders[orderKey].has(order)) throw new Error(`duplicate ${orderKey} command order: ${order}`);
      orders[orderKey].add(order);
    }

    for (const [mode, metadata] of Object.entries(definition.completion || {})) {
      normalizedMode(mode);
      if (!definition.availability?.[mode]) {
        throw new Error(`completion metadata exists for unavailable ${mode} command: ${definition.id}`);
      }
      const suffixes = metadata?.suffixes || [];
      if (!Array.isArray(suffixes) || suffixes.some((suffix) => typeof suffix !== 'string' || !suffix)) {
        throw new Error(`invalid static completion suffixes for command: ${definition.id}`);
      }
      if (new Set(suffixes).size !== suffixes.length) {
        throw new Error(`duplicate static completion suffix for command: ${definition.id}`);
      }
      const providers = metadata?.dynamicProviders || [];
      if (!Array.isArray(providers) || providers.some((provider) => typeof provider !== 'string' || !provider)) {
        throw new Error(`invalid dynamic completion providers for command: ${definition.id}`);
      }
    }
  }

  const passthroughTokens = orderedTokens(registry.commands, 'passthrough');
  const sceneReturnTokens = orderedTokens(registry.commands, 'sceneReturn');
  const passthroughSceneTokens = passthroughTokens.filter(
    (token) => definitionsByToken.get(token)?.sceneReturn === true,
  );
  const scenePassthroughTokens = sceneReturnTokens.filter(
    (token) => definitionsByToken.get(token)?.availability?.passthrough === true,
  );
  if (
    passthroughSceneTokens.length !== scenePassthroughTokens.length ||
    passthroughSceneTokens.some((token) => !scenePassthroughTokens.includes(token))
  ) {
    throw new Error('passthrough and scene-return command surfaces are inconsistent');
  }
  return true;
}

assertTutorStubCommandRegistryInvariants();
