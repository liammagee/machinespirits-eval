#!/usr/bin/env node
/**
 * Phase A of classifier-dag-register (workplan/items/classifier-dag-register.md):
 * can a TEXT-ONLY classifier map learner messages to proof-DAG regions?
 *
 * Ground truth comes from the ENGINE's formal records, never from text:
 * a learner turn is labeled with a lemma region iff the learner VOICED a
 * fact at that turn (the derive channel — their own formal action) that
 * lands on exactly one lemma-DAG node; mirror turns are labeled by formal
 * mirror events. Lexical mirror-naming is measured separately and reported
 * as prevalence (it is the option-6 blind spot, not ground truth).
 *
 * The classifier under audit sees ONLY the message text: distinctive-token
 * lexicons per lemma region (built from the world's fact surfaces), mirror
 * by mirror-term presence, else neither.
 *
 * Usage:
 *   node scripts/audit-learner-message-classifier.js \
 *     --runs <dir> [--runs <dir> ...]     (matrix label dirs: <dir>/<arm>/result.json)
 *     [--out exports/classifier-dag]
 *
 * Zero-paid: pure computation over result.json files + world YAML.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadWorld } from '../services/dramaticDerivation/world.js';
import { buildLemmaDag } from '../services/dramaticDerivation/lemmaLayer.js';
import { factKey } from '../services/dramaticDerivation/chainer.js';
import {
  buildChainMap,
  buildRegionLexicons,
  classifyMessage,
  tokens,
} from '../services/dramaticDerivation/messageClassifier.js';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');

function args(name) {
  const out = [];
  for (let i = 0; i < process.argv.length; i++) {
    if (process.argv[i] === `--${name}` && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) {
      out.push(process.argv[i + 1]);
    }
  }
  return out;
}

const runDirs = args('runs');
const outDir = args('out')[0] || path.join(ROOT, 'exports', 'classifier-dag');
if (!runDirs.length) {
  console.error('usage: --runs <matrix-label-dir> [--runs ...] [--out dir]');
  process.exit(1);
}

const worldCache = new Map();
function worldFor(worldId) {
  if (!worldCache.has(worldId)) {
    // result.json worldId uses underscores (world_005_marrick); files use dashes
    const p = path.join(ROOT, 'config', 'drama-derivation', `${worldId.replace(/_/g, '-')}.yaml`);
    if (!fs.existsSync(p)) return null;
    const world = loadWorld(p);
    const dag = buildLemmaDag(world);
    if (!dag) return null;
    const varIndex = world.questionPattern.findIndex((t) => typeof t === 'string' && t.startsWith('?'));
    const mirrorTerm = world.mirror ? String(world.mirror.fact[varIndex] ?? '').toLowerCase() : null;
    worldCache.set(worldId, {
      world,
      dag,
      lexicons: buildRegionLexicons(world, dag),
      chainOf: buildChainMap(dag),
      mirrorTerm,
    });
  }
  return worldCache.get(worldId);
}

const rows = [];
const perRun = [];
let runsSeen = 0;
let runsSkipped = 0;

for (const dir of runDirs) {
  const abs = path.isAbsolute(dir) ? dir : path.join(ROOT, dir);
  if (!fs.existsSync(abs)) {
    console.error(`skip (missing): ${dir}`);
    continue;
  }
  for (const arm of fs.readdirSync(abs)) {
    const rj = path.join(abs, arm, 'result.json');
    if (!fs.existsSync(rj)) continue;
    const d = JSON.parse(fs.readFileSync(rj, 'utf8'));
    const w = worldFor(d.worldId);
    if (!w) {
      runsSkipped++;
      continue;
    }
    runsSeen++;
    const { dag, lexicons, chainOf, mirrorTerm } = w;
    const nodeByFactKey = new Map(dag.nodes.map((n) => [factKey(n.fact), n]));
    const voicedByTurn = new Map();
    for (const v of d.inference?.voiced || []) {
      if (!voicedByTurn.has(v.turn)) voicedByTurn.set(v.turn, []);
      voicedByTurn.get(v.turn).push(v.fact);
    }
    const mirrorEventTurns = new Set((d.events || []).filter((e) => e.type === 'mirror').map((e) => e.turn));
    let learnerLines = 0;
    let mirrorLexLines = 0;
    for (const entry of d.transcript || []) {
      if (entry.role !== 'learner') continue;
      learnerLines++;
      const text = entry.text || '';
      const lexMirror = mirrorTerm ? new Set(tokens(text)).has(mirrorTerm) : false;
      if (lexMirror) mirrorLexLines++;
      // formal label
      let formal = null;
      if (mirrorEventTurns.has(entry.turn)) {
        formal = 'mirror';
      } else {
        const voiced = voicedByTurn.get(entry.turn) || [];
        const regions = new Set();
        for (const f of voiced) {
          const node = nodeByFactKey.get(factKey(f));
          if (node) regions.add(node.key);
        }
        if (regions.size === 1) formal = [...regions][0];
        else if (regions.size > 1) formal = 'ambiguous';
      }
      const pred = classifyMessage(text, lexicons, mirrorTerm);
      rows.push({
        run: `${path.basename(abs)}/${arm}`,
        turn: entry.turn,
        formal,
        formalChain: formal && chainOf.has(formal) ? chainOf.get(formal) : formal,
        predicted: pred.label,
        predictedChain: chainOf.has(pred.label) ? chainOf.get(pred.label) : pred.label,
        lexMirror,
      });
    }
    perRun.push({
      run: `${path.basename(abs)}/${arm}`,
      worldId: d.worldId,
      verdict: d.verdict,
      learnerLines,
      mirrorLexLines,
      mirrorEvents: mirrorEventTurns.size,
    });
  }
}

// --- aggregate ---
const labeled = rows.filter((r) => r.formal && r.formal !== 'ambiguous');
const ambiguous = rows.filter((r) => r.formal === 'ambiguous');
const correct = labeled.filter((r) => r.predicted === r.formal);
const chainCorrect = labeled.filter((r) => r.predictedChain === r.formalChain);
const confusion = {};
for (const r of labeled) {
  confusion[r.formal] = confusion[r.formal] || {};
  confusion[r.formal][r.predicted] = (confusion[r.formal][r.predicted] || 0) + 1;
}
const totalLearner = rows.length;
const mirrorLexTotal = rows.filter((r) => r.lexMirror).length;
const residualMirror = rows.filter((r) => r.predicted === 'mirror').length;

const summary = {
  generated: 'phase-A audit — classifier-dag-register',
  runsSeen,
  runsSkipped,
  learnerTurns: totalLearner,
  formallyLabeled: labeled.length,
  ambiguousExcluded: ambiguous.length,
  labelCoverage: totalLearner ? +(labeled.length / totalLearner).toFixed(4) : 0,
  classifierAccuracyOnLabeled: labeled.length ? +(correct.length / labeled.length).toFixed(4) : null,
  chainAccuracyOnLabeled: labeled.length ? +(chainCorrect.length / labeled.length).toFixed(4) : null,
  confusion,
  mirror: {
    lexicalLines: mirrorLexTotal,
    lexicalPrevalence: totalLearner ? +(mirrorLexTotal / totalLearner).toFixed(4) : 0,
    residualMirrorPredictions: residualMirror,
    residualMirrorRate: totalLearner ? +(residualMirror / totalLearner).toFixed(4) : 0,
    formalMirrorEventLines: rows.filter((r) => r.formal === 'mirror').length,
  },
  perRun,
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'phaseA-classifier-audit.json'), JSON.stringify({ summary, rows }, null, 2));

const md = [
  '# Phase A — learner-message classifier audit (classifier-dag-register)',
  '',
  `Runs: ${runsSeen} (skipped ${runsSkipped} — no world/lemma DAG). Learner turns: ${totalLearner}.`,
  '',
  `- **Label coverage (formal): ${(summary.labelCoverage * 100).toFixed(1)}%** (${labeled.length} labeled, ${ambiguous.length} ambiguous excluded)`,
  `- **Text-only classifier accuracy on formally-labeled turns: ${summary.classifierAccuracyOnLabeled == null ? 'n/a' : (summary.classifierAccuracyOnLabeled * 100).toFixed(1) + '%'} node-level, ${summary.chainAccuracyOnLabeled == null ? 'n/a' : (summary.chainAccuracyOnLabeled * 100).toFixed(1) + '%'} chain-level** (bar for licensing the lexical sensor: 80%; router consumes chain grain)`,
  `- **Mirror: lexical prevalence ${(summary.mirror.lexicalPrevalence * 100).toFixed(1)}%** of learner lines (${mirrorLexTotal}) — saturating, so mirror = RESIDUAL only; residual-mirror predictions ${residualMirror} (${(summary.mirror.residualMirrorRate * 100).toFixed(1)}%); formal mirror-event lines: ${summary.mirror.formalMirrorEventLines}`,
  '',
  '## Confusion (formal → predicted)',
  '',
  '| formal | ' + '…counts' + ' |',
  '|---|---|',
  ...Object.entries(confusion).map(
    ([f, preds]) =>
      `| ${f.slice(0, 40)} | ${Object.entries(preds)
        .sort((a, b) => b[1] - a[1])
        .map(([p, n]) => `${p === f ? '**' : ''}${p.slice(0, 30)}: ${n}${p === f ? '**' : ''}`)
        .join(', ')} |`,
  ),
  '',
  `Report generated by scripts/audit-learner-message-classifier.js over ${runDirs.length} run dirs.`,
].join('\n');
fs.writeFileSync(path.join(outDir, 'phaseA-classifier-audit.md'), md);
console.log(md);
console.log(`\nartifacts ${path.relative(process.cwd(), outDir)}/phaseA-classifier-audit.{json,md}`);
