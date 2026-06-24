import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  _buildInternalHistoryMessages,
  normalizeInternalHistoryConfig,
} from '../tutor-core/services/tutorDialogueEngine.js';
import { resolveConfigModels } from '../services/evaluationRunner.js';

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
});
