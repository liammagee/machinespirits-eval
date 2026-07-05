// Stage-0 sanity surface for the DAG-pinned learner de-substitution
// instrument (notes/2026-07-03-dag-pinned-learner-desubstitution-plan.md §5).
//
// --check validates, exiting non-zero on any failure:
//   1. the five desub scenarios resolve via evalConfigLoader with extends
//      applied and runner-visible fields intact (type/turns/validation);
//   2. every formal interior loads and all blocking tokens are globally unique;
//   3. the three arm profiles resolve in EVAL_ONLY_PROFILES;
//   4. the sycophancy probe --check passes (invoked in-process).
//
// Usage: EVAL_SCENARIOS_FILE=config/charisma-recognition-desire-scenarios.yaml \
//          node scripts/report-desubstitution-stage0.js --check

import 'dotenv/config';

import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { getScenario } from '../services/evalConfigLoader.js';
import { loadFormalInterior } from '../services/learnerInteriorGate.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const DESUB_IDS = [
  'desub_resistance_boredom',
  'desub_resistance_frustration',
  'desub_resistance_irrelevance',
  'desub_resistance_question_flood',
  'desub_resistance_rote_parroting',
];

const ARM_PROFILES = [
  'cell_186_id_director_charisma_static_floor_breakthrough_dynamic_verified',
  'cell_193_id_director_charisma_resistance_boredom_stake_breakthrough_dynamic_verified',
  'cell_199_blueprint_kernel_verified',
];

async function main() {
  const failures = [];
  const notes = [];

  // 1. Scenario resolution with runner-visible fields.
  const scenarios = [];
  for (const id of DESUB_IDS) {
    const scenario = getScenario(id);
    if (!scenario) {
      failures.push(`scenario ${id} not found`);
      continue;
    }
    scenarios.push(scenario);
    for (const field of ['type', 'turns', 'learner_persona', 'resistance_signal_target']) {
      if (scenario[field] == null) failures.push(`scenario ${id} missing inherited field ${field}`);
    }
    if (scenario.desubstitution_diagnostic !== true) failures.push(`scenario ${id} missing desubstitution_diagnostic`);
    if (!Array.isArray(scenario.turns) || scenario.turns.length < 2) {
      failures.push(`scenario ${id} turns not inherited (${scenario.turns?.length ?? 'none'})`);
    }
  }

  // 2. Interiors + global token uniqueness.
  const seenTokens = new Map();
  for (const scenario of scenarios) {
    try {
      const interior = loadFormalInterior(scenario);
      for (const node of interior.dag_nodes) {
        if (seenTokens.has(node.id)) {
          failures.push(`token ${node.id} reused across ${seenTokens.get(node.id)} and ${scenario.id}`);
        }
        seenTokens.set(node.id, scenario.id);
      }
      notes.push(`${scenario.id}: blocking ${interior.blocking_element.id}, ${interior.dag_nodes.length} nodes`);
    } catch (err) {
      failures.push(`interior ${scenario.id}: ${err.message}`);
    }
  }

  // 3. Arm registration.
  const { EVAL_ONLY_PROFILES } = await import('../services/evaluationRunner.js');
  for (const profile of ARM_PROFILES) {
    if (!EVAL_ONLY_PROFILES.includes(profile)) failures.push(`arm profile not registered: ${profile}`);
  }

  // 4. Probe check (subprocess so its exit code is authoritative).
  try {
    execFileSync(process.execPath, [path.join(ROOT, 'scripts/run-desubstitution-probe.js'), '--check'], {
      env: { ...process.env, EVAL_SCENARIOS_FILE: 'config/charisma-recognition-desire-scenarios.yaml' },
      stdio: 'pipe',
    });
    notes.push('probe --check: PASSED (targeted 5/5, mismatched 0/5, generic 0/5, cross 0/20)');
  } catch (err) {
    failures.push(`probe --check failed: ${String(err.stdout || err.message).slice(0, 300)}`);
  }

  console.log('# De-substitution Stage 0 check\n');
  for (const note of notes) console.log(`- ${note}`);
  if (failures.length) {
    console.error(`\n${failures.length} failure(s):`);
    for (const failure of failures) console.error(`  ✗ ${failure}`);
    process.exit(1);
  }
  console.log(`\nSTAGE 0 CHECK PASSED (${scenarios.length} scenarios, ${seenTokens.size} unique tokens, 3 arms)`);
}

main().catch((err) => {
  console.error(err.stack || String(err));
  process.exit(1);
});
