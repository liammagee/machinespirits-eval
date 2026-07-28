import assert from 'node:assert/strict';
import test from 'node:test';

import { buildTutorStubRegisterPalette } from '../services/tutorStubRegisterPalette.js';

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
