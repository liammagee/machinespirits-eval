#!/usr/bin/env node
/**
 * Bounded discursive replay optimization loop.
 *
 * One iteration is:
 *   replay rewrite -> adversarial/local check -> blind panel -> sidecar ingest -> refine failures
 *
 * The loop is intentionally capped by --max-iterations. It is a cheap iteration
 * harness for counterfactual replay artifacts, not an online tutor and not a
 * claim that the original transcript adapted in situ.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { runReplay } from './replay-discursive-transcript.js';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const DEFAULT_DB_PATH = process.env.EVAL_DB_PATH || path.join(ROOT, 'data', 'evaluations.db');
const DEFAULT_ITEM_CONCURRENCY = 2;
const DEFAULT_SCORE_CONCURRENCY = 1;

function usage() {
  return `Usage:
  node scripts/run-discursive-replay-loop.js
    (--item-id <id>[,<id>...] | --run-id <runId> [--limit N] | --transcript <path> [--key <path>])
    --max-iterations N
    [--generator codex|claude|agy|mock]
    [--checker adversarial|codex|claude|agy|mock|none]
    [--out-root DIR] [--run-label ID]
    [--item-concurrency N] [--critic-concurrency N|all] [--score-concurrency N]
    [--critics model,model,...]
    [--panel-threshold majority|all|N] [--origin-threshold majority|all|N] [--min-critics N]
    [--policy-memory path]
    [--skip-panel] [--form-only-panel] [--no-ingest] [--retry-rejects]
    [--mock] [--mock-panel] [--dry-run] [--force]

Defaults:
  --generator codex --checker adversarial --item-concurrency 2
  panel critics run concurrently through run-discursive-replay-panel.js.`;
}

function defaultArgs() {
  return {
    db: DEFAULT_DB_PATH,
    itemIds: [],
    runId: null,
    transcript: null,
    key: null,
    limit: 1,
    maxIterations: null,
    outRoot: null,
    runLabel: null,
    generator: 'codex',
    checker: 'adversarial',
    itemConcurrency: DEFAULT_ITEM_CONCURRENCY,
    criticConcurrency: 'all',
    scoreConcurrency: DEFAULT_SCORE_CONCURRENCY,
    critics: null,
    panelThreshold: 'majority',
    originThreshold: 'majority',
    originGate: true,
    minCritics: null,
    policyMemoryFiles: [],
    skipPanel: false,
    ingest: true,
    retryRejects: false,
    mockPanel: false,
    dryRun: false,
    force: false,
    timeoutMs: 360_000,
    codexEffort: process.env.CODEX_REASONING_EFFORT || 'xhigh',
    codexModel: process.env.CODEX_MODEL || null,
    claudeModel: process.env.CLAUDE_CODE_MODEL || null,
    claudeEffort: process.env.CLAUDE_CODE_EFFORT || null,
    agyBin: process.env.AGY_BIN || path.join(process.env.HOME || '', '.local/bin/agy'),
    agyModelLabel: process.env.GEMINI_MODEL || 'gemini-3.5-flash',
    publicMaxChars: 30_000,
    innerMaxChars: 18_000,
  };
}

export function parseArgs(argv = process.argv.slice(2)) {
  const args = defaultArgs();
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--help' || token === '-h') args.help = true;
    else if (token === '--db') args.db = path.resolve(argv[++i]);
    else if (token === '--item-id') args.itemIds.push(...splitCsv(argv[++i]));
    else if (token === '--run-id') args.runId = argv[++i];
    else if (token === '--transcript') args.transcript = path.resolve(argv[++i]);
    else if (token === '--key') args.key = path.resolve(argv[++i]);
    else if (token === '--limit') args.limit = positiveInt(argv[++i], '--limit');
    else if (token === '--max-iterations') args.maxIterations = positiveInt(argv[++i], '--max-iterations');
    else if (token === '--out-root') args.outRoot = path.resolve(argv[++i]);
    else if (token === '--run-label') args.runLabel = safeSlug(argv[++i]);
    else if (token === '--generator') args.generator = argv[++i];
    else if (token === '--checker') args.checker = argv[++i];
    else if (token === '--item-concurrency') args.itemConcurrency = positiveInt(argv[++i], '--item-concurrency');
    else if (token === '--critic-concurrency') args.criticConcurrency = parseConcurrency(argv[++i]);
    else if (token === '--score-concurrency') args.scoreConcurrency = positiveInt(argv[++i], '--score-concurrency');
    else if (token === '--critics') args.critics = splitCsv(argv[++i]);
    else if (token === '--panel-threshold') args.panelThreshold = parsePanelThreshold(argv[++i]);
    else if (token === '--origin-threshold') args.originThreshold = parsePanelThreshold(argv[++i]);
    else if (token === '--min-critics') args.minCritics = positiveInt(argv[++i], '--min-critics');
    else if (token === '--policy-memory') args.policyMemoryFiles.push(path.resolve(argv[++i]));
    else if (token === '--skip-panel') args.skipPanel = true;
    else if (token === '--form-only-panel') args.originGate = false;
    else if (token === '--no-ingest') args.ingest = false;
    else if (token === '--retry-rejects') args.retryRejects = true;
    else if (token === '--mock-panel') args.mockPanel = true;
    else if (token === '--mock') {
      args.generator = 'mock';
      args.checker = 'mock';
      args.mockPanel = true;
    } else if (token === '--dry-run') args.dryRun = true;
    else if (token === '--force') args.force = true;
    else if (token === '--timeout-ms') args.timeoutMs = positiveInt(argv[++i], '--timeout-ms');
    else if (token === '--codex-effort') args.codexEffort = argv[++i];
    else if (token === '--codex-model') args.codexModel = argv[++i];
    else if (token === '--claude-model') args.claudeModel = argv[++i];
    else if (token === '--claude-effort') args.claudeEffort = argv[++i];
    else if (token === '--agy-bin') args.agyBin = path.resolve(argv[++i]);
    else if (token === '--agy-model-label') args.agyModelLabel = argv[++i];
    else if (token === '--public-max-chars') args.publicMaxChars = positiveInt(argv[++i], '--public-max-chars');
    else if (token === '--inner-max-chars') args.innerMaxChars = positiveInt(argv[++i], '--inner-max-chars');
    else throw new Error(`unknown arg: ${token}\n\n${usage()}`);
  }
  return finalizeArgs(args);
}

function finalizeArgs(args) {
  if (args.help) return args;
  if (!args.maxIterations) throw new Error(`--max-iterations is required\n\n${usage()}`);
  if (!args.itemIds.length && !args.runId && !args.transcript) {
    throw new Error(`provide --item-id, --run-id, or --transcript\n\n${usage()}`);
  }
  if (args.itemIds.length && args.runId) throw new Error('use either --item-id or --run-id, not both');
  if ((args.itemIds.length || args.runId) && args.transcript) {
    throw new Error('use either DB item/run input or --transcript, not both');
  }
  if (args.critics && !args.critics.length) throw new Error('--critics must name at least one critic');
  for (const filePath of args.policyMemoryFiles || []) {
    if (!fs.existsSync(filePath)) throw new Error(`policy memory file not found: ${filePath}`);
  }
  args.runLabel = args.runLabel || defaultRunLabel(args);
  args.outRoot = args.outRoot || path.join(ROOT, 'exports', 'discursive-replay-loops', args.runLabel);
  return args;
}

function splitCsv(value) {
  return String(value || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function positiveInt(value, name) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) throw new Error(`${name} must be a positive integer`);
  return n;
}

function parseConcurrency(value) {
  if (value === 'all') return 'all';
  return positiveInt(value, '--critic-concurrency');
}

function parsePanelThreshold(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'majority' || raw === 'all') return raw;
  return positiveInt(raw, '--panel-threshold');
}

function timestampId() {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function safeSlug(value) {
  return String(value || 'discursive-replay-loop')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 140);
}

function defaultRunLabel(args) {
  const source = args.itemIds.length
    ? `items-${args.itemIds.length}`
    : args.runId
      ? args.runId
      : path.basename(args.transcript || 'transcript').replace(/\.[^.]+$/, '');
  return safeSlug(`discursive-replay-loop-${source}-${timestampId()}`);
}

function rel(filePath) {
  return path.relative(ROOT, path.resolve(filePath));
}

function commandString(cmd) {
  return cmd.map((part) => (/\s/.test(String(part)) ? JSON.stringify(part) : String(part))).join(' ');
}

function runCommand(cmd, { dryRun = false } = {}) {
  if (dryRun) {
    console.log(`  ${commandString(cmd)}`);
    return { status: 'dry_run', command: cmd };
  }
  const result = spawnSync(cmd[0], cmd.slice(1), {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env },
  });
  if (result.status !== 0) {
    throw new Error(`command failed (${result.status}): ${commandString(cmd)}`);
  }
  return { status: 'ok', command: cmd };
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function itemIdsFromGate(entries = []) {
  return entries.map((entry) => entry.item_id).filter(Boolean);
}

function replayInputFor(args, pendingItemIds) {
  if (args.transcript) {
    return {
      transcript: args.transcript,
      key: args.key,
      itemIds: [],
      runId: null,
      limit: 1,
    };
  }
  if (pendingItemIds?.length) {
    return {
      itemIds: pendingItemIds,
      runId: null,
      transcript: null,
      key: null,
      limit: pendingItemIds.length,
    };
  }
  return {
    itemIds: [],
    runId: args.runId,
    transcript: null,
    key: null,
    limit: args.limit,
  };
}

function buildReplayArgs(args, { outDir, pendingItemIds, feedbackByItem }) {
  return {
    ...replayInputFor(args, pendingItemIds),
    db: args.db,
    outDir,
    generator: args.generator,
    checker: args.checker,
    timeoutMs: args.timeoutMs,
    codexEffort: args.codexEffort,
    codexModel: args.codexModel,
    claudeModel: args.claudeModel,
    claudeEffort: args.claudeEffort,
    agyBin: args.agyBin,
    agyModelLabel: args.agyModelLabel,
    publicMaxChars: args.publicMaxChars,
    innerMaxChars: args.innerMaxChars,
    itemConcurrency: args.itemConcurrency,
    policyMemoryFiles: args.policyMemoryFiles || [],
    feedbackByItem,
    force: args.force,
    dryRun: args.dryRun,
  };
}

function buildPanelCommand(args, { replayDir, panelDir, panelRunId }) {
  const cmd = [
    process.execPath,
    'scripts/run-discursive-replay-panel.js',
    '--replay-dir',
    replayDir,
    '--out-dir',
    panelDir,
    '--run-id',
    panelRunId,
    '--force',
    '--critic-concurrency',
    String(args.criticConcurrency),
    '--score-concurrency',
    String(args.scoreConcurrency),
  ];
  if (args.critics) cmd.push('--critics', args.critics.join(','));
  if (args.mockPanel) cmd.push('--mock');
  if (args.dryRun) cmd.push('--dry-run');
  return cmd;
}

function buildIngestCommand(args, { panelDir, panelRunId }) {
  const cmd = [process.execPath, 'scripts/ingest-poetics-artifacts.js', '--root-dir', panelDir, '--run-id', panelRunId];
  if (args.db) cmd.push('--db', args.db);
  if (args.dryRun) cmd.push('--dry-run');
  return cmd;
}

export function voteThresholdPasses({ votes, totalCritics }, threshold, expectedCritics, minCritics = null) {
  const expected = Math.max(1, Number(expectedCritics) || Number(totalCritics) || 1);
  const required =
    threshold === 'all' ? expected : threshold === 'majority' ? Math.floor(expected / 2) + 1 : Number(threshold);
  if (!Number.isInteger(required) || required < 1) throw new Error(`invalid panel threshold: ${threshold}`);
  const minimumCoverage = minCritics || required;
  return {
    passes: totalCritics >= minimumCoverage && votes >= required,
    requiredVotes: required,
    minimumCoverage,
  };
}

export function recognitionPasses({ recognitionVotes, totalCritics }, threshold, expectedCritics, minCritics = null) {
  const pass = voteThresholdPasses(
    { votes: recognitionVotes, totalCritics },
    threshold,
    expectedCritics,
    minCritics,
  );
  return {
    passes: pass.passes,
    requiredRecognitionVotes: pass.requiredVotes,
    minimumCoverage: pass.minimumCoverage,
  };
}

export function originPasses({ originVotes, totalCritics }, threshold, expectedCritics, minCritics = null) {
  const pass = voteThresholdPasses({ votes: originVotes, totalCritics }, threshold, expectedCritics, minCritics);
  return {
    passes: pass.passes,
    requiredOriginVotes: pass.requiredVotes,
    minimumOriginCoverage: pass.minimumCoverage,
  };
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function modelSlugFromScorePath(filePath) {
  return path.basename(filePath, '.json').replace(/^replay-r01-/, '');
}

function recognitionOriginClass(row) {
  return row?.recognitionOrigin?.class || row?.metadata?.recognition_origin?.class || null;
}

export function summarizePanelScores(panelDir, options = {}) {
  const threshold = options.panelThreshold || options.threshold || 'majority';
  const manifestPath = path.join(panelDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) throw new Error(`panel manifest not found: ${manifestPath}`);
  const manifest = readJson(manifestPath);
  const expectedCritics = options.expectedCritics || manifest.critics?.length || 0;
  const byTid = new Map();
  for (const selected of manifest.selected || []) {
    byTid.set(selected.tid, {
      tid: selected.tid,
      sourceItemId: selected.sourceItemId,
      totalCritics: 0,
      recognitionVotes: 0,
      originVotes: 0,
      originCounts: {},
      critics: {},
      errors: [],
    });
  }

  const scoreDir = path.join(panelDir, 'scores');
  const scoreFiles = fs.existsSync(scoreDir)
    ? fs
        .readdirSync(scoreDir)
        .filter((name) => name.endsWith('.json'))
        .sort()
        .map((name) => path.join(scoreDir, name))
    : [];
  for (const scoreFile of scoreFiles) {
    const artifact = readJson(scoreFile);
    const critic = artifact.critic || modelSlugFromScorePath(scoreFile);
    for (const row of artifact.scored || []) {
      if (!byTid.has(row.id)) continue;
      const item = byTid.get(row.id);
      if (row.error) {
        item.errors.push({ critic, error: row.error });
        continue;
      }
      item.totalCritics += 1;
      if (row.formClass === 'recognition') item.recognitionVotes += 1;
      const origin = recognitionOriginClass(row) || 'none';
      item.originCounts[origin] = (item.originCounts[origin] || 0) + 1;
      if (origin === 'peripeteia_induced') item.originVotes += 1;
      item.critics[critic] = {
        formClass: row.formClass || null,
        recontextualization: row.recontextualization ?? null,
        statedInsight: row.statedInsight ?? null,
        actionalBreakthrough: row.actionalBreakthrough ?? null,
        tutorAdaptiveMechanism: row.tutorAdaptiveMechanism ?? row.tutorStrategicReversal ?? null,
        adaptiveMechanismQuality: row.adaptiveMechanismQuality ?? null,
        recognitionOrigin: origin,
      };
    }
  }

  const items = [...byTid.values()].map((item) => {
    const recognition = recognitionPasses(
      item,
      threshold,
      expectedCritics || item.totalCritics,
      options.minCritics ?? null,
    );
    const origin = options.originGate === false
      ? {
          passes: true,
          requiredOriginVotes: 0,
          minimumOriginCoverage: 0,
        }
      : originPasses(
          item,
          options.originThreshold || threshold,
          expectedCritics || item.totalCritics,
          options.minCritics ?? null,
        );
    const passes = recognition.passes && origin.passes;
    const status = !recognition.passes ? 'panel_recognition_fail' : passes ? 'panel_pass' : 'panel_origin_fail';
    return {
      ...item,
      expectedCritics,
      ...recognition,
      ...origin,
      recognitionPass: recognition.passes,
      originPass: origin.passes,
      passes,
      status,
    };
  });

  return {
    panelDir,
    manifestPath,
    scoreFiles,
    expectedCritics,
    threshold,
    originThreshold: options.originThreshold || threshold,
    originGate: options.originGate !== false,
    items,
    passed: items.filter((item) => item.passes),
    failed: items.filter((item) => !item.passes),
  };
}

function localFeedback(recordSummary) {
  const lines = [`Local gate kept this item in ${recordSummary.status || 'unknown'} status.`];
  for (const failure of recordSummary.failures || []) {
    lines.push(`- fail ${failure.criterion || 'criterion'}: ${failure.evidence || ''} ${failure.recommendation || ''}`.trim());
  }
  for (const warning of recordSummary.warnings || []) {
    lines.push(`- warning ${warning.criterion || 'criterion'}: ${warning.evidence || ''} ${warning.recommendation || ''}`.trim());
  }
  return lines.join('\n');
}

function panelFeedback(panelItem) {
  const forms = Object.entries(panelItem.critics || {})
    .map(([critic, row]) => {
      const origin = row.recognitionOrigin ? ` origin=${row.recognitionOrigin}` : '';
      return `${critic}: form=${row.formClass || 'missing'} recon=${row.recontextualization ?? 'na'} action=${row.actionalBreakthrough ?? 'na'} tutor=${row.tutorAdaptiveMechanism ?? 'na'}${origin}`;
    })
    .join('\n');
  return [
    `Blind panel failed strict threshold for this item: ${panelItem.recognitionVotes}/${panelItem.expectedCritics} recognition votes; required ${panelItem.requiredRecognitionVotes}; peripeteia-origin votes ${panelItem.originVotes || 0}/${panelItem.expectedCritics}; required ${panelItem.requiredOriginVotes ?? 'n/a'}; minimum coverage ${panelItem.minimumCoverage}.`,
    'Repair the next counterfactual rewrite so the public learner self-reframe is traceable to a tutor peripeteia-linked strategic move, not merely to organic transcript drift, while still avoiding held-out-state leakage.',
    forms ? `Critic form summary:\n${forms}` : 'No score rows were available.',
  ].join('\n');
}

function addFeedback(feedbackByItem, itemId, text) {
  if (!itemId || !text) return;
  feedbackByItem[itemId] = feedbackByItem[itemId] ? `${feedbackByItem[itemId]}\n\n${text}` : text;
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function writeList(filePath, values) {
  fs.writeFileSync(filePath, values.length ? `${values.join('\n')}\n` : '', 'utf8');
}

export async function runLoop(rawArgs) {
  const args = Array.isArray(rawArgs) || rawArgs == null ? parseArgs(rawArgs) : finalizeArgs({ ...defaultArgs(), ...rawArgs });
  if (args.help) return { help: usage() };
  if (fs.existsSync(args.outRoot)) {
    if (!args.force) throw new Error(`output exists: ${args.outRoot} (pass --force to overwrite)`);
    fs.rmSync(args.outRoot, { recursive: true, force: true });
  }
  fs.mkdirSync(args.outRoot, { recursive: true });

  let pendingItemIds = args.itemIds.length ? [...args.itemIds] : [];
  const feedbackByItem = {};
  const completed = new Map();
  const iterations = [];
  let stopReason = 'max_iterations';

  for (let iteration = 1; iteration <= args.maxIterations; iteration++) {
    const label = `i${String(iteration).padStart(2, '0')}`;
    const replayDir = path.join(args.outRoot, `${label}-replay`);
    const panelDir = path.join(args.outRoot, `${label}-panel`);
    const panelRunId = `${path.basename(args.outRoot)}-${label}-panel`;
    const replayArgs = buildReplayArgs(args, { outDir: replayDir, pendingItemIds, feedbackByItem });
    const replay = await runReplay(replayArgs);
    const gate = replay.manifest.local_gate?.summary || {};
    const localSurvivorIds = itemIdsFromGate(gate.survivors);
    const localRevisionIds = itemIdsFromGate(gate.needs_revision);
    const localRejectIds = itemIdsFromGate(gate.rejected);

    for (const entry of [...(gate.needs_revision || []), ...(args.retryRejects ? gate.rejected || [] : [])]) {
      addFeedback(feedbackByItem, entry.item_id, localFeedback(entry));
    }

    let panel = null;
    let panelCommand = null;
    let ingestCommand = null;
    let panelFailureIds = [];
    let panelPassIds = [];

    if (!args.skipPanel && localSurvivorIds.length) {
      panelCommand = buildPanelCommand(args, { replayDir, panelDir, panelRunId });
      runCommand(panelCommand, { dryRun: false });
      if (args.dryRun) {
        panel = { dryRun: true, failed: [], passed: [], items: [] };
      } else {
        panel = summarizePanelScores(panelDir, {
          panelThreshold: args.panelThreshold,
          originThreshold: args.originThreshold,
          originGate: args.originGate,
          minCritics: args.minCritics,
        });
        panelFailureIds = panel.failed.map((item) => item.sourceItemId).filter(Boolean);
        panelPassIds = panel.passed.map((item) => item.sourceItemId).filter(Boolean);
        for (const item of panel.failed) addFeedback(feedbackByItem, item.sourceItemId, panelFeedback(item));
      }
      if (args.ingest && !args.dryRun) {
        ingestCommand = buildIngestCommand(args, { panelDir, panelRunId });
        runCommand(ingestCommand, { dryRun: false });
      }
    } else if (args.skipPanel) {
      panelPassIds = [...localSurvivorIds];
    }

    for (const itemId of panelPassIds) {
      completed.set(itemId, { itemId, iteration, status: args.skipPanel ? 'local_survivor' : 'panel_pass' });
    }

    const nextPending = unique([
      ...localRevisionIds,
      ...(args.retryRejects ? localRejectIds : []),
      ...panelFailureIds,
    ]).filter((itemId) => !completed.has(itemId));

    const iterationSummary = {
      iteration,
      replayDir: rel(replayDir),
      panelDir: localSurvivorIds.length && !args.skipPanel ? rel(panelDir) : null,
      panelRunId: localSurvivorIds.length && !args.skipPanel ? panelRunId : null,
      localGateCounts: gate.counts || {},
      localSurvivors: localSurvivorIds,
      localNeedsRevision: localRevisionIds,
      localRejected: localRejectIds,
      panelThreshold: args.skipPanel ? null : args.panelThreshold,
      originThreshold: args.skipPanel || !args.originGate ? null : args.originThreshold,
      originGate: !args.skipPanel && args.originGate,
      panelPassed: panelPassIds,
      panelFailed: panelFailureIds,
      nextPending,
      commands: {
        panel: panelCommand ? commandString(panelCommand) : null,
        ingest: ingestCommand ? commandString(ingestCommand) : null,
      },
      panelSummary: panel && !panel.dryRun ? panel.items : null,
    };
    iterations.push(iterationSummary);
    writeJson(path.join(args.outRoot, `${label}-summary.json`), iterationSummary);

    if (!nextPending.length) {
      stopReason = 'no_pending_items';
      pendingItemIds = [];
      break;
    }
    pendingItemIds = nextPending;
  }

  const manifest = {
    schema_version: 'discursive-replay-loop-v1',
    created_at: new Date().toISOString(),
    claim_boundary: 'counterfactual_revision_not_online_adaptation',
    out_root: rel(args.outRoot),
    settings: {
      max_iterations: args.maxIterations,
      generator: args.generator,
      checker: args.checker,
      item_concurrency: args.itemConcurrency,
      skip_panel: args.skipPanel,
      critic_concurrency: args.criticConcurrency,
      score_concurrency: args.scoreConcurrency,
      critics: args.critics || 'panel_default',
      panel_threshold: args.panelThreshold,
      origin_threshold: args.originThreshold,
      origin_gate: args.originGate,
      min_critics: args.minCritics,
      policy_memory_files: args.policyMemoryFiles || [],
      ingest: args.ingest,
      retry_rejects: args.retryRejects,
      mock_panel: args.mockPanel,
    },
    input: {
      item_ids: args.itemIds,
      run_id: args.runId,
      transcript: args.transcript ? rel(args.transcript) : null,
      key: args.key ? rel(args.key) : null,
      limit: args.limit,
    },
    stop_reason: stopReason,
    iterations_run: iterations.length,
    completed: [...completed.values()],
    final_pending: pendingItemIds,
    iterations,
  };
  writeJson(path.join(args.outRoot, 'manifest.json'), manifest);
  writeList(path.join(args.outRoot, 'completed.txt'), [...completed.keys()]);
  writeList(path.join(args.outRoot, 'final-pending.txt'), pendingItemIds);
  return { outRoot: args.outRoot, manifest };
}

async function main() {
  const args = parseArgs();
  if (args.help) {
    console.log(usage());
    return;
  }
  const result = await runLoop(args);
  console.log(
    JSON.stringify(
      {
        outRoot: result.outRoot,
        iterationsRun: result.manifest.iterations_run,
        stopReason: result.manifest.stop_reason,
        completed: result.manifest.completed.length,
        finalPending: result.manifest.final_pending.length,
      },
      null,
      2,
    ),
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch((error) => {
    console.error(error?.stack || String(error));
    process.exit(1);
  });
}
