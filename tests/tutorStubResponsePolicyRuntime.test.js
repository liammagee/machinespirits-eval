import assert from 'node:assert/strict';
import test from 'node:test';

import { createTutorStubResponsePolicy } from '../services/tutorStubResponsePolicy.js';

test('response policy owns combined-analysis register projection', () => {
  const policy = createTutorStubResponsePolicy();
  const selection = { engagement_stance: 'warm', source: 'combined' };

  assert.equal(policy.registerSelectionFromCombinedAnalysis({ parsed: { registerSelection: selection } }), selection);
  assert.equal(policy.registerSelectionFromCombinedAnalysis(null), null);
});

test('response policy formats ranked stance distributions at a bounded limit', () => {
  const policy = createTutorStubResponsePolicy();

  assert.equal(
    policy.formatEngagementStanceDistribution(
      [
        { register: 'warm', probability: 0.625 },
        { register: 'precise', probability: 0.25 },
        { register: 'plain', probability: 0.125 },
      ],
      { limit: 2 },
    ),
    'warm:63%, precise:25%',
  );
});
