import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { loadTutorStubResistanceSemanticValidationV4 } from '../services/tutorStubResistanceSemanticValidationV4.js';
import { buildTutorStubResistanceSemanticValidationPlan } from '../services/tutorStubResistanceSemanticValidationRuntime.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REQUEST_PATH = 'config/tutor-stub-resistance-semantic-adjudication-validation-study-go-request.v4.json';
const request = JSON.parse(fs.readFileSync(path.join(ROOT, REQUEST_PATH), 'utf8'));

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

test('v4 request remains frozen and fails closed after the prospective bridge repair', () => {
  assert.equal(request.status, 'go_under_standing_user_authority');
  assert.equal(sha256(request.authorization.text), request.authorization.textSha256);
  assert.equal(request.authorization.confirmationAuthorized, false);
  assert.equal(request.source.launchCommit, '2b734c5042603ec7cc18a6d11d9735253d9f3631');
  assert.equal(request.source.launchTree, '654038103babecc55059bbf72e9fb12c3c4e9c8e');
  assert.equal(request.source.closure.length, 19);
  const closureStatus = request.source.closure.map((artifact) => ({
    path: artifact.path,
    frozenSha256: artifact.sha256,
    currentSha256: sha256(fs.readFileSync(path.join(ROOT, artifact.path))),
  }));
  const drifted = closureStatus.filter((artifact) => artifact.currentSha256 !== artifact.frozenSha256);
  assert.deepEqual(
    drifted.map(({ path: artifactPath, frozenSha256 }) => ({ path: artifactPath, frozenSha256 })),
    [
      {
        path: 'services/cliProviderBridge.js',
        frozenSha256: '5f1274e28204a357e204eecfc4b76e95a733ba281c8e2f4de7e658efc76cd137',
      },
    ],
  );
  assert.notEqual(drifted[0].currentSha256, drifted[0].frozenSha256);
  assert.deepEqual(request.semanticAdjudicationValidation.judges, [
    'codex.gpt-5.6-sol',
    'claude-code.sonnet-5',
    'codex.gpt-5.5',
  ]);
  assert.equal(request.semanticAdjudicationValidation.componentDisagreementMayVetoPrimary, false);
  assert.equal(request.semanticAdjudicationValidation.regexOrKeywordAuthority, 'none');
  assert.equal(request.semanticAdjudicationValidation.historicalV1V2V3ReusePoolingOrRescoring, false);
  assert.deepEqual(request.budget, {
    plannedCases: 80,
    plannedModelCalls: 240,
    maximumReservationsPerPlannedCall: 3,
    maximumPlannedModelAttempts: 720,
    programmeLedgerBefore: 894,
    programmeLedgerAfterMaximum: 1614,
    programmeCeiling: 5000,
    retryOrResumeAuthority: 'bounded_technical_recovery',
  });
});

test('v4 request builds the registered blinded plan with zero model calls', () => {
  const loaded = loadTutorStubResistanceSemanticValidationV4();
  const requestSha256 = sha256(fs.readFileSync(path.join(ROOT, REQUEST_PATH)));
  const destination = path.resolve(ROOT, request.destination.artifactRoot);
  const plan = buildTutorStubResistanceSemanticValidationPlan({
    sourceCommit: request.source.launchCommit,
    sourceTree: request.source.launchTree,
    destination,
    goRequestPath: REQUEST_PATH,
    goRequestSha256: requestSha256,
    goRequest: request,
    loaded,
  });
  assert.equal(plan.cases.length, 80);
  assert.equal(plan.judges.length, 3);
  assert.equal(plan.budget.hard_reservation_ceiling, 720);
  assert.equal(JSON.stringify(plan).includes('"expected"'), false);
  assert.deepEqual(request.commands.preflight.slice(0, 3), [
    'node',
    'scripts/run-tutor-stub-resistance-semantic-validation.js',
    '--preflight',
  ]);
  assert.equal(request.destination.mustNotExistBeforeLaunch, true);
  assert.equal(request.claimBoundary.confirmationBlockedUnlessAllV4GatesPass, true);
});
