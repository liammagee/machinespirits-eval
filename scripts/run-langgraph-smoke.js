#!/usr/bin/env node
// Smoke test for services/adaptiveTutor/.
//
// Runs one scenario end-to-end against mocked LLM fixtures, then forks from
// the trigger turn with a perturbed hidden learner state to exercise the
// counterfactual-replay path.
//
// No paid API calls. Strict pass/fail at the bottom.

import { runScenarioWithCounterfactual, divergenceReport, summariseDivergence } from '../services/adaptiveTutor/runner.js';

const scenario = {
  id: 'smoke-resistance-to-insight',
  hidden: {
    actualMisconception: 'treats recognition as affirmation',
    actualSophistication: 'advanced',
    triggerTurn: 1,
    triggerSignal: 'But that only works if recognition reduces to affirmation, which is the very thing in dispute.',
  },
  openingTurns: [{ role: 'learner', content: 'Can you tell me what recognition means?' }],
  maxTurns: 3,
};

const perturbation = {
  forkAtTurn: 1,
  hiddenOverrides: {
    actualSophistication: 'novice',
    triggerSignal: "I don't get it, can you just explain?",
  },
};

const result = await runScenarioWithCounterfactual(scenario, perturbation);

const dump = (label, run) => {
  console.log(`\n=== ${label} ===`);
  console.log('  turns:', run.dialogue.length);
  console.log('  final learner profile:', JSON.stringify(run.learnerProfile));
  console.log('  constraint violations seen:', run.constraintViolations.length);
  for (const m of run.dialogue) console.log(`    [${m.role}] ${m.content}`);
};

dump('ORIGINAL', result.original.final);
let report = null;
let summary = null;
if (result.counterfactual) {
  dump('COUNTERFACTUAL', result.counterfactual.final);
  report = divergenceReport(result.original, result.counterfactual);
  summary = summariseDivergence(report);
  console.log('\n--- divergence (full) ---');
  console.log(JSON.stringify(report, null, 2));
  console.log('\n--- divergence (summary) ---');
  console.log(JSON.stringify(summary, null, 2));
} else {
  console.log('\nNo counterfactual produced:', result.reason);
}

// Strict assertions.
const fails = [];
const orig = result.original.final;
if (!orig.dialogue.some((m) => m.role === 'tutor')) fails.push('no tutor messages produced');
if (orig.learnerProfile.updatedAtTurn < 0) fails.push('learner profile never updated');
if (!result.counterfactual) fails.push('counterfactual run did not fire');
if (result.counterfactual && summary && !summary.anyDivergence) {
  fails.push('counterfactual showed no divergence in policy actions, profile evolution, or tutor text');
}

if (fails.length) {
  console.error('\nSMOKE FAILED:');
  for (const f of fails) console.error('  -', f);
  process.exit(1);
}
console.log('\nSMOKE PASSED');
