import assert from 'node:assert/strict';
import test from 'node:test';

import { getEngagementRegisterDefinitions } from '../services/engagementRegisterRegistry.js';
import {
  buildContinuousEngagementStanceVector,
  buildContinuousRegisterPolicyMetadata,
  buildContinuousRegisterVector,
  continuousEngagementStanceInstruction,
  continuousRegisterStyleInstruction,
} from '../services/tutorStubContinuousRegister.js';

test('continuous register vector normalizes safe anchors and excludes unsafe defaults', () => {
  const definitions = getEngagementRegisterDefinitions();
  const blend = buildContinuousEngagementStanceVector({
    definitions,
    palette: ['plain', 'precise', 'warm', 'sarcastic', 'face_threat'],
    scores: {
      sarcastic: 100,
      face_threat: 80,
      precise: 10,
      warm: 5,
      plain: 2,
    },
  });

  assert.equal(blend.selectedRegister, 'precise');
  assert.equal(blend.selectedEngagementStance, 'precise');
  assert.deepEqual(blend.engagementStanceVector, blend.vector);
  assert.ok(blend.rows.length > 0);
  assert.equal(blend.vector.sarcastic, undefined);
  assert.equal(blend.vector.face_threat, undefined);
  const total = Object.values(blend.vector).reduce((sum, value) => sum + Number(value || 0), 0);
  assert.ok(Math.abs(total - 1) < 0.0001);

  const instruction = continuousEngagementStanceInstruction(blend, definitions);
  const metadata = buildContinuousRegisterPolicyMetadata({
    blend,
    temperature: 0.4,
    styleInstruction: instruction,
  });
  assert.equal(metadata.mapping.type, 'continuous_softmax_affinity_matrix_with_empirical_correction');
  assert.equal(metadata.mapping.temperature, 0.4);
  assert.equal(metadata.mapping.unsafe_registers_allowed, false);
  assert.ok(metadata.style_instruction.includes('Continuous engagement-stance blend'));
  assert.deepEqual(metadata.engagement_stance_vector, metadata.register_vector);
  assert.equal(metadata.selected_engagement_stance, 'precise');
});

test('continuous empirical register metadata records corpus-prior mapping', () => {
  const definitions = getEngagementRegisterDefinitions();
  const blend = buildContinuousRegisterVector({
    definitions,
    palette: ['plain', 'precise', 'warm'],
    scores: { plain: 1, precise: 3, warm: 2 },
  });
  const metadata = buildContinuousRegisterPolicyMetadata({ blend, useCorpusPrior: true });

  assert.equal(metadata.mapping.type, 'continuous_softmax_affinity_matrix_with_local_and_corpus_empirical_correction');
  assert.equal(metadata.mapping.source_policy, 'empirical_dynamical_system');
  assert.equal(metadata.selected_anchor, 'precise');
  assert.equal(
    continuousRegisterStyleInstruction(blend, definitions),
    continuousEngagementStanceInstruction(blend, definitions),
  );
});
