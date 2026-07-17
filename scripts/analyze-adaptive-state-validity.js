#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import {
  appendRunEvent,
  assertExperimentRun,
  buildExperimentRunPlan,
  canonicalJson,
  captureGitFingerprint,
  createRunPlan,
  createRunSeal,
  hashCanonicalJson,
  hashFile,
} from '../services/experimentRunArtifacts.js';
import {
  evaluateAdaptiveStateValidity,
  verifyStateValiditySplitManifest,
} from '../services/adaptiveTutor/stateValidityMetrics.js';

const SCRIPT = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(SCRIPT), '..');

function timestamp() {
  return new Date().toISOString().replace(/[:.]/gu, '-');
}

function resolvePath(value) {
  return path.isAbsolute(value) ? value : path.resolve(ROOT, value);
}

function readJsonl(filePath) {
  return fs
    .readFileSync(filePath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`Invalid benchmark JSONL at line ${index + 1}: ${error.message}`);
      }
    });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeExclusive(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  try {
    fs.writeFileSync(filePath, content, { flag: 'wx', mode: 0o600 });
  } catch (error) {
    if (error?.code === 'EEXIST') throw new Error(`Refusing to overwrite state-validity artifact at ${filePath}`);
    throw error;
  }
}

function fmt(value, digits = 3) {
  return Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : '—';
}

function fmtInterval(metric) {
  const interval = metric?.confidenceInterval;
  if (!interval) return '—';
  return `${fmt(metric.pointDelta)} [${fmt(interval.lower)}, ${fmt(interval.upper)}]`;
}

export function renderAdaptiveStateValidityMarkdown(report) {
  const lines = [
    '# Adaptive learner-state validity',
    '',
    `Generated: ${report.generatedAt}`,
    `Rows: ${report.rowCount}`,
    `Analysis protocol settings: **${report.analysisProtocolGrade}** (this labels the resampling and calibration settings, not the evidence status)`,
    `Verdict: **${report.sensorGate.status}**`,
    `Engineering decision: **${report.sensorGate.engineeringDecision}**`,
    '',
    report.sensorGate.claimBoundary,
    '',
    '## Held-out predictive results',
    '',
    '| Target | Representation | Kind | N | Log loss | Brier | ECE | Top-1 | Top-k | Macro recall |',
    '|---|---|---|---:|---:|---:|---:|---:|---:|---:|',
  ];
  for (const [representation, result] of Object.entries(report.representations)) {
    for (const [target, targetResult] of Object.entries(result.targets || {})) {
      const metrics = targetResult.aggregate;
      lines.push(
        `| ${target} | ${representation} | ${result.kind} | ${metrics.n} | ${fmt(metrics.logLoss)} | ${fmt(metrics.brierScore)} | ${fmt(metrics.expectedCalibrationError)} | ${fmt(metrics.top1Accuracy)} | ${fmt(metrics.topKAccuracy)} | ${fmt(metrics.macroRecall)} |`,
      );
    }
  }
  lines.push('', '## Incremental value over lean', '');
  lines.push(
    `Paired ${fmt((report.uncertainty?.confidenceLevel || 0) * 100, 1)}% percentile intervals resample whole \`${report.uncertainty?.groupKey || 'dialogue_id'}\` groups; positive deltas favor the candidate.`,
    '',
  );
  lines.push('| Target | Representation | Δ log loss [CI] | P(improve) | Δ Brier [CI] | P(improve) | Δ top-1 [CI] |');
  lines.push('|---|---|---:|---:|---:|---:|---:|');
  for (const [target, rows] of Object.entries(report.incrementalValueOverLean || {})) {
    for (const [representation, delta] of Object.entries(rows || {})) {
      if (!delta) continue;
      const bootstrap = delta.pairedBootstrap;
      lines.push(
        `| ${target} | ${representation} | ${fmtInterval(bootstrap?.metrics?.logLoss)} | ${fmt(bootstrap?.metrics?.logLoss?.probabilityOfImprovement)} | ${fmtInterval(bootstrap?.metrics?.brierScore)} | ${fmt(bootstrap?.metrics?.brierScore?.probabilityOfImprovement)} | ${fmtInterval(bootstrap?.metrics?.top1Accuracy)} |`,
      );
    }
  }
  lines.push('', '## Gate detail', '');
  const settings = report.sensorGate.claimGradeSettings;
  lines.push(
    `Claim-grade settings: **${settings?.passed ? 'pass' : 'fail'}** (bootstrap iterations ${settings?.observed?.bootstrapIterations}/${settings?.required?.minimumBootstrapIterations}; confidence ${fmt(settings?.observed?.confidenceLevel)}/${fmt(settings?.required?.minimumConfidenceLevel)}; improvement probability ${fmt(settings?.observed?.minimumImprovementProbability)}/${fmt(settings?.required?.minimumImprovementProbability)}; group ${settings?.observed?.bootstrapGroupKey || '—'}/${settings?.required?.requiredBootstrapGroupKey || '—'}).`,
    '',
  );
  for (const row of report.sensorGate.representations || []) {
    lines.push(
      `- **${row.representation}:** ${row.passedTargets.length ? row.passedTargets.join(', ') : 'no target passed'}`,
    );
    for (const target of row.improvements || []) {
      if (!target.evaluable) {
        lines.push(`  - ${target.target}: not evaluable (${target.reason || 'no valid grouped holdout'})`);
        continue;
      }
      lines.push(
        `  - ${target.target}: calibration ${target.calibrationPassed ? 'pass' : 'fail'} (ECE ${fmt(target.calibration?.expectedCalibrationError)} ≤ ${fmt(target.calibration?.maximumExpectedCalibrationError)}, n=${target.calibration?.n || 0}); lean uncertainty ${target.uncertaintyPassed ? 'pass' : 'fail'}; placebos ${target.placeboPassed ? 'pass' : 'fail'}; independent learner/model holdout ${target.independentHoldoutPassed ? 'pass' : 'fail'}; improving held-outs worlds=${target.worldLevels}, latent-generators=${target.latentGeneratorLevels}, learner-sources=${target.learnerSourceLevels}, model-families=${target.modelFamilyLevels}`,
      );
    }
  }
  lines.push('', '## Interpretation boundary', '');
  lines.push(
    'A positive result is confined to the sealed data sources, exact targets, grouped holdouts, and model families named in this artifact. No human-learning or policy-efficacy claim follows from this analysis.',
  );
  return `${lines.join('\n')}\n`;
}

export function analyzeAdaptiveStateBenchmark({
  benchmarkDir,
  outDir = null,
  representations = null,
  targets = null,
  k = 7,
  runSeed = 20260711,
  bootstrapIterations = 2000,
  bootstrapSeed = runSeed,
  bootstrapConfidenceLevel = 0.95,
  bootstrapGroupKey = null,
  minimumImprovementProbability = 0.95,
} = {}) {
  const source = resolvePath(benchmarkDir);
  const sourceVerification = assertExperimentRun(source);
  const benchmarkPath = path.join(source, 'benchmark.jsonl');
  if (!fs.existsSync(benchmarkPath)) throw new Error(`Missing benchmark.jsonl under ${source}`);
  const splitManifestPath = path.join(source, 'split-manifest.json');
  if (!fs.existsSync(splitManifestPath)) throw new Error(`Missing split-manifest.json under ${source}`);
  const splitManifest = readJson(splitManifestPath);
  const rows = readJsonl(benchmarkPath);
  const verifiedSplitManifest = verifyStateValiditySplitManifest(rows, splitManifest);
  const bootstrap = {
    iterations: bootstrapIterations,
    seed: bootstrapSeed,
    confidenceLevel: bootstrapConfidenceLevel,
    groupKey: bootstrapGroupKey || verifiedSplitManifest.atomicUnit,
    minimumImprovementProbability,
  };
  const report = evaluateAdaptiveStateValidity(rows, {
    representations: representations?.length ? representations : null,
    targets: targets?.length ? targets : null,
    k,
    holdoutAxes: verifiedSplitManifest.holdoutAxes,
    folds: verifiedSplitManifest.folds,
    gatePolicy: verifiedSplitManifest.gatePolicy,
    splitManifest: verifiedSplitManifest,
    bootstrap,
  });
  const output = resolvePath(
    outDir || path.join(path.dirname(source), `${path.basename(source)}-analysis-${timestamp()}`),
  );
  const git = captureGitFingerprint({ repoRoot: ROOT });
  delete git.repoRoot;
  const plan = buildExperimentRunPlan({
    runId: path.basename(output),
    runner: 'scripts/analyze-adaptive-state-validity.js',
    provenance: { git },
    models: { analyzer: { requested: 'node/offline', resolved: process.version, observed: process.version } },
    requiredObservedModelRoles: [],
    hashes: {
      runner: hashFile(SCRIPT),
      analyzer: hashFile(path.join(ROOT, 'services', 'adaptiveTutor', 'stateValidityMetrics.js')),
      policy: hashFile(path.join(ROOT, 'services', 'adaptiveTutor', 'actionPolicy.js')),
      profile: sourceVerification.plan.hashes.profile,
      prompt: sourceVerification.plan.hashes.prompt,
      world: sourceVerification.plan.hashes.world,
      config: sourceVerification.plan.hashes.config,
    },
    masterSeed: runSeed,
    jobs: [
      {
        id: 'state-validity-analysis',
        benchmarkRunId: sourceVerification.plan.runId,
        benchmarkSha256: hashFile(benchmarkPath),
        representations: representations || 'all',
        targets: targets || 'all',
        k,
        bootstrap,
      },
    ],
    lineage: {
      parentRunId: sourceVerification.plan.runId,
      resumeOf: null,
      supersedes: [],
    },
    intent: {
      benchmarkRunId: sourceVerification.plan.runId,
      benchmarkSealSha256: hashFile(path.join(source, 'run-seal.json')),
      metrics: [
        'multiclass_log_loss',
        'multiclass_brier',
        'ece',
        'top_k',
        'rare_class_pr',
        'abstention',
        'paired_group_bootstrap',
      ],
      claimBoundary: report.sensorGate.claimBoundary,
    },
    metadata: {
      splitManifestSha256: report.splitManifestSha256,
      sourceSplitManifestSha256: hashFile(splitManifestPath),
      verifiedSplitSemanticsSha256: hashCanonicalJson(verifiedSplitManifest),
      sourceInventorySha256: sourceVerification.seal.inventorySha256,
      analysisOptionsSha256: hashCanonicalJson({
        representations,
        targets,
        k,
        bootstrap,
        gatePolicy: verifiedSplitManifest.gatePolicy,
      }),
    },
  });
  createRunPlan(output, plan);
  appendRunEvent(output, { type: 'analysis_started', rows: rows.length });
  writeExclusive(
    path.join(output, 'state-validity-report.json'),
    canonicalJson(report, { space: 2, trailingNewline: true }),
  );
  writeExclusive(path.join(output, 'state-validity-report.md'), renderAdaptiveStateValidityMarkdown(report));
  appendRunEvent(output, {
    type: 'analysis_completed',
    verdict: report.sensorGate.status,
    engineeringDecision: report.sensorGate.engineeringDecision,
  });
  createRunSeal(output, {
    metadata: {
      rows: rows.length,
      verdict: report.sensorGate.status,
      engineeringDecision: report.sensorGate.engineeringDecision,
    },
  });
  const verification = assertExperimentRun(output);
  return { output, report, verification };
}

function csv(value) {
  return String(value || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

async function main() {
  const { values } = parseArgs({
    options: {
      'benchmark-dir': { type: 'string' },
      out: { type: 'string' },
      representations: { type: 'string', default: '' },
      targets: { type: 'string', default: '' },
      k: { type: 'string', default: '7' },
      seed: { type: 'string', default: '20260711' },
      'bootstrap-iterations': { type: 'string', default: '2000' },
      'bootstrap-seed': { type: 'string' },
      'bootstrap-confidence': { type: 'string', default: '0.95' },
      'bootstrap-group': { type: 'string' },
      'improvement-probability': { type: 'string', default: '0.95' },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  if (values.help || !values['benchmark-dir']) {
    console.log(
      'Usage: node scripts/analyze-adaptive-state-validity.js --benchmark-dir SEALED_EXPORT [--out DIR] [--representations CSV] [--targets CSV] [--k N] [--bootstrap-iterations N] [--bootstrap-seed N] [--bootstrap-group KEY]',
    );
    if (!values.help) process.exitCode = 1;
    return;
  }
  const result = analyzeAdaptiveStateBenchmark({
    benchmarkDir: values['benchmark-dir'],
    outDir: values.out,
    representations: csv(values.representations),
    targets: csv(values.targets),
    k: Number(values.k),
    runSeed: Number(values.seed),
    bootstrapIterations: Number(values['bootstrap-iterations']),
    bootstrapSeed: Number(values['bootstrap-seed'] ?? values.seed),
    bootstrapConfidenceLevel: Number(values['bootstrap-confidence']),
    bootstrapGroupKey: values['bootstrap-group'] || null,
    minimumImprovementProbability: Number(values['improvement-probability']),
  });
  console.log(`analyzed ${result.report.rowCount} rows into ${result.output}`);
  console.log(`verdict ${result.report.sensorGate.status}: ${result.report.sensorGate.engineeringDecision}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT) {
  main().catch((error) => {
    console.error(error?.stack || error?.message || String(error));
    process.exit(1);
  });
}
