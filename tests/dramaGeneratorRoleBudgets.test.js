import { strict as assert } from 'node:assert';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const GENERATOR = path.join(REPO_ROOT, 'scripts', 'generate-pedagogical-dramas.js');

// Slice 3 (per-role output budgets). Off by default; --role-max-tokens threads a
// budget into telemetry (and into max_tokens for the API backend / a terse
// directive for CLI backends). Driven as a --mock subprocess (no API, no DB).
function roleBudgetsFromRun(tmp, label, extraArgs) {
  execFileSync(
    'node',
    [
      GENERATOR,
      '--mock',
      '--first-lesson',
      '--force',
      '--trace-calls',
      ...extraArgs,
      '--out-dir',
      path.join(tmp, `out-${label}`),
      '--delib-dir',
      path.join(tmp, `delib-${label}`),
      '--transcripts-dir',
      path.join(tmp, `tx-${label}`),
      '--key',
      path.join(tmp, `key-${label}.yaml`),
    ],
    { cwd: REPO_ROOT, stdio: 'pipe' },
  );
  const telemetry = JSON.parse(fs.readFileSync(path.join(tmp, `delib-${label}`, 'call-telemetry.json'), 'utf8'));
  const byRole = {};
  for (const r of telemetry.records || []) byRole[r.role] = r.role_max_tokens ?? null;
  return byRole;
}

describe('generate-pedagogical-dramas per-role budgets (Slice 3)', () => {
  it('applies the preset budgets and records them in telemetry', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'role-budget-'));
    try {
      const byRole = roleBudgetsFromRun(tmp, 'preset', ['--role-max-tokens', 'preset']);
      assert.equal(byRole.director, 3500);
      assert.equal(byRole.tutor_ego, 800);
      assert.equal(byRole.tutor_superego, 800);
      assert.equal(byRole.learner_ego, 700);
      assert.equal(byRole.learner_superego, 600);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('honours an explicit per-role override and leaves other roles unbudgeted', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'role-budget-'));
    try {
      const byRole = roleBudgetsFromRun(tmp, 'explicit', ['--role-max-tokens', 'tutor_superego=512']);
      assert.equal(byRole.tutor_superego, 512);
      assert.equal(byRole.tutor_ego ?? null, null, 'unlisted roles stay unbudgeted');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('records null budgets by default (current behaviour unchanged)', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'role-budget-'));
    try {
      const byRole = roleBudgetsFromRun(tmp, 'default', []);
      const values = new Set(Object.values(byRole).map((v) => (v == null ? 'null' : 'set')));
      assert.deepEqual([...values], ['null'], 'no role should carry a budget by default');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('rejects malformed budgets', () => {
    assert.throws(
      () =>
        execFileSync('node', [GENERATOR, '--role-max-tokens', 'tutor_ego=abc', '--dry-run'], {
          cwd: REPO_ROOT,
          stdio: 'pipe',
        }),
      /role-max-tokens/,
    );
  });
});
