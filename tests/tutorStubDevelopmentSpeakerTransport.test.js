import assert from 'node:assert/strict';
import test from 'node:test';

import {
  renderTutorStubStreamLabel,
  resolveTutorStubDevelopmentDirectModel,
  TUTOR_STUB_DEVELOPMENT_SPEAKER_TRANSPORT_SCHEMA,
  tutorStubProviderSupportsEventStreaming,
  tutorStubProviderSupportsTokenStreaming,
} from '../services/tutorStubDevelopmentSpeakerTransport.js';

test('speaker transport capabilities distinguish token streams, Codex events, CLI bridges, and missing providers', () => {
  const isCli = (provider) => ['codex', 'claude-code', 'gemini-cli'].includes(provider);
  assert.equal(tutorStubProviderSupportsTokenStreaming({ provider: 'openai' }, { isCli }), true);
  assert.equal(tutorStubProviderSupportsTokenStreaming({ provider: 'codex' }, { isCli }), false);
  assert.equal(tutorStubProviderSupportsTokenStreaming({ provider: 'claude-code' }, { isCli }), false);
  assert.equal(tutorStubProviderSupportsTokenStreaming(null, { isCli }), false);
  assert.equal(tutorStubProviderSupportsEventStreaming({ provider: 'codex' }), true);
  assert.equal(tutorStubProviderSupportsEventStreaming({ provider: 'openai' }), false);
  assert.equal(tutorStubProviderSupportsEventStreaming(null), false);
});

test('stream labels preserve tutor, learner-analysis, DAG, classifier, and fallback copy with injected colors', () => {
  const colors = {
    brightMagenta: '<magenta>',
    bold: '<bold>',
    reset: '<reset>',
    cyan: '<cyan>',
  };
  assert.equal(renderTutorStubStreamLabel('tutor_stub_tutor', colors), '<magenta><bold>tutor ><reset> ');
  assert.equal(
    renderTutorStubStreamLabel('tutor_stub_learner_analysis', colors),
    '<cyan>learner analysis stream ><reset> ',
  );
  assert.equal(renderTutorStubStreamLabel('tutor_stub_learner_record', colors), '<cyan>learner DAG stream ><reset> ');
  assert.equal(
    renderTutorStubStreamLabel('tutor_stub_learner_classifier', colors),
    '<cyan>learner classifier stream ><reset> ',
  );
  assert.equal(renderTutorStubStreamLabel('custom_role', colors), '<cyan>custom_role ><reset> ');
});

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
