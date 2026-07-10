import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  callAIWithCliBridge,
  cliAwareProviderConfig,
  codexFinalMessageFromEvents,
  createCodexJsonlEventParser,
  isCliProvider,
  isProviderConfigured,
  normalizeCliEffort,
  resolveCliEffort,
} from '../cliProviderBridge.js';

describe('cliProviderBridge', () => {
  it('recognizes repo-local CLI providers', () => {
    assert.equal(isCliProvider('claude-code'), true);
    assert.equal(isCliProvider('codex'), true);
    assert.equal(isCliProvider('openrouter'), false);
  });

  it('marks CLI providers configured without API keys', () => {
    assert.equal(isProviderConfigured('claude-code', { isConfigured: false }), true);
    assert.equal(isProviderConfigured('codex', { isConfigured: false }), true);
    assert.equal(isProviderConfigured('openai', { isConfigured: false }), false);
    assert.deepEqual(cliAwareProviderConfig('codex', { isConfigured: false, apiKey: 'secret' }), {
      isConfigured: true,
      apiKey: '',
    });
  });

  it('delegates non-CLI providers to the supplied fallback caller', async () => {
    const calls = [];
    const raw = await callAIWithCliBridge({ provider: 'openai', model: 'gpt-test' }, 'system', 'user', 'learner', {
      messageHistory: [{ role: 'user', content: 'hello' }],
      fallbackCallAI: async (...args) => {
        calls.push(args);
        return { text: 'fallback response', provider: 'openai', model: 'gpt-test' };
      },
    });

    assert.equal(raw.text, 'fallback response');
    assert.equal(calls.length, 1);
    assert.equal(calls[0][0].provider, 'openai');
    assert.equal(calls[0][3], 'learner');
  });

  it('requires a fallback caller for non-CLI providers', async () => {
    await assert.rejects(
      () => callAIWithCliBridge({ provider: 'openai' }, 'system', 'user', 'learner'),
      /No fallback AI caller supplied/,
    );
  });

  it('normalizes and validates CLI effort levels', () => {
    assert.equal(normalizeCliEffort('HIGH'), 'high');
    assert.equal(normalizeCliEffort(' config '), 'config');
    assert.equal(normalizeCliEffort(''), null);
    assert.throws(() => normalizeCliEffort('extreme'), /CLI effort must be/);
  });

  it('resolves effort for Codex and Claude CLI providers', () => {
    const oldGlobal = process.env.CLI_PROVIDER_EFFORT;
    const oldCodex = process.env.CLI_PROVIDER_CODEX_EFFORT;
    const oldCodexLegacy = process.env.CODEX_REASONING_EFFORT;
    const oldClaude = process.env.CLI_PROVIDER_CLAUDE_EFFORT;
    const oldClaudeCode = process.env.CLAUDE_CODE_EFFORT;
    const oldClaudeLegacy = process.env.CLAUDE_EFFORT;

    try {
      delete process.env.CLI_PROVIDER_EFFORT;
      delete process.env.CLI_PROVIDER_CODEX_EFFORT;
      delete process.env.CODEX_REASONING_EFFORT;
      delete process.env.CLI_PROVIDER_CLAUDE_EFFORT;
      delete process.env.CLAUDE_CODE_EFFORT;
      delete process.env.CLAUDE_EFFORT;

      assert.equal(resolveCliEffort('codex'), 'xhigh');
      assert.equal(resolveCliEffort('claude-code'), null);
      assert.equal(resolveCliEffort('codex', 'low'), 'low');
      assert.equal(resolveCliEffort('claude-code', 'max'), 'max');

      process.env.CLI_PROVIDER_EFFORT = 'medium';
      assert.equal(resolveCliEffort('codex'), 'medium');
      assert.equal(resolveCliEffort('claude-code'), 'medium');

      process.env.CLI_PROVIDER_CODEX_EFFORT = 'high';
      process.env.CLI_PROVIDER_CLAUDE_EFFORT = 'xhigh';
      assert.equal(resolveCliEffort('codex'), 'high');
      assert.equal(resolveCliEffort('claude-code'), 'xhigh');
    } finally {
      if (oldGlobal === undefined) delete process.env.CLI_PROVIDER_EFFORT;
      else process.env.CLI_PROVIDER_EFFORT = oldGlobal;
      if (oldCodex === undefined) delete process.env.CLI_PROVIDER_CODEX_EFFORT;
      else process.env.CLI_PROVIDER_CODEX_EFFORT = oldCodex;
      if (oldCodexLegacy === undefined) delete process.env.CODEX_REASONING_EFFORT;
      else process.env.CODEX_REASONING_EFFORT = oldCodexLegacy;
      if (oldClaude === undefined) delete process.env.CLI_PROVIDER_CLAUDE_EFFORT;
      else process.env.CLI_PROVIDER_CLAUDE_EFFORT = oldClaude;
      if (oldClaudeCode === undefined) delete process.env.CLAUDE_CODE_EFFORT;
      else process.env.CLAUDE_CODE_EFFORT = oldClaudeCode;
      if (oldClaudeLegacy === undefined) delete process.env.CLAUDE_EFFORT;
      else process.env.CLAUDE_EFFORT = oldClaudeLegacy;
    }
  });

  it('parses chunked Codex JSONL events incrementally', () => {
    const seen = [];
    const parser = createCodexJsonlEventParser((event) => seen.push(event.type));
    parser.push('{"type":"thread.started"}\n{"type":"item.com');
    parser.push('pleted","item":{"type":"agent_message","text":"done"}}\nnot-json\n');
    const parsed = parser.end();

    assert.deepEqual(seen, ['thread.started', 'item.completed']);
    assert.equal(parsed.events.length, 2);
    assert.deepEqual(parsed.invalidLines, ['not-json']);
  });

  it('keeps parsing when a stream display callback fails', () => {
    const parser = createCodexJsonlEventParser(() => {
      throw new Error('display failed');
    });
    parser.push('{"type":"turn.started"}\n');
    assert.equal(parser.end().events.length, 1);
  });

  it('extracts the newest final agent message as the output-file fallback', () => {
    const events = [
      { type: 'item.completed', item: { type: 'agent_message', text: 'first' } },
      { type: 'turn.completed' },
      { type: 'item.completed', item: { type: 'agent_message', text: ' final answer ' } },
    ];
    assert.equal(codexFinalMessageFromEvents(events), 'final answer');
    assert.equal(codexFinalMessageFromEvents([{ type: 'turn.completed' }]), '');
  });

  it('rejects a pre-aborted Codex call without launching it', async () => {
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(
      () =>
        callAIWithCliBridge({ provider: 'codex', model: 'gpt-test' }, 'system', 'user', 'learner', {
          signal: controller.signal,
        }),
      (error) => error?.name === 'AbortError',
    );
  });
});
