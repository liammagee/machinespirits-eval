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

// Canonical column order for the public failure-mode axis (the coarse projection
// of the detailed split classes). Grounded first, then the three death modes in
// the order they bite along the dialogue, then the catch-all.
const FAILURE_MODE_ORDER = ['grounded', 'early_pull_death', 'decay_seating_death', 'aporia', 'unresolved'];
const GUARD_STATE_ORDER = ['unguarded', 'pacing', 'proof_debt'];

// Guard × failure-mode contingency: the headline the generalization plan wants to
// carry. The success *rate* is noisy at k=5; the *shift in failure mode* between
// guard states is the within-arm observable that actually moves. Counts only the
// classifiable arms (missing artifacts are dropped, and noted).
function renderContingency(rows) {
  const classified = rows.filter((r) => !r.missing);
  const guardStates = GUARD_STATE_ORDER.filter((g) => classified.some((r) => r.guardState === g));
  const modes = FAILURE_MODE_ORDER.filter((m) => classified.some((r) => r.failureMode === m));
  if (!guardStates.length || !modes.length) return [];

  const count = (g, m) => classified.filter((r) => r.guardState === g && r.failureMode === m).length;

  const lines = [];
  lines.push('## Guard × failure-mode contingency');
  lines.push('');
  lines.push(`Counts over ${classified.length} classifiable arm(s). Keyed on mechanism, not terminal verdict shape.`);
  lines.push('');
  lines.push(`| guard state | ${modes.join(' | ')} | n |`);
  lines.push(`|---|${modes.map(() => '---').join('|')}|---|`);
  for (const g of guardStates) {
    const cells = modes.map((m) => count(g, m));
    const n = cells.reduce((a, b) => a + b, 0);
    lines.push(`| \`${g}\` | ${cells.join(' | ')} | ${n} |`);
  }
  const totals = modes.map((m) => classified.filter((r) => r.failureMode === m).length);
  lines.push(`| **all** | ${totals.map((t) => `**${t}**`).join(' | ')} | **${classified.length}** |`);
  lines.push('');
  return lines;
}

function renderMarkdown(rows) {
  const lines = [];
  lines.push('# E4a detector-split dry report');
  lines.push('');
  lines.push(
    'Frozen-artifact classification only. Registered run verdicts stand; this report labels what kind of non-grounding the existing mechanical trace most resembles.',
  );
  lines.push('');
  lines.push('| arm | verdict | guard | failure mode | split class | key evidence |');
  lines.push('|---|---|---|---|---|---|');
  for (const row of rows) {
    if (row.missing) {
      lines.push(`| \`${row.arm}\` | missing | missing | missing | missing | ${row.reason} |`);
      continue;
    }
    lines.push(
      `| \`${row.arm}\` | ${row.verdict} t${row.endTurn} | \`${row.guardState}\` | \`${row.failureMode}\` | \`${row.className}\` | ${row.reasons.join('; ')} |`,
    );
  }
  lines.push('');
  lines.push(...renderContingency(rows));
  lines.push('## Interpretation');
  lines.push('');
  lines.push('Public failure modes (coarse, mechanism-keyed):');
  lines.push('');
  lines.push('- `grounded`: recognition earned; the board carried the learner to the secret.');
  lines.push(
    '- `early_pull_death`: an exhibit was released before it was tempo-solvent (the house ran ahead of the board).',
  );
  lines.push('- `decay_seating_death`: an already-seated exhibit decayed unrepaired and the learner lost the thread.');
  lines.push('- `aporia`: no licensed tutor-supply window existed when the dialogue stalled.');
  lines.push('- `unresolved`: non-grounding with no registered split trigger.');
  lines.push('');
  lines.push('Detailed split classes (the forensic axis the modes project from):');
  lines.push('');
  lines.push('- `grounded_control`: negative-control survivor; no detector split applied.');
  lines.push(
    '- `tempo_starved_house`: a licensed tutor release was tempo-insolvent under the production D/stall arithmetic.',
  );
  lines.push('- `decay_starved_stall`: unrepaired decay left the board short, without repeated final overreach.');
  lines.push(
    '- `decay_starved_lucky_leap`: unrepaired decay left the board short while the learner kept asserting or deriving ahead of the board.',
  );
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
  else
    console.log(
      `${row.guardState.padEnd(10)} ${row.failureMode.padEnd(20)} ${row.className.padEnd(25)} ${row.arm} · ${row.verdict}@t${row.endTurn}`,
    );
}
