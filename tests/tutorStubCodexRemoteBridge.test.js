import assert from 'node:assert/strict';
import test from 'node:test';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import {
  createTutorStubCodexRemoteBridge,
  createTutorStubCodexRemoteMcpServer,
  tutorStubCodexRemoteCommandAdmission,
} from '../services/tutorStubCodexRemoteBridge.js';

function snapshot(session, { includeOpening = true } = {}) {
  const publicMessages = includeOpening
    ? [{ role: 'assistant', content: 'Opening question from the tutor.' }, ...session.messages]
    : [...session.messages];
  return {
    sessionId: session.id,
    status: 'active',
    revision: session.revision,
    capabilitySnapshot: {
      mode: session.mode,
      active: session.mode === 'mixed' ? ['mixed_drafting'] : [],
    },
    state: {
      capabilityMode: session.mode,
      interactionMode: 'learner',
      worldId: session.world || 'world_test',
      turnCount: session.turnCount,
      publicMessageCount: publicMessages.length,
      opening: includeOpening ? publicMessages[0] : null,
      publicMessages,
    },
  };
}

function createFakeHost() {
  const sessions = new Map();
  const calls = [];
  return {
    calls,
    async create(specification) {
      calls.push({ operation: 'create', specification: structuredClone(specification) });
      const session = {
        id: specification.id || `session-${sessions.size + 1}`,
        mode: specification.mode,
        world: specification.world,
        revision: 1,
        turnCount: 0,
        messages: [],
      };
      sessions.set(session.id, session);
      return snapshot(session);
    },
    get(id) {
      return snapshot(sessions.get(id));
    },
    list() {
      return [...sessions.values()].map((session) => snapshot(session));
    },
    async step(id, input, options) {
      calls.push({ operation: 'step', id, input, options: structuredClone(options) });
      const session = sessions.get(id);
      session.revision += 1;
      if (options.kind === 'command') {
        return {
          result: {
            accepted: true,
            command: { input, output: `remote display for ${input}` },
          },
          session: snapshot(session),
        };
      }
      const tutor = `Tutor response to: ${input}`;
      session.messages.push({ role: 'user', content: input }, { role: 'assistant', content: tutor });
      session.turnCount += 1;
      return {
        result: { accepted: true, turn: { learner: input, tutor } },
        session: snapshot(session),
      };
    },
    async reset(id, payload) {
      calls.push({ operation: 'reset', id, payload: structuredClone(payload) });
      const session = sessions.get(id);
      session.messages = [];
      session.turnCount = 0;
      session.revision += 1;
      return { result: { reset: true }, session: snapshot(session) };
    },
    interrupt(id, reason) {
      calls.push({ operation: 'interrupt', id, reason });
      const session = sessions.get(id);
      sessions.delete(id);
      return { result: { sessionId: id, interrupted: true, reason }, session: snapshot(session) };
    },
    async finalize(id, reason, payload) {
      calls.push({ operation: 'finalize', id, reason, payload: structuredClone(payload) });
      sessions.delete(id);
      return { result: { finalized: true, reason } };
    },
  };
}

test('Codex bridge defaults to mixed mode and relays learner text without rewriting it', async () => {
  const host = createFakeHost();
  const bridge = createTutorStubCodexRemoteBridge({ host });
  const started = await bridge.start({ sessionId: 'remote-dialogue', model: 'codex.gpt-5.6-terra' });

  assert.equal(started.mode, 'mixed');
  assert.equal(started.opening, 'Opening question from the tutor.');
  assert.equal(bridge.activeSessionId, 'remote-dialogue');
  assert.equal(host.calls[0].specification.load.source, 'codex_remote_mcp');

  const learnerText = '  Keep this exact punctuation—yes?  ';
  const turn = await bridge.turn({ learnerText });
  assert.equal(host.calls[1].input, learnerText);
  assert.deepEqual(host.calls[1].options, {
    kind: 'learner',
    context: { source: 'codex_remote_mcp' },
  });
  assert.equal(turn.learner, learnerText);
  assert.equal(turn.tutor, `Tutor response to: ${learnerText}`);
  assert.equal(turn.turnCount, 1);
});

test('Codex command admission supports dialogue controls and fails closed for terminal effects', () => {
  for (const command of [
    '/meta ask How do I choose an adversarial tutor?',
    '/meta Make the tutor more ironic',
    '/translate basic',
    '/register sarcastic',
    '/character tutor provocateur',
    '/tutor provocateur',
    '/learner recalcitrant',
    '/analysis technical',
  ]) {
    assert.equal(tutorStubCodexRemoteCommandAdmission(command).allowed, true, command);
  }

  for (const command of ['/voice', '/scenario world_005_marrick', '/board a1', '/quit', '/proof check']) {
    const admission = tutorStubCodexRemoteCommandAdmission(command);
    assert.equal(admission.allowed, false, command);
    assert.equal(admission.code, 'remote_command_requires_local_surface');
    assert.match(admission.message, /terminal-only/u);
  }
  assert.equal(tutorStubCodexRemoteCommandAdmission('ordinary learner speech').code, 'invalid_remote_command');
  assert.equal(tutorStubCodexRemoteCommandAdmission('/not-a-command').code, 'unknown_remote_command');
});

test('Codex command calls stay outside public learner speech and return captured display text', async () => {
  const host = createFakeHost();
  const bridge = createTutorStubCodexRemoteBridge({ host });
  await bridge.start({ sessionId: 'command-dialogue' });

  const result = await bridge.command({ command: '/meta ask How do I change learner character?' });
  assert.equal(result.commandId, 'meta');
  assert.equal(result.output, 'remote display for /meta ask How do I change learner character?');
  assert.equal(result.publicMessageCount, 1);
  assert.equal(host.calls[1].options.kind, 'command');
});

test('MCP server advertises the bounded tutor surface and reports terminal-only errors', async (t) => {
  const host = createFakeHost();
  const { server } = createTutorStubCodexRemoteMcpServer({ host });
  const client = new Client({ name: 'tutor-bridge-test', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  t.after(async () => {
    await client.close();
    await server.close();
  });
  await server.connect(serverTransport);
  await client.connect(clientTransport);

  const tools = await client.listTools();
  assert.deepEqual(tools.tools.map((tool) => tool.name).sort(), [
    'tutor_command',
    'tutor_interrupt',
    'tutor_reset',
    'tutor_start',
    'tutor_status',
    'tutor_stop',
    'tutor_turn',
  ]);
  assert.match(tools.tools.find((tool) => tool.name === 'tutor_turn').description, /exactly as supplied/u);

  const started = await client.callTool({ name: 'tutor_start', arguments: { sessionId: 'mcp-dialogue' } });
  assert.equal(started.isError, undefined);
  assert.equal(started.structuredContent.data.mode, 'mixed');
  assert.match(started.content[0].text, /tutor > Opening question/u);

  const blocked = await client.callTool({ name: 'tutor_command', arguments: { command: '/voice' } });
  assert.equal(blocked.isError, true);
  assert.match(blocked.content[0].text, /microphone and speaker controls require the local browser companion/u);
});
