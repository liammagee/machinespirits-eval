import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import test from 'node:test';

import * as wrapperV5 from '../scripts/build-tutor-stub-resistance-measurement-heldout-v5.js';
import * as wrapperV6 from '../scripts/build-tutor-stub-resistance-measurement-heldout-v6.js';
import * as wrapperV7 from '../scripts/build-tutor-stub-resistance-measurement-heldout-v7.js';
import * as wrapperV8 from '../scripts/build-tutor-stub-resistance-measurement-heldout-v8.js';
import {
  loadTutorStubResistanceMeasurementHeldoutConsumedCases,
  renderTutorStubResistanceMeasurementHeldoutCorpusBytes,
} from '../scripts/lib/tutorStubResistanceMeasurementHeldoutBuilder.js';
import { TUTOR_STUB_RESISTANCE_MEASUREMENT_HELDOUT_VERSIONS } from '../scripts/lib/tutorStubResistanceMeasurementHeldoutVersions.js';

const EXPECTED_CORPUS = Object.freeze({
  5: Object.freeze({
    bytes: 251334,
    sha256: 'e69a6672d1e9311ea55319d63a78fe46713af6d021848c3fe6cb15de04b00630',
  }),
  6: Object.freeze({
    bytes: 260700,
    sha256: '3aa4c5a5dc276f38f31e3067ea7c29b9399e12d9b7204ff22a875c64bc7a1c9a',
  }),
  7: Object.freeze({
    bytes: 258765,
    sha256: '60e8b32af3a1ed6990808c82f93560f8d5a681fd6e355b8fa25cf619116d7b5f',
  }),
  8: Object.freeze({
    bytes: 259824,
    sha256: '5e2dd09c861ccc22c110ea1ad75bfebc61d5eaa1962bd422e36d753115228201',
  }),
});

const WRAPPERS = Object.freeze({
  5: Object.freeze({
    module: wrapperV5,
    run: wrapperV5.runTutorStubResistanceMeasurementHeldoutV5Cli,
  }),
  6: Object.freeze({
    module: wrapperV6,
    run: wrapperV6.runTutorStubResistanceMeasurementHeldoutV6Cli,
  }),
  7: Object.freeze({
    module: wrapperV7,
    run: wrapperV7.runTutorStubResistanceMeasurementHeldoutV7Cli,
  }),
  8: Object.freeze({
    module: wrapperV8,
    run: wrapperV8.runTutorStubResistanceMeasurementHeldoutV8Cli,
  }),
});

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function assertDeepFrozen(value) {
  if (!value || typeof value !== 'object') return;
  assert.equal(Object.isFrozen(value), true);
  for (const child of Object.values(value)) assertDeepFrozen(child);
}

for (const version of [5, 6, 7, 8]) {
  test(`V${version} compatibility wrapper is side-effect-free and binds the matching frozen descriptor`, () => {
    const descriptor = TUTOR_STUB_RESISTANCE_MEASUREMENT_HELDOUT_VERSIONS[version];
    const wrapper = WRAPPERS[version];

    assertDeepFrozen(descriptor);
    assert.strictEqual(wrapper.module.TUTOR_STUB_RESISTANCE_MEASUREMENT_HELDOUT_DESCRIPTOR, descriptor);
    assert.equal(descriptor.version, version);
    assert.equal(typeof wrapper.run, 'function');
  });

  test(`V${version} shared heldout builder reproduces the sealed corpus bytes`, () => {
    const descriptor = TUTOR_STUB_RESISTANCE_MEASUREMENT_HELDOUT_VERSIONS[version];
    const consumedCases = loadTutorStubResistanceMeasurementHeldoutConsumedCases(descriptor);
    const rendered = renderTutorStubResistanceMeasurementHeldoutCorpusBytes(descriptor, consumedCases);
    const sealed = fs.readFileSync(descriptor.outputPath);

    assert.deepEqual(rendered, sealed);
    assert.equal(rendered.length, EXPECTED_CORPUS[version].bytes);
    assert.equal(sha256(rendered), EXPECTED_CORPUS[version].sha256);
  });
}
