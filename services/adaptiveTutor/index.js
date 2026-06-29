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
import { createAdaptiveRun, persistScenarioWithCounterfactual, persistScenarioRun } from './persistence.js';
import { createBudgetTracker } from './budgetTracker.js';
import {
  setActiveBudgetTracker,
  clearActiveBudgetTracker,
  setActiveCellConfig,
  clearActiveCellConfig,
} from './realLLM.js';
import { SUPPORTED_ARCHITECTURES } from './graph.js';
import * as evaluationStore from '../evaluationStore.js';

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

export async function runAdaptiveEvaluation({
  profileName,
  evalProfile,
  scenarios: scenarioFilter = 'all',
  runsPerConfig = 1,
  description = null,
  dryRun = false,
  verbose = false,
  maxCostUsd = null,
} = {}) {
  if (!profileName || !evalProfile) {
    throw new Error('runAdaptiveEvaluation requires profileName and evalProfile');
  }
  if (evalProfile.runner !== 'adaptive') {
    throw new Error(`profile ${profileName} is not an adaptive runner (runner=${evalProfile.runner ?? 'undefined'})`);
  }

  // dryRun forces mock backend, so ad-hoc shake-out runs cost nothing.
  if (dryRun) process.env.ADAPTIVE_TUTOR_LLM = 'mock';

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
  const graphOptionsBase = { architecture, adaptationPolicyMode };
  const agentConfigForRow = {
    provider: adaptiveCfg.provider || 'mock',
    model: adaptiveCfg.model || 'mock',
    hyperparameters: adaptiveCfg.hyperparameters || {},
  };

  const totalScenarios = scenarios.length * runsPerConfig;
  const run = createAdaptiveRun({
    description: description || `adaptive (${profileName}, ${llmMode()})`,
    totalScenarios,
    profileName,
    llmMode: llmMode(),
    metadata: {
      profileNames: [profileName],
      scenarioSource,
      scenarioFilter,
      maxCostUsd,
      architecture,
      adaptationPolicyMode,
      adaptivePolicy,
      worldAdaptationSource,
    },
  });
  if (verbose)
    console.log(
      `[adaptive] runId=${run.id} scenarios=${scenarios.length} runsPerConfig=${runsPerConfig} architecture=${architecture} policy=${adaptationPolicyMode} llmMode=${llmMode()}`,
    );

  // Budget tracker is bound when --max-cost is set. Mock runs ignore it.
  let tracker = null;
  if (maxCostUsd != null && maxCostUsd > 0 && llmMode() !== 'mock') {
    tracker = createBudgetTracker({ maxUsd: maxCostUsd });
    setActiveBudgetTracker(tracker);
    if (verbose) console.log(`[adaptive] budget ceiling: $${maxCostUsd.toFixed(2)}`);
  }

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

  const persisted = [];
  let halted = false;
  let haltReason = null;

  try {
    outer: for (const yamlScenario of scenarios) {
      for (let r = 0; r < runsPerConfig; r++) {
        const scenario = toRunnerScenario(yamlScenario, r);
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
              runId: run.id,
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
              runId: run.id,
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
          if (err?.code === 'BUDGET_EXCEEDED') {
            halted = true;
            haltReason = err.message;
            console.error(`[adaptive] BUDGET HALT on ${scenario.id}: ${err.message}`);
            break outer;
          }
          console.error(`[adaptive]   ✗ ${scenario.id}: ${err.message}`);
          if (verbose) console.error(err.stack);
        }
      }
    }
  } finally {
    if (tracker) clearActiveBudgetTracker();
    clearActiveCellConfig();
  }

  evaluationStore.updateRun(run.id, {
    status: halted ? 'halted_budget' : 'completed',
    totalTests: persisted.length,
    completedAt: new Date().toISOString(),
  });

  return {
    runId: run.id,
    persisted,
    totalScenarios,
    llmMode: llmMode(),
    halted,
    haltReason,
    budget: tracker ? tracker.summary() : null,
  };
}
