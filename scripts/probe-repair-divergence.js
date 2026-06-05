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
import YAML from 'yaml';
import { n3reasoner } from 'eyereasoner';
import { Parser } from 'n3';
import { loadSharedTBox } from '../services/ontology/reasoningOntology.js';
import { summaryToAbox, extractTriggerConsumption } from '../services/ontology/adaptationAboxBridge.js';
import {
  extractLearnerRepairText,
  latentManifestDivergence,
  detectRepair,
} from '../services/ontology/hamartiaRepairDetector.js';
import { generateText, getAvailableProvider } from '../tutor-core/services/unifiedAIProviderService.js';

const NS = 'https://machinespirits.dev/ontology/reasoning#';
const args = process.argv.slice(2);
const useLLM = args.includes('--llm');
const statusPath =
  args.find((a) => !a.startsWith('--')) ||
  'exports/phase2-adaptation-recognition-loop-reverse-20260529T040243Z-loop-status.json';
const cuts = { actionVoteCut: 3, recognitionVoteCut: 3, controlMaxRecognitionVotes: 1 };

// --llm: the ROBUST per-text repair judge (a paid provider call). Otherwise the zero-API proxy.
let callLLM = null;
let hamartiae = {};
if (useLLM) {
  let provider = null;
  try {
    provider = getAvailableProvider();
  } catch {
    provider = null;
  }
  if (!provider) {
    console.error('--llm: no provider available. Set OPENROUTER_API_KEY (e.g. `set -a; . ./.env; set +a`).');
    process.exit(1);
  }
  callLLM = async (prompt) => {
    const r = await generateText({ prompt });
    return (r && (r.content || r.text || r.message)) || '';
  };
  try {
    const spec = YAML.parse(readFileSync('config/poetics-calibration/phase2-classic-drama-adaptation-v1.yaml', 'utf8'));
    const list = (spec && (spec.dramas || spec.target)) || [];
    // The phase-2 dramas carry the misconception in learner_start_state, NOT a `hamartia`
    // field. Derive it (fall back to learner_start_state); fail closed below if still empty.
    for (const d of Array.isArray(list) ? list : Object.values(list))
      if (d && d.id) hamartiae[d.id] = String(d.hamartia || d.learner_start_state || '').trim();
  } catch {
    hamartiae = {};
  }
}
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

// Fail closed: never run the paid --llm judge against an empty misconception (Codex finding).
if (useLLM) {
  const missing = [...new Set(cells.map((c) => c.dramaId))].filter((id) => !(hamartiae[id] && hamartiae[id].length));
  if (missing.length) {
    console.error(`--llm: no misconception (hamartia/learner_start_state) for: ${missing.join(', ')}. Aborting.`);
    process.exit(1);
  }
}

const rows = [];
const aboxParts = [];
for (const cell of cells) {
  const delib = readDeliberation(cell);
  const triggerConsumption = delib ? extractTriggerConsumption(delib) : null;
  const lifted = summaryToAbox(cell, { ...cuts, triggerConsumption });
  const txt = delib ? extractLearnerRepairText(delib) : null;
  const div = txt ? latentManifestDivergence(txt.publicText, txt.latentInitial) : null;

  // Repair detection. --llm: the robust per-text judge (does the text show the hamartia
  // corrected?) on the public turn vs the hidden first-thought. Else the zero-API proxy
  // (publicRepair = recognition produced; latentRepair = the hidden first-thought matches the public).
  const c = cell.consensus || {};
  const recognitionProduced =
    (c.claimStatus && c.claimStatus !== 'negative') || (c.recognitionVotes || 0) >= cuts.recognitionVoteCut;
  let publicRepair;
  let latentRepair;
  if (useLLM && txt) {
    const h = hamartiae[cell.dramaId] || '';
    publicRepair = await detectRepair(h, txt.publicText, { mode: 'llm', callLLM });
    latentRepair = await detectRepair(h, txt.latentInitial || txt.latentFull, { mode: 'llm', callLLM });
  } else {
    publicRepair = Boolean(recognitionProduced);
    latentRepair = div ? !div.diverged : false;
  }

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
console.log(
  useLLM
    ? `Correction axis (LLM per-text repair judge on the public turn vs the hidden first-thought):`
    : `Correction axis (PROXY — recognition=public, !diverged=latent; NOT a content judgment; pass --llm for the real judge):`,
);
console.log(
  `  costume repair (public-repair, latent-mismatch): ${costume} cell(s); repairWithoutRecognitionCredit: ${rwrc} cell(s).`,
);
console.log('\nHonest scope:');
console.log(
  useLLM
    ? "  • --llm judges hamartia-repair in the public turn vs the learner's hidden first-thought (the concealment probe)."
    : '  • The proxy substitutes recognition+divergence for a content judgment of repair; pass --llm for the real judge.',
);
console.log('  • Pre-registered P1 verdict (latent separable from surface?) needs the larger ego_superego');
console.log('    corpus + bootstrap CIs (ADAPTATION-PLAN-2.0.md §6.10), not these 9 descriptive cells.');
