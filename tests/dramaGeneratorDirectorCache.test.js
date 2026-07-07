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

// Slice 6 (director-plan cache) end-to-end behaviour. The generator has no
// unit-export seam, so we drive it as a subprocess in --mock (deterministic, no
// API, no DB) and assert the cache hit/miss cycle from its own artifacts.
function runGenerator(tmp, label, cacheDir) {
  execFileSync(
    'node',
    [
      GENERATOR,
      '--mock',
      '--first-lesson',
      '--force',
      '--trace-calls',
      '--director-plan-cache',
      cacheDir,
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
  const keyText = fs.readFileSync(path.join(tmp, `key-${label}.yaml`), 'utf8');
  const directorCalls = (telemetry.records || []).filter((r) => r.role === 'director').length;
  const cacheStatus = (keyText.match(/director_plan_cache:\s*(\S+)/) || [])[1] || null;
  return { directorCalls, cacheStatus };
}

describe('generate-pedagogical-dramas director-plan cache (Slice 6)', () => {
  it('writes on miss, replays on hit, and skips the director call when cached', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'director-cache-'));
    const cacheDir = path.join(tmp, 'dcache');
    try {
      const first = runGenerator(tmp, 'p1', cacheDir);
      assert.equal(first.cacheStatus, 'miss', 'first pass should be a cache miss');
      assert.ok(first.directorCalls >= 1, 'first pass should issue the director call');
      const cacheFiles = fs.readdirSync(cacheDir).filter((f) => f.endsWith('.json'));
      assert.ok(cacheFiles.length >= 1, 'first pass should persist a cache entry');

      const second = runGenerator(tmp, 'p2', cacheDir);
      assert.equal(second.cacheStatus, 'hit', 'second pass should be a cache hit');
      assert.equal(second.directorCalls, 0, 'second pass should skip the director call entirely');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('reports cache off when no cache dir is supplied (default path unchanged)', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'director-nocache-'));
    try {
      execFileSync(
        'node',
        [
          GENERATOR,
          '--mock',
          '--first-lesson',
          '--force',
          '--out-dir',
          path.join(tmp, 'out'),
          '--delib-dir',
          path.join(tmp, 'delib'),
          '--transcripts-dir',
          path.join(tmp, 'tx'),
          '--key',
          path.join(tmp, 'key.yaml'),
        ],
        { cwd: REPO_ROOT, stdio: 'pipe' },
      );
      const keyText = fs.readFileSync(path.join(tmp, 'key.yaml'), 'utf8');
      const cacheStatus = (keyText.match(/director_plan_cache:\s*(\S+)/) || [])[1] || null;
      assert.equal(cacheStatus, 'off', 'no --director-plan-cache should record off');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
