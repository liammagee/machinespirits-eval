import assert from 'node:assert/strict';
import test from 'node:test';

import {
  TUTOR_STUB_COMMAND_EFFECT_KEYS,
  TUTOR_STUB_COMMAND_REGISTRY,
  TUTOR_STUB_COMMAND_REGISTRY_SCHEMA,
  TUTOR_STUB_COMMAND_REGISTRY_VERSION,
  TUTOR_STUB_NORMAL_SLASH_COMMANDS,
  TUTOR_STUB_PASSTHROUGH_SLASH_COMMANDS,
  TUTOR_STUB_SCENE_RETURN_SLASH_COMMANDS,
  assertTutorStubCommandRegistryInvariants,
  evaluateTutorStubCommandTransportAdmission,
  resolveTutorStubCommand,
  resolveTutorStubCommandId,
  tutorStubCanonicalCommandToken,
  tutorStubCommandAvailable,
  tutorStubCommandCompletionMetadata,
  tutorStubCommandHelpRows,
  tutorStubCommandReturnsToScene,
  tutorStubCommandTokens,
  tutorStubCommandTransportAdmission,
  tutorStubCommandTransportMetadata,
  tutorStubCommandUnavailableReasons,
  tutorStubStaticCommandCompletions,
} from '../services/tutorStubCommandRegistry.js';
import { resolveTutorStubCapabilities } from '../services/tutorStubCapabilities.js';

const NORMAL_COMMANDS = [
  '/demo',
  '/theme',
  '/motion',
  '/random',
  '/light',
  '/committee',
  '/register',
  '/character',
  '/analysis',
  '/a',
  '/field',
  '/f',
  '/viz',
  '/v',
  '/visualization',
  '/clarify',
  '/explain',
  '/c',
  '/translate',
  '/report',
  '/r',
  '/transcript',
  '/html',
  '/voice',
  '/director',
  '/notes',
  '/up',
  '/down',
  '/feedback',
  '/tune',
  '/settings',
  '/status',
  '/features',
  '/release-notes',
  '/debug',
  '/mode',
  '/learner',
  '/coach',
  '/auto',
  '/id',
  '/turn-id',
  '/debug-id',
  '/suggest',
  '/clue',
  '/hint',
  '/profile',
  '/scenario',
  '/board',
  '/use',
  '/accept',
  '/regen',
  '/reset',
  '/clear',
  '/help',
  '/quit',
  '/exit',
  '/lab',
];

const PASSTHROUGH_COMMANDS = [
  '/theme',
  '/motion',
  '/settings',
  '/status',
  '/features',
  '/release-notes',
  '/transcript',
  '/html',
  '/voice',
  '/director',
  '/notes',
  '/scenario',
  '/id',
  '/turn-id',
  '/debug-id',
  '/reset',
  '/clear',
  '/help',
  '/quit',
  '/exit',
  '/lab',
];

const SCENE_RETURN_COMMANDS = [
  '/help',
  '/theme',
  '/motion',
  '/random',
  '/register',
  '/character',
  '/status',
  '/features',
  '/release-notes',
  '/debug',
  '/committee',
  '/settings',
  '/transcript',
  '/html',
  '/voice',
  '/director',
  '/notes',
  '/analysis',
  '/a',
  '/field',
  '/f',
  '/viz',
  '/v',
  '/visualization',
  '/clarify',
  '/explain',
  '/c',
  '/report',
  '/r',
  '/id',
  '/turn-id',
  '/debug-id',
  '/profile',
  '/scenario',
  '/board',
  '/lab',
  '/translate',
  '/light',
];

const NORMAL_SETTINGS_COMPLETIONS = [
  '/settings theme nocturne',
  '/settings theme ember',
  '/settings theme parchment',
  '/settings theme high_contrast',
  '/settings theme mono',
  '/settings motion auto',
  '/settings motion full',
  '/settings motion subtle',
  '/settings motion off',
  '/settings model ',
  '/settings models',
  '/settings models all ',
  '/settings models tutor ',
  '/settings models classifier ',
  '/settings models reasoning ',
  '/settings models learner ',
  '/settings temp ',
  '/settings dropout ',
  '/settings light on',
  '/settings light off',
  '/settings light status',
  '/settings release-speed ',
  '/settings forget',
  '/settings policy add state',
  '/settings policy add field',
  '/settings policy remove state',
  '/settings policy remove field',
  '/settings policy clear',
  '/settings policy threshold ',
];

test('v2 command registry freezes the slash-token and execution-effect surfaces', () => {
  assert.equal(TUTOR_STUB_COMMAND_REGISTRY.schema, TUTOR_STUB_COMMAND_REGISTRY_SCHEMA);
  assert.equal(TUTOR_STUB_COMMAND_REGISTRY.version, TUTOR_STUB_COMMAND_REGISTRY_VERSION);
  assert.equal(TUTOR_STUB_COMMAND_REGISTRY_VERSION, 2);
  assert.equal(TUTOR_STUB_COMMAND_REGISTRY.commands.length, 42);
  assert.equal(TUTOR_STUB_NORMAL_SLASH_COMMANDS.length, 57);
  assert.equal(TUTOR_STUB_PASSTHROUGH_SLASH_COMMANDS.length, 21);
  assert.equal(TUTOR_STUB_SCENE_RETURN_SLASH_COMMANDS.length, 38);
  assert.deepEqual(TUTOR_STUB_NORMAL_SLASH_COMMANDS, NORMAL_COMMANDS);
  assert.deepEqual(TUTOR_STUB_PASSTHROUGH_SLASH_COMMANDS, PASSTHROUGH_COMMANDS);
  assert.deepEqual(TUTOR_STUB_SCENE_RETURN_SLASH_COMMANDS, SCENE_RETURN_COMMANDS);
  assert.equal(Object.isFrozen(TUTOR_STUB_COMMAND_REGISTRY), true);
  assert.equal(Object.isFrozen(TUTOR_STUB_COMMAND_REGISTRY.commands), true);
  assert.equal(Object.isFrozen(TUTOR_STUB_NORMAL_SLASH_COMMANDS), true);
  assert.equal(Object.isFrozen(TUTOR_STUB_PASSTHROUGH_SLASH_COMMANDS), true);
  assert.equal(Object.isFrozen(TUTOR_STUB_SCENE_RETURN_SLASH_COMMANDS), true);
  const handlers = new Set();
  const traceEvents = new Set();
  for (const definition of TUTOR_STUB_COMMAND_REGISTRY.commands) {
    assert.equal(Object.isFrozen(definition), true);
    assert.equal(Object.isFrozen(definition.aliases), true);
    assert.equal(Object.isFrozen(definition.availability), true);
    assert.equal(Object.isFrozen(definition.order), true);
    assert.equal(Object.isFrozen(definition.capabilities), true);
    assert.equal(Object.isFrozen(definition.effects), true);
    assert.equal(Object.isFrozen(definition.transport), true);
    assert.deepEqual(Object.keys(definition.effects), TUTOR_STUB_COMMAND_EFFECT_KEYS);
    assert.equal(
      Object.values(definition.effects).every((value) => typeof value === 'boolean'),
      true,
    );
    assert.equal(handlers.has(definition.handler), false, definition.handler);
    assert.equal(traceEvents.has(definition.traceEvent), false, definition.traceEvent);
    handlers.add(definition.handler);
    traceEvents.add(definition.traceEvent);
  }
  assert.equal(handlers.size, 42);
  assert.equal(traceEvents.size, 42);
  assert.equal(Object.isFrozen(TUTOR_STUB_COMMAND_REGISTRY.helpGroups), true);
  assert.equal(assertTutorStubCommandRegistryInvariants(), true);
});

test('canonical ids and aliases resolve uniquely', () => {
  const seenTokens = new Set();
  const seenIds = new Set();
  for (const definition of TUTOR_STUB_COMMAND_REGISTRY.commands) {
    assert.equal(seenIds.has(definition.id), false, definition.id);
    seenIds.add(definition.id);
    for (const token of [definition.token, ...definition.aliases]) {
      assert.equal(seenTokens.has(token), false, token);
      seenTokens.add(token);
      assert.equal(resolveTutorStubCommand(token), definition);
      assert.equal(resolveTutorStubCommandId(token), definition.id);
      assert.equal(tutorStubCanonicalCommandToken(token), definition.token);
    }
  }
  assert.equal(seenTokens.size, NORMAL_COMMANDS.length);
  assert.equal(resolveTutorStubCommandId('/a'), 'analysis');
  assert.equal(tutorStubCanonicalCommandToken('/html no-open'), '/transcript');
  assert.equal(resolveTutorStubCommandId('visualization'), 'visualization');
  assert.equal(resolveTutorStubCommandId('/board'), 'board');
  assert.equal(resolveTutorStubCommandId('/committee'), 'committee');
  assert.deepEqual(tutorStubStaticCommandCompletions('/committee'), [
    '/committee on',
    '/committee off',
    '/committee status',
  ]);
  assert.deepEqual(tutorStubStaticCommandCompletions('/light'), ['/light on', '/light off', '/light status']);
  assert.equal(tutorStubCommandAvailable('/board'), true);
  assert.equal(tutorStubCommandAvailable('/board', { mode: 'passthrough' }), false);
  assert.equal(tutorStubCommandReturnsToScene('/board'), true);
  assert.deepEqual(tutorStubCommandCompletionMetadata('/board'), {
    dynamicProviders: ['workplan_module_ids'],
  });
  assert.deepEqual(tutorStubStaticCommandCompletions('/translate'), [
    '/translate all',
    '/translate basic',
    '/translate intermediate',
    '/translate advanced',
    '/translate proficient',
  ]);
  assert.equal(resolveTutorStubCommand('/not-a-command'), null);
});

test('command listings are alphabetical after mode and capability filtering', () => {
  assert.deepEqual(tutorStubCommandTokens(), NORMAL_COMMANDS.toSorted());
  assert.deepEqual(tutorStubCommandTokens({ mode: 'passthrough' }), PASSTHROUGH_COMMANDS.toSorted());
  assert.deepEqual(tutorStubCommandTokens({ sceneReturn: true }), SCENE_RETURN_COMMANDS.toSorted());

  const capabilities = resolveTutorStubCapabilities({
    passthrough: false,
    classifier: false,
    learnerDag: false,
    registerSelection: false,
    curriculum: false,
    interactive: true,
    automatedLearner: false,
    mixedLearner: false,
    tuningMode: 'off',
    turnFeedback: false,
    responseChecks: true,
  });
  const filtered = tutorStubCommandTokens({ capabilities });
  assert.deepEqual(filtered, filtered.toSorted());
  for (const row of tutorStubCommandHelpRows({ capabilities })) {
    assert.deepEqual(row.commands, row.commands.toSorted(), row.id);
  }
});

test('transport metadata classifies picker, browser, voice, and relaunch side effects before HTTP exposure', () => {
  assert.deepEqual(tutorStubCommandTransportMetadata('/settings').effects, ['terminal_picker']);
  assert.deepEqual(tutorStubCommandTransportMetadata('/character').effects, ['terminal_picker']);
  assert.deepEqual(tutorStubCommandTransportMetadata('/transcript').effects, ['browser_open']);
  assert.deepEqual(tutorStubCommandTransportMetadata('/voice').effects, ['browser_open', 'voice_device']);
  assert.deepEqual(tutorStubCommandTransportMetadata('/scenario').effects, ['terminal_picker', 'process_relaunch']);
  assert.deepEqual(tutorStubCommandTransportMetadata('/board').effects, ['terminal_picker', 'process_relaunch']);
  assert.deepEqual(tutorStubCommandTransportMetadata('/lab').effects, ['relaunch_instruction']);
  assert.equal(tutorStubCommandTransportMetadata('/status').processHttp, 'blocked_pending_adapter');
  assert.equal(tutorStubCommandTransportMetadata('/not-a-command'), null);
});

test('execution effects conservatively classify every command before transport exposure', () => {
  const commandsWith = (effect) =>
    TUTOR_STUB_COMMAND_REGISTRY.commands.filter((definition) => definition.effects[effect]).map(({ id }) => id);

  assert.deepEqual(commandsWith('modelCall'), [
    'demo',
    'random',
    'light',
    'committee',
    'register',
    'character',
    'clarify',
    'translate',
    'voice',
    'settings',
    'debug',
    'mode',
    'coach',
    'auto',
    'suggest',
    'clue',
    'profile',
    'use',
    'regen',
    'reset',
  ]);
  assert.deepEqual(commandsWith('fileWrite'), [
    'demo',
    'theme',
    'motion',
    'committee',
    'visualization',
    'transcript',
    'voice',
    'feedback_up',
    'feedback_down',
    'feedback',
    'tune',
    'settings',
    'profile',
    'scenario',
    'quit',
  ]);
  assert.deepEqual(commandsWith('persistentMutation'), [
    'demo',
    'theme',
    'motion',
    'random',
    'light',
    'committee',
    'register',
    'character',
    'clarify',
    'voice',
    'feedback_up',
    'feedback_down',
    'feedback',
    'tune',
    'settings',
    'debug',
    'mode',
    'learner',
    'coach',
    'auto',
    'suggest',
    'clue',
    'profile',
    'scenario',
    'board',
    'use',
    'regen',
    'reset',
    'quit',
  ]);
  assert.deepEqual(commandsWith('sessionClear'), ['scenario', 'board', 'reset']);
  assert.deepEqual(commandsWith('processExit'), ['scenario', 'board', 'quit']);
});

test('process HTTP admission fails closed for missing metadata and disallowed effects', () => {
  assert.deepEqual(tutorStubCommandTransportAdmission('/status'), {
    allowed: false,
    reason: 'adapter_unavailable',
    commandId: 'status',
    activeEffects: [],
    disallowedEffects: [],
    detail: null,
  });

  const structuredStatus = {
    ...resolveTutorStubCommand('/status'),
    transport: {
      ...resolveTutorStubCommand('/status').transport,
      processHttp: 'adapter_available',
      noninteractiveAdapter: 'structured',
    },
  };
  assert.equal(evaluateTutorStubCommandTransportAdmission(structuredStatus).allowed, true);
  assert.equal(
    evaluateTutorStubCommandTransportAdmission({
      ...structuredStatus,
      transport: { ...structuredStatus.transport, noninteractiveAdapter: 'none' },
    }).reason,
    'adapter_unavailable',
  );

  const structuredQuit = {
    ...resolveTutorStubCommand('/quit'),
    transport: {
      ...resolveTutorStubCommand('/quit').transport,
      processHttp: 'adapter_available',
      noninteractiveAdapter: 'structured',
    },
  };
  assert.deepEqual(evaluateTutorStubCommandTransportAdmission(structuredQuit).disallowedEffects, [
    'fileWrite',
    'persistentMutation',
    'processExit',
  ]);
  assert.equal(
    evaluateTutorStubCommandTransportAdmission(structuredQuit, {
      allowedEffects: ['fileWrite', 'persistentMutation', 'processExit'],
    }).allowed,
    true,
  );

  const incompleteEffects = { ...structuredStatus, effects: { ...structuredStatus.effects } };
  delete incompleteEffects.effects.processExit;
  assert.equal(evaluateTutorStubCommandTransportAdmission(incompleteEffects).reason, 'invalid_effect_metadata');
  assert.equal(
    evaluateTutorStubCommandTransportAdmission(structuredStatus, { allowedEffects: ['networkWrite'] }).reason,
    'invalid_effect_allowlist',
  );
  assert.equal(evaluateTutorStubCommandTransportAdmission(null).reason, 'unknown_command');
});

test('invariants reject duplicate aliases, handlers, and inconsistent mode metadata', () => {
  const duplicateAliasRegistry = {
    ...TUTOR_STUB_COMMAND_REGISTRY,
    commands: TUTOR_STUB_COMMAND_REGISTRY.commands.map((definition, index) =>
      index === 1 ? { ...definition, aliases: ['/demo'] } : definition,
    ),
  };
  assert.throws(
    () => assertTutorStubCommandRegistryInvariants(duplicateAliasRegistry),
    /duplicate slash command token or alias: \/demo/u,
  );

  const inconsistentModeRegistry = {
    ...TUTOR_STUB_COMMAND_REGISTRY,
    commands: TUTOR_STUB_COMMAND_REGISTRY.commands.map((definition, index) =>
      index === 0 ? { ...definition, availability: { ...definition.availability, passthrough: true } } : definition,
    ),
  };
  assert.throws(
    () => assertTutorStubCommandRegistryInvariants(inconsistentModeRegistry),
    /passthrough availability\/order drift/u,
  );

  const duplicateHandlerRegistry = {
    ...TUTOR_STUB_COMMAND_REGISTRY,
    commands: TUTOR_STUB_COMMAND_REGISTRY.commands.map((definition, index) =>
      index === 1 ? { ...definition, handler: TUTOR_STUB_COMMAND_REGISTRY.commands[0].handler } : definition,
    ),
  };
  assert.throws(() => assertTutorStubCommandRegistryInvariants(duplicateHandlerRegistry), /duplicate command handler/u);

  const incompleteEffectRegistry = {
    ...TUTOR_STUB_COMMAND_REGISTRY,
    commands: TUTOR_STUB_COMMAND_REGISTRY.commands.map((definition, index) =>
      index === 0
        ? {
            ...definition,
            effects: Object.fromEntries(Object.entries(definition.effects).filter(([key]) => key !== 'modelCall')),
          }
        : definition,
    ),
  };
  assert.throws(
    () => assertTutorStubCommandRegistryInvariants(incompleteEffectRegistry),
    /invalid execution effects: missing modelCall/u,
  );
});

test('scene-return and passthrough views agree for every shared command and alias', () => {
  const passthroughSceneCommands = PASSTHROUGH_COMMANDS.filter((token) => tutorStubCommandReturnsToScene(token));
  const sceneCommandsAvailableInPassthrough = SCENE_RETURN_COMMANDS.filter((token) =>
    tutorStubCommandAvailable(token, { mode: 'passthrough' }),
  );
  assert.deepEqual(passthroughSceneCommands.toSorted(), sceneCommandsAvailableInPassthrough.toSorted());
  assert.deepEqual(
    tutorStubCommandTokens({ mode: 'passthrough', sceneReturn: true }).toSorted(),
    sceneCommandsAvailableInPassthrough.toSorted(),
  );
  assert.deepEqual(
    PASSTHROUGH_COMMANDS.filter((token) => !tutorStubCommandReturnsToScene(token)),
    ['/reset', '/clear', '/quit', '/exit'],
  );
});

test('passthrough settings completions expose only speaker model, theme, and motion', () => {
  assert.deepEqual(tutorStubStaticCommandCompletions('/settings', { mode: 'normal' }), NORMAL_SETTINGS_COMPLETIONS);
  const passthrough = tutorStubStaticCommandCompletions('/settings ', { mode: 'passthrough' });
  assert.deepEqual(passthrough, [
    '/settings theme nocturne',
    '/settings theme ember',
    '/settings theme parchment',
    '/settings theme high_contrast',
    '/settings theme mono',
    '/settings motion auto',
    '/settings motion full',
    '/settings motion subtle',
    '/settings motion off',
    '/settings model ',
  ]);
  assert.equal(Object.isFrozen(passthrough), true);
  assert.ok(passthrough.every((candidate) => /^\/settings (?:model |theme |motion )/u.test(candidate)));
  assert.ok(
    passthrough.every((candidate) => !/(?:models|temp|dropout|light|release-speed|forget|policy)/u.test(candidate)),
  );
});

test('resolved capabilities filter commands, completions, and generated help without changing frozen catalog views', () => {
  const direct = resolveTutorStubCapabilities({
    interactive: true,
    world: true,
    classifier: true,
    registerSelection: true,
    turnFeedback: true,
    trace: true,
    learningSummary: true,
    responseChecks: true,
  });
  assert.equal(tutorStubCommandAvailable('/random', { capabilities: direct }), true);
  assert.equal(tutorStubCommandAvailable('/light', { capabilities: direct }), true);
  assert.equal(tutorStubCommandAvailable('/committee', { capabilities: direct }), true);
  assert.equal(tutorStubCommandAvailable('/coach', { capabilities: direct }), true);
  assert.equal(tutorStubCommandAvailable('/suggest', { capabilities: direct }), false);
  assert.equal(tutorStubCommandAvailable('/translate', { capabilities: direct }), false);
  assert.deepEqual(tutorStubCommandUnavailableReasons('/suggest', { capabilities: direct }), [
    'mixed learner drafting is not active',
  ]);
  assert.ok(!tutorStubCommandTokens({ capabilities: direct }).includes('/suggest'));
  assert.deepEqual(tutorStubStaticCommandCompletions('/profile', { capabilities: direct }), []);
  assert.ok(tutorStubCommandHelpRows({ capabilities: direct }).some((row) => row.id === 'take_part'));
  assert.ok(!tutorStubCommandHelpRows({ capabilities: direct }).some((row) => row.commands.includes('/profile [id]')));
  assert.deepEqual(tutorStubCommandTokens(), NORMAL_COMMANDS.toSorted());

  const mixed = resolveTutorStubCapabilities({
    interactive: true,
    world: true,
    classifier: true,
    registerSelection: true,
    mixedLearner: true,
    turnFeedback: true,
    trace: true,
    learningSummary: true,
    responseChecks: true,
  });
  assert.equal(tutorStubCommandAvailable('/suggest', { capabilities: mixed }), true);
  assert.equal(tutorStubCommandAvailable('/profile', { capabilities: mixed }), true);
  assert.ok(tutorStubCommandTokens({ capabilities: mixed }).includes('/accept'));
  assert.ok(tutorStubCommandHelpRows({ capabilities: mixed }).some((row) => row.commands.includes('/profile [id]')));

  const curriculum = resolveTutorStubCapabilities({
    interactive: true,
    curriculum: true,
    turnFeedback: true,
    trace: true,
    learningSummary: true,
    responseChecks: true,
  });
  assert.equal(tutorStubCommandAvailable('/translate', { capabilities: curriculum }), true);
  assert.ok(tutorStubCommandTokens({ capabilities: curriculum }).includes('/translate'));
  assert.ok(
    tutorStubCommandHelpRows({ capabilities: curriculum }).some((row) => row.commands.includes('/translate [level]')),
  );

  const passthrough = resolveTutorStubCapabilities({ passthrough: true, trace: true });
  assert.equal(tutorStubCommandAvailable('/committee', { mode: 'passthrough', capabilities: passthrough }), false);
  assert.deepEqual(
    tutorStubCommandTokens({ mode: 'passthrough', capabilities: passthrough }),
    PASSTHROUGH_COMMANDS.toSorted(),
  );
  assert.deepEqual(
    tutorStubCommandHelpRows({ mode: 'passthrough', capabilities: passthrough }).map((row) => row.id),
    ['model', 'inspect', 'appearance', 'setup', 'finish_passthrough'],
  );
});
