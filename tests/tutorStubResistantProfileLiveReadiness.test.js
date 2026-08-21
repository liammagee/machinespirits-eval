import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  runPaidStudyEndpointPreflight,
  validatePaidStudyEndpointGoCertificate,
} from '../services/paidStudyEndpointPreflight.js';
import {
  assembleTutorStubResistantProfileDiscriminationPreflight,
  buildTutorStubResistantProfileDiscriminationPreflightPackets,
  buildTutorStubResistantProfileDiscriminationSyntheticCorpus,
  runTutorStubResistantProfileDiscriminationEndpointPreflight,
} from '../services/tutorStubResistantProfileDiscriminationPreflight.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONTRACT_PATH = path.join(ROOT, 'config/paid-study-endpoints/tutor-stub-resistant-profile-discrimination.json');
const CERTIFICATE_PATH = path.join(
  ROOT,
  'config/paid-study-endpoints/tutor-stub-resistant-profile-discrimination.endpoint-go.json',
);
const HOLD_PATH = path.join(ROOT, 'config/tutor-stub-resistant-profile-discrimination-live-readiness.hold.v1.json');
const AXIS_HOLD_PATH = path.join(ROOT, 'config/tutor-stub-resistance-axis-heldout-live-readiness.hold.v1.json');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

test('historical resistant-profile endpoint certificate fails closed after the public observer evolves', () => {
  const contract = readJson(CONTRACT_PATH);
  const certificate = readJson(CERTIFICATE_PATH);
  const preflight = runTutorStubResistantProfileDiscriminationEndpointPreflight(contract);
  const endpointGo = validatePaidStudyEndpointGoCertificate({ certificate, contract, preflight });

  assert.equal(preflight.status, 'passed');
  assert.equal(preflight.model_calls, 0);
  assert.equal(preflight.production_writes, 0);
  assert.equal(preflight.packet_audit.covered_cases, 18);
  assert.equal(preflight.packet_audit.packets, 6);
  assert.deepEqual(preflight.assembly_audit.endpoint_status, {
    pooled_profile_discrimination: 'complete',
    bored_contract_gate: 'complete',
    frame_defiant_contract_gate: 'complete',
  });
  const cases = buildTutorStubResistantProfileDiscriminationSyntheticCorpus();
  const assembled = assembleTutorStubResistantProfileDiscriminationPreflight({
    packets: buildTutorStubResistantProfileDiscriminationPreflightPackets(cases),
    contract,
  });
  assert.ok(assembled.report.gate.conditioned.profiles.every((row) => row.nearestNeighborEvaluable === false));
  assert.equal(endpointGo.ok, false);
  assert.ok(endpointGo.errors.some((error) => /preflight digest does not match/u.test(error)));
});

test('resistant-profile endpoint preflight fails closed on channel, event, packet, and assembly drift', () => {
  const baseline = readJson(CONTRACT_PATH);
  const cases = buildTutorStubResistantProfileDiscriminationSyntheticCorpus();
  const run = (contract, options = {}) =>
    runPaidStudyEndpointPreflight({
      contract,
      cases: options.cases || cases,
      buildPackets: options.buildPackets || buildTutorStubResistantProfileDiscriminationPreflightPackets,
      assemble: options.assemble || assembleTutorStubResistantProfileDiscriminationPreflight,
    });

  const disabledMarkers = structuredClone(baseline);
  disabledMarkers.channels.resistant_observation_markers.enabled = false;
  assert.throws(() => run(disabledMarkers), /required channel resistant_observation_markers is disabled/u);

  const missingTurns = structuredClone(cases);
  delete missingTurns[0].turns;
  assert.throws(() => run(baseline, { cases: missingTurns }), /missing required event turns/u);

  const tinyPacket = structuredClone(baseline);
  tinyPacket.runner.packet_cap_bytes = 100;
  assert.throws(() => run(tinyPacket), /exceeds 100-byte packet cap/u);

  const incompleteAssembler = (input) => {
    const assembled = assembleTutorStubResistantProfileDiscriminationPreflight(input);
    assembled.endpoint_status.bored_contract_gate = 'incomplete';
    return assembled;
  };
  assert.throws(() => run(baseline, { assemble: incompleteAssembler }), /did not complete bored_contract_gate/u);
});

test('historical resistant-profile readiness HOLD fails closed after the public observer evolves', () => {
  const result = spawnSync(
    process.execPath,
    ['scripts/check-tutor-stub-resistant-profile-live-readiness.js', '--json'],
    { cwd: ROOT, encoding: 'utf8' },
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /endpoint GO preflight digest does not match the executable preflight/u);
});

test('axis held-out readiness fails closed after its consumed route source evolves', () => {
  const result = spawnSync(
    process.execPath,
    ['scripts/check-tutor-stub-resistant-profile-live-readiness.js', '--hold', AXIS_HOLD_PATH, '--json'],
    { cwd: ROOT, encoding: 'utf8' },
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /source-closure SHA mismatch: services\/cliProviderBridge\.js/u);
});

test('live-readiness checker refuses a drifted HOLD packet before authorization', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'resistant-profile-readiness-hold-'));
  try {
    const hold = readJson(HOLD_PATH);
    hold.endpoint.preflightSha256 = '0'.repeat(64);
    const driftedPath = path.join(tmp, 'drifted-hold.json');
    fs.writeFileSync(driftedPath, `${JSON.stringify(hold, null, 2)}\n`);
    assert.throws(
      () =>
        execFileSync(
          process.execPath,
          ['scripts/check-tutor-stub-resistant-profile-live-readiness.js', '--hold', driftedPath, '--json'],
          { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' },
        ),
      /Command failed/u,
    );
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('live-readiness checker refuses a drifted committed route result', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'resistant-profile-route-result-'));
  try {
    const result = readJson(path.join(ROOT, 'config/tutor-stub-resistant-profile-route-canary-result.v1.json'));
    result.observed.model = 'gpt-5.6-sol';
    const driftedPath = path.join(tmp, 'drifted-result.json');
    fs.writeFileSync(driftedPath, `${JSON.stringify(result, null, 2)}\n`);
    assert.throws(
      () =>
        execFileSync(
          process.execPath,
          ['scripts/check-tutor-stub-resistant-profile-live-readiness.js', '--route-result', driftedPath, '--json'],
          { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' },
        ),
      /Command failed/u,
    );
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
