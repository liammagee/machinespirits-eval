import assert from 'node:assert/strict';
import { test } from 'node:test';
import { extractJsonEnvelope } from '../src/codexCli.js';
import { runAllWithCodex } from '../src/codexHarness.js';

test('extractJsonEnvelope parses fenced JSON', () => {
  const parsed = extractJsonEnvelope('```json\n{"ok":true,"score":5}\n```');
  assert.deepEqual(parsed, { ok: true, score: 5 });
});

test('extractJsonEnvelope repairs mildly malformed JSON', () => {
  const parsed = extractJsonEnvelope('result:\n{ok:true, score:5,}');
  assert.deepEqual(parsed, { ok: true, score: 5 });
});

test('codex dry-run harness attaches tutor and observer prompts without calling Codex', async () => {
  const [result] = await runAllWithCodex({
    scenarioId: 'polite_false_mastery_kt',
    dryRun: true,
  });
  assert.equal(result.llm.provider, 'codex-cli');
  assert.equal(result.llm.dryRun, true);
  assert.ok(result.turns[0].codexTutorPrompt.includes('You are playing the learner-facing tutor'));
  assert.ok(result.codexObserverPrompt.includes('You are an adaptation observer'));
  assert.equal(result.turns[0].tutorMessage, result.turns[0].deterministicTutorMessage);
});
