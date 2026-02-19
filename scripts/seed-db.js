#!/usr/bin/env node
/**
 * Seed Database
 *
 * Creates a small sample dataset so new users can explore the CLI
 * (runs, report, export) without running a full evaluation.
 *
 * Usage: node scripts/seed-db.js
 */

import * as evaluationStore from '../services/evaluationStore.js';

const SEED_RUN_ID = 'seed-sample-factorial';

// Check if seed data already exists
const existing = evaluationStore.getRun(SEED_RUN_ID);
if (existing) {
  console.log(`Seed run '${SEED_RUN_ID}' already exists. Delete it first to re-seed.`);
  process.exit(0);
}

console.log('Creating seed evaluation run...');

// Insert run directly (createRun auto-generates IDs, so use the store's db)
const run = evaluationStore.createRun({
  description: 'Sample 2x2x2 factorial (seed data for demonstration)',
  totalScenarios: 1,
  totalConfigurations: 8,
});

// We need the auto-generated ID — use it going forward
const runId = run.id;

// 8 factorial cells with representative scores (matching paper Table 5 means)
const cells = [
  { profile: 'cell_1_base_single_unified', recog: false, multi: false, learner: 'unified', score: 77.6 },
  { profile: 'cell_2_base_single_psycho', recog: false, multi: false, learner: 'ego_superego', score: 80.0 },
  { profile: 'cell_3_base_multi_unified', recog: false, multi: true, learner: 'unified', score: 76.6 },
  { profile: 'cell_4_base_multi_psycho', recog: false, multi: true, learner: 'ego_superego', score: 81.5 },
  { profile: 'cell_5_recog_single_unified', recog: true, multi: false, learner: 'unified', score: 92.8 },
  { profile: 'cell_6_recog_single_psycho', recog: true, multi: false, learner: 'ego_superego', score: 83.4 },
  { profile: 'cell_7_recog_multi_unified', recog: true, multi: true, learner: 'unified', score: 92.3 },
  { profile: 'cell_8_recog_multi_psycho', recog: true, multi: true, learner: 'ego_superego', score: 86.7 },
];

for (const cell of cells) {
  const base = cell.score / 20; // scale 0-100 → approx 1-5
  evaluationStore.storeResult(runId, {
    scenarioId: 'struggling_learner',
    scenarioName: 'Struggling Learner',
    provider: 'openrouter',
    model: 'moonshotai/kimi-k2.5',
    profileName: cell.profile,
    suggestions: [
      {
        type: 'review',
        priority: 'high',
        title: 'Sample suggestion',
        message: `Sample ${cell.recog ? 'recognition-theory' : 'base'} tutor response for a struggling learner.`,
      },
    ],
    latencyMs: 5000 + Math.floor(Math.random() * 10000),
    scores: {
      relevance: Math.min(5, Math.max(1, Math.round(base + (Math.random() - 0.5)))),
      specificity: Math.min(5, Math.max(1, Math.round(base + (Math.random() - 0.5)))),
      pedagogical: Math.min(5, Math.max(1, Math.round(base + (Math.random() - 0.5)))),
      personalization: Math.min(5, Math.max(1, Math.round(base + (Math.random() - 0.5)))),
      actionability: Math.min(5, Math.max(1, Math.round(base + (Math.random() - 0.5)))),
      tone: Math.min(5, Math.max(1, Math.round(base + (Math.random() - 0.5)))),
    },
    overallScore: cell.score,
    judgeModel: 'seed-data',
    success: true,
    factors: {
      recognition: cell.recog,
      multi_agent_tutor: cell.multi,
      multi_agent_learner: cell.learner === 'ego_superego',
    },
    learnerArchitecture: cell.learner,
  });
}

// Mark run complete
evaluationStore.completeRun(runId);

console.log(`Seed run created: ${runId}`);
console.log('  8 factorial cells, 1 scenario each');
console.log(`  Try: node scripts/eval-cli.js runs`);
console.log(`  Try: node scripts/eval-cli.js report ${runId}`);
