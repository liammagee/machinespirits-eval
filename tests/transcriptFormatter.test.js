import { strict as assert } from 'assert';
import { describe, it } from 'node:test';
import { formatTranscript, formatEntry, formatCompactLine, wrapText } from '../services/transcriptFormatter.js';

// Sample trace data mimicking real consolidatedTrace entries
const sampleTrace = [
  {
    agent: 'user', action: 'context_input', round: 1, turnIndex: 0,
    contextData: { currentPage: '479-lecture-3', strugglesCount: 5, sessions: 2 },
  },
  {
    agent: 'ego', action: 'generate', round: 1, turnIndex: 0,
    suggestions: [{ title: 'Review basics', message: 'Let me help you revisit the key concepts from lecture 2.' }],
    latencyMs: 3200,
    metrics: { model: 'moonshot-ai/kimi-k2.5', inputTokens: 8500, outputTokens: 1200, latencyMs: 3200, cost: 0.0032 },
  },
  {
    agent: 'superego', action: 'review', round: 1, turnIndex: 0,
    approved: false,
    feedback: 'The response is too clinical. Acknowledge the learner frustration explicitly before jumping to content.',
    latencyMs: 2100,
    metrics: { model: 'moonshot-ai/kimi-k2.5', inputTokens: 4000, outputTokens: 800, latencyMs: 2100, cost: 0.0015 },
  },
  {
    agent: 'ego', action: 'revise', round: 2, turnIndex: 0,
    suggestions: [{ title: 'Empathetic review', message: 'I hear you — feeling stuck is completely valid. Let us revisit the dialectic framework together.' }],
    latencyMs: 2800,
    metrics: { model: 'moonshot-ai/kimi-k2.5', inputTokens: 9200, outputTokens: 1500, latencyMs: 2800, cost: 0.0038 },
  },
  {
    agent: 'user', action: 'final_output', turnIndex: 0,
    contextSummary: 'Delivered 1 suggestion', detail: 'Turn 1 complete',
  },
  // Between-turn reflection
  {
    agent: 'ego_self_reflection', action: 'rewrite', turnIndex: 0,
    contextSummary: 'Ego self-reflection generated for turn 1',
    detail: 'I tried to validate frustration but fell into clinical language.',
    timestamp: '2026-02-14T10:00:00Z',
  },
  // Turn 2
  {
    agent: 'user', action: 'turn_action', turnIndex: 1,
    contextSummary: 'That helped a little but I am still confused about how thesis becomes antithesis.',
    timestamp: '2026-02-14T10:00:05Z',
  },
  {
    agent: 'ego', action: 'generate', round: 1, turnIndex: 1,
    suggestions: [{ title: 'Dialectic walkthrough', message: 'Great question! The thesis-antithesis transition happens when...' }],
    latencyMs: 4100,
    metrics: { model: 'moonshot-ai/kimi-k2.5', inputTokens: 12000, outputTokens: 2000, latencyMs: 4100, cost: 0.005 },
  },
];

describe('transcriptFormatter', () => {
  describe('wrapText', () => {
    it('wraps long lines at word boundaries', () => {
      const text = 'The quick brown fox jumps over the lazy dog and keeps running across the meadow';
      const result = wrapText(text, '  ', 40);
      const lines = result.split('\n');
      assert.ok(lines.every(l => l.length <= 40), `Some lines exceed 40 chars: ${lines.map(l => l.length)}`);
      assert.ok(lines.length > 1, 'Should produce multiple lines');
    });

    it('preserves existing line breaks', () => {
      const text = 'Line one\nLine two\nLine three';
      const result = wrapText(text, '', 80);
      assert.ok(result.includes('Line one'));
      assert.ok(result.includes('Line two'));
      assert.ok(result.includes('Line three'));
    });

    it('handles empty input', () => {
      assert.strictEqual(wrapText(''), '');
      assert.strictEqual(wrapText(null), '');
    });
  });

  describe('formatEntry', () => {
    it('formats ego generate with speaker and content', () => {
      const entry = sampleTrace[1]; // ego generate
      const result = formatEntry(entry);
      assert.ok(result.includes('TUTOR EGO (draft)'));
      assert.ok(result.includes('revisit the key concepts'));
    });

    it('formats superego review with aside direction', () => {
      const entry = sampleTrace[2]; // superego review, not approved
      const result = formatEntry(entry);
      assert.ok(result.includes('SUPEREGO'));
      assert.ok(result.includes('[aside, to Ego]'));
      assert.ok(result.includes('[REVISE]'));
    });

    it('formats approved superego review', () => {
      const entry = { ...sampleTrace[2], approved: true, feedback: 'Good response.' };
      const result = formatEntry(entry);
      assert.ok(result.includes('APPROVED'));
      assert.ok(!result.includes('[REVISE]'));
    });

    it('formats ego revision', () => {
      const entry = sampleTrace[3]; // ego revise
      const result = formatEntry(entry);
      assert.ok(result.includes('TUTOR EGO (revised)'));
      assert.ok(result.includes('feeling stuck is completely valid'));
    });

    it('returns null for final_output entries', () => {
      const entry = sampleTrace[4]; // final_output
      const result = formatEntry(entry);
      assert.strictEqual(result, null);
    });

    it('formats self-reflection with direction', () => {
      const entry = sampleTrace[5]; // ego_self_reflection
      const result = formatEntry(entry);
      assert.ok(result.includes('EGO'));
      assert.ok(result.includes('[reflecting]'));
      assert.ok(result.includes('clinical language'));
    });

    it('formats learner turn action', () => {
      const entry = sampleTrace[6]; // user turn_action
      const result = formatEntry(entry);
      assert.ok(result.includes('LEARNER'));
      // Text may be word-wrapped, so check the unwrapped content
      const flat = result.replace(/\n\s+/g, ' ');
      assert.ok(flat.includes('thesis becomes antithesis'));
    });

    it('shows metadata (model, tokens, time, cost) in play mode', () => {
      const entry = sampleTrace[1]; // ego generate with metrics
      const result = formatEntry(entry, { detail: 'play' });
      assert.ok(result.includes('kimi-k2.5'), 'Should show model alias');
      assert.ok(result.includes('8500in'), 'Should show input tokens');
      assert.ok(result.includes('1200out'), 'Should show output tokens');
      assert.ok(result.includes('3.2s'), 'Should show latency');
      assert.ok(result.includes('$0.0032'), 'Should show cost');
    });

    it('shows metadata in compact mode', () => {
      const entry = sampleTrace[2]; // superego review with metrics
      const result = formatEntry(entry, { detail: 'compact' });
      assert.ok(result.includes('kimi-k2.5'), 'Should show model in compact');
      assert.ok(result.includes('2.1s'), 'Should show latency in compact');
    });

    it('hides metadata in messages-only mode', () => {
      const entry = sampleTrace[1]; // ego generate with metrics
      const result = formatEntry(entry, { detail: 'messages-only' });
      assert.ok(!result.includes('kimi-k2.5'), 'Should not show model in messages-only');
      assert.ok(!result.includes('8500in'), 'Should not show tokens in messages-only');
    });

    it('shows extra details in full mode', () => {
      const entry = {
        ...sampleTrace[1],
        timestamp: '2026-02-14T10:00:00Z',
        metrics: { ...sampleTrace[1].metrics, generationId: 'gen-123', finishReason: 'stop' },
      };
      const result = formatEntry(entry, { detail: 'full' });
      assert.ok(result.includes('time=2026-02-14T10:00:00Z'), 'Should show timestamp in full mode');
      assert.ok(result.includes('gen=gen-123'), 'Should show generationId in full mode');
    });

    it('handles entries without metrics gracefully', () => {
      const entry = sampleTrace[5]; // self-reflection, no metrics
      const result = formatEntry(entry, { detail: 'play' });
      assert.ok(result.includes('EGO'));
      assert.ok(result.includes('clinical language'));
      // No crash, no metadata line
    });
  });

  describe('formatTranscript', () => {
    it('produces play format with ACT headers', () => {
      const result = formatTranscript(sampleTrace, {
        detail: 'play',
        scenarioName: 'Misconception correction',
        profileName: 'cell_5_recog_single_unified',
        totalTurns: 2,
      });
      assert.ok(result.includes('MISCONCEPTION CORRECTION (2-turn)'));
      assert.ok(result.includes('cell_5_recog_single_unified'));
      assert.ok(result.includes('ACT 1'));
      assert.ok(result.includes('ACT 2'));
      assert.ok(result.includes('intermission'));
    });

    it('hides draft when revision exists', () => {
      const result = formatTranscript(sampleTrace, { detail: 'messages-only' });
      // Turn 0: ego generate (draft) should be hidden because revision follows
      assert.ok(!result.includes('revisit the key concepts'), 'Draft should be hidden when revision exists');
      // But revision should be shown
      assert.ok(result.includes('feeling stuck is completely valid'));
    });

    it('shows draft when no revision follows', () => {
      const result = formatTranscript(sampleTrace, { detail: 'messages-only' });
      // Turn 1: ego generate has no revision, so it should show
      assert.ok(result.includes('thesis-antithesis transition'));
    });

    it('compact mode shows superego verdicts', () => {
      const result = formatTranscript(sampleTrace, { detail: 'compact' });
      assert.ok(result.includes('SUPEREGO'));
      assert.ok(result.includes('too clinical'));
    });

    it('compact mode hides intermission header but shows reflection one-liners', () => {
      const result = formatTranscript(sampleTrace, { detail: 'compact' });
      assert.ok(!result.includes('intermission'));
      assert.ok(result.includes('[EGO]'));
    });

    it('messages-only mode excludes reflections', () => {
      const result = formatTranscript(sampleTrace, { detail: 'messages-only' });
      assert.ok(!result.includes('intermission'));
      assert.ok(!result.includes('[reflecting]'));
    });

    it('handles empty trace', () => {
      assert.ok(formatTranscript([]).includes('empty trace'));
      assert.ok(formatTranscript(null).includes('empty trace'));
    });

    it('includes metadata in transcript entries', () => {
      const result = formatTranscript(sampleTrace, { detail: 'play' });
      assert.ok(result.includes('kimi-k2.5'), 'Should show model in play transcript');
    });
  });

  describe('formatCompactLine', () => {
    it('formats learner message', () => {
      const entry = sampleTrace[6]; // user turn_action
      const result = formatCompactLine(entry);
      assert.ok(result.includes('[LEARNER]'));
      assert.ok(result.includes('thesis becomes antithesis'));
    });

    it('formats superego review with metadata', () => {
      const entry = sampleTrace[2]; // superego review
      const result = formatCompactLine(entry);
      assert.ok(result.includes('[SUPEREGO REVISE]'));
      assert.ok(result.includes('kimi-k2.5'), 'Should include model in compact line');
    });

    it('formats tutor output with metadata', () => {
      // Entry without revision (turn 1 ego generate)
      const entry = { ...sampleTrace[7], _hasRevision: false };
      const result = formatCompactLine(entry);
      assert.ok(result.includes('[TUTOR]'));
      assert.ok(result.includes('kimi-k2.5'), 'Should include model in compact line');
    });

    it('returns null for final_output entries', () => {
      const entry = sampleTrace[4]; // final_output
      const result = formatCompactLine(entry);
      assert.strictEqual(result, null);
    });

    it('formats reflections as one-liners', () => {
      const entry = sampleTrace[5]; // ego_self_reflection
      const result = formatCompactLine(entry);
      assert.ok(result.includes('[EGO]'));
    });
  });

  describe('metadata formatting', () => {
    it('formats free model cost as null (not $0.0000)', () => {
      const entry = {
        agent: 'ego', action: 'generate', turnIndex: 0,
        suggestions: [{ message: 'Hello' }],
        metrics: { model: 'nvidia/nemotron:free', inputTokens: 100, outputTokens: 50, latencyMs: 500, cost: 0 },
      };
      const result = formatEntry(entry, { detail: 'play' });
      assert.ok(!result.includes('$0'), 'Should not show $0 cost');
      assert.ok(result.includes('nemotron'), 'Should show model');
    });

    it('formats sub-second latency in ms', () => {
      const entry = {
        agent: 'ego', action: 'generate', turnIndex: 0,
        suggestions: [{ message: 'Hello' }],
        metrics: { model: 'test-model', latencyMs: 450 },
      };
      const result = formatEntry(entry, { detail: 'play' });
      assert.ok(result.includes('450ms'), 'Should show ms for sub-second latency');
    });

    it('truncates long model names', () => {
      const entry = {
        agent: 'ego', action: 'generate', turnIndex: 0,
        suggestions: [{ message: 'Hello' }],
        metrics: { model: 'provider/very-long-model-name-that-exceeds-limits-v3' },
      };
      const result = formatEntry(entry, { detail: 'play' });
      assert.ok(result.includes('..'), 'Should truncate long model names');
    });
  });
});
