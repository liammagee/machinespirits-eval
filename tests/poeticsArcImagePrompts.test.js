import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('poetics arc prompt pack carries the Machine Spirits editorial house style', (t) => {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'poetics-arc-prompts-'));
  t.after(() => fs.rmSync(outputDir, { recursive: true, force: true }));
  const promptFile = path.join(outputDir, 'prompts.txt');
  const manifestFile = path.join(outputDir, 'manifest.json');
  const imageDir = path.join(outputDir, 'images');
  const result = spawnSync(
    process.execPath,
    [
      'scripts/generate-poetics-arc-images.js',
      '--dry-run',
      '--image-dir',
      imageDir,
      '--prompt-file',
      promptFile,
      '--manifest-file',
      manifestFile,
    ],
    { cwd: ROOT, encoding: 'utf8' },
  );

  assert.equal(result.status, 0, result.stderr);
  const prompts = fs.readFileSync(promptFile, 'utf8');
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));

  assert.equal(manifest.style, 'machinespirits-poetics-editorial-cartoon-v2');
  assert.equal(manifest.style_guide, 'docs/design/machinespirits-house-style.md');
  assert.equal(manifest.style_profile, 'editorial');
  assert.equal(manifest.images.length, 9);
  assert.match(prompts, /off-white #fafafa/u);
  assert.match(prompts, /signature red #E63946/u);
  assert.match(prompts, /60px Swiss grid/u);
  assert.match(prompts, /-18-degree red slash/u);
  assert.match(prompts, /Treat red as an action verb/u);
  assert.match(prompts, /at most two, each five words or fewer/u);
  assert.match(prompts, /open evidence window/u);
  assert.doesNotMatch(prompts, /blind tutor/iu);
});
