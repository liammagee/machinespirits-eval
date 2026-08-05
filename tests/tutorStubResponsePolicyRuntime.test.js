import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { createTutorStubResponsePolicy } from '../services/tutorStubResponsePolicy.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function serviceSource(fileName) {
  return readFileSync(path.join(ROOT, 'services', fileName), 'utf8');
}

test('response-policy facade delegates to three bounded implementation owners', () => {
  const facade = serviceSource('tutorStubResponsePolicy.js');
  const owners = [
    ['tutorStubResponsePolicySelectionRuntime.js', 'createTutorStubResponsePolicySelectionRuntime'],
    ['tutorStubAdaptiveResponsePolicyRuntime.js', 'createTutorStubAdaptiveResponsePolicyRuntime'],
    ['tutorStubResponseConfigurationSelectionRuntime.js', 'createTutorStubResponseConfigurationSelectionRuntime'],
  ];

  for (const [fileName, factoryName] of owners) {
    const source = serviceSource(fileName);
    assert.match(facade, new RegExp(`import \\{ ${factoryName} \\}`));
    assert.match(source, new RegExp(`export function ${factoryName}\\(`));
    assert.ok(source.split('\n').length <= 1200, `${fileName} must remain within the 1,200-line owner ceiling`);
  }

  assert.doesNotMatch(facade, /function fallbackRegisterSelection\(/u);
  assert.doesNotMatch(facade, /function fieldEngagementStanceSelection\(/u);
  assert.doesNotMatch(facade, /function normalizeResponseConfigurationSelection\(/u);
});

test('response-policy facade preserves its public method contract', () => {
  assert.deepEqual(Object.keys(createTutorStubResponsePolicy()), [
    'registerSelectionFromCombinedAnalysis',
    'evaluatePendingRegisterEfficacy',
    'policySamplingContext',
    'explicitPerformanceDirectiveValue',
    'resolveTutorStubCharacterChoice',
    'explicitPerformanceActorialPartSelection',
    'performanceTemperatureScope',
    'randomPerformanceActorialPartSelection',
    'formatEngagementStanceDistribution',
    'normalizeResponseConfigurationSelection',
  ]);
});

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
