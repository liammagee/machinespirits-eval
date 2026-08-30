#!/usr/bin/env node
/**
 * reconcile-adaptation-ontology.js -- run the adaptation-core ontology over REAL loop
 * cells (lifted via the population bridge) and check it reproduces the procedural gate.
 *
 * For each per-cell gate summary in a loop-status.json it:
 *   1. lifts the gate-struct into the adaptation-core ABox (adaptationAboxBridge),
 *   2. reasons over reasoning+poetics+adaptation with the real eyereasoner pipeline,
 *   3. compares the ontology's STRUCTURAL recognition-origin against the critic-VOTED
 *      origin, and the ontology-derived failure axes against the gate's own failures.
 *
 * This is the step that turns the opt-in ontology module from a worked-ABox sketch into
 * an instrument checked against real data -- and surfaces, honestly, the axes the
 * persisted gate-struct cannot yet populate.
 *
 *   node scripts/reconcile-adaptation-ontology.js [loop-status.json]
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { n3reasoner } from 'eyereasoner';
import { Parser } from 'n3';
import { loadSharedTBox } from '../services/ontology/reasoningOntology.js';
import {
  summaryToAbox,
  extractTriggerConsumption,
  detectNamingFrames,
  unpopulatableFromGateStruct,
} from '../services/ontology/adaptationAboxBridge.js';
import { extractLearnerRepairText } from '../services/ontology/hamartiaRepairDetector.js';

const NS = 'https://machinespirits.dev/ontology/reasoning#';
const statusPath =
  process.argv[2] || 'exports/phase2-adaptation-recognition-loop-reverse-20260529T040243Z-loop-status.json';
const status = JSON.parse(readFileSync(statusPath, 'utf8'));
const cuts = { actionVoteCut: 3, recognitionVoteCut: 3, controlMaxRecognitionVotes: 1 };

const cells = [];
for (const it of status.iterations || []) {
  for (const item of it.gate?.items || []) cells.push({ ...item, _rootDir: it.rootDir });
}
if (!cells.length) {
  console.error(`No gate.items found in ${statusPath}`);
  process.exit(1);
}

// Join the deliberation sidecar (the trigger-consumption signal the gate-struct drops).
// itemId is "<batch>:<segDir>:<arm>:<tid>"; the file is <rootDir>/<segDir>/deliberation/<arm>/<tid>.json.
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

let delibJoined = 0;
const lifted = cells.map((s) => {
  const deliberation = readDeliberation(s);
  if (deliberation) delibJoined += 1;
  const triggerConsumption = deliberation ? extractTriggerConsumption(deliberation) : null;
  const txt = deliberation ? extractLearnerRepairText(deliberation) : null;
  const namingFrames = txt ? detectNamingFrames(txt.publicText) : null;
  return summaryToAbox(s, { ...cuts, triggerConsumption, namingFrames });
});
const abox = `@prefix ms: <${NS}> .\n@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .\n${lifted.map((l) => l.ttl).join('\n')}\n`;
const data = [loadSharedTBox(['reasoning', 'poetics', 'adaptation']), abox].join('\n\n');
const closure = await n3reasoner(data, undefined, { output: 'deductive_closure', outputType: 'string' });
const quads = new Parser({ format: 'text/n3' }).parse(closure);

const typeOf = (s) =>
  quads
    .filter((q) => q.subject.value === NS + s && q.predicate.value.endsWith('22-rdf-syntax-ns#type'))
    .map((q) => q.object.value.replace(NS, ''));
const axesOf = (e) =>
  quads
    .filter((q) => q.subject.value === NS + e && q.predicate.value === NS + 'hasFailureAxis')
    .map((q) => q.object.value.replace(NS, ''));

const ORIGIN_CLASS = {
  PeripeteiaInducedRecognition: 'peripeteia_induced',
  OrganicRecognition: 'organic',
  FalseClosureRecognition: 'false_closure',
};
function structuralOrigin(id) {
  const t = typeOf('R_' + id);
  for (const [cls, name] of Object.entries(ORIGIN_CLASS)) if (t.includes(cls)) return name;
  return t.includes('ReorientationStage') ? 'none' : 'no_reorientation';
}

// Signals the bridge can derive. Failure-axis reproduction remains a like-for-like
// gate comparison; correction signals are RDF types and therefore get a separate
// structural readout rather than being smuggled into hasFailureAxis.
const DERIVABLE_FAILURE_AXES = ['control_leak', 'action_gap', 'mechanism_not_publicly_resolved'];
const DERIVABLE_CORRECTION_SIGNALS = [
  'repair_stage_fired',
  'scaffolded_repair',
  'self_repair',
  'repair_without_recognition_credit',
];
const DERIVABLE = [...DERIVABLE_FAILURE_AXES, ...DERIVABLE_CORRECTION_SIGNALS];

function correctionSignals(liftedCell) {
  const repairTypes = typeOf(`Repair_${liftedCell.id}`);
  const eventTypes = typeOf(liftedCell.event);
  const signals = [];
  if (repairTypes.includes('HamartiaRepairStage')) signals.push('repair_stage_fired');
  if (repairTypes.includes('ScaffoldedRepair')) signals.push('scaffolded_repair');
  if (repairTypes.includes('SelfRepair')) signals.push('self_repair');
  if (eventTypes.includes('repairWithoutRecognitionCredit')) {
    signals.push('repair_without_recognition_credit');
  }
  return signals;
}

let originAgree = 0;
let originTotal = 0;
let axisAgree = 0;
const correctionCounts = Object.fromEntries(DERIVABLE_CORRECTION_SIGNALS.map((signal) => [signal, 0]));

const pad = (s, n) => String(s).padEnd(n);
console.log(
  pad('drama/arm', 15) +
    '| ' +
    pad('voted origin', 16) +
    '| ' +
    pad('struct origin', 16) +
    '| ' +
    pad('o?', 4) +
    '| ' +
    pad('gate axes', 14) +
    '| ' +
    pad('onto axes', 14) +
    '| ' +
    pad('correction signals', 54) +
    '| ax?',
);
console.log('-'.repeat(152));
for (let i = 0; i < cells.length; i++) {
  const l = lifted[i];
  const so = structuralOrigin(l.id);
  const vo = l.votedOrigin;
  const ontoAxes = axesOf(l.event)
    .filter((a) => DERIVABLE_FAILURE_AXES.includes(a))
    .sort();
  const gateAxes = l.gateFailures.filter((a) => DERIVABLE_FAILURE_AXES.includes(a)).sort();
  const repairSignals = correctionSignals(l);
  for (const signal of repairSignals) correctionCounts[signal] += 1;
  const axisMatch = JSON.stringify(ontoAxes) === JSON.stringify(gateAxes);
  if (axisMatch) axisAgree++;
  let oMatch = '-';
  if (!l.meta.isControl && vo !== 'none') {
    originTotal++;
    const m = so === vo;
    if (m) originAgree++;
    oMatch = m ? 'YES' : 'NO';
  }
  console.log(
    pad(`${l.meta.dramaId}/${l.meta.arm}`, 15) +
      '| ' +
      pad(vo, 16) +
      '| ' +
      pad(so, 16) +
      '| ' +
      pad(oMatch, 4) +
      '| ' +
      pad(gateAxes.join(',') || '-', 14) +
      '| ' +
      pad(ontoAxes.join(',') || '-', 14) +
      '| ' +
      pad(repairSignals.join(',') || '-', 54) +
      '| ' +
      (axisMatch ? 'YES' : 'NO'),
  );
}

console.log('\n' + '='.repeat(60));
console.log(`Deliberation sidecar joined for ${delibJoined}/${cells.length} cells (enables the wrong-trigger path).`);
console.log(
  `Derivable-axis reproduction (control_leak, action_gap, mechanism_not_publicly_resolved): ${axisAgree}/${cells.length} cells match the gate`,
);
console.log(`Structural vs critic-voted origin (peripeteia arms w/ recognition): ${originAgree}/${originTotal} agree`);
console.log(`Derivable signal set: ${DERIVABLE.join(', ')}`);
console.log(
  `Correction signals (descriptive population; no required real-cell hit): ${DERIVABLE_CORRECTION_SIGNALS.map(
    (signal) => `${signal}=${correctionCounts[signal]}`,
  ).join(', ')}`,
);
const repairDispositions = Object.fromEntries(
  ['repaired', 'not_repaired', 'indeterminate', 'not_emitted'].map((disposition) => [
    disposition,
    cells.filter((cell) =>
      disposition === 'not_emitted' ? !cell.hamartiaRepair : cell.hamartiaRepair?.disposition === disposition,
    ).length,
  ]),
);
console.log(
  `Public-text repair dispositions: repaired=${repairDispositions.repaired}, not_repaired=${repairDispositions.not_repaired}, indeterminate=${repairDispositions.indeterminate}, not_emitted=${repairDispositions.not_emitted}`,
);

const nonDerivable = {};
for (const l of lifted)
  for (const f of l.gateFailures) if (!DERIVABLE_FAILURE_AXES.includes(f)) nonDerivable[f] = (nonDerivable[f] || 0) + 1;
const ndEntries = Object.entries(nonDerivable);
if (ndEntries.length) {
  console.log('\nGate failures OUTSIDE the v1-derivable set (expected-unreproduced — need richer signal):');
  for (const [f, n] of ndEntries) console.log(`  - ${f}: ${n} cell(s)`);
}

console.log('\nSignals still requiring a joined transcript or deliberation sidecar:');
for (const g of unpopulatableFromGateStruct()) console.log('  - ' + g);
