#!/usr/bin/env node
/**
 * E4a dry detector split: classify frozen derivation artifacts without changing
 * registered verdicts or live runtime behavior.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { loadWorld } from '../services/dramaticDerivation/world.js';
import { classifyBoundaryFailure } from '../services/dramaticDerivation/boundaryClassifier.js';

const DEFAULT_ARMS = [
  'lantern-p2-plot-on',
  'lantern-p3-repair-on',
  'lantern-p4-hygiene-on',
  'lantern-p5-mutation-on',
  'lantern-e2-real-r1',
  'lantern-e2-real-r5',
  'lantern-e3-real-r1',
  'lantern-e5-proof-debt-real-r1',
];

const args = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback;
};

const loopDir = flag('loop-dir', 'exports/dramatic-derivation/loop');
const outDir = flag('out', 'exports/dramatic-derivation/boundary');
const armList = (flag('arms', DEFAULT_ARMS.join(',')) || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

function classifyArm(arm) {
  const dir = path.join(loopDir, arm);
  const resultPath = path.join(dir, 'result.json');
  const diagnosisPath = path.join(dir, 'diagnosis.json');
  if (!existsSync(resultPath) || !existsSync(diagnosisPath)) {
    return { arm, missing: true, reason: `missing result or diagnosis in ${dir}` };
  }
  const result = readJson(resultPath);
  const diagnosis = readJson(diagnosisPath);
  const world = loadWorld(diagnosis.worldPath || `config/drama-derivation/${diagnosis.worldId}.yaml`);
  return classifyBoundaryFailure(world, result, diagnosis);
}

function renderMarkdown(rows) {
  const lines = [];
  lines.push('# E4a detector-split dry report');
  lines.push('');
  lines.push(
    'Frozen-artifact classification only. Registered run verdicts stand; this report labels what kind of non-grounding the existing mechanical trace most resembles.',
  );
  lines.push('');
  lines.push('| arm | verdict | split class | key evidence |');
  lines.push('|---|---|---|---|');
  for (const row of rows) {
    if (row.missing) {
      lines.push(`| \`${row.arm}\` | missing | missing | ${row.reason} |`);
      continue;
    }
    lines.push(
      `| \`${row.arm}\` | ${row.verdict} t${row.endTurn} | \`${row.className}\` | ${row.reasons.join('; ')} |`,
    );
  }
  lines.push('');
  lines.push('## Interpretation');
  lines.push('');
  lines.push('- `grounded_control`: negative-control survivor; no detector split applied.');
  lines.push('- `tempo_starved_house`: a licensed tutor release was tempo-insolvent under the production D/stall arithmetic.');
  lines.push('- `decay_starved_stall`: unrepaired decay left the board short, without repeated final overreach.');
  lines.push('- `decay_starved_lucky_leap`: unrepaired decay left the board short while the learner kept asserting or deriving ahead of the board.');
  lines.push('- `supply_starved_stall`: no licensed tutor-supply window existed in the terminal detector span.');
  lines.push('');
  return `${lines.join('\n')}\n`;
}

const rows = armList.map(classifyArm);
mkdirSync(outDir, { recursive: true });
writeFileSync(path.join(outDir, 'detector-split-report.json'), `${JSON.stringify({ arms: rows }, null, 2)}\n`);
writeFileSync(path.join(outDir, 'detector-split-report.md'), renderMarkdown(rows));

console.log(`detector split written: ${path.join(outDir, 'detector-split-report.md')}`);
for (const row of rows) {
  if (row.missing) console.log(`MISS  ${row.arm} — ${row.reason}`);
  else console.log(`${row.className.padEnd(25)} ${row.arm} · ${row.verdict}@t${row.endTurn}`);
}
