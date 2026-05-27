#!/usr/bin/env node
/**
 * Add derived recognition-origin labels to existing poetics score artifacts.
 *
 * This is intentionally deterministic: it does not call an LLM. Each critic has
 * already supplied the role-symmetric axes; this pass labels whether that
 * critic's own axis pattern is organic, peripeteia-induced, false closure, or
 * ambiguous.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { recognitionOriginForScoreRow } from './lib/recognitionOrigin.js';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');

function parseArgs(argv) {
  const args = { rootDir: null, scoreDir: null };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--root-dir') args.rootDir = path.resolve(argv[++i]);
    else if (token === '--score-dir') args.scoreDir = path.resolve(argv[++i]);
    else if (token === '--help' || token === '-h') {
      console.log(`Usage:
  node scripts/annotate-poetics-origin.js --root-dir DIR
  node scripts/annotate-poetics-origin.js --score-dir DIR`);
      process.exit(0);
    } else {
      throw new Error(`unknown arg: ${token}`);
    }
  }
  if (!args.scoreDir && !args.rootDir) throw new Error('--root-dir or --score-dir is required');
  args.scoreDir ||= path.join(args.rootDir, 'scores');
  return args;
}

function rel(filePath) {
  return path.relative(ROOT, filePath);
}

function stableJson(value) {
  return JSON.stringify(value, null, 2) + '\n';
}

function annotateFile(filePath) {
  const artifact = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  let changed = false;
  let annotated = 0;
  for (const row of artifact.scored || []) {
    if (!row || row.error) continue;
    const next = recognitionOriginForScoreRow(row);
    if (JSON.stringify(row.recognitionOrigin || null) !== JSON.stringify(next)) {
      row.recognitionOrigin = next;
      changed = true;
    }
    annotated += 1;
  }
  const originPolicy = {
    version: 'recognition-origin-derived-v1',
    source: 'derived_from_role_symmetric_critic_axes',
    classes: ['none', 'organic', 'peripeteia_induced', 'false_closure', 'ambiguous'],
  };
  if (JSON.stringify(artifact.originPolicy || null) !== JSON.stringify(originPolicy)) {
    artifact.originPolicy = originPolicy;
    changed = true;
  }
  if (changed) fs.writeFileSync(filePath, stableJson(artifact));
  return { filePath, changed, annotated };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(args.scoreDir)) throw new Error(`score dir not found: ${args.scoreDir}`);
  const results = fs
    .readdirSync(args.scoreDir)
    .filter((file) => file.endsWith('.json'))
    .sort()
    .map((file) => annotateFile(path.join(args.scoreDir, file)));
  const changed = results.filter((result) => result.changed).length;
  const rows = results.reduce((sum, result) => sum + result.annotated, 0);
  console.log(`annotated ${rows} score rows across ${results.length} artifact(s); changed ${changed}`);
  for (const result of results.filter((entry) => entry.changed)) {
    console.log(`  - ${rel(result.filePath)}`);
  }
}

main();
