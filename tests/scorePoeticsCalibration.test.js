import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { parseJsonResponse, withScorerRetry, isTransientScorerError } from '../scripts/score-poetics-calibration.js';

test('poetics scorer JSON parser repairs raw LaTeX backslashes in model evidence', () => {
  const parsed = parseJsonResponse(
    '{"pivot_learner_turn":3,"recontextualization":{"evidence":"\\(\\sqrt{2}\\) starts from a fraction assumption"}}',
  );

  assert.equal(parsed.pivot_learner_turn, 3);
  assert.equal(parsed.recontextualization.evidence, '(sqrt{2}) starts from a fraction assumption');
});

test('withScorerRetry retries a transient failure then succeeds, reporting retryCount (FIX 4)', async () => {
  let calls = 0;
  const { value, retryCount } = await withScorerRetry(
    async () => {
      calls += 1;
      if (calls < 2) throw new Error('OpenRouter 503: upstream');
      return 'ok';
    },
    { backoffMs: 0 },
  );
  assert.equal(value, 'ok');
  assert.equal(retryCount, 1);
  assert.equal(calls, 2);
});

test('withScorerRetry fails fast (no retry) on a deterministic error (FIX 4)', async () => {
  let calls = 0;
  await assert.rejects(
    () =>
      withScorerRetry(
        async () => {
          calls += 1;
          throw new Error('Unknown model: nope');
        },
        { backoffMs: 0 },
      ),
    /Unknown model/,
  );
  assert.equal(calls, 1, 'a deterministic error is not retried');
});

test('withScorerRetry exhausts attempts on a persistent transient failure, attaching retryCount (FIX 4)', async () => {
  let calls = 0;
  await assert.rejects(
    () =>
      withScorerRetry(
        async () => {
          calls += 1;
          throw new Error('No content in response');
        },
        { attempts: 3, backoffMs: 0 },
      ),
    (err) => err.retryCount === 2 && /No content/.test(err.message),
  );
  assert.equal(calls, 3);
});

test('isTransientScorerError classifies transient vs deterministic scorer failures (FIX 4)', () => {
  for (const m of [
    'No content in response',
    'OpenRouter 429: rate limited',
    'OpenRouter 502: bad gateway',
    'Failed to parse JSON: ...',
    'request aborted',
    'ETIMEDOUT',
  ]) {
    assert.equal(isTransientScorerError(new Error(m)), true, `transient: ${m}`);
  }
  for (const m of [
    'OPENROUTER_API_KEY not set',
    'Unknown model: x',
    'OpenRouter 401: unauthorized',
    'OpenRouter 400: bad request',
  ]) {
    assert.equal(isTransientScorerError(new Error(m)), false, `deterministic: ${m}`);
  }
});
