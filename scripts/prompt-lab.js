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
const DEFAULT_JUDGE = 'openrouter.gemini-flash';
const DEFAULT_AUTOTUNE_ITERATIONS = 3;

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
  node scripts/prompt-lab.js recommend [options]
  node scripts/prompt-lab.js autotune [options]
  node scripts/prompt-lab.js diff [options]

Commands:
  init       Create an isolated prompt-override session from an existing eval cell
  run        Run one fixed eval using the session's prompt override directory
  status     Show prompt files, scored iterations, and recommendations for a session
  recommend  Ask a recommender model for prompt revisions based on a scored iteration
  autotune   Generate prompt variants, rerun the benchmark, and keep/revert by score
  diff       Show prompt diffs between baseline/current/iteration snapshots

Shared Options:
  --session <id>         Session name (default: latest for run/status/recommend/autotune/diff)
  --profile <name>       Eval profile (default: cell_80_messages_base_single_unified)
  --scenario <id>        Scenario id (default: mood_frustration_to_breakthrough)
  --model <ref>          Tutor model override (default: lmstudio.qwen3.5-9b)
  --judge <ref>          Rubric judge override (default: openrouter.gemini-flash)
  --parallelism <n>      Eval parallelism for run (default: 1)
  --notes <text>         Free-form note attached to an iteration
  --dry-run              Use eval-cli mock mode; recommender uses a deterministic placeholder

Recommend/Autotune:
  --recommender <ref>    Prompt-rewriter model (default: config/evaluation-rubric.yaml recommender)
  --basis <best|latest|N>
                         Which scored iteration to optimize from (default: best)
  --apply                For recommend: apply the proposed prompt rewrite to the working prompt dir
  --iterations <n>       For autotune: number of recommendation/eval passes (default: 3)
  --keep-worse           For autotune: keep working prompts even if a candidate scores worse

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
  if (!session.judgeRef) {
    session.judgeRef = DEFAULT_JUDGE;
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
  const changed = ensureBaselineSnapshot(session);
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

function summarizeRun(runId, profileName, scenarioId) {
  const results = getRunRows(runId, profileName, scenarioId);

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
      evaluationReasoning: row.evaluationReasoning ?? null,
      errorMessage: row.errorMessage ?? null,
      dialogueId: row.dialogueId ?? null,
      promptContentHash: row.promptContentHash ?? null,
      tutorEgoPromptVersion: row.tutorEgoPromptVersion ?? null,
      tutorSuperegoPromptVersion: row.tutorSuperegoPromptVersion ?? null,
      learnerPromptVersion: row.learnerPromptVersion ?? null,
    };
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
    errorMessage: stat?.lastErrorMessage || scenarioStat?.lastErrorMessage || 'No stored result row found',
    dialogueId: null,
    promptContentHash: null,
    tutorEgoPromptVersion: null,
    tutorSuperegoPromptVersion: null,
    learnerPromptVersion: null,
  };
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

  for (const source of sources) {
    pushCandidate(source);
    for (const objectCandidate of extractBalancedObjects(source)) {
      pushCandidate(objectCandidate);
    }
  }

  const errors = [];
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch (error) {
      errors.push(`JSON.parse: ${error.message}`);
    }

    try {
      return JSON.parse(jsonrepair(candidate));
    } catch (error) {
      errors.push(`jsonrepair: ${error.message}`);
    }
  }

  const preview = raw.slice(0, 300).replace(/\s+/g, ' ');
  throw new Error(
    `Could not parse recommender response as JSON. Tried ${candidates.length} candidate(s). ${errors[errors.length - 1] || ''} Raw preview: ${preview}`,
  );
}

function resolveRecommenderConfig(modelRefOverride = null) {
  const rubric = evalConfigLoader.loadRubric();
  const configured = rubric?.recommender || {};
  const modelRef = modelRefOverride || configured.model || 'openrouter.sonnet';
  const resolved = evalConfigLoader.resolveModel(modelRef);
  const temperature = configured.hyperparameters?.temperature ?? 0.4;
  const maxTokens = configured.hyperparameters?.max_tokens ?? 6000;

  return {
    modelRef,
    provider: resolved.provider,
    model: resolved.model,
    hyperparameters: {
      temperature,
      maxTokens,
    },
  };
}

async function callRecommenderJson(systemPrompt, userPrompt, modelRefOverride = null) {
  const config = resolveRecommenderConfig(modelRefOverride);
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
  let parsed;
  try {
    parsed = parseJsonResponse(rawText);
  } catch (error) {
    const wrapped = new Error(`Could not parse recommender output as JSON: ${error.message}`);
    wrapped.rawText = rawText;
    wrapped.recommenderRef = config.modelRef;
    wrapped.recommenderModel = response.model || config.model;
    throw wrapped;
  }

  return {
    parsed,
    rawText,
    recommenderRef: config.modelRef,
    recommenderModel: response.model || config.model,
    usage: response.usage || null,
  };
}

function createMockRecommendation(session, basisIteration, promptState, recommenderRef) {
  const firstPrompt = session.promptFiles[0];
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

function buildRecommendationPrompt(session, basisIteration, basisResults, promptState) {
  const analysis = promptRecommendationService.analyzeResults(basisResults);
  const scenario = evalConfigLoader.getScenario(session.scenarioId);
  const basisSummary = basisIteration?.summary || null;
  const latestRow = basisResults[basisResults.length - 1] || null;
  const promptSections = session.promptFiles
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
- Preserve each file's role and basic markdown structure.
- Never introduce visible chain-of-thought, [INTERNAL]/[EXTERNAL], or <think> output requirements.
- Aim to improve the target metric without making the learner or tutor generic, repetitive, or role-leaky.

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
- judge_model: ${session.judgeRef || DEFAULT_JUDGE}
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
${session.promptFiles.map((prompt) => `- ${prompt.filename}`).join('\n')}

Current working prompt files:
${promptSections}

Benchmark evidence:
${resultSections || '- no stored result rows found'}

Generate concrete prompt revisions. Return JSON only.`,
    analysis,
  };
}

function normalizeRecommendation(session, payload) {
  const parsed = payload.parsed || {};
  const allowed = new Set(session.promptFiles.map((prompt) => prompt.filename));
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
    dryRun = false,
    apply = false,
  } = options;

  const basisIteration = resolveIterationSpec(session, basis);
  if (!basisIteration) {
    throw new Error('No scored iteration found to analyze. Run a scored iteration first.');
  }

  const basisResults = getRunRows(basisIteration.runId, session.profileName, basisIteration.scenarioId || session.scenarioId);
  const promptState = readPromptState(session.promptDir, session.promptFiles);
  const promptRequest = buildRecommendationPrompt(session, basisIteration, basisResults, promptState);
  const recommendationId = `reco-${String((session.recommendations?.length || 0) + 1).padStart(3, '0')}-${timestampTag()}`;

  const payload = dryRun
    ? createMockRecommendation(session, basisIteration, promptState, recommenderRef)
    : await (async () => {
        try {
          return await callRecommenderJson(promptRequest.systemPrompt, promptRequest.userPrompt, recommenderRef);
        } catch (error) {
          if (error.rawText) {
            ensureDir(recommendationsDir(session.sessionId));
            const debugPath = path.join(recommendationsDir(session.sessionId), `${recommendationId}-parse-error.txt`);
            fs.writeFileSync(debugPath, error.rawText, 'utf8');
            throw new Error(`${error.message}. Raw response saved to ${debugPath}`);
          }
          throw error;
        }
      })();

  const normalized = normalizeRecommendation(session, payload);
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
    usage: payload.usage,
    dryRun,
    summary: normalized.summary,
    observations: normalized.observations,
    expectedEffects: normalized.expectedEffects,
    promptUpdates: normalized.promptUpdates.map((update) => ({
      filename: update.filename,
      rationale: update.rationale,
      changes: update.changes,
      contentHash: sha16(update.content),
      content: update.content,
    })),
    changedFiles: changedFiles.map((update) => update.filename),
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
    changedFiles: artifact.changedFiles,
    appliedToWorkingDir: false,
    evaluationIteration: null,
    accepted: null,
    artifactPath: recommendationFile(session.sessionId, artifact.id),
    summary: artifact.summary,
  });

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
  console.log(`Prompt override dir: ${session.promptDir}`);
  console.log(`Baseline prompt dir: ${session.baselineDir}`);
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

function formatDelta(value) {
  if (value == null) return 'n/a';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}`;
}

function printIterationTable(session) {
  const runs = session.iterations || [];
  if (runs.length === 0) {
    console.log('\nNo iterations recorded yet.');
    return;
  }

  console.log('\nIterations:');
  console.log('  #  Src  Keep  Score   ΔPrev  ΔBest  Latency   Run ID');
  console.log('  ' + '─'.repeat(86));
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
    const keep = run.accepted == null ? '--' : run.accepted ? 'yes' : run.revertedToIteration ? 'revert' : 'no';
    console.log(
      `  ${String(run.iteration).padStart(2)}  ${source.padStart(3)}  ${keep.padStart(6)}  ${score.padStart(5)}  ${deltaPrev.padStart(6)}  ${deltaBest.padStart(6)}  ${latency.padStart(7)}   ${run.runId}`,
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
  console.log('  ID                          Basis  Files                          Applied  Eval  Accepted');
  console.log('  ' + '─'.repeat(98));
  for (const item of items) {
    const files = (item.changedFiles || []).join(', ') || 'none';
    console.log(
      `  ${item.id.padEnd(26)}  ${String(item.basedOnIteration).padStart(5)}  ${files.slice(0, 28).padEnd(28)}  ${String(Boolean(item.appliedToWorkingDir)).padStart(7)}  ${(item.evaluationIteration ?? '--').toString().padStart(4)}  ${(item.accepted == null ? '--' : item.accepted ? 'yes' : 'no').padStart(8)}`,
    );
  }
}

function printRecommendationSummary(artifact) {
  console.log(`\nRecommendation: ${artifact.id}`);
  console.log(`  Recommender: ${artifact.recommenderRef}`);
  console.log(`  Model: ${artifact.recommenderModel}`);
  if (artifact.basedOnIteration != null) {
    console.log(`  Basis iteration: ${artifact.basedOnIteration} (score ${artifact.basedOnScore ?? 'n/a'})`);
  }
  if (artifact.summary) {
    console.log(`  Summary: ${artifact.summary}`);
  }
  if (artifact.observations?.length) {
    console.log('  Observations:');
    for (const observation of artifact.observations) {
      console.log(`    - ${observation}`);
    }
  }
  if (artifact.promptUpdates?.length) {
    console.log('  Prompt updates:');
    for (const update of artifact.promptUpdates) {
      console.log(`    - ${update.filename}: ${update.rationale || 'no rationale provided'}`);
    }
  }
  if (artifact.expectedEffects?.length) {
    console.log('  Expected effects:');
    for (const effect of artifact.expectedEffects) {
      console.log(`    - ${effect}`);
    }
  }
}

async function runSessionIteration(session, options = {}) {
  const {
    scenarioId = session.scenarioId,
    modelRef = session.modelRef,
    judgeRef = session.judgeRef || DEFAULT_JUDGE,
    parallelism = session.parallelism || 1,
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
    judgeRef,
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
  session.judgeRef = judgeRef;
  session.parallelism = parallelism;
  session.iterations = [...history, entry];
  saveSession(session);

  console.log('\nIteration summary');
  console.log(`  Run ID: ${runId}`);
  if (useRubric) console.log(`  Judge: ${judgeRef}`);
  console.log(`  Primary metric (${summary.metricName}): ${summary.primaryScore == null ? 'n/a' : summary.primaryScore.toFixed(1)}`);
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
  const judgeRef = getOption('judge', DEFAULT_JUDGE);
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
    judgeRef,
    parallelism: parseInt(getOption('parallelism', '1'), 10),
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

async function handleRun() {
  const session = loadSession(resolveSessionId());
  await runSessionIteration(session, {
    scenarioId: getOption('scenario', session.scenarioId),
    modelRef: getOption('model', session.modelRef),
    judgeRef: getOption('judge', session.judgeRef || DEFAULT_JUDGE),
    parallelism: parseInt(getOption('parallelism', String(session.parallelism || 1)), 10),
    notes: getOption('notes', null),
    useRubric: !hasFlag('skip-rubric'),
    dryRun: hasFlag('dry-run'),
    origin: 'manual',
  });
}

async function handleRecommend() {
  const session = loadSession(resolveSessionId());
  const artifact = await generateRecommendation(session, {
    basis: getOption('basis', 'best'),
    recommenderRef: getOption('recommender', null),
    dryRun: hasFlag('dry-run'),
    apply: hasFlag('apply'),
  });

  printRecommendationSummary(artifact);
  console.log(`  Artifact: ${recommendationFile(session.sessionId, artifact.id)}`);
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
  const dryRun = hasFlag('dry-run');
  const keepWorse = hasFlag('keep-worse');

  if (!getBestScoredIteration(session)) {
    console.log('\nNo scored baseline iteration found. Running a baseline iteration first.\n');
    const baselineEntry = await runSessionIteration(session, {
      scenarioId: session.scenarioId,
      modelRef: session.modelRef,
      judgeRef: session.judgeRef || DEFAULT_JUDGE,
      parallelism: session.parallelism || 1,
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

    console.log(`\nAutotune pass ${pass}/${rounds}`);
    console.log(`  Basis iteration: ${basisIteration.iteration} (${basisIteration.summary?.primaryScore ?? 'n/a'})`);

    const artifact = await generateRecommendation(refreshed, {
      basis: basisMode,
      recommenderRef,
      dryRun,
      apply: false,
    });
    printRecommendationSummary(artifact);

    if ((artifact.promptUpdates || []).length === 0) {
      console.log('  No prompt updates proposed. Stopping autotune.');
      break;
    }

    applyRecommendationToWorkingPrompts(refreshed, artifact);
    saveSession(refreshed);

    const bestBefore = getBestScoredIteration(refreshed);
    const entry = await runSessionIteration(refreshed, {
      scenarioId: refreshed.scenarioId,
      modelRef: refreshed.modelRef,
      judgeRef: refreshed.judgeRef || DEFAULT_JUDGE,
      parallelism: refreshed.parallelism || 1,
      notes: `autotune pass ${pass} via ${artifact.id}`,
      useRubric: true,
      dryRun,
      origin: 'autotune',
      recommendationId: artifact.id,
    });

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

    if (!accepted && !keepWorse && bestBefore) {
      const bestDir = path.join(bestBefore.snapshotDir, 'prompts');
      restoreWorkingPromptsFromDir(latestSession, bestDir);
      if (latestEntry) latestEntry.revertedToIteration = bestBefore.iteration;
      console.log(`  Candidate regressed. Restored working prompts to iteration ${bestBefore.iteration}.`);
    } else if (accepted) {
      console.log('  Candidate accepted.');
    } else {
      console.log('  Candidate kept despite regression (--keep-worse).');
    }

    saveSession(latestSession);

    if (latestEntry?.comparison?.deltaVsBestBefore != null) {
      console.log(`  Delta vs best prior: ${formatDelta(latestEntry.comparison.deltaVsBestBefore)}`);
    }
    if (latestEntry?.comparison?.deltaVsBasis != null) {
      console.log(`  Delta vs basis: ${formatDelta(latestEntry.comparison.deltaVsBasis)}`);
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
    console.log(`\nBest score: ${best.summary.primaryScore?.toFixed(1) ?? 'n/a'} (iteration ${best.iteration})`);
  }
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

main().catch((error) => {
  console.error(`\nError: ${error.message}`);
  process.exit(1);
});
