import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REQUEST_PATH = path.join(ROOT, 'config', 'tutor-stub-resistant-profile-discrimination-study-go-request.v1.json');

function checkRequest(requestPath = REQUEST_PATH) {
  return JSON.parse(
    execFileSync(
      process.execPath,
      ['scripts/check-tutor-stub-resistant-profile-study-go-request.js', '--request', requestPath, '--json'],
      { cwd: ROOT, encoding: 'utf8' },
    ),
  );
}

test('study GO request binds the frozen packet and remains non-executable before human approval', () => {
  const report = checkRequest();

  assert.equal(report.status, 'HOLD_PENDING_EXPLICIT_HUMAN_APPROVAL');
  assert.equal(report.packetValid, true);
  assert.equal(report.readyForExplicitHumanApproval, true);
  assert.equal(report.explicitHumanApproval, false);
  assert.equal(report.modelCallsAuthorized, false);
  assert.equal(report.liveRunAuthorized, false);
  assert.equal(report.modelCalls, 0);
  assert.equal(report.productionWrites, 0);
  assert.equal(report.launchCommit, 'f95e245c8ef9dab1b9b3da374508f6efd6e90006');
  assert.equal(report.budget.maximumPlannedModelAttempts, 864);
  assert.equal(report.budget.retryOrResumeAuthority, 'none');
  assert.match(report.requestSha256, /^[0-9a-f]{64}$/u);
  assert.match(report.exactApprovalStatement, new RegExp(report.requestSha256, 'u'));
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
