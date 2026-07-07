#!/usr/bin/env node

import 'dotenv/config';

import { spawn } from 'child_process';
import { createHash } from 'crypto';

import * as evaluationStore from '../services/evaluationStore.js';
import * as evalConfigLoader from '../services/evalConfigLoader.js';
import {
  buildPerTurnTutorEvaluationPrompt,
  calculateBaseScore,
  calculateOverallScore,
  calculateRecognitionScore,
  parseJudgeResponse,
} from '../services/rubricEvaluator.js';

const args = process.argv.slice(2);
const runId = args.find((arg) => !arg.startsWith('--'));

if (!runId) {
  console.error('Usage: node scripts/score-d4-first-turns.js <runId> [--limit N] [--timeout-ms N] [--parallelism N]');
  process.exit(1);
}

function option(name, fallback = null) {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : fallback;
}

const limit = Number(option('limit', 0));
const timeoutMs = Number(option('timeout-ms', 120000));
const parallelism = Math.max(1, Number(option('parallelism', 1)));
const judgeModel = option('model', 'sonnet');
const judgeModelLabel = `claude-code/${judgeModel}`;

const run = evaluationStore.getRun(runId);
if (!run) {
  console.error(`Run not found: ${runId}`);
  process.exit(1);
}

if (run.metadata?.scenariosFile && !process.env.EVAL_SCENARIOS_FILE) {
  process.env.EVAL_SCENARIOS_FILE = run.metadata.scenariosFile;
  console.error(`[d4-first-turn] Restored EVAL_SCENARIOS_FILE: ${run.metadata.scenariosFile}`);
}
if (run.metadata?.contentPath && !process.env.EVAL_CONTENT_PATH) {
  process.env.EVAL_CONTENT_PATH = run.metadata.contentPath;
  console.error(`[d4-first-turn] Restored EVAL_CONTENT_PATH: ${run.metadata.contentPath}`);
}

function firstSuggestion(result, dialogueLog) {
  const firstTurn = Array.isArray(dialogueLog?.turnResults) ? dialogueLog.turnResults[0] : null;
  return firstTurn?.suggestions?.[0] || result.suggestions?.[0] || dialogueLog?.suggestions?.[0] || null;
}

function buildTurnResults(result, dialogueLog) {
  if (Array.isArray(dialogueLog?.turnResults) && dialogueLog.turnResults.length > 0) {
    return dialogueLog.turnResults;
  }

  const suggestion = firstSuggestion(result, dialogueLog);
  if (!suggestion) return [];

  return [
    {
      turnIndex: 0,
      turnId: `${result.dialogueId || result.id}-turn-0`,
      suggestions: [suggestion],
      learnerAction: null,
      learnerMessage: null,
    },
  ];
}

function normalizeScores(parsed) {
  const dimensionMap = {
    pedagogical_soundness: 'pedagogical',
    pedagogical: 'pedagogical',
  };
  const normalized = {};
  for (const [key, value] of Object.entries(parsed.scores || {})) {
    const normalizedKey = dimensionMap[key] || key;
    if (typeof value === 'object' && value !== null) {
      const score = Number(value.score);
      if (Number.isFinite(score)) {
        normalized[normalizedKey] = {
          score,
          reasoning: value.reasoning || null,
        };
      }
    } else {
      const score = Number(value);
      if (Number.isFinite(score)) {
        normalized[normalizedKey] = { score, reasoning: null };
      }
    }
  }
  return normalized;
}

async function callClaude(prompt) {
  return await new Promise((resolve, reject) => {
    const env = { ...process.env };
    delete env.ANTHROPIC_API_KEY;
    delete env.ANTHROPIC_AUTH_TOKEN;
    delete env.CLAUDECODE;
    delete env.CLAUDE_CODE;

    const child = spawn('claude', ['-p', '-', '--output-format', 'text', '--model', judgeModel], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env,
    });

    let out = '';
    let err = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`claude CLI timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      out += chunk;
    });
    child.stderr.on('data', (chunk) => {
      err += chunk;
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(err.trim() || out.trim() || `claude exited with code ${code}`));
      } else {
        resolve(out);
      }
    });
    child.stdin.write(prompt);
    child.stdin.end();
  });
}

async function scoreResult(result, index, total) {
  const scenario = evalConfigLoader.getScenario(result.scenarioId);
  if (!scenario) throw new Error(`scenario not found: ${result.scenarioId}`);

  const dialogueLog = result.dialogueId ? evaluationStore.loadDialogueLog(result.dialogueId) : null;
  const turnResults = buildTurnResults(result, dialogueLog);
  if (turnResults.length === 0) throw new Error('no first-turn suggestion');

  const scenarioContext = {
    name: scenario.name,
    description: scenario.description,
    expectedBehavior: scenario.expected_behavior,
    learnerContext: scenario.learner_context,
    requiredElements: scenario.required_elements,
    forbiddenElements: scenario.forbidden_elements,
  };

  const prompt = buildPerTurnTutorEvaluationPrompt({
    turnResults,
    dialogueTrace: dialogueLog?.dialogueTrace || [],
    targetTurnIndex: 0,
    scenario: scenarioContext,
    learnerContext: dialogueLog?.learnerContext || scenario.learner_context,
  });

  if (!prompt) throw new Error('could not build first-turn prompt');

  const started = Date.now();
  const stdout = await callClaude(prompt);
  const parsed = parseJudgeResponse(stdout);
  const scores = normalizeScores(parsed);
  const tutorFirstTurnScore =
    Object.keys(scores).length > 0 ? calculateOverallScore(scores) : Number(parsed.overall_score);
  if (!Number.isFinite(tutorFirstTurnScore)) {
    throw new Error('judge response did not contain a usable score');
  }

  const baseScore = calculateBaseScore(scores);
  const recognitionScore = calculateRecognitionScore(scores);
  const judgeInputHash = createHash('sha256').update(prompt).digest('hex');
  const summary = parsed.summary || null;
  const judgeLatencyMs = Date.now() - started;

  const turnScore = {
    0: {
      success: true,
      scores,
      overallScore: tutorFirstTurnScore,
      baseScore,
      recognitionScore,
      summary,
      judgeInputHash,
      judgeTimestamp: new Date().toISOString(),
      judgeModel: judgeModelLabel,
    },
  };

  evaluationStore.updateResultTutorScores(result.id, {
    tutorScores: turnScore,
    tutorOverallScore: tutorFirstTurnScore,
    tutorFirstTurnScore,
    tutorLastTurnScore: tutorFirstTurnScore,
    tutorDevelopmentScore: 0,
    judgeModel: judgeModelLabel,
    judgeLatencyMs,
  });

  evaluationStore.updateResultScores(result.id, {
    scores,
    tutorFirstTurnScore,
    baseScore,
    recognitionScore,
    passesRequired: parsed.validation?.passes_required ?? true,
    passesForbidden: parsed.validation?.passes_forbidden ?? true,
    requiredMissing: parsed.validation?.required_missing || [],
    forbiddenFound: parsed.validation?.forbidden_found || [],
    summary,
    judgeModel: judgeModelLabel,
    judgeLatencyMs,
  });

  evaluationStore.updateResultTutorScores(result.id, {
    tutorScores: turnScore,
    tutorOverallScore: tutorFirstTurnScore,
    tutorFirstTurnScore,
    tutorLastTurnScore: tutorFirstTurnScore,
    tutorDevelopmentScore: 0,
  });

  const profile = result.profileName || `${result.provider}/${result.model}`;
  console.log(
    `[${index}/${total}] ${result.scenarioId} / ${profile} / ${result.id} ... ${tutorFirstTurnScore.toFixed(1)}`,
  );
}

async function main() {
  let rows = evaluationStore
    .getResults(runId)
    .filter((row) => row.success && row.tutorFirstTurnScore == null)
    .sort((a, b) => a.id - b.id);

  if (limit > 0) rows = rows.slice(0, limit);

  console.log(
    `[d4-first-turn] Scoring ${rows.length} unscored row(s) for ${runId} with ${judgeModelLabel}, timeout ${timeoutMs}ms, parallelism ${parallelism}`,
  );

  let ok = 0;
  let failed = 0;
  let next = 0;

  async function worker() {
    while (next < rows.length) {
      const index = next;
      next += 1;
      const row = rows[index];
      try {
        await scoreResult(row, index + 1, rows.length);
        ok += 1;
      } catch (error) {
        failed += 1;
        const profile = row.profileName || `${row.provider}/${row.model}`;
        console.error(
          `[${index + 1}/${rows.length}] ${row.scenarioId} / ${profile} / ${row.id} ... FAIL: ${error.message}`,
        );
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(parallelism, rows.length) }, () => worker()));

  console.log(`[d4-first-turn] Done. succeeded=${ok} failed=${failed}`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
