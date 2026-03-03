#!/usr/bin/env node
import 'dotenv/config';

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { tutorConfigLoader } from '@machinespirits/tutor-core';
import * as evalConfigLoader from '../services/evalConfigLoader.js';
import * as learnerConfigLoader from '../services/learnerConfigLoader.js';
import * as evaluationStore from '../services/evaluationStore.js';
import { resolveEvalProfile } from '../services/evaluationRunner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const CLI_PATH = path.join(ROOT, 'scripts', 'eval-cli.js');
const SESSION_ROOT = path.join(ROOT, 'tmp', 'prompt-lab');
const PROMPTS_ENV = 'MACHINESPIRITS_PROMPTS_DIR';
const TUTOR_CORE_ROOT = fs.realpathSync(path.join(ROOT, 'node_modules', '@machinespirits', 'tutor-core'));
const CANONICAL_PROMPTS_DIR = path.join(TUTOR_CORE_ROOT, 'prompts');
const DEFAULT_JUDGE = 'openrouter.gemini-flash';

const args = process.argv.slice(2);
const command = args[0] || 'help';

function getOption(name, fallback = null) {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : fallback;
}

function hasFlag(name) {
  return args.includes(`--${name}`);
}

function usage() {
  console.log(`Prompt Lab

Usage:
  node scripts/prompt-lab.js init [options]
  node scripts/prompt-lab.js run [options]
  node scripts/prompt-lab.js status [options]

Commands:
  init    Create an isolated prompt-override session from an existing eval cell
  run     Run one fixed eval using the session's prompt override directory
  status  Show prompt files and score history for a session

Options:
  --session <id>       Session name (default: auto-generated on init, latest on run/status)
  --profile <name>     Eval profile (default: cell_80_messages_base_single_unified)
  --scenario <id>      Scenario id (default: mood_frustration_to_breakthrough)
  --model <ref>        Tutor model override (default: lmstudio.qwen3.5-9b)
  --judge <ref>        Rubric judge override (default: openrouter.gemini-flash)
  --parallelism <n>    Eval parallelism for run (default: 1)
  --notes <text>       Free-form note stored with a run iteration
  --skip-rubric        Generate only; do not force rubric scoring
  --dry-run            Run eval-cli in mock mode for harness verification
  --verbose            Pass through to eval-cli run
  --live               Pass through to eval-cli run
  --show-messages      Pass through to eval-cli run
  --force              Overwrite an existing init session directory
`);
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72);
}

function timestampTag() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function defaultSessionId(profileName, scenarioId, modelRef) {
  const modelTag = modelRef.split('.').slice(1).join('.') || modelRef;
  return slugify(`${profileName}-${scenarioId}-${modelTag}-${timestampTag()}`);
}

function sessionDir(sessionId) {
  return path.join(SESSION_ROOT, sessionId);
}

function sessionFile(sessionId) {
  return path.join(sessionDir(sessionId), 'session.json');
}

function requireLatestSessionId() {
  ensureDir(SESSION_ROOT);
  const entries = fs
    .readdirSync(SESSION_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const fullPath = path.join(SESSION_ROOT, entry.name);
      return {
        name: entry.name,
        mtimeMs: fs.statSync(fullPath).mtimeMs,
      };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  if (entries.length === 0) {
    throw new Error('No prompt-lab sessions found. Run `node scripts/prompt-lab.js init` first.');
  }
  return entries[0].name;
}

function resolveSessionId() {
  return getOption('session') || requireLatestSessionId();
}

function sha16(text) {
  return createHash('sha256').update(text).digest('hex').slice(0, 16);
}

function readCanonicalPrompt(filename) {
  const promptPath = path.join(CANONICAL_PROMPTS_DIR, filename);
  if (!fs.existsSync(promptPath)) {
    throw new Error(`Prompt file not found in tutor-core: ${filename}`);
  }
  return {
    path: promptPath,
    content: fs.readFileSync(promptPath, 'utf8'),
  };
}

function getTutorRuntimeProfile(profileName) {
  const resolved = resolveEvalProfile(profileName);
  const evalProfiles = evalConfigLoader.loadTutorAgents({ forceReload: true })?.profiles || {};
  const evalProfile = evalProfiles[profileName];
  if (!evalProfile) {
    throw new Error(`Eval profile not found: ${profileName}`);
  }

  const tutorProfiles = tutorConfigLoader.loadConfig().profiles || {};
  const tutorProfile = tutorProfiles[resolved.resolvedProfileName];
  if (!tutorProfile) {
    throw new Error(
      `Tutor-core profile not found: ${resolved.resolvedProfileName} (resolved from eval profile ${profileName})`,
    );
  }

  return {
    evalProfile,
    resolvedProfileName: resolved.resolvedProfileName,
    tutorProfile,
  };
}

function collectPromptBlueprints(profileName) {
  const { evalProfile, resolvedProfileName, tutorProfile } = getTutorRuntimeProfile(profileName);
  const learnerProfileName = evalProfile.learner_architecture || 'unified';
  const learnerProfile = learnerConfigLoader.getActiveProfile(learnerProfileName);
  const blueprints = [];

  for (const role of ['ego', 'superego']) {
    const runtimeFile = tutorProfile?.[role]?.prompt_file || null;
    const metadataFile = evalProfile?.[role]?.prompt_file || null;
    if (!runtimeFile) continue;
    blueprints.push({
      kind: 'tutor',
      role,
      purpose: 'runtime',
      sourceProfile: resolvedProfileName,
      filename: runtimeFile,
      sourceFilename: runtimeFile,
    });
    if (metadataFile && metadataFile !== runtimeFile) {
      blueprints.push({
        kind: 'tutor',
        role,
        purpose: 'metadata-alias',
        sourceProfile: profileName,
        filename: metadataFile,
        sourceFilename: runtimeFile,
      });
    }
  }

  for (const role of ['unified_learner', 'ego', 'superego', 'synthesis']) {
    const promptFile = learnerProfile?.[role]?.prompt_file || null;
    if (!promptFile) continue;
    blueprints.push({
      kind: 'learner',
      role,
      purpose: 'runtime',
      sourceProfile: learnerProfileName,
      filename: promptFile,
      sourceFilename: promptFile,
    });
  }

  const byFilename = new Map();
  for (const blueprint of blueprints) {
    if (!byFilename.has(blueprint.filename)) {
      byFilename.set(blueprint.filename, blueprint);
    }
  }

  return {
    profileName,
    scenarioId: getOption('scenario', 'mood_frustration_to_breakthrough'),
    modelRef: getOption('model', 'lmstudio.qwen3.5-9b'),
    learnerProfileName,
    resolvedTutorProfileName: resolvedProfileName,
    promptFiles: [...byFilename.values()].map((item) => {
      const source = readCanonicalPrompt(item.sourceFilename);
      return {
        ...item,
        sourcePath: source.path,
        initialHash: sha16(source.content),
      };
    }),
  };
}

function copyPromptIntoSession(promptDir, filename, sourcePath, force = false) {
  const destination = path.join(promptDir, filename);
  ensureDir(path.dirname(destination));
  if (!force && fs.existsSync(destination)) return destination;
  fs.copyFileSync(sourcePath, destination);
  return destination;
}

async function runChildProcess(cmd, childArgs, options = {}) {
  const { cwd = ROOT, env = process.env } = options;
  return await new Promise((resolve, reject) => {
    const child = spawn(cmd, childArgs, {
      cwd,
      env,
      stdio: ['inherit', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      stdout += text;
      process.stdout.write(text);
    });
    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      stderr += text;
      process.stderr.write(text);
    });

    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

function extractRunId(output) {
  const match = output.match(/Run ID:\s*(eval-[\w-]+)/) || output.match(/(eval-\d{4}-\d{2}-\d{2}-[a-f0-9]+)/);
  return match ? match[1] : null;
}

function summarizeRun(runId, profileName, scenarioId) {
  const results = evaluationStore
    .getResults(runId, { profileName, scenarioId })
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  if (results.length > 0) {
    const row = results[results.length - 1];
    return {
      mode: 'stored-result',
      success: Boolean(row.success),
      metricName: row.tutorFirstTurnScore != null ? 'tutorFirstTurnScore' : 'tutorOverallScore',
      primaryScore: row.tutorFirstTurnScore ?? row.tutorOverallScore ?? null,
      tutorFirstTurnScore: row.tutorFirstTurnScore ?? null,
      tutorOverallScore: row.tutorOverallScore ?? null,
      tutorHolisticOverallScore: row.tutorHolisticOverallScore ?? null,
      learnerHolisticOverallScore: row.learnerHolisticOverallScore ?? null,
      dialogueQualityScore: row.dialogueQualityScore ?? null,
      latencyMs: row.latencyMs ?? null,
      inputTokens: row.inputTokens ?? null,
      outputTokens: row.outputTokens ?? null,
      cost: row.cost ?? null,
      judgeModel: row.judgeModel ?? null,
      errorMessage: row.errorMessage ?? null,
      dialogueId: row.dialogueId ?? null,
      promptContentHash: row.promptContentHash ?? null,
      tutorEgoPromptVersion: row.tutorEgoPromptVersion ?? null,
      tutorSuperegoPromptVersion: row.tutorSuperegoPromptVersion ?? null,
      learnerPromptVersion: row.learnerPromptVersion ?? null,
    };
  }

  const stat = evaluationStore
    .getRunStats(runId)
    .find((entry) => entry.profileName === profileName);
  const scenarioStat = evaluationStore
    .getScenarioStats(runId)
    .find((entry) => entry.scenarioId === scenarioId)?.configurations
    ?.find((entry) => entry.profileName === profileName);

  return {
    mode: 'transient-placeholder',
    success: false,
    metricName: 'avgScore',
    primaryScore: stat?.avgScore ?? null,
    tutorFirstTurnScore: scenarioStat?.avgScore ?? null,
    tutorOverallScore: null,
    tutorHolisticOverallScore: null,
    learnerHolisticOverallScore: null,
    dialogueQualityScore: null,
    latencyMs: stat?.avgLatencyMs ?? null,
    inputTokens: stat?.totalInputTokens ?? null,
    outputTokens: stat?.totalOutputTokens ?? null,
    cost: null,
    judgeModel: null,
    errorMessage: stat?.lastErrorMessage || scenarioStat?.lastErrorMessage || 'No stored result row found',
    dialogueId: null,
    promptContentHash: null,
    tutorEgoPromptVersion: null,
    tutorSuperegoPromptVersion: null,
    learnerPromptVersion: null,
  };
}

function printPromptFiles(session) {
  console.log(`Session: ${session.sessionId}`);
  console.log(`Prompt override dir: ${session.promptDir}`);
  console.log(`Profile: ${session.profileName}`);
  console.log(`Scenario: ${session.scenarioId}`);
  console.log(`Model: ${session.modelRef}`);
  console.log(`Judge: ${session.judgeRef || DEFAULT_JUDGE}`);
  console.log(`Tutor runtime profile: ${session.resolvedTutorProfileName}`);
  console.log(`Learner profile: ${session.learnerProfileName}`);
  console.log('');
  console.log('Editable prompt files:');
  for (const prompt of session.promptFiles) {
    console.log(`  ${prompt.kind}.${prompt.role} -> ${path.join(session.promptDir, prompt.filename)}`);
  }
}

function printIterationTable(session) {
  const runs = session.iterations || [];
  if (runs.length === 0) {
    console.log('\nNo iterations recorded yet.');
    return;
  }

  console.log('\nIterations:');
  console.log('  #   Score   First   TutorH  LearnH  Dialog  Latency   Run ID');
  console.log('  ' + '─'.repeat(82));
  for (const run of runs) {
    const s = run.summary || {};
    const latency =
      s.latencyMs == null ? '--' : s.latencyMs >= 1000 ? `${(s.latencyMs / 1000).toFixed(1)}s` : `${s.latencyMs}ms`;
    const score = s.primaryScore == null ? '--' : s.primaryScore.toFixed(1);
    const first = s.tutorFirstTurnScore == null ? '--' : s.tutorFirstTurnScore.toFixed(1);
    const tutorH = s.tutorHolisticOverallScore == null ? '--' : s.tutorHolisticOverallScore.toFixed(1);
    const learnH = s.learnerHolisticOverallScore == null ? '--' : s.learnerHolisticOverallScore.toFixed(1);
    const dialog = s.dialogueQualityScore == null ? '--' : s.dialogueQualityScore.toFixed(1);
    console.log(
      `  ${String(run.iteration).padStart(2)}  ${score.padStart(6)}  ${first.padStart(5)}  ${tutorH.padStart(6)}  ${learnH.padStart(6)}  ${dialog.padStart(6)}  ${latency.padStart(7)}   ${run.runId}`,
    );
  }
}

function formatDelta(value) {
  if (value == null) return 'n/a';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}`;
}

async function handleInit() {
  const profileName = getOption('profile', 'cell_80_messages_base_single_unified');
  const scenarioId = getOption('scenario', 'mood_frustration_to_breakthrough');
  const modelRef = getOption('model', 'lmstudio.qwen3.5-9b');
  const judgeRef = getOption('judge', DEFAULT_JUDGE);
  const sessionId = getOption('session') || defaultSessionId(profileName, scenarioId, modelRef);
  const force = hasFlag('force');

  const dir = sessionDir(sessionId);
  const promptDir = path.join(dir, 'prompts');
  const manifestPath = sessionFile(sessionId);

  if (fs.existsSync(dir) && !force) {
    throw new Error(`Session already exists: ${sessionId}. Use --force to overwrite it.`);
  }

  fs.rmSync(dir, { recursive: true, force: true });
  ensureDir(promptDir);

  const blueprint = collectPromptBlueprints(profileName);
  for (const prompt of blueprint.promptFiles) {
    copyPromptIntoSession(promptDir, prompt.filename, prompt.sourcePath, true);
  }

  const session = {
    sessionId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    profileName,
    scenarioId,
    modelRef,
    judgeRef,
    parallelism: parseInt(getOption('parallelism', '1'), 10),
    promptDir,
    resolvedTutorProfileName: blueprint.resolvedTutorProfileName,
    learnerProfileName: blueprint.learnerProfileName,
    promptFiles: blueprint.promptFiles,
    iterations: [],
  };

  writeJson(manifestPath, session);
  printPromptFiles(session);
  console.log('\nNext step: edit the prompt files above, then run:');
  console.log(`  node scripts/prompt-lab.js run --session ${sessionId}`);
}

async function handleRun() {
  const sessionId = resolveSessionId();
  const manifestPath = sessionFile(sessionId);
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  const session = readJson(manifestPath);
  const scenarioId = getOption('scenario', session.scenarioId);
  const modelRef = getOption('model', session.modelRef);
  const judgeRef = getOption('judge', session.judgeRef || DEFAULT_JUDGE);
  const parallelism = parseInt(getOption('parallelism', String(session.parallelism || 1)), 10);
  const notes = getOption('notes', null);
  const useRubric = !hasFlag('skip-rubric');
  const dryRun = hasFlag('dry-run');
  const iteration = (session.iterations?.length || 0) + 1;
  const snapshotDir = path.join(sessionDir(sessionId), 'snapshots', `${String(iteration).padStart(3, '0')}-${timestampTag()}`);
  const snapshotPromptsDir = path.join(snapshotDir, 'prompts');

  ensureDir(snapshotPromptsDir);
  for (const prompt of session.promptFiles) {
    const currentPath = path.join(session.promptDir, prompt.filename);
    if (!fs.existsSync(currentPath)) {
      throw new Error(`Missing prompt file in session override dir: ${currentPath}`);
    }
    copyPromptIntoSession(snapshotPromptsDir, prompt.filename, currentPath, true);
  }

  const description = `Prompt Lab ${sessionId} iter ${iteration}`;
  const childArgs = [
    CLI_PATH,
    'run',
    '--profile',
    session.profileName,
    '--scenario',
    scenarioId,
    '--runs',
    '1',
    '--parallelism',
    String(parallelism),
    '--model',
    modelRef,
    '--judge',
    judgeRef,
    '--description',
    description,
    useRubric ? '--use-rubric' : '--skip-rubric',
  ];

  if (dryRun) childArgs.push('--dry-run');
  if (hasFlag('verbose')) childArgs.push('--verbose');
  if (hasFlag('live')) childArgs.push('--live');
  if (hasFlag('show-messages')) childArgs.push('--show-messages');

  console.log(`\nRunning iteration ${iteration} with prompt override dir:\n  ${session.promptDir}\n`);
  const childEnv = { ...process.env, [PROMPTS_ENV]: session.promptDir };
  const { code, stdout, stderr } = await runChildProcess('node', childArgs, { cwd: ROOT, env: childEnv });
  const runId = extractRunId(stdout + '\n' + stderr);

  if (code !== 0) {
    throw new Error(runId ? `eval-cli exited with code ${code} (run ${runId})` : `eval-cli exited with code ${code}`);
  }
  if (!runId) {
    throw new Error('Could not extract run ID from eval-cli output');
  }

  const summary = summarizeRun(runId, session.profileName, scenarioId);
  const hashes = {};
  for (const prompt of session.promptFiles) {
    const promptPath = path.join(session.promptDir, prompt.filename);
    hashes[prompt.filename] = sha16(fs.readFileSync(promptPath, 'utf8'));
  }

  const history = session.iterations || [];
  const baseline = history.find((entry) => entry.summary?.primaryScore != null) || null;
  const bestPrior = history
    .filter((entry) => entry.summary?.primaryScore != null)
    .sort((a, b) => (b.summary.primaryScore || 0) - (a.summary.primaryScore || 0))[0];

  const entry = {
    iteration,
    createdAt: new Date().toISOString(),
    runId,
    scenarioId,
    modelRef,
    judgeRef,
    usedRubric: useRubric,
    dryRun,
    notes,
    snapshotDir,
    promptHashes: hashes,
    summary,
  };

  session.updatedAt = new Date().toISOString();
  session.scenarioId = scenarioId;
  session.modelRef = modelRef;
  session.judgeRef = judgeRef;
  session.parallelism = parallelism;
  session.iterations = [...history, entry];
  writeJson(manifestPath, session);

  console.log('\nIteration summary');
  console.log(`  Run ID: ${runId}`);
  if (useRubric) {
    console.log(`  Judge: ${judgeRef}`);
  }
  console.log(`  Primary metric (${summary.metricName}): ${summary.primaryScore == null ? 'n/a' : summary.primaryScore.toFixed(1)}`);
  if (baseline?.summary?.primaryScore != null && summary.primaryScore != null) {
    console.log(`  Delta vs baseline: ${formatDelta(summary.primaryScore - baseline.summary.primaryScore)}`);
  }
  if (bestPrior?.summary?.primaryScore != null && summary.primaryScore != null) {
    console.log(`  Delta vs best prior: ${formatDelta(summary.primaryScore - bestPrior.summary.primaryScore)}`);
  }
  if (summary.tutorHolisticOverallScore != null) {
    console.log(`  Tutor holistic: ${summary.tutorHolisticOverallScore.toFixed(1)}`);
  }
  if (summary.learnerHolisticOverallScore != null) {
    console.log(`  Learner holistic: ${summary.learnerHolisticOverallScore.toFixed(1)}`);
  }
  if (summary.dialogueQualityScore != null) {
    console.log(`  Dialogue quality: ${summary.dialogueQualityScore.toFixed(1)}`);
  }
  if (summary.latencyMs != null) {
    console.log(`  Latency: ${summary.latencyMs}ms`);
  }
  if (summary.errorMessage) {
    console.log(`  Error: ${summary.errorMessage}`);
  }
  console.log(`  Snapshot: ${snapshotDir}`);
}

async function handleStatus() {
  const sessionId = resolveSessionId();
  const manifestPath = sessionFile(sessionId);
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Session not found: ${sessionId}`);
  }
  const session = readJson(manifestPath);
  printPromptFiles(session);
  printIterationTable(session);
}

async function main() {
  ensureDir(SESSION_ROOT);

  switch (command) {
    case 'init':
      await handleInit();
      return;
    case 'run':
      await handleRun();
      return;
    case 'status':
      await handleStatus();
      return;
    default:
      usage();
  }
}

main().catch((error) => {
  console.error(`\nError: ${error.message}`);
  process.exit(1);
});
