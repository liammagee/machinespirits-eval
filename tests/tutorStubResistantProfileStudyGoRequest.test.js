import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REQUEST_PATH = path.join(ROOT, 'config', 'tutor-stub-resistant-profile-discrimination-study-go-request.v1.json');
const REPLACEMENT_REQUEST_PATH = path.join(
  ROOT,
  'config',
  'tutor-stub-frame-defiant-replacement-study-go-request.v1.json',
);
const MEASUREMENT_RECHECK_REQUEST_PATH = path.join(
  ROOT,
  'config',
  'tutor-stub-resistant-profile-measurement-recheck-study-go-request.v1.json',
);

function checkRequest(requestPath) {
  return JSON.parse(
    execFileSync(
      process.execPath,
      ['scripts/check-tutor-stub-resistant-profile-study-go-request.js', '--request', requestPath, '--json'],
      { cwd: ROOT, encoding: 'utf8' },
    ),
  );
}

test('approved study request remains bound to its launch source and fails closed after source drift', () => {
  const requestBytes = fs.readFileSync(REQUEST_PATH);
  const request = JSON.parse(requestBytes.toString('utf8'));

  assert.equal(
    crypto.createHash('sha256').update(requestBytes).digest('hex'),
    'ac077d68e3f64c6f49b298bb12cbb5af79ac3d5d6ef8ce0476cb45c2044d2dbb',
  );
  assert.equal(request.source.launchCommit, 'ae940515978030c7f9db1ea72c4c42a647034272');
  assert.equal(request.authorization.liveRunAuthorized, false);
  assert.equal(request.budget.maximumPlannedModelAttempts, 864);
  assert.equal(request.budget.retryOrResumeAuthority, 'none');

  for (const binding of request.source.closure) {
    const launchBytes = execFileSync('git', ['show', `${request.source.launchCommit}:${binding.path}`], { cwd: ROOT });
    assert.equal(
      crypto.createHash('sha256').update(launchBytes).digest('hex'),
      binding.sha256,
      `${binding.path} must remain bound to the approved launch commit`,
    );
  }

  const result = spawnSync(
    process.execPath,
    ['scripts/check-tutor-stub-resistant-profile-study-go-request.js', '--request', REQUEST_PATH, '--json'],
    { cwd: ROOT, encoding: 'utf8' },
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /source-closure-scripts\/analyze-tutor-stub-profile-discrimination\.js/u);
});

test('study GO request fails closed on a drifted source binding', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'resistant-profile-study-go-'));
  try {
    const request = JSON.parse(fs.readFileSync(REQUEST_PATH, 'utf8'));
    request.source.closure[0].sha256 = '0'.repeat(64);
    const driftedPath = path.join(tmp, 'drifted-request.json');
    fs.writeFileSync(driftedPath, `${JSON.stringify(request, null, 2)}\n`);
    const result = spawnSync(
      process.execPath,
      ['scripts/check-tutor-stub-resistant-profile-study-go-request.js', '--request', driftedPath, '--json'],
      { cwd: ROOT, encoding: 'utf8' },
    );
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /source-closure-scripts\/run-tutor-stub-qa-matrix\.js/u);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('consumed frame-defiant replacement request remains frozen and fails closed after source drift', () => {
  const requestBytes = fs.readFileSync(REPLACEMENT_REQUEST_PATH);
  const request = JSON.parse(fs.readFileSync(REPLACEMENT_REQUEST_PATH, 'utf8'));

  assert.equal(
    crypto.createHash('sha256').update(requestBytes).digest('hex'),
    '0e022c64ef109b9631cbb544ba0b3c47baee61c44d477a45b4481efaa94e0f35',
  );
  assert.equal(request.source.launchCommit, '6dbec4cb49a47eca415f77e2324be57a6e1d6f45');
  assert.equal(request.budget.maximumPlannedModelAttempts, 144);
  assert.equal(request.budget.retryOrResumeAuthority, 'none');
  assert.equal(request.replacement.retainedPriorTraces.length, 15);
  assert.equal(request.replacement.excludedPriorTraces.length, 3);
  assert.ok(request.replacement.excludedPriorTraces.every((entry) => entry.profile === 'frame_defiant'));

  const result = spawnSync(
    process.execPath,
    ['scripts/check-tutor-stub-resistant-profile-study-go-request.js', '--request', REPLACEMENT_REQUEST_PATH, '--json'],
    { cwd: ROOT, encoding: 'utf8' },
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /source-closure-scripts\/analyze-tutor-stub-profile-discrimination\.js/u);
});

test('fresh measurement recheck freezes a new 18-dialogue cohort without rewriting prior evidence', () => {
  const report = checkRequest(MEASUREMENT_RECHECK_REQUEST_PATH);
  const request = JSON.parse(fs.readFileSync(MEASUREMENT_RECHECK_REQUEST_PATH, 'utf8'));

  assert.equal(report.status, 'HOLD_PENDING_EXPLICIT_HUMAN_APPROVAL');
  assert.equal(report.packetValid, true);
  assert.equal(report.readyForExplicitHumanApproval, true);
  assert.equal(report.explicitHumanApproval, false);
  assert.equal(report.modelCallsAuthorized, false);
  assert.equal(report.liveRunAuthorized, false);
  assert.equal(report.modelCalls, 0);
  assert.equal(report.productionWrites, 0);
  assert.equal(report.launchCommit, '0f7ff1b3d0e1ca0146a519f06914f3d6e1cdcd4d');
  assert.equal(report.budget.maximumPlannedModelAttempts, 864);
  assert.equal(report.budget.retryOrResumeAuthority, 'none');
  assert.equal(request.recheck.priorArtifactsReused, false);
  assert.equal(request.recheck.priorResultRewritten, false);
  assert.equal(request.recheck.thresholdsChanged, false);
  assert.equal(
    request.recheck.priorCanonicalReport.sha256,
    '06d7bbc49df46e2f20ebeb3eb0141dba975825ce10bf33eef0e0dc15540ec32c',
  );
  assert.equal(request.measurement.reportSchema, 'machinespirits.tutor-stub.profile-discrimination.v4');
  assert.equal(request.measurement.nearestNeighborAnchorMinimumSignatureTargetPassRate, 0.4);
  assert.doesNotMatch(request.commands.analyze[2], /--trace-root/u);
  assert.match(report.requestSha256, /^[0-9a-f]{64}$/u);
  assert.match(report.exactApprovalStatement, new RegExp(report.requestSha256, 'u'));
  assert.match(report.exactApprovalStatement, /one 18-dialogue Luna study/u);
  assert.match(report.exactApprovalStatement, /hard ceiling of 864 model attempts/u);
});
