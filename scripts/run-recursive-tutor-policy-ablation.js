#!/usr/bin/env node
/**
 * A18.6/A18.7 policy-memory ablation.
 *
 * Tests whether the current A18 panel survivor depends on the learned policy
 * memory. S0 rewrites the same held-out sibling without policy memory; S1 is the
 * policy-memory arm. A18.6 compares against the existing S1 artifact; A18.7
 * generates S0 and S1 fresh under restricted held-out context.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { runReplay } from './replay-discursive-transcript.js';
import { buildReplayPanelPackage } from './run-discursive-replay-panel.js';
import { summarizePanelScores } from './run-discursive-replay-loop.js';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const DEFAULT_CHAIN_DIR = path.join(ROOT, 'exports', 'recursive-tutor-learning', 'a18-pilot-local');

function usage() {
  return `Usage:
  node scripts/run-recursive-tutor-policy-ablation.js
    [--chain-dir exports/recursive-tutor-learning/a18-pilot-local]
    [--family window_scope_claim] [--sibling window_holdout_mira_label]
    [--out-dir exports/recursive-tutor-learning/a18-pilot-local/a18.6-policy-ablation]
    [--run-id a18-policy-ablation-window]
    [--generator codex] [--checker claude] [--codex-effort medium]
    [--fresh-s1] [--inner-max-chars N] [--public-max-chars N]
    [--policy-memory-max-chars N]
    [--panel-policy always|headroom|never]
    [--critics qwen/qwen3.7-max,google/gemini-3.5-flash,...]
    [--critic-concurrency N|all] [--score-concurrency N]
    [--panel-threshold majority] [--origin-threshold majority] [--min-critics N]
    [--mock] [--skip-panel] [--dry-run] [--force]

S0 is a fresh held-out rewrite without --policy-memory. By default S1 is the
existing policy-memory held-out replay. Pass --fresh-s1 --inner-max-chars 0
--panel-policy headroom for A18.7: both arms are fresh, held-out inner metadata is
withheld, and panel spending happens only when S1 has local headroom over S0.`;
}

function defaultArgs() {
  return {
    chainDir: DEFAULT_CHAIN_DIR,
    familyId: 'window_scope_claim',
    siblingId: null,
    outDir: null,
    runId: null,
    generator: 'codex',
    checker: 'claude',
    codexEffort: 'medium',
    timeoutMs: 600_000,
    freshS1: false,
    innerMaxChars: 18_000,
    publicMaxChars: 30_000,
    policyMemoryMaxChars: 18_000,
    panelPolicy: 'always',
    critics: null,
    criticConcurrency: 'all',
    scoreConcurrency: 1,
    panelThreshold: 'majority',
    originThreshold: 'majority',
    minCritics: null,
    mock: false,
    skipPanel: false,
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
    else if (token === '--family') args.familyId = argv[++i];
    else if (token === '--sibling') args.siblingId = argv[++i];
    else if (token === '--out-dir') args.outDir = path.resolve(argv[++i]);
    else if (token === '--run-id') args.runId = argv[++i];
    else if (token === '--generator') args.generator = argv[++i];
    else if (token === '--checker') args.checker = argv[++i];
    else if (token === '--codex-effort') args.codexEffort = argv[++i];
    else if (token === '--timeout-ms') args.timeoutMs = Number(argv[++i]);
    else if (token === '--fresh-s1') args.freshS1 = true;
    else if (token === '--inner-max-chars') args.innerMaxChars = Number(argv[++i]);
    else if (token === '--public-max-chars') args.publicMaxChars = Number(argv[++i]);
    else if (token === '--policy-memory-max-chars') args.policyMemoryMaxChars = Number(argv[++i]);
    else if (token === '--panel-policy') args.panelPolicy = argv[++i];
    else if (token === '--critics') args.critics = splitCsv(argv[++i]);
    else if (token === '--critic-concurrency') {
      const value = argv[++i];
      args.criticConcurrency = value === 'all' ? 'all' : Number(value);
    } else if (token === '--score-concurrency') args.scoreConcurrency = Number(argv[++i]);
    else if (token === '--panel-threshold') args.panelThreshold = argv[++i];
    else if (token === '--origin-threshold') args.originThreshold = argv[++i];
    else if (token === '--min-critics') args.minCritics = Number(argv[++i]);
    else if (token === '--mock') args.mock = true;
    else if (token === '--skip-panel') args.skipPanel = true;
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
  if (!fs.existsSync(path.join(args.chainDir, 'attempt-chain-plan.json'))) {
    throw new Error(`attempt-chain plan not found: ${path.join(args.chainDir, 'attempt-chain-plan.json')}`);
  }
  if (!fs.existsSync(path.join(args.chainDir, 'local-gate-report.json'))) {
    throw new Error(`local gate report not found: ${path.join(args.chainDir, 'local-gate-report.json')}`);
  }
  if (!Number.isInteger(args.scoreConcurrency) || args.scoreConcurrency < 1) {
    throw new Error('--score-concurrency must be a positive integer');
  }
  if (
    args.criticConcurrency !== 'all' &&
    (!Number.isInteger(args.criticConcurrency) || args.criticConcurrency < 1)
  ) {
    throw new Error('--critic-concurrency must be a positive integer or "all"');
  }
  if (!Number.isFinite(args.timeoutMs) || args.timeoutMs < 1) throw new Error('--timeout-ms must be positive');
  if (!Number.isFinite(args.innerMaxChars) || args.innerMaxChars < 0) {
    throw new Error('--inner-max-chars must be >= 0');
  }
  if (!Number.isFinite(args.publicMaxChars) || args.publicMaxChars < 500) {
    throw new Error('--public-max-chars too small');
  }
  if (!Number.isFinite(args.policyMemoryMaxChars) || args.policyMemoryMaxChars < 0) {
    throw new Error('--policy-memory-max-chars must be >= 0');
  }
  if (!['always', 'headroom', 'never'].includes(args.panelPolicy)) {
    throw new Error('--panel-policy must be one of always|headroom|never');
  }
  if (args.minCritics != null && (!Number.isInteger(args.minCritics) || args.minCritics < 1)) {
    throw new Error('--min-critics must be a positive integer');
  }
  args.runId = args.runId || `a18-policy-ablation-${safeSlug(args.familyId)}`;
  args.outDir = path.resolve(args.outDir || path.join(args.chainDir, 'a18.6-policy-ablation'));
  if (args.mock) {
    args.generator = 'mock';
    args.checker = 'mock';
  }
  return args;
}

function splitCsv(value) {
  return String(value || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function safeSlug(value) {
  return String(value || 'item')
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

function scoreSnapshot(record) {
  const scores = {};
  const gateScores = record?.gate?.scores || {};
  const recursiveScores = record?.gate?.recursive_tutor_learning_gate?.scores || {};
  for (const [key, payload] of Object.entries({ ...gateScores, ...recursiveScores })) {
    scores[key] = payload?.value ?? payload?.raw ?? null;
  }
  return scores;
}

function findFamily(plan, familyId) {
  const family = (plan.families || []).find((entry) => entry.family_id === familyId);
  if (!family) throw new Error(`family not found in attempt plan: ${familyId}`);
  return family;
}

function selectSibling(family, siblingId = null) {
  if (siblingId) {
    const sibling = (family.heldout || []).find((entry) => entry.sibling_id === siblingId);
    if (!sibling) throw new Error(`sibling not found for ${family.family_id}: ${siblingId}`);
    return sibling;
  }
  const [first] = family.heldout || [];
  if (!first) throw new Error(`family has no held-out sibling: ${family.family_id}`);
  return first;
}

function localGateFamily(localGate, familyId) {
  return (localGate.families || []).find((entry) => entry.family_id === familyId) || null;
}

function panelFamily(panelReport, familyId) {
  return (panelReport?.families || []).find((entry) => entry.family_id === familyId) || null;
}

export function buildAblationPlan({ chainDir = DEFAULT_CHAIN_DIR, familyId = 'window_scope_claim', siblingId = null } = {}) {
  const plan = readJson(path.join(chainDir, 'attempt-chain-plan.json'));
  const localGate = readJson(path.join(chainDir, 'local-gate-report.json'));
  const priorPanelPath = path.join(chainDir, 'a18.5-panel', 'a18.5-panel-report.json');
  const priorPanel = fs.existsSync(priorPanelPath) ? readJson(priorPanelPath) : null;
  const family = findFamily(plan, familyId);
  const sibling = selectSibling(family, siblingId);
  const localFamily = localGateFamily(localGate, familyId);
  const priorPanelFamily = panelFamily(priorPanel, familyId);
  const s1ManifestPath = path.join(sibling.revised_replay_dir, 'manifest.json');
  if (!fs.existsSync(s1ManifestPath)) throw new Error(`S1 policy-memory replay missing: ${s1ManifestPath}`);
  return {
    family,
    sibling,
    localFamily,
    priorPanelFamily,
    paths: {
      transcript: family.heldout.find((entry) => entry.sibling_id === sibling.sibling_id)?.transcript || sibling.transcript,
      policyMemory: family.policy_revision_template,
      s1Manifest: s1ManifestPath,
      priorPanel: priorPanelPath,
    },
  };
}

function armRecord({ arm, record, familyId, siblingId }) {
  const out = cloneJson(record);
  out.item = {
    ...(out.item || {}),
    id: `${familyId}::${siblingId}::${arm}`,
    run_id: 'a18-policy-memory-ablation',
  };
  out.a18_ablation = {
    family_id: familyId,
    sibling_id: siblingId,
    arm,
    policy_memory: arm === 'S1_policy_memory',
  };
  return out;
}

function materializeAblationReplayBundle({ outDir, familyId, siblingId, s0Record, s1Record, design }) {
  const replayDir = path.join(outDir, 's0-s1-replay-bundle');
  fs.mkdirSync(replayDir, { recursive: true });
  const records = [
    armRecord({ arm: 'S0_no_policy', record: s0Record, familyId, siblingId }),
    armRecord({ arm: 'S1_policy_memory', record: s1Record, familyId, siblingId }),
  ];
  const manifest = {
    kind: 'recursive_tutor_policy_memory_ablation_replay_bundle',
    created_at: new Date().toISOString(),
    claim_boundary: 'simulated_teacher_as_learner_not_human_learning',
    design,
    generator: 'a18-policy-memory-ablation',
    checker: 'local-gated-adversarial-precheck',
    checker_policy: 'adversarial',
    arms: [
      { arm: 'S0_no_policy', description: 'fresh held-out rewrite without learned policy memory' },
      {
        arm: 'S1_policy_memory',
        description: design?.fresh_s1
          ? 'fresh held-out rewrite with attempt-1 learned policy memory'
          : 'existing held-out rewrite with attempt-1 learned policy memory',
      },
    ],
    records,
  };
  writeJson(path.join(replayDir, 'manifest.json'), manifest);
  return { replayDir, records };
}

function runScoreJob(job) {
  return new Promise((resolve) => {
    const child = spawn(job.cmd[0], job.cmd.slice(1), { cwd: ROOT, stdio: 'inherit' });
    child.on('error', (error) => resolve({ critic: job.critic, outPath: job.outPath, status: 'failed', error: error.message }));
    child.on('close', (code) => resolve({ critic: job.critic, outPath: job.outPath, status: code === 0 ? 'ok' : 'failed', exitCode: code }));
  });
}

async function runScoreCommands(commands, criticConcurrency = commands.length) {
  const workerCount = Math.min(
    Math.max(1, criticConcurrency === 'all' ? commands.length : criticConcurrency),
    commands.length || 1,
  );
  const results = new Array(commands.length);
  let next = 0;
  console.log(`Scoring ${commands.length} A18 policy-ablation critic${commands.length === 1 ? '' : 's'} with concurrency ${workerCount}...`);
  const workers = Array.from({ length: workerCount }, async () => {
    while (next < commands.length) {
      const index = next++;
      results[index] = await runScoreJob(commands[index]);
    }
  });
  await Promise.all(workers);
  const failures = results.filter((result) => result?.status === 'failed');
  if (failures.length) {
    throw new Error(`score job failures: ${failures.map((failure) => `${failure.critic}:${failure.exitCode ?? failure.error}`).join(', ')}`);
  }
  return results;
}

function summarizePanelArms(panelSummary) {
  if (!panelSummary) return {};
  const arms = {};
  for (const item of panelSummary.items || []) {
    const arm = String(item.sourceItemId || '').split('::').pop();
    arms[arm] = {
      panel_status: item.status,
      passes: item.passes,
      recognition_votes: item.recognitionVotes,
      required_recognition_votes: item.requiredRecognitionVotes,
      peripeteia_origin_votes: item.originVotes,
      required_origin_votes: item.requiredOriginVotes,
      total_critics: item.totalCritics,
      origin_counts: item.originCounts,
      critic_rows: item.critics,
      errors: item.errors,
    };
  }
  return arms;
}

function localVerdict(s0, s1) {
  const s0Passes = s0.status === 'survivor';
  const s1Passes = s1.status === 'survivor';
  if (s1Passes && !s0Passes) return 'policy_memory_local_advantage';
  if (s1Passes && s0Passes) return 'no_local_headroom';
  if (!s1Passes && s0Passes) return 'control_beats_policy_memory';
  return 'no_local_survivor';
}

function localHeadroomForPanel(verdict) {
  return verdict === 'policy_memory_local_advantage';
}

function panelVerdict(panelArms) {
  const s0 = panelArms.S0_no_policy;
  const s1 = panelArms.S1_policy_memory;
  if (!s0 || !s1) return 'not_panelled';
  if (s1.passes && !s0.passes) return 'policy_memory_panel_advantage';
  if (s1.passes && s0.passes) return 'no_panel_headroom';
  if (!s1.passes && s0.passes) return 'control_panel_advantage';
  return 'neither_arm_panel_passed';
}

export async function runPolicyAblation(rawArgs = process.argv.slice(2)) {
  const args = Array.isArray(rawArgs) ? parseArgs(rawArgs) : finalizeArgs({ ...defaultArgs(), ...rawArgs });
  if (args.help) return { help: usage() };
  if (fs.existsSync(args.outDir)) {
    if (!args.force) throw new Error(`output exists: ${args.outDir} (pass --force to overwrite)`);
    fs.rmSync(args.outDir, { recursive: true, force: true });
  }
  fs.mkdirSync(args.outDir, { recursive: true });

  const plan = buildAblationPlan({ chainDir: args.chainDir, familyId: args.familyId, siblingId: args.siblingId });
  const familyId = plan.family.family_id;
  const siblingId = plan.sibling.sibling_id;
  const designLabel = args.freshS1 && args.innerMaxChars === 0 ? 'a18.7_restricted_policy_ablation' : 'a18.6_policy_ablation';
  const baseReplayArgs = {
    transcript: resolveRepoPath(plan.paths.transcript),
    generator: args.generator,
    checker: args.checker,
    recursiveTutorGate: true,
    force: true,
    dryRun: args.dryRun,
    timeoutMs: args.timeoutMs,
    codexEffort: args.codexEffort,
    publicMaxChars: args.publicMaxChars,
    innerMaxChars: args.innerMaxChars,
    policyMemoryMaxChars: args.policyMemoryMaxChars,
    itemIds: [],
    runId: null,
    db: path.join(ROOT, 'data', 'evaluations.db'),
    feedbackByItem: {},
  };
  const s0OutDir = path.join(args.outDir, `${safeSlug(familyId)}__${safeSlug(siblingId)}__S0-no-policy-replay`);
  const replayArgs = {
    ...baseReplayArgs,
    outDir: s0OutDir,
    policyMemoryFiles: [],
  };
  const s0Replay = args.dryRun ? null : await runReplay(replayArgs);
  const s0Record = s0Replay?.manifest?.records?.[0] || null;
  if (!args.dryRun && !s0Record) throw new Error('S0 replay did not produce a record');
  let s1Record = null;
  if (args.freshS1) {
    const s1OutDir = path.join(args.outDir, `${safeSlug(familyId)}__${safeSlug(siblingId)}__S1-policy-memory-replay`);
    const s1Replay = args.dryRun
      ? null
      : await runReplay({
          ...baseReplayArgs,
          outDir: s1OutDir,
          policyMemoryFiles: [resolveRepoPath(plan.paths.policyMemory)],
        });
    s1Record = s1Replay?.manifest?.records?.[0] || null;
  } else {
    const s1Manifest = readJson(plan.paths.s1Manifest);
    s1Record = (s1Manifest.records || [])[0];
  }
  if (!args.dryRun && !s1Record) throw new Error(`S1 replay manifest has no record: ${plan.paths.s1Manifest}`);

  const design = {
    label: designLabel,
    fresh_s1: args.freshS1,
    inner_max_chars: args.innerMaxChars,
    public_max_chars: args.publicMaxChars,
    policy_memory_max_chars: args.policyMemoryMaxChars,
    panel_policy: args.panelPolicy,
    S0_no_policy: 'fresh held-out rewrite without attempt-1 learned policy memory',
    S1_policy_memory: args.freshS1
      ? 'fresh held-out rewrite with attempt-1 learned policy memory'
      : 'existing held-out rewrite with attempt-1 learned policy memory',
    decisive_read:
      'S1 passes while S0 fails supports policy-memory contribution; both passing means no headroom.',
  };

  let panelSummary = null;
  let scoreResults = [];
  let replayBundle = null;
  let packaged = null;
  if (!args.dryRun) {
    const provisionalLocalArms = {
      S0_no_policy: { status: s0Record.gate?.status || 'unknown' },
      S1_policy_memory: { status: s1Record.gate?.status || 'unknown' },
    };
    const provisionalLocalVerdict = localVerdict(provisionalLocalArms.S0_no_policy, provisionalLocalArms.S1_policy_memory);
    const shouldPanel =
      !args.skipPanel &&
      args.panelPolicy !== 'never' &&
      (args.panelPolicy === 'always' || localHeadroomForPanel(provisionalLocalVerdict));
    replayBundle = materializeAblationReplayBundle({ outDir: args.outDir, familyId, siblingId, s0Record, s1Record, design });
    if (shouldPanel) {
      const panelDir = path.join(args.outDir, 'panel');
      const packageArgs = {
        replayDir: replayBundle.replayDir,
        outDir: panelDir,
        runId: args.runId,
        mock: args.mock,
        force: true,
        requireAdversarialPrecheck: true,
        includeStatus: ['survivor', 'revise_again', 'reject'],
        criticConcurrency: args.criticConcurrency,
        scoreConcurrency: args.scoreConcurrency,
      };
      if (args.critics) packageArgs.critics = args.critics;
      packaged = buildReplayPanelPackage(packageArgs);
      scoreResults = await runScoreCommands(packaged.scoreCommands, packaged.manifest.criticConcurrency || args.criticConcurrency);
      panelSummary = summarizePanelScores(panelDir, {
        panelThreshold: args.panelThreshold,
        originThreshold: args.originThreshold,
        minCritics: args.minCritics,
      });
    }
  }

  const localArms = args.dryRun
    ? {}
    : {
        S0_no_policy: {
          status: s0Record.gate?.status || 'unknown',
          scores: scoreSnapshot(s0Record),
          manifest_path: rel(s0Record.paths?.manifest),
          revised_public_path: rel(s0Record.paths?.revisedPublic),
        },
        S1_policy_memory: {
          status: s1Record.gate?.status || 'unknown',
          scores: scoreSnapshot(s1Record),
          manifest_path: rel(s1Record.paths?.manifest),
          revised_public_path: rel(s1Record.paths?.revisedPublic),
        },
      };
  const panelArms = summarizePanelArms(panelSummary);
  const report = {
    kind: 'recursive_tutor_policy_memory_ablation_report',
    created_at: new Date().toISOString(),
    chain_dir: rel(args.chainDir),
    out_dir: rel(args.outDir),
    run_id: args.runId,
    family_id: familyId,
    sibling_id: siblingId,
    claim_boundary: 'simulated_teacher_as_learner_not_human_learning',
    design,
    prior_a18_5_panel: plan.priorPanelFamily || null,
    local_arms: localArms,
    local_verdict: args.dryRun ? 'dry_run' : localVerdict(localArms.S0_no_policy, localArms.S1_policy_memory),
    panel_arms: panelArms,
    panel_verdict: args.skipPanel || args.dryRun || !packaged ? 'not_panelled' : panelVerdict(panelArms),
    panel_skip_reason:
      args.skipPanel || args.dryRun || packaged
        ? null
        : args.panelPolicy === 'never'
          ? 'panel_policy_never'
          : args.panelPolicy === 'headroom'
            ? `no_local_headroom:${localVerdict(localArms.S0_no_policy, localArms.S1_policy_memory)}`
            : null,
    score_results: scoreResults,
    replay_bundle_dir: replayBundle ? rel(replayBundle.replayDir) : null,
    panel_dir: packaged ? rel(packaged.outDir) : null,
    held_back: {
      glyph_tail_owner: 'near-miss diagnostic: recognition survived but origin attribution failed in A18.5; repair target is public tutor stock-taking contrast.',
      peg_lane_modifier: 'held back: attempt-1 old-warrant misclassification was too implicit; do not panel until public touch-rule failure is explicit.',
    },
  };
  if (!args.dryRun) {
    const reportName = designLabel.startsWith('a18.7')
      ? 'a18.7-restricted-policy-ablation-report.json'
      : 'a18.6-policy-ablation-report.json';
    writeJson(path.join(args.outDir, reportName), report);
  }
  return { outDir: args.outDir, report };
}

async function main() {
  try {
    const result = await runPolicyAblation();
    if (result.help) {
      console.log(result.help);
      return;
    }
    console.log(
      JSON.stringify(
        {
          outDir: result.outDir,
          family_id: result.report.family_id,
          sibling_id: result.report.sibling_id,
          local_verdict: result.report.local_verdict,
          panel_verdict: result.report.panel_verdict,
          local_arms: Object.fromEntries(
            Object.entries(result.report.local_arms || {}).map(([arm, row]) => [arm, row.status]),
          ),
          panel_arms: Object.fromEntries(
            Object.entries(result.report.panel_arms || {}).map(([arm, row]) => [
              arm,
              {
                status: row.panel_status,
                recognition_votes: row.recognition_votes,
                peripeteia_origin_votes: row.peripeteia_origin_votes,
                total_critics: row.total_critics,
              },
            ]),
          ),
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
