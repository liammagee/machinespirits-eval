import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { loadTutorStubResistanceRecoverySemanticValidationV3 } from '../services/tutorStubResistanceRecoverySemanticValidationV3.js';
import { buildTutorStubResistanceRecoverySemanticValidationPlan } from '../services/tutorStubResistanceRecoverySemanticValidationRuntime.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REQUEST_PATH = 'config/tutor-stub-resistance-recovery-semantic-adjudication-validation-study-go-request.v3.json';
const request = JSON.parse(fs.readFileSync(path.join(ROOT, REQUEST_PATH), 'utf8'));

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

test('v3 outcome request remains frozen and fails closed after the prospective bridge repair', () => {
  assert.equal(request.status, 'go_under_standing_user_authority');
  assert.equal(sha256(request.authorization.text), request.authorization.textSha256);
  assert.equal(request.authorization.confirmationAuthorized, false);
  assert.equal(request.source.launchCommit, 'd6461e340122a5f0c2b5da0bfd6d027cc12f60cc');
  assert.equal(request.source.launchTree, 'a4a0f718edfff82110b0743f953d7ad195bc0549');
  assert.equal(request.source.closure.length, 18);
  const closureStatus = request.source.closure.map((artifact) => ({
    path: artifact.path,
    frozenSha256: artifact.sha256,
    currentSha256: sha256(fs.readFileSync(path.join(ROOT, artifact.path))),
  }));
  const drifted = closureStatus.filter((artifact) => artifact.currentSha256 !== artifact.frozenSha256);
  assert.deepEqual(drifted, [
    {
      path: 'services/cliProviderBridge.js',
      frozenSha256: '5f1274e28204a357e204eecfc4b76e95a733ba281c8e2f4de7e658efc76cd137',
      currentSha256: 'f15cee894143b40b97d50e8584a12888b6ceae33354b59a4963c9e16b794b868',
    },
  ]);
  assert.deepEqual(request.outcomeSemanticAdjudicationValidation.judges, [
    'codex.gpt-5.6-sol',
    'claude-code.sonnet-5',
    'codex.gpt-5.5',
  ]);
  assert.equal(request.outcomeSemanticAdjudicationValidation.componentDisagreementMayVetoPrimary, false);
  assert.equal(request.outcomeSemanticAdjudicationValidation.regexOrKeywordAuthority, 'none');
  assert.equal(request.outcomeSemanticAdjudicationValidation.historicalV1V2PartialReusePoolingOrRescoring, false);
  assert.deepEqual(request.budget, {
    plannedCases: 120,
    plannedModelCalls: 360,
    maximumReservationsPerPlannedCall: 3,
    maximumPlannedModelAttempts: 1080,
    programmeLedgerBefore: 1136,
    programmeLedgerAfterMaximum: 2216,
    programmeCeiling: 5000,
    retryOrResumeAuthority: 'bounded_technical_recovery',
  });
});

test('v3 outcome request builds the registered blinded plan with zero model calls', () => {
  const loaded = loadTutorStubResistanceRecoverySemanticValidationV3();
  const requestSha256 = sha256(fs.readFileSync(path.join(ROOT, REQUEST_PATH)));
  const destination = path.resolve(ROOT, request.destination.artifactRoot);
  const plan = buildTutorStubResistanceRecoverySemanticValidationPlan({
    sourceCommit: request.source.launchCommit,
    sourceTree: request.source.launchTree,
    destination,
    goRequestPath: REQUEST_PATH,
    goRequestSha256: requestSha256,
    goRequest: request,
    loaded,
  });
  assert.equal(plan.cases.length, 120);
  assert.equal(plan.judges.length, 3);
  assert.equal(plan.budget.hard_reservation_ceiling, 1080);
  assert.equal(JSON.stringify(plan).includes('"expected"'), false);
  assert.deepEqual(request.commands.preflight.slice(0, 3), [
    'node',
    'scripts/run-tutor-stub-resistance-recovery-semantic-validation.js',
    '--preflight',
  ]);
  assert.equal(request.destination.mustNotExistBeforeLaunch, true);
  assert.equal(request.claimBoundary.confirmationBlockedUnlessAllV3GatesPass, true);
});
