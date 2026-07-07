import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  _buildInternalHistoryMessages,
  normalizeInternalHistoryConfig,
} from '../tutor-core/services/tutorDialogueEngine.js';
import { resolveConfigModels } from '../services/evaluationRunner.js';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function readRepoFile(relativePath) {
  return readFileSync(resolve(REPO_ROOT, relativePath), 'utf8');
}

function assertNoAdjacentSameRoles(messages) {
  for (let i = 1; i < messages.length; i++) {
    assert.notEqual(
      messages[i].role,
      messages[i - 1].role,
      `messages[${i - 1}] and messages[${i}] both use role ${messages[i].role}`,
    );
  }
}

describe('internal history message option', () => {
  it('defaults to disabled and preserves legacy behavior', () => {
    const normalized = normalizeInternalHistoryConfig();
    assert.equal(normalized.enabled, false);
    assert.equal(normalized.surface, 'messages');
    assert.equal(normalized.scope, 'unified_exchange');
    assert.equal(
      _buildInternalHistoryMessages([{ agent: 'ego', action: 'generate', content: 'draft' }], 'superego', normalized),
      null,
    );
  });

  it('requires the explicit messages/unified/window opt-in', () => {
    const events = [{ agent: 'ego', action: 'generate', content: 'draft' }];

    for (const config of [
      { enabled: false, surface: 'messages', scope: 'unified_exchange', window: 1 },
      { enabled: true, surface: 'prompt', scope: 'unified_exchange', window: 1 },
      { enabled: true, surface: 'messages', scope: 'role_local', window: 1 },
      { enabled: true, surface: 'messages', scope: 'unified_exchange', window: 0 },
    ]) {
      assert.equal(
        _buildInternalHistoryMessages(events, 'superego', config),
        null,
        `config should not emit internal history messages: ${JSON.stringify(config)}`,
      );
    }
  });

  it('maps a unified ego/superego exchange into bounded target-relative messages', () => {
    const messages = _buildInternalHistoryMessages(
      [
        { agent: 'ego', action: 'generate', content: 'initial tutor draft' },
        { agent: 'superego', action: 'review', content: 'critique the draft' },
      ],
      'ego',
      { enabled: true, surface: 'messages', scope: 'unified_exchange', window: 1 },
    );

    assert.deepEqual(
      messages.map((m) => m.role),
      ['user', 'assistant', 'user'],
    );
    assert.match(messages[0].content, /Internal ego\/superego history/);
    assert.match(messages[1].content, /\[internal:ego\/generate\]/);
    assert.match(messages[2].content, /\[internal:superego\/review\]/);
    assertNoAdjacentSameRoles(messages);
  });

  it('limits history by exchange window', () => {
    const messages = _buildInternalHistoryMessages(
      [
        { agent: 'ego', action: 'generate', content: 'old ego draft' },
        { agent: 'superego', action: 'review', content: 'old critique' },
        { agent: 'ego', action: 'revise', content: 'latest ego draft' },
        { agent: 'superego', action: 'review', content: 'latest critique' },
      ],
      'ego',
      { enabled: true, surface: 'messages', scope: 'unified_exchange', window: 1 },
    );

    assert.equal(
      messages.some((m) => m.content.includes('old ego draft')),
      false,
    );
    assert.equal(
      messages.some((m) => m.content.includes('old critique')),
      false,
    );
    assert.equal(
      messages.some((m) => m.content.includes('latest ego draft')),
      true,
    );
    assert.equal(
      messages.some((m) => m.content.includes('latest critique')),
      true,
    );
  });

  it('merges adjacent same-role boundaries when external history is present', () => {
    const externalHistory = [
      { role: 'assistant', content: 'previous tutor turn' },
      { role: 'user', content: 'previous learner reply' },
    ];
    const messages = _buildInternalHistoryMessages(
      [{ agent: 'ego', action: 'generate', content: 'draft for superego' }],
      'superego',
      { enabled: true, surface: 'messages', scope: 'unified_exchange', window: 1 },
      externalHistory,
    );

    assert.deepEqual(
      messages.map((m) => m.role),
      ['assistant', 'user'],
    );
    assert.match(messages[1].content, /previous learner reply/);
    assert.match(messages[1].content, /\[internal:ego\/generate\]/);
    assertNoAdjacentSameRoles(messages);
  });

  it('preserves direct internalHistory options during eval config resolution', () => {
    const resolved = resolveConfigModels({
      profileName: 'cell_3_base_multi_unified',
      internalHistory: {
        enabled: true,
        surface: 'messages',
        scope: 'unified_exchange',
        window: 1,
        max_chars_per_message: 600,
      },
    });

    assert.deepEqual(resolved.internalHistory, {
      enabled: true,
      surface: 'messages',
      scope: 'unified_exchange',
      window: 1,
      max_chars_per_message: 600,
    });
  });

  it('locks Phase-2 dialectical negotiation to prompt-only calls', () => {
    const source = readRepoFile('tutor-core/services/dialecticalEngine.js');
    assert.equal(
      source.includes('messageHistory'),
      false,
      'Phase-2 dialectical engine should not receive chat-message history',
    );
    assert.match(source, /const dialogueTrace = \[/, 'dialectical engine should still record a trace');
    assert.match(source, /dialogueTrace\.push/, 'dialectical engine should append trace entries');

    const generateCalls = [...source.matchAll(/aiService\.generateText\(\{([\s\S]*?)\n\s*\}\);/g)];
    assert.ok(generateCalls.length >= 3, 'expected dialectical engine LLM calls');

    for (const [, body] of generateCalls) {
      assert.match(body, /^\s*prompt,/m, 'dialectical LLM calls should send freshly rendered prompts');
      assert.doesNotMatch(body, /\bmessages\b/, 'dialectical LLM calls should not send chat messages');
      assert.doesNotMatch(body, /\bdialogueTrace\b/, 'recorded traces should not be fed back into LLM calls');
    }
  });
});
