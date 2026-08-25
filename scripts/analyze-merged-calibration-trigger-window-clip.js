#!/usr/bin/env node
// Read-only post-run check for merged-calibration run roots.
//
// The merged faceA learner follows the rival proof-DAG, but the bored
// profile contract still demands the classic bored failure pattern by
// turn 2. The registered rival trigger window is turns 1-4. When the
// trigger has not fired yet and the turn-2 check kills the unit, the
// unit dies inside a still-open registered window for an unregistered
// reason. This script names those units so the operator can decide
// whether to loosen the check.
//
// Exit codes: 0 = no window-clipped unit, 2 = at least one, 1 = error.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const RIVAL_V3_SCHEMA = 'machinespirits.tutor-stub.rival-attention-adjudication.v3';
const EXHAUSTION_CODE = 'TUTOR_STUB_BOREDOM_PROOF_DAG_ADHERENCE_EXHAUSTED';
const DEFAULT_MAX_TRIGGER_TURN = 4;

export function classifyTraceEvents(events, { defaultMaxTriggerTurn = DEFAULT_MAX_TRIGGER_TURN } = {}) {
  let triggerTurn = null;
  let exhaustedTurn = null;
  let maxTriggerTurn = null;
  const adjudicationSchemas = new Set();
  for (const event of events) {
    if (event?.type === 'boredom_semantic_adjudication') {
      const adjudication = event.adjudication || {};
      if (adjudication.schema) adjudicationSchemas.add(adjudication.schema);
      if (adjudication.measurement_disposition === 'rival_attention_trigger' && triggerTurn === null) {
        triggerTurn = event.turn ?? null;
      }
    }
    if (event?.type === 'boredom_semantic_measurement_indeterminate_passed_over') {
      if (Number.isInteger(event.maximumTriggerTurn)) maxTriggerTurn = event.maximumTriggerTurn;
    }
    if (event?.type === 'auto_learner_profile_adherence_exhausted' && event.profile === 'bored') {
      exhaustedTurn = event.turn ?? null;
    }
  }
  const windowEnd = maxTriggerTurn ?? defaultMaxTriggerTurn;
  let classification = 'other_substantive';
  if (exhaustedTurn !== null) {
    if (adjudicationSchemas.size > 0 && !adjudicationSchemas.has(RIVAL_V3_SCHEMA)) {
      classification = 'wrong_instrument';
    } else if ((triggerTurn === null || triggerTurn > exhaustedTurn) && exhaustedTurn <= windowEnd) {
      classification = 'trigger_window_clip';
    }
  }
  return {
    classification,
    triggerTurn,
    exhaustedTurn,
    windowEnd,
    adjudicationSchemas: [...adjudicationSchemas],
  };
}

function readJsonlEvents(filePath) {
  return fs
    .readFileSync(filePath, 'utf8')
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => JSON.parse(line));
}

export function analyzeRunRoot(root, options = {}) {
  const ledgerPath = path.join(root, 'run-ledger.jsonl');
  if (!fs.existsSync(ledgerPath)) {
    throw new Error(`no run-ledger.jsonl under ${root}`);
  }
  const ledger = readJsonlEvents(ledgerPath);
  const deadFaceAUnits = ledger.filter(
    (entry) =>
      entry.type === 'unit_complete' && entry.face_id === 'faceA' && entry.registered_failure_code === EXHAUSTION_CODE,
  );
  const units = deadFaceAUnits.map((entry) => {
    const tracesDir = path.join(root, 'jobs', entry.job_id, 'traces');
    const traceFiles = fs.existsSync(tracesDir)
      ? fs
          .readdirSync(tracesDir)
          .filter((name) => name.endsWith('.jsonl'))
          .sort()
      : [];
    const events = traceFiles.flatMap((name) => readJsonlEvents(path.join(tracesDir, name)));
    return { jobId: entry.job_id, ...classifyTraceEvents(events, options) };
  });
  return {
    root,
    deadFaceAUnitCount: units.length,
    windowClipped: units.filter((unit) => unit.classification === 'trigger_window_clip'),
    wrongInstrument: units.filter((unit) => unit.classification === 'wrong_instrument'),
    other: units.filter((unit) => unit.classification === 'other_substantive'),
    units,
  };
}

function main() {
  const args = process.argv.slice(2);
  const rootIndex = args.indexOf('--root');
  const root = rootIndex >= 0 ? args[rootIndex + 1] : null;
  if (!root) {
    console.error('Usage: node scripts/analyze-merged-calibration-trigger-window-clip.js --root <run-root> [--json]');
    process.exit(1);
  }
  const report = analyzeRunRoot(root);
  if (args.includes('--json')) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`run root: ${report.root}`);
    console.log(`faceA units dead on the bored-marker check: ${report.deadFaceAUnitCount}`);
    for (const unit of report.units) {
      console.log(
        `  ${unit.jobId}: ${unit.classification}` +
          ` (trigger turn ${unit.triggerTurn ?? 'never'},` +
          ` killed turn ${unit.exhaustedTurn}, window ends turn ${unit.windowEnd},` +
          ` instrument ${unit.adjudicationSchemas.join('+') || 'none recorded'})`,
      );
    }
    if (report.windowClipped.length > 0) {
      console.log(
        `${report.windowClipped.length} unit(s) died inside the open trigger window with no trigger fired — the unregistered turn-2 check clipped the registered window. Consider loosening it.`,
      );
    } else {
      console.log('no unit died on the window-clip condition.');
    }
  }
  process.exit(report.windowClipped.length > 0 ? 2 : 0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
