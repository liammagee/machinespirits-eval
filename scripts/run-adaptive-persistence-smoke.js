#!/usr/bin/env node
// Smoke test for services/adaptiveTutor/persistence.js.
//
// Runs one scenario + counterfactual against the mock backend, persists
// to a temp evaluations.db, then re-reads to confirm the row + trace are
// retrievable. No paid API calls.

import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

import Database from 'better-sqlite3';
import { llmMode } from '../services/adaptiveTutor/llm.js';
import { createAdaptivePersistence } from '../services/adaptiveTutor/persistence.js';
import { runScenarioWithCounterfactual } from '../services/adaptiveTutor/runner.js';
import { withEvaluationScriptStore } from '../services/evaluationStore/scriptContext.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export async function main(
  _args = process.argv.slice(2),
  { rootDir = REPO_ROOT, env = process.env, evaluationStore = null, createStore } = {},
) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'adaptive-persist-'));
  const tmpDb = path.join(tmpDir, 'evaluations.db');
  const tmpLogs = path.join(tmpDir, 'logs');
  env.EVAL_DB_PATH = tmpDb;
  env.EVAL_LOGS_DIR = tmpLogs;
  env.ADAPTIVE_TUTOR_LLM = 'mock';
  fs.mkdirSync(path.join(tmpLogs, 'tutor-dialogues'), { recursive: true });

  const scenario = {
    id: 'smoke-persist-resistance',
    hidden: {
      actualMisconception: 'treats recognition as affirmation',
      actualSophistication: 'advanced',
      triggerTurn: 1,
      triggerSignal: 'But that only works if recognition reduces to affirmation, which is the very thing in dispute.',
    },
    openingTurns: [{ role: 'learner', content: 'Can you tell me what recognition means?' }],
    maxTurns: 3,
  };
  const scenarioConfig = {
    scenario_name: 'resistance_to_insight (smoke)',
    scenario_type: 'resistance_to_insight',
    expected_strategy_shift: 'scope_test',
  };
  const perturbation = {
    forkAtTurn: 1,
    hiddenOverrides: { actualSophistication: 'novice', triggerSignal: "I don't get it." },
  };

  const result = await runScenarioWithCounterfactual(scenario, perturbation);

  return withEvaluationScriptStore(
    async (store) => {
      const { createAdaptiveRun, persistScenarioWithCounterfactual } = createAdaptivePersistence({
        evaluationStore: store,
      });
      const run = createAdaptiveRun({
        description: 'persistence smoke',
        totalScenarios: 1,
        profileName: 'cell_X_langgraph_adaptive_smoke',
        llmMode: llmMode(),
      });
      console.log('created run:', run.id);

      const persisted = persistScenarioWithCounterfactual({
        runId: run.id,
        scenario,
        scenarioConfig,
        result,
        profileName: 'cell_X_langgraph_adaptive_smoke',
        agentConfig: { provider: 'mock', model: 'mock', hyperparameters: { temperature: 0, max_tokens: 0 } },
        llmMode: llmMode(),
      });
      console.log('persisted:', persisted);

      const fails = [];

      // 1. Row must round-trip from the DB. parseResultRow already deserialises
      // suggestions / hyperparameters; raw_response is fetched separately because
      // it isn't projected by getResults (kept as a write-only diagnostic blob).
      const rows = store.getResults(run.id);
      if (rows.length !== 1) fails.push(`expected 1 row, got ${rows.length}`);
      const row = rows[0];
      if (row.scenarioId !== scenario.id) fails.push(`scenarioId mismatch: ${row.scenarioId}`);
      if (row.profileName !== 'cell_X_langgraph_adaptive_smoke') fails.push(`profileName mismatch: ${row.profileName}`);
      if (row.dialogueId !== persisted.dialogueId) fails.push('dialogueId mismatch');
      if (row.scenarioType !== 'resistance_to_insight') fails.push(`scenarioType mismatch: ${row.scenarioType}`);
      if (!Array.isArray(row.suggestions) || row.suggestions.length === 0) fails.push('suggestions empty');

      // 2. Trace JSON file must exist and contain both branches.
      const tracePath = path.join(tmpLogs, 'tutor-dialogues', `${persisted.dialogueId}.json`);
      if (!fs.existsSync(tracePath)) fails.push(`trace file missing: ${tracePath}`);
      else {
        const trace = JSON.parse(fs.readFileSync(tracePath, 'utf-8'));
        if (!trace.original?.perTurn?.length) fails.push('trace.original.perTurn empty');
        if (!trace.counterfactual) fails.push('trace.counterfactual missing');
        if (!trace.scenario?.expectedStrategyShift) fails.push('trace.scenario.expectedStrategyShift missing');
        const policies = trace.original.perTurn.map((turn) => turn.tutorInternal?.policyAction).filter(Boolean);
        if (policies.length === 0) fails.push('no policy actions captured in original perTurn');
        console.log('trace original policies:', policies);
        const cfPolicies = trace.counterfactual.perTurn.map((turn) => turn.tutorInternal?.policyAction).filter(Boolean);
        console.log('trace counterfactual policies:', cfPolicies);
      }

      // 3. raw_response (summary) must include scenario id and policy actions.
      // Read directly off the DB since parseResultRow doesn't project raw_response.
      const db = new Database(tmpDb, { readonly: true });
      const rawRow = db.prepare('SELECT raw_response FROM evaluation_results WHERE run_id = ?').get(run.id);
      db.close();
      const summary = JSON.parse(rawRow.raw_response);
      if (summary.scenarioId !== scenario.id) fails.push('summary.scenarioId mismatch');
      if (!summary.policyActions || summary.policyActions.length === 0) fails.push('summary.policyActions empty');
      if (!summary.counterfactual?.policyActions?.length) fails.push('summary.counterfactual.policyActions empty');

      if (fails.length) {
        console.error('\nPERSISTENCE SMOKE FAILED:');
        for (const failure of fails) console.error('  -', failure);
        return 1;
      }
      console.log('\nPERSISTENCE SMOKE PASSED');
      console.log('temp dir:', tmpDir);
      return 0;
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
      console.error('[adaptive-persistence-smoke] FATAL:', error);
      process.exitCode = 1;
    },
  );
}
