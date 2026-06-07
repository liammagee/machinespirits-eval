// End-to-end production path: runScenarioWithCounterfactual + buildTraceJson.
// Dumps the in-memory traceJson AS BUILT, not as written/read back, so we can
// see whether ToM fields die before or during JSON.stringify.

import { runScenarioWithCounterfactual } from '../services/adaptiveTutor/runner.js';

process.env.ADAPTIVE_TUTOR_LLM = 'mock';

const scenario = {
  id: 'debug_prod',
  hidden: {
    actualMisconception: 'debug',
    actualSophistication: 'intermediate',
    triggerTurn: 1,
    triggerSignal: 'debug',
  },
  openingTurns: [{ role: 'learner', content: 'Hi.' }],
  maxTurns: 3,
};
const perturbation = {
  forkAtTurn: 1,
  hiddenOverrides: { actualSophistication: 'novice' },
};

const result = await runScenarioWithCounterfactual(scenario, perturbation, { architecture: 'bilateral_tom' });

// Inline-replicate extractTurnTrace
function extractTurnTrace(history) {
  const byTurn = new Map();
  for (const snap of [...history].reverse()) {
    const v = snap.values;
    if (!v) continue;
    const turn = v.turn;
    if (turn == null) continue;
    const existing = byTurn.get(turn) || { turn, learnerProfile: null };
    if (v.learnerProfile && v.learnerProfile.updatedAtTurn === turn) {
      existing.learnerProfile = v.learnerProfile;
    }
    byTurn.set(turn, existing);
  }
  return [...byTurn.values()].sort((a, b) => a.turn - b.turn);
}

console.log('Has counterfactual:', !!result.counterfactual);
console.log('Original final learnerProfile keys:', Object.keys(result.original.final.learnerProfile));
console.log('Original final summaryText present:', 'summaryText' in result.original.final.learnerProfile);
console.log();

const perTurn = extractTurnTrace(result.original.history);
perTurn.forEach((t) => {
  const lp = t.learnerProfile || {};
  console.log(`turn ${t.turn}: keys=${Object.keys(lp).join(',')}`);
});

// Also check if the ToM fields survive JSON.stringify roundtrip:
console.log('\n--- After JSON roundtrip ---');
const roundtripped = JSON.parse(JSON.stringify(perTurn));
roundtripped.forEach((t) => {
  const lp = t.learnerProfile || {};
  console.log(`turn ${t.turn}: keys=${Object.keys(lp).join(',')}`);
});
