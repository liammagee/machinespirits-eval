#!/usr/bin/env node
/**
 * Fast CLI loop for the A19 rhetoric / mini-drama branch.
 *
 * This script is deliberately offline by default. It creates deterministic
 * candidates, cheap gate reports, blinded packets, and optional human-coder
 * assignments that can be opened in the existing /adjudication web UI.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHumanAdjudicationAssignment } from './create-a19-human-adjudication-assignment.js';
import {
  DEFAULT_A18_A19_RHETORICAL_BATTERY,
  DEFAULT_MINI_DRAMA_CARDS,
  DEFAULT_MINI_DRAMA_CODEBOOK,
  DEFAULT_MINI_DRAMA_ONTOLOGY,
  buildMiniDramaPackets,
  generateMiniDramaRun,
  loadMiniDramaCards,
  loadMiniDramaCodebook,
  loadMiniDramaOntology,
  qaMiniDramaRun,
  repoRel,
  runMiniDramaBatteryScreen,
  summarizeMiniDramaBatteryScreen,
  summarizeMiniDramaRun,
  validateMiniDramaCodebook,
} from '../services/miniDramaMachines.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MEMORY_MODES = new Set(['full', 'device_only', 'policy_only', 'exemplar_only']);
const BASELINE_MODES = new Set(['neutral_shadow', 'diagnostic_lure']);
const S0_MODES = new Set(['rewrite', 'checker_only']);
const REWRITE_MODES = new Set(['full', 'bounded_continuation', 'role_separated_continuation']);

function usage() {
  return `Usage:
  node scripts/a19r-mini-drama.js generate [--out exports/a19r/runs/run.json] [--moves a,b] [--card-ids a,b] [--json]
  node scripts/a19r-mini-drama.js screen [--out exports/a19r/runs/battery.json] [--samples-per-card 2] [--seed text] [--json]
  node scripts/a19r-mini-drama.js packetize --run exports/a19r/runs/run.json [--out-dir exports/a19r/adjudication-packets/run] [--assignments] [--blind]
  node scripts/a19r-mini-drama.js model-screen --run exports/a19r/runs/battery.json [--candidate-ids a,b] [--out-dir exports/a19r/model-screens/run] [--generator codex] [--checker claude] [--rewrite-mode bounded_continuation|role_separated_continuation] [--codex-model gpt-5.5] [--codex-effort xhigh] [--claude-model claude-fable-5] [--claude-effort medium] [--memory-mode full|device_only|policy_only|exemplar_only] [--baseline-mode neutral_shadow|diagnostic_lure] [--s0-mode rewrite|checker_only] [--dry-run]
  node scripts/a19r-mini-drama.js codebook-validate [--json]
  node scripts/a19r-mini-drama.js qa --run exports/a19r/runs/run.json [--json]
  node scripts/a19r-mini-drama.js report --run exports/a19r/runs/run.json [--out exports/a19r/reports/run.json] [--json]

Shared options:
  --ontology config/rhetoric/mini-drama-ontology.v0.1.json
  --cards config/rhetoric/mini-drama-cards.v0.1.json
  --codebook config/rhetoric/mini-drama-codebook.v0.1.json`;
}

function splitCsv(value) {
  return String(value || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseArgs(argv = process.argv.slice(2)) {
  const command = argv[0] || 'help';
  const args = {
    command,
    ontology: DEFAULT_MINI_DRAMA_ONTOLOGY,
    cards: command === 'screen' ? DEFAULT_A18_A19_RHETORICAL_BATTERY : DEFAULT_MINI_DRAMA_CARDS,
    codebook: DEFAULT_MINI_DRAMA_CODEBOOK,
    run: null,
    out: null,
    outDir: null,
    assignmentDir: null,
    keyDir: null,
    moves: [],
    cardIds: [],
    candidateIds: [],
    seed: 'a19r-mini-drama-battery-v0.1',
    samplesPerCard: 2,
    generator: 'codex',
    checker: 'claude',
    codexModel: process.env.CODEX_MODEL || null,
    codexEffort: process.env.CODEX_REASONING_EFFORT || 'xhigh',
    claudeModel: process.env.CLAUDE_CODE_MODEL || null,
    claudeEffort: process.env.CLAUDE_CODE_EFFORT || null,
    rewriteMode: 'full',
    boundedMaxAddedLines: 6,
    memoryMode: 'full',
    baselineMode: 'neutral_shadow',
    s0Mode: 'rewrite',
    stepTimeoutMs: 900_000,
    assignments: false,
    blind: false,
    force: false,
    dryRun: false,
    json: false,
    help: command === 'help',
  };
  for (let i = 1; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--help' || token === '-h') args.help = true;
    else if (token === '--ontology') args.ontology = path.resolve(argv[++i]);
    else if (token === '--cards') args.cards = path.resolve(argv[++i]);
    else if (token === '--codebook') args.codebook = path.resolve(argv[++i]);
    else if (token === '--run') args.run = path.resolve(argv[++i]);
    else if (token === '--out') args.out = path.resolve(argv[++i]);
    else if (token === '--out-dir') args.outDir = path.resolve(argv[++i]);
    else if (token === '--assignment-dir') args.assignmentDir = path.resolve(argv[++i]);
    else if (token === '--key-dir') args.keyDir = path.resolve(argv[++i]);
    else if (token === '--moves') args.moves = splitCsv(argv[++i]);
    else if (token === '--card-ids') args.cardIds = splitCsv(argv[++i]);
    else if (token === '--candidate-ids') args.candidateIds = splitCsv(argv[++i]);
    else if (token === '--seed') args.seed = argv[++i];
    else if (token === '--samples-per-card') args.samplesPerCard = Number.parseInt(argv[++i], 10);
    else if (token === '--generator') args.generator = argv[++i];
    else if (token === '--checker') args.checker = argv[++i];
    else if (token === '--codex-model') args.codexModel = argv[++i];
    else if (token === '--codex-effort') args.codexEffort = argv[++i];
    else if (token === '--claude-model') args.claudeModel = argv[++i];
    else if (token === '--claude-effort') args.claudeEffort = argv[++i];
    else if (token === '--rewrite-mode') args.rewriteMode = argv[++i];
    else if (token === '--bounded-max-added-lines') args.boundedMaxAddedLines = Number.parseInt(argv[++i], 10);
    else if (token === '--memory-mode') args.memoryMode = argv[++i];
    else if (token === '--baseline-mode') args.baselineMode = argv[++i];
    else if (token === '--s0-mode') args.s0Mode = argv[++i];
    else if (token === '--step-timeout-ms') args.stepTimeoutMs = Number.parseInt(argv[++i], 10);
    else if (token === '--assignments') args.assignments = true;
    else if (token === '--blind') args.blind = true;
    else if (token === '--force') args.force = true;
    else if (token === '--dry-run') args.dryRun = true;
    else if (token === '--json') args.json = true;
    else throw new Error(`unknown arg: ${token}\n\n${usage()}`);
  }
  if (!Number.isInteger(args.samplesPerCard) || args.samplesPerCard < 1) {
    throw new Error('--samples-per-card must be a positive integer');
  }
  if (!REWRITE_MODES.has(args.rewriteMode)) {
    throw new Error(`--rewrite-mode must be one of ${[...REWRITE_MODES].join('|')}`);
  }
  if (!Number.isInteger(args.boundedMaxAddedLines) || args.boundedMaxAddedLines < 1) {
    throw new Error('--bounded-max-added-lines must be a positive integer');
  }
  if (!MEMORY_MODES.has(args.memoryMode)) {
    throw new Error(`--memory-mode must be one of ${[...MEMORY_MODES].join('|')}`);
  }
  if (!BASELINE_MODES.has(args.baselineMode)) {
    throw new Error(`--baseline-mode must be one of ${[...BASELINE_MODES].join('|')}`);
  }
  if (!S0_MODES.has(args.s0Mode)) {
    throw new Error(`--s0-mode must be one of ${[...S0_MODES].join('|')}`);
  }
  return args;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function defaultRunPath(run) {
  return path.join(ROOT, 'exports', 'a19r', 'runs', `${run.run_id}.json`);
}

function defaultPacketDir(run) {
  return path.join(ROOT, 'exports', 'a19r', 'adjudication-packets', run.run_id);
}

function defaultAssignmentDir(run) {
  return path.join(ROOT, 'exports', 'a19r', 'human-coder-assignments', run.run_id);
}

function defaultModelScreenDir(run) {
  return path.join(ROOT, 'exports', 'a19r', 'model-screens', run.run_id);
}

function renderObject(value, json) {
  if (json) return `${JSON.stringify(value, null, 2)}\n`;
  return null;
}

function loadContext(args) {
  return {
    ontology: loadMiniDramaOntology(args.ontology),
    cardPool: loadMiniDramaCards(args.cards),
    codebook: loadMiniDramaCodebook(args.codebook),
  };
}

function cmdGenerate(args) {
  const { ontology, cardPool } = loadContext(args);
  const run = generateMiniDramaRun({
    ontology,
    cardPool,
    moveIds: args.moves,
    cardIds: args.cardIds,
  });
  const out = args.out || defaultRunPath(run);
  writeJson(out, run);
  const summary = {
    run: repoRel(out),
    run_id: run.run_id,
    candidate_count: run.candidates.length,
    card_count: run.card_ids.length,
    move_count: run.move_ids.length,
    gate_status: qaMiniDramaRun(run).status,
  };
  if (args.json) process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
  else {
    process.stdout.write(`A19R mini-drama run: ${summary.run}\n`);
    process.stdout.write(`candidates: ${summary.candidate_count}; gates: ${summary.gate_status}\n`);
  }
}

function cmdScreen(args) {
  const { ontology, cardPool } = loadContext(args);
  const screen = runMiniDramaBatteryScreen({
    ontology,
    cardPool,
    moveIds: args.moves,
    cardIds: args.cardIds,
    samplesPerCard: args.samplesPerCard,
    seed: args.seed,
  });
  const report = summarizeMiniDramaBatteryScreen(screen);
  const out = args.out || defaultRunPath(screen);
  writeJson(out, screen);
  const summary = {
    run: repoRel(out),
    run_id: screen.run_id,
    card_count: screen.card_ids.length,
    candidate_count: screen.candidates.length,
    gate_status: report.gate_status,
    proxy_headroom_rate: report.proxy_headroom_rate,
    feasibility: report.feasibility,
  };
  if (args.json) process.stdout.write(JSON.stringify({ ...summary, report }, null, 2) + '\n');
  else {
    process.stdout.write(`A19R rhetorical battery screen: ${summary.run}\n`);
    process.stdout.write(
      `cards: ${summary.card_count}; candidates: ${summary.candidate_count}; gates: ${summary.gate_status}\n`,
    );
    process.stdout.write(
      `proxy headroom: ${report.proxy_headroom_count}/${summary.candidate_count} (${summary.proxy_headroom_rate}); feasibility: ${summary.feasibility}\n`,
    );
  }
}

function writeAssignment({ packetPath, packet, args, run, index }) {
  const assignmentDir = args.assignmentDir || defaultAssignmentDir(run);
  const keyDir = args.keyDir || assignmentDir;
  const base = `${packet.packet_id}.assignment.json`;
  const keyBase = `${packet.packet_id}.assignment-key.json`;
  const result = createHumanAdjudicationAssignment({
    packetPath,
    codebookPath: args.codebook,
    outPath: path.join(assignmentDir, base),
    keyOutPath: path.join(keyDir, keyBase),
    assignmentId: `a19r-human-${packet.packet_id}-${String(index + 1).padStart(3, '0')}`,
    randomizeArms: args.blind,
    seed: `${run.run_id}:${packet.packet_id}`,
  });
  writeJson(result.outPath, result.assignment);
  writeJson(result.keyOutPath, result.assignmentKey);
  return {
    assignment: repoRel(result.outPath),
    assignment_key: repoRel(result.keyOutPath),
  };
}

function safeSlug(value) {
  return String(value || 'item')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 140);
}

function selectedCandidates(run, candidateIds = []) {
  const candidates = run.candidates || [];
  if (!candidateIds.length) return candidates;
  const wanted = new Set(candidateIds);
  const selected = candidates.filter((candidate) => wanted.has(candidate.candidate_id));
  const missing = candidateIds.filter((id) => !selected.some((candidate) => candidate.candidate_id === id));
  if (missing.length) throw new Error(`unknown candidate id(s): ${missing.join(', ')}`);
  return selected;
}

function baselineControlForCandidate(candidate, baselineMode) {
  if (baselineMode === 'diagnostic_lure') return candidate.baseline_control || candidate.shadow_control;
  return candidate.shadow_control;
}

function renderReplayBaseTranscript(candidate, baselineMode) {
  const baseline = baselineControlForCandidate(candidate, baselineMode);
  return [
    `# A19R Rhetorical Replay Base: ${candidate.card_id}`,
    '',
    'CLAIM_BOUNDARY: simulated_teacher_as_learner_not_human_learning',
    `BASELINE_MODE: ${baselineMode}`,
    '',
    '## Public Performance',
    '```text',
    baseline?.transcript || '',
    '```',
    '',
  ].join('\n');
}

function basePolicyMemory(candidate, memoryMode) {
  return {
    schema_version: 'a19r-rhetorical-policy-memory-v0.1',
    claim_boundary: 'simulated_teacher_as_learner_not_human_learning',
    memory_mode: memoryMode,
    candidate_id: candidate.candidate_id,
    card_id: candidate.card_id,
    source_protocol: candidate.source_protocol || null,
    source_family: candidate.source_family || null,
    source_sibling: candidate.source_sibling || null,
    impasse_type: candidate.impasse_type,
    task_stage: candidate.task_stage,
    expected_baseline_failure: candidate.expected_baseline_failure || null,
    wrong_prediction_collision: candidate.wrong_prediction_collision || null,
    selected_rhetorical_device: candidate.move_id,
    selection_reason: candidate.selection?.reason || null,
    selected_policy: {
      trigger: `When this ${candidate.impasse_type} impasse appears, do not continue with the generic local-step scaffold if it leaves the learner's resistance unresolved.`,
      avoid_move: candidate.expected_baseline_failure || 'generic_continuation',
      preferred_public_move: candidate.mini_drama?.response || '',
      constraints: [
        'preserve the public task facts and learner voice',
        'do not reveal hidden target labels or answer keys',
        'make the old visible rule produce its named wrong public prediction before replacing it',
        'make the visible refutation and new relation inspectable in ordinary domain language',
        'show learner resistance teaching the tutor what teaching move is now required',
        'keep learner repair and tutor learning distinct',
        'when adding a final tutor stock-taking line, make it a forward-facing teaching-policy update licensed by learner uptake',
      ],
      wrong_prediction_collision_instruction: candidate.wrong_prediction_collision
        ? [
            `old rule: ${candidate.wrong_prediction_collision.old_public_rule}`,
            `old prediction: ${candidate.wrong_prediction_collision.old_rule_prediction}`,
            `visible refutation: ${candidate.wrong_prediction_collision.visible_refutation}`,
            `new relation required: ${candidate.wrong_prediction_collision.new_relation_required}`,
            `learner task: ${candidate.wrong_prediction_collision.learner_collision_task}`,
          ].join('\n')
        : null,
    },
    mini_drama_seed_transcript: candidate.mini_drama?.transcript || '',
    proxy_screen: {
      status: candidate.screen_status || null,
      proxy_delta: candidate.proxy_delta ?? null,
      proxy_score: candidate.proxy_score ?? null,
      shadow_proxy_score: candidate.shadow_proxy_score ?? null,
    },
  };
}

function rhetoricalPolicyMemory(candidate, memoryMode = 'full') {
  const base = basePolicyMemory(candidate, memoryMode);
  if (memoryMode === 'full') return base;
  if (memoryMode === 'device_only') {
    return {
      schema_version: base.schema_version,
      claim_boundary: base.claim_boundary,
      memory_mode: memoryMode,
      candidate_id: base.candidate_id,
      card_id: base.card_id,
      source_family: base.source_family,
      impasse_type: base.impasse_type,
      selected_rhetorical_device: base.selected_rhetorical_device,
      instruction:
        'Use the named rhetorical device as the teaching memory. Do not copy an exemplar; infer the public move from the device and visible learner resistance.',
      constraints: base.selected_policy.constraints,
    };
  }
  if (memoryMode === 'policy_only') {
    return {
      schema_version: base.schema_version,
      claim_boundary: base.claim_boundary,
      memory_mode: memoryMode,
      candidate_id: base.candidate_id,
      card_id: base.card_id,
      source_family: base.source_family,
      impasse_type: base.impasse_type,
      task_stage: base.task_stage,
      expected_baseline_failure: base.expected_baseline_failure,
      selected_policy: base.selected_policy,
      proxy_screen: base.proxy_screen,
    };
  }
  if (memoryMode === 'exemplar_only') {
    return {
      schema_version: base.schema_version,
      claim_boundary: base.claim_boundary,
      memory_mode: memoryMode,
      candidate_id: base.candidate_id,
      card_id: base.card_id,
      source_family: base.source_family,
      impasse_type: base.impasse_type,
      exemplar_instruction:
        'Use the exemplar transcript as a style-and-move memory. Do not treat it as an answer key; adapt only what is publicly licensed by the current transcript.',
      mini_drama_seed_transcript: base.mini_drama_seed_transcript,
      proxy_screen: base.proxy_screen,
    };
  }
  throw new Error(`unsupported memory mode: ${memoryMode}`);
}

function scoreMean(scoreReport = {}) {
  const values = Object.values(scoreReport)
    .map((entry) => Number(entry?.value))
    .filter((value) => Number.isFinite(value));
  if (!values.length) return null;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(4));
}

function readReplayRecord(outDir) {
  const manifestPath = path.join(outDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) return null;
  const manifest = readJson(manifestPath);
  const record = manifest.records?.[0] || null;
  if (!record) return null;
  return {
    status: record.gate?.status || null,
    gate: record.gate || null,
    revised_public_path: record.paths?.revisedPublic || null,
    manifest_path: record.paths?.manifest || null,
    generator: record.generator || null,
    checker: record.checker || null,
    score_mean: scoreMean(record.gate?.scores || {}),
    recursive_score_mean: scoreMean(record.gate?.recursive_tutor_learning_gate?.scores || {}),
    recommended_action: record.gate?.recommended_action || null,
  };
}

function localVerdict(s0, s1) {
  if (!s0 || !s1) return 'incomplete';
  if (s1.status === 'survivor' && s0.status !== 'survivor') return 'rhetorical_memory_local_advantage';
  if (s1.status === 'survivor' && s0.status === 'survivor') return 'both_survive_no_local_headroom';
  if (s1.status !== 'survivor' && s0.status === 'survivor') return 'shadow_local_ceiling_or_rhetorical_regression';
  return 'no_local_survivor';
}

function replayArgs({ transcriptPath, policyMemoryPath, outDir, args }) {
  const scriptArgs = [
    'scripts/replay-discursive-transcript.js',
    '--transcript',
    transcriptPath,
    '--generator',
    args.generator,
    '--checker',
    args.checker,
    '--recursive-tutor-learning-gate',
    '--out-dir',
    outDir,
    '--timeout-ms',
    String(args.stepTimeoutMs),
  ];
  if (args.rewriteMode) scriptArgs.push('--rewrite-mode', args.rewriteMode);
  if (['bounded_continuation', 'role_separated_continuation'].includes(args.rewriteMode)) {
    scriptArgs.push('--bounded-max-added-lines', String(args.boundedMaxAddedLines));
  }
  if (args.codexModel) scriptArgs.push('--codex-model', args.codexModel);
  if (args.codexEffort) scriptArgs.push('--codex-effort', args.codexEffort);
  if (args.claudeModel) scriptArgs.push('--claude-model', args.claudeModel);
  if (args.claudeEffort) scriptArgs.push('--claude-effort', args.claudeEffort);
  if (policyMemoryPath) scriptArgs.push('--policy-memory', policyMemoryPath);
  if (args.force) scriptArgs.push('--force');
  return scriptArgs;
}

function s0ReplayArgs(args) {
  if (args.s0Mode !== 'checker_only') return args;
  return {
    ...args,
    generator: 'none',
    rewriteMode: 'full',
  };
}

function runNodeScript(scriptArgs, { timeoutMs, dryRun }) {
  const command = `node ${scriptArgs.map((arg) => JSON.stringify(arg)).join(' ')}`;
  if (dryRun) return { ok: true, command };
  try {
    const stdout = execFileSync('node', scriptArgs, {
      cwd: ROOT,
      timeout: timeoutMs,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'inherit'],
      maxBuffer: 64 * 1024 * 1024,
    });
    return { ok: true, command, stdout };
  } catch (error) {
    return {
      ok: false,
      command,
      error: error.message,
      stdout: error.stdout ? String(error.stdout) : '',
    };
  }
}

function cmdModelScreen(args) {
  if (!args.run) throw new Error(`--run is required\n\n${usage()}`);
  const run = readJson(args.run);
  const candidates = selectedCandidates(run, args.candidateIds);
  const outDir = args.outDir || defaultModelScreenDir(run);
  fs.mkdirSync(outDir, { recursive: true });
  const rows = [];
  for (const candidate of candidates) {
    const candidateDir = path.join(outDir, safeSlug(candidate.candidate_id));
    const inputDir = path.join(candidateDir, 'inputs');
    fs.mkdirSync(inputDir, { recursive: true });
    const transcriptPath = path.join(inputDir, 'base.full.md');
    const policyMemoryPath = path.join(inputDir, 'rhetorical-policy-memory.json');
    const baseline = baselineControlForCandidate(candidate, args.baselineMode);
    fs.writeFileSync(transcriptPath, renderReplayBaseTranscript(candidate, args.baselineMode), 'utf8');
    writeJson(policyMemoryPath, rhetoricalPolicyMemory(candidate, args.memoryMode));

    const s0OutDir = path.join(candidateDir, 's0-no-memory-replay');
    const s1OutDir = path.join(candidateDir, 's1-rhetorical-memory-replay');
    const s0Args = replayArgs({ transcriptPath, policyMemoryPath: null, outDir: s0OutDir, args: s0ReplayArgs(args) });
    const s1Args = replayArgs({ transcriptPath, policyMemoryPath, outDir: s1OutDir, args });

    process.stdout.write(`\n[a19r-model-screen] ${candidate.candidate_id}: S0 ${args.s0Mode}\n`);
    const s0Run = runNodeScript(s0Args, { timeoutMs: args.stepTimeoutMs + 30_000, dryRun: args.dryRun });
    process.stdout.write(`[a19r-model-screen] ${candidate.candidate_id}: S1 rhetorical-memory\n`);
    const s1Run = s0Run.ok
      ? runNodeScript(s1Args, { timeoutMs: args.stepTimeoutMs + 30_000, dryRun: args.dryRun })
      : { ok: false, command: s1Args.join(' '), error: 'skipped because S0 failed' };

    const s0 = args.dryRun || !s0Run.ok ? null : readReplayRecord(s0OutDir);
    const s1 = args.dryRun || !s1Run.ok ? null : readReplayRecord(s1OutDir);
    rows.push({
      candidate_id: candidate.candidate_id,
      card_id: candidate.card_id,
      source_protocol: candidate.source_protocol || null,
      source_family: candidate.source_family || null,
      source_sibling: candidate.source_sibling || null,
      move_id: candidate.move_id,
      proxy_delta: candidate.proxy_delta ?? null,
      baseline_mode: args.baselineMode,
      baseline_source: args.baselineMode === 'diagnostic_lure' ? 'baseline_control' : 'shadow_control',
      baseline_response_sha256: baseline?.response_sha256 || null,
      s0,
      s1,
      local_verdict: args.dryRun ? 'dry_run' : localVerdict(s0, s1),
      artifacts: {
        candidate_dir: repoRel(candidateDir),
        base_transcript: repoRel(transcriptPath),
        policy_memory: repoRel(policyMemoryPath),
        s0_out_dir: repoRel(s0OutDir),
        s1_out_dir: repoRel(s1OutDir),
      },
      commands: {
        s0: s0Run.command,
        s1: s1Run.command,
      },
      errors: {
        s0: s0Run.ok ? null : s0Run.error,
        s1: s1Run.ok ? null : s1Run.error,
      },
    });
  }

  const completed = rows.filter((row) => row.local_verdict !== 'dry_run' && row.local_verdict !== 'incomplete');
  const summary = {
    schema_version: 'a19r-model-screen-v0.1',
    run_id: `a19r-model-screen-${new Date().toISOString().slice(0, 10)}`,
    created_at: new Date().toISOString(),
    source_run: repoRel(args.run),
    generator: args.generator,
    checker: args.checker,
    codex_model: args.codexModel || null,
    codex_effort: args.codexEffort || null,
    claude_model: args.claudeModel || null,
    claude_effort: args.claudeEffort || null,
    rewrite_mode: args.rewriteMode,
    bounded_max_added_lines: ['bounded_continuation', 'role_separated_continuation'].includes(args.rewriteMode)
      ? args.boundedMaxAddedLines
      : null,
    memory_mode: args.memoryMode,
    baseline_mode: args.baselineMode,
    s0_mode: args.s0Mode,
    claim_boundary: 'simulated_teacher_as_learner_not_human_learning',
    non_claims: [
      'pooled_a18_rate',
      'pooled_a19_rate',
      'human_learning',
      'deployed_adaptive_tutor',
      'model_weight_learning',
      'main_harness_rate_effect',
    ],
    counts: {
      candidates: rows.length,
      completed: completed.length,
      rhetorical_memory_local_advantage: rows.filter((row) => row.local_verdict === 'rhetorical_memory_local_advantage')
        .length,
      both_survive_no_local_headroom: rows.filter((row) => row.local_verdict === 'both_survive_no_local_headroom')
        .length,
      no_local_survivor: rows.filter((row) => row.local_verdict === 'no_local_survivor').length,
      shadow_local_ceiling_or_rhetorical_regression: rows.filter(
        (row) => row.local_verdict === 'shadow_local_ceiling_or_rhetorical_regression',
      ).length,
      incomplete: rows.filter((row) => row.local_verdict === 'incomplete').length,
      dry_run: rows.filter((row) => row.local_verdict === 'dry_run').length,
    },
    rows,
  };
  const summaryPath = path.join(outDir, 'a19r-model-screen-summary.json');
  const mdPath = path.join(outDir, 'a19r-model-screen-summary.md');
  if (!args.dryRun) {
    writeJson(summaryPath, summary);
    fs.writeFileSync(mdPath, renderModelScreenMarkdown(summary), 'utf8');
  }

  if (args.json) process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
  else {
    process.stdout.write('\n========== A19R MODEL SCREEN ==========\n');
    process.stdout.write(`candidates: ${summary.counts.candidates}; completed: ${summary.counts.completed}\n`);
    for (const row of rows) {
      process.stdout.write(
        `${row.candidate_id}: ${row.local_verdict}; S0=${row.s0?.status || 'n/a'}; S1=${row.s1?.status || 'n/a'}\n`,
      );
    }
    if (!args.dryRun) {
      process.stdout.write(`summary: ${repoRel(summaryPath)}\n`);
      process.stdout.write(`markdown: ${repoRel(mdPath)}\n`);
    }
  }
}

function renderModelScreenMarkdown(summary) {
  const lines = [
    '# A19R Model Screen',
    '',
    `Created: ${summary.created_at}`,
    `Generator: \`${summary.generator}\`; checker: \`${summary.checker}\`.`,
    `Codex model: \`${summary.codex_model || 'unresolved_cli_default'}\`; Codex effort: \`${summary.codex_effort || 'unresolved_cli_default'}\`.`,
    `Claude model: \`${summary.claude_model || 'unresolved_cli_default'}\`; Claude effort: \`${summary.claude_effort || 'unresolved_cli_default'}\`.`,
    `Rewrite mode: \`${summary.rewrite_mode}\`${summary.bounded_max_added_lines ? `; bounded max added lines: ${summary.bounded_max_added_lines}` : ''}.`,
    `Memory mode: \`${summary.memory_mode}\`.`,
    `Baseline mode: \`${summary.baseline_mode}\`; S0 mode: \`${summary.s0_mode}\`.`,
    '',
    '## Boundary',
    '',
    'Local simulated teacher-as-learner replay only. This is not a pooled A18/A19 rate, human-learning evidence, deployed-tutor evidence, model-weight learning, or a main-harness effect.',
    '',
    '## Results',
    '',
  ];
  for (const row of summary.rows) {
    lines.push(
      `- \`${row.candidate_id}\`: \`${row.local_verdict}\`; S0=\`${row.s0?.status || 'n/a'}\`, S1=\`${row.s1?.status || 'n/a'}\`, proxy_delta=${row.proxy_delta ?? 'n/a'}.`,
    );
  }
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function cmdPacketize(args) {
  if (!args.run) throw new Error(`--run is required\n\n${usage()}`);
  const { ontology } = loadContext(args);
  const run = readJson(args.run);
  const packets = buildMiniDramaPackets({ run, ontology, candidateIds: args.candidateIds });
  const outDir = args.outDir || defaultPacketDir(run);
  const written = packets.map((packet, index) => {
    const packetPath = path.join(outDir, `${packet.packet_id}.packet.json`);
    writeJson(packetPath, packet);
    const entry = {
      packet: repoRel(packetPath),
      packet_id: packet.packet_id,
      coder_packet_sha256: packet.audit.coder_packet_sha256,
    };
    if (args.assignments) {
      Object.assign(entry, writeAssignment({ packetPath, packet, args, run, index }));
    }
    return entry;
  });
  const summary = {
    run: repoRel(args.run),
    packet_count: written.length,
    packets: written,
    web_test:
      args.assignments && written[0]
        ? {
            assignment_env: `A19_ADJUDICATION_ASSIGNMENT=${written[0].assignment}`,
            codebook_env: `A19_ADJUDICATION_CODEBOOK=${repoRel(args.codebook)}`,
            path: '/adjudication',
          }
        : null,
  };
  if (args.json) process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
  else {
    process.stdout.write(`A19R packets written: ${summary.packet_count}\n`);
    if (summary.web_test) {
      process.stdout.write(`web assignment env: ${summary.web_test.assignment_env}\n`);
      process.stdout.write(`web codebook env: ${summary.web_test.codebook_env}\n`);
    }
  }
}

function cmdCodebookValidate(args) {
  const { ontology, codebook } = loadContext(args);
  const report = validateMiniDramaCodebook({ codebook, ontology });
  const rendered = renderObject(report, args.json);
  if (rendered) process.stdout.write(rendered);
  else {
    process.stdout.write(`Mini-drama codebook validation: ${report.status}\n`);
    if (report.issues.length) {
      report.issues.forEach((issue) => process.stdout.write(`- ${issue.severity}: ${issue.code}\n`));
    }
  }
  if (report.status !== 'pass') process.exitCode = 1;
}

function cmdQa(args) {
  if (!args.run) throw new Error(`--run is required\n\n${usage()}`);
  const run = readJson(args.run);
  const report = qaMiniDramaRun(run);
  const rendered = renderObject(report, args.json);
  if (rendered) process.stdout.write(rendered);
  else {
    process.stdout.write(`Mini-drama QA: ${report.status}\n`);
    process.stdout.write(`candidates: ${report.candidate_count}; issues: ${report.issue_count}\n`);
  }
  if (report.status !== 'pass') process.exitCode = 1;
}

function cmdReport(args) {
  if (!args.run) throw new Error(`--run is required\n\n${usage()}`);
  const run = readJson(args.run);
  const report =
    run.schema_version === 'mini-drama-battery-screen-v0.1'
      ? summarizeMiniDramaBatteryScreen(run)
      : summarizeMiniDramaRun(run);
  if (args.out) writeJson(args.out, report);
  if (args.json) process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  else {
    if (args.out) process.stdout.write(`A19R report: ${repoRel(args.out)}\n`);
    process.stdout.write(`run: ${report.run_id}\n`);
    process.stdout.write(
      `cards: ${report.card_count}; candidates: ${report.candidate_count}; gates: ${report.gate_status}\n`,
    );
  }
}

function main() {
  const args = parseArgs();
  if (args.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  const commands = {
    generate: cmdGenerate,
    screen: cmdScreen,
    packetize: cmdPacketize,
    'model-screen': cmdModelScreen,
    'codebook-validate': cmdCodebookValidate,
    qa: cmdQa,
    report: cmdReport,
  };
  const command = commands[args.command];
  if (!command) throw new Error(`unknown command: ${args.command}\n\n${usage()}`);
  command(args);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
