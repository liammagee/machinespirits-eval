#!/usr/bin/env node
/**
 * Package counterfactual discursive replays as blind Phase-2 poetics samples and
 * optionally score them with the existing critic panel.
 *
 * The critic sees only sample/T*.txt. Replay provenance, original item ids, and
 * adversarial precheck results live in the held-out key and batch manifest.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import yaml from 'yaml';
import { adversarialCheckerFor } from './replay-discursive-transcript.js';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const DEFAULT_CRITICS = [
  'qwen/qwen3.7-max',
  'google/gemini-3.5-flash',
  'deepseek/deepseek-v4-pro',
  'anthropic/claude-sonnet-4.6',
  'codex',
];

function usage() {
  return `Usage:
  node scripts/run-discursive-replay-panel.js --replay-dir DIR [--force]
    [--out-dir DIR] [--run-id ID]
    [--critics codex,anthropic/claude-sonnet-4.6,...]
    [--include-status survivor[,revise_again|reject|unchecked]]
    [--allow-needs-revision] [--allow-non-adversarial-precheck]
    [--skip-score] [--mock] [--dry-run]

Default behavior requires an adversarial precheck and includes only survivors.
Use --allow-needs-revision for cases where the precheck passed but the local gate
kept a warning for local review.`;
}

export function parseArgs(argv = process.argv.slice(2)) {
  const args = {
    replayDir: null,
    outDir: null,
    runId: null,
    critics: DEFAULT_CRITICS,
    includeStatus: ['survivor'],
    requireAdversarialPrecheck: true,
    skipScore: false,
    mock: false,
    dryRun: false,
    force: false,
    scoreConcurrency: 1,
  };

  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t === '--help' || t === '-h') args.help = true;
    else if (t === '--replay-dir') args.replayDir = path.resolve(argv[++i]);
    else if (t === '--out-dir') args.outDir = path.resolve(argv[++i]);
    else if (t === '--run-id') args.runId = argv[++i];
    else if (t === '--critics') args.critics = splitCsv(argv[++i]);
    else if (t === '--include-status') args.includeStatus = splitCsv(argv[++i]);
    else if (t === '--allow-needs-revision') {
      args.includeStatus = [...new Set([...args.includeStatus, 'revise_again'])];
    } else if (t === '--allow-non-adversarial-precheck') args.requireAdversarialPrecheck = false;
    else if (t === '--skip-score') args.skipScore = true;
    else if (t === '--mock') args.mock = true;
    else if (t === '--dry-run') args.dryRun = true;
    else if (t === '--force') args.force = true;
    else if (t === '--score-concurrency') args.scoreConcurrency = Number(argv[++i]);
    else throw new Error(`unknown arg: ${t}\n\n${usage()}`);
  }

  if (args.help) return args;
  if (!args.replayDir) throw new Error(`--replay-dir is required\n\n${usage()}`);
  if (!fs.existsSync(path.join(args.replayDir, 'manifest.json'))) {
    throw new Error(`replay manifest not found: ${path.join(args.replayDir, 'manifest.json')}`);
  }
  if (!args.critics.length) throw new Error('--critics must name at least one critic');
  if (!Number.isInteger(args.scoreConcurrency) || args.scoreConcurrency < 1) {
    throw new Error('--score-concurrency must be a positive integer');
  }
  args.runId = args.runId || `discursive-replay-panel-${safeSlug(path.basename(args.replayDir))}`;
  args.outDir = args.outDir || path.join(ROOT, 'exports', 'discursive-replay-panels', args.runId);
  return args;
}

function splitCsv(value) {
  return String(value || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function safeSlug(value) {
  return String(value || 'replay')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 140);
}

function rel(p) {
  return path.relative(ROOT, path.resolve(p));
}

function sha256File(filePath) {
  return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeYaml(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, yaml.stringify(value), 'utf8');
}

function modelSlug(model) {
  return String(model)
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

export function isAdversarialPrecheck(record) {
  const generator = record?.generator?.backend;
  const checker = record?.checker?.backend;
  if (!generator || !checker) return false;
  try {
    return checker === adversarialCheckerFor(generator);
  } catch {
    return false;
  }
}

function gateWarnings(record) {
  const warnings = [];
  const status = record?.gate?.status || 'unknown';
  if (status !== 'survivor') {
    warnings.push({
      severity: 'warning',
      code: `local_gate_${status}`,
      message: `Replay local gate status is ${status}; panel scorer is blind to this warning.`,
    });
  }
  for (const warning of record?.gate?.warnings || []) {
    warnings.push({
      severity: 'warning',
      code: `local_gate_${warning.criterion || 'warning'}`,
      message: warning.recommendation || warning.evidence || 'Local gate warning.',
      evidence: warning.evidence || null,
    });
  }
  for (const failure of record?.gate?.failures || []) {
    warnings.push({
      severity: 'fail',
      code: `local_gate_${failure.criterion || 'failure'}`,
      message: failure.recommendation || failure.evidence || 'Local gate failure.',
      evidence: failure.evidence || null,
    });
  }
  return warnings;
}

function selectRecords(manifest, args) {
  const include = new Set(args.includeStatus);
  const selected = [];
  const skipped = [];
  for (const record of manifest.records || []) {
    const status = record?.gate?.status || (record?.dryRun ? 'dry_run' : 'unknown');
    const adversarial = isAdversarialPrecheck(record);
    if (!include.has(status)) {
      skipped.push({ item: record?.item?.id || record?.item, status, reason: 'status_not_included' });
      continue;
    }
    if (args.requireAdversarialPrecheck && !adversarial) {
      skipped.push({ item: record?.item?.id || record?.item, status, reason: 'non_adversarial_precheck' });
      continue;
    }
    selected.push({ record, status, adversarial });
  }
  if (!selected.length) {
    throw new Error(
      `no replay records selected (included statuses: ${args.includeStatus.join(', ')}; ` +
        `require adversarial precheck: ${args.requireAdversarialPrecheck}). ` +
        `Skipped: ${JSON.stringify(skipped.slice(0, 5))}`,
    );
  }
  return { selected, skipped };
}

export function buildReplayPanelPackage(rawArgs) {
  const args =
    typeof rawArgs?.replayDir === 'string'
      ? { ...parseArgs(['--replay-dir', rawArgs.replayDir]), ...rawArgs }
      : parseArgs(rawArgs);
  const replayManifestPath = path.join(args.replayDir, 'manifest.json');
  const replayManifest = readJson(replayManifestPath);
  const { selected, skipped } = selectRecords(replayManifest, args);
  const outDir = path.resolve(args.outDir);
  const sampleDir = path.join(outDir, 'replay-r01', 'sample');
  const transcriptsDir = path.join(outDir, 'replay-r01', 'transcripts');
  const keyPath = path.join(outDir, 'replay-r01', 'key.yaml');
  const scoreDir = path.join(outDir, 'scores');

  if (args.dryRun) {
    return {
      dryRun: true,
      outDir,
      runId: args.runId,
      selected: selected.map(({ record, status, adversarial }) => ({
        item: record?.item?.id || record?.item,
        status,
        adversarial,
      })),
      skipped,
      scoreCommands: scoreCommands(args, { sampleDir, keyPath, scoreDir }),
    };
  }

  if (fs.existsSync(outDir)) {
    if (!args.force) throw new Error(`output exists: ${outDir} (pass --force to overwrite)`);
    fs.rmSync(outDir, { recursive: true, force: true });
  }
  fs.mkdirSync(sampleDir, { recursive: true });
  fs.mkdirSync(transcriptsDir, { recursive: true });
  fs.mkdirSync(scoreDir, { recursive: true });

  const keyItems = {};
  const packaged = [];
  selected.forEach(({ record, status, adversarial }, index) => {
    const tid = `T${String(index + 1).padStart(2, '0')}`;
    const publicPath = record.paths?.revisedPublic;
    if (!publicPath || !fs.existsSync(publicPath)) {
      throw new Error(`missing revised public transcript for ${record?.item?.id || tid}: ${publicPath}`);
    }
    const samplePath = path.join(sampleDir, `${tid}.txt`);
    const fullPath = path.join(transcriptsDir, `${tid}.full.md`);
    const publicText = fs.readFileSync(publicPath, 'utf8').trim();
    fs.writeFileSync(samplePath, `${publicText}\n`, 'utf8');
    fs.writeFileSync(
      fullPath,
      [
        '# Discursive Replay Panel Transcript',
        '',
        '## Public Performance',
        '',
        '```text',
        publicText,
        '```',
        '',
        '## Held-Out Replay Provenance',
        '',
        JSON.stringify(
          {
            source_item_id: record.item?.id || null,
            source_run_id: record.item?.run_id || null,
            replay_item_manifest: record.paths?.manifest || null,
            revision_json: record.paths?.revisionJson || null,
            gate_json: record.paths?.gateJson || null,
            check_json: record.paths?.checkJson || null,
          },
          null,
          2,
        ),
        '',
      ].join('\n'),
      'utf8',
    );

    const warnings = gateWarnings(record);
    keyItems[tid] = {
      source_item_id: record.item?.id || null,
      source_run_id: record.item?.run_id || null,
      source_full_transcript_path: record.item?.full_transcript_path || null,
      drama_id: record.item?.id || tid,
      discipline: 'discursive_replay',
      condition: 'counterfactual_discursive_replay',
      intended_lean: 'adaptive_discursive_revision',
      quality_status: warnings.some((w) => w.severity !== 'info') ? 'review_before_scoring' : 'ok',
      quality_warnings: warnings,
      replay: {
        bundle_manifest_path: rel(replayManifestPath),
        item_manifest_path: record.paths?.manifest ? rel(record.paths.manifest) : null,
        revised_public_path: rel(publicPath),
        revision_json_path: record.paths?.revisionJson ? rel(record.paths.revisionJson) : null,
        gate_json_path: record.paths?.gateJson ? rel(record.paths.gateJson) : null,
        check_json_path: record.paths?.checkJson ? rel(record.paths.checkJson) : null,
        gate_status: status,
        generator_backend: record.generator?.backend || null,
        checker_backend: record.checker?.backend || null,
        checker_policy: record.checkerPolicy || replayManifest.checker_policy || null,
        adversarial_precheck: {
          required: args.requireAdversarialPrecheck,
          passed: adversarial,
          expected_checker: record.generator?.backend ? adversarialCheckerFor(record.generator.backend) : null,
        },
      },
    };
    packaged.push({
      tid,
      sourceItemId: record.item?.id || null,
      gateStatus: status,
      adversarialPrecheck: adversarial,
      samplePath: rel(samplePath),
      fullTranscriptPath: rel(fullPath),
      sampleSha256: sha256File(samplePath),
    });
  });

  const key = {
    schema_version: 'discursive-replay-panel-key-v1',
    run_id: args.runId,
    source_replay_bundle: rel(replayManifestPath),
    preliminary_check_policy: {
      linked: true,
      require_adversarial_precheck: args.requireAdversarialPrecheck,
      adversarial_rule: 'codex->claude, claude->codex, agy->codex',
      visible_to_blind_critic: false,
    },
    items: keyItems,
  };
  writeYaml(keyPath, key);

  const batchPlan = {
    batchId: args.runId,
    rootDir: outDir,
    generator: replayManifest.generator || 'discursive-replay',
    checker: replayManifest.checker || null,
    checkerPolicy: replayManifest.checker_policy || null,
    critics: args.mock ? ['mock'] : args.critics,
    sourceReplayDir: rel(args.replayDir),
    preliminaryCheckPolicy: key.preliminary_check_policy,
    units: [
      {
        id: 'replay-r01',
        kind: 'target',
        repeat: 'r01',
        outDir: sampleDir,
        transcriptsDir,
        keyPath,
        sourceReplayDir: rel(args.replayDir),
      },
    ],
    selected: packaged,
    skipped,
  };
  writeJson(path.join(outDir, 'batch-plan.json'), batchPlan);

  const packageManifest = {
    schema_version: 'discursive-replay-panel-package-v1',
    created_at: new Date().toISOString(),
    run_id: args.runId,
    out_dir: rel(outDir),
    sample_dir: rel(sampleDir),
    key_path: rel(keyPath),
    batch_plan_path: rel(path.join(outDir, 'batch-plan.json')),
    source_replay_bundle: rel(replayManifestPath),
    selected: packaged,
    skipped,
    critics: args.mock ? ['mock'] : args.critics,
    preliminary_check_policy: key.preliminary_check_policy,
  };
  writeJson(path.join(outDir, 'manifest.json'), packageManifest);

  return {
    dryRun: false,
    outDir,
    runId: args.runId,
    sampleDir,
    keyPath,
    scoreDir,
    manifest: packageManifest,
    scoreCommands: scoreCommands(args, { sampleDir, keyPath, scoreDir }),
  };
}

function scoreCommands(args, { sampleDir, keyPath, scoreDir }) {
  const critics = args.mock ? ['mock'] : args.critics;
  return critics.map((critic) => {
    const outPath = path.join(scoreDir, `replay-r01-${modelSlug(critic)}.json`);
    const cmd = [
      'node',
      'scripts/score-poetics-phase2.js',
      '--sample-dir',
      sampleDir,
      '--key',
      keyPath,
      '--out',
      outPath,
      '--concurrency',
      String(args.scoreConcurrency),
      '--allow-quality-warnings',
    ];
    if (args.mock || critic === 'mock') cmd.push('--mock');
    else cmd.push('--model', critic);
    return { critic, outPath, cmd };
  });
}

function runScores(commands, { dryRun = false } = {}) {
  const results = [];
  for (const job of commands) {
    if (dryRun) {
      results.push({ critic: job.critic, outPath: job.outPath, status: 'dry_run', cmd: job.cmd });
      continue;
    }
    const res = spawnSync(job.cmd[0], job.cmd.slice(1), { cwd: ROOT, stdio: 'inherit', encoding: 'utf8' });
    results.push({ critic: job.critic, outPath: job.outPath, status: res.status === 0 ? 'ok' : 'failed' });
    if (res.status !== 0) throw new Error(`score job failed for ${job.critic} (exit ${res.status})`);
  }
  return results;
}

async function main() {
  const args = parseArgs();
  if (args.help) {
    console.log(usage());
    return;
  }
  const packaged = buildReplayPanelPackage(args);
  const scoreResults = args.skipScore ? [] : runScores(packaged.scoreCommands, { dryRun: args.dryRun });
  console.log(
    JSON.stringify(
      {
        outDir: packaged.outDir,
        runId: packaged.runId,
        selected: packaged.manifest?.selected?.length || packaged.selected?.length || 0,
        skipped: packaged.manifest?.skipped?.length || packaged.skipped?.length || 0,
        scoreResults,
      },
      null,
      2,
    ),
  );
}

if (path.resolve(process.argv[1] || '') === __filename) {
  main().catch((err) => {
    console.error(err?.stack || String(err));
    process.exit(1);
  });
}
