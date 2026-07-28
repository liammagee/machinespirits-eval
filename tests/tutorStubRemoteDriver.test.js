import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  DEFAULT_REMOTE_LAB,
  DEFAULT_REMOTE_MODEL,
  DEFAULT_REMOTE_PORT,
  DEFAULT_REMOTE_TUTOR,
  baseUrl,
  buildSessionSpecification,
  clearRemoteState,
  describeError,
  extractDialogue,
  parseRemoteArgs,
  readRemoteState,
  remoteAdmissibleCommands,
  resolveRemoteStateDir,
  stripTerminalControl,
  writeRemoteState,
} from '../scripts/tutor-stub-remote.js';
import {
  TUTOR_STUB_COMMAND_EFFECT_KEYS,
  TUTOR_STUB_NORMAL_SLASH_COMMANDS,
  resolveTutorStubCommand,
  tutorStubCommandTransportAdmission,
} from '../services/tutorStubCommandRegistry.js';

function isolatedEnv() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-remote-'));
  return { TUTOR_STUB_REMOTE_STATE_DIR: dir };
}

test('parses subcommands, flags and kebab-case options', () => {
  const args = parseRemoteArgs([
    'start',
    '--world',
    'world_005_marrick',
    '--base-url',
    'http://127.0.0.1:9001',
    '--json',
  ]);
  assert.equal(args.subcommand, 'start');
  assert.equal(args.world, 'world_005_marrick');
  assert.equal(args.baseUrl, 'http://127.0.0.1:9001');
  assert.equal(args.json, true);
  assert.equal(args.autostart, true);
});

test('collects positional text for say', () => {
  const args = parseRemoteArgs(['say', 'I', 'am', 'ready', 'to', 'begin']);
  assert.equal(args.positional.join(' '), 'I am ready to begin');
});

test('rejects unknown subcommands and dangling option values', () => {
  assert.throws(() => parseRemoteArgs(['teleport']), /unknown subcommand/u);
  assert.throws(() => parseRemoteArgs(['start', '--world']), /--world requires a value/u);
  assert.throws(() => parseRemoteArgs(['start', '--port', '70000']), /invalid --port/u);
  assert.throws(() => parseRemoteArgs(['say', 'hi', '--timeout', 'soon']), /invalid --timeout/u);
});

test('help is the no-argument default', () => {
  assert.equal(parseRemoteArgs([]).subcommand, 'help');
  assert.equal(parseRemoteArgs(['--help']).subcommand, 'help');
});

test('defaults the model to the Claude Code CLI bridge so cloud containers need no API key', () => {
  // The catalog default is a codex.* ref whose CLI is absent in a remote
  // container; defaulting away from it is the whole point of this driver.
  const specification = buildSessionSpecification({});
  assert.equal(specification.model, DEFAULT_REMOTE_MODEL);
  assert.match(specification.model, /^claude-code\./u);
  assert.equal(specification.lab, DEFAULT_REMOTE_LAB);
  assert.equal(specification.tutor, DEFAULT_REMOTE_TUTOR);
});

test('forwards only the fields the transport accepts', () => {
  const specification = buildSessionSpecification({ world: 'world_001_nocturne', topic: 'the nocturne', json: true });
  assert.deepEqual(Object.keys(specification).sort(), ['lab', 'model', 'topic', 'tutor', 'world']);
  // The transport rejects unknown session fields outright, so CLI-only flags
  // such as --json must never leak into the specification body.
  assert.equal(specification.json, undefined);
});

test('forwards an explicit worldless session', () => {
  assert.equal(buildSessionSpecification({ world: 'none' }).world, 'none');
  assert.equal(buildSessionSpecification({}).world, undefined);
});

test('maps public messages onto tutor and learner turns', () => {
  const dialogue = extractDialogue({
    state: {
      publicMessages: [
        { role: 'user', content: 'I am ready to begin.' },
        { role: 'assistant', content: 'Good. Start with what is in front of you.' },
      ],
    },
  });
  assert.deepEqual(dialogue, [
    { speaker: 'learner', text: 'I am ready to begin.' },
    { speaker: 'tutor', text: 'Good. Start with what is in front of you.' },
  ]);
});

test('tolerates sessions with no dialogue yet', () => {
  assert.deepEqual(extractDialogue({}), []);
  assert.deepEqual(extractDialogue({ state: { publicMessages: null } }), []);
  assert.deepEqual(extractDialogue({ state: { publicMessages: [{ role: 'user' }] } }), []);
});

test('surfaces the transport error envelope', () => {
  assert.equal(
    describeError({ error: { code: 'command_transport_unavailable', message: 'slash commands are not enabled' } }),
    'command_transport_unavailable: slash commands are not enabled',
  );
  assert.equal(describeError({ session: { sessionId: 'x' } }), null);
});

test('resolves the base url from flag, port, env, then default', () => {
  assert.equal(baseUrl({ baseUrl: 'http://example.test:80/' }), 'http://example.test:80');
  assert.equal(baseUrl({ port: 9100 }, {}), 'http://127.0.0.1:9100');
  assert.equal(baseUrl({}, { TUTOR_STUB_REMOTE_PORT: '9200' }), 'http://127.0.0.1:9200');
  assert.equal(baseUrl({}, {}), `http://127.0.0.1:${DEFAULT_REMOTE_PORT}`);
});

test('session pointer round-trips through the env-overridable state dir', () => {
  const env = isolatedEnv();
  try {
    assert.equal(readRemoteState(env), null);
    writeRemoteState({ sessionId: 'tutor-stub-abc', baseUrl: 'http://127.0.0.1:8099' }, env);
    assert.equal(readRemoteState(env).sessionId, 'tutor-stub-abc');
    clearRemoteState(env);
    assert.equal(readRemoteState(env), null);
    // Clearing an already-cleared pointer is the desired end state, not an error.
    clearRemoteState(env);
  } finally {
    fs.rmSync(resolveRemoteStateDir(env), { recursive: true, force: true });
  }
});

test('strips terminal control sequences from command output', () => {
  const esc = String.fromCharCode(27);
  assert.equal(stripTerminalControl(`${esc}[2Kcourse progress${esc}[0m`), 'course progress');
  assert.equal(stripTerminalControl('plain text'), 'plain text');
  assert.equal(stripTerminalControl(null), '');
});

test('cmd parses --list and a command token', () => {
  assert.equal(parseRemoteArgs(['cmd', '--list']).list, true);
  assert.equal(parseRemoteArgs(['cmd', '/progress']).positional.join(' '), '/progress');
  assert.equal(parseRemoteArgs(['cmd', 'module', 'blueprint']).positional.join(' '), 'module blueprint');
});

test('admissible commands are exactly those with a structured adapter', () => {
  const admissible = remoteAdmissibleCommands();
  assert.ok(admissible.length > 0, 'expected at least one adapter-backed command');
  for (const token of admissible) {
    const definition = resolveTutorStubCommand(token);
    assert.equal(definition.transport.processHttp, 'adapter_available');
    assert.equal(definition.transport.noninteractiveAdapter, 'structured');
  }
});

test('the adapter gate, not the effect allowlist, is what bounds the command set', () => {
  // Regression pin for a real misdiagnosis: admission checks the adapter
  // declaration BEFORE the effect allowlist, so widening allowedEffects admits
  // nothing extra. If this ever fails, the gate order changed and the driver's
  // usage text about "adapter work, not a permissions setting" is now wrong.
  const withPersistentMutation = remoteAdmissibleCommands();
  const withEveryEffect = TUTOR_STUB_NORMAL_SLASH_COMMANDS.filter(
    (token) =>
      tutorStubCommandTransportAdmission(token, { allowedEffects: [...TUTOR_STUB_COMMAND_EFFECT_KEYS] }).allowed,
  );
  assert.deepEqual(withEveryEffect, withPersistentMutation);
});

test('blocked commands report the adapter gate, not a disallowed effect', () => {
  const blocked = TUTOR_STUB_NORMAL_SLASH_COMMANDS.filter((token) => !remoteAdmissibleCommands().includes(token));
  assert.ok(blocked.length > 0, 'expected some commands to remain terminal-only');
  for (const token of blocked) {
    const admission = tutorStubCommandTransportAdmission(token, { allowedEffects: ['persistentMutation'] });
    assert.equal(admission.allowed, false);
    assert.equal(admission.reason, 'adapter_unavailable');
  }
});

test('state dir stays out of the repo when overridden', () => {
  const env = isolatedEnv();
  try {
    assert.equal(resolveRemoteStateDir(env), env.TUTOR_STUB_REMOTE_STATE_DIR);
    assert.match(resolveRemoteStateDir({}), /\.tutor-stub-remote$/u);
  } finally {
    fs.rmSync(resolveRemoteStateDir(env), { recursive: true, force: true });
  }
});
