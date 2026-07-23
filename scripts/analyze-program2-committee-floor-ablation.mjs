#!/usr/bin/env node
// Program-2 trained-vs-untuned committee floor ablation.
// Implements PROGRAM-2-COMMITTEE-FLOOR-ABLATION-PREREGISTRATION.md §4-§5.
//
// Usage:
//   node scripts/analyze-program2-committee-floor-ablation.mjs [<run-root>] [--json <out>]

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), '..');
const integrityPath = path.join(REPO_ROOT, 'services/tutorStubEvalIntegrity.js');
const { summarizeTutorStubFixedHorizon } = await import(pathToFileURL(integrityPath).href);

export const FLOOR_ABLATION_ANALYSIS_SPEC = Object.freeze({
  schema: 'machinespirits.program2.committee-floor-ablation-analysis.v1',
  preregistration: 'PROGRAM-2-COMMITTEE-FLOOR-ABLATION-PREREGISTRATION.md',
  detectorVersion: 'step4-frozen-2026-07-14.v1',
  primaryTrigger: 'warrant_skip',
  profiles: Object.freeze(['proof_skipper', 'affective_resistant']),
  bootstrapDraws: 5000,
  bootstrapSeed: 20260723,
  primaryHorizon: 16,
  equivalenceMargin: 0.1,
  densityMin: 15,
  coverageMargin: 0.05,
  safetyMargin: 0.1,
  expected: Object.freeze({ trained_committee: 12, untuned_committee: 12, silent_control: 6 }),
});

function mulberry32(seed) {
  let value = seed >>> 0;
  return function random() {
    value += 0x6d2b79f5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

export function pooledWarrantRate(rows) {
  const opp = rows.reduce((sum, row) => sum + Number(row.warrant?.opp || 0), 0);
  const comp = rows.reduce((sum, row) => sum + Number(row.warrant?.comp || 0), 0);
  return { opp, comp, rate: opp > 0 ? comp / opp : null };
}

function meanCoverage(rows) {
  const values = rows
    .map((row) => row.fixedHorizon?.coverageAtHorizon)
    .filter((value) => value !== null && value !== undefined && Number.isFinite(Number(value)))
    .map(Number);
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function safetyRate(rows) {
  return rows.length ? rows.filter((row) => row.fixedHorizon?.hardSafetyPassed === true).length / rows.length : null;
}

function percentileInterval(draws) {
  const valid = draws.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (!valid.length) return null;
  const quantile = (probability) => valid[Math.round(probability * (valid.length - 1))];
  return { draws: valid.length, ci95: [quantile(0.025), quantile(0.975)] };
}

function matchedPairs(trainedRows, untunedRows, profiles) {
  const trainedByKey = new Map(trainedRows.map((row) => [row.job.pairKey, row]));
  const untunedByKey = new Map(untunedRows.map((row) => [row.job.pairKey, row]));
  const pairs = [];
  for (const [pairKey, trained] of trainedByKey) {
    const untuned = untunedByKey.get(pairKey);
    if (!pairKey || !untuned || trained.job.profile !== untuned.job.profile) continue;
    pairs.push({ pairKey, profile: trained.job.profile, trained, untuned });
  }
  return profiles.map((profile) => pairs.filter((pair) => pair.profile === profile));
}

export function pairedProfileBootstrap(
  trainedRows,
  untunedRows,
  {
    profiles = FLOOR_ABLATION_ANALYSIS_SPEC.profiles,
    draws = FLOOR_ABLATION_ANALYSIS_SPEC.bootstrapDraws,
    seed = FLOOR_ABLATION_ANALYSIS_SPEC.bootstrapSeed,
  } = {},
) {
  const strata = matchedPairs(trainedRows, untunedRows, profiles);
  const completePairs = strata.flat();
  const estimateTrained = pooledWarrantRate(completePairs.map((pair) => pair.trained));
  const estimateUntuned = pooledWarrantRate(completePairs.map((pair) => pair.untuned));
  const estimate =
    estimateTrained.rate !== null && estimateUntuned.rate !== null ? estimateTrained.rate - estimateUntuned.rate : null;
  if (!completePairs.length || strata.some((rows) => rows.length === 0)) {
    return {
      pairedBlocks: completePairs.length,
      pairedBlocksByProfile: Object.fromEntries(profiles.map((profile, index) => [profile, strata[index].length])),
      trained: estimateTrained,
      untuned: estimateUntuned,
      estimate,
      bootstrap: null,
    };
  }
  const random = mulberry32(seed);
  const differences = [];
  for (let draw = 0; draw < draws; draw += 1) {
    const trainedPick = [];
    const untunedPick = [];
    for (const pairs of strata) {
      for (let index = 0; index < pairs.length; index += 1) {
        const pair = pairs[Math.floor(random() * pairs.length)];
        trainedPick.push(pair.trained);
        untunedPick.push(pair.untuned);
      }
    }
    const trainedRate = pooledWarrantRate(trainedPick).rate;
    const untunedRate = pooledWarrantRate(untunedPick).rate;
    if (trainedRate !== null && untunedRate !== null) differences.push(trainedRate - untunedRate);
  }
  return {
    pairedBlocks: completePairs.length,
    pairedBlocksByProfile: Object.fromEntries(profiles.map((profile, index) => [profile, strata[index].length])),
    trained: estimateTrained,
    untuned: estimateUntuned,
    estimate,
    bootstrap: percentileInterval(differences),
  };
}

export function independentProfileBootstrap(
  leftRows,
  rightRows,
  {
    profiles = FLOOR_ABLATION_ANALYSIS_SPEC.profiles,
    draws = FLOOR_ABLATION_ANALYSIS_SPEC.bootstrapDraws,
    seed = FLOOR_ABLATION_ANALYSIS_SPEC.bootstrapSeed,
  } = {},
) {
  const leftStrata = profiles.map((profile) => leftRows.filter((row) => row.job.profile === profile));
  const rightStrata = profiles.map((profile) => rightRows.filter((row) => row.job.profile === profile));
  const left = pooledWarrantRate(leftRows);
  const right = pooledWarrantRate(rightRows);
  const estimate = left.rate !== null && right.rate !== null ? left.rate - right.rate : null;
  if ([...leftStrata, ...rightStrata].some((rows) => rows.length === 0)) {
    return { left, right, estimate, bootstrap: null };
  }
  const random = mulberry32(seed);
  const sampleStrata = (strata) => {
    const picked = [];
    for (const rows of strata) {
      for (let index = 0; index < rows.length; index += 1) {
        picked.push(rows[Math.floor(random() * rows.length)]);
      }
    }
    return picked;
  };
  const differences = [];
  for (let draw = 0; draw < draws; draw += 1) {
    const leftRate = pooledWarrantRate(sampleStrata(leftStrata)).rate;
    const rightRate = pooledWarrantRate(sampleStrata(rightStrata)).rate;
    if (leftRate !== null && rightRate !== null) differences.push(leftRate - rightRate);
  }
  return { left, right, estimate, bootstrap: percentileInterval(differences) };
}

function componentRates(rows) {
  const counts = new Map();
  for (const row of rows) {
    for (const verdict of row.verdicts || []) {
      for (const [component, passed] of Object.entries(verdict.components || {})) {
        const count = counts.get(component) || { seen: 0, passed: 0 };
        count.seen += 1;
        if (passed === true) count.passed += 1;
        counts.set(component, count);
      }
    }
  }
  return Object.fromEntries(
    [...counts.entries()].map(([component, count]) => [
      component,
      { ...count, rate: count.seen ? count.passed / count.seen : null },
    ]),
  );
}

function fallbackSummary(rows) {
  const resolutionTally = {};
  const sourceTally = {};
  let fallbackMoments = 0;
  let rescueMoments = 0;
  for (const row of rows) {
    for (const moment of row.moments || []) {
      const source = moment.source || 'null';
      sourceTally[source] = (sourceTally[source] || 0) + 1;
      if (!moment.fallback) continue;
      fallbackMoments += 1;
      const resolution = moment.fallback.resolution || 'null';
      resolutionTally[resolution] = (resolutionTally[resolution] || 0) + 1;
      if (resolution === 'trimmed' || resolution.startsWith('selected_sampled_')) rescueMoments += 1;
    }
  }
  const committeeMoments = Object.values(sourceTally).reduce((sum, count) => sum + count, 0);
  return {
    committeeMoments,
    fallbackMoments,
    fallbackRate: committeeMoments ? fallbackMoments / committeeMoments : null,
    rescueMoments,
    batteryRescueRate: fallbackMoments ? rescueMoments / fallbackMoments : null,
    resolutionTally,
    sourceTally,
  };
}

function incrementTally(tally, key, count = 1) {
  const normalized = key || 'null';
  tally[normalized] = (tally[normalized] || 0) + count;
}

export function summarizeTutorResponseGuard(turnRecords) {
  const outcomeTally = {};
  const guardTriggerTally = {};
  const publicClaimStatusTally = {};
  const publicClaimStatusBasisTally = {};
  let repairedTurns = 0;
  let deterministicFallbackTurns = 0;
  let totalAttempts = 0;

  for (const turn of turnRecords) {
    if (turn?.tutorResponseRepaired === true) repairedTurns += 1;
    if (turn?.tutorDeterministicFallback === true) deterministicFallbackTurns += 1;
    const accounting = turn?.tutorGuardAccounting || {};
    const attempts = Array.isArray(accounting.attempts) ? accounting.attempts : [];
    totalAttempts += attempts.length;
    incrementTally(outcomeTally, accounting.outcome);
    for (const repair of accounting.repairsApplied || []) {
      for (const issue of repair.triggeredBy || []) {
        incrementTally(guardTriggerTally, `${issue.guard || 'unknown'}:${issue.type || 'unknown'}`);
      }
    }
    const firstDraftContract = turn?.firstDraftContract || turn?.prompts?.tutor?.firstDraftContract || null;
    const claimStatus = firstDraftContract?.progression?.public_claim_status;
    if (claimStatus?.status) incrementTally(publicClaimStatusTally, claimStatus.status);
    if (claimStatus?.basis) incrementTally(publicClaimStatusBasisTally, claimStatus.basis);
  }

  const completedTurns = turnRecords.length;
  return {
    completedTurns,
    repairedTurns,
    repairRate: completedTurns ? repairedTurns / completedTurns : null,
    deterministicFallbackTurns,
    deterministicFallbackRate: completedTurns ? deterministicFallbackTurns / completedTurns : null,
    totalAttempts,
    meanAttempts: completedTurns ? totalAttempts / completedTurns : null,
    outcomeTally,
    guardTriggerTally,
    publicClaimStatusTally,
    publicClaimStatusBasisTally,
  };
}

function mergeTallies(target, source) {
  for (const [key, count] of Object.entries(source || {})) incrementTally(target, key, count);
}

function responseGuardSummary(rows) {
  const summary = {
    dialogues: rows.length,
    completedTurns: 0,
    repairedTurns: 0,
    deterministicFallbackTurns: 0,
    totalAttempts: 0,
    outcomeTally: {},
    guardTriggerTally: {},
    publicClaimStatusTally: {},
    publicClaimStatusBasisTally: {},
  };
  for (const row of rows) {
    const guard = row.responseGuard || {};
    summary.completedTurns += Number(guard.completedTurns || 0);
    summary.repairedTurns += Number(guard.repairedTurns || 0);
    summary.deterministicFallbackTurns += Number(guard.deterministicFallbackTurns || 0);
    summary.totalAttempts += Number(guard.totalAttempts || 0);
    mergeTallies(summary.outcomeTally, guard.outcomeTally);
    mergeTallies(summary.guardTriggerTally, guard.guardTriggerTally);
    mergeTallies(summary.publicClaimStatusTally, guard.publicClaimStatusTally);
    mergeTallies(summary.publicClaimStatusBasisTally, guard.publicClaimStatusBasisTally);
  }
  const fallbackExposed = rows.filter((row) => Number(row.responseGuard?.deterministicFallbackTurns || 0) > 0);
  const fallbackUnexposed = rows.filter((row) => Number(row.responseGuard?.deterministicFallbackTurns || 0) === 0);
  return {
    ...summary,
    repairRate: summary.completedTurns ? summary.repairedTurns / summary.completedTurns : null,
    deterministicFallbackRate: summary.completedTurns
      ? summary.deterministicFallbackTurns / summary.completedTurns
      : null,
    meanAttempts: summary.completedTurns ? summary.totalAttempts / summary.completedTurns : null,
    warrantByFallbackExposure: {
      exposed: { dialogues: fallbackExposed.length, ...pooledWarrantRate(fallbackExposed) },
      unexposed: { dialogues: fallbackUnexposed.length, ...pooledWarrantRate(fallbackUnexposed) },
    },
  };
}

function density(rows) {
  const rate = pooledWarrantRate(rows);
  const proofSkipperOpportunities = rows
    .filter((row) => row.job.profile === 'proof_skipper')
    .reduce((sum, row) => sum + Number(row.warrant?.opp || 0), 0);
  return {
    opportunities: rate.opp,
    minimum: FLOOR_ABLATION_ANALYSIS_SPEC.densityMin,
    proofSkipperOpportunities,
    pass: rate.opp >= FLOOR_ABLATION_ANALYSIS_SPEC.densityMin && proofSkipperOpportunities > 0,
  };
}

function guardrails(rows, controls) {
  const coverage = meanCoverage(rows);
  const controlCoverage = meanCoverage(controls);
  const safety = safetyRate(rows);
  const controlSafety = safetyRate(controls);
  return {
    coverage: {
      condition: coverage,
      control: controlCoverage,
      margin: FLOOR_ABLATION_ANALYSIS_SPEC.coverageMargin,
      pass:
        coverage !== null &&
        controlCoverage !== null &&
        coverage >= controlCoverage - FLOOR_ABLATION_ANALYSIS_SPEC.coverageMargin,
    },
    safety: {
      condition: safety,
      control: controlSafety,
      margin: FLOOR_ABLATION_ANALYSIS_SPEC.safetyMargin,
      pass:
        safety !== null &&
        controlSafety !== null &&
        safety >= controlSafety - FLOOR_ABLATION_ANALYSIS_SPEC.safetyMargin,
    },
    leaks: rows.flatMap((row) =>
      (row.leakTurns || []).map((turn) => ({ job: row.job.id, profile: row.job.profile, turn })),
    ),
  };
}

export function analyzeFloorAblationRows(
  rows,
  { draws = FLOOR_ABLATION_ANALYSIS_SPEC.bootstrapDraws, seed = FLOOR_ABLATION_ANALYSIS_SPEC.bootstrapSeed } = {},
) {
  const byCondition = Object.fromEntries(
    Object.keys(FLOOR_ABLATION_ANALYSIS_SPEC.expected).map((condition) => [
      condition,
      rows.filter((row) => row.job.condition === condition),
    ]),
  );
  const trained = byCondition.trained_committee;
  const untuned = byCondition.untuned_committee;
  const controls = byCondition.silent_control;
  const sealed = Object.fromEntries(
    Object.entries(byCondition).map(([condition, conditionRows]) => [condition, conditionRows.length]),
  );
  const paired = pairedProfileBootstrap(trained, untuned, { draws, seed });
  const untunedControl = independentProfileBootstrap(untuned, controls, { draws, seed });
  const trainedControl = independentProfileBootstrap(trained, controls, { draws, seed });
  const ci = paired.bootstrap?.ci95 || null;
  const trainedPositive = Boolean(ci && ci[0] > 0);
  const trainedNegative = Boolean(ci && ci[1] < 0);
  const equivalent = Boolean(
    ci &&
    ci[0] >= -FLOOR_ABLATION_ANALYSIS_SPEC.equivalenceMargin &&
    ci[1] <= FLOOR_ABLATION_ANALYSIS_SPEC.equivalenceMargin,
  );
  const untunedAdvantage = Boolean(untunedControl.bootstrap?.ci95?.[0] > 0);
  const trainedAdvantage = Boolean(trainedControl.bootstrap?.ci95?.[0] > 0);
  const densityByCondition = {
    trained_committee: density(trained),
    untuned_committee: density(untuned),
  };
  const complete = Object.entries(FLOOR_ABLATION_ANALYSIS_SPEC.expected).every(
    ([condition, expected]) => sealed[condition] === expected,
  );
  const ready =
    complete &&
    paired.pairedBlocks === 12 &&
    densityByCondition.trained_committee.pass &&
    densityByCondition.untuned_committee.pass;
  let reading = 'incomplete_or_under_informative';
  if (ready && trainedNegative) reading = 'untuned_outperforms_trained';
  else if (ready && trainedPositive && trainedAdvantage) reading = 'trained_weights_add_live_gain';
  else if (ready && trainedPositive) reading = 'trained_weights_improve_committee_absolute_gain_unresolved';
  else if (ready && equivalent && untunedAdvantage) reading = 'harness_sufficient_within_equivalence_margin';
  else if (ready && untunedAdvantage) reading = 'harness_contributes_training_increment_unresolved';
  else if (ready) reading = 'indeterminate';
  const responseGuardByCondition = Object.fromEntries(
    Object.entries(byCondition).map(([condition, conditionRows]) => [condition, responseGuardSummary(conditionRows)]),
  );
  const trainedFallbackRate = responseGuardByCondition.trained_committee.deterministicFallbackRate;
  const untunedFallbackRate = responseGuardByCondition.untuned_committee.deterministicFallbackRate;

  return {
    schema: FLOOR_ABLATION_ANALYSIS_SPEC.schema,
    preregistration: FLOOR_ABLATION_ANALYSIS_SPEC.preregistration,
    generatedAt: new Date().toISOString(),
    bootstrap: { draws, seed, unit: 'dialogue', profileStratified: true },
    sealed: { ...sealed, expected: FLOOR_ABLATION_ANALYSIS_SPEC.expected, complete },
    primary: {
      contrast: 'trained_committee - untuned_committee',
      ...paired,
      trainingContributionDetected: trainedPositive,
      untunedOutperformsTrained: trainedNegative,
      equivalenceMargin: FLOOR_ABLATION_ANALYSIS_SPEC.equivalenceMargin,
      practicallyEquivalent: equivalent,
    },
    secondary: {
      untunedMinusControl: { ...untunedControl, advantageDetected: untunedAdvantage },
      trainedMinusControl: { ...trainedControl, advantageDetected: trainedAdvantage },
    },
    density: densityByCondition,
    guardrails: {
      trained_committee: guardrails(trained, controls),
      untuned_committee: guardrails(untuned, controls),
    },
    mechanisms: {
      trained_committee: fallbackSummary(trained),
      untuned_committee: fallbackSummary(untuned),
    },
    responseGuardDiagnostics: {
      role: 'diagnostic_only',
      changesConfirmatoryEstimands: false,
      historicalComparisonPolicy: 'stratify_by_harness_revision',
      interpretationRule:
        'If an apparent W1 difference is confined to unequal deterministic-fallback exposure, label it infrastructure-mediated.',
      trainedMinusUntunedFallbackRate:
        trainedFallbackRate === null || untunedFallbackRate === null ? null : trainedFallbackRate - untunedFallbackRate,
      byCondition: responseGuardByCondition,
    },
    components: {
      trained_committee: componentRates(trained),
      untuned_committee: componentRates(untuned),
      silent_control: componentRates(controls),
    },
    readyForLicensedReading: ready,
    reading,
  };
}

function leakTurns(turnRecords) {
  return turnRecords
    .filter((turn) => {
      const leaks = turn?.tutorLeakAudit?.leaks;
      return (Array.isArray(leaks) && leaks.length > 0) || turn?.tutorLeakAudit?.ok === false;
    })
    .map((turn) => Number(turn.turn || 0));
}

export function loadSealedFloorAblationRows(root) {
  const planPath = path.join(root, 'launch-plan.json');
  const plan = JSON.parse(fs.readFileSync(planPath, 'utf8')).plan;
  const rows = [];
  for (const job of plan.jobs) {
    const traceDir = path.join(root, 'traces', job.id);
    if (!fs.existsSync(traceDir)) continue;
    const sealedFile = fs
      .readdirSync(traceDir)
      .filter((file) => file.endsWith('.jsonl'))
      .map((file) => path.join(traceDir, file))
      .find((file) => {
        const text = fs.readFileSync(file, 'utf8');
        return text.includes('"type":"run_end"') || text.includes('"type": "run_end"');
      });
    if (!sealedFile) continue;
    const turnRecords = [];
    const firstDraftContracts = new Map();
    const verdicts = [];
    const moments = [];
    for (const line of fs.readFileSync(sealedFile, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      let event;
      try {
        event = JSON.parse(line);
      } catch {
        continue;
      }
      if (event.type === 'tutor_first_draft_contract' && event.contract) {
        firstDraftContracts.set(Number(event.turn), event.contract);
      } else if (event.type === 'turn_complete' && event.turnRecord) {
        const tracedContract = firstDraftContracts.get(Number(event.turn)) || null;
        turnRecords.push({
          ...event.turnRecord,
          firstDraftContract:
            event.turnRecord.firstDraftContract ||
            event.turnRecord.prompts?.tutor?.firstDraftContract ||
            tracedContract,
        });
      } else if (
        event.type === 'point_of_action_compliance' &&
        event.compliance?.trigger === FLOOR_ABLATION_ANALYSIS_SPEC.primaryTrigger
      ) {
        verdicts.push(event.compliance);
        if (
          event.compliance.detector_version &&
          event.compliance.detector_version !== FLOOR_ABLATION_ANALYSIS_SPEC.detectorVersion
        ) {
          throw new Error(`${job.id}: detector ${event.compliance.detector_version}`);
        }
      } else if (event.type === 'program2_committee_moment' && event.moment) {
        moments.push({ turn: event.turn, ...event.moment });
      }
    }
    rows.push({
      job,
      trace: path.relative(root, sealedFile),
      warrant: { opp: verdicts.length, comp: verdicts.filter((verdict) => verdict.compliant === true).length },
      verdicts,
      moments,
      fixedHorizon: summarizeTutorStubFixedHorizon(turnRecords, {
        primaryHorizon: FLOOR_ABLATION_ANALYSIS_SPEC.primaryHorizon,
      }),
      leakTurns: leakTurns(turnRecords),
      responseGuard: summarizeTutorResponseGuard(turnRecords),
    });
  }
  return { plan, rows };
}

function fmt(value, digits = 3) {
  return value === null || value === undefined ? 'n/a' : Number(value).toFixed(digits);
}

function fmtContrast(contrast) {
  const ci = contrast.bootstrap?.ci95;
  return `${fmt(contrast.estimate)} CI ${ci ? `[${fmt(ci[0])}, ${fmt(ci[1])}]` : 'n/a'}`;
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { json: { type: 'string' } },
  });
  const root = path.resolve(positionals[0] || path.join(REPO_ROOT, 'exports/program2-committee-floor-ablation'));
  const { rows } = loadSealedFloorAblationRows(root);
  const artifact = analyzeFloorAblationRows(rows);
  console.log(
    `[floor-ablation] sealed trained=${artifact.sealed.trained_committee}/12 ` +
      `untuned=${artifact.sealed.untuned_committee}/12 control=${artifact.sealed.silent_control}/6`,
  );
  console.log(
    `[floor-ablation] W1 trained-untuned ${fmtContrast(artifact.primary)}; ` +
      `equivalent=${artifact.primary.practicallyEquivalent ? 'yes' : 'no'}`,
  );
  console.log(
    `[floor-ablation] W2 untuned-control ${fmtContrast(artifact.secondary.untunedMinusControl)}; ` +
      `W3 trained-control ${fmtContrast(artifact.secondary.trainedMinusControl)}`,
  );
  console.log(
    `[floor-ablation] density trained=${artifact.density.trained_committee.opportunities} ` +
      `untuned=${artifact.density.untuned_committee.opportunities}; reading=${artifact.reading}`,
  );
  console.log(
    `[floor-ablation] fallback rescues trained=${fmt(
      artifact.mechanisms.trained_committee.batteryRescueRate,
    )} untuned=${fmt(artifact.mechanisms.untuned_committee.batteryRescueRate)}`,
  );
  if (values.json) {
    fs.writeFileSync(path.resolve(values.json), `${JSON.stringify(artifact, null, 2)}\n`);
    console.log(`[floor-ablation] wrote ${values.json}`);
  }
}

if (path.resolve(process.argv[1] || '') === SCRIPT_PATH) {
  try {
    await main();
  } catch (error) {
    console.error(`[floor-ablation] ${error.message}`);
    process.exit(1);
  }
}
