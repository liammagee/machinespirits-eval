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
import { fileURLToPath, pathToFileURL } from 'url';
import { createHash } from 'crypto';

import * as evalConfigLoader from '../services/evalConfigLoader.js';
import * as idDirectorEngine from '../services/idDirectorEngine.js';
import * as realLLM from '../services/adaptiveTutor/realLLM.js';
import { createAdaptivePersistence } from '../services/adaptiveTutor/persistence.js';
import {
  bindRunLedger,
  checkBalanceBeforeDispatch,
  executeMeteredUnits,
  finalizeMeteredRun,
  meterCallAI,
  resolveSpendCeiling,
  selectPendingUnits,
} from '../services/adaptiveTutor/meteredRunSession.js';
import { learnerTurnIndexForTutorTurn } from './lib/trapTurnConvention.js';
import { resolveTutorDialoguesDir } from '../services/evaluationDataPaths.js';
import { withEvaluationScriptStore } from '../services/evaluationStore/scriptContext.js';

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
  return resolveTutorDialoguesDir(REPO_ROOT);
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

async function runScenario({ evaluationStore, runId, scenario, profile, profileName, agentConfig, verbose }) {
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

// The dependency bundle the id-director engine runs under.
//
// Every model call this engine makes — id, ego, plan, verifier — goes through
// its injected `callAI`, and that path does NOT run through realLLM, so
// realLLM.setActiveBudgetTracker never saw any of them: only the synthetic
// learner was ever charged against the ceiling. Wrapping `callAI` here is what
// puts the whole engine behind the run's ledger.
export function createIdDirectorEngineDeps({ tracker = null, tutorConfig, callAI = idDirectorEngine.__defaultCallAI }) {
  return {
    tutorConfig,
    callAI: tracker ? meterCallAI(callAI, { tracker }) : callAI,
  };
}

export async function main(
  args = process.argv.slice(2),
  { rootDir = REPO_ROOT, env = process.env, evaluationStore = null, createStore, callAI = undefined } = {},
) {
  const profileName = parseFlag(args, 'profile', 'cell_106_id_director_pedagogy_tuned');
  const scenarioFilter = parseFlag(args, 'scenarios');
  const runsPerConfig = Number(parseFlag(args, 'runs', '1'));
  // A malformed ceiling stops the pilot here. It used to fall through
  // `Number('abc') > 0` and run the whole thing with no ceiling at all.
  const maxCostUsd = resolveSpendCeiling(parseFlag(args, 'max-cost'));
  const resumeRunId = parseFlag(args, 'resume') || null;
  const verbose = args.includes('--verbose');

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

  let scenarios = loadScenarios('config/adaptive-trap-scenarios.yaml');
  if (scenarioFilter) {
    const want = new Set(scenarioFilter.split(',').map((s) => s.trim()));
    scenarios = scenarios.filter((s) => want.has(s.id) || want.has(s.scenario_type));
  }
  if (!scenarios.length) {
    throw new Error(`no scenarios matched filter '${scenarioFilter ?? '(none)'}'`);
  }

  return withEvaluationScriptStore(
    async (store) => {
      const { createAdaptiveRun } = createAdaptivePersistence({ evaluationStore: store });

      // The plan is fixed before any call, so a restart replays exactly the
      // units this pilot set out to run.
      const plannedUnits = [];
      for (const scenario of scenarios) {
        for (let runIndex = 0; runIndex < runsPerConfig; runIndex++) {
          plannedUnits.push({
            scenarioId: scenario.id,
            runIndex,
            unitId: runsPerConfig > 1 ? `${scenario.id}__r${runIndex}` : scenario.id,
          });
        }
      }

      // A durable run identity has to exist before the first metered call,
      // because the budget ledger is keyed by run id.
      let run;
      if (resumeRunId) {
        run = store.getRun(resumeRunId);
        if (!run) throw new Error(`--resume: run not found: ${resumeRunId}`);
        if (run.metadata?.architecture !== 'id_director') {
          throw new Error(`--resume: run ${resumeRunId} is not an id-director run`);
        }
        if ((run.metadata?.maxCostUsd ?? null) !== maxCostUsd) {
          throw new Error(
            `--resume: run ${resumeRunId} was launched with ceiling ${run.metadata?.maxCostUsd ?? 'none'}; ` +
              `pass the same --max-cost (got ${maxCostUsd ?? 'none'})`,
          );
        }
      } else {
        run = createAdaptiveRun({
          description: `id-director trap pilot (${profileName})`,
          totalScenarios: plannedUnits.length,
          profileName,
          llmMode: 'real',
          metadata: {
            profileName,
            scenarioSource: 'config/adaptive-trap-scenarios.yaml',
            maxCostUsd,
            architecture: 'id_director',
            runsPerConfig,
            plannedUnits,
          },
        });
      }
      const runId = run.id;
      const resumePlan = resumeRunId ? run.metadata?.plannedUnits || plannedUnits : plannedUnits;
      const { completedUnitIds, pendingUnits } = selectPendingUnits({
        evaluationStore: store,
        runId,
        plannedUnits: resumePlan,
      });

      let tracker = null;
      try {
        // Inject evalConfigLoader so the id-director engine sees claude-code as
        // configured (its CLI manages auth; tutor-core's getProviderConfig flips it
        // to isConfigured=false because no api_key_env / base_url is set).
        //
        // The ledger is bound here too. Every id, ego, plan, and verifier call
        // this engine makes goes through its injected callAI, which does NOT
        // route via realLLM — so before this wrapper only the synthetic learner
        // was ever charged against the ceiling.
        tracker = bindRunLedger({
          evaluationStore: store,
          runId,
          maxCostUsd,
          verbose,
          label: 'id-director-trap',
        });
        idDirectorEngine.__setDeps(
          createIdDirectorEngineDeps({
            tracker,
            tutorConfig: evalConfigLoader,
            ...(callAI ? { callAI } : {}),
          }),
        );

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
        if (tracker) realLLM.setActiveBudgetTracker(tracker);

        // Advisory unless the provider config declares the capability and a
        // stop policy. The ledger remains the binding control.
        await checkBalanceBeforeDispatch({
          provider: agentConfig.provider,
          providerConfig: evalConfigLoader.getProviderConfig(agentConfig.provider),
          maxCostUsd,
          alreadyExposedUsd: tracker ? tracker.summary().ceilingExposureUsd : 0,
          policy: run.metadata?.balancePolicy || 'warn',
          label: 'id-director-trap',
          verbose,
        });

        console.log(
          `[id-director-trap] runId=${runId} profile=${profileName} ` +
            `provider=${agentConfig.provider} model=${agentConfig.model} ` +
            `planned=${resumePlan.length} done=${completedUnitIds.size} pending=${pendingUnits.length}`,
        );

        const outcome = await executeMeteredUnits({
          units: pendingUnits,
          label: 'id-director-trap',
          verbose,
          execute: async (unit) => {
            const scenario = scenarios.find((candidate) => candidate.id === unit.scenarioId);
            if (!scenario) throw new Error(`scenario ${unit.scenarioId} is not in the scenario source`);
            const out = await runScenario({
              evaluationStore: store,
              runId,
              scenario: { ...scenario, id: unit.unitId },
              profile,
              profileName,
              agentConfig,
              verbose,
            });
            console.log(`[id-director-trap]   ✓ ${unit.unitId} (turns=${out.turns}, dialogue=${out.dialogueId})`);
          },
        });

        const totalTests = completedUnitIds.size + outcome.completedUnitIds.length;
        finalizeMeteredRun({
          evaluationStore: store,
          runId,
          halted: outcome.halted,
          haltCode: outcome.haltCode,
          totalTests,
        });

        const budget = tracker ? tracker.summary() : null;
        console.log(
          `[id-director-trap] runId=${runId} persisted=${totalTests}/${resumePlan.length} ` +
            `failed=${outcome.failures.length}` +
            (budget
              ? ` budget=$${budget.accumulatedUsd.toFixed(4)}/$${budget.maxUsd.toFixed(2)} (${budget.utilizationPct.toFixed(1)}%)`
              : ''),
        );
        if (outcome.halted) {
          console.error(`[id-director-trap] halt reason: ${outcome.haltReason || '(unknown)'}`);
          return 2;
        }
        return 0;
      } finally {
        realLLM.clearActiveCellConfig();
        if (tracker) realLLM.clearActiveBudgetTracker();
        idDirectorEngine.__resetDeps();
      }
    },
    { rootDir, env, evaluationStore, createStore },
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then(
    (code) => {
      process.exitCode = code;
    },
    (error) => {
      console.error('[id-director-trap] FATAL:', error);
      process.exitCode = 1;
    },
  );
}
