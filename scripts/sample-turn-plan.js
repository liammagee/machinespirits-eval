#!/usr/bin/env node
/**
 * sample-turn-plan.js — demo the generative sampler (Stage 1 of the #9 arc).
 *
 * Walks the poetics ontology to print valid, varied turn_plans for a role + targets, each
 * round-tripped through the SAME validateTurnPlan a critic uses (generate ⊨ score).
 *
 *   node scripts/sample-turn-plan.js [role] [targets,comma] [count]
 *   node scripts/sample-turn-plan.js tutor peripeteia 6
 *   node scripts/sample-turn-plan.js learner anagnorisis 4
 */
import { sampleTurnPlan, validMovesFor, agenciesForArchitecture } from '../services/ontology/turnPlanSampler.js';
import { validateTurnPlan } from '../services/ontology/reasoningOntology.js';

const role = process.argv[2] || 'tutor';
const targets = (process.argv[3] || 'peripeteia')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const count = Number(process.argv[4] || 6);
const arch = process.argv[5] || null; // optional: ego_only | ego_superego | id_director (alter-ego conditioning)
const persona = process.argv[6] || null; // optional: struggling_anxious | adversarial_tester … (count prior)
const agencies = arch ? agenciesForArchitecture(arch) : undefined;

const pool = await validMovesFor(role, targets, { agencies });
console.log(
  `role=${role}  targets=[${targets.join(', ')}]` +
    (arch ? `  arch=${arch} (agencies: ${agencies.join('+')})` : '') +
    (persona ? `  persona=${persona}` : ''),
);
console.log(
  `valid move pool (${pool.length}): ${pool.join(', ') || '(empty — no form-typed moves for this role/target)'}\n`,
);

let ok = 0;
for (let i = 0; i < count; i++) {
  const entry = await sampleTurnPlan(targets, role, { agencies, persona, seed: `demo${i}` });
  const v = await validateTurnPlan([entry], targets);
  if (v.ok) ok += 1;
  console.log(
    `  ${v.ok ? '✓' : '✗'} ${JSON.stringify(entry.moves)}${v.ok ? '' : '  CONFLICT ' + JSON.stringify(v.conflicts)}`,
  );
}
console.log(`\n${ok}/${count} sampled plans round-trip through validateTurnPlan (generate ⊨ score).`);
