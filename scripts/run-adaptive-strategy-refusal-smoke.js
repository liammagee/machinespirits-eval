#!/usr/bin/env node

// Deterministic, zero-storage paired smoke for workplan item
// refusal-cross-stack-adaptive. It runs the first three v1 trap scenarios
// through the cell_110 state_policy topology with the strategy-refusal arm
// off and on. expected_strategy_shift is used only here, after generation,
// to score the existing strict endpoint; the graph gate never receives it.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import yaml from 'yaml';
import { runScenario } from '../services/adaptiveTutor/runner.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCENARIO_FILE = path.join(ROOT, 'config', 'adaptive-trap-scenarios.yaml');

export const STRATEGY_REFUSAL_SMOKE_SCENARIOS = Object.freeze([
  'false_confusion_v1',
  'polite_false_mastery_v1',
  'resistance_to_insight_v1',
]);

function toRunnerScenario(source) {
  return {
    id: source.id,
    hidden: {
      actualMisconception: source.hidden?.actual_misconception || '',
      actualSophistication: source.hidden?.actual_sophistication || 'intermediate',
      triggerTurn: source.hidden?.trigger_turn ?? 1,
      triggerSignal: source.hidden?.trigger_signal || '',
    },
    openingTurns: source.opening_turns || [],
    maxTurns: source.max_turns ?? 4,
  };
}

function acceptedActions(source) {
  const expected = source.expected_strategy_shift;
  return Array.isArray(expected) ? expected : [expected].filter(Boolean);
}

function actionAt(finalState, turn) {
  return (finalState.policyActionHistory || []).find((entry) => entry.turn === turn)?.action || null;
}

export async function runAdaptiveStrategyRefusalSmoke() {
  const document = yaml.parse(fs.readFileSync(SCENARIO_FILE, 'utf8'));
  const byId = new Map((document.scenarios || []).map((scenario) => [scenario.id, scenario]));
  const sources = STRATEGY_REFUSAL_SMOKE_SCENARIOS.map((id) => {
    const source = byId.get(id);
    if (!source) throw new Error(`strategy-refusal smoke scenario missing: ${id}`);
    return source;
  });

  const priorMode = process.env.ADAPTIVE_TUTOR_LLM;
  process.env.ADAPTIVE_TUTOR_LLM = 'mock';
  try {
    const scenarios = [];
    for (const source of sources) {
      const scenario = toRunnerScenario(source);
      const baseline = await runScenario(scenario, { architecture: 'state_policy' });
      const refusal = await runScenario(scenario, { architecture: 'state_policy_with_strategy_refusal' });
      const decisionTurn = scenario.hidden.triggerTurn + 1;
      const accepted = acceptedActions(source);
      const baselineAction = actionAt(baseline.final, decisionTurn);
      const refusalAction = actionAt(refusal.final, decisionTurn);
      const refusalDecision = refusal.final.strategyRefusal || null;

      scenarios.push({
        id: source.id,
        triggerTurn: scenario.hidden.triggerTurn,
        decisionTurn,
        acceptedActions: accepted,
        baselineAction,
        refusalAction,
        baselineStrictMatch: accepted.includes(baselineAction),
        refusalStrictMatch: accepted.includes(refusalAction),
        trapEvents: refusal.final.trapEvents || [],
        strategyRefusal: refusalDecision,
      });
    }

    const baselineStrictMatches = scenarios.filter((row) => row.baselineStrictMatch).length;
    const refusalStrictMatches = scenarios.filter((row) => row.refusalStrictMatch).length;
    const refusals = scenarios.filter((row) => row.strategyRefusal?.status === 'resolved').length;
    const unresolved = scenarios.filter((row) => row.strategyRefusal?.status === 'pending').length;
    const missingTrapEvents = scenarios.filter((row) => row.trapEvents.length !== 1).length;
    const falseActivations = scenarios.filter(
      (row) =>
        row.strategyRefusal?.status === 'resolved' &&
        row.strategyRefusal.previousAction !== row.strategyRefusal.proposedAction,
    ).length;
    const pass =
      baselineStrictMatches === 0 &&
      refusalStrictMatches === 1 &&
      refusals === 1 &&
      unresolved === 0 &&
      missingTrapEvents === 0 &&
      falseActivations === 0;

    return {
      contract: {
        llmMode: 'mock',
        storageWrites: false,
        baselineArchitecture: 'state_policy',
        refusalArchitecture: 'state_policy_with_strategy_refusal',
        endpoint: 'strategy_shift_correctness',
        scenarioFile: path.relative(ROOT, SCENARIO_FILE),
      },
      scenarios,
      summary: {
        scenarioCount: scenarios.length,
        baselineStrictMatches,
        refusalStrictMatches,
        refusals,
        unresolved,
        missingTrapEvents,
        falseActivations,
        pass,
      },
    };
  } finally {
    if (priorMode === undefined) delete process.env.ADAPTIVE_TUTOR_LLM;
    else process.env.ADAPTIVE_TUTOR_LLM = priorMode;
  }
}

async function main() {
  const report = await runAdaptiveStrategyRefusalSmoke();
  console.log(JSON.stringify(report, null, 2));
  if (!report.summary.pass) process.exitCode = 1;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
