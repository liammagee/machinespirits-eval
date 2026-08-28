// Public entry point for the adaptive cell.
//
// `runAdaptiveEvaluation` is the function eval-cli.js dispatches to when
// the selected profile carries `runner: adaptive` in tutor-agents.yaml.
// It intentionally does NOT take the full runEvaluation option surface —
// the adaptive runner is a different beast (different scenario format,
// different output shape, no rubric judge), so most of those flags don't
// apply. The ones that do (dryRun → mock; runsPerConfig; description)
// are honoured.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'yaml';
import { runScenario, runScenarioWithCounterfactual } from './runner.js';
import { llmMode } from './llm.js';
import { assertWorldAdaptationSpecUsable, summarizeWorldAdaptationSpec } from './actionPolicy.js';
import { createAdaptivePersistence } from './persistence.js';
import { createBudgetTracker } from './budgetTracker.js';
import {
  setActiveBudgetTracker,
  clearActiveBudgetTracker,
  setActiveCellConfig,
  clearActiveCellConfig,
} from './realLLM.js';
import { SUPPORTED_ARCHITECTURES } from './graph.js';
import { getDefaultEvaluationStore } from '../evaluationStore/lifecycle.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');

function loadScenarios(scenarioSource) {
  const abs = path.isAbsolute(scenarioSource) ? scenarioSource : path.join(REPO_ROOT, scenarioSource);
  if (!fs.existsSync(abs)) {
    throw new Error(`adaptive scenario source not found: ${abs}`);
  }
  const raw = yaml.parse(fs.readFileSync(abs, 'utf-8'));
  const list = Array.isArray(raw?.scenarios) ? raw.scenarios : Array.isArray(raw) ? raw : [];
  if (list.length === 0) throw new Error(`no scenarios in ${abs}`);
  return list;
}

function loadWorldAdaptationSpecs(specSource) {
  if (!specSource) return [];
  const abs = path.isAbsolute(specSource) ? specSource : path.join(REPO_ROOT, specSource);
  if (!fs.existsSync(abs)) {
    throw new Error(`world adaptation spec source not found: ${abs}`);
  }
  const raw = yaml.parse(fs.readFileSync(abs, 'utf-8'));
  const list = Array.isArray(raw?.world_adaptation_specs)
    ? raw.world_adaptation_specs
    : Array.isArray(raw?.worlds)
      ? raw.worlds
      : Array.isArray(raw)
        ? raw
        : [];
  if (list.length === 0) throw new Error(`no world adaptation specs in ${abs}`);
  return list;
}

function applyScenarioFilter(scenarios, filter) {
  if (!filter || filter === 'all') return scenarios;
  const wanted = Array.isArray(filter)
    ? new Set(filter)
    : new Set(
        String(filter)
          .split(',')
          .map((s) => s.trim()),
      );
  return scenarios.filter((s) => wanted.has(s.id) || wanted.has(s.scenario_type));
}

// Map the YAML scenario shape onto the runner's scenario shape. Keep a copy
// of the YAML config alongside so persistence can record expected_strategy_shift.
function toRunnerScenario(yamlScenario, runIndex) {
  return {
    id: runIndex > 0 ? `${yamlScenario.id}__r${runIndex}` : yamlScenario.id,
    hidden: {
      actualMisconception: yamlScenario.hidden?.actual_misconception || '',
      actualSophistication: yamlScenario.hidden?.actual_sophistication || 'intermediate',
      triggerTurn: yamlScenario.hidden?.trigger_turn ?? 1,
      triggerSignal: yamlScenario.hidden?.trigger_signal || '',
      scriptedResponses: yamlScenario.hidden?.scripted_responses || yamlScenario.scripted_responses || {},
    },
    openingTurns: yamlScenario.opening_turns || [{ role: 'learner', content: yamlScenario.opening || 'Hi.' }],
    maxTurns: yamlScenario.max_turns ?? 4,
  };
}

function resolveWorldAdaptationSpec(yamlScenario, worldSpecs = []) {
  if (yamlScenario.world_adaptation_spec) return yamlScenario.world_adaptation_spec;
  const specId =
    yamlScenario.world_adaptation_spec_id ||
    yamlScenario.world_adaptation_id ||
    yamlScenario.world_id ||
    yamlScenario.curriculum_binding?.world_adaptation_spec_id ||
    null;
  const moduleId =
    yamlScenario.curriculum_module_id ||
    yamlScenario.curriculum?.module_id ||
    yamlScenario.curriculum_binding?.module_id ||
    null;

  if (specId) {
    const found = worldSpecs.find((spec) => spec.id === specId);
    if (!found) throw new Error(`scenario ${yamlScenario.id}: no world adaptation spec id ${specId}`);
    return found;
  }
  if (moduleId) {
    const found = worldSpecs.find((spec) => spec.module_id === moduleId);
    if (!found) throw new Error(`scenario ${yamlScenario.id}: no world adaptation spec for module ${moduleId}`);
    return found;
  }
  return null;
}

function resistancePolicyForScenario(yamlScenario = {}) {
  const target = yamlScenario.resistance_signal_target || yamlScenario.resistanceSignalTarget || '';
  const gate = yamlScenario.resistance_signal_gate || yamlScenario.resistanceSignalGate || [];
  const enabled =
    yamlScenario.resistance_breakthrough_diagnostic === true ||
    Boolean(target) ||
    (Array.isArray(gate) && gate.length > 0);
  if (!enabled) return {};
  return {
    resistance_signal_policy: true,
    ...(target ? { resistance_signal_target: target } : {}),
    ...(Array.isArray(gate) && gate.length > 0 ? { resistance_signal_gate: gate } : {}),
  };
}

function adaptivePolicyForScenario(yamlScenario = {}) {
  const policy = yamlScenario.adaptive_policy || yamlScenario.adaptivePolicy || {};
  return policy && typeof policy === 'object' && !Array.isArray(policy) ? policy : {};
}

function buildPerturbation(yamlScenario) {
  const cf = yamlScenario.counterfactual;
  if (!cf) return null;
  return {
    forkAtTurn: cf.fork_at_turn ?? yamlScenario.hidden?.trigger_turn ?? 1,
    hiddenOverrides: {
      actualMisconception: cf.actual_misconception ?? undefined,
      actualSophistication: cf.actual_sophistication ?? undefined,
      triggerSignal: cf.trigger_signal ?? undefined,
    },
  };
}

// The unit of adaptive work is one (scenario, repetition) pair. Its `unitId` is
// the runner scenario id, which is also the `scenarioId` written on the stored
// row — so a persisted row and a planned unit share one identity, and resume
// can subtract one set from the other without re-deriving anything.
function buildPlannedUnits(scenarios, runsPerConfig) {
  const units = [];
  for (const yamlScenario of scenarios) {
    for (let runIndex = 0; runIndex < runsPerConfig; runIndex++) {
      units.push({
        scenarioId: yamlScenario.id,
        runIndex,
        unitId: toRunnerScenario(yamlScenario, runIndex).id,
      });
    }
  }
  return units;
}

// Resolve everything a run needs from its profile without touching the store,
// the environment, or a provider. Both the first execution and a later resume
// call this, so a resumed run cannot drift onto different policy resolution.
function prepareAdaptiveExecution({ profileName, evalProfile, scenarioFilter = 'all', runsPerConfig = 1 } = {}) {
  if (!profileName || !evalProfile) {
    throw new Error('adaptive execution requires profileName and evalProfile');
  }
  if (evalProfile.runner !== 'adaptive') {
    throw new Error(`profile ${profileName} is not an adaptive runner (runner=${evalProfile.runner ?? 'undefined'})`);
  }

  const scenarioSource = evalProfile.scenario_source;
  if (!scenarioSource) throw new Error(`profile ${profileName} has no scenario_source`);

  const scenarios = applyScenarioFilter(loadScenarios(scenarioSource), scenarioFilter);
  const counterfactualEnabled = evalProfile.adaptive?.counterfactual?.enabled ?? true;
  const adaptiveCfg = evalProfile.adaptive ?? {};
  const adaptivePolicy = {
    ...(evalProfile.adaptive_policy || {}),
    ...(adaptiveCfg.policy || {}),
    ...(adaptiveCfg.adaptive_policy || {}),
  };
  const worldAdaptationSource =
    adaptiveCfg.world_adaptation_source ||
    adaptiveCfg.worldAdaptationSource ||
    adaptivePolicy.world_adaptation_source ||
    adaptivePolicy.worldAdaptationSource ||
    null;
  const worldAdaptationSpecs = loadWorldAdaptationSpecs(worldAdaptationSource);
  const adaptationPolicyMode = process.env.ADAPTIVE_POLICY_MODE || adaptivePolicy.mode || 'legacy';
  // Architecture switches the graph topology. Defaults to 'state_policy' so
  // legacy cell_110 configs (which don't carry an architecture key) keep their
  // original semantics. Validated here so a typo in the cell config produces
  // an immediate error rather than silently falling back to default.
  const architecture = adaptiveCfg.architecture ?? 'state_policy';
  if (!SUPPORTED_ARCHITECTURES.includes(architecture)) {
    throw new Error(
      `profile ${profileName}: unsupported adaptive.architecture "${architecture}" (expected one of: ${SUPPORTED_ARCHITECTURES.join(', ')})`,
    );
  }

  return {
    profileName,
    scenarioSource,
    scenarioFilter,
    runsPerConfig,
    scenarios,
    scenariosById: new Map(scenarios.map((scenario) => [scenario.id, scenario])),
    plannedUnits: buildPlannedUnits(scenarios, runsPerConfig),
    counterfactualEnabled,
    adaptiveCfg,
    adaptivePolicy,
    worldAdaptationSource,
    worldAdaptationSpecs,
    adaptationPolicyMode,
    architecture,
    graphOptionsBase: { architecture, adaptationPolicyMode },
    agentConfigForRow: {
      provider: adaptiveCfg.provider || 'mock',
      model: adaptiveCfg.model || 'mock',
      hyperparameters: adaptiveCfg.hyperparameters || {},
    },
  };
}

// Execute a list of planned units against one already-created run. The caller
// owns run creation, the budget tracker, and finalization; this owns only the
// loop, so the first execution and a resume cannot diverge.
async function executeAdaptiveUnits({ prepared, runId, units, tracker, persistence, verbose = false }) {
  const {
    profileName,
    scenariosById,
    counterfactualEnabled,
    adaptiveCfg,
    adaptivePolicy,
    worldAdaptationSpecs,
    graphOptionsBase,
    agentConfigForRow,
  } = prepared;
  const { persistScenarioRun, persistScenarioWithCounterfactual } = persistence;

  const persisted = [];
  const unresolvedUnitIds = [];
  let halted = false;
  let haltReason = null;
  let haltCode = null;

  if (tracker) setActiveBudgetTracker(tracker);

  // Make the cell's adaptive block actually drive the LLM call. Without this
  // the YAML provider/model fields landed on the stored row but the call still
  // routed via DEFAULT_MODEL_ALIAS/DEFAULT_PROVIDER (or env-var overrides).
  // Per-role env vars still override the cell config inside envFor().
  if (llmMode() !== 'mock') {
    setActiveCellConfig({
      provider: adaptiveCfg.provider,
      modelAlias: adaptiveCfg.model,
      temperature: adaptiveCfg.hyperparameters?.temperature,
      maxTokens: adaptiveCfg.hyperparameters?.max_tokens,
    });
    if (verbose)
      console.log(
        `[adaptive] cell-config: provider=${adaptiveCfg.provider || '(default)'} model=${adaptiveCfg.model || '(default)'}`,
      );
  }

  try {
    for (const unit of units) {
      const yamlScenario = scenariosById.get(unit.scenarioId);
      if (!yamlScenario) {
        // A planned unit whose scenario has left the source cannot be executed.
        // Report it rather than counting the run complete without it.
        unresolvedUnitIds.push(unit.unitId);
        console.error(`[adaptive]   ✗ ${unit.unitId}: scenario ${unit.scenarioId} is not in the scenario source`);
        continue;
      }
      const scenario = toRunnerScenario(yamlScenario, unit.runIndex);
      const scenarioConfig = {
        scenario_name: yamlScenario.name || yamlScenario.id,
        scenario_type: yamlScenario.scenario_type || yamlScenario.id,
        expected_strategy_shift: yamlScenario.expected_strategy_shift ?? null,
      };
      try {
        // World-spec resolution must stay inside the per-scenario try:
        // resolveWorldAdaptationSpec throws when a world_adaptation_spec_id /
        // world_id / curriculum_module_id matches no loaded spec. Outside this try,
        // that throw escapes the catch-less outer try and skips run finalization,
        // leaving the run stuck at status='running'. Inside, a bad reference degrades
        // to a logged per-scenario skip and the run still finalizes.
        const worldAdaptationSpec =
          resolveWorldAdaptationSpec(yamlScenario, worldAdaptationSpecs) ||
          adaptivePolicy.world_adaptation_spec ||
          adaptivePolicy.worldAdaptationSpec ||
          null;
        // Fail loud on a misspelled action family rather than running with a silently
        // disabled (fail-open) lock; caught below as a per-scenario skip.
        assertWorldAdaptationSpecUsable(worldAdaptationSpec);
        const scenarioAdaptivePolicy = {
          ...adaptivePolicy,
          ...adaptivePolicyForScenario(yamlScenario),
          ...resistancePolicyForScenario(yamlScenario),
          ...(worldAdaptationSpec ? { world_adaptation_spec: worldAdaptationSpec } : {}),
        };
        const scenarioGraphOptions = { ...graphOptionsBase, adaptivePolicy: scenarioAdaptivePolicy };
        const scenarioWorldSummary = summarizeWorldAdaptationSpec(worldAdaptationSpec);
        if (scenarioWorldSummary) scenarioConfig.world_adaptation_spec = scenarioWorldSummary;
        if (scenarioAdaptivePolicy.resistance_signal_target) {
          scenarioConfig.resistance_signal_target = scenarioAdaptivePolicy.resistance_signal_target;
        }
        // Snapshot before / delta after lets us write per-scenario tokens
        // and cost into the row while keeping the run-wide accumulator
        // (which enforces --max-cost) intact.
        const snap = tracker?.snapshot();
        if (counterfactualEnabled && yamlScenario.counterfactual) {
          const result = await runScenarioWithCounterfactual(
            scenario,
            buildPerturbation(yamlScenario),
            scenarioGraphOptions,
          );
          const usage = tracker?.delta(snap);
          const out = persistScenarioWithCounterfactual({
            runId,
            scenario,
            scenarioConfig,
            result,
            profileName,
            agentConfig: agentConfigForRow,
            llmMode: llmMode(),
            usage,
          });
          persisted.push(out);
        } else {
          const result = await runScenario(scenario, scenarioGraphOptions);
          const usage = tracker?.delta(snap);
          const out = persistScenarioRun({
            runId,
            scenario,
            scenarioConfig,
            runResult: result,
            profileName,
            agentConfig: agentConfigForRow,
            llmMode: llmMode(),
            usage,
          });
          persisted.push(out);
        }
        if (verbose) console.log(`[adaptive]   ✓ ${scenario.id}`);
      } catch (err) {
        if (err?.code === 'BUDGET_EXCEEDED' || err?.code === 'BUDGET_LEDGER_PERSISTENCE') {
          halted = true;
          haltReason = err.message;
          haltCode = err.code;
          const haltLabel = err.code === 'BUDGET_EXCEEDED' ? 'BUDGET' : 'BUDGET LEDGER';
          console.error(`[adaptive] ${haltLabel} HALT on ${scenario.id}: ${err.message}`);
          break;
        }
        console.error(`[adaptive]   ✗ ${scenario.id}: ${err.message}`);
        if (verbose) console.error(err.stack);
      }
    }
  } finally {
    if (tracker) clearActiveBudgetTracker();
    clearActiveCellConfig();
  }

  return { persisted, halted, haltReason, haltCode, unresolvedUnitIds };
}

function finalizeAdaptiveRun({ evaluationStore, runId, halted, haltCode, totalTests }) {
  evaluationStore.updateRun(runId, {
    status: halted
      ? haltCode === 'BUDGET_LEDGER_PERSISTENCE'
        ? 'halted_budget_ledger'
        : 'halted_budget'
      : 'completed',
    totalTests,
    completedAt: new Date().toISOString(),
  });
}

// Bind the run's ceiling to its own durable ledger. `initializeBudgetLedger`
// is idempotent on (runId, maxUsd), so a resume reopens the same ledger and
// inherits every reservation the interrupted attempt already booked.
function bindBudgetTracker({ evaluationStore, runId, maxCostUsd, verbose, finalizeOnFailure = true }) {
  if (maxCostUsd == null || !(maxCostUsd > 0) || llmMode() === 'mock') return null;
  try {
    const tracker = createBudgetTracker({ maxUsd: maxCostUsd, runId, ledgerStore: evaluationStore });
    if (verbose) console.log(`[adaptive] budget ceiling: $${maxCostUsd.toFixed(2)}`);
    return tracker;
  } catch (error) {
    if (finalizeOnFailure) {
      evaluationStore.updateRun(runId, {
        status: 'halted_budget_ledger',
        totalTests: 0,
        completedAt: new Date().toISOString(),
      });
    }
    throw error;
  }
}

export async function runAdaptiveEvaluation({
  profileName,
  evalProfile,
  scenarios: scenarioFilter = 'all',
  runsPerConfig = 1,
  description = null,
  dryRun = false,
  verbose = false,
  maxCostUsd = null,
  evaluationStore: suppliedEvaluationStore = null,
} = {}) {
  if (!profileName || !evalProfile) {
    throw new Error('runAdaptiveEvaluation requires profileName and evalProfile');
  }

  // dryRun forces mock backend, so ad-hoc shake-out runs cost nothing.
  if (dryRun) process.env.ADAPTIVE_TUTOR_LLM = 'mock';

  const prepared = prepareAdaptiveExecution({ profileName, evalProfile, scenarioFilter, runsPerConfig });
  const evaluationStore = suppliedEvaluationStore || getDefaultEvaluationStore();
  const persistence = createAdaptivePersistence({ evaluationStore });

  const totalScenarios = prepared.plannedUnits.length;
  const run = persistence.createAdaptiveRun({
    description: description || `adaptive (${profileName}, ${llmMode()})`,
    totalScenarios,
    profileName,
    llmMode: llmMode(),
    metadata: {
      profileNames: [profileName],
      scenarioSource: prepared.scenarioSource,
      scenarioFilter,
      // Recorded so `eval-cli resume` can rebuild the identical plan and
      // execute only what is missing, under the original ceiling.
      runsPerConfig,
      dryRun,
      plannedUnits: prepared.plannedUnits,
      maxCostUsd,
      architecture: prepared.architecture,
      adaptationPolicyMode: prepared.adaptationPolicyMode,
      adaptivePolicy: prepared.adaptivePolicy,
      worldAdaptationSource: prepared.worldAdaptationSource,
    },
  });
  if (verbose)
    console.log(
      `[adaptive] runId=${run.id} scenarios=${prepared.scenarios.length} runsPerConfig=${runsPerConfig} architecture=${prepared.architecture} policy=${prepared.adaptationPolicyMode} llmMode=${llmMode()}`,
    );

  const tracker = bindBudgetTracker({ evaluationStore, runId: run.id, maxCostUsd, verbose });

  const outcome = await executeAdaptiveUnits({
    prepared,
    runId: run.id,
    units: prepared.plannedUnits,
    tracker,
    persistence,
    verbose,
  });

  finalizeAdaptiveRun({
    evaluationStore,
    runId: run.id,
    halted: outcome.halted,
    haltCode: outcome.haltCode,
    totalTests: outcome.persisted.length,
  });

  return {
    runId: run.id,
    persisted: outcome.persisted,
    totalScenarios,
    llmMode: llmMode(),
    halted: outcome.halted,
    haltReason: outcome.haltReason,
    haltCode: outcome.haltCode,
    budget: tracker ? tracker.summary() : null,
  };
}

// Resume an interrupted adaptive run in place: same run id, same ceiling, only
// the planned units that never produced a row. The generic resume path cannot
// do this — it rebuilds standard suggestion tests from the shared scenario
// catalogue, which holds none of the adaptive trap scenarios.
export async function resumeAdaptiveEvaluation({
  runId,
  evalProfile = null,
  verbose = false,
  evaluationStore: suppliedEvaluationStore = null,
  loadEvalProfile = null,
} = {}) {
  if (!runId) throw new Error('resumeAdaptiveEvaluation requires a runId');
  const evaluationStore = suppliedEvaluationStore || getDefaultEvaluationStore();

  const run = evaluationStore.getRun(runId);
  if (!run) throw new Error(`Run not found: ${runId}`);
  const metadata = run.metadata || {};
  if (metadata.kind !== 'adaptive_trap') {
    throw new Error(`Run ${runId} is not an adaptive run (kind=${metadata.kind ?? 'undefined'})`);
  }

  const profileName = metadata.profileName || metadata.profileNames?.[0];
  if (!profileName) throw new Error(`Run ${runId} records no adaptive profile name`);
  const profile = evalProfile || loadEvalProfile?.(profileName);
  if (!profile) throw new Error(`Cannot resume ${runId}: no profile config supplied for ${profileName}`);

  // The recorded mode governs the resume. A dry run stays mock on resume, and a
  // paid run cannot be silently downgraded into one by a stray env var.
  if (metadata.dryRun) process.env.ADAPTIVE_TUTOR_LLM = 'mock';

  const runsPerConfig = metadata.runsPerConfig || 1;
  const prepared = prepareAdaptiveExecution({
    profileName,
    evalProfile: profile,
    scenarioFilter: metadata.scenarioFilter ?? 'all',
    runsPerConfig,
  });

  // Prefer the plan recorded at launch. Runs created before the plan was
  // recorded fall back to the plan the same profile + filter rebuilds now.
  const plannedUnits =
    Array.isArray(metadata.plannedUnits) && metadata.plannedUnits.length
      ? metadata.plannedUnits
      : prepared.plannedUnits;

  const completedUnitIds = new Set(
    evaluationStore
      .getResults(runId)
      .map((row) => row.scenarioId || row.scenario_id)
      .filter(Boolean),
  );
  const missingUnits = plannedUnits.filter((unit) => !completedUnitIds.has(unit.unitId));

  if (missingUnits.length === 0) {
    return {
      runId,
      alreadyComplete: true,
      persisted: [],
      totalScenarios: plannedUnits.length,
      resumedUnits: 0,
      llmMode: llmMode(),
      halted: false,
      haltReason: null,
      haltCode: null,
      budget: null,
    };
  }

  if (verbose)
    console.log(
      `[adaptive] resume runId=${runId} planned=${plannedUnits.length} done=${completedUnitIds.size} missing=${missingUnits.length} llmMode=${llmMode()}`,
    );

  // The ceiling is the one the run was launched under. Reopening the ledger
  // rehydrates the interrupted attempt's pending and settled exposure, so the
  // resume continues under the original budget rather than a fresh one.
  const tracker = bindBudgetTracker({
    evaluationStore,
    runId,
    maxCostUsd: metadata.maxCostUsd ?? null,
    verbose,
    finalizeOnFailure: false,
  });

  const outcome = await executeAdaptiveUnits({
    prepared,
    runId,
    units: missingUnits,
    tracker,
    persistence: createAdaptivePersistence({ evaluationStore }),
    verbose,
  });

  finalizeAdaptiveRun({
    evaluationStore,
    runId,
    halted: outcome.halted,
    haltCode: outcome.haltCode,
    totalTests: completedUnitIds.size + outcome.persisted.length,
  });

  return {
    runId,
    alreadyComplete: false,
    persisted: outcome.persisted,
    totalScenarios: plannedUnits.length,
    resumedUnits: missingUnits.length,
    unresolvedUnitIds: outcome.unresolvedUnitIds,
    llmMode: llmMode(),
    halted: outcome.halted,
    haltReason: outcome.haltReason,
    haltCode: outcome.haltCode,
    budget: tracker ? tracker.summary() : null,
  };
}

export function createAdaptiveEvaluationRunner({ evaluationStore } = {}) {
  if (!evaluationStore || typeof evaluationStore !== 'object') {
    throw new TypeError('evaluationStore dependency is required');
  }
  return Object.freeze({
    runAdaptiveEvaluation: (options) => runAdaptiveEvaluation({ ...options, evaluationStore }),
    resumeAdaptiveEvaluation: (options) => resumeAdaptiveEvaluation({ ...options, evaluationStore }),
  });
}
