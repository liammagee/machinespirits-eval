import assert from 'node:assert/strict';
import fs from 'node:fs';
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
  tutorStubCommandSummary,
  tutorStubCommandTokens,
  tutorStubCommandTransportAdmission,
  tutorStubCommandTransportMetadata,
  tutorStubCommandUnavailableReasons,
  tutorStubStaticCommandCompletions,
} from '../services/tutorStubCommandRegistry.js';
import { resolveTutorStubCapabilities } from '../services/tutorStubCapabilities.js';
import {
  clearTutorStubDirectorGuidance,
  createTutorStubDirectorGuidanceState,
  mergeConcurrentTutorStubDirectorGuidance,
  restoreTutorStubDirectorGuidanceState,
  setTutorStubDirectorGuidance,
  tutorStubDirectorGuidancePrompt,
} from '../services/tutorStubDirectorGuidance.js';
import {
  TUTOR_STUB_CLI_DIRECTOR_SCHEMA,
  buildTutorStubCliDirectorPrompt,
  cleanTutorStubCliDirectorReply,
  normalizeTutorStubCliDirectorQuestion,
} from '../services/tutorStubCliDirector.js';

const NORMAL_COMMANDS = [
  '/demo',
  '/theme',
  '/motion',
  '/details',
  '/random',
  '/light',
  '/committee',
  '/register',
  '/character',
  '/tutor',
  '/learner',
  '/analysis',
  '/a',
  '/proof',
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
  '/meta',
  '/up',
  '/down',
  '/feedback',
  '/tune',
  '/settings',
  '/status',
  '/features',
  '/release-notes',
  '/metrics',
  '/debug',
  '/mode',
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
  '/module',
  '/next',
  '/progress',
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
  '/details',
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
  '/metrics',
];

const SCENE_RETURN_COMMANDS = [
  '/help',
  '/theme',
  '/motion',
  '/random',
  '/register',
  '/character',
  '/tutor',
  '/learner',
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
  '/meta',
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
  '/details',
  '/proof',
  '/metrics',
  '/module',
  '/next',
  '/progress',
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
  '/settings training-reuse on',
  '/settings training-reuse off',
  '/settings training-reuse status',
  '/settings release-speed ',
  '/settings forget',
  '/settings policy add state',
  '/settings policy add field',
  '/settings policy remove state',
  '/settings policy remove field',
  '/settings policy clear',
  '/settings policy threshold ',
];

test('director guidance is a bounded private control with turn-aware and concurrent semantics', () => {
  const baseline = createTutorStubDirectorGuidanceState();
  const attempt = createTutorStubDirectorGuidanceState(baseline);
  const current = createTutorStubDirectorGuidanceState(baseline);
  const entry = setTutorStubDirectorGuidance(current, 'Use shorter\n replies with less jargon.', {
    effectiveFromTurn: 2,
    source: '/meta',
    now: new Date('2026-07-24T00:00:00.000Z'),
  });
  assert.equal(entry.text, 'Use shorter replies with less jargon.');
  assert.equal(tutorStubDirectorGuidancePrompt(current, { tutorTurn: 1 }), '');
  const prompt = tutorStubDirectorGuidancePrompt(current, { tutorTurn: 2 });
  assert.match(prompt, /request to change how the tutor responds, not public learner speech/u);
  assert.match(prompt, /Use shorter replies with less jargon\./u);
  assert.match(prompt, /cannot change the inquiry, facts, evidence-release schedule, proof state/u);

  const merged = mergeConcurrentTutorStubDirectorGuidance(attempt, baseline, current);
  assert.equal(merged.active.text, entry.text);
  assert.notEqual(merged, current);
  const cleared = clearTutorStubDirectorGuidance(merged, {
    now: new Date('2026-07-24T00:01:00.000Z'),
  });
  assert.equal(cleared.text, entry.text);
  assert.equal(merged.active, null);
  assert.equal(merged.history.at(-1).action, 'clear');
});

test('director-guidance restoration preserves clear boundaries, latest precedence, reset, and cloning', () => {
  const beforeClear = { revision: 1, active: { text: 'before' }, history: [{ action: 'set' }] };
  const afterClear = { revision: 3, active: { text: 'after' }, history: [{ action: 'set' }] };
  const latest = { revision: 4, active: null, history: [{ action: 'clear' }] };
  const state = {};
  assert.deepEqual(
    restoreTutorStubDirectorGuidanceState(state, [
      { directorGuidance: beforeClear },
      { type: 'history_clear' },
      { directorGuidance: afterClear },
      { directorGuidance: latest },
    ]),
    { restored: true, revision: 4, active: false },
  );
  assert.notEqual(state.directorGuidance, latest);
  assert.notEqual(state.directorGuidance.history, latest.history);

  assert.deepEqual(
    restoreTutorStubDirectorGuidanceState(state, [{ directorGuidance: beforeClear }, { type: 'history_clear' }]),
    { restored: false, revision: 0, active: false },
  );
  assert.equal(state.directorGuidance.schema, 'machinespirits.tutor-stub.director-guidance.v1');
});

test('the CLI imports rather than redeclares director-guidance restoration', () => {
  const source = fs.readFileSync(new URL('../scripts/tutor-stub.js', import.meta.url), 'utf8');
  assert.match(source, /restoreTutorStubDirectorGuidanceState as restoreDirectorGuidanceState/u);
  assert.doesNotMatch(source, /function restoreDirectorGuidanceState\(/u);
});

test('v10 command registry freezes the slash-token and execution-effect surfaces', () => {
  assert.equal(TUTOR_STUB_COMMAND_REGISTRY.schema, TUTOR_STUB_COMMAND_REGISTRY_SCHEMA);
  assert.equal(TUTOR_STUB_COMMAND_REGISTRY.version, TUTOR_STUB_COMMAND_REGISTRY_VERSION);
  assert.equal(TUTOR_STUB_COMMAND_REGISTRY_VERSION, 10);
  assert.equal(TUTOR_STUB_COMMAND_REGISTRY.commands.length, 48);
  assert.equal(TUTOR_STUB_NORMAL_SLASH_COMMANDS.length, 65);
  assert.equal(TUTOR_STUB_PASSTHROUGH_SLASH_COMMANDS.length, 23);
  assert.equal(TUTOR_STUB_SCENE_RETURN_SLASH_COMMANDS.length, 47);
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
    assert.equal(typeof definition.summary, 'string');
    assert.ok(definition.summary.length > 12, definition.id);
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
  assert.equal(handlers.size, 48);
  assert.equal(traceEvents.size, 48);
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
  assert.equal(resolveTutorStubCommandId('/module'), 'module');
  assert.equal(resolveTutorStubCommandId('/next'), 'next');
  assert.equal(resolveTutorStubCommandId('/progress'), 'progress');
  assert.equal(resolveTutorStubCommandId('/committee'), 'committee');
  assert.equal(resolveTutorStubCommandId('/tutor'), 'character');
  assert.equal(resolveTutorStubCommandId('/learner'), 'character');
  assert.equal(tutorStubCanonicalCommandToken('/tutor'), '/character');
  assert.equal(tutorStubCanonicalCommandToken('/learner'), '/character');
  assert.equal(resolveTutorStubCommandId('/proof'), 'proof');
  assert.equal(resolveTutorStubCommandId('/metrics'), 'repository_metrics');
  assert.deepEqual(tutorStubStaticCommandCompletions('/committee'), [
    '/committee on',
    '/committee off',
    '/committee status',
  ]);
  assert.deepEqual(tutorStubStaticCommandCompletions('/next'), ['/next pass', '/next revise']);
  assert.deepEqual(tutorStubStaticCommandCompletions('/light'), ['/light on', '/light off', '/light status']);
  assert.deepEqual(tutorStubStaticCommandCompletions('/proof'), [
    '/proof check',
    '/proof check lean',
    '/proof check semantic',
    '/proof inspect',
    '/proof inspect authored',
    '/proof inspect learner',
    '/proof inspect tutor',
    '/proof export',
    '/proof paths',
  ]);
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
  assert.deepEqual(tutorStubStaticCommandCompletions('/director'), ['/director ask ']);
  assert.deepEqual(tutorStubStaticCommandCompletions('/meta'), ['/meta ask ', '/meta status', '/meta clear']);
  assert.deepEqual(tutorStubStaticCommandCompletions('/tutor'), ['/tutor auto', '/tutor status']);
  assert.deepEqual(tutorStubStaticCommandCompletions('/learner'), [
    '/learner list',
    '/learner list stress',
    '/learner list all',
    '/learner example',
    '/learner default',
    '/learner custom ',
  ]);
  assert.deepEqual(tutorStubCommandCompletionMetadata('/tutor'), {
    suffixes: ['auto', 'status'],
    dynamicProviders: ['actorial_parts'],
  });
  assert.deepEqual(tutorStubCommandCompletionMetadata('/learner'), {
    suffixes: ['list', 'list stress', 'list all', 'example', 'default', 'custom '],
    dynamicProviders: ['learner_profile_ids'],
  });
  const directHelp = tutorStubCommandHelpRows().find((row) => row.id === 'direct');
  assert.ok(directHelp.commands.includes('/tutor [part]'));
  assert.ok(directHelp.commands.includes('/learner [profile]'));
  assert.equal(resolveTutorStubCommand('/not-a-command'), null);
});

test('CLI director questions are bounded and carry explicit application-only context', () => {
  const question = 'How do I set up an adversarial teacher with a difficult learner in mixed mode?';
  const prompt = buildTutorStubCliDirectorPrompt({
    question,
    context: {
      currentSession: { sessionMode: 'mixed', learnerProfile: { id: 'diligent' } },
      commands: [
        {
          token: '/character',
          aliases: ['/learner', '/tutor'],
          summary: 'choose the learner profile or tutor host character',
        },
      ],
      tutorCharacters: [{ id: 'adversarial_teacher' }],
      learnerProfiles: [{ id: 'affective_resistant' }],
      returnToScene: { automaticAfterAnswer: true },
    },
  });

  assert.match(prompt, new RegExp(question.replace(/[?]/gu, '\\?'), 'u'));
  assert.match(prompt, new RegExp(TUTOR_STUB_CLI_DIRECTOR_SCHEMA.replaceAll('.', '\\.'), 'u'));
  assert.match(prompt, /"sessionMode":"mixed"/u);
  assert.match(prompt, /"aliases":\["\/learner","\/tutor"\]/u);
  assert.match(prompt, /"adversarial_teacher"/u);
  assert.match(prompt, /"affective_resistant"/u);
  assert.match(prompt, /"automaticAfterAnswer":true/u);
  assert.equal(normalizeTutorStubCliDirectorQuestion(`  ${question}  `), question);
  assert.throws(() => normalizeTutorStubCliDirectorQuestion(''), /CLI question is required/u);
  assert.equal(
    cleanTutorStubCliDirectorReply('Director: Use `/tutor adversarial_teacher`.\n'),
    'Use `/tutor adversarial_teacher`.',
  );
});

test('command summaries resolve for canonical commands, aliases, and subcommands', () => {
  for (const definition of TUTOR_STUB_COMMAND_REGISTRY.commands) {
    const staticCompletions = tutorStubStaticCommandCompletions(definition.token);
    for (const token of [definition.token, ...definition.aliases, ...staticCompletions]) {
      assert.equal(tutorStubCommandSummary(token), definition.summary, token);
    }
  }
  assert.equal(
    tutorStubCommandSummary('/translate basic'),
    'rewrite the latest tutor reply in contemporary standard English',
  );
  assert.equal(tutorStubCommandSummary('/character learner diligent'), tutorStubCommandSummary('/character'));
  assert.equal(tutorStubCommandSummary('/tutor advocate'), tutorStubCommandSummary('/character'));
  assert.equal(tutorStubCommandSummary('/learner diligent'), tutorStubCommandSummary('/character'));
  assert.equal(tutorStubCommandSummary('/not-a-command'), null);
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
  assert.equal(tutorStubCommandTransportMetadata('/module').processHttp, 'adapter_available');
  assert.equal(tutorStubCommandTransportMetadata('/next').processHttp, 'adapter_available');
  assert.equal(tutorStubCommandTransportMetadata('/progress').processHttp, 'adapter_available');
  assert.equal(tutorStubCommandTransportMetadata('/status').processHttp, 'adapter_available');
  assert.equal(tutorStubCommandTransportMetadata('/help').processHttp, 'adapter_available');
  assert.deepEqual(tutorStubCommandTransportMetadata('/proof').effects, []);
  assert.deepEqual(tutorStubCommandTransportMetadata('/lab').effects, ['relaunch_instruction']);
  assert.equal(tutorStubCommandTransportMetadata('/settings').processHttp, 'blocked_pending_adapter');
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
    'director',
    'meta',
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
    'proof',
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
    'details',
    'random',
    'light',
    'committee',
    'register',
    'character',
    'clarify',
    'voice',
    'director',
    'meta',
    'feedback_up',
    'feedback_down',
    'feedback',
    'tune',
    'settings',
    'debug',
    'mode',
    'coach',
    'auto',
    'suggest',
    'clue',
    'profile',
    'scenario',
    'board',
    'module',
    'next',
    'use',
    'regen',
    'reset',
    'quit',
  ]);
  assert.deepEqual(commandsWith('sessionClear'), ['scenario', 'board', 'reset']);
  assert.deepEqual(commandsWith('processExit'), ['scenario', 'board', 'quit']);
});

test('process HTTP admission fails closed for missing metadata and disallowed effects', () => {
  assert.deepEqual(tutorStubCommandTransportAdmission('/features'), {
    allowed: false,
    reason: 'adapter_unavailable',
    commandId: 'features',
    activeEffects: [],
    disallowedEffects: [],
    detail: null,
  });

  const structuredStatus = resolveTutorStubCommand('/status');
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

test('passthrough settings completions expose only speaker model, training reuse, theme, and motion', () => {
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
    '/settings training-reuse on',
    '/settings training-reuse off',
    '/settings training-reuse status',
  ]);
  assert.equal(Object.isFrozen(passthrough), true);
  assert.ok(passthrough.every((candidate) => /^\/settings (?:model |training-reuse |theme |motion )/u.test(candidate)));
  assert.ok(
    passthrough.every((candidate) => !/(?:models|temp|dropout|light|release-speed|forget|policy)/u.test(candidate)),
  );
  assert.deepEqual(tutorStubStaticCommandCompletions('/details ', { mode: 'passthrough' }), [
    '/details on',
    '/details off',
    '/details status',
  ]);
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
  assert.equal(tutorStubCommandAvailable('/translate', { capabilities: direct }), true);
  assert.ok(tutorStubCommandTokens({ capabilities: direct }).includes('/translate'));
  assert.ok(
    tutorStubCommandHelpRows({ capabilities: direct }).some((row) => row.commands.includes('/translate [level]')),
  );
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
  assert.equal(tutorStubCommandAvailable('/module', { capabilities: curriculum }), true);
  assert.equal(tutorStubCommandAvailable('/next', { capabilities: curriculum }), true);
  assert.equal(tutorStubCommandAvailable('/progress', { capabilities: curriculum }), true);
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
