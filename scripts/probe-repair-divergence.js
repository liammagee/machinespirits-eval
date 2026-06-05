#!/usr/bin/env node
/**
 * probe-repair-divergence.js — the CORRECTION axis on real loop cells (Option 3 + 1).
 *
 * For each loop cell it pulls the learner's MANIFEST (public final turn) vs LATENT (hidden
 * ego/superego deliberation), computes the zero-API concealment-signal divergence, and
 * classifies repair via adaptation-core's manifest/latent rules (Durable / Costume / Silent).
 *
 * Detector: the default is a ZERO-API PROXY (publicRepair = the learner reoriented publicly;
 * latentRepair = the hidden first-thought did NOT diverge from the public turn) — a free,
 * descriptive Stage-0 read, NOT a content judgment. `--llm` swaps in the robust per-text
 * repair judge (needs an API key + the provider; not run here). Per ADAPTATION-PLAN-2.0 P1:
 * the pre-registered verdict (is the latent separable from the surface?) needs the larger
 * ego_superego corpus + bootstrap CIs — these 9 cells are a descriptive probe only.
 *
 *   node scripts/probe-repair-divergence.js [loop-status.json]
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { n3reasoner } from 'eyereasoner';
import { Parser } from 'n3';
import { loadSharedTBox } from '../services/ontology/reasoningOntology.js';
import { summaryToAbox, extractTriggerConsumption } from '../services/ontology/adaptationAboxBridge.js';
import { extractLearnerRepairText, latentManifestDivergence } from '../services/ontology/hamartiaRepairDetector.js';

const NS = 'https://machinespirits.dev/ontology/reasoning#';
const statusPath =
  process.argv[2] || 'exports/phase2-adaptation-recognition-loop-reverse-20260529T040243Z-loop-status.json';
const cuts = { actionVoteCut: 3, recognitionVoteCut: 3, controlMaxRecognitionVotes: 1 };
const status = JSON.parse(readFileSync(statusPath, 'utf8'));

function readDeliberation(cell) {
  if (!cell._rootDir) return null;
  const segDir = String(cell.itemId || '').split(':')[1] || 'target-r01';
  const file = path.resolve(cell._rootDir, segDir, 'deliberation', cell.arm, `${cell.tid}.json`);
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

const cells = [];
for (const it of status.iterations || [])
  for (const item of it.gate?.items || []) cells.push({ ...item, _rootDir: it.rootDir });
if (!cells.length) {
  console.error(`No gate.items found in ${statusPath}`);
  process.exit(1);
}

const rows = [];
const aboxParts = [];
for (const cell of cells) {
  const delib = readDeliberation(cell);
  const triggerConsumption = delib ? extractTriggerConsumption(delib) : null;
  const lifted = summaryToAbox(cell, { ...cuts, triggerConsumption });
  const txt = delib ? extractLearnerRepairText(delib) : null;
  const div = txt ? latentManifestDivergence(txt.publicText, txt.latentInitial) : null;

  // Zero-API proxy: the learner reoriented PUBLICLY (recognition produced) and the hidden
  // first-thought matches the public turn (latent not diverged) => durable; mismatch => costume.
  const c = cell.consensus || {};
  const recognitionProduced =
    (c.claimStatus && c.claimStatus !== 'negative') || (c.recognitionVotes || 0) >= cuts.recognitionVoteCut;
  const publicRepair = Boolean(recognitionProduced);
  const latentRepair = div ? !div.diverged : false;

  aboxParts.push(lifted.ttl);
  if (publicRepair || latentRepair) {
    aboxParts.push(
      `ms:Rep_${lifted.id} a ms:HamartiaRepairStage ; ms:partOfEvent ms:${lifted.event} ; ms:publicRepair ${publicRepair} ; ms:latentRepair ${latentRepair} .`,
    );
  }
  rows.push({ cell, id: lifted.id, event: lifted.event, div, publicRepair, latentRepair, hasDelib: Boolean(delib) });
}

const abox = `@prefix ms: <${NS}> .\n@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .\n${aboxParts.join('\n')}\n`;
const quads = new Parser({ format: 'text/n3' }).parse(
  await n3reasoner([loadSharedTBox(['reasoning', 'poetics', 'adaptation']), abox].join('\n\n'), undefined, {
    output: 'deductive_closure',
    outputType: 'string',
  }),
);
const typeOf = (s) =>
  quads
    .filter((x) => x.subject.value === NS + s && x.predicate.value.endsWith('22-rdf-syntax-ns#type'))
    .map((x) => x.object.value.replace(NS, ''));
function repairClass(id) {
  const t = typeOf('Rep_' + id);
  if (t.includes('DurableRepair')) return 'durable';
  if (t.includes('CostumeRepair')) return 'costume';
  if (t.includes('SilentRepair')) return 'silent';
  return 'none';
}

const pad = (s, n) => String(s).padEnd(n);
console.log(
  pad('drama/arm', 15) +
    '| ' +
    pad('delib', 6) +
    '| ' +
    pad('overlap', 8) +
    '| ' +
    pad('diverged', 9) +
    '| ' +
    pad('pub', 4) +
    '| ' +
    pad('lat', 4) +
    '| ' +
    pad('repair class', 13) +
    '| keystone',
);
console.log('-'.repeat(96));
let diverged = 0;
let withText = 0;
let costume = 0;
let rwrc = 0;
for (const r of rows) {
  const cls = repairClass(r.id);
  const keystone = typeOf(r.event).includes('repairWithoutRecognitionCredit'); // durable repair, recognition failed
  if (r.div) {
    withText += 1;
    if (r.div.diverged) diverged += 1;
  }
  if (cls === 'costume') costume += 1;
  if (keystone) rwrc += 1;
  console.log(
    pad(`${r.cell.dramaId}/${r.cell.arm}`, 15) +
      '| ' +
      pad(r.hasDelib ? 'yes' : 'no', 6) +
      '| ' +
      pad(r.div ? r.div.overlap.toFixed(2) : '-', 8) +
      '| ' +
      pad(r.div ? (r.div.diverged ? 'YES' : 'no') : '-', 9) +
      '| ' +
      pad(r.publicRepair, 4) +
      '| ' +
      pad(r.latentRepair, 4) +
      '| ' +
      pad(cls, 13) +
      '| ' +
      (keystone ? 'repairWithoutRecognitionCredit' : ''),
  );
}

console.log('\n' + '='.repeat(60));
console.log(
  `Latent vs manifest (zero-API divergence): ${diverged}/${withText} cells — the learner's hidden first-thought diverges from the public turn (overlap < 0.5).`,
);
console.log(`Correction axis (PROXY detector — recognition=public, !diverged=latent; NOT an LLM content judgment):`);
console.log(
  `  costume repair (public-repair, latent-mismatch): ${costume} cell(s); repairWithoutRecognitionCredit: ${rwrc} cell(s).`,
);
console.log('\nHonest scope:');
console.log('  • The proxy substitutes recognition+divergence for a content judgment of repair.');
console.log('  • Robust upgrade: the detector llm mode (a per-text repair judge) is built + unit-tested');
console.log('    via an injected callLLM; wiring THIS probe to the live provider (generateText) is the');
console.log('    remaining step and needs an API key (none set here).');
console.log('  • Pre-registered P1 verdict (latent separable from surface?) needs the larger ego_superego');
console.log('    corpus + bootstrap CIs (ADAPTATION-PLAN-2.0.md §6.10), not these 9 descriptive cells.');
