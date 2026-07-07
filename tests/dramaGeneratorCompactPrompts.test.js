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

// Slice 4 (compact drama-specific tutor prompts). Off by default. With
// --drama-compact-prompts the tutor ego/superego static system prompts are
// replaced by the compact drama prompts. Measured via --mock telemetry, which
// records the system-prompt size actually sent (no API, no DB).
function tutorSystemPromptSizes(tmp, label, extraArgs) {
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
  const sizes = {};
  for (const r of telemetry.records || []) {
    if (r.role.startsWith('tutor_') && sizes[r.role] == null) sizes[r.role] = r.prompt_chars.system;
  }
  return sizes;
}

describe('generate-pedagogical-dramas compact tutor prompts (Slice 4)', () => {
  it('shrinks the tutor system prompts by an order of magnitude under the flag', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'compact-prompt-'));
    try {
      // compact is the default now, so the full baseline must be requested explicitly
      const full = tutorSystemPromptSizes(tmp, 'full', ['--drama-fidelity', 'full']);
      const compact = tutorSystemPromptSizes(tmp, 'compact', ['--drama-compact-prompts']);
      assert.ok(full.tutor_ego > 15000, `expected full ego prompt > 15k, got ${full.tutor_ego}`);
      assert.ok(compact.tutor_ego < 5000, `expected compact ego prompt < 5k, got ${compact.tutor_ego}`);
      // superego only asserted when this profile runs one
      if (full.tutor_superego != null) {
        assert.ok(full.tutor_superego > 15000, `expected full superego > 15k, got ${full.tutor_superego}`);
        assert.ok(compact.tutor_superego < 5000, `expected compact superego < 5k, got ${compact.tutor_superego}`);
      }
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('keeps the hidden-label safety rail in the compact prompts', () => {
    const ego = fs.readFileSync(path.join(REPO_ROOT, 'prompts', 'drama', 'tutor-ego-compact.md'), 'utf8');
    const superego = fs.readFileSync(path.join(REPO_ROOT, 'prompts', 'drama', 'tutor-superego-compact.md'), 'utf8');
    assert.match(ego, /hidden label|answer key|withheld conclusion/i, 'compact ego must keep the no-leak instruction');
    assert.match(superego, /hidden label|answer key|leak/i, 'compact superego must keep the public-safety review');
  });
});
