#!/usr/bin/env node
// §10.4 trap-scenarios → id-director adapter.
//
// Lets cell_106 (and any other id-director cell) consume
// `config/adaptive-trap-scenarios.yaml` opening_turns + scripted trigger as
// multi-turn input. The id-director loop in `services/idDirectorEngine.js`
// generates each tutor turn (id constructs the ego prompt, ego executes); the
// LangGraph adaptive `learnerTurn` role generates each learner reply with the
// hidden state and trigger anchored to the trap scenario.
//
// Output: rows in `evaluation_results` whose `id_construction_trace` column
// carries the per-turn JSON envelope, scenario metadata mirrors what the
// adaptive runner writes for cell_110/115 (so the strategy-shift analyzer can
// score these dialogues alongside the LangGraph cells), and `dialogue_id`
// points to a JSON trace file in `logs/tutor-dialogues/`.
//
// Usage:
//   node scripts/run-id-director-trap-pilot.js \
//     --profile=cell_106_id_director_pedagogy_tuned \
//     --scenarios=resistance_to_insight_v1 \
//     --runs=1 --verbose
//
// Env:
//   ADAPTIVE_TUTOR_LLM=mock   does NOT apply here (id-director has no mock
//                             backend — set the cell to a cheap provider for
//                             dry-runs).
//   EVAL_DB_PATH, EVAL_LOGS_DIR — honoured for hermetic smokes (same pattern
//                             as the adaptive runner).

import fs from 'fs';
import path from 'path';
import yaml from 'yaml';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

import * as evaluationStore from '../services/evaluationStore.js';
import * as evalConfigLoader from '../services/evalConfigLoader.js';
import * as idDirectorEngine from '../services/idDirectorEngine.js';
import * as realLLM from '../services/adaptiveTutor/realLLM.js';
import { createAdaptiveRun } from '../services/adaptiveTutor/persistence.js';
import { createBudgetTracker } from '../services/adaptiveTutor/budgetTracker.js';
import { learnerTurnIndexForTutorTurn } from './lib/trapTurnConvention.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

function loadScenarios(file) {
  const content = fs.readFileSync(path.resolve(REPO_ROOT, file), 'utf-8');
  return yaml.parse(content).scenarios || [];
}

function makeDialogueId(scenarioId) {
  const safe = String(scenarioId).replace(/[^a-zA-Z0-9_-]/g, '_');
  const rand = Math.random().toString(36).slice(2, 8);
  return `id-director-trap-${safe}-${Date.now()}-${rand}`;
}

function logsDir() {
  return path.join(process.env.EVAL_LOGS_DIR || path.join(REPO_ROOT, 'logs'), 'tutor-dialogues');
}

function writeTraceFile(dialogueId, traceJson) {
  const dir = logsDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const content = JSON.stringify(traceJson, null, 2);
  const hash = createHash('sha256').update(content).digest('hex');
  fs.writeFileSync(path.join(dir, `${dialogueId}.json`), content);
  fs.writeFileSync(path.join(dir, `${hash}.json`), content);
  return hash;
}

// Trap-scenario YAML uses snake_case; the adaptive runner's `learnerTurn` role
// expects camelCase keys on `hidden`. Mirror the conversion in
// services/adaptiveTutor/index.js#toRunnerScenario.
function toHiddenState(scenario) {
  return {
    actualMisconception: scenario.hidden?.actual_misconception || '',
    actualSophistication: scenario.hidden?.actual_sophistication || 'intermediate',
    triggerTurn: scenario.hidden?.trigger_turn ?? 1,
    triggerSignal: scenario.hidden?.trigger_signal || '',
  };
}

async function runScenario({ runId, scenario, profile, profileName, agentConfig, verbose }) {
  const hidden = toHiddenState(scenario);
  const maxTurns = scenario.max_turns ?? 4;

  // messageHistory uses tutor-core conventions: { role: 'user'|'assistant', content }
  // Opening turns from the YAML can be 'learner' or 'tutor' — map to user/assistant.
  const messageHistory = (scenario.opening_turns || []).map((t) => ({
    role: t.role === 'tutor' ? 'assistant' : 'user',
    content: t.content,
  }));

  const idConstructions = [];
  let previousPersona = 'FIRST_TURN';
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalApiCalls = 0;
  let totalCost = 0;

  const startMs = Date.now();
  for (let turn = 0; turn < maxTurns; turn++) {
    // 1. Tutor's id-directed turn.
    const context = {
      learnerContext: '',
      curriculumContext: '',
      simulationsContext: '',
      messageHistory,
    };
    const idResult = await idDirectorEngine.generateIdDirectedSuggestion(context, { profileName }, profile, {
      previousPersona,
    });
    if (!idResult.success) {
      throw new Error(`id-director failed at turn ${turn}: ${idResult.error}`);
    }
    const tutorMessage = (idResult.suggestions?.[0]?.message || '').trim();
    if (!tutorMessage) {
      throw new Error(`id-director returned empty tutor message at turn ${turn}`);
    }
    messageHistory.push({ role: 'assistant', content: tutorMessage });
    idConstructions.push({
      turn,
      construction: idResult.metadata?.idConstruction || null,
      tutorText: tutorMessage,
    });
    if (idResult.metadata?.idConstruction) {
      const c = idResult.metadata.idConstruction;
      previousPersona = JSON.stringify({
        persona_delta: c.persona_delta,
        stage_directions: c.stage_directions,
      });
    }
    totalInputTokens += idResult.metadata?.inputTokens || 0;
    totalOutputTokens += idResult.metadata?.outputTokens || 0;
    totalApiCalls += idResult.metadata?.apiCalls || 0;
    totalCost += idResult.metadata?.totalCost || 0;
    if (verbose) {
      console.log(`[id-director-trap]   t${turn} tutor (${tutorMessage.length} chars)`);
    }

    // 2. Stop after the final tutor turn — no need to generate a learner reply
    //    that would never be answered.
    if (turn + 1 >= maxTurns) break;

    // 3. Synthetic learner turn — same callRole the adaptive runner uses for
    //    cell_110/115. Anchored to the trap scenario via `hidden`. The learner
    //    turn index is the tutor turn just answered; a trigger at learner turn
    //    t is first answerable by tutor turn t+1.
    const learnerTurnIndex = learnerTurnIndexForTutorTurn(turn);
    const learnerText = await realLLM.callRole('learnerTurn', {
      tutorLastMessage: tutorMessage,
      hidden,
      turn: learnerTurnIndex,
    });
    const learnerTrim = (learnerText || '').trim();
    if (!learnerTrim) {
      throw new Error(`learnerTurn returned empty at turn ${learnerTurnIndex}`);
    }
    messageHistory.push({ role: 'user', content: learnerTrim });
    if (verbose) {
      console.log(`[id-director-trap]   t${learnerTurnIndex} learner (${learnerTrim.length} chars)`);
    }
  }
  const latencyMs = Date.now() - startMs;

  // ── Persist ────────────────────────────────────────────────────────────
  const dialogueId = makeDialogueId(scenario.id);
  const traceJson = {
    schemaVersion: 1,
    profileName,
    architecture: 'id_director',
    llmMode: 'real',
    scenario: {
      id: scenario.id,
      hidden: scenario.hidden,
      openingTurns: scenario.opening_turns,
      maxTurns,
      expectedStrategyShift: scenario.expected_strategy_shift ?? null,
      scenarioType: scenario.scenario_type ?? null,
      failureMode: scenario.failure_mode ?? null,
      successCriteria: scenario.success_criteria ?? null,
    },
    dialogue: messageHistory.map((m) => ({
      role: m.role === 'assistant' ? 'tutor' : 'learner',
      content: m.content,
    })),
    idConstructions,
  };
  const contentHash = writeTraceFile(dialogueId, traceJson);

  const tutorTexts = messageHistory.filter((m) => m.role === 'assistant').map((m) => m.content);
  const summary = {
    llmMode: 'real',
    scenarioId: scenario.id,
    expectedStrategyShift: scenario.expected_strategy_shift ?? null,
    architecture: 'id_director',
    idConstructionCount: idConstructions.length,
    turns: tutorTexts.length,
  };
  const row = {
    scenarioId: scenario.id,
    scenarioName: scenario.name ?? scenario.id,
    scenarioType: scenario.scenario_type ?? 'adaptive_trap',
    provider: agentConfig.provider,
    model: agentConfig.model,
    profileName,
    hyperparameters: agentConfig.hyperparameters,
    promptId: 'id_director_trap_v1',
    egoModel: null,
    superegoModel: null,
    suggestions: tutorTexts,
    rawResponse: JSON.stringify(summary),
    latencyMs,
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
    cost: totalCost,
    dialogueRounds: tutorTexts.length,
    deliberationRounds: idConstructions.length,
    apiCalls: totalApiCalls,
    dialogueId,
    dialogueContentHash: contentHash,
    success: true,
    learnerArchitecture: 'id_director_dynamic',
    conversationMode: 'adaptive_trap',
    scoringMethod: 'pending',
  };
  const rowId = evaluationStore.storeResult(runId, row);
  evaluationStore.setIdConstructionTrace(rowId, idConstructions);

  return { rowId, dialogueId, turns: idConstructions.length };
}

function parseFlag(args, name, fallback = undefined) {
  const prefix = `--${name}=`;
  const hit = args.find((a) => a.startsWith(prefix));
  if (hit) return hit.slice(prefix.length);
  const idx = args.indexOf(`--${name}`);
  if (idx >= 0 && idx + 1 < args.length && !args[idx + 1].startsWith('--')) return args[idx + 1];
  return fallback;
}

async function main() {
  const args = process.argv.slice(2);
  const profileName = parseFlag(args, 'profile', 'cell_106_id_director_pedagogy_tuned');
  const scenarioFilter = parseFlag(args, 'scenarios');
  const runsPerConfig = Number(parseFlag(args, 'runs', '1'));
  const maxCostUsdRaw = parseFlag(args, 'max-cost');
  const maxCostUsd = maxCostUsdRaw != null ? Number(maxCostUsdRaw) : null;
  const verbose = args.includes('--verbose');

  // Inject evalConfigLoader so the id-director engine sees claude-code as
  // configured (its CLI manages auth; tutor-core's getProviderConfig flips it
  // to isConfigured=false because no api_key_env / base_url is set).
  idDirectorEngine.__setDeps({ tutorConfig: evalConfigLoader });

  const profile = evalConfigLoader.getTutorProfile(profileName);
  if (!profile) {
    throw new Error(`profile ${profileName} not found in tutor-agents.yaml`);
  }
  if (profile?.factors?.id_director !== true) {
    throw new Error(
      `profile ${profileName} is not an id-director cell ` + `(factors.id_director=${profile?.factors?.id_director})`,
    );
  }
  const agentConfig = {
    provider: profile.ego?.provider || 'mock',
    model: profile.ego?.model || 'mock',
    hyperparameters: profile.ego?.hyperparameters || {},
  };

  // Route the synthetic learner's callRole('learnerTurn', ...) through the
  // same provider/model as the tutor side. Without this, realLLM falls back
  // to module-default config which would cross-route to OpenRouter for a
  // claude-code cell.
  realLLM.setActiveCellConfig({
    provider: agentConfig.provider,
    modelAlias: agentConfig.model,
    temperature: agentConfig.hyperparameters?.temperature,
    maxTokens: agentConfig.hyperparameters?.max_tokens,
  });

  let tracker = null;
  if (maxCostUsd != null && maxCostUsd > 0) {
    tracker = createBudgetTracker({ maxUsd: maxCostUsd });
    realLLM.setActiveBudgetTracker(tracker);
  }

  let scenarios = loadScenarios('config/adaptive-trap-scenarios.yaml');
  if (scenarioFilter) {
    const want = new Set(scenarioFilter.split(',').map((s) => s.trim()));
    scenarios = scenarios.filter((s) => want.has(s.id) || want.has(s.scenario_type));
  }
  if (!scenarios.length) {
    throw new Error(`no scenarios matched filter '${scenarioFilter ?? '(none)'}'`);
  }

  const totalScenarios = scenarios.length * runsPerConfig;
  const run = createAdaptiveRun({
    description: `id-director trap pilot (${profileName})`,
    totalScenarios,
    profileName,
    llmMode: 'real',
    metadata: {
      profileName,
      scenarioSource: 'config/adaptive-trap-scenarios.yaml',
      maxCostUsd,
      architecture: 'id_director',
    },
  });
  const runId = run.id;

  console.log(
    `[id-director-trap] runId=${runId} profile=${profileName} ` +
      `provider=${agentConfig.provider} model=${agentConfig.model} ` +
      `scenarios=${scenarios.length} runsPerConfig=${runsPerConfig}`,
  );

  let persisted = 0;
  let failed = 0;
  for (const scenario of scenarios) {
    for (let r = 0; r < runsPerConfig; r++) {
      const variantId = runsPerConfig > 1 ? `${scenario.id}__r${r}` : scenario.id;
      try {
        const out = await runScenario({
          runId,
          scenario: { ...scenario, id: variantId },
          profile,
          profileName,
          agentConfig,
          verbose,
        });
        persisted++;
        // eslint-disable-next-line no-constant-condition
        if (verbose || true) {
          console.log(`[id-director-trap]   ✓ ${variantId} (turns=${out.turns}, dialogue=${out.dialogueId})`);
        }
      } catch (err) {
        failed++;
        console.error(`[id-director-trap]   ✗ ${variantId}: ${err.message}`);
        if (verbose) console.error(err.stack);
      }
    }
  }

  realLLM.clearActiveCellConfig();
  if (tracker) realLLM.clearActiveBudgetTracker();
  idDirectorEngine.__resetDeps();

  console.log(`[id-director-trap] runId=${runId} persisted=${persisted}/${totalScenarios} failed=${failed}`);
}

main().catch((err) => {
  console.error('[id-director-trap] FATAL:', err);
  process.exit(1);
});
