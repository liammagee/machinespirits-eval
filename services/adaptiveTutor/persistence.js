// Persistence adapter for the adaptive cell.
//
// Translates the output of runScenario / runScenarioWithCounterfactual
// (services/adaptiveTutor/runner.js) into evaluation_results rows the
// existing analysis pipeline can read.
//
// The deliberation trace — per-turn learnerProfile, tutorInternal, and
// constraint-violation snapshots — is written to logs/tutor-dialogues/
// using the content-addressable convention the rest of the project uses.
// The row carries dialogueId so analyzers can rehydrate it.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import * as evaluationStore from '../evaluationStore.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EVAL_ROOT = path.resolve(__dirname, '..', '..');

// Honour EVAL_LOGS_DIR exactly the way services/evaluationStore.js does, so a
// test that swaps EVAL_DB_PATH + EVAL_LOGS_DIR into a tmp dir gets a fully
// self-contained sandbox.
const logsRoot = () => process.env.EVAL_LOGS_DIR || path.join(EVAL_ROOT, 'logs');
const dialoguesDir = () => path.join(logsRoot(), 'tutor-dialogues');

function ensureLogsDir() {
  const dir = dialoguesDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function makeDialogueId(scenarioId, suffix = '') {
  const rand = Math.random().toString(36).slice(2, 8);
  const safe = String(scenarioId).replace(/[^a-zA-Z0-9_-]/g, '_');
  const tail = suffix ? `_${suffix}` : '';
  return `adaptive-${safe}${tail}-${Date.now()}-${rand}`;
}

// Pull the per-turn deliberation slices out of LangGraph's history snapshots.
// Each snapshot in `history` is one node executing; we group by `turn` and
// collapse to a per-turn record.
function extractTurnTrace(history) {
  const byTurn = new Map();
  for (const snap of history) {
    const v = snap.values;
    if (!v) continue;
    const turn = v.turn;
    if (turn == null) continue;
    const existing = byTurn.get(turn) || {
      turn,
      learnerProfile: null,
      tutorInternal: null,
      constraintViolations: [],
      dialogueLength: 0,
    };
    if (v.learnerProfile && v.learnerProfile.updatedAtTurn === turn) {
      existing.learnerProfile = v.learnerProfile;
    }
    if (v.tutorInternal && (v.tutorInternal.policyAction || v.tutorInternal.egoDraft)) {
      // Keep the latest tutorInternal seen for this turn — node order means
      // the post-revision values will overwrite the initial draft fields.
      existing.tutorInternal = v.tutorInternal;
    }
    if (Array.isArray(v.constraintViolations) && v.constraintViolations.length) {
      existing.constraintViolations = [...new Set([...existing.constraintViolations, ...v.constraintViolations])];
    }
    existing.dialogueLength = Array.isArray(v.dialogue) ? v.dialogue.length : existing.dialogueLength;
    byTurn.set(turn, existing);
  }
  return [...byTurn.values()].sort((a, b) => a.turn - b.turn);
}

function buildTraceJson({ scenario, scenarioConfig, runResult, counterfactualResult, perturbation, llmMode, profileName }) {
  const trace = {
    schemaVersion: 1,
    profileName,
    scenario: {
      id: scenario.id,
      hidden: scenario.hidden,
      openingTurns: scenario.openingTurns,
      maxTurns: scenario.maxTurns,
      expectedStrategyShift: scenarioConfig?.expected_strategy_shift ?? null,
      scenarioType: scenarioConfig?.scenario_type ?? null,
    },
    llmMode,
    original: {
      dialogue: runResult.final.dialogue,
      finalLearnerProfile: runResult.final.learnerProfile,
      finalTutorInternal: runResult.final.tutorInternal,
      constraintViolations: runResult.final.constraintViolations,
      perTurn: extractTurnTrace(runResult.history),
    },
    counterfactual: null,
  };
  if (counterfactualResult) {
    trace.counterfactual = {
      perturbation,
      dialogue: counterfactualResult.final.dialogue,
      finalLearnerProfile: counterfactualResult.final.learnerProfile,
      finalTutorInternal: counterfactualResult.final.tutorInternal,
      constraintViolations: counterfactualResult.final.constraintViolations,
      perTurn: extractTurnTrace(counterfactualResult.history),
    };
  }
  return trace;
}

function writeTraceFile(dialogueId, traceJson) {
  ensureLogsDir();
  const dir = dialoguesDir();
  const content = JSON.stringify(traceJson, null, 2);
  const hash = createHash('sha256').update(content).digest('hex');
  const dialoguePath = path.join(dir, `${dialogueId}.json`);
  const hashPath = path.join(dir, `${hash}.json`);
  fs.writeFileSync(dialoguePath, content);
  fs.writeFileSync(hashPath, content);
  return { dialoguePath, hashPath, contentHash: hash };
}

function tutorMessages(state) {
  return state.dialogue.filter((m) => m.role === 'tutor').map((m) => m.content);
}

function policyActionTrace(history) {
  return extractTurnTrace(history)
    .map((t) => t.tutorInternal?.policyAction)
    .filter(Boolean);
}

// Build the row to feed evaluationStore.storeResult().
function buildResultRow({ scenario, scenarioConfig, runResult, profileName, agentConfig, dialogueId, contentHash, llmMode, traceJson }) {
  const tutorTexts = tutorMessages(runResult.final);
  const policies = policyActionTrace(runResult.history);
  const summary = {
    llmMode,
    scenarioId: scenario.id,
    expectedStrategyShift: scenarioConfig?.expected_strategy_shift ?? null,
    policyActions: policies,
    finalLearnerProfile: runResult.final.learnerProfile,
    constraintViolations: runResult.final.constraintViolations,
    counterfactual: traceJson.counterfactual ? {
      policyActions: (traceJson.counterfactual.perTurn || [])
        .map((t) => t.tutorInternal?.policyAction)
        .filter(Boolean),
    } : null,
  };

  return {
    scenarioId: scenario.id,
    scenarioName: scenarioConfig?.scenario_name ?? scenario.id,
    scenarioType: scenarioConfig?.scenario_type ?? 'adaptive_trap',
    provider: agentConfig?.provider ?? 'mock',
    model: agentConfig?.model ?? 'mock',
    profileName,
    hyperparameters: agentConfig?.hyperparameters ?? {},
    promptId: 'adaptive_tutor_v1',
    egoModel: null,
    superegoModel: null,
    suggestions: tutorTexts,
    rawResponse: JSON.stringify(summary),
    latencyMs: 0,
    inputTokens: 0,
    outputTokens: 0,
    cost: 0,
    dialogueRounds: tutorTexts.length,
    deliberationRounds: policies.length,
    apiCalls: 0,
    dialogueId,
    dialogueContentHash: contentHash,
    success: true,
    learnerArchitecture: 'adaptive_externalised',
    conversationMode: 'adaptive_trap',
    scoringMethod: 'pending',
  };
}

// Public: persist a single (non-counterfactual) scenario run.
export function persistScenarioRun({ runId, scenario, scenarioConfig, runResult, profileName, agentConfig, llmMode }) {
  const dialogueId = makeDialogueId(scenario.id);
  const traceJson = buildTraceJson({ scenario, scenarioConfig, runResult, llmMode, profileName });
  const { contentHash } = writeTraceFile(dialogueId, traceJson);
  const row = buildResultRow({ scenario, scenarioConfig, runResult, profileName, agentConfig, dialogueId, contentHash, llmMode, traceJson });
  const rowId = evaluationStore.storeResult(runId, row);
  return { rowId, dialogueId, contentHash };
}

// Public: persist an original + counterfactual as a single row containing
// both branches in the trace, so the strategy-shift analyzer can match them
// without an extra join. Counterfactual is the diagnostic — recording it as
// a sibling row would double-count under conventional aggregations.
export function persistScenarioWithCounterfactual({
  runId, scenario, scenarioConfig, result, profileName, agentConfig, llmMode,
}) {
  const dialogueId = makeDialogueId(scenario.id);
  const traceJson = buildTraceJson({
    scenario,
    scenarioConfig,
    runResult: result.original,
    counterfactualResult: result.counterfactual,
    perturbation: result.counterfactual ? result.counterfactual.perturbation ?? null : null,
    llmMode,
    profileName,
  });
  const { contentHash } = writeTraceFile(dialogueId, traceJson);
  const row = buildResultRow({
    scenario,
    scenarioConfig,
    runResult: result.original,
    profileName,
    agentConfig,
    dialogueId,
    contentHash,
    llmMode,
    traceJson,
  });
  const rowId = evaluationStore.storeResult(runId, row);
  return { rowId, dialogueId, contentHash, hasCounterfactual: Boolean(result.counterfactual) };
}

// Public: helper to create a run for a batch of adaptive-trap scenarios.
export function createAdaptiveRun({ description, totalScenarios, profileName, llmMode, metadata = {} }) {
  return evaluationStore.createRun({
    description: description || `adaptive trap run (${profileName}, ${llmMode})`,
    totalScenarios,
    totalConfigurations: 1,
    metadata: {
      ...metadata,
      kind: 'adaptive_trap',
      profileName,
      llmMode,
    },
  });
}
