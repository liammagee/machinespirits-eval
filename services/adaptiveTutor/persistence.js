// Persistence adapter for the adaptive cell.
//
// Translates the output of runScenario / runScenarioWithCounterfactual
// (services/adaptiveTutor/runner.js) into evaluation_results rows the
// existing analysis pipeline can read.
//
// The deliberation trace — per-turn learnerProfile, tutorInternal,
// constraint-violation, and (for evidence-bound architectures) hypotheses
// + evidenceLog snapshots — is written to logs/tutor-dialogues/
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
//
// `getStateHistory` yields snapshots in REVERSE chronological order
// (newest-first). The "latest write wins" overwrite logic below assumes
// forward iteration — without the reverse, for bilateral_tom turn 0 the
// pre-tomTracker snap (updatedAtTurn=0, no ToM fields) would land last in
// iteration order and clobber the post-tomTracker snap that carries the
// paired summaryText / hypothesizedLearnerPerceptionOfTutor / tomProbes.
function extractTurnTrace(history) {
  const byTurn = new Map();
  for (const snap of [...history].reverse()) {
    const v = snap.values;
    if (!v) continue;
    const turn = v.turn;
    if (turn == null) continue;
    const existing = byTurn.get(turn) || {
      turn,
      learnerProfile: null,
      tutorInternal: null,
      constraintViolations: [],
      hypotheses: [],
      evidenceLog: [],
      revisionLedger: [],
      adaptationPolicyMode: null,
      learnerStateBelief: null,
      selectedPedagogicalAction: null,
      candidatePedagogicalActions: [],
      adaptationContract: null,
      pendingIntervention: null,
      interventionLedger: [],
      adaptationTrace: [],
      dialogueLength: 0,
    };
    if (v.learnerProfile && v.learnerProfile.updatedAtTurn === turn) {
      existing.learnerProfile = v.learnerProfile;
    }
    if (
      v.tutorInternal &&
      (v.tutorInternal.policyAction || v.tutorInternal.egoDraft || v.tutorInternal.idConstruction)
    ) {
      // Keep the latest tutorInternal seen for this turn — node order means
      // the post-revision values will overwrite the initial draft fields.
      // The idAuthorPersona node (cells 121/122) writes idConstruction +
      // idAuthoredPrompt before the ego node fires, so this clause picks them
      // up even when egoDraft/policyAction haven't been written yet on the
      // first snap of the turn.
      existing.tutorInternal = v.tutorInternal;
    }
    if (Array.isArray(v.constraintViolations) && v.constraintViolations.length) {
      existing.constraintViolations = [...new Set([...existing.constraintViolations, ...v.constraintViolations])];
    }
    // hypotheses (merge-by-id reducer) and evidenceLog (append-only) are
    // cumulative monotonic channels: every checkpoint's snap.values carries
    // the full merged array, so the latest snap for this turn — last in
    // forward iteration over the reversed history — is the end-of-turn
    // cumulative state. Unlike learnerProfile (replaced per turn, hence the
    // updatedAtTurn guard above) these grow only, so plain latest-wins is
    // correct and needs no per-turn stamp. We store the full cumulative
    // array per turn rather than a delta so a Stage-5 analyzer can diff
    // adjacent turns to derive added / id-revised / TTL-retired without
    // extra per-entry bookkeeping — closing the §6.9.3 limitation that
    // revision rate was only a terminal-state distinct-survivor proxy.
    // Architectures without the evidence-bound nodes leave these undefined,
    // so the [] default stands and the trace stays backward-compatible.
    if (Array.isArray(v.hypotheses)) {
      existing.hypotheses = v.hypotheses;
    }
    if (Array.isArray(v.evidenceLog)) {
      existing.evidenceLog = v.evidenceLog;
    }
    // A16 (P2): revisionLedger is the same cumulative monotonic append-only
    // channel as evidenceLog (shares evidenceLogReducer) — latest snap for
    // the turn carries the full cumulative array, so plain latest-wins is
    // correct. Only superego_revise_cumulative (S1) writes it; S0 and every
    // other architecture leave it undefined, so the [] default stands and
    // the per-turn ledger length stays 0 (the analysable S0/S1 contrast).
    if (Array.isArray(v.revisionLedger)) {
      existing.revisionLedger = v.revisionLedger;
    }
    if (v.adaptationPolicyMode) {
      existing.adaptationPolicyMode = v.adaptationPolicyMode;
    }
    if (v.learnerStateBelief) {
      existing.learnerStateBelief = v.learnerStateBelief;
    }
    if (v.selectedPedagogicalAction) {
      existing.selectedPedagogicalAction = v.selectedPedagogicalAction;
    }
    if (Array.isArray(v.candidatePedagogicalActions)) {
      existing.candidatePedagogicalActions = v.candidatePedagogicalActions;
    }
    if (v.adaptationContract) {
      existing.adaptationContract = v.adaptationContract;
    }
    if (v.pendingIntervention) {
      existing.pendingIntervention = v.pendingIntervention;
    } else if (v.pendingIntervention === null) {
      existing.pendingIntervention = null;
    }
    if (Array.isArray(v.interventionLedger)) {
      existing.interventionLedger = v.interventionLedger;
    }
    if (Array.isArray(v.adaptationTrace)) {
      existing.adaptationTrace = v.adaptationTrace.filter((entry) => entry?.turn === turn);
    }
    existing.dialogueLength = Array.isArray(v.dialogue) ? v.dialogue.length : existing.dialogueLength;
    byTurn.set(turn, existing);
  }
  return [...byTurn.values()]
    .sort((a, b) => a.turn - b.turn)
    .filter((record) => {
      const isPlan2Record = record.adaptationPolicyMode && record.adaptationPolicyMode !== 'legacy';
      if (!isPlan2Record) return true;
      return Array.isArray(record.adaptationTrace) && record.adaptationTrace.length > 0;
    });
}

function buildTraceJson({
  scenario,
  scenarioConfig,
  runResult,
  counterfactualResult,
  perturbation,
  llmMode,
  profileName,
}) {
  const trace = {
    // schemaVersion 2 (A14 Stage 1) adds finalEvidenceLog + finalHypotheses to
    // each branch. schemaVersion 3 (A14 Stage 5 prep) adds per-turn
    // hypotheses + evidenceLog to each branch's perTurn[] records.
    // schemaVersion 4 (A16 P2 §6.3.10) adds finalRevisionLedger + per-turn
    // revisionLedger so the S1-vs-S0 slope analysis can read the
    // superego-rewrite ledger growth directly. Nothing branches on this
    // number (it is informational); older trace files without these fields
    // stay readable — analyzers default them to [] when absent.
    // schemaVersion 5 (Plan 2.0) adds adaptation contracts, selected actions,
    // pending/closed intervention ledgers, and adaptationTrace entries.
    schemaVersion: 5,
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
      finalEvidenceLog: runResult.final.evidenceLog ?? [],
      finalHypotheses: runResult.final.hypotheses ?? [],
      finalRevisionLedger: runResult.final.revisionLedger ?? [],
      adaptationPolicyMode: runResult.final.adaptationPolicyMode ?? 'legacy',
      finalLearnerStateBelief: runResult.final.learnerStateBelief ?? null,
      finalSelectedPedagogicalAction: runResult.final.selectedPedagogicalAction ?? null,
      finalAdaptationContract: runResult.final.adaptationContract ?? null,
      finalPendingIntervention: runResult.final.pendingIntervention ?? null,
      finalInterventionLedger: runResult.final.interventionLedger ?? [],
      finalAdaptationTrace: runResult.final.adaptationTrace ?? [],
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
      finalEvidenceLog: counterfactualResult.final.evidenceLog ?? [],
      finalHypotheses: counterfactualResult.final.hypotheses ?? [],
      finalRevisionLedger: counterfactualResult.final.revisionLedger ?? [],
      adaptationPolicyMode: counterfactualResult.final.adaptationPolicyMode ?? 'legacy',
      finalLearnerStateBelief: counterfactualResult.final.learnerStateBelief ?? null,
      finalSelectedPedagogicalAction: counterfactualResult.final.selectedPedagogicalAction ?? null,
      finalAdaptationContract: counterfactualResult.final.adaptationContract ?? null,
      finalPendingIntervention: counterfactualResult.final.pendingIntervention ?? null,
      finalInterventionLedger: counterfactualResult.final.interventionLedger ?? [],
      finalAdaptationTrace: counterfactualResult.final.adaptationTrace ?? [],
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
function buildResultRow({
  scenario,
  scenarioConfig,
  runResult,
  profileName,
  agentConfig,
  dialogueId,
  contentHash,
  llmMode,
  traceJson,
  usage,
}) {
  const tutorTexts = tutorMessages(runResult.final);
  const policies = policyActionTrace(runResult.history);
  const summary = {
    llmMode,
    scenarioId: scenario.id,
    expectedStrategyShift: scenarioConfig?.expected_strategy_shift ?? null,
    policyActions: policies,
    finalLearnerProfile: runResult.final.learnerProfile,
    adaptationPolicyMode: runResult.final.adaptationPolicyMode ?? 'legacy',
    adaptationContracts: (traceJson.original.perTurn || []).map((t) => t.adaptationContract).filter(Boolean),
    interventionLedger: runResult.final.interventionLedger ?? [],
    constraintViolations: runResult.final.constraintViolations,
    counterfactual: traceJson.counterfactual
      ? {
          policyActions: (traceJson.counterfactual.perTurn || [])
            .map((t) => t.tutorInternal?.policyAction)
            .filter(Boolean),
        }
      : null,
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
    inputTokens: usage?.inputTokens ?? 0,
    outputTokens: usage?.outputTokens ?? 0,
    cost: usage?.cost ?? 0,
    dialogueRounds: tutorTexts.length,
    deliberationRounds: policies.length,
    apiCalls: usage?.apiCalls ?? 0,
    dialogueId,
    dialogueContentHash: contentHash,
    success: true,
    learnerArchitecture: 'adaptive_externalised',
    conversationMode: 'adaptive_trap',
    scoringMethod: 'pending',
  };
}

// Public: persist a single (non-counterfactual) scenario run.
export function persistScenarioRun({
  runId,
  scenario,
  scenarioConfig,
  runResult,
  profileName,
  agentConfig,
  llmMode,
  usage,
}) {
  const dialogueId = makeDialogueId(scenario.id);
  const traceJson = buildTraceJson({ scenario, scenarioConfig, runResult, llmMode, profileName });
  const { contentHash } = writeTraceFile(dialogueId, traceJson);
  const row = buildResultRow({
    scenario,
    scenarioConfig,
    runResult,
    profileName,
    agentConfig,
    dialogueId,
    contentHash,
    llmMode,
    traceJson,
    usage,
  });
  const rowId = evaluationStore.storeResult(runId, row);
  return { rowId, dialogueId, contentHash };
}

// Public: persist an original + counterfactual as a single row containing
// both branches in the trace, so the strategy-shift analyzer can match them
// without an extra join. Counterfactual is the diagnostic — recording it as
// a sibling row would double-count under conventional aggregations.
export function persistScenarioWithCounterfactual({
  runId,
  scenario,
  scenarioConfig,
  result,
  profileName,
  agentConfig,
  llmMode,
  usage,
}) {
  const dialogueId = makeDialogueId(scenario.id);
  const traceJson = buildTraceJson({
    scenario,
    scenarioConfig,
    runResult: result.original,
    counterfactualResult: result.counterfactual,
    perturbation: result.counterfactual ? (result.counterfactual.perturbation ?? null) : null,
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
    usage,
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
