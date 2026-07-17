import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';

import {
  callAIWithCliBridge,
  cliAwareProviderConfig,
  codexFinalMessageFromEvents,
  codexUsageFromEvents,
  createCodexJsonlEventParser,
  isCliProvider,
  isProviderConfigured,
  normalizeCliEffort,
  resolveCliEffort,
} from '../cliProviderBridge.js';

function fakeChild({ stdoutText = '', onEnd = null } = {}) {
  const child = new EventEmitter();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.kill = () => {};
  child.stdin = {
    write() {},
    end() {
      onEnd?.();
      queueMicrotask(() => {
        if (stdoutText) child.stdout.write(stdoutText);
        child.stdout.end();
        child.stderr.end();
        child.emit('close', 0);
      });
    },
  };
  return child;
}

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

  it('extracts token accounting from the Codex turn-completed event', () => {
    const usage = codexUsageFromEvents([
      { type: 'turn.started' },
      {
        type: 'turn.completed',
        usage: {
          input_tokens: 23394,
          cached_input_tokens: 5888,
          output_tokens: 5,
          reasoning_output_tokens: 0,
        },
      },
    ]);

    assert.deepEqual(usage, {
      inputTokens: 23394,
      cachedInputTokens: 5888,
      uncachedInputTokens: 17506,
      outputTokens: 5,
      reasoningOutputTokens: 0,
      totalTokens: 23399,
      tokenUsageAvailable: true,
    });
    assert.equal(codexUsageFromEvents([{ type: 'turn.completed' }]), null);
  });

  it('preserves partial Codex usage as null instead of inventing zeroes', () => {
    assert.deepEqual(
      codexUsageFromEvents([
        { type: 'turn.completed', usage: { input_tokens: 120, reasoning_output_tokens: 4 } },
      ]),
      {
        inputTokens: 120,
        cachedInputTokens: null,
        uncachedInputTokens: null,
        outputTokens: null,
        reasoningOutputTokens: 4,
        totalTokens: null,
        tokenUsageAvailable: true,
      },
    );
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

  it('passes an opt-in JSON schema file to Codex without changing legacy callers', async () => {
    const calls = [];
    const outputSchema = {
      type: 'object',
      required: ['learner_text'],
      additionalProperties: false,
      properties: { learner_text: { type: 'string' } },
    };
    const spawnImpl = (command, args, options) => {
      const schemaPath = args[args.indexOf('--output-schema') + 1];
      const outputPath = args[args.indexOf('-o') + 1];
      calls.push({ command, args, options, schema: JSON.parse(fs.readFileSync(schemaPath, 'utf8')) });
      return fakeChild({
        stdoutText: '{"type":"turn.completed"}\n',
        onEnd: () => fs.writeFileSync(outputPath, '{"learner_text":"ready"}\n'),
      });
    };

    const result = await callAIWithCliBridge({ provider: 'codex', model: 'gpt-test' }, 'system', 'user', 'learner', {
      outputSchema,
      effort: 'low',
      timeoutMs: 1000,
      spawnImpl,
    });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].command, 'codex');
    assert.deepEqual(calls[0].schema, outputSchema);
    assert.ok(calls[0].args.includes('--output-schema'));
    assert.ok(calls[0].args.includes('--ignore-rules'));
    assert.equal(result.structuredOutput, true);
    assert.equal(result.prohibitedToolEventCount, 0);
    assert.deepEqual(result.structuredEventAudit.prohibited_events, []);
    assert.equal(result.modelAttestationBasis, 'explicit_cli_model_argument_accepted_bridge_echo');
    assert.equal(result.modelIndependentlyAttested, false);
    assert.equal(result.tokenUsageAvailable, false);
    assert.equal(result.inputTokens, null);
    assert.equal(result.cachedInputTokens, null);
    assert.equal(result.uncachedInputTokens, null);
    assert.equal(result.outputTokens, null);
    assert.equal(result.reasoningOutputTokens, null);
    assert.equal(result.totalTokens, null);
  });

  it('passes an explicit replacement instruction file without changing the default Codex path', async () => {
    const calls = [];
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ms-codex-instructions-test-'));
    const instructions = path.join(dir, 'speaker.md');
    fs.writeFileSync(instructions, 'Return only public tutor speech.\n');
    const spawnImpl = (command, args) => {
      const overrideArg = args.find((arg) => arg.startsWith('model_instructions_file='));
      const copiedPath = overrideArg
        ? JSON.parse(overrideArg.slice('model_instructions_file='.length))
        : null;
      calls.push({
        command,
        args,
        copiedPath,
        copiedText: copiedPath ? fs.readFileSync(copiedPath, 'utf8') : null,
      });
      const outputPath = args[args.indexOf('-o') + 1];
      return fakeChild({
        stdoutText: '{"type":"turn.completed"}\n',
        onEnd: () => fs.writeFileSync(outputPath, 'ready\n'),
      });
    };

    try {
      const overridden = await callAIWithCliBridge(
        { provider: 'codex', model: 'gpt-test' },
        'system',
        'user',
        'tutor',
        {
          developmentModelInstructionsFile: instructions,
          allowDevelopmentBaseInstructionsOverride: true,
          modelInstructionsSource: 'config/speaker.md',
          timeoutMs: 1000,
          spawnImpl,
        },
      );
      const ordinary = await callAIWithCliBridge(
        { provider: 'codex', model: 'gpt-test' },
        'system',
        'user',
        'tutor',
        { timeoutMs: 1000, spawnImpl },
      );

      const overrideArg = calls[0].args.find((arg) => arg.startsWith('model_instructions_file='));
      assert.ok(overrideArg);
      const copiedPath = JSON.parse(overrideArg.slice('model_instructions_file='.length));
      assert.notEqual(copiedPath, instructions);
      assert.equal(calls[0].copiedText, 'Return only public tutor speech.\n');
      assert.ok(calls[0].args.includes('--strict-config'));
      assert.equal(overridden.baseInstructionsMode, 'replacement_file');
      assert.equal(overridden.modelInstructionsSource, 'config/speaker.md');
      assert.equal(overridden.modelInstructionsBytes, 33);
      assert.match(overridden.modelInstructionsSha256, /^[a-f0-9]{64}$/u);
      assert.equal(calls[1].args.some((arg) => arg.startsWith('model_instructions_file=')), false);
      assert.equal(calls[1].args.includes('--strict-config'), false);
      assert.equal(ordinary.baseInstructionsMode, 'codex_default');
      assert.equal(ordinary.modelInstructionsSource, null);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('fails before launch when the replacement instruction file is missing', async () => {
    await assert.rejects(
      () => callAIWithCliBridge(
        { provider: 'codex', model: 'gpt-test' },
        'system',
        'user',
        'tutor',
        {
          developmentModelInstructionsFile: '/definitely/missing/speaker.md',
          allowDevelopmentBaseInstructionsOverride: true,
        },
      ),
      /model instructions file does not exist/iu,
    );
  });

  it('rejects base replacement without the explicit development-only capability', async () => {
    await assert.rejects(
      () => callAIWithCliBridge(
        { provider: 'codex', model: 'gpt-test' },
        'system',
        'user',
        'tutor',
        { developmentModelInstructionsFile: '/not-read-without-capability.md' },
      ),
      /explicit development-only capability/iu,
    );
  });

  it('returns real Codex CLI token usage when the JSON stream reports it', async () => {
    const spawnImpl = (_command, args) => {
      const outputPath = args[args.indexOf('-o') + 1];
      return fakeChild({
        stdoutText:
          '{"type":"item.completed","item":{"type":"agent_message","text":"ready"}}\n' +
          '{"type":"turn.completed","usage":{"input_tokens":120,"cached_input_tokens":40,"output_tokens":9,"reasoning_output_tokens":3}}\n',
        onEnd: () => fs.writeFileSync(outputPath, 'ready\n'),
      });
    };

    const result = await callAIWithCliBridge({ provider: 'codex', model: 'gpt-test' }, 'system', 'user', 'learner', {
      effort: 'low',
      timeoutMs: 1000,
      spawnImpl,
    });

    assert.equal(result.inputTokens, 120);
    assert.equal(result.outputTokens, 9);
    assert.equal(result.cachedInputTokens, 40);
    assert.equal(result.uncachedInputTokens, 80);
    assert.equal(result.reasoningOutputTokens, 3);
    assert.equal(result.totalTokens, 129);
    assert.equal(result.tokenUsageAvailable, true);
  });

  it('marks unknown or tool-capable Codex JSONL events as prohibited for structured calls', async () => {
    const outputSchema = { type: 'object', properties: {}, additionalProperties: false };
    const spawnImpl = (_command, args) => {
      const outputPath = args[args.indexOf('-o') + 1];
      return fakeChild({
        stdoutText: '{"type":"thread.started"}\n{"type":"item.completed","item":{"type":"command_execution"}}\n',
        onEnd: () => fs.writeFileSync(outputPath, '{}\n'),
      });
    };
    const result = await callAIWithCliBridge({ provider: 'codex', model: 'gpt-test' }, 'system', 'user', 'learner', {
      outputSchema,
      effort: 'low',
      timeoutMs: 1000,
      spawnImpl,
    });
    assert.equal(result.prohibitedToolEventCount, 1);
    assert.deepEqual(result.structuredEventAudit.prohibited_events[0], {
      index: 1,
      event_type: 'item.completed',
      item_type: 'command_execution',
    });
    assert.equal(result.structuredEventAudit.policy, 'strict_no_tools_allowlist');
  });

  it('passes an opt-in JSON schema and isolation flags to Claude', async () => {
    const calls = [];
    const outputSchema = { type: 'object', properties: {}, additionalProperties: false };
    const spawnImpl = (command, args, options) => {
      calls.push({ command, args, options });
      return fakeChild({ stdoutText: '{}\n' });
    };

    const result = await callAIWithCliBridge(
      { provider: 'claude-code', model: 'claude-test' },
      'system',
      'user',
      'learner',
      { outputSchema, effort: 'low', timeoutMs: 1000, spawnImpl },
    );

    assert.equal(calls.length, 1);
    assert.equal(calls[0].command, 'claude');
    assert.ok(calls[0].args.includes('--json-schema'));
    assert.ok(calls[0].args.includes('--no-session-persistence'));
    assert.ok(calls[0].args.includes('--safe-mode'));
    assert.ok(calls[0].args.includes('--tools'));
    assert.deepEqual(JSON.parse(calls[0].args[calls[0].args.indexOf('--json-schema') + 1]), outputSchema);
    assert.equal(calls[0].options.env.ANTHROPIC_API_KEY, undefined);
    assert.equal(result.structuredOutput, true);
    assert.equal(result.tokenUsageAvailable, false);
    assert.equal(result.inputTokens, null);
    assert.equal(result.cachedInputTokens, null);
    assert.equal(result.uncachedInputTokens, null);
    assert.equal(result.outputTokens, null);
    assert.equal(result.reasoningOutputTokens, null);
    assert.equal(result.totalTokens, null);
  });
});
