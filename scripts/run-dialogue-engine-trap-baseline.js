#!/usr/bin/env node
// Cross-architecture baseline: tutor-core's standard ego (no LangGraph state
// machine) driven on `config/adaptive-trap-scenarios.yaml`, so the LangGraph
// adaptive cells (110/111/112) can be compared against a plain ego loop on the
// same trap suite + the same scoring pipeline.
//
// Modelled on scripts/run-id-director-trap-pilot.js. The differences:
//   - The tutor turn calls realLLM.callRole('tutorEgoExecute', { systemPromptOverride })
//     with tutor-core's base ('budget') ego prompt — i.e. the standard,
//     non-recognition, single-agent ego, run once per turn with no superego,
//     no externalised learner profile, no constraint check, no counterfactual.
//     This is the dialogue-engine analogue of cell_111's recognition_only node.
//   - The learner is the same scripted-trap learner as cell_110/106:
//     realLLM.callRole('learnerTurn', { tutorLastMessage, hidden, turn }) —
//     the hidden trigger never reaches the tutor.
//   - The trace is written in the LangGraph adaptive runner's JSON shape
//     (trace.scenario.hidden camelCase, trace.original.dialogue,
//     trace.original.perTurn with tutorInternal.policyAction) so BOTH
//     scripts/analyze-strategy-shift.js and scripts/grade-adaptive-dialogue.js
//     score these rows without modification. There is no counterfactual branch.
//
// cell_114 is a post-hoc baseline, NOT part of the A13 pre-registration.
//
// Usage:
//   node scripts/run-dialogue-engine-trap-baseline.js \
//     --profile=cell_114_dialogue_engine_trap_baseline \
//     --scenarios=false_confusion_v1 --runs=1 --verbose
//
// Env: EVAL_DB_PATH, EVAL_LOGS_DIR honoured (hermetic smokes). The cell config
// pins claude-code:sonnet, which routes through eval-repo's realLLM CLI bridge
// (tutor-core's dialogue engine does not support the claude-code provider — see
// docs/explorations/claude/2026-05-10-p22-p23-parking-note.md "Closing the dialogue-engine
// gap" for why the model is held equal to cell_110/111 rather than swapped to
// an OpenRouter model).

import fs from 'fs';
import path from 'path';
import yaml from 'yaml';
import { fileURLToPath, pathToFileURL } from 'url';
import { createHash } from 'crypto';

import * as evalConfigLoader from '../services/evalConfigLoader.js';
import { resolveEvalProfile } from '../services/evaluationRunner.js';
import * as realLLM from '../services/adaptiveTutor/realLLM.js';
import { createAdaptivePersistence } from '../services/adaptiveTutor/persistence.js';
import {
  bindRunLedger,
  checkBalanceBeforeDispatch,
  executeMeteredUnits,
  finalizeMeteredRun,
  resolveSpendCeiling,
  selectPendingUnits,
} from '../services/adaptiveTutor/meteredRunSession.js';
import { tutorConfigLoader as tutorConfig } from '../tutor-core/index.js';
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
  return `dialogue-engine-trap-${safe}-${Date.now()}-${rand}`;
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

// Trap-scenario YAML uses snake_case; analyze-strategy-shift.js /
// grade-adaptive-dialogue.js read camelCase keys on `hidden` (matching the
// adaptive runner's trace). Mirror services/adaptiveTutor/index.js#toRunnerScenario.
function toHiddenState(scenario) {
  return {
    actualMisconception: scenario.hidden?.actual_misconception || '',
    actualSophistication: scenario.hidden?.actual_sophistication || 'intermediate',
    triggerTurn: scenario.hidden?.trigger_turn ?? 1,
    triggerSignal: scenario.hidden?.trigger_signal || '',
  };
}

// systemPromptOverride for tutorEgoExecute = the standard ('budget') ego prompt
// plus the conversation so far. tutorEgoExecute's user-prompt builder only
// carries the latest learner message + the policy-action emission contract, so
// the running transcript has to ride in the system prompt — same shape as
// learnerTutorInteractionEngine.runTutorTurn (ego prompt = base + "Recent
// conversation:" + history + "The learner just said:").
function buildEgoSystemPrompt(baseEgoPrompt, messageHistory) {
  const transcript = messageHistory
    .map((m) => `${m.role === 'assistant' ? 'TUTOR' : 'LEARNER'}: ${m.content}`)
    .join('\n\n');
  return [
    baseEgoPrompt,
    '',
    '# Conversation so far',
    transcript || '(no prior turns)',
    '',
    "Continue as the tutor: respond to the learner's latest message.",
  ].join('\n');
}

async function runScenario({ evaluationStore, runId, scenario, profileName, agentConfig, baseEgoPrompt, verbose }) {
  const hidden = toHiddenState(scenario);
  const maxTurns = scenario.max_turns ?? 4;

  const messageHistory = (scenario.opening_turns || []).map((t) => ({
    role: t.role === 'tutor' ? 'assistant' : 'user',
    content: t.content,
  }));

  const perTurnTrace = [];
  const totalInputTokens = 0;
  const totalOutputTokens = 0;
  let totalApiCalls = 0;
  const totalCost = 0;

  const startMs = Date.now();
  for (let turn = 0; turn < maxTurns; turn++) {
    // 1. Tutor turn — standard ego, run once, against the base ego prompt.
    const learnerLastMessage = [...messageHistory].reverse().find((m) => m.role === 'user')?.content || '';
    let parsed;
    try {
      parsed = await realLLM.callRole('tutorEgoExecute', {
        systemPromptOverride: buildEgoSystemPrompt(baseEgoPrompt, messageHistory),
        learnerLastMessage,
        learnerProfile: {},
      });
    } catch (err) {
      throw new Error(`tutorEgoExecute failed at turn ${turn}: ${err.message}`);
    }
    const tutorMessage = (parsed?.text || '').trim();
    if (!tutorMessage) {
      throw new Error(`tutorEgoExecute returned empty text at turn ${turn}`);
    }
    const policyAction = parsed?.policyAction || null;
    messageHistory.push({ role: 'assistant', content: tutorMessage });
    perTurnTrace.push({
      turn,
      learnerProfile: null,
      tutorInternal: { policyAction, egoDraft: tutorMessage, rationale: parsed?.rationale ?? null },
      constraintViolations: [],
      dialogueLength: messageHistory.length,
    });
    totalApiCalls += 1;
    if (verbose) {
      console.log(`[dialogue-engine-trap]   t${turn} tutor policy=${policyAction} (${tutorMessage.length} chars)`);
    }

    // 2. Scripted-trap learner — same callRole the adaptive runner / id-director
    //    pilot use. The hidden trigger drives the learner LLM; the tutor never
    //    sees `hidden`. The learner turn index is the tutor turn just answered,
    //    matching services/adaptiveTutor/graph.js: a trigger at learner turn t
    //    is first answerable by tutor turn t+1, which strict_shift scores.
    //    We run it after EVERY tutor turn, including the final one: the trailing
    //    learner reaction makes the dialogue end `[…,T,L]` like the LangGraph
    //    adaptive cells (110-113), so transcript-level grading is apples-to-
    //    apples. perTurnTrace still carries one entry per tutor turn.
    let learnerText;
    const learnerTurnIndex = learnerTurnIndexForTutorTurn(turn);
    try {
      learnerText = await realLLM.callRole('learnerTurn', {
        tutorLastMessage: tutorMessage,
        hidden,
        turn: learnerTurnIndex,
      });
    } catch (err) {
      throw new Error(`learnerTurn failed at turn ${learnerTurnIndex}: ${err.message}`);
    }
    const learnerTrim = (learnerText || '').trim();
    if (!learnerTrim) {
      throw new Error(`learnerTurn returned empty at turn ${learnerTurnIndex}`);
    }
    messageHistory.push({ role: 'user', content: learnerTrim });
    totalApiCalls += 1;
    if (verbose) {
      console.log(`[dialogue-engine-trap]   t${learnerTurnIndex} learner (${learnerTrim.length} chars)`);
    }
  }
  const latencyMs = Date.now() - startMs;

  // ── Persist (trace in the adaptive-runner shape) ─────────────────────────
  const dialogueId = makeDialogueId(scenario.id);
  const dialogueTurns = messageHistory.map((m) => ({
    role: m.role === 'assistant' ? 'tutor' : 'learner',
    content: m.content,
  }));
  const traceJson = {
    schemaVersion: 1,
    profileName,
    architecture: 'dialogue_engine',
    llmMode: 'real',
    scenario: {
      id: scenario.id,
      hidden,
      openingTurns: scenario.opening_turns ?? [],
      maxTurns,
      expectedStrategyShift: scenario.expected_strategy_shift ?? null,
      scenarioType: scenario.scenario_type ?? null,
      failureMode: scenario.failure_mode ?? null,
      successCriteria: scenario.success_criteria ?? null,
    },
    original: {
      dialogue: dialogueTurns,
      perTurn: perTurnTrace,
      finalLearnerProfile: null,
      finalTutorInternal: perTurnTrace.length ? perTurnTrace[perTurnTrace.length - 1].tutorInternal : null,
      constraintViolations: [],
    },
    counterfactual: null,
  };
  const contentHash = writeTraceFile(dialogueId, traceJson);

  const tutorTexts = messageHistory.filter((m) => m.role === 'assistant').map((m) => m.content);
  const policyActions = perTurnTrace.map((t) => t.tutorInternal?.policyAction).filter(Boolean);
  const summary = {
    llmMode: 'real',
    scenarioId: scenario.id,
    expectedStrategyShift: scenario.expected_strategy_shift ?? null,
    architecture: 'dialogue_engine',
    policyActions,
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
    promptId: 'dialogue_engine_trap_v1',
    egoModel: null,
    superegoModel: null,
    suggestions: tutorTexts,
    rawResponse: JSON.stringify(summary),
    latencyMs,
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
    cost: totalCost,
    dialogueRounds: tutorTexts.length,
    deliberationRounds: 0,
    apiCalls: totalApiCalls,
    dialogueId,
    dialogueContentHash: contentHash,
    success: true,
    learnerArchitecture: 'scripted_trap',
    conversationMode: 'adaptive_trap',
    scoringMethod: 'pending',
  };
  evaluationStore.storeResult(runId, row);

  return { dialogueId, turns: perTurnTrace.length, policyActions };
}

function parseFlag(args, name, fallback = undefined) {
  const prefix = `--${name}=`;
  const hit = args.find((a) => a.startsWith(prefix));
  if (hit) return hit.slice(prefix.length);
  const idx = args.indexOf(`--${name}`);
  if (idx >= 0 && idx + 1 < args.length && !args[idx + 1].startsWith('--')) return args[idx + 1];
  return fallback;
}

export async function main(
  args = process.argv.slice(2),
  { rootDir = REPO_ROOT, env = process.env, evaluationStore = null, createStore } = {},
) {
  const profileName = parseFlag(args, 'profile', 'cell_114_dialogue_engine_trap_baseline');
  const scenarioFilter = parseFlag(args, 'scenarios');
  const runsPerConfig = Number(parseFlag(args, 'runs', '1'));
  // A malformed ceiling stops the baseline here. It used to fall through
  // `Number('abc') > 0` and run the whole thing with no ceiling at all.
  const maxCostUsd = resolveSpendCeiling(parseFlag(args, 'max-cost'));
  const resumeRunId = parseFlag(args, 'resume') || null;
  const verbose = args.includes('--verbose');

  const profile = evalConfigLoader.getTutorProfile(profileName);
  if (!profile) {
    throw new Error(`profile ${profileName} not found in tutor-agents.yaml`);
  }
  if (profile?.runner && profile.runner !== 'standard') {
    throw new Error(`profile ${profileName} has runner: ${profile.runner} — expected 'standard'`);
  }
  if (profile?.factors?.id_director === true) {
    throw new Error(`profile ${profileName} is an id-director cell — use scripts/run-id-director-trap-pilot.js`);
  }
  const egoBlock = profile.ego || {};
  const agentConfig = {
    provider: egoBlock.provider || 'openrouter',
    model: egoBlock.model || 'budget',
    hyperparameters: egoBlock.hyperparameters || {},
  };

  // Resolve the tutor-core base profile this cell maps to (prompt_type: base,
  // recognition_mode: false → 'budget') and pull its ego prompt. That prompt
  // is the treatment-neutral baseline; the cell's own ego block only carries
  // provider/model/hyperparameters, not prompt text.
  const { resolvedProfileName } = resolveEvalProfile(profileName);
  const baseEgoConfig = tutorConfig.getAgentConfig('ego', resolvedProfileName);
  const baseEgoPrompt = (baseEgoConfig?.prompt || '').trim();
  if (!baseEgoPrompt) {
    throw new Error(`could not resolve base ego prompt for ${profileName} (resolved profile: ${resolvedProfileName})`);
  }

  let scenarios = loadScenarios(profile.scenario_source || 'config/adaptive-trap-scenarios.yaml');
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
      // units this baseline set out to run.
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
        if (run.metadata?.architecture !== 'dialogue_engine') {
          throw new Error(`--resume: run ${resumeRunId} is not a dialogue-engine trap run`);
        }
        if ((run.metadata?.maxCostUsd ?? null) !== maxCostUsd) {
          throw new Error(
            `--resume: run ${resumeRunId} was launched with ceiling ${run.metadata?.maxCostUsd ?? 'none'}; ` +
              `pass the same --max-cost (got ${maxCostUsd ?? 'none'})`,
          );
        }
      } else {
        run = createAdaptiveRun({
          description: `dialogue-engine trap baseline (${profileName})`,
          totalScenarios: plannedUnits.length,
          profileName,
          llmMode: 'real',
          metadata: {
            profileName,
            scenarioSource: profile.scenario_source || 'config/adaptive-trap-scenarios.yaml',
            maxCostUsd,
            architecture: 'dialogue_engine',
            resolvedBaseProfile: resolvedProfileName,
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
        // Route realLLM (both the tutor ego-execute call and the scripted learner)
        // through the cell's provider/model. Without this, realLLM falls back to its
        // module-default config (OpenRouter), cross-routing a claude-code cell.
        realLLM.setActiveCellConfig({
          provider: agentConfig.provider,
          modelAlias: agentConfig.model,
          temperature: agentConfig.hyperparameters?.temperature,
          maxTokens: agentConfig.hyperparameters?.max_tokens,
        });

        tracker = bindRunLedger({
          evaluationStore: store,
          runId,
          maxCostUsd,
          verbose,
          label: 'dialogue-engine-trap',
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
          label: 'dialogue-engine-trap',
          verbose,
        });

        console.log(
          `[dialogue-engine-trap] runId=${runId} profile=${profileName} ` +
            `provider=${agentConfig.provider} model=${agentConfig.model} baseProfile=${resolvedProfileName} ` +
            `planned=${resumePlan.length} done=${completedUnitIds.size} pending=${pendingUnits.length}`,
        );

        const outcome = await executeMeteredUnits({
          units: pendingUnits,
          label: 'dialogue-engine-trap',
          verbose,
          execute: async (unit) => {
            const scenario = scenarios.find((candidate) => candidate.id === unit.scenarioId);
            if (!scenario) throw new Error(`scenario ${unit.scenarioId} is not in the scenario source`);
            const out = await runScenario({
              evaluationStore: store,
              runId,
              scenario: { ...scenario, id: unit.unitId },
              profileName,
              agentConfig,
              baseEgoPrompt,
              verbose,
            });
            console.log(
              `[dialogue-engine-trap]   ✓ ${unit.unitId} (turns=${out.turns}, policies=[${out.policyActions.join(', ')}], dialogue=${out.dialogueId})`,
            );
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
          `[dialogue-engine-trap] runId=${runId} persisted=${totalTests}/${resumePlan.length} ` +
            `failed=${outcome.failures.length}` +
            (budget
              ? ` budget=$${budget.accumulatedUsd.toFixed(4)}/$${budget.maxUsd.toFixed(2)} (${budget.utilizationPct.toFixed(1)}%)`
              : ''),
        );
        if (outcome.halted) {
          console.error(`[dialogue-engine-trap] halt reason: ${outcome.haltReason || '(unknown)'}`);
          return 2;
        }
        return 0;
      } finally {
        realLLM.clearActiveCellConfig();
        if (tracker) realLLM.clearActiveBudgetTracker();
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
      console.error('[dialogue-engine-trap] FATAL:', error);
      process.exitCode = 1;
    },
  );
}
