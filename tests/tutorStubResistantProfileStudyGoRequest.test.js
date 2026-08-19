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
  assert.match(result.stderr, /source-closure-services\/resistantLearnerObservation\.js/u);
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
