#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDerivationAssessment } from '../services/dramaticDerivation/assessment.js';
import { loadWorld } from '../services/dramaticDerivation/world.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_RUN_DIR = path.join(ROOT, 'exports/dramatic-derivation/loop');
const DEFAULT_OUT_DIR = path.join(ROOT, 'exports/dramatic-derivation/learner-dag-diagnostics');

function usage() {
  return `Usage:
  node scripts/analyze-derivation-learner-dag-batch.js \\
    [--run-dir exports/dramatic-derivation/loop] \\
    [--out-dir exports/dramatic-derivation/learner-dag-diagnostics] \\
    [--labels label-a,label-b,...] [--limit N]

Pure local diagnostic: reconstructs/loads learner DAGs, compares them with authored proof paths,
and writes summary.json + report.md. No model calls.`;
}

function resolveRepoPath(value) {
  return path.isAbsolute(value) ? value : path.resolve(ROOT, value);
}

export function parseArgs(argv = []) {
  const opts = {
    runDir: DEFAULT_RUN_DIR,
    outDir: DEFAULT_OUT_DIR,
    labels: [],
    limit: null,
    help: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') return { ...opts, help: true };
    if (arg === '--run-dir') {
      opts.runDir = resolveRepoPath(argv[++i]);
      continue;
    }
    if (arg === '--out-dir') {
      opts.outDir = resolveRepoPath(argv[++i]);
      continue;
    }
    if (arg === '--labels') {
      opts.labels = String(argv[++i] || '')
        .split(',')
        .map((label) => label.trim())
        .filter(Boolean);
      continue;
    }
    if (arg === '--limit') {
      opts.limit = Number(argv[++i]);
      continue;
    }
    throw new Error(`Unknown argument ${arg}\n${usage()}`);
  }
  if (opts.limit !== null && (!Number.isFinite(opts.limit) || opts.limit < 1)) {
    throw new Error('--limit must be a positive number');
  }
  if (opts.limit !== null) opts.limit = Math.floor(opts.limit);
  return opts;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readJsonOptional(filePath) {
  try {
    return readJson(filePath);
  } catch {
    return null;
  }
}

function listLabels(runDir) {
  return fs
    .readdirSync(runDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter(
      (label) =>
        fs.existsSync(path.join(runDir, label, 'result.json')) &&
        fs.existsSync(path.join(runDir, label, 'diagnosis.json')),
    )
    .sort((a, b) => a.localeCompare(b));
}

function countBy(values) {
  const out = {};
  for (const value of values) {
    const key = value || 'unknown';
    out[key] = (out[key] || 0) + 1;
  }
  return out;
}

function avg(values) {
  const finite = values.filter(Number.isFinite);
  if (!finite.length) return null;
  return Number((finite.reduce((sum, value) => sum + value, 0) / finite.length).toFixed(3));
}

function pct(count, total) {
  return total ? Number((count / total).toFixed(3)) : null;
}

function releaseByPremise(dagProfile) {
  const releases = new Map();
  for (const release of dagProfile?.releases || []) {
    releases.set(release.premiseId, release);
  }
  return releases;
}

function classifyMissingPremise({ premiseId, dagProfile, finalTurn }) {
  const release = releaseByPremise(dagProfile).get(premiseId);
  if (!release) {
    return { premiseId, bucket: 'unscheduled', releaseTurn: null, releaseVia: null };
  }
  if (Number.isFinite(finalTurn) && release.turn > finalTurn) {
    return {
      premiseId,
      bucket: 'not_released_before_end',
      releaseTurn: release.turn,
      releaseVia: release.via,
    };
  }
  return {
    premiseId,
    bucket: 'available_not_held',
    releaseTurn: release.turn,
    releaseVia: release.via,
  };
}

function classifyBottleneck({ learnerDagAssessment, dagProfile, result, diagnosis }) {
  if (!learnerDagAssessment || learnerDagAssessment.status !== 'available') {
    return { bucket: 'unavailable', missing: [] };
  }
  const finalTurn = learnerDagAssessment.finalTurn ?? result.turnsPlayed ?? diagnosis.turnsPlayed ?? null;
  const missing = (learnerDagAssessment.missingOnBestPath || []).map((premiseId) =>
    classifyMissingPremise({ premiseId, dagProfile, finalTurn }),
  );
  if (learnerDagAssessment.finalSecretEntailed) {
    if (learnerDagAssessment.assertedSecret) return { bucket: 'grounded_asserted_secret', missing };
    if (learnerDagAssessment.assertedMirror) return { bucket: 'mirror_assertion_after_entailment', missing };
    return { bucket: 'assertion_gap', missing };
  }
  if (
    learnerDagAssessment.assertedSecret ||
    learnerDagAssessment.assertedMirror ||
    learnerDagAssessment.unsupportedAssertionCount > 0
  ) {
    return { bucket: 'premature_or_unsupported_assertion', missing };
  }
  if (missing.some((row) => row.bucket === 'not_released_before_end' || row.bucket === 'unscheduled')) {
    return { bucket: 'release_or_pacing_gap', missing };
  }
  if (missing.length) return { bucket: 'learner_integration_gap', missing };
  return { bucket: 'inference_gap', missing };
}

function loadWorldForRun({ result, diagnosis }) {
  const worldPath = diagnosis.worldPath || result.worldPath || null;
  if (!worldPath) {
    throw new Error('missing worldPath in diagnosis/result');
  }
  return loadWorld(resolveRepoPath(worldPath));
}

function rowForLabel(runDir, label) {
  const dir = path.join(runDir, label);
  const result = readJson(path.join(dir, 'result.json'));
  const diagnosis = readJson(path.join(dir, 'diagnosis.json'));
  const live = readJsonOptional(path.join(dir, 'live.json')) || {};
  const world = loadWorldForRun({ result, diagnosis });
  const assessment = buildDerivationAssessment({ label, live, result, diagnosis, world });
  const learner = assessment.learnerDagAssessment;
  const bottleneck = classifyBottleneck({
    learnerDagAssessment: learner,
    dagProfile: assessment.dagProfile,
    result,
    diagnosis,
  });
  return {
    label,
    sourceDir: path.relative(ROOT, dir),
    worldId: assessment.worldId,
    verdict: assessment.proofGate.verdict,
    proofGateStatus: assessment.proofGate.status,
    turnsPlayed: assessment.proofGate.turnsPlayed,
    finalD: assessment.proofGate.finalD,
    learnerDagSource: learner?.source || null,
    bestPathId: learner?.bestPathId || null,
    bestPathCoverage: learner?.bestPathCoverage ?? null,
    completePathCount: learner?.completePathIds?.length ?? null,
    finalSecretEntailed: learner?.finalSecretEntailed ?? null,
    assertedSecret: learner?.assertedSecret ?? null,
    assertedMirror: learner?.assertedMirror ?? null,
    firstCompletePathTurn: learner?.firstCompletePathTurn ?? null,
    firstSecretEntailedTurn: learner?.firstSecretEntailedTurn ?? null,
    missingOnBestPath: learner?.missingOnBestPath || [],
    missingPremises: bottleneck.missing,
    unsupportedAssertionCount: learner?.unsupportedAssertionCount ?? null,
    voicedDerivedCount: learner?.voicedDerivedCount ?? null,
    hypothesisCount: learner?.hypothesisCount ?? null,
    bottleneck: bottleneck.bucket,
  };
}

function aggregateRows(rows, skipped) {
  const assessed = rows.length;
  const successful = rows.filter((row) => row.proofGateStatus === 'pass');
  const finalSecretEntailed = rows.filter((row) => row.finalSecretEntailed);
  const assertedSecret = rows.filter((row) => row.assertedSecret);
  const assertedMirror = rows.filter((row) => row.assertedMirror);
  const complete = rows.filter((row) => row.completePathCount > 0);
  const missingPremiseCounts = {};
  for (const row of rows) {
    for (const missing of row.missingPremises) {
      const current = missingPremiseCounts[missing.premiseId] || {
        premiseId: missing.premiseId,
        count: 0,
        buckets: {},
      };
      current.count += 1;
      current.buckets[missing.bucket] = (current.buckets[missing.bucket] || 0) + 1;
      missingPremiseCounts[missing.premiseId] = current;
    }
  }
  return {
    assessed,
    skipped: skipped.length,
    meanBestPathCoverage: avg(rows.map((row) => row.bestPathCoverage)),
    proofGatePassRate: pct(successful.length, assessed),
    completePathRate: pct(complete.length, assessed),
    finalSecretEntailedRate: pct(finalSecretEntailed.length, assessed),
    assertedSecretRate: pct(assertedSecret.length, assessed),
    assertedMirrorRate: pct(assertedMirror.length, assessed),
    bottleneckCounts: countBy(rows.map((row) => row.bottleneck)),
    verdictCounts: countBy(rows.map((row) => row.verdict)),
    learnerDagSourceCounts: countBy(rows.map((row) => row.learnerDagSource)),
    missingPremiseCounts: Object.values(missingPremiseCounts).sort((a, b) => b.count - a.count),
  };
}

function worldRows(rows) {
  const grouped = new Map();
  for (const row of rows) {
    const bucket = grouped.get(row.worldId) || [];
    bucket.push(row);
    grouped.set(row.worldId, bucket);
  }
  return [...grouped.entries()]
    .map(([worldId, group]) => ({
      worldId,
      count: group.length,
      meanBestPathCoverage: avg(group.map((row) => row.bestPathCoverage)),
      finalSecretEntailedRate: pct(group.filter((row) => row.finalSecretEntailed).length, group.length),
      assertedSecretRate: pct(group.filter((row) => row.assertedSecret).length, group.length),
      bottleneckCounts: countBy(group.map((row) => row.bottleneck)),
    }))
    .sort((a, b) => b.count - a.count || String(a.worldId).localeCompare(String(b.worldId)));
}

function formatPercent(value) {
  return value == null ? 'n/a' : `${Math.round(value * 100)}%`;
}

function formatCountMap(map) {
  return Object.entries(map || {})
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([key, value]) => `${key}: ${value}`)
    .join('; ');
}

export function renderReport(summary) {
  const lines = [
    '# Learner DAG Batch Diagnostic',
    '',
    `Run dir: \`${path.relative(ROOT, summary.runDir) || '.'}\``,
    `Generated: ${summary.generatedAt}`,
    '',
    '## Summary',
    '',
    `- Assessed runs: ${summary.aggregate.assessed}`,
    `- Skipped runs: ${summary.aggregate.skipped}`,
    `- Mean best authored-path coverage: ${formatPercent(summary.aggregate.meanBestPathCoverage)}`,
    `- Complete authored path rate: ${formatPercent(summary.aggregate.completePathRate)}`,
    `- Final secret entailed rate: ${formatPercent(summary.aggregate.finalSecretEntailedRate)}`,
    `- Asserted secret rate: ${formatPercent(summary.aggregate.assertedSecretRate)}`,
    `- Asserted mirror rate: ${formatPercent(summary.aggregate.assertedMirrorRate)}`,
    `- Proof gate pass rate: ${formatPercent(summary.aggregate.proofGatePassRate)}`,
    '',
    '## Bottlenecks',
    '',
    '| bucket | runs |',
    '| --- | ---: |',
  ];
  for (const [bucket, count] of Object.entries(summary.aggregate.bottleneckCounts).sort((a, b) => b[1] - a[1])) {
    lines.push(`| ${bucket} | ${count} |`);
  }
  lines.push(
    '',
    '## By World',
    '',
    '| world | runs | coverage | secret entailed | asserted secret | bottlenecks |',
    '| --- | ---: | ---: | ---: | ---: | --- |',
  );
  for (const row of summary.byWorld) {
    lines.push(
      `| ${row.worldId} | ${row.count} | ${formatPercent(row.meanBestPathCoverage)} | ${formatPercent(
        row.finalSecretEntailedRate,
      )} | ${formatPercent(row.assertedSecretRate)} | ${formatCountMap(row.bottleneckCounts)} |`,
    );
  }
  lines.push('', '## Missing Premises', '', '| premise | missing count | buckets |', '| --- | ---: | --- |');
  for (const row of summary.aggregate.missingPremiseCounts.slice(0, 20)) {
    lines.push(`| ${row.premiseId} | ${row.count} | ${formatCountMap(row.buckets)} |`);
  }
  if (!summary.aggregate.missingPremiseCounts.length) lines.push('| none | 0 |  |');
  lines.push(
    '',
    '## Runs',
    '',
    '| label | world | verdict | gate | coverage | secret entailed | asserted | bottleneck | missing best path |',
    '| --- | --- | --- | --- | ---: | --- | --- | --- | --- |',
  );
  for (const row of summary.rows) {
    const asserted = row.assertedSecret ? 'secret' : row.assertedMirror ? 'mirror' : 'none';
    lines.push(
      `| ${row.label} | ${row.worldId} | ${row.verdict || 'unknown'} | ${row.proofGateStatus} | ${formatPercent(
        row.bestPathCoverage,
      )} | ${row.finalSecretEntailed} | ${asserted} | ${row.bottleneck} | ${
        row.missingOnBestPath.length ? row.missingOnBestPath.join(', ') : 'none'
      } |`,
    );
  }
  if (summary.skipped.length) {
    lines.push('', '## Skipped', '', '| label | reason |', '| --- | --- |');
    for (const row of summary.skipped) lines.push(`| ${row.label} | ${row.reason} |`);
  }
  lines.push('');
  return lines.join('\n');
}

export function analyzeLearnerDagBatch({
  runDir = DEFAULT_RUN_DIR,
  outDir = DEFAULT_OUT_DIR,
  labels = [],
  limit = null,
} = {}) {
  const selectedLabels = (labels.length ? labels : listLabels(runDir)).slice(0, limit || undefined);
  const rows = [];
  const skipped = [];
  for (const label of selectedLabels) {
    try {
      rows.push(rowForLabel(runDir, label));
    } catch (error) {
      skipped.push({ label, reason: error.message });
    }
  }
  const summary = {
    schema: 'machinespirits.derivation.learner-dag-batch-diagnostic.v1',
    generatedAt: new Date().toISOString(),
    runDir,
    outDir,
    labels: selectedLabels,
    aggregate: aggregateRows(rows, skipped),
    byWorld: worldRows(rows),
    rows,
    skipped,
  };
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
  fs.writeFileSync(path.join(outDir, 'report.md'), renderReport(summary));
  return summary;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(usage());
    return;
  }
  const summary = analyzeLearnerDagBatch(opts);
  console.log(`Wrote learner DAG diagnostic for ${summary.aggregate.assessed} run(s) to ${summary.outDir}`);
  if (summary.aggregate.skipped) {
    console.log(`Skipped ${summary.aggregate.skipped} run(s); see report.md for reasons.`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
