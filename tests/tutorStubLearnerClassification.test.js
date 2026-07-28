import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { buildTutorStubFailedClassification } from '../services/tutorStubLearnerClassification.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('failed classification preserves conservative public fallback and supplied metadata', () => {
  const usage = { inputTokens: 12, outputTokens: 3, totalTokens: 15, cost: 0.001 };
  assert.deepEqual(
    buildTutorStubFailedClassification({
      message: 'provider unavailable',
      resolved: { provider: 'codex', model: 'gpt-5.6-sol' },
      latencyMs: 41,
      usage,
    }),
    {
      error: 'provider unavailable',
      turn: {
        summary: 'Classifier failed before the tutor turn.',
        request_type: 'off_task_or_mixed',
        discourse_move: 'unknown',
        evidence_use: 'unknown',
        epistemic_stance: 'unknown',
        affect: 'unknown',
        agency: 'unknown',
        scores: {},
        pedagogical_need: 'Proceed cautiously and use the learner input directly.',
      },
      overall: {
        summary: 'Overall classification is unavailable because the classifier failed.',
        trajectory: 'unknown',
        recurring_pattern: 'unknown',
        current_state: 'unknown',
        next_best_tutor_move: 'Ask a focused diagnostic question.',
      },
      provider: 'codex',
      model: 'gpt-5.6-sol',
      latencyMs: 41,
      usage,
    },
  );
});

test('failed classification preserves null route metadata and fresh zero-usage defaults', () => {
  const first = buildTutorStubFailedClassification({ message: 'first' });
  const second = buildTutorStubFailedClassification({ message: 'second' });

  assert.deepEqual(first.usage, { inputTokens: 0, outputTokens: 0, totalTokens: 0, cost: 0 });
  assert.equal(first.provider, null);
  assert.equal(first.model, null);
  assert.equal(first.latencyMs, 0);
  assert.notEqual(first.usage, second.usage);
  assert.notEqual(first.turn, second.turn);
});

test('the CLI imports rather than redeclares failed-classification construction', () => {
  const cliSource = fs.readFileSync(path.join(ROOT, 'scripts', 'tutor-stub.js'), 'utf8');
  const serviceSource = fs.readFileSync(path.join(ROOT, 'services', 'tutorStubLearnerClassification.js'), 'utf8');

  assert.match(cliSource, /buildTutorStubFailedClassification as failedClassification/u);
  assert.doesNotMatch(cliSource, /function failedClassification/u);
  assert.doesNotMatch(serviceSource, /^import\s/mu);
  assert.doesNotMatch(serviceSource, /\b(?:fs|console|process|fetch|Date\.now)\s*[.(]/u);
});
