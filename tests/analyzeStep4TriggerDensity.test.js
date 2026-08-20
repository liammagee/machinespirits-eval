import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { greenroomSources } from '../scripts/analyze-step4-trigger-density.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const AUDIT = path.join(ROOT, 'exports/tutor-stub-step4-trigger-audit/trigger-density.json');
const GREENROOM_DIR = 'exports/greenroom-gate1-2026-07-12';
const GREENROOM_MANIFEST = 'raw-bundle-manifest.json';
const GREENROOM_ARCHIVE = 'raw-bundle.tar.gz';

function isolatedBundleRoot(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'step4-greenroom-bundle-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const bundleDir = path.join(root, GREENROOM_DIR);
  fs.mkdirSync(bundleDir, { recursive: true });
  const trackedBundleDir = path.join(ROOT, GREENROOM_DIR);
  for (const file of [GREENROOM_MANIFEST, GREENROOM_ARCHIVE]) {
    fs.copyFileSync(path.join(trackedBundleDir, file), path.join(bundleDir, file));
  }
  return { bundleDir, root };
}

test('tracked Step 4 audit freezes a dense, zero-call, hash-verified corpus', () => {
  const audit = JSON.parse(fs.readFileSync(AUDIT, 'utf8'));
  assert.equal(audit.zeroCall, true);
  assert.equal(audit.corpus.runs, 68);
  assert.equal(audit.corpus.traceHashesVerified, 68);
  assert.equal(audit.corpus.step2Runs, 60);
  assert.equal(audit.corpus.greenroomRuns, 8);
  assert.ok(audit.selectedTriggers.warrant_skip.opportunities >= 400);
  assert.ok(audit.selectedTriggers.stagnant_repeat.opportunities >= 150);
  assert.ok(audit.selectedTriggers.warrant_skip.baselineComplianceRate < 0.6);
  assert.ok(audit.selectedTriggers.stagnant_repeat.baselineComplianceRate < 0.6);
  assert.equal(audit.manualReview.warrant_skip.validOpportunities, 12);
  assert.equal(audit.manualReview.stagnant_repeat.validOpportunities, 12);
});

test('Green Room sources fall back to the verified archive without expanding files into the repository', (t) => {
  const direct = greenroomSources().map(({ buffer, ...source }) => ({ ...source, bytes: buffer.length }));
  const { bundleDir, root } = isolatedBundleRoot(t);
  const bundled = greenroomSources({ root });

  assert.equal(bundled.length, 8);
  assert.deepEqual(
    bundled.map(({ buffer, ...source }) => ({ ...source, bytes: buffer.length })),
    direct,
  );
  assert.equal(fs.existsSync(path.join(bundleDir, 'performances')), false);
  assert.equal(fs.existsSync(path.join(bundleDir, 'traces')), false);
  assert.deepEqual(fs.readdirSync(bundleDir).sort(), [GREENROOM_MANIFEST, GREENROOM_ARCHIVE].sort());
});

test('Green Room archive corruption fails before any partial expanded source is consumed', (t) => {
  const { bundleDir, root } = isolatedBundleRoot(t);
  const poison = path.join(bundleDir, 'performances', 'P1.json');
  fs.mkdirSync(path.dirname(poison), { recursive: true });
  fs.writeFileSync(poison, '{"trace":"unverified-poison.jsonl"}\n');

  const archive = path.join(bundleDir, GREENROOM_ARCHIVE);
  const bytes = fs.readFileSync(archive);
  bytes[Math.floor(bytes.length / 2)] ^= 1;
  fs.writeFileSync(archive, bytes);

  assert.throws(() => greenroomSources({ root }), /Archive checksum does not match manifest/u);
  assert.equal(fs.readFileSync(poison, 'utf8'), '{"trace":"unverified-poison.jsonl"}\n');
  assert.equal(fs.existsSync(path.join(bundleDir, 'traces')), false);
  assert.deepEqual(fs.readdirSync(path.join(bundleDir, 'performances')), ['P1.json']);
});
