import assert from 'node:assert/strict';
import test from 'node:test';

import {
  resolveTutorStubDevelopmentDirectModel,
  TUTOR_STUB_DEVELOPMENT_SPEAKER_TRANSPORT_SCHEMA,
} from '../services/tutorStubDevelopmentSpeakerTransport.js';

test('development direct transport resolves a configured non-CLI model without acceptance authority', () => {
  const result = resolveTutorStubDevelopmentDirectModel({
    modelRef: 'openai.standard',
    developmentSeed: '20269901',
    resolve: () => ({ provider: 'openai', model: 'gpt-test', isConfigured: true }),
  });
  assert.deepEqual(result, {
    schema: TUTOR_STUB_DEVELOPMENT_SPEAKER_TRANSPORT_SCHEMA,
    kind: 'direct_provider_development_non_equivalent',
    requestedModelRef: 'openai.standard',
    provider: 'openai',
    model: 'gpt-test',
    acceptanceEligible: false,
    consumesHeldOutOrAcceptanceSeed: false,
    equivalentToCodexCliTransport: false,
  });
});

test('development direct transport requires a seed and fails closed on CLI or unavailable providers', () => {
  assert.throws(
    () => resolveTutorStubDevelopmentDirectModel({ modelRef: 'openai.standard' }),
    /requires an explicit non-held-out --development-seed/u,
  );
  assert.throws(
    () =>
      resolveTutorStubDevelopmentDirectModel({
        modelRef: 'codex.gpt-5.6-terra',
        developmentSeed: '1',
        resolve: () => ({ provider: 'codex', model: 'gpt-5.6-terra', isConfigured: true }),
      }),
    /must resolve to a non-CLI provider/u,
  );
  assert.throws(
    () =>
      resolveTutorStubDevelopmentDirectModel({
        modelRef: 'openai.standard',
        developmentSeed: '1',
        resolve: () => ({ provider: 'openai', model: 'gpt-test', isConfigured: false }),
      }),
    /credentials are not configured/u,
  );
});

test('empty direct model leaves the frozen transport unchanged', () => {
  assert.equal(resolveTutorStubDevelopmentDirectModel(), null);
});
