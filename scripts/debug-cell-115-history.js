// One-off diagnostic: run cell_115 in mock mode, dump every state snapshot's
// turn + learnerProfile fields, so we can see whether (a) getStateHistory
// yields oldest- or newest-first, (b) the post-tomTracker snapshot exists,
// and (c) whether persistence's reverse-iteration overwrite logic actually
// picks it up.

import { runScenario } from '../services/adaptiveTutor/runner.js';

process.env.ADAPTIVE_TUTOR_LLM = 'mock';

const scenario = {
  id: 'debug_cell_115_multi',
  hidden: {
    actualMisconception: 'debug',
    actualSophistication: 'intermediate',
    triggerTurn: 1,
    triggerSignal: 'debug',
  },
  openingTurns: [
    { role: 'learner', content: 'Hi can you explain something?' },
  ],
  maxTurns: 3,
};

const { history } = await runScenario(scenario, { architecture: 'bilateral_tom' });

console.log(`Total snapshots: ${history.length}`);
console.log('\nIteration order: as returned by getStateHistory (no reverse)\n');

history.forEach((snap, i) => {
  const v = snap.values || {};
  const lp = v.learnerProfile || {};
  const next = snap.next?.join(',') || '(end)';
  const hasTom = !!(lp.summaryText || lp.hypothesizedLearnerPerceptionOfTutor || lp.tomProbes);
  console.log(
    `[${i}] turn=${v.turn}, updatedAtTurn=${lp.updatedAtTurn}, hasTom=${hasTom}, next→${next}`,
  );
});

console.log('\n--- Replicating extractTurnTrace logic ---');
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
for (const t of [...byTurn.values()].sort((a, b) => a.turn - b.turn)) {
  const lp = t.learnerProfile || {};
  const hasTom = !!(lp.summaryText || lp.hypothesizedLearnerPerceptionOfTutor || lp.tomProbes);
  console.log(`  perTurn turn=${t.turn}: hasTom=${hasTom}, updatedAtTurn=${lp.updatedAtTurn}`);
}
