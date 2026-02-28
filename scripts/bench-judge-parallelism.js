#!/usr/bin/env node

/**
 * Benchmark: Sequential vs Parallel Judge Calls
 *
 * Simulates the evaluateMultiTurnResult() scoring pipeline with a mock judge
 * to measure the wall-clock speedup from parallelization.
 *
 * Usage:
 *   node scripts/bench-judge-parallelism.js [--delay 3000] [--turns 4] [--tutor-only]
 *
 * Options:
 *   --delay <ms>     Simulated judge call latency (default: 3000)
 *   --turns <n>      Number of dialogue turns (default: 4)
 *   --tutor-only     Skip learner + dialogue quality calls
 */

import { parseArgs } from 'node:util';

const { values: opts } = parseArgs({
  options: {
    delay: { type: 'string', default: '3000' },
    turns: { type: 'string', default: '4' },
    'tutor-only': { type: 'boolean', default: false },
  },
  strict: false,
});

const DELAY = parseInt(opts.delay, 10);
const TURNS = parseInt(opts.turns, 10);
const TUTOR_ONLY = opts['tutor-only'];

// Simulated judge call — returns a fake score after a delay
let callCount = 0;
function mockJudgeCall(label) {
  callCount++;
  const id = callCount;
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        label,
        callId: id,
        scores: {
          relevance: { score: 70 + Math.random() * 20, reasoning: 'mock' },
          specificity: { score: 65 + Math.random() * 20, reasoning: 'mock' },
          pedagogical: { score: 60 + Math.random() * 25, reasoning: 'mock' },
        },
        overall_score: 65 + Math.random() * 20,
        summary: `Mock result for ${label}`,
      });
    }, DELAY);
  });
}

// Compute call counts
const tutorTurnCalls = TURNS;
const learnerTurnCalls = TUTOR_ONLY ? 0 : Math.max(0, TURNS - 1); // learner turns = tutor turns - 1
const dgCalls = TUTOR_ONLY ? 0 : 2; // DgP + DgI
const wave1Calls = tutorTurnCalls + learnerTurnCalls + dgCalls;
const holisticCalls = TUTOR_ONLY ? 0 : 2; // tutor holistic + learner holistic (when turns > 1)
const totalCalls = wave1Calls + holisticCalls;

console.log(`\nBenchmark: Sequential vs Parallel Judge Calls`);
console.log(`═══════════════════════════════════════════════`);
console.log(`  Simulated delay:    ${DELAY}ms per call`);
console.log(`  Dialogue turns:     ${TURNS}`);
console.log(`  Tutor-only:         ${TUTOR_ONLY}`);
console.log(`  ─────────────────────────────────────────`);
console.log(`  Tutor per-turn:     ${tutorTurnCalls} calls`);
console.log(`  Learner per-turn:   ${learnerTurnCalls} calls`);
console.log(`  DgP + DgI:          ${dgCalls} calls`);
console.log(`  Holistic:           ${holisticCalls} calls`);
console.log(`  Total calls:        ${totalCalls}`);
console.log(`═══════════════════════════════════════════════\n`);

async function runSequential() {
  const results = {};

  // Per-turn tutor scoring (sequential)
  for (let i = 0; i < TURNS; i++) {
    results[`tutor-${i}`] = await mockJudgeCall(`tutor-turn-${i}`);
  }

  // Per-turn learner scoring (sequential)
  if (!TUTOR_ONLY) {
    for (let i = 0; i < learnerTurnCalls; i++) {
      results[`learner-${i}`] = await mockJudgeCall(`learner-turn-${i}`);
    }
  }

  // Learner holistic
  if (!TUTOR_ONLY && learnerTurnCalls > 0) {
    results['learner-holistic'] = await mockJudgeCall('learner-holistic');
  }

  // Tutor holistic
  if (!TUTOR_ONLY && TURNS > 1) {
    results['tutor-holistic'] = await mockJudgeCall('tutor-holistic');
  }

  // DgP + DgI
  if (!TUTOR_ONLY) {
    results['dgp'] = await mockJudgeCall('dgp');
    results['dgi'] = await mockJudgeCall('dgi');
  }

  return results;
}

async function runParallel() {
  const results = {};

  // ═══ Wave 1: All independent calls concurrent ═══
  const tutorPromises = [];
  for (let i = 0; i < TURNS; i++) {
    tutorPromises.push(mockJudgeCall(`tutor-turn-${i}`).then(r => { results[`tutor-${i}`] = r; return r; }));
  }

  const learnerPromises = [];
  if (!TUTOR_ONLY) {
    for (let i = 0; i < learnerTurnCalls; i++) {
      learnerPromises.push(mockJudgeCall(`learner-turn-${i}`).then(r => { results[`learner-${i}`] = r; return r; }));
    }
  }

  const dgpPromise = !TUTOR_ONLY ? mockJudgeCall('dgp').then(r => { results['dgp'] = r; return r; }) : null;
  const dgiPromise = !TUTOR_ONLY ? mockJudgeCall('dgi').then(r => { results['dgi'] = r; return r; }) : null;

  await Promise.all([
    Promise.allSettled(tutorPromises),
    Promise.allSettled(learnerPromises),
    dgpPromise,
    dgiPromise,
  ]);

  // ═══ Wave 2: Holistic calls concurrent ═══
  const holisticPromises = [];
  if (!TUTOR_ONLY && TURNS > 1) {
    holisticPromises.push(mockJudgeCall('tutor-holistic').then(r => { results['tutor-holistic'] = r; return r; }));
  }
  if (!TUTOR_ONLY && learnerTurnCalls > 0) {
    holisticPromises.push(mockJudgeCall('learner-holistic').then(r => { results['learner-holistic'] = r; return r; }));
  }

  if (holisticPromises.length > 0) {
    await Promise.all(holisticPromises);
  }

  return results;
}

function validateResults(seqResults, parResults) {
  const seqKeys = Object.keys(seqResults).sort();
  const parKeys = Object.keys(parResults).sort();

  if (seqKeys.length !== parKeys.length) {
    return { match: false, reason: `Key count mismatch: seq=${seqKeys.length} par=${parKeys.length}` };
  }

  for (let i = 0; i < seqKeys.length; i++) {
    if (seqKeys[i] !== parKeys[i]) {
      return { match: false, reason: `Key mismatch at ${i}: seq=${seqKeys[i]} par=${parKeys[i]}` };
    }
  }

  return { match: true };
}

async function main() {
  // Run sequential
  callCount = 0;
  const seqStart = Date.now();
  const seqResults = await runSequential();
  const seqTime = Date.now() - seqStart;
  const seqCalls = callCount;

  // Run parallel
  callCount = 0;
  const parStart = Date.now();
  const parResults = await runParallel();
  const parTime = Date.now() - parStart;
  const _parCalls = callCount;

  // Validate
  const validation = validateResults(seqResults, parResults);

  // Compute theoretical times
  const theoreticalSeq = totalCalls * DELAY;
  const wave1MaxConcurrent = wave1Calls; // all in parallel
  const wave2MaxConcurrent = holisticCalls;
  const theoreticalPar = (wave1MaxConcurrent > 0 ? DELAY : 0) + (wave2MaxConcurrent > 0 ? DELAY : 0);
  const theoreticalSpeedup = theoreticalSeq / theoreticalPar;

  // Report
  console.log(`Results`);
  console.log(`───────────────────────────────────────────────`);
  console.log(`  Sequential:    ${(seqTime / 1000).toFixed(1)}s  (${seqCalls} calls × ${DELAY}ms)`);
  console.log(`  Parallel:      ${(parTime / 1000).toFixed(1)}s  (Wave 1: ${wave1Calls} concurrent, Wave 2: ${holisticCalls} concurrent)`);
  console.log(`  Speedup:       ${(seqTime / parTime).toFixed(2)}×`);
  console.log(`  ─────────────────────────────────────────`);
  console.log(`  Theoretical:`);
  console.log(`    Sequential:  ${(theoreticalSeq / 1000).toFixed(1)}s`);
  console.log(`    Parallel:    ${(theoreticalPar / 1000).toFixed(1)}s  (2 waves × ${DELAY}ms)`);
  console.log(`    Speedup:     ${theoreticalSpeedup.toFixed(2)}×`);
  console.log(`  ─────────────────────────────────────────`);
  console.log(`  Results match: ${validation.match ? '✓' : '✗ ' + validation.reason}`);
  console.log(`  Result keys:   ${Object.keys(seqResults).sort().join(', ')}`);
  console.log();
}

main().catch(console.error);
