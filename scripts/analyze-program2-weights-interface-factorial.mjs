#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { componentVector, selectAuthoritativeTraces } from './analyze-program2-floor-ablation-mediation.mjs';
import { loadSealedFloorAblationRows } from './analyze-program2-committee-floor-ablation.mjs';
import { WEIGHTS_INTERFACE_FACTORIAL_SPEC } from './run-program2-live-pilot.js';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), '..');

export const WEIGHTS_INTERFACE_ANALYSIS_SPEC = Object.freeze({
  schema: 'machinespirits.program2.weights-interface-factorial-analysis.v1',
  semanticSchema: 'machinespirits.program2.weights-interface-semantic-judgments.v1',
  trigger: 'warrant_skip',
  draws: 5000,
  seed: 20260726,
  equivalenceMargin: 0.1,
  minSealedPerCell: 10,
  minCompleteBlocks: 8,
  minCompleteBlocksPerProfile: 4,
  minOpportunitiesPerCell: 60,
  minOpportunitiesPerProfileCell: 20,
});

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function percentile(values, q) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * q;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

export function semanticUnitId({ jobId, turn, surface, text }) {
  return `p2wi-${sha256([jobId, turn, surface, text].join('\u001f')).slice(0, 20)}`;
}

function momentsForSelectedJob(selected) {
  const turns = new Map();
  for (const event of selected.authoritative.events) {
    if (event.type === 'turn_complete' && event.turnRecord) turns.set(Number(event.turn), event.turnRecord);
  }
  const moments = [];
  for (const event of selected.authoritative.events) {
    if (event.type !== 'program2_committee_moment' || event.moment?.trigger !== WEIGHTS_INTERFACE_ANALYSIS_SPEC.trigger) {
      continue;
    }
    const turn = Number(event.turn ?? event.moment.turn);
    const record = turns.get(turn) || null;
    const miniText = String(event.moment.miniText || '').trim();
    const selectedSpan = String(event.moment.span || '').trim();
    const approvedText = String(
      event.moment.enforcementLedger?.deliveredText ||
        (event.moment.source === 'composed' ? event.moment.composedText : event.moment.miniText) ||
        '',
    ).trim();
    const finalText = String(record?.tutor || '').trim();
    const surfaceTexts = { raw_mini: miniText, selected_span: selectedSpan, committee_approved: approvedText, final: finalText };
    const semanticUnitIds = Object.fromEntries(
      Object.entries(surfaceTexts).map(([surface, text]) => [
        surface,
        text ? semanticUnitId({ jobId: selected.job.id, turn, surface, text }) : null,
      ]),
    );
    moments.push({
      jobId: selected.job.id,
      condition: selected.job.condition,
      weight: selected.job.weight,
      spanInterface: selected.job.spanInterface,
      profile: selected.job.profile,
      repeat: selected.job.repeat,
      blockKey: selected.job.blockKey,
      turn,
      trace: selected.authoritative.relative,
      source: event.moment.source || null,
      spanStatus: event.moment.enforcementLedger?.selectedSpanStatus || (selectedSpan ? 'ok' : 'no_span'),
      battery: event.moment.battery || null,
      ledger: event.moment.enforcementLedger || null,
      fallback: event.moment.fallback || null,
      finalGuard: record
        ? {
            repaired: record.tutorResponseRepaired === true,
            deterministicFallback: record.tutorDeterministicFallback === true,
            outcome: record.tutorGuardAccounting?.outcome || null,
          }
        : null,
      joinedToCompletedTurn: Boolean(record),
      texts: surfaceTexts,
      components: Object.fromEntries(
        Object.entries(surfaceTexts).map(([surface, text]) => [surface, componentVector(text || null)]),
      ),
      semanticUnitIds,
    });
  }
  return moments;
}

function loadSemanticFile(file) {
  if (!file || !fs.existsSync(file)) return { judgments: [], adjudications: [] };
  const artifact = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (artifact.schema !== WEIGHTS_INTERFACE_ANALYSIS_SPEC.semanticSchema) {
    throw new Error(`unexpected semantic schema ${artifact.schema || 'missing'}`);
  }
  return artifact;
}

function resolvedSemanticMap(artifact) {
  const votes = new Map();
  for (const row of artifact.judgments || []) {
    if (!['valid', 'invalid'].includes(row.verdict)) continue;
    const rows = votes.get(row.unitId) || [];
    rows.push(row);
    votes.set(row.unitId, rows);
  }
  const adjudications = new Map(
    (artifact.adjudications || [])
      .filter((row) => ['valid', 'invalid'].includes(row.verdict))
      .map((row) => [row.unitId, row]),
  );
  const resolved = new Map();
  const disagreements = [];
  for (const [unitId, rows] of votes) {
    const byJudge = [...new Map(rows.map((row) => [row.judge, row])).values()];
    if (byJudge.length < 2) continue;
    const verdicts = new Set(byJudge.map((row) => row.verdict));
    if (verdicts.size === 1) resolved.set(unitId, byJudge[0].verdict === 'valid');
    else if (adjudications.has(unitId)) resolved.set(unitId, adjudications.get(unitId).verdict === 'valid');
    else disagreements.push(unitId);
  }
  return { resolved, disagreements, votes };
}

function rate(rows, key, semantic) {
  const values = rows.map((row) => semantic.resolved.get(row.semanticUnitIds[key])).filter((value) => value !== undefined);
  return { valid: values.filter(Boolean).length, total: values.length, rate: values.length ? values.filter(Boolean).length / values.length : null };
}

function contrastFromRows(rows, semantic, surface = 'raw_mini') {
  const byCondition = Object.fromEntries(
    WEIGHTS_INTERFACE_FACTORIAL_SPEC.conditions.map((condition) => [
      condition,
      rate(rows.filter((row) => row.condition === condition), surface, semantic),
    ]),
  );
  const required = Object.values(byCondition).every((entry) => entry.rate !== null);
  const estimate = required
    ? (byCondition.trained_v1.rate + byCondition.trained_v2.rate) / 2 -
      (byCondition.untuned_v1.rate + byCondition.untuned_v2.rate) / 2
    : null;
  return { byCondition, estimate };
}

function bootstrapW1(rows, semantic, { draws, seed }) {
  const eligibleBlocks = [];
  for (const blockKey of new Set(rows.map((row) => row.blockKey))) {
    const blockRows = rows.filter((row) => row.blockKey === blockKey);
    const conditions = new Set(blockRows.map((row) => row.condition));
    const allResolved = blockRows.every((row) => semantic.resolved.has(row.semanticUnitIds.raw_mini));
    if (WEIGHTS_INTERFACE_FACTORIAL_SPEC.conditions.every((condition) => conditions.has(condition)) && allResolved) {
      eligibleBlocks.push({ blockKey, profile: blockRows[0].profile, rows: blockRows });
    }
  }
  if (!eligibleBlocks.length) return { draws: 0, seed, eligibleBlocks: 0, ci95: null };
  const random = mulberry32(seed);
  const profiles = [...new Set(eligibleBlocks.map((block) => block.profile))];
  const samples = [];
  for (let draw = 0; draw < draws; draw += 1) {
    const sampledRows = [];
    for (const profile of profiles) {
      const stratum = eligibleBlocks.filter((block) => block.profile === profile);
      for (let index = 0; index < stratum.length; index += 1) {
        sampledRows.push(...stratum[Math.floor(random() * stratum.length)].rows);
      }
    }
    const value = contrastFromRows(sampledRows, semantic).estimate;
    if (value !== null) samples.push(value);
  }
  return {
    draws: samples.length,
    seed,
    eligibleBlocks: eligibleBlocks.length,
    ci95: samples.length ? [percentile(samples, 0.025), percentile(samples, 0.975)] : null,
  };
}

export function licensedWeightsInterfaceReading({ completionReady, semanticReady, estimate, ci95 }) {
  if (!completionReady) return 'incomplete_or_under_informative';
  if (!semanticReady || estimate === null || !ci95) return 'pending_semantic_adjudication';
  if (ci95[0] > 0) return 'trained_weights_improve_first_pass_semantic_skill';
  if (ci95[0] >= -WEIGHTS_INTERFACE_ANALYSIS_SPEC.equivalenceMargin && ci95[1] <= WEIGHTS_INTERFACE_ANALYSIS_SPEC.equivalenceMargin) {
    return 'first_pass_semantic_skill_practically_equivalent';
  }
  return 'first_pass_semantic_skill_indeterminate';
}

export function analyzeWeightsInterfaceFactorial(root, { semanticFile = null, draws = 5000, seed = 20260726 } = {}) {
  const selection = selectAuthoritativeTraces(root);
  const floorRows = loadSealedFloorAblationRows(root).rows;
  const selectedSealed = selection.jobs.filter((entry) => entry.authoritative);
  const moments = selectedSealed.flatMap(momentsForSelectedJob);
  const semanticArtifact = loadSemanticFile(semanticFile || path.join(root, 'semantic-judgments.json'));
  const semantic = resolvedSemanticMap(semanticArtifact);
  const sealedByCondition = Object.fromEntries(
    WEIGHTS_INTERFACE_FACTORIAL_SPEC.conditions.map((condition) => [
      condition,
      selectedSealed.filter((entry) => entry.job.condition === condition).length,
    ]),
  );
  const opportunitiesByCondition = Object.fromEntries(
    WEIGHTS_INTERFACE_FACTORIAL_SPEC.conditions.map((condition) => [
      condition,
      moments.filter((row) => row.condition === condition).length,
    ]),
  );
  const opportunitiesByProfileCondition = Object.fromEntries(
    [...new Set(selection.plan.jobs.map((job) => job.profile))].flatMap((profile) =>
      WEIGHTS_INTERFACE_FACTORIAL_SPEC.conditions.map((condition) => [
        `${profile}|${condition}`,
        moments.filter((row) => row.profile === profile && row.condition === condition).length,
      ]),
    ),
  );
  const completeBlocks = [...new Set(selection.plan.jobs.map((job) => job.blockKey))].filter((blockKey) => {
    const sealed = selectedSealed.filter((entry) => entry.job.blockKey === blockKey);
    return WEIGHTS_INTERFACE_FACTORIAL_SPEC.conditions.every((condition) =>
      sealed.some((entry) => entry.job.condition === condition),
    );
  });
  const completeBlocksByProfile = Object.fromEntries(
    [...new Set(selection.plan.jobs.map((job) => job.profile))].map((profile) => [
      profile,
      completeBlocks.filter((blockKey) => blockKey.startsWith(`${profile}:`)).length,
    ]),
  );
  const attritionByCondition = Object.fromEntries(
    WEIGHTS_INTERFACE_FACTORIAL_SPEC.conditions.map((condition) => [
      condition,
      12 - sealedByCondition[condition],
    ]),
  );
  const attritionBalanced = ['v1', 'v2'].every(
    (spanInterface) =>
      Math.abs(attritionByCondition[`trained_${spanInterface}`] - attritionByCondition[`untuned_${spanInterface}`]) <= 1,
  );
  const provenanceFile = path.join(root, 'provenance-audit.json');
  const provenance = fs.existsSync(provenanceFile) ? JSON.parse(fs.readFileSync(provenanceFile, 'utf8')) : null;
  const cueBlindTracePass = moments.every(
    (row) =>
      row.fallback?.policy === 'cue_blind' &&
      row.ledger?.cueInspectedAfterExtraction === false &&
      row.ledger?.miniResamples === 0 &&
      row.ledger?.composerCalls <= 1,
  );
  const traceIntegrityPass =
    selectedSealed.every((entry) => entry.traces.filter((trace) => trace.classification === 'sealed').length === 1) &&
    moments.every((row) => row.joinedToCompletedTurn && row.semanticUnitIds.raw_mini && row.semanticUnitIds.final);
  const safetyPass = floorRows.every((row) => row.fixedHorizon?.hardSafetyPassed === true && row.leakTurns.length === 0);
  const coveragePass = floorRows.every((row) => Number(row.fixedHorizon?.coverageAtHorizon || 0) >= 0.8);
  const gates = {
    sealedPerCell: {
      pass: Object.values(sealedByCondition).every((count) => count >= WEIGHTS_INTERFACE_ANALYSIS_SPEC.minSealedPerCell),
      observed: sealedByCondition,
    },
    completeBlocks: {
      pass:
        completeBlocks.length >= WEIGHTS_INTERFACE_ANALYSIS_SPEC.minCompleteBlocks &&
        Object.values(completeBlocksByProfile).every(
          (count) => count >= WEIGHTS_INTERFACE_ANALYSIS_SPEC.minCompleteBlocksPerProfile,
        ),
      observed: { total: completeBlocks.length, byProfile: completeBlocksByProfile },
    },
    opportunities: {
      pass:
        Object.values(opportunitiesByCondition).every(
          (count) => count >= WEIGHTS_INTERFACE_ANALYSIS_SPEC.minOpportunitiesPerCell,
        ) &&
        Object.values(opportunitiesByProfileCondition).every(
          (count) => count >= WEIGHTS_INTERFACE_ANALYSIS_SPEC.minOpportunitiesPerProfileCell,
        ),
      observed: { byCondition: opportunitiesByCondition, byProfileCondition: opportunitiesByProfileCondition },
    },
    attritionBalance: { pass: attritionBalanced, observed: attritionByCondition },
    provenance: { pass: provenance?.status === 'pass', file: provenanceFile },
    coverage: { pass: coveragePass },
    safety: { pass: safetyPass },
    cueBlindEnforcement: { pass: cueBlindTracePass },
    traceIntegrity: { pass: traceIntegrityPass },
  };
  const completionReady = Object.values(gates).every((gate) => gate.pass);
  const rawRequiredUnits = moments.map((row) => row.semanticUnitIds.raw_mini).filter(Boolean);
  const finalRequiredUnits = moments.map((row) => row.semanticUnitIds.final).filter(Boolean);
  const semanticReady =
    rawRequiredUnits.every((unitId) => semantic.resolved.has(unitId)) && semantic.disagreements.length === 0;
  const w1 = contrastFromRows(moments, semantic, 'raw_mini');
  const bootstrap = semanticReady ? bootstrapW1(moments, semantic, { draws, seed }) : { draws: 0, seed, eligibleBlocks: 0, ci95: null };
  const reading = licensedWeightsInterfaceReading({
    completionReady,
    semanticReady,
    estimate: w1.estimate,
    ci95: bootstrap.ci95,
  });
  return {
    schema: WEIGHTS_INTERFACE_ANALYSIS_SPEC.schema,
    generatedAt: new Date().toISOString(),
    root,
    planSha256: sha256(JSON.stringify(selection.plan)),
    terminal: {
      planned: selection.plan.jobs.length,
      sealed: selectedSealed.length,
      finalizedAttrition: selection.plan.jobs.length - selectedSealed.length,
    },
    gates,
    completionReady,
    semantic: {
      file: semanticFile || path.join(root, 'semantic-judgments.json'),
      rawRequired: rawRequiredUnits.length,
      rawResolved: rawRequiredUnits.filter((unitId) => semantic.resolved.has(unitId)).length,
      finalRequired: finalRequiredUnits.length,
      finalResolved: finalRequiredUnits.filter((unitId) => semantic.resolved.has(unitId)).length,
      disagreementsPending: semantic.disagreements,
      ready: semanticReady,
    },
    primary: { w1, bootstrap, equivalenceMargin: WEIGHTS_INTERFACE_ANALYSIS_SPEC.equivalenceMargin },
    secondary: {
      finalSemantic: contrastFromRows(moments, semantic, 'final'),
      components: Object.fromEntries(
        WEIGHTS_INTERFACE_FACTORIAL_SPEC.conditions.map((condition) => {
          const rows = moments.filter((row) => row.condition === condition);
          const total = rows.length;
          const mean = (predicate) => (total ? rows.filter(predicate).length / total : null);
          return [
            condition,
            {
              opportunities: total,
              rawCueRate: mean((row) => row.components.raw_mini.cue),
              selectedCueRate: mean((row) => row.components.selected_span.cue),
              selectedExactlyOneQuestionRate: mean((row) => row.components.selected_span.exactlyOneQuestion),
              noSpanRate: mean((row) => row.spanStatus === 'no_span'),
              composerRejectionRate: mean((row) => row.ledger?.composerCalled && !row.ledger?.composerAccepted),
              originalMiniFallbackRate: mean((row) => row.ledger?.fallbackSource === 'original_greedy_mini'),
              downstreamRepairRate: mean((row) => row.finalGuard?.repaired),
              downstreamDeterministicFallbackRate: mean((row) => row.finalGuard?.deterministicFallback),
            },
          ];
        }),
      ),
    },
    reading,
    moments,
  };
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      json: { type: 'string' },
      semantic: { type: 'string' },
      draws: { type: 'string', default: String(WEIGHTS_INTERFACE_ANALYSIS_SPEC.draws) },
    },
  });
  const root = path.resolve(positionals[0] || path.join(REPO_ROOT, 'exports/program2-weights-interface-factorial'));
  const artifact = analyzeWeightsInterfaceFactorial(root, {
    semanticFile: values.semantic ? path.resolve(values.semantic) : null,
    draws: Number(values.draws),
  });
  if (values.json) fs.writeFileSync(path.resolve(values.json), `${JSON.stringify(artifact, null, 2)}\n`);
  console.log(`[weights-interface] ${artifact.terminal.sealed}/${artifact.terminal.planned} sealed; ${artifact.reading}`);
  console.log(`[weights-interface] W1 ${artifact.primary.w1.estimate ?? 'pending'} CI ${JSON.stringify(artifact.primary.bootstrap.ci95)}`);
  if (values.json) console.log(`[weights-interface] wrote ${values.json}`);
}

if (path.resolve(process.argv[1] || '') === SCRIPT_PATH) {
  try {
    await main();
  } catch (error) {
    console.error(`[weights-interface] ${error.stack || error.message}`);
    process.exit(1);
  }
}
