#!/usr/bin/env node
/**
 * A18.10 contrastive blind panel over A18.9 policy-transfer pairs.
 *
 * Critics see anonymous A/B continuations for the same held-out sibling plus the
 * candidate learned policy. They do not see which arm had policy memory.
 */

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  callModel,
  parseJsonResponse,
  runWithConcurrency,
  withScorerRetry,
} from './score-poetics-calibration.js';
import { voteThresholdPasses } from './run-discursive-replay-loop.js';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const DEFAULT_CHAIN_DIR = path.join(ROOT, 'exports', 'recursive-tutor-learning', 'a18.9-under-determined-local');
const DEFAULT_CRITICS = [
  'qwen/qwen3.7-max',
  'google/gemini-3.5-flash',
  'deepseek/deepseek-v4-pro',
  'anthropic/claude-sonnet-4.6',
  'codex',
];

function usage() {
  return `Usage:
  node scripts/run-recursive-tutor-policy-contrast-panel.js
    [--chain-dir exports/recursive-tutor-learning/a18.9-under-determined-local]
    [--out-dir exports/recursive-tutor-learning/a18.9-under-determined-local/a18.10-contrastive-panel]
    [--run-id a18-10-selector-contrast-panel]
    [--family selector_rail_priority]
    [--critics qwen/qwen3.7-max,google/gemini-3.5-flash,...]
    [--critic-concurrency N|all] [--score-concurrency N]
    [--panel-threshold majority] [--min-critics N]
    [--mock] [--skip-score] [--dry-run] [--force]

Packages only clean A18.9 S0/S1 pairs: S1 survivor, S0 non-survivor, local
policy-memory advantage, and policy_distinct contrast verdict.`;
}

function defaultArgs() {
  return {
    chainDir: DEFAULT_CHAIN_DIR,
    outDir: null,
    runId: null,
    familyId: 'selector_rail_priority',
    critics: DEFAULT_CRITICS,
    criticConcurrency: 'all',
    scoreConcurrency: 1,
    panelThreshold: 'majority',
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
    else if (token === '--family') args.familyId = argv[++i];
    else if (token === '--critics') args.critics = splitCsv(argv[++i]);
    else if (token === '--critic-concurrency') {
      const value = argv[++i];
      args.criticConcurrency = value === 'all' ? 'all' : Number(value);
    } else if (token === '--score-concurrency') args.scoreConcurrency = Number(argv[++i]);
    else if (token === '--panel-threshold') args.panelThreshold = argv[++i];
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
  if (!fs.existsSync(args.chainDir)) throw new Error(`chain dir not found: ${args.chainDir}`);
  if (!args.critics.length) throw new Error('--critics must name at least one critic');
  if (!Number.isInteger(args.scoreConcurrency) || args.scoreConcurrency < 1) {
    throw new Error('--score-concurrency must be a positive integer');
  }
  const criticCount = args.mock ? 1 : args.critics.length;
  if (
    args.criticConcurrency !== 'all' &&
    (!Number.isInteger(args.criticConcurrency) || args.criticConcurrency < 1)
  ) {
    throw new Error('--critic-concurrency must be a positive integer or "all"');
  }
  if (args.minCritics != null && (!Number.isInteger(args.minCritics) || args.minCritics < 1)) {
    throw new Error('--min-critics must be a positive integer');
  }
  args.criticConcurrency =
    args.criticConcurrency === 'all' ? criticCount : Math.min(args.criticConcurrency, criticCount);
  args.runId = args.runId || 'a18-10-selector-contrast-panel';
  args.outDir = path.resolve(args.outDir || path.join(args.chainDir, 'a18.10-contrastive-panel'));
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
    .toLowerCase()
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

function sha(value) {
  return createHash('sha256').update(String(value)).digest('hex');
}

function sideForPolicyMemory(siblingId) {
  const firstByte = parseInt(sha(siblingId).slice(0, 2), 16);
  return firstByte % 2 === 0 ? 'A' : 'B';
}

function otherSide(side) {
  return side === 'A' ? 'B' : 'A';
}

function reportPaths(chainDir) {
  const paths = [];
  for (const entry of fs.readdirSync(chainDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const runDir = path.join(chainDir, entry.name);
    const reports = fs
      .readdirSync(runDir, { withFileTypes: true })
      .filter((reportEntry) => reportEntry.isFile())
      .map((reportEntry) => reportEntry.name)
      .filter((name) => isPolicyAblationReportName(name));
    for (const reportName of reports) paths.push(path.join(runDir, reportName));
  }
  return paths.sort();
}

function isPolicyAblationReportName(name) {
  return (
    /^a18\.[0-9]+.*underdetermined-transfer-family.*-report\.json$/.test(name) ||
    /^a18\.[0-9]+.*fresh-family-frozen-protocol.*-report\.json$/.test(name)
  );
}

function policyCorrectnessOverlay(chainDir) {
  const overlayPath = path.join(chainDir, 'a18.13-policy-correctness-report.json');
  if (!fs.existsSync(overlayPath)) return new Map();
  const report = readJson(overlayPath);
  const rows = new Map();
  for (const row of report.rows || []) rows.set(row.source_report, row);
  return rows;
}

function applyPolicyCorrectnessOverlay(report, reportPath, overlay) {
  const row = overlay.get(rel(reportPath));
  if (!row) return report;
  return {
    ...report,
    effective_local_verdict: row.effective_local_verdict,
    policy_correctness_gate: row.policy_correctness_gate,
    policy_correctness_overlay: {
      source_report: row.source_report,
      policy_correctness_verdict: row.policy_correctness_verdict,
      panel_candidate: row.panel_candidate,
    },
  };
}

function isCleanPair(report, familyId) {
  if (report.family_id !== familyId) return false;
  if (report.policy_contrast_gate?.verdict !== 'policy_distinct') return false;
  const correctnessGate = report.policy_correctness_gate;
  if (correctnessGate?.enabled) {
    return (
      report.effective_local_verdict === 'policy_memory_local_advantage' &&
      report.local_arms?.S1_policy_memory?.status === 'survivor' &&
      correctnessGate.S1_policy_memory?.correct === true &&
      correctnessGate.S0_no_policy?.correct !== true
    );
  }
  return (
    report.local_verdict === 'policy_memory_local_advantage' &&
    report.local_arms?.S1_policy_memory?.status === 'survivor' &&
    report.local_arms?.S0_no_policy?.status !== 'survivor'
  );
}

function pairFromReport(reportPath, familyId, index, overlay = new Map()) {
  const report = applyPolicyCorrectnessOverlay(readJson(reportPath), reportPath, overlay);
  if (!isCleanPair(report, familyId)) return null;
  const policyMemoryPath = resolveRepoPath(report.policy_contrast_gate?.policy_memory_path);
  const policyMemory = policyMemoryPath && fs.existsSync(policyMemoryPath) ? readJson(policyMemoryPath) : null;
  const s1Side = sideForPolicyMemory(report.sibling_id);
  const s0Side = otherSide(s1Side);
  const s0Path = resolveRepoPath(report.local_arms.S0_no_policy.revised_public_path);
  const s1Path = resolveRepoPath(report.local_arms.S1_policy_memory.revised_public_path);
  for (const filePath of [s0Path, s1Path]) {
    if (!filePath || !fs.existsSync(filePath)) throw new Error(`missing revised public transcript: ${filePath}`);
  }
  const sides = {
    [s0Side]: {
      arm: 'S0_no_policy',
      local_status: report.local_arms.S0_no_policy.status,
      revised_public_path: rel(s0Path),
      public_text: fs.readFileSync(s0Path, 'utf8').trim(),
    },
    [s1Side]: {
      arm: 'S1_policy_memory',
      local_status: report.local_arms.S1_policy_memory.status,
      revised_public_path: rel(s1Path),
      public_text: fs.readFileSync(s1Path, 'utf8').trim(),
    },
  };
  return {
    pair_id: `P${String(index + 1).padStart(2, '0')}`,
    family_id: report.family_id,
    sibling_id: report.sibling_id,
    source_report_path: rel(reportPath),
    local_verdict: report.local_verdict,
    policy_contrast_verdict: report.policy_contrast_gate?.verdict || null,
    policy_distinctiveness: report.policy_contrast_gate?.distinctiveness ?? null,
    policy_memory_path: policyMemoryPath ? rel(policyMemoryPath) : null,
    policy_brief: candidatePolicyBrief(policyMemory, report),
    s1_side: s1Side,
    s0_side: s0Side,
    sides,
  };
}

export function cleanPairsFromChain({ chainDir = DEFAULT_CHAIN_DIR, familyId = 'selector_rail_priority' } = {}) {
  const resolvedChainDir = path.resolve(chainDir);
  const overlay = policyCorrectnessOverlay(resolvedChainDir);
  const pairs = reportPaths(resolvedChainDir)
    .map((reportPath, index) => pairFromReport(reportPath, familyId, index, overlay))
    .filter(Boolean);
  if (!pairs.length) throw new Error(`no clean A18.9 contrast pairs found for family ${familyId} in ${chainDir}`);
  return pairs;
}

function cleanLine(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function candidatePolicyBrief(policyMemory = null, report = null) {
  const selectedRepair =
    policyMemory?.transfer_design?.policy_selected_repair ||
    report?.policy_contrast_gate?.policy_signature?.strategy_name ||
    'selected_policy';
  const selectedRepairRecord = (policyMemory?.plausible_repairs || []).find(
    (repair) => repair?.repair_id === selectedRepair,
  );
  const lines = ['Candidate learned policy under test:', `Selected repair: ${selectedRepair}.`];
  if (selectedRepairRecord?.public_rationale) {
    lines.push(`Public rationale: ${cleanLine(selectedRepairRecord.public_rationale)}`);
  }
  if (selectedRepairRecord?.why_plausible_from_public_stage) {
    lines.push(
      `Why it is not trivial from the public stage: ${cleanLine(selectedRepairRecord.why_plausible_from_public_stage)}`,
    );
  }
  if (policyMemory?.transfer_design?.transfer_condition) {
    lines.push(`Transfer condition: ${cleanLine(policyMemory.transfer_design.transfer_condition)}`);
  }
  if (policyMemory?.preferred_move) {
    lines.push(`Preferred tutor move: ${cleanLine(policyMemory.preferred_move)}`);
  }
  if (policyMemory?.material_constraint) {
    lines.push(`Material constraint: ${cleanLine(policyMemory.material_constraint)}`);
  }
  if (policyMemory?.uptake_test) {
    lines.push(`Learner uptake test: ${cleanLine(policyMemory.uptake_test)}`);
  }
  lines.push(
    '',
    'A policy-transfer-like continuation should show the tutor taking stock of the failed comparison route, introducing this selected repair as the governing public test, and making the learner use that repair rather than a different plausible public repair.',
  );
  return lines.join('\n');
}

function renderPairSample(pair) {
  return [
    `# A18.10 Anonymous Contrast Pair ${pair.pair_id}`,
    '',
    pair.policy_brief,
    '',
    'Transcript A:',
    '```text',
    pair.sides.A.public_text,
    '```',
    '',
    'Transcript B:',
    '```text',
    pair.sides.B.public_text,
    '```',
    '',
    'Arm provenance is intentionally hidden. Score only the public contrast above.',
  ].join('\n');
}

export function buildContrastPanelPackage(rawArgs) {
  const args =
    typeof rawArgs?.chainDir === 'string' || rawArgs?.chainDir
      ? finalizeArgs({ ...defaultArgs(), ...rawArgs })
      : parseArgs(rawArgs);
  const pairs = cleanPairsFromChain({ chainDir: args.chainDir, familyId: args.familyId });
  const sampleDir = path.join(args.outDir, 'pairs');
  const scoreDir = path.join(args.outDir, 'scores');
  if (fs.existsSync(args.outDir)) {
    if (!args.force && !args.dryRun) throw new Error(`output exists: ${args.outDir} (pass --force to overwrite)`);
    if (!args.dryRun) fs.rmSync(args.outDir, { recursive: true, force: true });
  }
  if (!args.dryRun) {
    fs.mkdirSync(sampleDir, { recursive: true });
    fs.mkdirSync(scoreDir, { recursive: true });
  }

  const keyPairs = {};
  const publicPairs = [];
  for (const pair of pairs) {
    const samplePath = path.join(sampleDir, `${pair.pair_id}.txt`);
    if (!args.dryRun) fs.writeFileSync(samplePath, `${renderPairSample(pair)}\n`, 'utf8');
    publicPairs.push({
      pair_id: pair.pair_id,
      family_id: pair.family_id,
      sibling_id: pair.sibling_id,
      sample_path: rel(samplePath),
      local_verdict: pair.local_verdict,
      policy_contrast_verdict: pair.policy_contrast_verdict,
      policy_distinctiveness: pair.policy_distinctiveness,
      policy_memory_path: pair.policy_memory_path,
      sides: {
        A: {
          local_status: pair.sides.A.local_status,
          revised_public_path: pair.sides.A.revised_public_path,
        },
        B: {
          local_status: pair.sides.B.local_status,
          revised_public_path: pair.sides.B.revised_public_path,
        },
      },
    });
    keyPairs[pair.pair_id] = {
      family_id: pair.family_id,
      sibling_id: pair.sibling_id,
      source_report_path: pair.source_report_path,
      policy_memory_path: pair.policy_memory_path,
      s1_side: pair.s1_side,
      s0_side: pair.s0_side,
      sides: {
        A: {
          arm: pair.sides.A.arm,
          local_status: pair.sides.A.local_status,
          revised_public_path: pair.sides.A.revised_public_path,
        },
        B: {
          arm: pair.sides.B.arm,
          local_status: pair.sides.B.local_status,
          revised_public_path: pair.sides.B.revised_public_path,
        },
      },
    };
  }

  const manifest = {
    kind: 'a18_10_policy_contrast_panel_package',
    created_at: new Date().toISOString(),
    run_id: args.runId,
    claim_boundary: 'simulated_teacher_as_learner_not_human_learning',
    chain_dir: rel(args.chainDir),
    out_dir: rel(args.outDir),
    sample_dir: rel(sampleDir),
    score_dir: rel(scoreDir),
    family_id: args.familyId,
    critics: args.mock ? ['mock'] : args.critics,
    critic_concurrency: args.criticConcurrency,
    score_concurrency: args.scoreConcurrency,
    panel_threshold: args.panelThreshold,
    min_critics: args.minCritics,
    blind_policy:
      'Critics see anonymous A/B continuations and the candidate learned policy, but not which side had policy memory.',
    pairs: publicPairs,
    key_path: rel(path.join(args.outDir, 'key.json')),
  };

  if (!args.dryRun) {
    writeJson(path.join(args.outDir, 'manifest.json'), manifest);
    writeJson(path.join(args.outDir, 'key.json'), {
      kind: 'a18_10_policy_contrast_hidden_key',
      visible_to_critic: false,
      pairs: keyPairs,
    });
  }
  return { outDir: args.outDir, sampleDir, scoreDir, pairs, manifest };
}

function normalizeSide(value) {
  const side = String(value || '').trim().toUpperCase();
  if (side === 'A' || side === 'B') return side;
  const lower = String(value || '').trim().toLowerCase();
  return ['both', 'neither', 'unclear', 'no_difference'].includes(lower) ? lower : 'unclear';
}

function normalizeOrigin(value) {
  const origin = String(value || '').trim().toLowerCase();
  if (
    [
      'policy_transfer_like',
      'ordinary_public_inference',
      'equivalent',
      'no_policy_use',
      's0_preferable',
      'unclear',
    ].includes(origin)
  ) {
    return origin;
  }
  return 'unclear';
}

function clampScore(value) {
  return Math.max(1, Math.min(5, Math.round(Number(value) || 1)));
}

function buildContrastPrompt(pair) {
  return `You are a blind contrastive critic. You see two anonymous public tutor-learner continuations, A and B, for the same kind of held-out task. You do NOT know which side, if either, had access to a prior learned tutor policy. Do not infer model identity or provenance. Score only the public text.

${pair.policy_brief}

Your task is stricter than asking which final answer is right. Decide whether one side textually shows policy-transfer-like use of the selected repair: the tutor publicly responds to the learner's comparison failure by changing route to the learned policy's repair rather than another plausible public repair. Penalize ordinary public-stage inference: if the side could just be following an obvious visible clue without showing a learned-policy-like strategic switch, call that out.

Return ONLY JSON:
{
  "selected_policy_side": "A|B|both|neither|unclear",
  "learner_resistance_addressed_side": "A|B|both|neither|unclear",
  "winner": "A|B|no_difference|both_fail|unclear",
  "differential_policy_use": <integer 1-5>,
  "origin_class": "policy_transfer_like|ordinary_public_inference|equivalent|no_policy_use|unclear",
  "ordinary_public_inference_risk": "low|medium|high",
  "evidence_A": "<short verbatim quote from A, or empty string>",
  "evidence_B": "<short verbatim quote from B, or empty string>",
  "justification": "<2-4 sentences>"
}

Pair ${pair.pair_id}

Transcript A:
\`\`\`text
${pair.sides.A.public_text}
\`\`\`

Transcript B:
\`\`\`text
${pair.sides.B.public_text}
\`\`\``;
}

function mockCriticResponse(pair) {
  return {
    selected_policy_side: pair.s1_side,
    learner_resistance_addressed_side: pair.s1_side,
    winner: pair.s1_side,
    differential_policy_use: 4,
    origin_class: 'policy_transfer_like',
    ordinary_public_inference_risk: 'low',
    evidence_A: '',
    evidence_B: '',
    justification: 'mock',
  };
}

export function deriveContrastVote(parsed, pairKey) {
  const selectedPolicySide = normalizeSide(parsed.selected_policy_side ?? parsed.selector_policy_side);
  const learnerResistanceAddressedSide = normalizeSide(parsed.learner_resistance_addressed_side);
  const winner = normalizeSide(parsed.winner);
  const originClass = normalizeOrigin(parsed.origin_class);
  const differentialPolicyUse = clampScore(parsed.differential_policy_use);
  const ordinaryRisk = String(parsed.ordinary_public_inference_risk || '').toLowerCase();
  const s1Side = pairKey.s1_side;
  const s0Side = pairKey.s0_side;
  const treatsAsEquivalent =
    ['both', 'neither', 'unclear', 'no_difference'].includes(winner) ||
    ['both', 'neither', 'unclear'].includes(selectedPolicySide) ||
    originClass === 'equivalent';
  const ordinaryPublicInference =
    originClass === 'ordinary_public_inference' ||
    ordinaryRisk === 'high';
  const resistanceAddressedByPolicySide =
    learnerResistanceAddressedSide === s1Side || learnerResistanceAddressedSide === 'both';
  const supportsPolicyMemoryTransfer =
    selectedPolicySide === s1Side &&
    resistanceAddressedByPolicySide &&
    winner === s1Side &&
    originClass === 'policy_transfer_like' &&
    differentialPolicyUse >= 4 &&
    !ordinaryPublicInference;
  return {
    selected_policy_side: selectedPolicySide,
    selector_policy_side: selectedPolicySide,
    learner_resistance_addressed_side: learnerResistanceAddressedSide,
    winner,
    origin_class: originClass,
    ordinary_public_inference_risk: ordinaryRisk || 'unclear',
    differential_policy_use: differentialPolicyUse,
    s1_side: s1Side,
    s0_side: s0Side,
    supports_policy_memory_transfer: supportsPolicyMemoryTransfer,
    treats_as_equivalent: treatsAsEquivalent,
    ordinary_public_inference: ordinaryPublicInference,
    s0_preferred: winner === s0Side || selectedPolicySide === s0Side,
  };
}

async function scorePairWithCritic(pair, critic, mock = false) {
  let parsed;
  let retryCount = 0;
  try {
    if (mock) {
      parsed = mockCriticResponse(pair);
    } else {
      ({ value: parsed, retryCount } = await withScorerRetry(async () =>
        parseJsonResponse(await callModel(buildContrastPrompt(pair), critic)),
      ));
    }
    const key = {
      s1_side: pair.s1_side,
      s0_side: pair.s0_side,
    };
    return {
      pair_id: pair.pair_id,
      family_id: pair.family_id,
      sibling_id: pair.sibling_id,
      critic,
      retry_count: retryCount,
      raw: parsed,
      ...deriveContrastVote(parsed, key),
    };
  } catch (error) {
    return {
      pair_id: pair.pair_id,
      family_id: pair.family_id,
      sibling_id: pair.sibling_id,
      critic,
      error: error.message,
      retry_count: error.retryCount ?? retryCount,
    };
  }
}

async function scoreCritic({ pairs, critic, scoreConcurrency, scoreDir, mock }) {
  const scored = await runWithConcurrency(
    pairs.map((pair) => () => scorePairWithCritic(pair, critic, mock)),
    scoreConcurrency,
  );
  const artifact = {
    kind: 'a18_10_policy_contrast_panel_scores',
    created_at: new Date().toISOString(),
    critic: mock ? 'mock' : critic,
    scored,
  };
  writeJson(path.join(scoreDir, `${safeSlug(mock ? 'mock' : critic)}.json`), artifact);
  return {
    critic: mock ? 'mock' : critic,
    status: 'ok',
    scored: scored.length,
    errors: scored.filter((row) => row.error).length,
  };
}

function scoreFiles(scoreDir) {
  if (!fs.existsSync(scoreDir)) return [];
  return fs
    .readdirSync(scoreDir)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => path.join(scoreDir, name));
}

export function summarizeContrastScores(outDir, options = {}) {
  const manifest = readJson(path.join(outDir, 'manifest.json'));
  const key = readJson(path.join(outDir, 'key.json'));
  const byPair = new Map();
  for (const pair of manifest.pairs || []) {
    const hidden = key.pairs[pair.pair_id];
    byPair.set(pair.pair_id, {
      pair_id: pair.pair_id,
      family_id: pair.family_id,
      sibling_id: pair.sibling_id,
      s1_side: hidden.s1_side,
      s0_side: hidden.s0_side,
      total_critics: 0,
      transfer_votes: 0,
      equivalent_votes: 0,
      ordinary_public_inference_votes: 0,
      s0_preferred_votes: 0,
      errors: [],
      critics: {},
    });
  }
  for (const filePath of scoreFiles(path.join(outDir, 'scores'))) {
    const artifact = readJson(filePath);
    const critic = artifact.critic || path.basename(filePath, '.json');
    for (const row of artifact.scored || []) {
      const pair = byPair.get(row.pair_id);
      if (!pair) continue;
      if (row.error) {
        pair.errors.push({ critic, error: row.error });
        continue;
      }
      const hidden = key.pairs[row.pair_id];
      const derived = deriveContrastVote(row.raw || row, hidden);
      pair.total_critics += 1;
      if (derived.supports_policy_memory_transfer) pair.transfer_votes += 1;
      if (derived.treats_as_equivalent) pair.equivalent_votes += 1;
      if (derived.ordinary_public_inference) pair.ordinary_public_inference_votes += 1;
      if (derived.s0_preferred) pair.s0_preferred_votes += 1;
      pair.critics[critic] = {
        selected_policy_side: derived.selected_policy_side,
        selector_policy_side: derived.selector_policy_side,
        learner_resistance_addressed_side: derived.learner_resistance_addressed_side,
        winner: derived.winner,
        origin_class: derived.origin_class,
        ordinary_public_inference_risk: derived.ordinary_public_inference_risk,
        differential_policy_use: derived.differential_policy_use,
        supports_policy_memory_transfer: derived.supports_policy_memory_transfer,
        treats_as_equivalent: derived.treats_as_equivalent,
        ordinary_public_inference: derived.ordinary_public_inference,
        s0_preferred: derived.s0_preferred,
        raw_supports_policy_memory_transfer: row.supports_policy_memory_transfer ?? null,
      };
    }
  }
  const expectedCritics = options.expectedCritics || manifest.critics?.length || 0;
  const pairs = [...byPair.values()].map((pair) => {
    const pass = voteThresholdPasses(
      { votes: pair.transfer_votes, totalCritics: pair.total_critics },
      options.panelThreshold || manifest.panel_threshold || 'majority',
      expectedCritics || pair.total_critics,
      options.minCritics ?? manifest.min_critics ?? null,
    );
    let status = pass.passes ? 'contrast_panel_pass' : 'contrast_panel_fail';
    if (!pass.passes && pair.equivalent_votes >= pass.requiredVotes) status = 'contrast_equivalence_fail';
    if (!pass.passes && pair.ordinary_public_inference_votes >= pass.requiredVotes) {
      status = 'contrast_ordinary_inference_fail';
    }
    if (!pass.passes && pair.s0_preferred_votes >= pass.requiredVotes) status = 'contrast_s0_preferred_fail';
    return {
      ...pair,
      expected_critics: expectedCritics,
      required_transfer_votes: pass.requiredVotes,
      minimum_coverage: pass.minimumCoverage,
      passes: pass.passes,
      status,
    };
  });
  const allPass = pairs.length > 0 && pairs.every((pair) => pair.passes);
  return {
    kind: 'a18_10_policy_contrast_panel_report',
    created_at: new Date().toISOString(),
    run_id: manifest.run_id,
    claim_boundary: manifest.claim_boundary,
    out_dir: manifest.out_dir,
    manifest_path: rel(path.join(outDir, 'manifest.json')),
    key_path: rel(path.join(outDir, 'key.json')),
    critics: manifest.critics || [],
    expected_critics: expectedCritics,
    panel_threshold: options.panelThreshold || manifest.panel_threshold || 'majority',
    min_critics: options.minCritics ?? manifest.min_critics ?? null,
    status: allPass ? 'contrast_panel_pass' : 'contrast_panel_not_yet_reliable',
    pairs,
    status_counts: pairs.reduce((acc, pair) => {
      acc[pair.status] = (acc[pair.status] || 0) + 1;
      return acc;
    }, {}),
    next_stage_rule:
      'If all packaged siblings pass the contrast panel, require a pre-registered cross-family replication before claiming reliable peripeteia-induced adaptation.',
  };
}

export async function runContrastPanel(rawArgs = process.argv.slice(2)) {
  const args = Array.isArray(rawArgs) ? parseArgs(rawArgs) : finalizeArgs({ ...defaultArgs(), ...rawArgs });
  if (args.help) return { help: usage() };
  const packaged = buildContrastPanelPackage(args);
  let scoreResults = [];
  let report = null;
  if (!args.skipScore && !args.dryRun) {
    scoreResults = await runWithConcurrency(
      (args.mock ? ['mock'] : args.critics).map((critic) => () =>
        scoreCritic({
          pairs: packaged.pairs,
          critic,
          scoreConcurrency: args.scoreConcurrency,
          scoreDir: packaged.scoreDir,
          mock: args.mock,
        }),
      ),
      args.criticConcurrency,
    );
  }
  if (!args.dryRun) {
    report = summarizeContrastScores(args.outDir, {
      panelThreshold: args.panelThreshold,
      minCritics: args.minCritics,
      expectedCritics: args.mock ? 1 : args.critics.length,
    });
    report.score_results = scoreResults;
    report.skipped_score = args.skipScore;
    writeJson(path.join(args.outDir, 'a18.10-contrastive-panel-report.json'), report);
  }
  return { outDir: args.outDir, packaged, report };
}

async function main() {
  try {
    const result = await runContrastPanel();
    if (result.help) {
      console.log(result.help);
      return;
    }
    console.log(
      JSON.stringify(
        {
          outDir: result.outDir,
          status: result.report?.status || 'dry_run',
          status_counts: result.report?.status_counts || {},
          pairs: (result.report?.pairs || result.packaged?.manifest?.pairs || []).map((pair) => ({
            pair_id: pair.pair_id,
            sibling_id: pair.sibling_id,
            status: pair.status || 'packaged',
            transfer_votes: pair.transfer_votes,
            total_critics: pair.total_critics,
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
