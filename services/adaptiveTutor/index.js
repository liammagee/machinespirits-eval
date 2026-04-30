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
import { createAdaptiveRun, persistScenarioWithCounterfactual, persistScenarioRun } from './persistence.js';
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

function applyScenarioFilter(scenarios, filter) {
  if (!filter || filter === 'all') return scenarios;
  const wanted = Array.isArray(filter) ? new Set(filter) : new Set(String(filter).split(',').map((s) => s.trim()));
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
    },
    openingTurns: yamlScenario.opening_turns || [{ role: 'learner', content: yamlScenario.opening || 'Hi.' }],
    maxTurns: yamlScenario.max_turns ?? 4,
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
    metadata: { profileNames: [profileName], scenarioSource, scenarioFilter },
  });
  if (verbose) console.log(`[adaptive] runId=${run.id} scenarios=${scenarios.length} runsPerConfig=${runsPerConfig} llmMode=${llmMode()}`);

  const persisted = [];
  for (const yamlScenario of scenarios) {
    for (let r = 0; r < runsPerConfig; r++) {
      const scenario = toRunnerScenario(yamlScenario, r);
      const scenarioConfig = {
        scenario_name: yamlScenario.name || yamlScenario.id,
        scenario_type: yamlScenario.scenario_type || yamlScenario.id,
        expected_strategy_shift: yamlScenario.expected_strategy_shift ?? null,
      };
      try {
        if (counterfactualEnabled && yamlScenario.counterfactual) {
          const result = await runScenarioWithCounterfactual(scenario, buildPerturbation(yamlScenario));
          const out = persistScenarioWithCounterfactual({
            runId: run.id, scenario, scenarioConfig, result, profileName, agentConfig: agentConfigForRow, llmMode: llmMode(),
          });
          persisted.push(out);
        } else {
          const result = await runScenario(scenario);
          const out = persistScenarioRun({
            runId: run.id, scenario, scenarioConfig, runResult: result, profileName, agentConfig: agentConfigForRow, llmMode: llmMode(),
          });
          persisted.push(out);
        }
        if (verbose) console.log(`[adaptive]   ✓ ${scenario.id}`);
      } catch (err) {
        console.error(`[adaptive]   ✗ ${scenario.id}: ${err.message}`);
        if (verbose) console.error(err.stack);
      }
    }
  }

  evaluationStore.updateRun(run.id, {
    status: 'completed',
    totalTests: persisted.length,
    completedAt: new Date().toISOString(),
  });

  return { runId: run.id, persisted, totalScenarios, llmMode: llmMode() };
}
