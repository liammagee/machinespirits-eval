#!/usr/bin/env node
// End-to-end smoke for the adaptive cell registration.
//
// Exercises runAdaptiveEvaluation against cell_110_langgraph_adaptive
// (loaded from config/tutor-agents.yaml + config/adaptive-trap-scenarios.yaml)
// in an isolated tmp DB. Bypasses eval-cli to keep the smoke scoped to
// the adaptive runner only; eval-cli's dispatch path can be exercised
// manually with:
//   node scripts/eval-cli.js run --profiles cell_110_langgraph_adaptive --runs 1 --dry-run
//
// No paid API calls.

import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

import * as evalConfigLoader from '../services/evalConfigLoader.js';
import { createAdaptiveEvaluationRunner } from '../services/adaptiveTutor/index.js';
import { withEvaluationScriptStore } from '../services/evaluationStore/scriptContext.js';
import yaml from 'yaml';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export async function main(
  args = process.argv.slice(2),
  { rootDir = REPO_ROOT, env = process.env, evaluationStore = null, createStore } = {},
) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'adaptive-cell-'));
  env.EVAL_DB_PATH = path.join(tmpDir, 'evaluations.db');
  env.EVAL_LOGS_DIR = path.join(tmpDir, 'logs');
  env.ADAPTIVE_TUTOR_LLM = 'mock';
  fs.mkdirSync(path.join(env.EVAL_LOGS_DIR, 'tutor-dialogues'), { recursive: true });

  const profileName = args[0] || 'cell_110_langgraph_adaptive';
  const evalProfile = evalConfigLoader.loadTutorAgents()?.profiles?.[profileName];
  if (!evalProfile) throw new Error(`profile ${profileName} not found in tutor-agents.yaml`);
  if (evalProfile.runner !== 'adaptive') throw new Error(`profile ${profileName} not marked runner=adaptive`);

  return withEvaluationScriptStore(
    async (store) => {
      const { runAdaptiveEvaluation } = createAdaptiveEvaluationRunner({ evaluationStore: store });
      const summary = await runAdaptiveEvaluation({
        profileName,
        evalProfile,
        scenarios: 'all',
        runsPerConfig: 1,
        description: `${profileName} smoke`,
        dryRun: true,
        verbose: true,
      });

      console.log('\n--- summary ---');
      console.log(JSON.stringify(summary, null, 2));

      const fails = [];
      const rows = store.getResults(summary.runId);
      if (rows.length === 0) fails.push('no rows persisted');

      // Derive expected scenario types from the profile's scenario_source so the
      // smoke works for v1 (config/adaptive-trap-scenarios.yaml) and v2 cells alike.
      const scenarioSource = evalProfile.scenario_source || 'config/adaptive-trap-scenarios.yaml';
      const scenariosFile = fs.readFileSync(path.resolve(rootDir, scenarioSource), 'utf8');
      const scenariosDoc = yaml.parse(scenariosFile);
      const expectedScenarioTypes = new Set((scenariosDoc?.scenarios || []).map((s) => s.scenario_type || s.id));
      const seenTypes = new Set();
      for (const row of rows) {
        if (row.profileName !== profileName)
          fails.push(`profileName mismatch on ${row.scenarioId}: ${row.profileName}`);
        if (!expectedScenarioTypes.has(row.scenarioType))
          fails.push(`unexpected scenarioType on ${row.scenarioId}: ${row.scenarioType}`);
        seenTypes.add(row.scenarioType);
        if (!row.dialogueId) fails.push(`no dialogueId on ${row.scenarioId}`);
        if (!Array.isArray(row.suggestions) || row.suggestions.length === 0)
          fails.push(`suggestions empty on ${row.scenarioId}`);
      }
      const missing = [...expectedScenarioTypes].filter((type) => !seenTypes.has(type));
      if (missing.length) fails.push(`missing scenario types: ${missing.join(', ')}`);

      if (fails.length) {
        console.error('\nCELL SMOKE FAILED:');
        for (const failure of fails) console.error('  -', failure);
        return 1;
      }
      console.log(`\nCELL SMOKE PASSED — runId=${summary.runId} rows=${rows.length} (tmp=${tmpDir})`);
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
      console.error('[adaptive-cell-smoke] FATAL:', error);
      process.exitCode = 1;
    },
  );
}
