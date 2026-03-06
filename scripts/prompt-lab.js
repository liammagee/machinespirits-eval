#!/usr/bin/env node
import 'dotenv/config';

import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { jsonrepair } from 'jsonrepair';
import { tutorConfigLoader, unifiedAIProvider } from '@machinespirits/tutor-core';
import * as evalConfigLoader from '../services/evalConfigLoader.js';
import * as learnerConfigLoader from '../services/learnerConfigLoader.js';
import * as evaluationStore from '../services/evaluationStore.js';
import promptRecommendationService from '../services/promptRecommendationService.js';
import { resolveEvalProfile } from '../services/evaluationRunner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const CLI_PATH = path.join(ROOT, 'scripts', 'eval-cli.js');
const SESSION_ROOT = path.join(ROOT, 'tmp', 'prompt-lab');
const PROMPTS_ENV = 'MACHINESPIRITS_PROMPTS_DIR';
const TUTOR_CORE_ROOT = fs.realpathSync(path.join(ROOT, 'node_modules', '@machinespirits', 'tutor-core'));
const CANONICAL_PROMPTS_DIR = path.join(TUTOR_CORE_ROOT, 'prompts');
const LEGACY_DEFAULT_JUDGE_REF = 'openrouter.gemini-flash';
const DEFAULT_JUDGE_CLI = 'codex';
const DEFAULT_RECOMMENDER_CLI = 'codex';
const DEFAULT_AUTOTUNE_ITERATIONS = 3;
const DEFAULT_RUNS_PER_ITERATION = 1;
const VALID_TARGETS = new Set(['tutor', 'learner', 'both']);
const VALID_CLIS = new Set(['claude', 'gemini', 'codex']);

const args = process.argv.slice(2);
const command = args[0] || 'help';
const isDirectExecution = process.argv[1] ? path.resolve(process.argv[1]) === __filename : false;

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
  node scripts/prompt-lab.js fork [options]
  node scripts/prompt-lab.js run [options]
  node scripts/prompt-lab.js status [options]
  node scripts/prompt-lab.js recommend [options]
  node scripts/prompt-lab.js autotune [options]
  node scripts/prompt-lab.js diff [options]

Commands:
  init       Create an isolated prompt-override session from an existing eval cell
  fork       Create a new session from another session's current/best/latest/iteration prompts
  run        Run one fixed eval using the session's prompt override directory
  status     Show prompt files, scored iterations, and recommendations for a session
  recommend  Ask a recommender model for prompt revisions based on a scored iteration
  autotune   Generate prompt variants, rerun the benchmark, and keep/revert by score
  diff       Show prompt diffs between baseline/current/iteration snapshots

Shared Options:
  --session <id>         Session name (default: latest for run/status/recommend/autotune/diff)
  --new-session <id>     For fork: destination session name
  --profile <name>       Eval profile (default: cell_80_messages_base_single_unified)
  --scenario <id>        Scenario id (default: mood_frustration_to_breakthrough)
  --model <ref>          Tutor model override (default: lmstudio.qwen3.5-9b)
  --judge <ref>          Provider-based rubric judge override
  --judge-cli <name>     CLI rubric judge backend (default: codex)
  --judge-cli-model <m>  Optional CLI judge model override
  --parallelism <n>      Eval parallelism for run (default: 1)
  --runs <n>             Replications per prompt-lab iteration (default: 1)
  --notes <text>         Free-form note attached to an iteration
  --dry-run              Use eval-cli mock mode; recommender uses a deterministic placeholder

Recommend/Autotune:
  --recommender <ref>    Provider-based prompt rewriter override
  --recommender-cli <n>  CLI prompt rewriter backend (default: codex)
  --recommender-cli-model <m>
                         Optional CLI recommender model override
  --basis <best|latest|N>
                         Which scored iteration to optimize from (default: best)
  --target <tutor|learner|both>
                         Which prompt family the recommender may edit (default: both)
  --apply                For recommend: apply the proposed prompt rewrite to the working prompt dir
  --iterations <n>       For autotune: number of recommendation/eval passes (default: 3)
  --keep-worse           For autotune: keep working prompts even if a candidate scores worse

Fork:
  --from <current|baseline|best|latest|N>
                         Which prompt state to branch from (default: current)

Diff:
  --from <baseline|current|best|latest|N>
  --to <baseline|current|best|latest|N>

Run passthrough:
  --skip-rubric
  --verbose
  --live
  --show-messages
  --force
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

function sha16(text) {
  return createHash('sha256').update(text).digest('hex').slice(0, 16);
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

function baselinePromptsDir(sessionId) {
  return path.join(sessionDir(sessionId), 'baseline', 'prompts');
}

function recommendationsDir(sessionId) {
  return path.join(sessionDir(sessionId), 'recommendations');
}

function snapshotsDir(sessionId) {
  return path.join(sessionDir(sessionId), 'snapshots');
}

function recommendationFile(sessionId, recommendationId) {
  return path.join(recommendationsDir(sessionId), `${recommendationId}.json`);
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

function normalizePromptContent(content) {
  let text = String(content || '').replace(/\r\n/g, '\n');
  if (!text.endsWith('\n')) text += '\n';
  return text;
}

function normalizeTargetScope(value = 'both') {
  const normalized = String(value || 'both').trim().toLowerCase();
  if (!VALID_TARGETS.has(normalized)) {
    throw new Error(`Invalid --target value: ${value}. Expected tutor, learner, or both.`);
  }
  return normalized;
}

function normalizeCliName(value, { allowNull = false } = {}) {
  if (value == null || value === '') {
    if (allowNull) return null;
    throw new Error(`Invalid CLI selection: ${value}`);
  }
  const normalized = String(value).trim().toLowerCase();
  if (!VALID_CLIS.has(normalized)) {
    throw new Error(`Invalid CLI selection: ${value}. Expected claude, gemini, or codex.`);
  }
  return normalized;
}

function getDefaultPromptLabJudgeSelection() {
  return { judgeRef: null, judgeCli: DEFAULT_JUDGE_CLI, judgeCliModel: null };
}

function inferJudgeSourceFromCliArgs() {
  return getOption('judge', null) || getOption('judge-cli', null) ? 'explicit' : 'default';
}

function getDefaultPromptLabRecommenderSelection() {
  return { recommenderRef: null, recommenderCli: DEFAULT_RECOMMENDER_CLI, recommenderCliModel: null };
}

function formatCliLabel(cli, modelOverride = null) {
  const normalized = normalizeCliName(cli);
  if (normalized === 'gemini') return `gemini-cli/${modelOverride || 'auto'}`;
  if (normalized === 'codex') return `codex-cli/${modelOverride || 'auto'}`;
  return modelOverride ? `claude-code/${modelOverride}` : 'claude-opus-4.6';
}

function formatJudgeSelection(selection = {}) {
  if (selection.judgeRef) return selection.judgeRef;
  if (selection.judgeCli) return formatCliLabel(selection.judgeCli, selection.judgeCliModel);
  return formatCliLabel(DEFAULT_JUDGE_CLI);
}

function parseJudgeSelection(options = {}, fallback = getDefaultPromptLabJudgeSelection()) {
  const judgeRef = options.judgeRef ?? fallback.judgeRef ?? null;
  const judgeCli = options.judgeCli ?? fallback.judgeCli ?? null;
  const judgeCliModel = options.judgeCliModel ?? fallback.judgeCliModel ?? null;
  if (judgeRef && judgeCli) {
    throw new Error('Use either a provider judge (--judge) or a CLI judge (--judge-cli), not both.');
  }
  if (judgeCli) {
    return { judgeRef: null, judgeCli: normalizeCliName(judgeCli), judgeCliModel: judgeCliModel || null };
  }
  if (judgeRef) {
    return { judgeRef, judgeCli: null, judgeCliModel: null };
  }
  return getDefaultPromptLabJudgeSelection();
}

function selectPromptFilesByTarget(session, targetScope = 'both') {
  const target = normalizeTargetScope(targetScope);
  if (target === 'both') return session.promptFiles;
  return session.promptFiles.filter((prompt) => prompt.kind === target);
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

function copyPromptFile(destinationDir, filename, sourcePath) {
  const destination = path.join(destinationDir, filename);
  ensureDir(path.dirname(destination));
  fs.copyFileSync(sourcePath, destination);
  return destination;
}

function copyPromptDir(fromDir, toDir, promptFiles) {
  ensureDir(toDir);
  for (const prompt of promptFiles) {
    const sourcePath = path.join(fromDir, prompt.filename);
    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Missing prompt file: ${sourcePath}`);
    }
    copyPromptFile(toDir, prompt.filename, sourcePath);
  }
}

function readPromptState(dir, promptFiles) {
  const state = {};
  for (const prompt of promptFiles) {
    const filePath = path.join(dir, prompt.filename);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Prompt file not found: ${filePath}`);
    }
    const content = fs.readFileSync(filePath, 'utf8');
    state[prompt.filename] = {
      filename: prompt.filename,
      path: filePath,
      content,
      hash: sha16(content),
    };
  }
  return state;
}

function getPromptHashesFromDir(dir, promptFiles) {
  const hashes = {};
  for (const prompt of promptFiles) {
    const filePath = path.join(dir, prompt.filename);
    hashes[prompt.filename] = fs.existsSync(filePath) ? sha16(fs.readFileSync(filePath, 'utf8')) : null;
  }
  return hashes;
}

function extractMarkdownHeadings(content) {
  return [...String(content || '').matchAll(/^#{1,6}\s+.+$/gm)].map((match) => match[0].trim());
}

function countCodeFences(content) {
  return (String(content || '').match(/```/g) || []).length;
}

function analyzeSectionTags(content) {
  const text = String(content || '');
  const regex = /^\s*<\/?([a-z_][a-z0-9_-]*)>\s*$/gim;
  const openCounts = new Map();
  const closeCounts = new Map();

  let match;
  while ((match = regex.exec(text)) !== null) {
    const full = match[0].trim();
    const tag = match[1];
    if (full.startsWith('</')) {
      closeCounts.set(tag, (closeCounts.get(tag) || 0) + 1);
    } else {
      openCounts.set(tag, (openCounts.get(tag) || 0) + 1);
    }
  }

  const tagNames = new Set([...openCounts.keys(), ...closeCounts.keys()]);
  const imbalanced = [];
  for (const tag of tagNames) {
    const openCount = openCounts.get(tag) || 0;
    const closeCount = closeCounts.get(tag) || 0;
    if (openCount !== closeCount) {
      imbalanced.push({ tag, openCount, closeCount });
    }
  }

  return { openCounts, closeCounts, tagNames, imbalanced };
}

function getLastNonEmptyLine(content) {
  const lines = String(content || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.length > 0 ? lines[lines.length - 1] : '';
}

function validatePromptCandidate(prompt, candidateContent, referenceContent) {
  const candidate = normalizePromptContent(candidateContent);
  const reference = normalizePromptContent(referenceContent);
  const issues = [];

  if (!candidate.trim()) {
    issues.push('candidate is empty');
  }

  const candidateFenceCount = countCodeFences(candidate);
  if (candidateFenceCount % 2 !== 0) {
    issues.push(`contains an unmatched code fence (${candidateFenceCount} total fences)`);
  }

  const candidateTags = analyzeSectionTags(candidate);
  for (const imbalance of candidateTags.imbalanced) {
    issues.push(
      `has imbalanced <${imbalance.tag}> tags (${imbalance.openCount} open / ${imbalance.closeCount} close)`,
    );
  }

  const referenceHeadings = extractMarkdownHeadings(reference);
  const candidateHeadingSet = new Set(extractMarkdownHeadings(candidate));
  const missingHeadings = referenceHeadings.filter((heading) => !candidateHeadingSet.has(heading));
  if (missingHeadings.length > 0) {
    issues.push(`is missing required headings: ${missingHeadings.slice(0, 4).join(', ')}`);
  }

  const referenceTags = analyzeSectionTags(reference);
  const missingTags = [...referenceTags.tagNames].filter((tag) => !candidateTags.tagNames.has(tag));
  if (missingTags.length > 0) {
    issues.push(`is missing required section tags: ${missingTags.slice(0, 6).map((tag) => `<${tag}>`).join(', ')}`);
  }

  const referenceLastLine = getLastNonEmptyLine(reference);
  const candidateLastLine = getLastNonEmptyLine(candidate);
  if (/^<\/[a-z_][a-z0-9_-]*>$/.test(referenceLastLine) && candidateLastLine !== referenceLastLine) {
    issues.push(`does not end with required closing tag ${referenceLastLine}`);
  }

  if (candidate.length < reference.length * 0.7) {
    issues.push(`is suspiciously short (${candidate.length} chars vs ${reference.length} chars in current prompt)`);
  }

  return {
    filename: prompt.filename,
    ok: issues.length === 0,
    issues,
    referenceLength: reference.length,
    candidateLength: candidate.length,
  };
}

function getRecoverableValidationIssues(issues = []) {
  return issues.filter(
    (issue) =>
      issue.startsWith('contains an unmatched code fence')
      || issue.startsWith('has imbalanced <')
      || issue.startsWith('does not end with required closing tag'),
  );
}

function appendMissingClosingTags(candidate, reference) {
  const referenceTags = analyzeSectionTags(reference);
  const candidateTags = analyzeSectionTags(candidate);
  const missingClosers = [];

  for (const tag of referenceTags.tagNames) {
    const candidateOpen = candidateTags.openCounts.get(tag) || 0;
    const candidateClose = candidateTags.closeCounts.get(tag) || 0;
    const referenceClose = referenceTags.closeCounts.get(tag) || 0;
    const delta = Math.min(candidateOpen - candidateClose, referenceClose - candidateClose);
    if (delta > 0) {
      missingClosers.push(...Array.from({ length: delta }, () => `</${tag}>`));
    }
  }

  if (missingClosers.length === 0) {
    return { content: candidate, notes: [] };
  }

  let repaired = candidate.replace(/\s*$/, '\n');
  repaired += `${missingClosers.join('\n')}\n`;
  return {
    content: repaired,
    notes: [`appended missing closing tags: ${missingClosers.join(', ')}`],
  };
}

function recoverPromptCandidate(prompt, candidateContent, referenceContent) {
  const reference = normalizePromptContent(referenceContent);
  let repaired = normalizePromptContent(candidateContent);
  const notes = [];

  if (countCodeFences(repaired) % 2 !== 0) {
    repaired = `${repaired.replace(/\s*$/, '\n')}\`\`\`\n`;
    notes.push('appended a closing code fence');
  }

  const appended = appendMissingClosingTags(repaired, reference);
  repaired = appended.content;
  notes.push(...appended.notes);

  const referenceLastLine = getLastNonEmptyLine(reference);
  const repairedLastLine = getLastNonEmptyLine(repaired);
  if (/^<\/[a-z_][a-z0-9_-]*>$/.test(referenceLastLine) && repairedLastLine !== referenceLastLine) {
    repaired = `${repaired.replace(/\s*$/, '\n')}${referenceLastLine}\n`;
    notes.push(`restored required final closing tag ${referenceLastLine}`);
  }

  return {
    applied: notes.length > 0 && normalizePromptContent(candidateContent) !== repaired,
    content: repaired,
    notes,
  };
}

function getScoredIterations(session) {
  return (session.iterations || []).filter((entry) => entry.summary?.primaryScore != null);
}

function getBestScoredIteration(session) {
  return [...getScoredIterations(session)].sort((a, b) => (b.summary.primaryScore || 0) - (a.summary.primaryScore || 0))[0]
    || null;
}

function getLatestIteration(session) {
  const items = session.iterations || [];
  return items.length > 0 ? items[items.length - 1] : null;
}

function getBaselineScoredIteration(session) {
  return getScoredIterations(session)[0] || null;
}

function getIterationByNumber(session, iterationNumber) {
  return (session.iterations || []).find((entry) => entry.iteration === iterationNumber) || null;
}

function resolveIterationSpec(session, spec = 'best') {
  if (!session.iterations || session.iterations.length === 0) {
    return null;
  }

  if (spec == null || spec === 'best') return getBestScoredIteration(session) || getLatestIteration(session);
  if (spec === 'latest') return getLatestIteration(session);
  if (spec === 'baseline') return getBaselineScoredIteration(session) || getLatestIteration(session);

  const numeric = parseInt(spec, 10);
  if (Number.isFinite(numeric)) return getIterationByNumber(session, numeric);

  return null;
}

function ensureBaselineSnapshot(session) {
  const promptDir = session.baselineDir || baselinePromptsDir(session.sessionId);
  let changed = false;

  if (!fs.existsSync(promptDir)) {
    ensureDir(promptDir);
    for (const prompt of session.promptFiles) {
      copyPromptFile(promptDir, prompt.filename, prompt.sourcePath);
    }
    changed = true;
  }

  if (session.baselineDir !== promptDir) {
    session.baselineDir = promptDir;
    changed = true;
  }
  if (!Array.isArray(session.recommendations)) {
    session.recommendations = [];
    changed = true;
  }
  if (!session.judgeSource) {
    if (!session.judgeRef && !session.judgeCli) {
      Object.assign(session, getDefaultPromptLabJudgeSelection());
      session.judgeSource = 'default';
      changed = true;
    } else if (session.judgeRef === LEGACY_DEFAULT_JUDGE_REF && !session.judgeCli) {
      Object.assign(session, getDefaultPromptLabJudgeSelection());
      session.judgeSource = 'migrated_default';
      session.judgeMigratedAt = new Date().toISOString();
      changed = true;
    } else {
      session.judgeSource = 'explicit';
      changed = true;
    }
  } else if (!session.judgeRef && !session.judgeCli) {
    Object.assign(session, getDefaultPromptLabJudgeSelection());
    changed = true;
  }

  return changed;
}

function saveSession(session) {
  session.updatedAt = new Date().toISOString();
  writeJson(sessionFile(session.sessionId), session);
}

function loadSession(sessionId) {
  const manifestPath = sessionFile(sessionId);
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Session not found: ${sessionId}`);
  }
  const session = readJson(manifestPath);
  let changed = ensureBaselineSnapshot(session) || refreshSessionSummaries(session);
  if (!Number.isInteger(session.runsPerIteration) || session.runsPerIteration < 1) {
    session.runsPerIteration = DEFAULT_RUNS_PER_ITERATION;
    changed = true;
  }
  if (changed) saveSession(session);
  return session;
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

function getRunRows(runId, profileName, scenarioId) {
  return evaluationStore
    .getResults(runId, { profileName, scenarioId })
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

function selectLatestRowsPerDialogue(rows) {
  const byDialogue = new Map();

  for (const row of rows || []) {
    const key = row.dialogueId || `row:${row.id}`;
    const existing = byDialogue.get(key);
    if (!existing || new Date(row.createdAt) >= new Date(existing.createdAt)) {
      byDialogue.set(key, row);
    }
  }

  return [...byDialogue.values()].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

function averageOrNull(values) {
  const numeric = (values || []).map((value) => (value == null ? null : Number(value))).filter(Number.isFinite);
  if (numeric.length === 0) return null;
  return numeric.reduce((sum, value) => sum + value, 0) / numeric.length;
}

function getPrimaryMetricName(rows) {
  return rows.some((row) => row.tutorFirstTurnScore != null) ? 'tutorFirstTurnScore' : 'tutorOverallScore';
}

function getPrimaryMetricValue(row) {
  return row?.tutorFirstTurnScore ?? row?.tutorOverallScore ?? null;
}

function uniqueOrNull(values) {
  const unique = [...new Set((values || []).filter((value) => value != null))];
  if (unique.length !== 1) return null;
  return unique[0];
}

function joinUnique(values) {
  const unique = [...new Set((values || []).filter(Boolean))];
  if (unique.length === 0) return null;
  return unique.length === 1 ? unique[0] : unique.join(', ');
}

function aggregateRunRows(rows) {
  const latestRows = selectLatestRowsPerDialogue(rows);
  if (latestRows.length === 0) return null;

  const metricName = getPrimaryMetricName(latestRows);
  const scoredRows = latestRows.filter((row) => getPrimaryMetricValue(row) != null);
  const failedRows = latestRows.filter((row) => !row.success);
  const latestRow = latestRows[latestRows.length - 1];

  return {
    mode: 'stored-result',
    success: failedRows.length === 0,
    metricName,
    primaryScore: averageOrNull(scoredRows.map((row) => getPrimaryMetricValue(row))),
    tutorFirstTurnScore: averageOrNull(latestRows.map((row) => row.tutorFirstTurnScore)),
    tutorOverallScore: averageOrNull(latestRows.map((row) => row.tutorOverallScore)),
    tutorHolisticOverallScore: averageOrNull(latestRows.map((row) => row.tutorHolisticOverallScore)),
    learnerHolisticOverallScore: averageOrNull(latestRows.map((row) => row.learnerHolisticOverallScore)),
    dialogueQualityScore: averageOrNull(latestRows.map((row) => row.dialogueQualityScore)),
    latencyMs: averageOrNull(latestRows.map((row) => row.latencyMs)),
    inputTokens: averageOrNull(latestRows.map((row) => row.inputTokens)),
    outputTokens: averageOrNull(latestRows.map((row) => row.outputTokens)),
    cost: averageOrNull(latestRows.map((row) => row.cost)),
    judgeModel: joinUnique(latestRows.map((row) => row.judgeModel)),
    evaluationReasoning: latestRow.evaluationReasoning ?? null,
    scoringMethod: latestRow.scoringMethod ?? null,
    errorMessage: failedRows.length > 0 ? failedRows[failedRows.length - 1].errorMessage ?? null : null,
    dialogueId: latestRows.length === 1 ? latestRow.dialogueId ?? null : null,
    promptContentHash: uniqueOrNull(latestRows.map((row) => row.promptContentHash)),
    tutorEgoPromptVersion: uniqueOrNull(latestRows.map((row) => row.tutorEgoPromptVersion)),
    tutorSuperegoPromptVersion: uniqueOrNull(latestRows.map((row) => row.tutorSuperegoPromptVersion)),
    learnerPromptVersion: uniqueOrNull(latestRows.map((row) => row.learnerPromptVersion)),
    totalRuns: latestRows.length,
    scoredRuns: scoredRows.length,
    failedRuns: failedRows.length,
  };
}

function summarizeRun(runId, profileName, scenarioId) {
  const results = getRunRows(runId, profileName, scenarioId);

  if (results.length > 0) {
    return aggregateRunRows(results);
  }

  const stat = evaluationStore.getRunStats(runId).find((entry) => entry.profileName === profileName);
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
    evaluationReasoning: null,
    scoringMethod: null,
    errorMessage: stat?.lastErrorMessage || scenarioStat?.lastErrorMessage || 'No stored result row found',
    dialogueId: null,
    promptContentHash: null,
    tutorEgoPromptVersion: null,
    tutorSuperegoPromptVersion: null,
    learnerPromptVersion: null,
    totalRuns: 0,
    scoredRuns: 0,
    failedRuns: 0,
  };
}

function refreshSessionSummaries(session) {
  let changed = false;

  for (const iteration of session.iterations || []) {
    if (!iteration.runId) continue;
    const updatedSummary = summarizeRun(iteration.runId, session.profileName, session.scenarioId);
    if (JSON.stringify(iteration.summary || null) !== JSON.stringify(updatedSummary)) {
      iteration.summary = updatedSummary;
      changed = true;
    }
  }

  return changed;
}

function parseJsonResponse(text) {
  const raw = String(text || '').trim();
  if (!raw) throw new Error('Empty structured response');

  const sources = [];
  const fencedMatches = [...raw.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)];
  for (const match of fencedMatches) {
    if (match[1]?.trim()) sources.push(match[1].trim());
  }
  sources.push(raw);

  const candidates = [];
  const seen = new Set();

  const pushCandidate = (value) => {
    const candidate = String(value || '').trim();
    if (!candidate || seen.has(candidate)) return;
    seen.add(candidate);
    candidates.push(candidate);
  };

  const extractBalancedObjects = (value) => {
    const found = [];
    let depth = 0;
    let start = -1;
    let inString = false;
    let escaped = false;

    for (let i = 0; i < value.length; i++) {
      const ch = value[i];

      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\' && inString) {
        escaped = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;

      if (ch === '{') {
        if (depth === 0) start = i;
        depth += 1;
      } else if (ch === '}') {
        if (depth === 0) continue;
        depth -= 1;
        if (depth === 0 && start !== -1) {
          found.push(value.slice(start, i + 1));
          start = -1;
        }
      }
    }

    return found;
  };

  const extractObjectFromStart = (value, start) => {
    if (start < 0 || start >= value.length || value[start] !== '{') return null;
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = start; i < value.length; i++) {
      const ch = value[i];

      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\' && inString) {
        escaped = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;

      if (ch === '{') {
        depth += 1;
      } else if (ch === '}') {
        depth -= 1;
        if (depth === 0) {
          return value.slice(start, i + 1);
        }
        if (depth < 0) return null;
      }
    }

    return null;
  };

  const extractTrailingObjects = (value, maxCandidates = 50) => {
    const found = [];
    let cursor = value.length;

    while (cursor > 0 && found.length < maxCandidates) {
      const start = value.lastIndexOf('{', cursor - 1);
      if (start === -1) break;

      const candidate = extractObjectFromStart(value, start);
      if (candidate) found.push(candidate);
      cursor = start;
    }

    return found;
  };

  for (const source of sources) {
    pushCandidate(source);
    for (const objectCandidate of extractBalancedObjects(source)) {
      pushCandidate(objectCandidate);
    }
  }
  for (const objectCandidate of extractTrailingObjects(raw)) {
    pushCandidate(objectCandidate);
  }

  const parsedCandidates = [];
  const errors = [];

  const placeholderRegexes = [
    /\bshort paragraph\b/i,
    /\bobservation 1\b/i,
    /\bspecific edit 1\b/i,
    /\bexpected effect 1\b/i,
    /\bwhy this file changes\b/i,
    /\bFULL FILE CONTENT\b/i,
  ];

  const scoreCandidate = (parsed) => {
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return -1000;

    let score = 0;

    const summary = typeof parsed.summary === 'string' ? parsed.summary.trim() : '';
    if (summary) score += 3;
    else if ('summary' in parsed) score -= 1;

    const observations = Array.isArray(parsed.observations) ? parsed.observations : [];
    const expectedEffects = Array.isArray(parsed.expected_effects) ? parsed.expected_effects : [];
    score += Math.min(observations.length, 4);
    score += Math.min(expectedEffects.length, 4);

    const updates = Array.isArray(parsed.prompt_updates) ? parsed.prompt_updates : [];
    const edits = Array.isArray(parsed.prompt_edits) ? parsed.prompt_edits : [];

    if (updates.length > 0) {
      score += 8 + updates.length;
      for (const update of updates) {
        if (typeof update?.filename === 'string' && update.filename.endsWith('.md')) score += 2;
        const rationale = typeof update?.rationale === 'string' ? update.rationale.trim() : '';
        if (rationale && !/why this file changes/i.test(rationale)) score += 1;
        const changes = Array.isArray(update?.changes) ? update.changes.filter(Boolean) : [];
        score += Math.min(changes.length, 3);
        const content = typeof update?.content === 'string' ? update.content.trim() : '';
        if (content.length > 200) score += 4;
        else if (content.length > 0) score += 1;
      }
    }

    if (edits.length > 0) {
      score += 6 + edits.length;
    }

    if (updates.length === 0 && edits.length === 0) score -= 4;

    const rawText = JSON.stringify(parsed);
    for (const regex of placeholderRegexes) {
      if (regex.test(rawText)) score -= 5;
    }

    return score;
  };

  for (let index = 0; index < candidates.length; index++) {
    const candidate = candidates[index];
    let parsed = null;

    try {
      parsed = JSON.parse(candidate);
    } catch (error) {
      errors.push(`JSON.parse: ${error.message}`);
    }

    if (parsed == null) {
      try {
        parsed = JSON.parse(jsonrepair(candidate));
      } catch (error) {
        errors.push(`jsonrepair: ${error.message}`);
      }
    }

    if (parsed != null) {
      parsedCandidates.push({
        parsed,
        score: scoreCandidate(parsed),
        index,
      });
    }
  }

  if (parsedCandidates.length > 0) {
    parsedCandidates.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.index - a.index;
    });
    return parsedCandidates[0].parsed;
  }

  const preview = raw.slice(0, 300).replace(/\s+/g, ' ');
  throw new Error(
    `Could not parse recommender response as JSON. Tried ${candidates.length} candidate(s). ${errors[errors.length - 1] || ''} Raw preview: ${preview}`,
  );
}

function writeRawRecommenderResponse(sessionId, recommendationId, rawText, suffix = 'parse-error') {
  ensureDir(recommendationsDir(sessionId));
  const debugPath = path.join(recommendationsDir(sessionId), `${recommendationId}-${suffix}.txt`);
  fs.writeFileSync(debugPath, rawText, 'utf8');
  return debugPath;
}

function resolveRecommenderConfig(options = {}) {
  const {
    modelRefOverride = null,
    cliOverride = null,
    cliModelOverride = null,
  } = options;
  const rubric = evalConfigLoader.loadRubric();
  const configured = rubric?.recommender || {};
  const temperature = configured.hyperparameters?.temperature ?? 0.4;
  const maxTokens = configured.hyperparameters?.max_tokens ?? 6000;

  if (modelRefOverride && cliOverride) {
    throw new Error('Use either a provider recommender (--recommender) or a CLI recommender (--recommender-cli), not both.');
  }

  if (cliOverride) {
    return {
      mode: 'cli',
      cli: normalizeCliName(cliOverride),
      modelRef: formatCliLabel(cliOverride, cliModelOverride || null),
      provider: null,
      model: cliModelOverride || null,
      hyperparameters: {
        temperature,
        maxTokens,
      },
    };
  }

  if (modelRefOverride) {
    const resolved = evalConfigLoader.resolveModel(modelRefOverride);
    return {
      mode: 'provider',
      modelRef: modelRefOverride,
      provider: resolved.provider,
      model: resolved.model,
      hyperparameters: {
        temperature,
        maxTokens,
      },
    };
  }

  return {
    mode: 'cli',
    cli: DEFAULT_RECOMMENDER_CLI,
    modelRef: formatCliLabel(DEFAULT_RECOMMENDER_CLI),
    provider: null,
    model: null,
    hyperparameters: {
      temperature,
      maxTokens,
    },
  };
}

async function callStructuredCliJson(prompt, cliName, modelOverride = null) {
  const cli = normalizeCliName(cliName);
  let cliBinary;
  let cliArgs;
  let cliEnv;

  if (cli === 'gemini') {
    cliBinary = 'gemini';
    cliArgs = ['-o', 'text'];
    if (modelOverride) cliArgs.push('-m', modelOverride);
    cliEnv = { ...process.env };
  } else if (cli === 'codex') {
    cliBinary = 'codex';
    cliArgs = ['exec', '-'];
    if (modelOverride) cliArgs.push('-m', modelOverride);
    cliEnv = { ...process.env };
  } else {
    cliBinary = 'claude';
    cliArgs = ['-p', '-', '--output-format', 'text'];
    if (modelOverride) cliArgs.push('--model', modelOverride);
    cliEnv = { ...process.env };
    delete cliEnv.ANTHROPIC_API_KEY;
    delete cliEnv.CLAUDECODE;
  }

  const rawText = await new Promise((resolve, reject) => {
    const child = spawn(cliBinary, cliArgs, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: cliEnv,
    });
    let out = '';
    let err = '';
    child.stdout.on('data', (chunk) => {
      out += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      err += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) reject(new Error(err || out || `${cliBinary} exited with code ${code}`));
      else resolve(out);
    });
    child.stdin.write(prompt);
    child.stdin.end();
  });

  try {
    return {
      rawText,
      parsed: parseJsonResponse(rawText),
      usage: null,
    };
  } catch (error) {
    error.rawText = rawText;
    throw error;
  }
}

async function callRecommenderJson(systemPrompt, userPrompt, options = {}) {
  const config = resolveRecommenderConfig(options);

  if (config.mode === 'cli') {
    const combinedPrompt = `${systemPrompt}\n\n${userPrompt}\n\nReturn JSON only.`;
    try {
      const response = await callStructuredCliJson(combinedPrompt, config.cli, config.model);
      return {
        parsed: response.parsed,
        rawText: response.rawText,
        recommenderRef: config.modelRef,
        recommenderModel: config.model || 'auto',
        usage: response.usage,
      };
    } catch (error) {
      const wrapped = new Error(`Could not parse recommender output as JSON: ${error.message}`);
      wrapped.rawText = error.rawText || '';
      wrapped.recommenderRef = config.modelRef;
      wrapped.recommenderModel = config.model || 'auto';
      throw wrapped;
    }
  }

  const response = await unifiedAIProvider.call({
    provider: config.provider,
    model: config.model,
    systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
    config: {
      temperature: config.hyperparameters.temperature,
      maxTokens: config.hyperparameters.maxTokens,
    },
  });

  const rawText = response.content || '';
  try {
    return {
      parsed: parseJsonResponse(rawText),
      rawText,
      recommenderRef: config.modelRef,
      recommenderModel: response.model || config.model,
      usage: response.usage || null,
    };
  } catch (error) {
    const wrapped = new Error(`Could not parse recommender output as JSON: ${error.message}`);
    wrapped.rawText = rawText;
    wrapped.recommenderRef = config.modelRef;
    wrapped.recommenderModel = response.model || config.model;
    throw wrapped;
  }
}

function createMockRecommendation(session, basisIteration, promptState, recommenderRef, allowedPrompts) {
  const firstPrompt = allowedPrompts[0];
  if (!firstPrompt) {
    throw new Error('No prompt files available for the selected target scope.');
  }
  return {
    parsed: {
      summary: 'Dry-run recommendation placeholder. No prompt changes were synthesized from a live recommender.',
      observations: [
        `Use ${basisIteration ? `iteration ${basisIteration.iteration}` : 'the current working prompts'} as the live basis when running without --dry-run.`,
      ],
      prompt_updates: [
        {
          filename: firstPrompt.filename,
          rationale: 'Dry-run placeholder recommendation.',
          changes: ['No-op rewrite to exercise the prompt-lab pipeline.'],
          content: promptState[firstPrompt.filename].content,
        },
      ],
      expected_effects: ['No score change expected in dry-run mode.'],
    },
    rawText: '',
    recommenderRef: recommenderRef || resolveRecommenderConfig().modelRef,
    recommenderModel: 'dry-run-placeholder',
    usage: null,
  };
}

function buildStructuralInventory(promptState, allowedPrompts) {
  const inventories = [];
  for (const prompt of allowedPrompts) {
    const content = promptState[prompt.filename]?.content || '';
    if (!content.trim()) continue;
    const headings = extractMarkdownHeadings(content);
    const tags = [...analyzeSectionTags(content).tagNames];
    if (headings.length === 0 && tags.length === 0) continue;
    const parts = [`### ${prompt.filename}`];
    if (headings.length > 0) {
      parts.push('Required headings (must appear verbatim in output):');
      parts.push(...headings.map((h) => `- \`${h}\``));
    }
    if (tags.length > 0) {
      parts.push('Required XML section tags (must appear as matched open/close pairs):');
      parts.push(...tags.map((t) => `- <${t}>...</${t}>`));
    }
    inventories.push(parts.join('\n'));
  }
  return inventories.length > 0
    ? `\nStructural inventory — EVERY item below MUST be preserved in your output:\n\n${inventories.join('\n\n')}\n`
    : '';
}

function buildRecommendationPrompt(session, basisIteration, basisResults, promptState, allowedPrompts, targetScope) {
  const analysis = promptRecommendationService.analyzeResults(basisResults);
  const scenario = evalConfigLoader.getScenario(session.scenarioId);
  const basisSummary = basisIteration?.summary || null;
  const latestRow = basisResults[basisResults.length - 1] || null;
  const structuralInventory = buildStructuralInventory(promptState, allowedPrompts);
  const promptSections = allowedPrompts
    .map((prompt) => {
      const state = promptState[prompt.filename];
      return `## ${prompt.filename}

\`\`\`markdown
${state.content}
\`\`\``;
    })
    .join('\n\n');

  const resultSections = basisResults
    .map((row, index) => {
      const suggestion = row.suggestions?.[0];
      return `### Result ${index + 1}
- success: ${row.success}
- tutor_first_turn_score: ${row.tutorFirstTurnScore ?? 'null'}
- tutor_holistic_overall_score: ${row.tutorHolisticOverallScore ?? 'null'}
- learner_holistic_overall_score: ${row.learnerHolisticOverallScore ?? 'null'}
- dialogue_quality_score: ${row.dialogueQualityScore ?? 'null'}
- judge_model: ${row.judgeModel || 'n/a'}
- evaluation_reasoning: ${row.evaluationReasoning || 'n/a'}
- error_message: ${row.errorMessage || 'n/a'}
- suggestion_title: ${suggestion?.title || 'n/a'}
- suggestion_message: ${suggestion?.message || 'n/a'}`;
    })
    .join('\n\n');

  return {
    systemPrompt: `You are a rigorous prompt engineer optimizing a fixed tutoring benchmark. Output JSON only. Do not wrap your answer in markdown fences.

Rules:
- Only modify prompt files listed in allowed_filenames.
- Return FULL replacement file contents for changed files only.
- Make minimal, targeted edits grounded in the benchmark evidence.
- CRITICAL: Preserve ALL markdown headings, XML section tags, and document structure from the original file. Your output will be rejected if any heading or tag is missing.
- Never introduce visible chain-of-thought, [INTERNAL]/[EXTERNAL], or <think> output requirements.
- Aim to improve the target metric without making the learner or tutor generic, repetitive, or role-leaky.
${structuralInventory}
Return JSON with exactly this shape:
{
  "summary": "short paragraph",
  "observations": ["observation 1", "observation 2"],
  "prompt_updates": [
    {
      "filename": "tutor-ego.md",
      "rationale": "why this file changes",
      "changes": ["specific edit 1", "specific edit 2"],
      "content": "FULL FILE CONTENT"
    }
  ],
  "expected_effects": ["expected effect 1", "expected effect 2"]
}`,
    userPrompt: `Optimize this prompt-lab session.

Session:
- session_id: ${session.sessionId}
- eval_profile: ${session.profileName}
- scenario_id: ${session.scenarioId}
- scenario_name: ${scenario?.name || session.scenarioId}
- scenario_description: ${scenario?.description || 'n/a'}
- tutor_model: ${session.modelRef}
- judge_model: ${formatJudgeSelection(session)}
- target_scope: ${targetScope}
- target_metric: tutorFirstTurnScore
- basis_iteration: ${basisIteration?.iteration ?? 'n/a'}
- basis_run_id: ${basisIteration?.runId ?? 'n/a'}
- basis_score: ${basisSummary?.primaryScore ?? 'n/a'}
- basis_reasoning: ${basisSummary?.evaluationReasoning || basisSummary?.errorMessage || 'n/a'}
- avg_score_across_basis_results: ${analysis.avgScore.toFixed(1)}

Weak dimensions:
${Object.entries(analysis.dimensionWeaknesses || {})
  .map(([dim, data]) => `- ${dim}: ${data.avgScore.toFixed(2)}/5`)
  .join('\n') || '- none detected'}

Allowed filenames:
${allowedPrompts.map((prompt) => `- ${prompt.filename}`).join('\n')}

Current working prompt files:
${promptSections}

Benchmark evidence:
${resultSections || '- no stored result rows found'}

Generate concrete prompt revisions. Return JSON only.`,
    analysis,
  };
}

function buildCompactRecommendationEditPrompt(session, basisIteration, basisResults, promptState, allowedPrompts, targetScope) {
  const full = buildRecommendationPrompt(session, basisIteration, basisResults, promptState, allowedPrompts, targetScope);
  const structuralInventory = buildStructuralInventory(promptState, allowedPrompts);
  return {
    ...full,
    systemPrompt: `You are a rigorous prompt engineer optimizing a fixed tutoring benchmark. Output JSON only. Do not wrap your answer in markdown fences.

Rules:
- Only modify prompt files listed in allowed_filenames.
- Keep output compact: DO NOT return full file contents.
- Return only minimal edit operations against the CURRENT working prompt files.
- Every anchor/find string must match the current file content exactly once.
- Use at most 4 operations total.
- Make minimal, targeted edits grounded in the benchmark evidence.
- CRITICAL: Do NOT delete or rename any markdown headings or XML section tags. Your edits must preserve document structure.
- Never introduce visible chain-of-thought, [INTERNAL]/[EXTERNAL], or <think> output requirements.
${structuralInventory}

Allowed operation types:
- replace: replace one exact snippet with another
- insert_after: insert text immediately after one exact anchor snippet
- insert_before: insert text immediately before one exact anchor snippet

Return JSON with exactly this shape:
{
  "summary": "short paragraph",
  "observations": ["observation 1", "observation 2"],
  "prompt_edits": [
    {
      "filename": "tutor-ego.md",
      "rationale": "why this file changes",
      "changes": ["specific edit 1", "specific edit 2"],
      "operations": [
        {
          "type": "replace",
          "find": "EXACT EXISTING TEXT",
          "replace": "NEW TEXT"
        }
      ]
    }
  ],
  "expected_effects": ["expected effect 1", "expected effect 2"]
}`,
  };
}

function buildStrictCompactRecommendationEditPrompt(
  session,
  basisIteration,
  basisResults,
  promptState,
  allowedPrompts,
  targetScope,
) {
  const compact = buildCompactRecommendationEditPrompt(
    session,
    basisIteration,
    basisResults,
    promptState,
    allowedPrompts,
    targetScope,
  );

  return {
    ...compact,
    systemPrompt: `${compact.systemPrompt}

STRICT RETRY RULES (apply-operation failure recovery):
- Use ONLY "replace" operations (no insert_after / insert_before).
- Each "find" string MUST be copied verbatim from the current file content.
- Each "find" string MUST match exactly once in the current file.
- Prefer 1-2 high-impact replacements; avoid broad rewrites.
- If you cannot provide safe exact matches, return "prompt_edits": [].
- Return JSON only.`,
  };
}

function normalizeRecommendation(session, payload, allowedPromptFiles) {
  const parsed = payload.parsed || {};
  const allowed = new Set(allowedPromptFiles.map((prompt) => prompt.filename));
  const updates = Array.isArray(parsed.prompt_updates) ? parsed.prompt_updates : [];

  const promptUpdates = updates
    .filter((update) => allowed.has(update.filename))
    .map((update) => ({
      filename: update.filename,
      rationale: String(update.rationale || '').trim(),
      changes: Array.isArray(update.changes) ? update.changes.map((item) => String(item).trim()).filter(Boolean) : [],
      content: normalizePromptContent(update.content || ''),
    }))
    .filter((update) => update.content.trim().length > 0);

  return {
    summary: String(parsed.summary || '').trim(),
    observations: Array.isArray(parsed.observations)
      ? parsed.observations.map((item) => String(item).trim()).filter(Boolean)
      : [],
    promptUpdates,
    expectedEffects: Array.isArray(parsed.expected_effects)
      ? parsed.expected_effects.map((item) => String(item).trim()).filter(Boolean)
      : [],
  };
}

function countOccurrences(haystack, needle) {
  if (!needle) return 0;
  let count = 0;
  let start = 0;
  while (true) {
    const idx = haystack.indexOf(needle, start);
    if (idx === -1) break;
    count += 1;
    start = idx + needle.length;
  }
  return count;
}

function applyPromptEditOperations(baseContent, operations, filename) {
  let content = normalizePromptContent(baseContent);
  const normalizedOps = Array.isArray(operations) ? operations : [];

  for (const op of normalizedOps) {
    const type = String(op?.type || '').trim();
    if (type === 'replace') {
      const find = String(op?.find || '');
      const replace = String(op?.replace || '');
      const matches = countOccurrences(content, find);
      if (matches !== 1) {
        throw new Error(`${filename}: replace operation expected 1 exact match for find text, got ${matches}`);
      }
      content = content.replace(find, replace);
      continue;
    }

    if (type === 'insert_after') {
      const anchor = String(op?.anchor ?? op?.find ?? '');
      const text = String(op?.text ?? op?.replace ?? '');
      const matches = countOccurrences(content, anchor);
      if (matches !== 1) {
        throw new Error(`${filename}: insert_after expected 1 exact anchor match, got ${matches}`);
      }
      content = content.replace(anchor, `${anchor}${text}`);
      continue;
    }

    if (type === 'insert_before') {
      const anchor = String(op?.anchor ?? op?.find ?? '');
      const text = String(op?.text ?? op?.replace ?? '');
      const matches = countOccurrences(content, anchor);
      if (matches !== 1) {
        throw new Error(`${filename}: insert_before expected 1 exact anchor match, got ${matches}`);
      }
      content = content.replace(anchor, `${text}${anchor}`);
      continue;
    }

    throw new Error(`${filename}: unsupported edit operation type "${type}"`);
  }

  return normalizePromptContent(content);
}

function normalizeCompactRecommendation(session, promptState, payload, allowedPromptFiles) {
  const parsed = payload.parsed || {};
  const allowed = new Set(allowedPromptFiles.map((prompt) => prompt.filename));
  const edits = Array.isArray(parsed.prompt_edits) ? parsed.prompt_edits : [];

  const promptUpdates = edits
    .filter((edit) => allowed.has(edit.filename))
    .map((edit) => {
      const filename = String(edit.filename || '').trim();
      const baseContent = promptState[filename]?.content || '';
      const content = applyPromptEditOperations(baseContent, edit.operations, filename);
      return {
        filename,
        rationale: String(edit.rationale || '').trim(),
        changes: Array.isArray(edit.changes) ? edit.changes.map((item) => String(item).trim()).filter(Boolean) : [],
        content,
      };
    })
    .filter((update) => update.content.trim().length > 0);

  return {
    summary: String(parsed.summary || '').trim(),
    observations: Array.isArray(parsed.observations)
      ? parsed.observations.map((item) => String(item).trim()).filter(Boolean)
      : [],
    promptUpdates,
    expectedEffects: Array.isArray(parsed.expected_effects)
      ? parsed.expected_effects.map((item) => String(item).trim()).filter(Boolean)
      : [],
  };
}

function validateRecommendationPromptUpdates(session, promptState, normalized) {
  const validations = normalized.promptUpdates.map((update) => {
    const prompt = session.promptFiles.find((item) => item.filename === update.filename);
    const referenceContent = promptState[update.filename]?.content || '';
    return validatePromptCandidate(prompt || { filename: update.filename }, update.content, referenceContent);
  });

  const invalid = validations.filter((item) => !item.ok);
  return { validations, invalid };
}

function attemptRecommendationRecovery(session, promptState, normalized, validation) {
  const repairedUpdates = [];
  const recoveryNotes = [];
  let changed = false;

  for (const update of normalized.promptUpdates) {
    const prompt = session.promptFiles.find((item) => item.filename === update.filename) || { filename: update.filename };
    const referenceContent = promptState[update.filename]?.content || '';
    const currentValidation = validation.validations.find((item) => item.filename === update.filename);

    if (!currentValidation || currentValidation.ok) {
      repairedUpdates.push(update);
      continue;
    }

    const recoverableIssues = getRecoverableValidationIssues(currentValidation.issues);
    if (recoverableIssues.length === 0) {
      repairedUpdates.push(update);
      continue;
    }

    const repaired = recoverPromptCandidate(prompt, update.content, referenceContent);
    if (repaired.applied) {
      changed = true;
      recoveryNotes.push(`${update.filename}: ${repaired.notes.join('; ')}`);
      repairedUpdates.push({
        ...update,
        content: repaired.content,
      });
    } else {
      repairedUpdates.push(update);
    }
  }

  if (!changed) {
    return {
      changed: false,
      normalized,
      validation,
      notes: [],
    };
  }

  const repairedNormalized = {
    ...normalized,
    promptUpdates: repairedUpdates,
  };
  const repairedValidation = validateRecommendationPromptUpdates(session, promptState, repairedNormalized);
  return {
    changed: true,
    normalized: repairedNormalized,
    validation: repairedValidation,
    notes: recoveryNotes,
  };
}

function saveRecommendationArtifact(session, artifact) {
  ensureDir(recommendationsDir(session.sessionId));
  writeJson(recommendationFile(session.sessionId, artifact.id), artifact);
}

function updateRecommendationMeta(session, recommendationId, patch) {
  const idx = (session.recommendations || []).findIndex((item) => item.id === recommendationId);
  if (idx === -1) return;
  session.recommendations[idx] = {
    ...session.recommendations[idx],
    ...patch,
  };
}

async function generateRecommendation(session, options = {}) {
  const {
    basis = 'best',
    recommenderRef = null,
    recommenderCli = null,
    recommenderCliModel = null,
    dryRun = false,
    apply = false,
    targetScope = 'both',
  } = options;

  const allowedPrompts = selectPromptFilesByTarget(session, targetScope);
  if (allowedPrompts.length === 0) {
    throw new Error(`No prompts available for target scope "${targetScope}" in session ${session.sessionId}.`);
  }

  const basisIteration = resolveIterationSpec(session, basis);
  if (!basisIteration) {
    throw new Error('No scored iteration found to analyze. Run a scored iteration first.');
  }

  const basisResults = getRunRows(basisIteration.runId, session.profileName, basisIteration.scenarioId || session.scenarioId);
  const promptState = readPromptState(session.promptDir, session.promptFiles);
  const promptRequest = buildRecommendationPrompt(
    session,
    basisIteration,
    basisResults,
    promptState,
    allowedPrompts,
    targetScope,
  );
  const compactPromptRequest = buildCompactRecommendationEditPrompt(
    session,
    basisIteration,
    basisResults,
    promptState,
    allowedPrompts,
    targetScope,
  );
  const strictCompactPromptRequest = buildStrictCompactRecommendationEditPrompt(
    session,
    basisIteration,
    basisResults,
    promptState,
    allowedPrompts,
    targetScope,
  );
  const recommenderConfig = resolveRecommenderConfig({
    modelRefOverride: recommenderRef,
    cliOverride: recommenderCli,
    cliModelOverride: recommenderCliModel,
  });
  const recommendationId = `reco-${String((session.recommendations?.length || 0) + 1).padStart(3, '0')}-${timestampTag()}`;

  let payload;
  let responseFormat = 'full-content';
  let fallback = {
    attempted: false,
    succeeded: false,
    format: null,
    reason: null,
    rawParseErrorPath: null,
  };

  if (dryRun) {
    payload = createMockRecommendation(session, basisIteration, promptState, recommenderConfig.modelRef, allowedPrompts);
  } else {
    try {
      payload = await callRecommenderJson(promptRequest.systemPrompt, promptRequest.userPrompt, {
        modelRefOverride: recommenderRef,
        cliOverride: recommenderCli,
        cliModelOverride: recommenderCliModel,
      });
    } catch (error) {
      if (!error.message.includes('Could not parse recommender output as JSON')) {
        if (error.rawText) {
          const debugPath = writeRawRecommenderResponse(session.sessionId, recommendationId, error.rawText);
          throw new Error(`${error.message}. Raw response saved to ${debugPath}`);
        }
        throw error;
      }

      fallback.attempted = true;
      fallback.format = 'compact-edits';
      fallback.reason = error.message;
      if (error.rawText) {
        fallback.rawParseErrorPath = writeRawRecommenderResponse(session.sessionId, recommendationId, error.rawText);
      }

      try {
        payload = await callRecommenderJson(compactPromptRequest.systemPrompt, compactPromptRequest.userPrompt, {
          modelRefOverride: recommenderRef,
          cliOverride: recommenderCli,
          cliModelOverride: recommenderCliModel,
        });
        fallback.succeeded = true;
        responseFormat = 'compact-edits';
      } catch (fallbackError) {
        if (fallbackError.rawText) {
          const compactPath = writeRawRecommenderResponse(
            session.sessionId,
            recommendationId,
            fallbackError.rawText,
            'compact-parse-error',
          );
          throw new Error(
            `${error.message}. Fallback compact edit response also failed: ${fallbackError.message}. Raw responses saved to ${fallback.rawParseErrorPath || 'n/a'} and ${compactPath}`,
          );
        }
        throw new Error(
          `${error.message}. Fallback compact edit response also failed: ${fallbackError.message}${fallback.rawParseErrorPath ? `. Raw response saved to ${fallback.rawParseErrorPath}` : ''}`,
        );
      }
    }
  }

  const evaluateRecommendationOutput = (candidateNormalized) => {
    let candidateValidation = validateRecommendationPromptUpdates(session, promptState, candidateNormalized);
    let candidateRecovery = {
      changed: false,
      normalized: candidateNormalized,
      validation: candidateValidation,
      notes: [],
    };

    if (candidateValidation.invalid.length > 0) {
      candidateRecovery = attemptRecommendationRecovery(session, promptState, candidateNormalized, candidateValidation);
      candidateValidation = candidateRecovery.validation;
    }

    return {
      normalized: candidateRecovery.normalized,
      validation: candidateValidation,
      recovery: candidateRecovery,
    };
  };

  let normalized =
    responseFormat === 'compact-edits'
      ? normalizeCompactRecommendation(session, promptState, payload, allowedPrompts)
      : normalizeRecommendation(session, payload, allowedPrompts);
  let { validation, recovery } = evaluateRecommendationOutput(normalized);
  normalized = recovery.normalized;

  // If full-content rewrites fail structural validation, retry with compact edits.
  // This avoids aborting autotune when the recommender omits sections in full-file mode.
  if (validation.invalid.length > 0 && !dryRun && responseFormat !== 'compact-edits') {
    const fullValidationDetails = validation.invalid
      .map((item) => `${item.filename}: ${item.issues.join('; ')}`)
      .join(' | ');
    fallback.attempted = true;
    fallback.format = 'compact-edits';
    fallback.reason = `full-content failed validation: ${fullValidationDetails}`;
    if (!fallback.rawParseErrorPath && payload?.rawText) {
      fallback.rawParseErrorPath = writeRawRecommenderResponse(
        session.sessionId,
        recommendationId,
        payload.rawText,
        'full-validation-fail',
      );
    }

    // Augment compact prompts with the specific validation failures so the LLM can avoid repeating them
    const validationHint = `\n\nPREVIOUS ATTEMPT FAILED VALIDATION:\n${fullValidationDetails}\nDo NOT remove or rename any headings or XML tags. Make only targeted content edits within existing sections.`;
    const augmentedCompactSystem = compactPromptRequest.systemPrompt + validationHint;
    const augmentedStrictSystem = strictCompactPromptRequest.systemPrompt + validationHint;

    try {
      payload = await callRecommenderJson(augmentedCompactSystem, compactPromptRequest.userPrompt, {
        modelRefOverride: recommenderRef,
        cliOverride: recommenderCli,
        cliModelOverride: recommenderCliModel,
      });
      responseFormat = 'compact-edits';
      fallback.succeeded = true;

      normalized = normalizeCompactRecommendation(session, promptState, payload, allowedPrompts);
      ({ validation, recovery } = evaluateRecommendationOutput(normalized));
      normalized = recovery.normalized;
    } catch (fallbackError) {
      const isCompactApplyMismatch =
        !fallbackError.rawText &&
        /expected 1 exact (anchor|match)/i.test(String(fallbackError.message || ''));
      let strictRetryRecovered = false;

      if (isCompactApplyMismatch) {
        const applyErrorPath =
          payload?.rawText && responseFormat === 'compact-edits'
            ? writeRawRecommenderResponse(session.sessionId, recommendationId, payload.rawText, 'compact-apply-error')
            : null;

        try {
          const strictPayload = await callRecommenderJson(
            augmentedStrictSystem,
            strictCompactPromptRequest.userPrompt,
            {
              modelRefOverride: recommenderRef,
              cliOverride: recommenderCli,
              cliModelOverride: recommenderCliModel,
            },
          );

          payload = strictPayload;
          responseFormat = 'compact-edits';
          fallback.succeeded = true;
          fallback.reason = `${fallback.reason}; compact apply mismatch retry`;

          normalized = normalizeCompactRecommendation(session, promptState, payload, allowedPrompts);
          ({ validation, recovery } = evaluateRecommendationOutput(normalized));
          normalized = recovery.normalized;
          strictRetryRecovered = true;
        } catch (strictRetryError) {
          if (strictRetryError.rawText) {
            const strictPath = writeRawRecommenderResponse(
              session.sessionId,
              recommendationId,
              strictRetryError.rawText,
              'compact-strict-retry-error',
            );
            throw new Error(
              `Recommendation ${recommendationId} failed full-content validation (${fullValidationDetails}). Compact edit fallback failed to apply operations (${fallbackError.message}). Strict compact retry also failed: ${strictRetryError.message}. Raw responses saved to ${fallback.rawParseErrorPath || 'n/a'}, ${applyErrorPath || 'n/a'}, and ${strictPath}`,
            );
          }
          throw new Error(
            `Recommendation ${recommendationId} failed full-content validation (${fullValidationDetails}). Compact edit fallback failed to apply operations (${fallbackError.message}). Strict compact retry also failed: ${strictRetryError.message}${fallback.rawParseErrorPath ? `. Raw response saved to ${fallback.rawParseErrorPath}` : ''}${applyErrorPath ? `. Compact apply response saved to ${applyErrorPath}` : ''}`,
          );
        }
      }

      if (strictRetryRecovered) {
        // Recovered by strict compact retry; continue without throwing.
      } else if (fallbackError.rawText) {
        const compactPath = writeRawRecommenderResponse(
          session.sessionId,
          recommendationId,
          fallbackError.rawText,
          'compact-validation-fallback-error',
        );
        throw new Error(
          `Recommendation ${recommendationId} failed full-content validation (${fullValidationDetails}). Compact edit fallback also failed: ${fallbackError.message}. Raw responses saved to ${fallback.rawParseErrorPath || 'n/a'} and ${compactPath}`,
        );
      } else {
        throw new Error(
          `Recommendation ${recommendationId} failed full-content validation (${fullValidationDetails}). Compact edit fallback also failed: ${fallbackError.message}${fallback.rawParseErrorPath ? `. Raw response saved to ${fallback.rawParseErrorPath}` : ''}`,
        );
      }
    }
  }

  const changedFiles = normalized.promptUpdates.filter((update) => {
    const current = promptState[update.filename]?.content || '';
    return normalizePromptContent(current) !== normalizePromptContent(update.content);
  });

  const artifact = {
    id: recommendationId,
    createdAt: new Date().toISOString(),
    basedOnIteration: basisIteration.iteration,
    basedOnRunId: basisIteration.runId,
    basedOnScore: basisIteration.summary?.primaryScore ?? null,
    recommenderRef: payload.recommenderRef,
    recommenderModel: payload.recommenderModel,
    targetScope,
    responseFormat,
    fallback,
    usage: payload.usage,
    dryRun,
    summary: normalized.summary,
    observations: normalized.observations,
    expectedEffects: normalized.expectedEffects,
    recovery: {
      attempted: recovery.changed,
      applied: recovery.changed && recovery.validation.invalid.length === 0,
      notes: recovery.notes,
    },
    promptUpdates: normalized.promptUpdates.map((update) => ({
      filename: update.filename,
      rationale: update.rationale,
      changes: update.changes,
      contentHash: sha16(update.content),
      content: update.content,
    })),
    changedFiles: changedFiles.map((update) => update.filename),
    promptValidation: validation.validations,
    rawResponse: payload.rawText,
  };

  saveRecommendationArtifact(session, artifact);
  session.recommendations = session.recommendations || [];
  session.recommendations.push({
    id: artifact.id,
    createdAt: artifact.createdAt,
    basedOnIteration: artifact.basedOnIteration,
    basedOnRunId: artifact.basedOnRunId,
    recommenderRef: artifact.recommenderRef,
    recommenderModel: artifact.recommenderModel,
    targetScope: artifact.targetScope,
    changedFiles: artifact.changedFiles,
    recoveryApplied: artifact.recovery.applied,
    appliedToWorkingDir: false,
    evaluationIteration: null,
      accepted: null,
      artifactPath: recommendationFile(session.sessionId, artifact.id),
      summary: artifact.summary,
      validationPassed: validation.invalid.length === 0,
    });

  if (validation.invalid.length > 0) {
    const details = validation.invalid
      .map((item) => `${item.filename}: ${item.issues.join('; ')}`)
      .join(' | ');
    saveSession(session);
    const recoveryDetail =
      recovery.changed && recovery.notes.length > 0
        ? ` Recovery attempted: ${recovery.notes.join(' | ')}.`
        : '';
    throw new Error(
      `Recommendation ${artifact.id} failed prompt validation and was not applied: ${details}.${recoveryDetail} Artifact: ${recommendationFile(session.sessionId, artifact.id)}`,
    );
  }

  if (apply) {
    applyRecommendationToWorkingPrompts(session, artifact);
  }

  saveSession(session);
  return artifact;
}

function applyRecommendationToWorkingPrompts(session, artifact) {
  const updates = artifact.promptUpdates || [];
  for (const update of updates) {
    const destination = path.join(session.promptDir, update.filename);
    fs.writeFileSync(destination, normalizePromptContent(update.content), 'utf8');
  }

  updateRecommendationMeta(session, artifact.id, {
    appliedToWorkingDir: true,
    appliedAt: new Date().toISOString(),
  });
  saveRecommendationArtifact(session, artifact);
}

function restoreWorkingPromptsFromDir(session, sourceDir) {
  copyPromptDir(sourceDir, session.promptDir, session.promptFiles);
}

function resolvePromptDirSpec(session, spec) {
  const effectiveSpec = spec || 'baseline';
  if (effectiveSpec === 'current') return session.promptDir;
  if (effectiveSpec === 'baseline') return session.baselineDir;
  if (effectiveSpec === 'latest') {
    const latest = getLatestIteration(session);
    if (!latest) throw new Error('No iterations available.');
    return path.join(latest.snapshotDir, 'prompts');
  }
  if (effectiveSpec === 'best') {
    const best = getBestScoredIteration(session);
    if (!best) throw new Error('No scored iterations available.');
    return path.join(best.snapshotDir, 'prompts');
  }

  const numeric = parseInt(effectiveSpec, 10);
  if (Number.isFinite(numeric)) {
    const iteration = getIterationByNumber(session, numeric);
    if (!iteration) throw new Error(`Iteration not found: ${numeric}`);
    return path.join(iteration.snapshotDir, 'prompts');
  }

  throw new Error(`Unknown prompt diff spec: ${effectiveSpec}`);
}

function runNoIndexDiff(oldPath, newPath) {
  const diff = spawnSync('git', ['--no-pager', 'diff', '--no-index', '--', oldPath, newPath], {
    encoding: 'utf8',
    maxBuffer: 4 * 1024 * 1024,
  });

  if (diff.status === 0) return '';
  if (diff.status === 1) return diff.stdout || '';

  const err = diff.stderr?.trim() || diff.stdout?.trim() || `git diff failed with status ${diff.status}`;
  throw new Error(err);
}

function printPromptFiles(session) {
  console.log(`Session: ${session.sessionId}`);
  if (session.forkedFrom?.sessionId) {
    const sourceLabel =
      session.forkedFrom.sourceIteration != null
        ? `${session.forkedFrom.sessionId} (${session.forkedFrom.fromSpec} -> iter ${session.forkedFrom.sourceIteration})`
        : `${session.forkedFrom.sessionId} (${session.forkedFrom.fromSpec})`;
    console.log(`Forked from: ${sourceLabel}`);
  }
  console.log(`Prompt override dir: ${session.promptDir}`);
  console.log(`Baseline prompt dir: ${session.baselineDir}`);
  console.log(`Profile: ${session.profileName}`);
  console.log(`Scenario: ${session.scenarioId}`);
  console.log(`Model: ${session.modelRef}`);
  console.log(`Judge: ${formatJudgeSelection(session)}`);
  console.log(`Tutor runtime profile: ${session.resolvedTutorProfileName}`);
  console.log(`Learner profile: ${session.learnerProfileName}`);
  console.log('');
  console.log('Editable prompt files:');
  for (const prompt of session.promptFiles) {
    console.log(`  ${prompt.kind}.${prompt.role} -> ${path.join(session.promptDir, prompt.filename)}`);
  }
}

function formatDelta(value) {
  if (value == null) return 'n/a';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}`;
}

function formatDuration(ms) {
  if (ms == null) return 'n/a';
  if (ms < 1000) return `${ms}ms`;

  const totalSeconds = ms / 1000;
  if (totalSeconds < 60) return `${totalSeconds.toFixed(1)}s`;

  const totalMinutes = Math.floor(totalSeconds / 60);
  const seconds = Math.round(totalSeconds % 60);
  if (totalMinutes < 60) return `${totalMinutes}m ${String(seconds).padStart(2, '0')}s`;

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
}

function parsePositiveIntOption(value, fallback) {
  const parsed = parseInt(String(value ?? fallback), 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error(`Expected a positive integer, received: ${value}`);
  }
  return parsed;
}

function printAutotuneSessionSummary(session, options = {}) {
  const { rounds, basisMode, recommenderLabel, keepWorse, dryRun, targetScope, judgeSelection = session } = options;
  console.log('Autotune session');
  console.log(`  Session: ${session.sessionId}`);
  console.log(`  Profile: ${session.profileName}`);
  console.log(`  Scenario: ${session.scenarioId}`);
  console.log(`  Tutor model: ${session.modelRef}`);
  console.log(`  Judge: ${formatJudgeSelection(judgeSelection)}`);
  console.log(`  Recommender: ${recommenderLabel || resolveRecommenderConfig().modelRef}`);
  console.log(`  Basis selection: ${basisMode}`);
  console.log(`  Target scope: ${targetScope}`);
  console.log(`  Planned passes: ${rounds}`);
  console.log(`  Runs per iteration: ${session.runsPerIteration || DEFAULT_RUNS_PER_ITERATION}`);
  console.log(`  Parallelism: ${session.parallelism || 1}`);
  console.log(`  Keep regressions: ${keepWorse ? 'yes' : 'no'}`);
  console.log('  Flow: recommend -> apply -> evaluate -> accept/revert');
  if (dryRun) console.log('  Mode: dry-run');
  console.log(`  Working prompts: ${session.promptDir}`);
}

function printIterationTable(session) {
  const runs = session.iterations || [];
  if (runs.length === 0) {
    console.log('\nNo iterations recorded yet.');
    return;
  }

  console.log('\nIterations:');
  console.log('  #  Src  Mode  Keep  Score      n  ΔPrev  ΔBest  Latency   Run ID');
  console.log('  ' + '─'.repeat(99));
  for (const run of runs) {
    const summary = run.summary || {};
    const latency =
      summary.latencyMs == null
        ? '--'
        : summary.latencyMs >= 1000
          ? `${(summary.latencyMs / 1000).toFixed(1)}s`
          : `${summary.latencyMs}ms`;
    const score = summary.primaryScore == null ? '--' : summary.primaryScore.toFixed(1);
    const deltaPrev =
      run.comparison?.deltaVsPrevious == null ? '--' : formatDelta(run.comparison.deltaVsPrevious);
    const deltaBest =
      run.comparison?.deltaVsBestBefore == null ? '--' : formatDelta(run.comparison.deltaVsBestBefore);
    const source = run.origin === 'autotune' ? 'A' : run.origin === 'baseline' ? 'B' : 'M';
    const mode = run.dryRun ? 'mock' : 'live';
    const keep = run.accepted == null ? '--' : run.accepted ? 'yes' : run.revertedToIteration ? 'revert' : 'no';
    const n =
      summary.totalRuns != null
        ? `${summary.scoredRuns ?? summary.totalRuns}/${summary.totalRuns}`
        : '--';
    console.log(
      `  ${String(run.iteration).padStart(2)}  ${source.padStart(3)}  ${mode.padStart(4)}  ${keep.padStart(6)}  ${score.padStart(5)}  ${n.padStart(6)}  ${deltaPrev.padStart(6)}  ${deltaBest.padStart(6)}  ${latency.padStart(7)}   ${run.runId}`,
    );
  }
}

function printRecommendationTable(session) {
  const items = session.recommendations || [];
  if (items.length === 0) {
    console.log('\nNo recommendations recorded yet.');
    return;
  }

  console.log('\nRecommendations:');
  console.log('  ID                          Basis  Scope    Files                          Valid  Repair  Applied  Eval  Accepted');
  console.log('  ' + '─'.repeat(124));
  for (const item of items) {
    const files = (item.changedFiles || []).join(', ') || 'none';
    console.log(
      `  ${item.id.padEnd(26)}  ${String(item.basedOnIteration).padStart(5)}  ${(item.targetScope || 'both').padEnd(7)}  ${files.slice(0, 28).padEnd(28)}  ${(item.validationPassed == null ? '--' : item.validationPassed ? 'yes' : 'no').padStart(5)}  ${String(Boolean(item.recoveryApplied)).padStart(6)}  ${String(Boolean(item.appliedToWorkingDir)).padStart(7)}  ${(item.evaluationIteration ?? '--').toString().padStart(4)}  ${(item.accepted == null ? '--' : item.accepted ? 'yes' : 'no').padStart(8)}`,
    );
  }
}

function printRecommendationSummary(artifact, options = {}) {
  const { compact = false, artifactPath = null } = options;
  const changedFiles = artifact.changedFiles || artifact.promptUpdates?.map((update) => update.filename) || [];

  console.log(`\nRecommendation: ${artifact.id}`);
  console.log(`  Recommender: ${artifact.recommenderRef}`);
  console.log(`  Model: ${artifact.recommenderModel}`);
  if (artifact.basedOnIteration != null) {
    console.log(`  Basis iteration: ${artifact.basedOnIteration} (score ${artifact.basedOnScore ?? 'n/a'})`);
  }
  console.log(`  Target scope: ${artifact.targetScope || 'both'}`);
  console.log(`  Changed files: ${changedFiles.length ? changedFiles.join(', ') : 'none'}`);
  if (artifact.responseFormat && artifact.responseFormat !== 'full-content') {
    console.log(`  Response format: ${artifact.responseFormat}`);
  }
  if (artifact.fallback?.succeeded) {
    console.log('  Fallback: compact edit retry succeeded');
  } else if (artifact.fallback?.attempted) {
    console.log('  Fallback: attempted');
  }
  if (artifact.recovery?.applied) {
    console.log('  Structural recovery: applied');
  } else if (artifact.recovery?.attempted) {
    console.log('  Structural recovery: attempted but validation still failed');
  }
  if (artifact.summary) {
    console.log(`  Summary: ${artifact.summary}`);
  }
  if (artifact.promptUpdates?.length) {
    console.log('  Prompt updates:');
    for (const update of artifact.promptUpdates) {
      console.log(`    - ${update.filename}: ${update.rationale || 'no rationale provided'}`);
    }
  }
  if (!compact && artifact.observations?.length) {
    console.log('  Observations:');
    for (const observation of artifact.observations) {
      console.log(`    - ${observation}`);
    }
  }
  if (!compact && artifact.expectedEffects?.length) {
    console.log('  Expected effects:');
    for (const effect of artifact.expectedEffects) {
      console.log(`    - ${effect}`);
    }
  }
  if (artifactPath) {
    console.log(`  Artifact: ${artifactPath}`);
  }
}

async function runSessionIteration(session, options = {}) {
  const judgeWasOverridden = options.judgeRef != null || options.judgeCli != null || options.judgeCliModel != null;
  const judgeSelection = parseJudgeSelection(
    {
      judgeRef: options.judgeRef,
      judgeCli: options.judgeCli,
      judgeCliModel: options.judgeCliModel,
    },
    session,
  );
  const {
    scenarioId = session.scenarioId,
    modelRef = session.modelRef,
    parallelism = session.parallelism || 1,
    runs = session.runsPerIteration || DEFAULT_RUNS_PER_ITERATION,
    notes = null,
    useRubric = !hasFlag('skip-rubric'),
    dryRun = hasFlag('dry-run'),
    origin = 'manual',
    recommendationId = null,
  } = options;

  const history = session.iterations || [];
  const iteration = history.length + 1;
  const snapshotDir = path.join(snapshotsDir(session.sessionId), `${String(iteration).padStart(3, '0')}-${timestampTag()}`);
  const snapshotPromptDir = path.join(snapshotDir, 'prompts');

  ensureDir(snapshotPromptDir);
  copyPromptDir(session.promptDir, snapshotPromptDir, session.promptFiles);

  const description = `Prompt Lab ${session.sessionId} iter ${iteration}`;
  const childArgs = [
    CLI_PATH,
    'run',
    '--profile',
    session.profileName,
    '--scenario',
    scenarioId,
    '--runs',
    String(runs),
    '--parallelism',
    String(parallelism),
    '--model',
    modelRef,
    '--description',
    description,
    useRubric ? '--use-rubric' : '--skip-rubric',
  ];

  if (useRubric) {
    if (judgeSelection.judgeRef) {
      childArgs.push('--judge', judgeSelection.judgeRef);
    } else if (judgeSelection.judgeCli) {
      childArgs.push('--judge-cli', judgeSelection.judgeCli);
      if (judgeSelection.judgeCliModel) childArgs.push('--judge-cli-model', judgeSelection.judgeCliModel);
    }
  }

  if (dryRun) childArgs.push('--dry-run');
  if (hasFlag('verbose')) childArgs.push('--verbose');
  if (hasFlag('live')) childArgs.push('--live');
  if (hasFlag('show-messages')) childArgs.push('--show-messages');

  console.log(`\nEvaluation run`);
  console.log(`  Iteration: ${iteration}`);
  console.log(`  Scenario: ${scenarioId}`);
  console.log(`  Tutor model: ${modelRef}`);
  if (useRubric) console.log(`  Judge: ${formatJudgeSelection(judgeSelection)}`);
  console.log(`  Runs: ${runs}`);
  console.log(`  Parallelism: ${parallelism}`);
  console.log(`  Prompt override dir: ${session.promptDir}`);
  console.log(`  Prompt files: ${session.promptFiles.map((prompt) => prompt.filename).join(', ')}`);
  console.log('  Note: eval-cli may still print its generic factorial banner; prompt-lab is running one fixed profile/scenario here.');
  console.log('  Launching eval-cli...\n');
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
  const previous = getLatestIteration(session);
  const baseline = getBaselineScoredIteration(session);
  const bestBefore = getBestScoredIteration(session);
  const promptHashes = getPromptHashesFromDir(session.promptDir, session.promptFiles);

  const entry = {
    iteration,
    createdAt: new Date().toISOString(),
    runId,
    scenarioId,
    modelRef,
    judgeRef: judgeSelection.judgeRef,
    judgeCli: judgeSelection.judgeCli,
    judgeCliModel: judgeSelection.judgeCliModel,
    usedRubric: useRubric,
    dryRun,
    notes,
    origin,
    recommendationId,
    snapshotDir,
    promptHashes,
    summary,
    comparison: {
      previousIteration: previous?.iteration ?? null,
      deltaVsPrevious:
        previous?.summary?.primaryScore != null && summary.primaryScore != null
          ? summary.primaryScore - previous.summary.primaryScore
          : null,
      baselineIteration: baseline?.iteration ?? null,
      deltaVsBaseline:
        baseline?.summary?.primaryScore != null && summary.primaryScore != null
          ? summary.primaryScore - baseline.summary.primaryScore
          : null,
      bestBeforeIteration: bestBefore?.iteration ?? null,
      deltaVsBestBefore:
        bestBefore?.summary?.primaryScore != null && summary.primaryScore != null
          ? summary.primaryScore - bestBefore.summary.primaryScore
          : null,
    },
    accepted: null,
    revertedToIteration: null,
  };

  session.scenarioId = scenarioId;
  session.modelRef = modelRef;
  session.judgeRef = judgeSelection.judgeRef;
  session.judgeCli = judgeSelection.judgeCli;
  session.judgeCliModel = judgeSelection.judgeCliModel;
  if (judgeWasOverridden) session.judgeSource = 'explicit';
  session.parallelism = parallelism;
  session.runsPerIteration = runs;
  session.iterations = [...history, entry];
  saveSession(session);

  console.log('\nIteration summary');
  console.log(`  Run ID: ${runId}`);
  if (useRubric) console.log(`  Judge: ${formatJudgeSelection(judgeSelection)}`);
  console.log(`  Primary metric (${summary.metricName}): ${summary.primaryScore == null ? 'n/a' : summary.primaryScore.toFixed(1)}`);
  if (summary.totalRuns > 1) {
    console.log(`  Replications: ${summary.scoredRuns}/${summary.totalRuns} scored`);
  }
  if (useRubric && summary.primaryScore == null) {
    console.log('  Judge result: no usable score was recorded for this run');
    if (summary.scoringMethod) {
      console.log(`  Scoring method: ${summary.scoringMethod}`);
    }
  }
  if (entry.comparison.deltaVsBaseline != null) {
    console.log(`  Delta vs baseline: ${formatDelta(entry.comparison.deltaVsBaseline)}`);
  }
  if (entry.comparison.deltaVsBestBefore != null) {
    console.log(`  Delta vs best prior: ${formatDelta(entry.comparison.deltaVsBestBefore)}`);
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

  return entry;
}

async function handleInit() {
  const profileName = getOption('profile', 'cell_80_messages_base_single_unified');
  const scenarioId = getOption('scenario', 'mood_frustration_to_breakthrough');
  const modelRef = getOption('model', 'lmstudio.qwen3.5-9b');
  const judgeSelection = parseJudgeSelection({
    judgeRef: getOption('judge', null),
    judgeCli: getOption('judge-cli', null),
    judgeCliModel: getOption('judge-cli-model', null),
  });
  const sessionId = getOption('session') || defaultSessionId(profileName, scenarioId, modelRef);
  const force = hasFlag('force');

  const dir = sessionDir(sessionId);
  if (fs.existsSync(dir) && !force) {
    throw new Error(`Session already exists: ${sessionId}. Use --force to overwrite it.`);
  }

  const blueprint = collectPromptBlueprints(profileName);
  fs.rmSync(dir, { recursive: true, force: true });
  ensureDir(dir);
  ensureDir(path.join(dir, 'prompts'));
  ensureDir(baselinePromptsDir(sessionId));
  ensureDir(recommendationsDir(sessionId));
  ensureDir(snapshotsDir(sessionId));

  for (const prompt of blueprint.promptFiles) {
    copyPromptFile(path.join(dir, 'prompts'), prompt.filename, prompt.sourcePath);
    copyPromptFile(baselinePromptsDir(sessionId), prompt.filename, prompt.sourcePath);
  }

  const session = {
    sessionId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    profileName,
    scenarioId,
    modelRef,
    judgeRef: judgeSelection.judgeRef,
    judgeCli: judgeSelection.judgeCli,
    judgeCliModel: judgeSelection.judgeCliModel,
    judgeSource: inferJudgeSourceFromCliArgs(),
    parallelism: parseInt(getOption('parallelism', '1'), 10),
    runsPerIteration: parsePositiveIntOption(getOption('runs', String(DEFAULT_RUNS_PER_ITERATION)), DEFAULT_RUNS_PER_ITERATION),
    promptDir: path.join(dir, 'prompts'),
    baselineDir: baselinePromptsDir(sessionId),
    resolvedTutorProfileName: blueprint.resolvedTutorProfileName,
    learnerProfileName: blueprint.learnerProfileName,
    promptFiles: blueprint.promptFiles,
    iterations: [],
    recommendations: [],
  };

  saveSession(session);
  printPromptFiles(session);
  console.log('\nNext steps:');
  console.log(`  1. Edit the prompt files in ${session.promptDir}`);
  console.log(`  2. Run: node scripts/prompt-lab.js run --session ${sessionId}`);
  console.log(`  3. Or ask for a model rewrite: node scripts/prompt-lab.js recommend --session ${sessionId}`);
}

async function handleFork() {
  const sourceSession = loadSession(resolveSessionId());
  const fromSpec = getOption('from', 'current');
  const resolvedIteration = ['current', 'baseline'].includes(fromSpec) ? null : resolveIterationSpec(sourceSession, fromSpec);
  const defaultForkName = slugify(`${sourceSession.sessionId}-${fromSpec}-${timestampTag()}`);
  const sessionId = getOption('new-session', defaultForkName);
  const force = hasFlag('force');

  const sourcePromptDir = resolvePromptDirSpec(sourceSession, fromSpec);
  const dir = sessionDir(sessionId);
  if (fs.existsSync(dir) && !force) {
    throw new Error(`Session already exists: ${sessionId}. Use --force to overwrite it.`);
  }

  fs.rmSync(dir, { recursive: true, force: true });
  ensureDir(dir);
  ensureDir(path.join(dir, 'prompts'));
  ensureDir(baselinePromptsDir(sessionId));
  ensureDir(recommendationsDir(sessionId));
  ensureDir(snapshotsDir(sessionId));

  copyPromptDir(sourcePromptDir, path.join(dir, 'prompts'), sourceSession.promptFiles);
  copyPromptDir(sourcePromptDir, baselinePromptsDir(sessionId), sourceSession.promptFiles);

  const judgeSelection = parseJudgeSelection(
    {
      judgeRef: getOption('judge', null),
      judgeCli: getOption('judge-cli', null),
      judgeCliModel: getOption('judge-cli-model', null),
    },
    sourceSession,
  );

  const session = {
    sessionId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    profileName: sourceSession.profileName,
    scenarioId: getOption('scenario', sourceSession.scenarioId),
    modelRef: getOption('model', sourceSession.modelRef),
    judgeRef: judgeSelection.judgeRef,
    judgeCli: judgeSelection.judgeCli,
    judgeCliModel: judgeSelection.judgeCliModel,
    judgeSource: inferJudgeSourceFromCliArgs() === 'explicit' ? 'explicit' : sourceSession.judgeSource || 'default',
    parallelism: parseInt(getOption('parallelism', String(sourceSession.parallelism || 1)), 10),
    runsPerIteration: parsePositiveIntOption(
      getOption('runs', String(sourceSession.runsPerIteration || DEFAULT_RUNS_PER_ITERATION)),
      sourceSession.runsPerIteration || DEFAULT_RUNS_PER_ITERATION,
    ),
    promptDir: path.join(dir, 'prompts'),
    baselineDir: baselinePromptsDir(sessionId),
    resolvedTutorProfileName: sourceSession.resolvedTutorProfileName,
    learnerProfileName: sourceSession.learnerProfileName,
    promptFiles: sourceSession.promptFiles,
    iterations: [],
    recommendations: [],
    forkedFrom: {
      sessionId: sourceSession.sessionId,
      fromSpec,
      sourceIteration: resolvedIteration?.iteration ?? null,
      sourceRunId: resolvedIteration?.runId ?? null,
      sourcePromptDir,
    },
  };

  saveSession(session);
  printPromptFiles(session);
  console.log('\nNext steps:');
  console.log(`  1. Score the fork baseline: node scripts/prompt-lab.js run --session ${sessionId}`);
  console.log(`  2. Or branch-autotune immediately: node scripts/prompt-lab.js autotune --session ${sessionId}`);
}

async function handleRun() {
  const session = loadSession(resolveSessionId());
  await runSessionIteration(session, {
    scenarioId: getOption('scenario', session.scenarioId),
    modelRef: getOption('model', session.modelRef),
    judgeRef: getOption('judge', null),
    judgeCli: getOption('judge-cli', null),
    judgeCliModel: getOption('judge-cli-model', null),
    parallelism: parseInt(getOption('parallelism', String(session.parallelism || 1)), 10),
    runs: parsePositiveIntOption(
      getOption('runs', String(session.runsPerIteration || DEFAULT_RUNS_PER_ITERATION)),
      session.runsPerIteration || DEFAULT_RUNS_PER_ITERATION,
    ),
    notes: getOption('notes', null),
    useRubric: !hasFlag('skip-rubric'),
    dryRun: hasFlag('dry-run'),
    origin: 'manual',
  });
}

async function handleRecommend() {
  const session = loadSession(resolveSessionId());
  const targetScope = normalizeTargetScope(getOption('target', 'both'));
  const artifact = await generateRecommendation(session, {
    basis: getOption('basis', 'best'),
    recommenderRef: getOption('recommender', null),
    recommenderCli: getOption('recommender-cli', null),
    recommenderCliModel: getOption('recommender-cli-model', null),
    dryRun: hasFlag('dry-run'),
    apply: hasFlag('apply'),
    targetScope,
  });

  printRecommendationSummary(artifact, {
    artifactPath: recommendationFile(session.sessionId, artifact.id),
  });
  if (hasFlag('apply')) {
    console.log(`  Applied recommendation to: ${session.promptDir}`);
    console.log(`  Evaluate it with: node scripts/prompt-lab.js run --session ${session.sessionId}`);
  }
}

async function handleAutotune() {
  const session = loadSession(resolveSessionId());
  const rounds = parseInt(getOption('iterations', String(DEFAULT_AUTOTUNE_ITERATIONS)), 10);
  const basisMode = getOption('basis', 'best');
  const recommenderRef = getOption('recommender', null);
  const recommenderCli = getOption('recommender-cli', null);
  const recommenderCliModel = getOption('recommender-cli-model', null);
  const dryRun = hasFlag('dry-run');
  const keepWorse = hasFlag('keep-worse');
  const targetScope = normalizeTargetScope(getOption('target', 'both'));
  const runsPerIteration = parsePositiveIntOption(
    getOption('runs', String(session.runsPerIteration || DEFAULT_RUNS_PER_ITERATION)),
    session.runsPerIteration || DEFAULT_RUNS_PER_ITERATION,
  );
  const judgeSelection = parseJudgeSelection(
    {
      judgeRef: getOption('judge', null),
      judgeCli: getOption('judge-cli', null),
      judgeCliModel: getOption('judge-cli-model', null),
    },
    session,
  );

  console.log('');
  printAutotuneSessionSummary({ ...session, runsPerIteration }, {
    rounds,
    basisMode,
    recommenderLabel: resolveRecommenderConfig({
      modelRefOverride: recommenderRef,
      cliOverride: recommenderCli,
      cliModelOverride: recommenderCliModel,
    }).modelRef,
    keepWorse,
    dryRun,
    targetScope,
    judgeSelection,
  });

  if (!getBestScoredIteration(session)) {
    console.log('\nNo scored baseline iteration found. Running a baseline iteration first.\n');
    const baselineEntry = await runSessionIteration(session, {
      scenarioId: session.scenarioId,
      modelRef: session.modelRef,
      judgeRef: judgeSelection.judgeRef,
      judgeCli: judgeSelection.judgeCli,
      judgeCliModel: judgeSelection.judgeCliModel,
      parallelism: session.parallelism || 1,
      runs: runsPerIteration,
      notes: 'autotune baseline',
      useRubric: true,
      dryRun,
      origin: 'baseline',
    });
    baselineEntry.accepted = true;
    saveSession(session);
  }

  for (let pass = 1; pass <= rounds; pass++) {
    const refreshed = loadSession(session.sessionId);
    const basisIteration = resolveIterationSpec(refreshed, basisMode);
    if (!basisIteration) {
      throw new Error('Autotune requires at least one scored iteration.');
    }
    if (basisIteration.summary?.primaryScore == null) {
      throw new Error(
        `Autotune requires a scored basis iteration. Iteration ${basisIteration.iteration} (${basisIteration.runId}) has no usable judge score.`,
      );
    }

    console.log(`\nAutotune pass ${pass}/${rounds}`);
    console.log(`  Basis iteration: ${basisIteration.iteration} (${basisIteration.summary?.primaryScore ?? 'n/a'})`);
    console.log('  Step 1/4: Request prompt recommendation');
    console.log(
      `    Recommender: ${resolveRecommenderConfig({
        modelRefOverride: recommenderRef,
        cliOverride: recommenderCli,
        cliModelOverride: recommenderCliModel,
      }).modelRef}`,
    );
    console.log(`    Basis run: ${basisIteration.runId}`);
    const recommendationStartedAt = Date.now();

    const artifact = await generateRecommendation(refreshed, {
      basis: basisMode,
      recommenderRef,
      recommenderCli,
      recommenderCliModel,
      dryRun,
      apply: false,
      targetScope,
    });
    console.log(`    Completed in ${formatDuration(Date.now() - recommendationStartedAt)}`);
    printRecommendationSummary(artifact, {
      compact: true,
      artifactPath: recommendationFile(refreshed.sessionId, artifact.id),
    });

    if ((artifact.promptUpdates || []).length === 0) {
      console.log('  No prompt updates proposed. Stopping autotune.');
      break;
    }

    console.log('  Step 2/4: Apply candidate prompt updates');
    applyRecommendationToWorkingPrompts(refreshed, artifact);
    saveSession(refreshed);
    console.log(`    Applied ${artifact.changedFiles?.length || artifact.promptUpdates?.length || 0} file(s) to ${refreshed.promptDir}`);

    const bestBefore = getBestScoredIteration(refreshed);
    console.log('  Step 3/4: Run benchmark iteration');
    const evaluationStartedAt = Date.now();
    const entry = await runSessionIteration(refreshed, {
      scenarioId: refreshed.scenarioId,
      modelRef: refreshed.modelRef,
      judgeRef: judgeSelection.judgeRef,
      judgeCli: judgeSelection.judgeCli,
      judgeCliModel: judgeSelection.judgeCliModel,
      parallelism: refreshed.parallelism || 1,
      runs: runsPerIteration,
      notes: `autotune pass ${pass} via ${artifact.id}`,
      useRubric: true,
      dryRun,
      origin: 'autotune',
      recommendationId: artifact.id,
    });
    console.log(`  Step 3/4 complete in ${formatDuration(Date.now() - evaluationStartedAt)}`);

    const latestSession = loadSession(refreshed.sessionId);
    const latestEntry = getIterationByNumber(latestSession, entry.iteration);
    const accepted =
      latestEntry?.summary?.primaryScore != null &&
      (bestBefore?.summary?.primaryScore == null || latestEntry.summary.primaryScore >= bestBefore.summary.primaryScore);

    if (latestEntry) {
      latestEntry.accepted = accepted;
      latestEntry.comparison = {
        ...latestEntry.comparison,
        basisIteration: basisIteration.iteration,
        deltaVsBasis:
          latestEntry.summary?.primaryScore != null && basisIteration.summary?.primaryScore != null
            ? latestEntry.summary.primaryScore - basisIteration.summary.primaryScore
            : null,
      };
    }

    updateRecommendationMeta(latestSession, artifact.id, {
      evaluationIteration: latestEntry?.iteration ?? null,
      evaluationRunId: latestEntry?.runId ?? null,
      accepted,
    });

    console.log('  Step 4/4: Compare against best prior');
    if (latestEntry?.summary?.primaryScore != null) {
      console.log(`    Candidate score: ${latestEntry.summary.primaryScore.toFixed(1)}`);
    } else {
      console.log('    Candidate score: n/a');
    }
    if (bestBefore?.summary?.primaryScore != null) {
      console.log(`    Best prior score: ${bestBefore.summary.primaryScore.toFixed(1)} (iteration ${bestBefore.iteration})`);
    }
    if (!accepted && !keepWorse && bestBefore) {
      const bestDir = path.join(bestBefore.snapshotDir, 'prompts');
      restoreWorkingPromptsFromDir(latestSession, bestDir);
      if (latestEntry) latestEntry.revertedToIteration = bestBefore.iteration;
      console.log(`    Decision: reverted to iteration ${bestBefore.iteration}`);
    } else if (accepted) {
      console.log('    Decision: accepted');
    } else {
      console.log('    Decision: kept despite regression (--keep-worse)');
    }

    saveSession(latestSession);

    if (latestEntry?.comparison?.deltaVsBestBefore != null) {
      console.log(`    Delta vs best prior: ${formatDelta(latestEntry.comparison.deltaVsBestBefore)}`);
    }
    if (latestEntry?.comparison?.deltaVsBasis != null) {
      console.log(`    Delta vs basis: ${formatDelta(latestEntry.comparison.deltaVsBasis)}`);
    }
  }

  const finished = loadSession(session.sessionId);
  console.log('');
  printIterationTable(finished);
}

async function handleDiff() {
  const session = loadSession(resolveSessionId());
  const fromSpec = getOption('from', 'baseline');
  const toSpec = getOption('to', 'current');
  const fromDir = resolvePromptDirSpec(session, fromSpec);
  const toDir = resolvePromptDirSpec(session, toSpec);

  console.log(`Diff: ${fromSpec} -> ${toSpec}\n`);

  let hadChanges = false;
  for (const prompt of session.promptFiles) {
    const fromPath = path.join(fromDir, prompt.filename);
    const toPath = path.join(toDir, prompt.filename);
    if (!fs.existsSync(fromPath) || !fs.existsSync(toPath)) continue;

    const diffText = runNoIndexDiff(fromPath, toPath);
    if (!diffText.trim()) continue;
    hadChanges = true;
    console.log(diffText.trimEnd());
    console.log('');
  }

  if (!hadChanges) {
    console.log('No prompt differences found.');
  }
}

async function handleStatus() {
  const session = loadSession(resolveSessionId());
  printPromptFiles(session);
  printIterationTable(session);
  printRecommendationTable(session);

  const best = getBestScoredIteration(session);
  if (best) {
    console.log(
      `\nBest score: ${best.summary.primaryScore?.toFixed(1) ?? 'n/a'} (iteration ${best.iteration}, ${best.dryRun ? 'mock' : 'live'})`,
    );
  }
}

async function main() {
  ensureDir(SESSION_ROOT);

  switch (command) {
    case 'init':
      await handleInit();
      return;
    case 'fork':
      await handleFork();
      return;
    case 'run':
      await handleRun();
      return;
    case 'status':
      await handleStatus();
      return;
    case 'recommend':
      await handleRecommend();
      return;
    case 'autotune':
      await handleAutotune();
      return;
    case 'diff':
      await handleDiff();
      return;
    default:
      usage();
  }
}

export {
  aggregateRunRows,
  applyPromptEditOperations,
  analyzeSectionTags,
  appendMissingClosingTags,
  parseJsonResponse,
  recoverPromptCandidate,
  validatePromptCandidate,
};

if (isDirectExecution) {
  main().catch((error) => {
    console.error(`\nError: ${error.message}`);
    process.exit(1);
  });
}
