#!/usr/bin/env node
/**
 * A18.5 gated panel over recursive tutor-learning clean survivors.
 *
 * Reads the A18 local family gate, selects only clean_survivor revised held-out
 * artifacts, packages them with the existing blind replay-panel machinery, and
 * writes a family-level panel report.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildReplayPanelPackage } from './run-discursive-replay-panel.js';
import { summarizePanelScores } from './run-discursive-replay-loop.js';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const DEFAULT_CHAIN_DIR = path.join(ROOT, 'exports', 'recursive-tutor-learning', 'a18-pilot-local');

function usage() {
  return `Usage:
  node scripts/run-recursive-tutor-learning-panel.js
    [--chain-dir exports/recursive-tutor-learning/a18-pilot-local]
    [--out-dir exports/recursive-tutor-learning/a18-pilot-local/a18.5-panel]
    [--run-id a18-recursive-tutor-panel]
    [--critics codex,anthropic/claude-sonnet-4.6,...]
    [--critic-concurrency N|all] [--score-concurrency N]
    [--panel-threshold majority] [--origin-threshold majority] [--min-critics N]
    [--mock] [--skip-score] [--dry-run] [--force]

This spends only on local-gated clean survivors. The panel scorer sees only the
public transcript sample files; family and replay provenance stay held out.`;
}

function defaultArgs() {
  return {
    chainDir: DEFAULT_CHAIN_DIR,
    outDir: null,
    runId: null,
    critics: null,
    criticConcurrency: 'all',
    scoreConcurrency: 1,
    panelThreshold: 'majority',
    originThreshold: 'majority',
    minCritics: null,
    mock: false,
    skipScore: false,
    dryRun: false,
    force: false,
    help: false,
  };
}

export function parseArgs(argv = process.argv.slice(2)) {
  const args = defaultArgs();
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--help' || token === '-h') args.help = true;
    else if (token === '--chain-dir') args.chainDir = path.resolve(argv[++i]);
    else if (token === '--out-dir') args.outDir = path.resolve(argv[++i]);
    else if (token === '--run-id') args.runId = argv[++i];
    else if (token === '--critics') args.critics = splitCsv(argv[++i]);
    else if (token === '--critic-concurrency') {
      const value = argv[++i];
      args.criticConcurrency = value === 'all' ? 'all' : Number(value);
    } else if (token === '--score-concurrency') args.scoreConcurrency = Number(argv[++i]);
    else if (token === '--panel-threshold') args.panelThreshold = argv[++i];
    else if (token === '--origin-threshold') args.originThreshold = argv[++i];
    else if (token === '--min-critics') args.minCritics = Number(argv[++i]);
    else if (token === '--mock') args.mock = true;
    else if (token === '--skip-score') args.skipScore = true;
    else if (token === '--dry-run') args.dryRun = true;
    else if (token === '--force') args.force = true;
    else throw new Error(`unknown arg: ${token}\n\n${usage()}`);
  }
  return finalizeArgs(args);
}

function finalizeArgs(rawArgs) {
  const args = { ...defaultArgs(), ...rawArgs };
  if (args.help) return args;
  args.chainDir = path.resolve(args.chainDir);
  if (!fs.existsSync(path.join(args.chainDir, 'local-gate-report.json'))) {
    throw new Error(`local gate report not found: ${path.join(args.chainDir, 'local-gate-report.json')}`);
  }
  if (!Number.isInteger(args.scoreConcurrency) || args.scoreConcurrency < 1) {
    throw new Error('--score-concurrency must be a positive integer');
  }
  if (args.criticConcurrency !== 'all' && (!Number.isInteger(args.criticConcurrency) || args.criticConcurrency < 1)) {
    throw new Error('--critic-concurrency must be a positive integer or "all"');
  }
  if (args.minCritics != null && (!Number.isInteger(args.minCritics) || args.minCritics < 1)) {
    throw new Error('--min-critics must be a positive integer');
  }
  args.runId = args.runId || `a18-recursive-tutor-panel-${safeSlug(path.basename(args.chainDir))}`;
  args.outDir = path.resolve(args.outDir || path.join(args.chainDir, 'a18.5-panel'));
  return args;
}

function splitCsv(value) {
  return String(value || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function safeSlug(value) {
  return String(value || 'a18-panel')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 140);
}

function rel(filePath) {
  return path.relative(ROOT, path.resolve(filePath));
}

function resolveRepoPath(filePath) {
  if (!filePath) return null;
  return path.isAbsolute(filePath) ? filePath : path.join(ROOT, filePath);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function cleanSurvivorEntries(localGate) {
  const selected = [];
  const skipped = [];
  for (const family of localGate.families || []) {
    if (family.status !== 'clean_survivor') {
      skipped.push({ family_id: family.family_id, status: family.status, reason: 'family_not_clean_survivor' });
      continue;
    }
    const heldouts = family.heldout || [];
    for (const heldout of heldouts) {
      if (heldout.baseline?.status !== 'survivor' && heldout.revised?.status === 'survivor') {
        selected.push({ family, heldout });
      } else {
        skipped.push({
          family_id: family.family_id,
          sibling_id: heldout.sibling_id,
          status: family.status,
          reason: 'heldout_not_baseline_fail_revised_survivor',
          baseline_status: heldout.baseline?.status || 'missing',
          revised_status: heldout.revised?.status || 'missing',
        });
      }
    }
  }
  if (!selected.length) throw new Error('no clean_survivor revised held-out artifacts selected for A18.5 panel');
  return { selected, skipped };
}

function recordForPanel({ family, heldout }) {
  const revisedManifestPath = resolveRepoPath(heldout.revised?.manifest_path);
  if (!revisedManifestPath || !fs.existsSync(revisedManifestPath)) {
    throw new Error(
      `missing revised manifest for ${family.family_id}/${heldout.sibling_id}: ${heldout.revised?.manifest_path}`,
    );
  }
  const manifest = readJson(revisedManifestPath);
  const record = cloneJson((manifest.records || [])[0]);
  if (!record) throw new Error(`revised manifest has no record: ${revisedManifestPath}`);
  record.item = {
    ...(record.item || {}),
    id: `${family.family_id}::${heldout.sibling_id}`,
    run_id: 'a18-recursive-tutor-learning',
  };
  record.a18 = {
    family_id: family.family_id,
    sibling_id: heldout.sibling_id,
    baseline_status: heldout.baseline?.status || 'missing',
    revised_status: heldout.revised?.status || 'missing',
    family_gate_status: family.status,
    revised_manifest_path: rel(revisedManifestPath),
  };
  return { record, revisedManifestPath };
}

function materializeReplayBundle({ localGate, outDir }) {
  const { selected, skipped } = cleanSurvivorEntries(localGate);
  const replayDir = path.join(outDir, 'clean-survivor-replay-bundle');
  fs.mkdirSync(replayDir, { recursive: true });
  const records = [];
  const selectedFamilies = [];
  for (const entry of selected) {
    const { record, revisedManifestPath } = recordForPanel(entry);
    records.push(record);
    selectedFamilies.push({
      family_id: entry.family.family_id,
      sibling_id: entry.heldout.sibling_id,
      source_item_id: record.item.id,
      baseline_status: entry.heldout.baseline?.status || 'missing',
      revised_status: entry.heldout.revised?.status || 'missing',
      revised_manifest_path: rel(revisedManifestPath),
      revised_public_path: record.paths?.revisedPublic ? rel(record.paths.revisedPublic) : null,
    });
  }
  const manifest = {
    kind: 'recursive_tutor_learning_clean_survivor_replay_bundle',
    created_at: new Date().toISOString(),
    claim_boundary: localGate.claim_boundary || 'simulated_teacher_as_learner_not_human_learning',
    source_local_gate_report: rel(path.join(localGate.chain_dir || outDir, 'local-gate-report.json')),
    generator: 'a18-recursive-tutor-learning',
    checker: 'local-gated-adversarial-precheck',
    checker_policy: 'adversarial',
    records,
    selected_families: selectedFamilies,
    skipped,
  };
  writeJson(path.join(replayDir, 'manifest.json'), manifest);
  return { replayDir, selectedFamilies, skipped };
}

function runScoreJob(job) {
  return new Promise((resolve) => {
    const child = spawn(job.cmd[0], job.cmd.slice(1), { cwd: ROOT, stdio: 'inherit' });
    child.on('error', (error) =>
      resolve({ critic: job.critic, outPath: job.outPath, status: 'failed', error: error.message }),
    );
    child.on('close', (code) =>
      resolve({ critic: job.critic, outPath: job.outPath, status: code === 0 ? 'ok' : 'failed', exitCode: code }),
    );
  });
}

async function runScoreCommands(commands, criticConcurrency = commands.length) {
  const workerCount = Math.min(
    Math.max(1, criticConcurrency === 'all' ? commands.length : criticConcurrency),
    commands.length || 1,
  );
  const results = new Array(commands.length);
  let next = 0;
  console.log(
    `Scoring ${commands.length} A18 panel critic${commands.length === 1 ? '' : 's'} with concurrency ${workerCount}...`,
  );
  const workers = Array.from({ length: workerCount }, async () => {
    while (next < commands.length) {
      const index = next++;
      results[index] = await runScoreJob(commands[index]);
    }
  });
  await Promise.all(workers);
  const failures = results.filter((result) => result?.status === 'failed');
  if (failures.length) {
    throw new Error(
      `score job failures: ${failures.map((failure) => `${failure.critic}:${failure.exitCode ?? failure.error}`).join(', ')}`,
    );
  }
  return results;
}

function summarizeFamilies({ panelSummary, selectedFamilies }) {
  if (!panelSummary) {
    return selectedFamilies.map((family) => ({ ...family, panel_status: 'unscored', passes: false }));
  }
  const bySource = new Map((panelSummary.items || []).map((item) => [item.sourceItemId, item]));
  return selectedFamilies.map((family) => {
    const item = bySource.get(family.source_item_id);
    return {
      ...family,
      panel_tid: item?.tid || null,
      panel_status: item?.status || 'missing_panel_score',
      passes: Boolean(item?.passes),
      total_critics: item?.totalCritics || 0,
      recognition_votes: item?.recognitionVotes || 0,
      required_recognition_votes: item?.requiredRecognitionVotes || null,
      peripeteia_origin_votes: item?.originVotes || 0,
      required_origin_votes: item?.requiredOriginVotes || null,
      origin_counts: item?.originCounts || {},
      critic_rows: item?.critics || {},
      errors: item?.errors || [],
    };
  });
}

function countBy(rows, keyFn) {
  return rows.reduce((acc, row) => {
    const key = keyFn(row);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

export async function runRecursiveTutorPanel(rawArgs = process.argv.slice(2)) {
  const args = Array.isArray(rawArgs) ? parseArgs(rawArgs) : finalizeArgs({ ...defaultArgs(), ...rawArgs });
  if (args.help) return { help: usage() };
  if (fs.existsSync(args.outDir)) {
    if (!args.force) throw new Error(`output exists: ${args.outDir} (pass --force to overwrite)`);
    fs.rmSync(args.outDir, { recursive: true, force: true });
  }
  fs.mkdirSync(args.outDir, { recursive: true });
  const localGatePath = path.join(args.chainDir, 'local-gate-report.json');
  const localGate = readJson(localGatePath);
  localGate.chain_dir = localGate.chain_dir || args.chainDir;

  const replayBundle = materializeReplayBundle({ localGate, outDir: args.outDir });
  const panelDir = path.join(args.outDir, 'panel');
  const packageArgs = {
    replayDir: replayBundle.replayDir,
    outDir: panelDir,
    runId: args.runId,
    mock: args.mock,
    force: true,
    requireAdversarialPrecheck: true,
    includeStatus: ['survivor'],
    criticConcurrency: args.criticConcurrency,
    scoreConcurrency: args.scoreConcurrency,
    dryRun: args.dryRun,
  };
  if (args.critics) packageArgs.critics = args.critics;
  const packaged = buildReplayPanelPackage(packageArgs);
  const scoreResults =
    args.skipScore || args.dryRun
      ? []
      : await runScoreCommands(packaged.scoreCommands, packaged.manifest.criticConcurrency || args.criticConcurrency);
  const panelSummary =
    args.skipScore || args.dryRun
      ? null
      : summarizePanelScores(panelDir, {
          panelThreshold: args.panelThreshold,
          originThreshold: args.originThreshold,
          minCritics: args.minCritics,
        });
  const families = summarizeFamilies({ panelSummary, selectedFamilies: replayBundle.selectedFamilies });
  const report = {
    kind: 'recursive_tutor_learning_panel_report',
    created_at: new Date().toISOString(),
    chain_dir: rel(args.chainDir),
    local_gate_report: rel(localGatePath),
    out_dir: rel(args.outDir),
    replay_bundle_dir: rel(replayBundle.replayDir),
    panel_dir: rel(panelDir),
    run_id: args.runId,
    mock: args.mock,
    skipped_score: args.skipScore,
    panel_threshold: args.panelThreshold,
    origin_threshold: args.originThreshold,
    min_critics: args.minCritics,
    critics: packaged.manifest?.critics || [],
    score_results: scoreResults,
    status_counts: countBy(families, (family) => family.panel_status),
    pass_counts: countBy(families, (family) => (family.passes ? 'panel_pass' : 'panel_fail')),
    families,
    skipped: replayBundle.skipped,
    next_stage_rule:
      'Treat A18.5 as family-level evidence only for families that pass recognition and peripeteia-origin gates; do not pool failures away.',
  };
  writeJson(path.join(args.outDir, 'a18.5-panel-report.json'), report);
  return { outDir: args.outDir, report, packaged };
}

async function main() {
  try {
    const result = await runRecursiveTutorPanel();
    if (result.help) {
      console.log(result.help);
      return;
    }
    console.log(
      JSON.stringify(
        {
          outDir: result.outDir,
          status_counts: result.report.status_counts,
          pass_counts: result.report.pass_counts,
          families: result.report.families.map((family) => ({
            family_id: family.family_id,
            sibling_id: family.sibling_id,
            panel_status: family.panel_status,
            recognition_votes: family.recognition_votes,
            peripeteia_origin_votes: family.peripeteia_origin_votes,
            total_critics: family.total_critics,
          })),
        },
        null,
        2,
      ),
    );
  } catch (error) {
    console.error(error?.stack || String(error));
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  await main();
}
