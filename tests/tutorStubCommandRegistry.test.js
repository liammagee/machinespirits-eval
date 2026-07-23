import assert from 'node:assert/strict';
import test from 'node:test';

import {
  TUTOR_STUB_COMMAND_REGISTRY,
  TUTOR_STUB_COMMAND_REGISTRY_SCHEMA,
  TUTOR_STUB_COMMAND_REGISTRY_VERSION,
  TUTOR_STUB_NORMAL_SLASH_COMMANDS,
  TUTOR_STUB_PASSTHROUGH_SLASH_COMMANDS,
  TUTOR_STUB_SCENE_RETURN_SLASH_COMMANDS,
  assertTutorStubCommandRegistryInvariants,
  resolveTutorStubCommand,
  resolveTutorStubCommandId,
  tutorStubCanonicalCommandToken,
  tutorStubCommandAvailable,
  tutorStubCommandCompletionMetadata,
  tutorStubCommandReturnsToScene,
  tutorStubCommandTokens,
  tutorStubStaticCommandCompletions,
} from '../services/tutorStubCommandRegistry.js';

const NORMAL_COMMANDS = [
  '/demo',
  '/theme',
  '/motion',
  '/random',
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
  '/settings release-speed ',
  '/settings forget',
  '/settings policy add state',
  '/settings policy add field',
  '/settings policy remove state',
  '/settings policy remove field',
  '/settings policy clear',
  '/settings policy threshold ',
];

test('v1 command registry freezes the three existing slash-token surfaces', () => {
  assert.equal(TUTOR_STUB_COMMAND_REGISTRY.schema, TUTOR_STUB_COMMAND_REGISTRY_SCHEMA);
  assert.equal(TUTOR_STUB_COMMAND_REGISTRY.version, TUTOR_STUB_COMMAND_REGISTRY_VERSION);
  assert.equal(TUTOR_STUB_COMMAND_REGISTRY_VERSION, 1);
  assert.equal(TUTOR_STUB_COMMAND_REGISTRY.commands.length, 38);
  assert.equal(TUTOR_STUB_NORMAL_SLASH_COMMANDS.length, 53);
  assert.equal(TUTOR_STUB_PASSTHROUGH_SLASH_COMMANDS.length, 20);
  assert.equal(TUTOR_STUB_SCENE_RETURN_SLASH_COMMANDS.length, 34);
  assert.deepEqual(TUTOR_STUB_NORMAL_SLASH_COMMANDS, NORMAL_COMMANDS);
  assert.deepEqual(TUTOR_STUB_PASSTHROUGH_SLASH_COMMANDS, PASSTHROUGH_COMMANDS);
  assert.deepEqual(TUTOR_STUB_SCENE_RETURN_SLASH_COMMANDS, SCENE_RETURN_COMMANDS);
  assert.equal(Object.isFrozen(TUTOR_STUB_COMMAND_REGISTRY), true);
  assert.equal(Object.isFrozen(TUTOR_STUB_COMMAND_REGISTRY.commands), true);
  assert.equal(Object.isFrozen(TUTOR_STUB_NORMAL_SLASH_COMMANDS), true);
  assert.equal(Object.isFrozen(TUTOR_STUB_PASSTHROUGH_SLASH_COMMANDS), true);
  assert.equal(Object.isFrozen(TUTOR_STUB_SCENE_RETURN_SLASH_COMMANDS), true);
  for (const definition of TUTOR_STUB_COMMAND_REGISTRY.commands) {
    assert.equal(Object.isFrozen(definition), true);
    assert.equal(Object.isFrozen(definition.aliases), true);
    assert.equal(Object.isFrozen(definition.availability), true);
    assert.equal(Object.isFrozen(definition.order), true);
  }
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
  assert.equal(tutorStubCommandAvailable('/board'), true);
  assert.equal(tutorStubCommandAvailable('/board', { mode: 'passthrough' }), false);
  assert.equal(tutorStubCommandReturnsToScene('/board'), true);
  assert.deepEqual(tutorStubCommandCompletionMetadata('/board'), {
    dynamicProviders: ['workplan_module_ids'],
  });
  assert.equal(resolveTutorStubCommand('/not-a-command'), null);
});

test('invariants reject duplicate aliases and inconsistent mode metadata', () => {
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
  assert.ok(passthrough.every((candidate) => !/(?:models|temp|dropout|release-speed|forget|policy)/u.test(candidate)));
});
