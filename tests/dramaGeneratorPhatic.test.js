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

// --phatic-rate: on low-stakes turns a seeded roll may make the turn reflexive
// (ego-only, skips the superego). Off by default. Driven as a --mock subprocess.
function run(tmp, label, extraArgs) {
  execFileSync(
    'node',
    [
      GENERATOR,
      '--mock',
      '--first-lesson',
      '--force',
      '--trace-calls',
      '--max-turns',
      '5',
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
  const superego = (telemetry.records || []).filter((r) => r.role.endsWith('_superego')).length;
  const traceFile = fs.readdirSync(path.join(tmp, `delib-${label}`)).find((f) => /^T\d+\.json$/.test(f));
  const trace = JSON.parse(fs.readFileSync(path.join(tmp, `delib-${label}`, traceFile), 'utf8'));
  const turns = trace.turns || [];
  return { superego, turns };
}

describe('generate-pedagogical-dramas phatic turns (--phatic-rate)', () => {
  it('rate 0 is the unchanged default — no phatic turns', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'phatic-'));
    try {
      const { turns } = run(tmp, 'off', []);
      assert.ok(!turns.some((t) => t.phatic === true), 'no turn should be phatic by default');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('rate 1.0 makes eligible turns reflexive and skips their superego', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'phatic-'));
    try {
      const off = run(tmp, 'off', []);
      const on = run(tmp, 'on', ['--phatic-rate', '1.0']);
      assert.ok(
        on.superego < off.superego,
        `phatic should skip some superego calls (${on.superego} < ${off.superego})`,
      );
      assert.ok(
        on.turns.some((t) => t.phatic === true),
        'some turns should be flagged phatic',
      );
      // ...but not all: the opening + any cue turns still deliberate
      assert.ok(on.superego > 0, 'eligibility gate should keep opening/cue turns deliberating');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('never makes the opening turn phatic (eligibility gate)', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'phatic-'));
    try {
      const { turns } = run(tmp, 'open', ['--phatic-rate', '1.0']);
      const opening = turns.find((t) => t.turnNumber === 0);
      if (opening) assert.notEqual(opening.phatic, true, 'the opening turn must never be phatic');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('rejects an out-of-range rate', () => {
    assert.throws(
      () => execFileSync('node', [GENERATOR, '--phatic-rate', '1.5', '--dry-run'], { cwd: REPO_ROOT, stdio: 'pipe' }),
      /phatic-rate/,
    );
  });
});
