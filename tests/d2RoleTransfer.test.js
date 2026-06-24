import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const SCRIPT = path.join(ROOT, 'scripts', 'run-d2-role-transfer.js');

function run(args) {
  return execFileSync(process.execPath, [SCRIPT, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
  });
}

test('D2 role-transfer sidecar validates and analyzes mock rows', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'd2-role-transfer-'));
  const rowsPath = path.join(tmp, 'mock.jsonl');
  const reportPath = path.join(tmp, 'report.md');

  const validateOut = run(['validate']);
  assert.match(validateOut, /D2 role-transfer config valid/);

  const mockOut = run(['mock', '--out', rowsPath, '--runs', '1']);
  assert.match(mockOut, /Wrote 12 mock rows/);
  assert.ok(fs.existsSync(rowsPath));

  const firstRow = JSON.parse(fs.readFileSync(rowsPath, 'utf8').trim().split(/\n/)[0]);
  assert.equal(firstRow.study_id, 'd2_role_transfer_v1');
  assert.equal(firstRow.mock, true);
  assert.ok(firstRow.config_hash);
  assert.ok(firstRow.rubric_hash);
  assert.ok(firstRow.prompt_hash);
  assert.equal(firstRow.judgments.length, 1);

  const analyzeOut = run(['analyze', '--in', rowsPath, '--out', reportPath]);
  assert.match(analyzeOut, /Wrote report/);
  const report = fs.readFileSync(reportPath, 'utf8');
  assert.match(report, /Mock observations: 12/);
  assert.match(report, /not empirical evidence/);
});
