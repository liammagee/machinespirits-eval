#!/usr/bin/env node
/**
 * run-timing-pair-panel.js — step 3 of the contrastive timing-pair design.
 *
 * Renders the strong timing-pair bases x 4 arms into a BLINDED synthetic replay-dir, drives the
 * EXISTING blind origin panel (buildReplayPanelPackage -> score-poetics-phase2.js, the same
 * architecture-independent 5-critic panel incl. Sonnet + GPT/codex), and aggregates
 * recognitionOrigin + globalCoherence into the 2x2. The critic sees ONLY the transcript text
 * (sample/T0N.txt); arm identity lives in our private map + the blinded key.
 *
 *   node scripts/run-timing-pair-panel.js --mock            # zero-API plumbing test
 *   set -a; . ./.env; set +a; node scripts/run-timing-pair-panel.js --stamp=20260605   # paid
 *
 * Reads: exports/timing-pair-bases-heldout-20260605.json (the strong, authored-neutral bases).
 * Writes: exports/timing-pair-panel-<stamp>/ (replay + panel + aggregate.json).
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { buildReplayPanelPackage } from './run-discursive-replay-panel.js';

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const opt = (k, d) => (argv.find((a) => a.startsWith(`--${k}=`)) || `--${k}=${d ?? ''}`).split('=').slice(1).join('=');
const MOCK = has('--mock');
const basesPath = opt('bases', 'exports/timing-pair-bases-heldout-20260605.json');
const stamp = opt('stamp', MOCK ? 'mock' : 'local');
const criticsArg = opt('critics', '');

const ARMS = ['bridged', 'displacedPivotal', 'decoyBridged', 'displacedNeutral'];
const ARM_LABEL = {
  bridged: 'A pivotal/adjacent',
  displacedPivotal: 'B pivotal/decoupled',
  decoyBridged: 'C neutral/adjacent',
  displacedNeutral: 'D neutral/decoupled',
};
const renderTurns = (turns) => turns.map((t) => `${String(t.role).toUpperCase()}: ${t.text}`).join('\n\n') + '\n';

const data = JSON.parse(fs.readFileSync(basesPath, 'utf8'));
const strong = data.bases.filter((b) => b.tags.obstruction > 0 && b.neutralProvenance === 'authored-matched');
if (!strong.length) {
  console.error('no strong (o>0, authored-neutral) bases found — author neutrals first.');
  process.exit(1);
}

// Materialize a blinded synthetic replay-dir. T0N is assigned by the panel in record order.
const root = path.resolve(`exports/timing-pair-panel-${stamp}`);
const replayDir = path.join(root, 'replay');
const candDir = path.join(replayDir, 'candidates');
fs.rmSync(root, { recursive: true, force: true });
fs.mkdirSync(candDir, { recursive: true });

const records = [];
const tidMap = {}; // T0N -> {armId, base, domain, sourceArm, arm, predictedOrigin, coherenceRisk}
let i = 0;
for (const b of strong) {
  for (const arm of ARMS) {
    const armId = `${b.domain}__${b.sourceArm}__${arm}`;
    const txtPath = path.join(candDir, `${armId}.txt`);
    fs.writeFileSync(txtPath, renderTurns(b.arms[arm].turns));
    records.push({
      item: { id: armId, run_id: `timingpair-${stamp}` },
      gate: { status: 'survivor' },
      // backend null => the panel skips the adversarial-checker lookup (precheck is disabled);
      // the timing-pair reorder isn't one of the panel's generator backends and needn't pretend.
      generator: { backend: null },
      checker: { backend: null },
      paths: { revisedPublic: txtPath },
    });
    const tid = `T${String(i + 1).padStart(2, '0')}`;
    tidMap[tid] = {
      armId,
      base: b.sourceId,
      domain: b.domain,
      sourceArm: b.sourceArm,
      arm,
      predictedOrigin: b.arms[arm].predictedOrigin,
      coherenceRisk: b.arms[arm].coherenceRisk,
    };
    i++;
  }
}
fs.writeFileSync(
  path.join(replayDir, 'manifest.json'),
  JSON.stringify({ generator: 'timing-pair', checker: null, records }, null, 2),
);
console.log(
  `Materialized ${records.length} arm-transcripts (${strong.length} bases x ${ARMS.length} arms) -> ${replayDir}`,
);

// Build the blinded panel package + score with the EXISTING panel/critics.
const outDir = path.join(root, 'panel');
const pkgOpts = {
  replayDir,
  outDir,
  runId: `timingpair-${stamp}`,
  mock: MOCK,
  force: true,
  requireAdversarialPrecheck: false,
  includeStatus: ['survivor'],
  criticConcurrency: 'all',
  scoreConcurrency: MOCK ? 1 : 2,
};
if (criticsArg) pkgOpts.critics = criticsArg.split(','); // else fall back to the panel's DEFAULT_CRITICS
const built = buildReplayPanelPackage(pkgOpts);

console.log(`Scoring ${built.scoreCommands.length} critic(s)${MOCK ? ' [MOCK]' : ''}...`);
for (const job of built.scoreCommands) {
  process.stdout.write(`  ${job.critic} ... `);
  const r = spawnSync(job.cmd[0], job.cmd.slice(1), { stdio: ['ignore', 'ignore', 'inherit'] });
  console.log(r.status === 0 ? 'ok' : `FAILED (${r.status})`);
}

// Aggregate recognitionOrigin + coherence per arm across critics.
const INDUCED = 'peripeteia_induced';
const perArm = {}; // arm -> { induced, total, cohSum, cohN, byCritic:{critic:{induced,total}} }
for (const a of ARMS) perArm[a] = { induced: 0, total: 0, cohSum: 0, cohN: 0, byCritic: {} };
const criticFiles = fs.existsSync(built.scoreDir)
  ? fs.readdirSync(built.scoreDir).filter((f) => f.endsWith('.json'))
  : [];
for (const f of criticFiles) {
  let j;
  try {
    j = JSON.parse(fs.readFileSync(path.join(built.scoreDir, f), 'utf8'));
  } catch {
    continue;
  }
  const critic = j.critic || f.replace(/^replay-r01-|\.json$/g, '');
  for (const row of j.scored || []) {
    const m = tidMap[row.id];
    if (!m) continue;
    const cls = row.recognitionOrigin && row.recognitionOrigin.class;
    const induced = cls === INDUCED ? 1 : 0;
    const A = perArm[m.arm];
    A.total += 1;
    A.induced += induced;
    if (Number.isFinite(row.globalCoherence)) {
      A.cohSum += row.globalCoherence;
      A.cohN += 1;
    }
    A.byCritic[critic] = A.byCritic[critic] || { induced: 0, total: 0 };
    A.byCritic[critic].induced += induced;
    A.byCritic[critic].total += 1;
  }
}

const rate = (a) => (perArm[a].total ? perArm[a].induced / perArm[a].total : null);
const coh = (a) => (perArm[a].cohN ? perArm[a].cohSum / perArm[a].cohN : null);
const fmt = (x) => (x == null ? ' -- ' : x.toFixed(2));

const aggregate = {
  design: 'notes/poetics/2026-06-05-contrastive-timing-pair-design.md',
  mock: MOCK,
  decoupling: data.decoupling,
  nBases: strong.length,
  critics: built.manifest.critics,
  perArm: Object.fromEntries(
    ARMS.map((a) => [
      a,
      { inducedRate: rate(a), n: perArm[a].total, meanCoherence: coh(a), byCritic: perArm[a].byCritic },
    ]),
  ),
  contrasts: {
    timing_pivotal_AvB:
      rate('bridged') != null && rate('displacedPivotal') != null ? rate('bridged') - rate('displacedPivotal') : null,
    moveType_adjacent_AvC:
      rate('bridged') != null && rate('decoyBridged') != null ? rate('bridged') - rate('decoyBridged') : null,
    interaction: [rate('bridged'), rate('displacedPivotal'), rate('decoyBridged'), rate('displacedNeutral')].every(
      (x) => x != null,
    )
      ? rate('bridged') - rate('displacedPivotal') - (rate('decoyBridged') - rate('displacedNeutral'))
      : null,
  },
  tidMap,
};
fs.writeFileSync(path.join(root, 'aggregate.json'), JSON.stringify(aggregate, null, 2));

// Report: the 2x2 (induced-rate; mean coherence)
console.log(
  `\n=== timing-pair 2x2 — induced-attribution rate${MOCK ? ' [MOCK: plumbing only, not a result]' : ''} ===`,
);
console.log(
  `critics: ${(built.manifest.critics || []).join(', ')} | bases: ${strong.length} | decoupling: ${data.decoupling}\n`,
);
console.log('               | adjacent timing | decoupled timing |');
console.log(`pivotal move   |   A ${fmt(rate('bridged'))}        |   B ${fmt(rate('displacedPivotal'))}        |`);
console.log(`neutral move   |   C ${fmt(rate('decoyBridged'))}        |   D ${fmt(rate('displacedNeutral'))}        |`);
console.log(
  `\nmean coherence | A ${fmt(coh('bridged'))} B ${fmt(coh('displacedPivotal'))} C ${fmt(coh('decoyBridged'))} D ${fmt(coh('displacedNeutral'))}  (the manipulation-check; low decoupled coherence = confound)`,
);
console.log('\ncontrasts:');
console.log(`  TIMING (A-B, the clean content-constant core): ${fmt(aggregate.contrasts.timing_pivotal_AvB)}`);
console.log(`  MOVE-TYPE (A-C): ${fmt(aggregate.contrasts.moveType_adjacent_AvC)}`);
console.log(`  interaction [(A-B)-(C-D)]: ${fmt(aggregate.contrasts.interaction)}`);
console.log(
  '\nreadings: interaction>0 & A high = critic tracks the genuine bridge (valid); A&C both high (timing main effect) = post-hoc gullibility (D6); A&B both high = timing not a lever.',
);
console.log(`\nWrote ${path.join(root, 'aggregate.json')}`);
for (const a of ARMS) console.log(`  ${ARM_LABEL[a]}: induced ${perArm[a].induced}/${perArm[a].total}`);
