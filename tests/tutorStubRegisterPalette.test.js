import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildTutorStubRegisterPalette,
  createTutorStubRegisterPromptVocabulary,
  summarizeTutorStubEngagementStanceDefinition,
} from '../services/tutorStubRegisterPalette.js';

const definitions = Object.freeze({
  plain: Object.freeze({ simulated_only: false }),
  warm: Object.freeze({}),
  ironic: Object.freeze({ simulated_only: true }),
});
const options = Object.freeze({
  definitions,
  safeNames: Object.freeze(['plain', 'warm']),
  negativeFloorNames: Object.freeze(['ironic']),
  resolveStance: (name) => ({ register: name === 'friendly' ? 'warm' : name }),
});

test('register palette preserves named modes, order, aliases, and de-duplication', () => {
  assert.deepEqual(buildTutorStubRegisterPalette('all', options), ['plain', 'warm', 'ironic']);
  assert.deepEqual(buildTutorStubRegisterPalette('simulated', options), ['plain', 'warm', 'ironic']);
  assert.deepEqual(buildTutorStubRegisterPalette('safe', options), ['plain', 'warm']);
  assert.deepEqual(buildTutorStubRegisterPalette('router', options), ['plain', 'warm']);
  assert.deepEqual(buildTutorStubRegisterPalette('positive', options), ['plain', 'warm']);
  assert.deepEqual(buildTutorStubRegisterPalette('negative-floor', options), ['ironic']);
  assert.deepEqual(buildTutorStubRegisterPalette('non-simulated', options), ['plain', 'warm']);
  assert.deepEqual(buildTutorStubRegisterPalette(' friendly, plain, warm ', options), ['warm', 'plain']);
});

test('register palette preserves defaults and exact unknown-register diagnostics', () => {
  assert.deepEqual(buildTutorStubRegisterPalette('', options), ['plain', 'warm', 'ironic']);
  assert.throws(
    () => buildTutorStubRegisterPalette('missing, plain', options),
    /Unknown --register-palette register\(s\): missing\. Known: plain, warm, ironic/u,
  );
});

test('register prompt vocabulary preserves stance defaults, optional fields, and request roles', () => {
  const stanceDefinitions = {
    plain: {
      valence: 'positive',
      router_selectable: true,
      public_signature: '  direct and calm  ',
      reviewer_cues: ['repair'],
      required_moves: ['acknowledge'],
    },
    sparse: { trigger: 'uncertainty', simulated_only: true },
  };
  const vocabulary = createTutorStubRegisterPromptVocabulary({
    getEngagementStanceDefinition: (name) => stanceDefinitions[name],
    getRequestTypeDefinitions: () => ({
      explain: { description: 'Explain a term.', dag_use: 'hold current node' },
      infer: { role: 'evidence_request' },
    }),
  });

  assert.deepEqual(
    summarizeTutorStubEngagementStanceDefinition('plain', {
      getDefinition: (name) => stanceDefinitions[name],
    }),
    {
      register: 'plain',
      valence: 'positive',
      router_selectable: true,
      simulated_only: false,
      public_signature: 'direct and calm',
      contrast: null,
      reviewer_cues: ['repair'],
      stance_contract: '',
      required_moves: ['acknowledge'],
      risk_flags: [],
      forbidden_phrases: [],
      recognition_guardrail: null,
    },
  );
  assert.equal(vocabulary.engagementStanceDefinitionSummary('missing').valence, 'unknown');
  assert.deepEqual(
    JSON.parse(vocabulary.engagementStancePalettePromptRows(['plain', 'sparse'])).map((row) => row.register),
    ['plain', 'sparse'],
  );
  assert.deepEqual(JSON.parse(vocabulary.requestTypePromptRows()), [
    {
      request_type: 'explain',
      role: 'logical_armature',
      description: 'Explain a term.',
      dag_use: 'hold current node',
    },
    { request_type: 'infer', role: 'evidence_request', description: '', dag_use: '' },
  ]);
  assert.equal(Object.isFrozen(vocabulary), true);
});

test('empty request registry retains the exact prompt fallback', () => {
  const vocabulary = createTutorStubRegisterPromptVocabulary({
    getEngagementStanceDefinition: () => null,
    getRequestTypeDefinitions: () => ({}),
  });
  assert.equal(vocabulary.requestTypePromptRows(), 'No request-type registry is configured.');
});
