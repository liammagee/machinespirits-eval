/**
 * Tests for structureLearnerContext() — verifies that markdown learner context
 * is parsed into a structured XML summary block prepended to the original context.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { structureLearnerContext } from '../services/evaluationRunner.js';

// ---------------------------------------------------------------------------
// Edge cases: passthrough
// ---------------------------------------------------------------------------

describe('structureLearnerContext — passthrough cases', () => {
  it('returns null unchanged', () => {
    assert.strictEqual(structureLearnerContext(null), null);
  });

  it('returns undefined unchanged', () => {
    assert.strictEqual(structureLearnerContext(undefined), undefined);
  });

  it('returns non-string input unchanged', () => {
    assert.strictEqual(structureLearnerContext(42), 42);
  });

  it('returns original string when fewer than 2 extractable fields', () => {
    const input = 'Just a new user with no other signals';
    assert.strictEqual(structureLearnerContext(input), input);
  });
});

// ---------------------------------------------------------------------------
// Individual field extraction
// ---------------------------------------------------------------------------

describe('structureLearnerContext — field extraction', () => {
  it('extracts returning user with sessions and events', () => {
    const input = [
      '**Returning user** - 3 sessions, 28 total events',
      '**Struggle signals detected**: 4',
    ].join('\n');
    const result = structureLearnerContext(input);
    assert.ok(result.includes('Learner Type: Returning user, 3 sessions, 28 events'));
    assert.ok(result.includes('Struggle Signals: 4 detected'));
  });

  it('extracts struggle signals', () => {
    const input = [
      '**Returning user** - 5 sessions, 10 total events',
      '**Struggle signals detected**: 4',
    ].join('\n');
    const result = structureLearnerContext(input);
    assert.ok(result.includes('Struggle Signals: 4 detected'));
  });

  it('extracts activity retries from "retried N times" pattern', () => {
    const input = [
      '**Returning user** - 2 sessions, 15 total events',
      'The learner retried 3 times on quiz 1',
    ].join('\n');
    const result = structureLearnerContext(input);
    assert.ok(result.includes('Activity Retries: 3 retries'));
  });

  it('extracts activity retries from "Retrying activity" lines (fallback)', () => {
    const input = [
      '**Returning user** - 2 sessions, 15 total events',
      'Retrying activity - attempt 1',
      'Retrying activity - attempt 2',
    ].join('\n');
    const result = structureLearnerContext(input);
    assert.ok(result.includes('Activity Retries: 2 retries in timeline'));
  });

  it('extracts learner messages from chat history', () => {
    const input = [
      '**Returning user** - 1 sessions, 5 total events',
      '- User: "I don\'t understand recursion"',
      '- User: "Can you explain again?"',
    ].join('\n');
    const result = structureLearnerContext(input);
    assert.ok(result.includes("Learner Messages: I don't understand recursion | Can you explain again?"));
  });
});

// ---------------------------------------------------------------------------
// Full integration: structured summary block
// ---------------------------------------------------------------------------

describe('structureLearnerContext — full integration', () => {
  const fullContext = [
    '**Returning user** - 3 sessions, 28 total events',
    '**Currently viewing**: Introduction to Algorithms',
    '**Struggle signals detected**: 4',
    '**Primary struggle area**: recursion',
    'The learner retried 3 times on the quiz',
    '- User: "This is confusing"',
    '- User: "I need help"',
  ].join('\n');

  it('produces <structured_context_summary> XML block with expected fields', () => {
    const result = structureLearnerContext(fullContext);
    assert.ok(result.includes('<structured_context_summary>'));
    assert.ok(result.includes('</structured_context_summary>'));
    assert.ok(result.includes('Learner Type: Returning user, 3 sessions, 28 events'));
    assert.ok(result.includes('Current Content: Introduction to Algorithms'));
    assert.ok(result.includes('Struggle Signals: 4 detected'));
    assert.ok(result.includes('Primary Struggle: recursion'));
    assert.ok(result.includes('Activity Retries: 3 retries'));
    assert.ok(result.includes('Learner Messages: This is confusing | I need help'));
  });

  it('preserves original context verbatim after the summary block', () => {
    const result = structureLearnerContext(fullContext);
    assert.ok(result.endsWith(fullContext), 'original context should appear at the end unchanged');
  });
});
