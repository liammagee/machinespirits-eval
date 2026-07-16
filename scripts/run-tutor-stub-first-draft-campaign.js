#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import {
  assessTutorStubAcceptanceCell,
  expandTutorStubFirstDraftCampaign,
  loadTutorStubFirstDraftCampaign,
  summarizeTutorStubWorkingScreen,
  tutorStubFirstDraftIterationStopping,
} from '../services/tutorStubFirstDraftCampaign.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_WORKING_CONFIG = path.join(ROOT, 'config', 'tutor-stub-campaigns', 'first-draft-working-screens.yaml');

const { values: args } = parseArgs({
  options: {
    config: { type: 'string', default: DEFAULT_WORKING_CONFIG },
    mode: { type: 'string', default: 'validate' },
    iteration: { type: 'string', default: '1' },
    'complete-all-cells': { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

function usage() {
  return `Usage:
  node scripts/run-tutor-stub-first-draft-campaign.js --mode validate
  node scripts/run-tutor-stub-first-draft-campaign.js --mode development --iteration 1
  node scripts/run-tutor-stub-first-draft-campaign.js --config config/.../v20.yaml --mode acceptance
  node scripts/run-tutor-stub-first-draft-campaign.js --mode acceptance --complete-all-cells

Validation expands every command once without making a model call. Development
runs frozen original-only turns sequentially, hard cell first, and stops when a
3/4 cell gate becomes impossible. Acceptance runs the hardest full cell first,
then at most three remaining cells concurrently. --complete-all-cells disables
gate-based campaign stopping for final diagnostic collection.`;
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return filePath;
}

function commandLine(argv) {
  return argv.map((part) => JSON.stringify(part)).join(' ');
}

async function runCommand(argv, { label = 'command' } = {}) {
  console.log(`${label}: ${commandLine(argv)}`);
  await new Promise((resolve, reject) => {
    const child = spawn(argv[0], argv.slice(1), { cwd: ROOT, stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${label} exited with status ${code}`))));
  });
}

async function mapLimit(items, limit, fn) {
  const output = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      output[index] = await fn(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return output;
}

function validationReport(plan, loaded) {
  return {
    schema: 'machinespirits.tutor-stub.first-draft-campaign-validation.v1',
    generatedAt: new Date().toISOString(),
    configPath: loaded.configPath,
    campaignId: loaded.config.id,
    kind: plan.kind,
    valid: true,
    oneCampaignLevelExpansion: true,
    makesModelCalls: false,
    maxConcurrency: plan.maxConcurrency,
    cells: plan.cells.map((cell) => ({
      id: cell.id,
      priority: cell.priority,
      seed: cell.seed,
      seedStatus: cell.seedStatus,
      world: cell.world,
      learnerProfile: cell.learnerProfile,
      commands: cell.commands
        ? cell.commands.map((command) => ({ turn: command.turn, argv: command.argv }))
        : [{ argv: cell.argv }],
    })),
  };
}

function sha256File(filePath) {
  return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function gitHead() {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`could not resolve git HEAD: ${result.stderr}`);
  return result.stdout.trim();
}

function assertFrozenAcceptanceState(frozen) {
  const currentHead = gitHead();
  const currentConfigHash = sha256File(frozen.configPath);
  if (currentHead !== frozen.gitHead || currentConfigHash !== frozen.configSha256) {
    throw new Error(
      'acceptance state changed after campaign start; stop rather than mixing code or configuration between cells',
    );
  }
}

async function runWorkingPreflight(config, cellId) {
  console.log(`preflight before ${cellId}: focused deterministic gates and model-free corpus`);
  await runCommand(['npm', 'run', 'derivation:quality'], { label: `${cellId} world quality` });
  await runCommand(
    [
      process.execPath,
      '--test',
      'tests/tutorStubPromptAudit.test.js',
      'tests/derivationWorldQuality.test.js',
      'tests/tutorStubFrozenReplay.test.js',
      'tests/tutorStubFirstDraftContract.test.js',
      'tests/tutorStubStructuredFirstDraft.test.js',
      'tests/tutorStubResponseComposition.test.js',
      'tests/tutorStubV21PerformanceCalibrationFixture.test.js',
      'tests/tutorStubV25RecognitionFixture.test.js',
      'services/__tests__/tutorStubPerformanceObligationContract.test.js',
      'services/__tests__/tutorStubPerformanceAdjudication.test.js',
      'services/__tests__/tutorStubResponseConfiguration.test.js',
    ],
    { label: `${cellId} focused tests` },
  );
  for (const fixture of config.preflight?.model_free_fixtures || []) {
    await runCommand(
      [
        process.execPath,
        'scripts/replay-tutor-stub-frozen-turns.js',
        '--audit-fixture',
        path.isAbsolute(fixture) ? fixture : path.join(ROOT, fixture),
      ],
      { label: `${cellId} model-free fixture` },
    );
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function workingResultMetrics(result) {
  const completedTurns = (result?.cells || []).reduce(
    (sum, cell) => sum + Number(cell.completedTurns || 0),
    0,
  );
  const configurationRealizationTotal = (result?.cells || []).reduce(
    (sum, cell) =>
      sum + Number(cell.meanConfigurationRealization || 0) * Number(cell.completedTurns || 0),
    0,
  );
  return {
    completedTurns,
    originalCandidatesAccepted: Number(result?.originalAcceptance || 0),
    meanConfigurationRealization: completedTurns
      ? configurationRealizationTotal / completedTurns
      : null,
    semanticRecognitionCorrections: Number(result?.semanticRecognitionCorrections || 0),
    safetyFailures: Number(result?.finalSafetyFailures || 0),
    deterministicFallbacks: Number(result?.deterministicFallbacks || 0),
  };
}

function replayWorkingStoppingHistory({ artifactRoot, throughIteration, maximum }) {
  let previous = null;
  for (let index = 1; index <= throughIteration; index += 1) {
    const resultPath = path.join(artifactRoot, `iteration-${index}`, 'working-screen-result.json');
    if (!fs.existsSync(resultPath)) break;
    const current = workingResultMetrics(readJson(resultPath));
    current.stopping = tutorStubFirstDraftIterationStopping({
      current,
      previous,
      maximumConsecutiveWithoutImprovement: maximum,
    });
    previous = current;
  }
  return previous;
}

async function runDevelopment(plan, config, iteration) {
  const maximumConsecutiveWithoutImprovement =
    config.stopping?.maximum_consecutive_iterations_without_improvement || 2;
  const previousMetrics = replayWorkingStoppingHistory({
    artifactRoot: plan.artifactRoot,
    throughIteration: iteration - 1,
    maximum: maximumConsecutiveWithoutImprovement,
  });
  if (previousMetrics?.stopping?.stop === true) {
    throw new Error(
      `development loop already stopped after ${previousMetrics.stopping.consecutiveWithoutImprovement} consecutive iterations without measurable improvement`,
    );
  }
  if (fs.existsSync(plan.iterationRoot)) {
    const existing = fs.readdirSync(plan.iterationRoot);
    if (existing.length) {
      throw new Error(
        `iteration ${iteration} already has artifacts at ${plan.iterationRoot}; refusing to duplicate live draws`,
      );
    }
  }
  const cellResults = [];
  let campaignStopped = false;
  for (const cell of plan.cells) {
    if (campaignStopped) {
      cellResults.push({
        id: cell.id,
        world: cell.world,
        learnerProfile: cell.learnerProfile,
        seed: cell.seed,
        seedDisposition: 'unconsumed',
        status: 'unstarted_after_required_cell_failure',
        completedTurns: 0,
        unstartedTurns: cell.turns,
      });
      continue;
    }
    await runWorkingPreflight(config, cell.id);
    const reports = [];
    for (const command of cell.commands) {
      await runCommand(command.argv, { label: `${cell.id} frozen turn ${command.turn}` });
      reports.push(readJson(command.outputPath));
      const interim = summarizeTutorStubWorkingScreen({ cell, reports, config });
      console.log(
        `${cell.id}: ${interim.originalCandidatesAccepted}/${interim.completedTurns} originals; ` +
          `maximum possible ${interim.possibility.maximumPossibleAccepted}/${interim.possibility.required}; ` +
          `configuration ${Number(interim.meanConfigurationRealization || 0).toFixed(3)} ` +
          `(maximum ${Number(interim.possibility.configurationRealization.maximumPossibleMean || 0).toFixed(3)})`,
      );
      if (!args['complete-all-cells'] && !interim.possibility.possible) break;
    }
    const summary = summarizeTutorStubWorkingScreen({ cell, reports, config });
    cellResults.push({ ...summary, seedDisposition: reports.length ? 'consumed_development' : 'unconsumed' });
    if (!args['complete-all-cells'] && summary.status !== 'pass') campaignStopped = true;
  }
  const status =
    cellResults.length === plan.cells.length && cellResults.every((cell) => cell.status === 'pass') ? 'pass' : 'fail';
  const result = {
    schema: 'machinespirits.tutor-stub.first-draft-working-screen-result.v1',
    generatedAt: new Date().toISOString(),
    campaignId: config.id,
    iteration,
    heldOut: false,
    status,
    completeAllCells: args['complete-all-cells'],
    changes: config.change_log,
    originalAcceptance: cellResults.reduce((sum, cell) => sum + Number(cell.originalCandidatesAccepted || 0), 0),
    semanticRecognitionCorrections: cellResults.reduce(
      (sum, cell) => sum + Number(cell.semanticRecognitionCorrections || 0),
      0,
    ),
    mechanicalRepairs: 0,
    modelRewrites: 0,
    deterministicFallbacks: 0,
    finalSafetyFailures: cellResults.reduce((sum, cell) => sum + Number(cell.safetyFailures || 0), 0),
    cells: cellResults,
    claimBoundary: config.claim_boundary,
  };
  const completedTurns = cellResults.reduce((sum, cell) => sum + Number(cell.completedTurns || 0), 0);
  const configurationRealizationTotal = cellResults.reduce(
    (sum, cell) => sum + Number(cell.meanConfigurationRealization || 0) * Number(cell.completedTurns || 0),
    0,
  );
  const currentMetrics = {
    completedTurns,
    originalCandidatesAccepted: result.originalAcceptance,
    meanConfigurationRealization: completedTurns ? configurationRealizationTotal / completedTurns : null,
    semanticRecognitionCorrections: result.semanticRecognitionCorrections,
    safetyFailures: result.finalSafetyFailures,
    deterministicFallbacks: result.deterministicFallbacks,
    workingScreenPassed: status === 'pass',
  };
  result.stopping = tutorStubFirstDraftIterationStopping({
    current: currentMetrics,
    previous: previousMetrics,
    maximumConsecutiveWithoutImprovement,
    requireWorkingScreenPass:
      Number(config.stopping?.final_frontier_attempt_iteration) === iteration &&
      config.stopping?.stop_if_final_frontier_attempt_fails === true,
  });
  const resultPath = writeJson(path.join(plan.iterationRoot, 'working-screen-result.json'), result);
  console.log(`working screen ${status}: ${resultPath}`);
  return result;
}

function newestAutoEvalReport(root) {
  const candidates = [];
  function walk(directory) {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const filePath = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(filePath);
      else if (/^auto-eval-.*\.json$/u.test(entry.name)) candidates.push(filePath);
    }
  }
  walk(root);
  return candidates.sort((left, right) => fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs).at(0) || null;
}

async function runAcceptanceCell(cell, config, frozen) {
  assertFrozenAcceptanceState(frozen);
  if (fs.existsSync(cell.outputDir) && fs.readdirSync(cell.outputDir).length) {
    throw new Error(`${cell.id} already has artifacts; refusing to duplicate or relaunch its held-out seed`);
  }
  await runCommand(cell.argv, { label: `${cell.id} held-out acceptance` });
  assertFrozenAcceptanceState(frozen);
  const reportPath = newestAutoEvalReport(cell.outputDir);
  if (!reportPath) throw new Error(`${cell.id} produced no auto-eval report`);
  const report = readJson(reportPath);
  const assessment = assessTutorStubAcceptanceCell(report, config);
  return {
    id: cell.id,
    world: cell.world,
    learnerProfile: cell.learnerProfile,
    seed: cell.seed,
    seedDisposition: assessment.status === 'pass' ? 'consumed_passed' : 'consumed_failed_retired',
    reportPath,
    ...assessment,
  };
}

function aggregateAcceptance(cells, config) {
  const completed = cells.filter((cell) => cell.observed);
  const totalTurns = completed.reduce((sum, cell) => sum + Number(cell.observed.turns || 0), 0);
  const original = completed.reduce((sum, cell) => sum + Number(cell.observed.originalCandidatesAccepted || 0), 0);
  const modelRewrites = completed.reduce((sum, cell) => sum + Number(cell.observed.modelRewrites || 0), 0);
  const fallbacks = completed.reduce((sum, cell) => sum + Number(cell.observed.deterministicFallbacks || 0), 0);
  const first = config.first_draft_gates || {};
  const gates = {
    allCells: completed.length === config.matrix.length && completed.every((cell) => cell.status === 'pass'),
    aggregateOriginalAcceptance:
      totalTurns > 0 &&
      original / totalTurns >= Number(first.minimum_aggregate_original_candidate_acceptance_rate || 0),
    aggregateModelRewriteRate:
      totalTurns > 0 && modelRewrites / totalTurns <= Number(first.maximum_aggregate_model_rewrite_rate ?? 1),
    totalFallbacks: fallbacks <= Number(first.maximum_total_deterministic_fallback_turns ?? Number.MAX_SAFE_INTEGER),
  };
  return {
    completedCells: completed.length,
    totalTurns,
    originalCandidatesAccepted: original,
    originalCandidateAcceptanceRate: totalTurns ? original / totalTurns : null,
    mechanicalRepairs: completed.reduce((sum, cell) => sum + Number(cell.observed.mechanicalRepairs || 0), 0),
    modelRewrites,
    deterministicFallbacks: fallbacks,
    finalSafetyFailures: completed.reduce((sum, cell) => sum + Number(cell.observed.finalSafetyFailures || 0), 0),
    meanOriginalLatencyMs: totalTurns
      ? completed.reduce(
          (sum, cell) => sum + Number(cell.observed.meanOriginalLatencyMs || 0) * Number(cell.observed.turns || 0),
          0,
        ) / totalTurns
      : null,
    meanTotalTutorLatencyMs: totalTurns
      ? completed.reduce(
          (sum, cell) => sum + Number(cell.observed.meanTotalTutorLatencyMs || 0) * Number(cell.observed.turns || 0),
          0,
        ) / totalTurns
      : null,
    gates,
    status: Object.values(gates).every(Boolean) ? 'pass' : 'fail',
  };
}

async function runAcceptance(plan, config, loaded) {
  const frozen = {
    gitHead: gitHead(),
    configPath: loaded.configPath,
    configSha256: sha256File(loaded.configPath),
  };
  const cells = [];
  const [hardest, ...remaining] = plan.cells;
  const hardestResult = await runAcceptanceCell(hardest, config, frozen);
  cells.push(hardestResult);
  if (hardestResult.status !== 'pass' && !args['complete-all-cells']) {
    cells.push(
      ...remaining.map((cell) => ({
        id: cell.id,
        world: cell.world,
        learnerProfile: cell.learnerProfile,
        seed: cell.seed,
        seedDisposition: 'unconsumed',
        status: 'unstarted_after_hard_cell_failure',
      })),
    );
  } else {
    const rest = await mapLimit(remaining, Math.min(3, plan.maxConcurrency), (cell) =>
      runAcceptanceCell(cell, config, frozen),
    );
    cells.push(...rest);
  }
  const aggregate = aggregateAcceptance(cells, config);
  const result = {
    schema: 'machinespirits.tutor-stub.first-draft-acceptance-result.v1',
    generatedAt: new Date().toISOString(),
    campaignId: config.id,
    frozen,
    completeAllCells: args['complete-all-cells'],
    status: aggregate.status,
    cells,
    aggregate,
    claimBoundary: config.claim_boundary,
  };
  const resultPath = writeJson(path.join(plan.artifactRoot, 'campaign-result.json'), result);
  console.log(`acceptance ${result.status}: ${resultPath}`);
  return result;
}

async function main() {
  if (args.help) {
    console.log(usage());
    return;
  }
  const mode = String(args.mode || '')
    .trim()
    .toLowerCase();
  if (!['validate', 'development', 'acceptance'].includes(mode)) {
    throw new Error('--mode must be validate, development, or acceptance');
  }
  const iteration = Number(args.iteration);
  if (!Number.isInteger(iteration) || iteration < 1) throw new Error('--iteration must be a positive integer');
  const loaded = loadTutorStubFirstDraftCampaign(args.config, { root: ROOT });
  const plan = expandTutorStubFirstDraftCampaign({
    config: loaded.config,
    root: ROOT,
    iteration,
  });
  const validation = validationReport(plan, loaded);
  const validationPath = writeJson(path.join(plan.artifactRoot, 'campaign-validation.json'), validation);
  console.log(`campaign validation: ${validationPath}`);
  if (mode === 'validate') return;
  let result;
  if (mode === 'development') {
    if (plan.kind !== 'working_screen') throw new Error('development mode requires a working-screen config');
    result = await runDevelopment(plan, loaded.config, iteration);
  } else {
    if (plan.kind !== 'acceptance') throw new Error('acceptance mode requires a held-out generalization config');
    result = await runAcceptance(plan, loaded.config, loaded);
  }
  if (result.status !== 'pass') process.exitCode = 1;
}

main().catch((error) => {
  console.error(`error: ${error.message}`);
  process.exitCode = 1;
});
