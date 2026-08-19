import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
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

test('resistant-profile endpoint preflight completes all co-primary endpoints at full scale with zero calls', () => {
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
  assert.equal(endpointGo.ok, true, endpointGo.errors.join('; '));
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

test('live-readiness checker validates the exact command and consumed canary while retaining study HOLD', () => {
  const report = JSON.parse(
    execFileSync(process.execPath, ['scripts/check-tutor-stub-resistant-profile-live-readiness.js', '--json'], {
      cwd: ROOT,
      encoding: 'utf8',
    }),
  );

  assert.equal(report.status, 'HOLD');
  assert.equal(report.packetValid, true);
  assert.equal(report.readyForAuthorizationRequest, false);
  assert.equal(report.routeVerificationPassed, true);
  assert.equal(report.readyForStudyGoPreparation, true);
  assert.equal(report.liveRunAuthorized, false);
  assert.equal(report.modelCalls, 0);
  assert.equal(report.recordedRouteCanaryModelCalls, 1);
  assert.equal(report.productionWrites, 0);
  assert.equal(report.endpointPreflight.registered_scale.cases, 18);
  assert.ok(!report.proposedCommands.live.includes('--dry-run'));
  assert.ok(!report.proposedCommands.live.includes('--no-ledger'));
  assert.equal(
    report.proposedCommands.live[report.proposedCommands.live.indexOf('--trace-dir') + 1],
    '.tutor-stub-auto-eval/resistant-profile-discrimination-v1-live-2026-08-19',
  );
  assert.ok(report.blockers.some((blocker) => /explicit human approval/u.test(blocker)));
  assert.equal(report.routeCanaryResult.status, 'passed');
  assert.equal(report.routeCanaryResult.modelCalls, 1);
  assert.equal(report.routeCanaryResult.observed.provider, 'codex');
  assert.equal(report.routeCanaryResult.observed.model, 'gpt-5.6-luna');
  assert.equal(report.routeCanaryResult.observed.prohibitedToolEventCount, 0);
  assert.equal(report.routeCanaryResult.observed.modelIndependentlyAttested, false);
  assert.equal(
    report.routeCanaryResult.sourceArtifactSha256,
    'a2989dfb48438b7153928244a20ef42f698122b6edb3062fdfecca41ca1ac55f',
  );
  assert.equal(report.routeCanaryResult.authorizationConsumption.status, 'CONSUMED_AFTER_ONE_CALL');
  assert.match(report.routeCanaryResult.authorizationConsumptionSha256, /^[0-9a-f]{64}$/u);
  assert.equal(
    fs.existsSync(path.join(ROOT, 'config/tutor-stub-resistant-profile-route-canary-authorization.v1.json')),
    false,
  );
});

test('axis held-out readiness reuses the consumed route with low trust diagnostic-only', () => {
  const report = JSON.parse(
    execFileSync(
      process.execPath,
      ['scripts/check-tutor-stub-resistant-profile-live-readiness.js', '--hold', AXIS_HOLD_PATH, '--json'],
      { cwd: ROOT, encoding: 'utf8' },
    ),
  );

  assert.equal(report.status, 'HOLD');
  assert.equal(report.packetValid, true);
  assert.equal(report.readyForStudyGoPreparation, true);
  assert.equal(report.liveRunAuthorized, false);
  assert.equal(report.modelCalls, 0);
  assert.equal(report.recordedRouteCanaryModelCalls, 1);
  assert.equal(report.productionWrites, 0);
  assert.deepEqual(report.endpointPreflight.assembly_audit.endpoint_status, {
    bored_effort_investment_gate: 'complete',
    frame_legitimacy_gate: 'complete',
    low_trust_epistemic_trust_diagnostic: 'complete',
  });
  assert.match(report.proposedCommands.analyze[2], /resistance-axis-discrimination\.json/u);
  assert.doesNotMatch(report.proposedCommands.analyze[2], /profile-discrimination\.json/u);
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
