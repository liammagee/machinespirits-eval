#!/usr/bin/env node
/**
 * A21 balanced action-value microbench runner.
 *
 * Zero-paid deterministic mode: starts every candidate action from the same
 * frozen Hethel trigger fixture, applies the finite-state learner simulator,
 * audits the transition, scores reward, and writes JSONL trial rows.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { runA21Microbench } from '../services/dramaticDerivation/index.js';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const OUT_DIR = 'exports/dramatic-derivation/a21-action-value';
const DEFAULT_FIXTURE = path.join(OUT_DIR, 'hethel-trigger-fixture.json');
const DEFAULT_ACTIONS = path.join(OUT_DIR, 'action-set.json');
const DEFAULT_OUT = path.join(OUT_DIR, 'microbench-trials.jsonl');

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : fallback;
}

function flag(name) {
  return process.argv.includes(`--${name}`);
}

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

function rel(file) {
  return path.relative(ROOT, file);
}

function main() {
  const smoke = flag('smoke');
  const fixturePath = path.resolve(ROOT, arg('fixture', DEFAULT_FIXTURE));
  const actionsPath = path.resolve(ROOT, arg('actions', DEFAULT_ACTIONS));
  const outPath = path.resolve(ROOT, arg('out', smoke ? path.join(OUT_DIR, 'microbench-trials-smoke.jsonl') : DEFAULT_OUT));
  const mode = arg('mode', 'deterministic');
  const k = Number(arg('k', '1'));
  const seed = Number(arg('seed', '20260616'));
  const fixture = readJson(fixturePath);
  const actionSet = readJson(actionsPath);
  const run = runA21Microbench({ fixture, actionSet, mode, k, seed });
  const rows = run.trials.map((trial) => JSON.stringify(trial)).join('\n');
  mkdirSync(path.dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${rows}\n`);
  console.log(`trials: ${rel(outPath)}`);
  console.log(`fixture hash: ${run.fixtureHash}`);
  console.log(`mode: ${run.mode}`);
  console.log(`trials written: ${run.trials.length}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
