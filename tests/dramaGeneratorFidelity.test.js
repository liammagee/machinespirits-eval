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

// Slice 5 (drama fidelity ladder). full (default) keeps the full ego→superego→
// ego deliberation on both sides; public-only collapses each side to a single
// ego call (a cheap structural screen). Driven as --mock subprocesses (no API,
// no DB); execFileSync passes args as an array so no shell word-splitting.
function roleCounts(tmp, label, extraArgs) {
  execFileSync(
    'node',
    [
      GENERATOR,
      '--mock',
      '--first-lesson',
      '--force',
      '--trace-calls',
      '--max-turns',
      '2',
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
  const counts = {};
  for (const r of telemetry.records || []) counts[r.role] = (counts[r.role] || 0) + 1;
  counts._total = (telemetry.records || []).length;
  return counts;
}

describe('generate-pedagogical-dramas fidelity ladder (Slice 5)', () => {
  it('public-only drops every superego call on both tutor and learner sides', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fidelity-'));
    try {
      const full = roleCounts(tmp, 'full', ['--drama-fidelity', 'full']);
      const publicOnly = roleCounts(tmp, 'public', ['--drama-fidelity', 'public-only']);
      // full runs the superego on both sides; public-only must run none
      assert.ok(full.tutor_superego > 0, 'full should run a tutor superego');
      assert.ok(full.learner_superego > 0, 'full should run a learner superego');
      assert.equal(publicOnly.tutor_superego ?? 0, 0, 'public-only must skip the tutor superego');
      assert.equal(publicOnly.learner_superego ?? 0, 0, 'public-only must skip the learner superego');
      assert.ok(publicOnly._total < full._total, 'public-only should issue strictly fewer calls');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('rejects an invalid fidelity mode', () => {
    assert.throws(
      () =>
        execFileSync('node', [GENERATOR, '--drama-fidelity', 'bogus', '--dry-run'], { cwd: REPO_ROOT, stdio: 'pipe' }),
      /drama-fidelity/,
    );
  });
});
