#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { PROGRAM2_WARRANT_CUE_RE } from '../services/program2CommitteeEngine.js';
import { evaluateProgram2RowGuardrails } from '../services/program2ExperimentSafety.js';
import { loadProgram2Phase5eRows } from '../services/program2Phase5ePilotBundle.js';
import { WEIGHTS_INTERFACE_RETEST_SPEC } from './run-program2-live-pilot.js';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(SCRIPT_PATH), '..');

function readPlanArtifact(file) {
  const value = JSON.parse(fs.readFileSync(file, 'utf8'));
  return value.plan || value;
}

function countBy(rows, keyFor) {
  const counts = {};
  for (const row of rows) {
    const key = keyFor(row);
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

function sumBy(rows, keyFor, valueFor) {
  const sums = {};
  for (const row of rows) {
    const key = keyFor(row);
    sums[key] = (sums[key] || 0) + Number(valueFor(row) || 0);
  }
  return sums;
}

function conditionOf(row) {
  return String(row?.job?.condition ?? row?.job?.arm ?? 'unknown');
}

function cueBlindViolation(row) {
  return (row.moments || []).some(
    (moment) =>
      moment?.fallback?.policy !== 'cue_blind' ||
      moment?.enforcementLedger?.cueInspectedAfterExtraction !== false ||
      Number(moment?.enforcementLedger?.miniResamples || 0) !== 0 ||
      Number(moment?.enforcementLedger?.composerCalls || 0) > 1,
  );
}

function componentSummary(rows) {
  const moments = rows.flatMap((row) =>
    (row.moments || [])
      .filter(
        (moment) =>
          moment.trigger === 'warrant_skip' &&
          moment.opportunitySource === WEIGHTS_INTERFACE_RETEST_SPEC.opportunityProtocol,
      )
      .map((moment) => ({ condition: conditionOf(row), ...moment })),
  );
  return Object.fromEntries(
    WEIGHTS_INTERFACE_RETEST_SPEC.conditions.map((condition) => {
      const selected = moments.filter((moment) => moment.condition === condition);
      const total = selected.length;
      const rate = (predicate) => (total ? selected.filter(predicate).length / total : null);
      return [
        condition,
        {
          opportunities: total,
          rawCueRate: rate((moment) => PROGRAM2_WARRANT_CUE_RE.test(String(moment.miniText || ''))),
          selectedCueRate: rate((moment) => PROGRAM2_WARRANT_CUE_RE.test(String(moment.span || ''))),
          noSpanRate: rate((moment) => moment.enforcementLedger?.selectedSpanStatus === 'no_span'),
          composerRejectionRate: rate(
            (moment) => moment.enforcementLedger?.composerCalled && !moment.enforcementLedger?.composerAccepted,
          ),
          originalMiniFallbackRate: rate(
            (moment) => moment.enforcementLedger?.fallbackSource === 'original_greedy_mini',
          ),
        },
      ];
    }),
  );
}

export function analyzeWeightsInterfaceRetestRows({
  plan,
  rows,
  launchState = { jobs: {} },
  gateSpec,
  certificateBound = false,
} = {}) {
  const spec = { ...gateSpec };
  const sealedByCondition = countBy(rows, conditionOf);
  const opportunitiesByCondition = sumBy(rows, conditionOf, (row) => row.warrant?.opp);
  const opportunitiesByProfileCondition = sumBy(
    rows,
    (row) => `${row.job.profile}|${conditionOf(row)}`,
    (row) => row.warrant?.opp,
  );
  const rowsByBlock = new Map();
  for (const row of rows) {
    const bucket = rowsByBlock.get(row.job.blockKey) || [];
    bucket.push(row);
    rowsByBlock.set(row.job.blockKey, bucket);
  }
  const completeBlocks = [...rowsByBlock.entries()]
    .filter(([, blockRows]) => {
      const conditions = new Set(blockRows.map(conditionOf));
      return WEIGHTS_INTERFACE_RETEST_SPEC.conditions.every((condition) => conditions.has(condition));
    })
    .map(([blockKey]) => blockKey);
  const completeBlocksByProfile = countBy(completeBlocks, (blockKey) => blockKey.split(':')[0]);
  const attritionRows = plan.jobs.filter((job) => launchState.jobs?.[job.id]?.attrition === true);
  const attritionByCondition = countBy(attritionRows, (job) => job.condition);
  const attritionBalanceRows = (spec.attritionPairs || []).map(([left, right]) => ({
    left,
    right,
    difference: Math.abs((attritionByCondition[left] || 0) - (attritionByCondition[right] || 0)),
  }));
  const rowGuardrails = evaluateProgram2RowGuardrails(rows, { coverageThreshold: spec.coverageThreshold });
  const gates = {
    sealedPerCell: {
      pass: WEIGHTS_INTERFACE_RETEST_SPEC.conditions.every(
        (condition) => (sealedByCondition[condition] || 0) >= spec.minSealedPerCell,
      ),
      observed: sealedByCondition,
      minimum: spec.minSealedPerCell,
    },
    completeBlocks: {
      pass: completeBlocks.length >= spec.minCompleteBlocks,
      observed: completeBlocks.length,
      minimum: spec.minCompleteBlocks,
    },
    completeBlocksPerProfile: {
      pass: PHASE_PROFILES.every(
        (profile) => (completeBlocksByProfile[profile] || 0) >= spec.minCompleteBlocksPerProfile,
      ),
      observed: completeBlocksByProfile,
      minimum: spec.minCompleteBlocksPerProfile,
    },
    opportunitiesPerCell: {
      pass: WEIGHTS_INTERFACE_RETEST_SPEC.conditions.every(
        (condition) => (opportunitiesByCondition[condition] || 0) >= spec.minOpportunitiesPerCell,
      ),
      observed: opportunitiesByCondition,
      minimum: spec.minOpportunitiesPerCell,
    },
    opportunitiesPerProfileCell: {
      pass: PHASE_PROFILES.every((profile) =>
        WEIGHTS_INTERFACE_RETEST_SPEC.conditions.every(
          (condition) =>
            (opportunitiesByProfileCondition[`${profile}|${condition}`] || 0) >= spec.minOpportunitiesPerProfileCell,
        ),
      ),
      observed: opportunitiesByProfileCondition,
      minimum: spec.minOpportunitiesPerProfileCell,
    },
    scheduledExposurePerRow: {
      pass: rows.every((row) => Number(row.warrant?.scheduledOpp || 0) >= spec.minScheduledOpportunitiesPerRow),
      failures: rows
        .filter((row) => Number(row.warrant?.scheduledOpp || 0) < spec.minScheduledOpportunitiesPerRow)
        .map((row) => ({ jobId: row.job.id, observed: Number(row.warrant?.scheduledOpp || 0) })),
      minimum: spec.minScheduledOpportunitiesPerRow,
    },
    attritionBalance: {
      pass: attritionBalanceRows.every((row) => row.difference <= spec.maxAttritionDifference),
      observed: attritionByCondition,
      contrasts: attritionBalanceRows,
      maximumDifference: spec.maxAttritionDifference,
    },
    coverage: rowGuardrails.coverage,
    safety: rowGuardrails.safety,
    cueBlindEnforcement: {
      pass: rows.every((row) => !cueBlindViolation(row)),
      failures: rows.filter(cueBlindViolation).map((row) => row.job.id),
    },
    traceIntegrity: {
      pass:
        new Set(rows.map((row) => row.job.id)).size === rows.length &&
        rows.every((row) => row.trace?.file && /^[0-9a-f]{64}$/u.test(String(row.trace?.sha256 || ''))),
    },
    certificateBound: { pass: certificateBound },
  };
  const completionReady = Object.values(gates).every((gate) => gate.pass === true);
  const sealedIds = new Set(rows.map((row) => row.job.id));
  return {
    schema: 'machinespirits.program2.weights-interface-retest-analysis.v1',
    generatedAt: new Date().toISOString(),
    preregistration: WEIGHTS_INTERFACE_RETEST_SPEC.preregistration,
    terminal: {
      planned: plan.jobs.length,
      sealed: rows.length,
      finalizedAttrition: attritionRows.length,
      pending: plan.jobs.filter((job) => !sealedIds.has(job.id) && !launchState.jobs?.[job.id]?.attrition).length,
    },
    completionReady,
    gates,
    components: componentSummary(rows),
    semantic: {
      status: completionReady ? 'ready_for_blinded_judging' : 'gated',
      primaryEstimate: null,
    },
    reading: completionReady ? 'ready_for_blinded_semantic_judging' : 'incomplete_or_under_informative',
  };
}

const PHASE_PROFILES = Object.freeze(['affective_resistant', 'proof_skipper']);

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      json: { type: 'string' },
      'gate-spec': {
        type: 'string',
        default: 'config/adaptive-tutor-evidence/program-2-weights-interface-retest-gates.json',
      },
    },
  });
  const root = path.resolve(positionals[0] || path.join(ROOT, 'exports/program2-weights-interface-retest-a1'));
  const planFile = path.join(root, 'launch-plan.json');
  const stateFile = path.join(root, 'launch-state.json');
  const attemptFile = path.join(root, 'launch-attempt.json');
  if (!fs.existsSync(planFile)) throw new Error(`launch plan not found: ${planFile}`);
  const plan = readPlanArtifact(planFile);
  const launchState = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, 'utf8')) : { jobs: {} };
  const launchAttempt = fs.existsSync(attemptFile) ? JSON.parse(fs.readFileSync(attemptFile, 'utf8')) : null;
  const gateSpec = JSON.parse(fs.readFileSync(path.resolve(ROOT, values['gate-spec']), 'utf8'));
  const rows = loadProgram2Phase5eRows({ plan, root });
  const artifact = analyzeWeightsInterfaceRetestRows({
    plan,
    rows,
    launchState,
    gateSpec,
    certificateBound: Boolean(launchAttempt?.launchCertificate?.sha256),
  });
  if (values.json) fs.writeFileSync(path.resolve(values.json), `${JSON.stringify(artifact, null, 2)}\n`);
  console.log(
    `[weights-interface-retest] ${artifact.terminal.sealed}/${artifact.terminal.planned} sealed; ${artifact.reading}`,
  );
  if (values.json) console.log(`[weights-interface-retest] wrote ${path.resolve(values.json)}`);
}

if (path.resolve(process.argv[1] || '') === SCRIPT_PATH) {
  try {
    await main();
  } catch (error) {
    console.error(`[weights-interface-retest] ${error.stack || error.message}`);
    process.exit(1);
  }
}
