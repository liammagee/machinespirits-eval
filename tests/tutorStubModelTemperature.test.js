import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  effectiveTutorStubModelTemperature,
  usesFixedTutorStubModelTemperature,
} from '../services/tutorStubModelTemperature.js';

test('OpenAI GPT-5 family routes use their fixed temperature', () => {
  for (const model of ['gpt-5', 'gpt-5-mini', 'gpt-5.6']) {
    const resolved = { provider: 'openai', model };
    assert.equal(usesFixedTutorStubModelTemperature(resolved), true, model);
    assert.equal(effectiveTutorStubModelTemperature(resolved, 0.1), 1, model);
  }
});

test('other providers and model families preserve the requested temperature', () => {
  for (const resolved of [
    { provider: 'openai', model: 'gpt-4.1' },
    { provider: 'openai', model: 'gpt-50' },
    { provider: 'openrouter', model: 'gpt-5' },
    { provider: 'codex', model: 'gpt-5.6-terra' },
  ]) {
    assert.equal(usesFixedTutorStubModelTemperature(resolved), false, `${resolved.provider}.${resolved.model}`);
    assert.equal(effectiveTutorStubModelTemperature(resolved, 0.37), 0.37);
  }
});

test('the CLI imports rather than redeclares the model-temperature policy', () => {
  const source = fs.readFileSync(new URL('../scripts/tutor-stub.js', import.meta.url), 'utf8');
  assert.match(source, /effectiveTutorStubModelTemperature as effectiveTemperatureForModel/u);
  assert.doesNotMatch(source, /function (?:usesFixedOpenAITemperature|effectiveTemperatureForModel)\(/u);
});
