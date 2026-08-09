#!/usr/bin/env node

/**
 * Zero-model analysis for the prospective balanced learner-profile/world
 * deconfound cohort. It reuses the exact pressure + qd-v1 vectorizer and the
 * historical leave-one-out nearest-centroid classifier, then runs the same
 * classifier once for PERSONA and once for WORLD.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  analyzeLearnerProfileRecoveryVectors,
  readLearnerProfileRecoveryManifest,
  replayLearnerProfileRecoveryCorpus,
  validateLearnerProfileRecoveryManifest,
} from './replay-learner-profile-recovery-l1.js';
import {
  readLearnerProfileWorldDeconfoundDesign,
  validateLearnerProfileWorldDeconfoundDesign,
} from './review-learner-profile-world-deconfound.js';
import { compileTutorStubTriggerArtifact } from '../services/tutorStubMannerSwitch.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PLAN_SCHEMA = 'machinespirits.tutor-stub.learner-profile-world-deconfound-plan.v1';
const STATE_SCHEMA = 'machinespirits.tutor-stub.learner-profile-world-deconfound-launch-state.v1';
const REPORT_SCHEMA = 'machinespirits.tutor-stub.learner-profile-world-deconfound-analysis.v1';

function fail(message) {
  throw new Error(`learner-profile world deconfound analysis: ${message}`);
}

function readJson(filePath, label) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    fail(`cannot read ${label} ${filePath}: ${error.message}`);
  }
}

function readJsonl(filePath) {
  const text = fs.readFileSync(filePath, 'utf8').trim();
  if (!text) fail(`trace is empty: ${filePath}`);
  try {
    return text.split('\n').map((line) => JSON.parse(line));
  } catch (error) {
    fail(`trace is invalid JSONL: ${filePath} (${error.message})`);
  }
}

function centroid(vectors, states) {
  return Object.fromEntries(
    states.map((state) => [state, vectors.reduce((sum, vector) => sum + vector.vec[state], 0) / vectors.length]),
  );
}

function balancedManifest(base, labels, counts) {
  return {
    ...base,
    corpus: Object.fromEntries(labels.map((label) => [label, { expected_dialogues: counts[label] }])),
    expected_result: { dialogues: Object.values(counts).reduce((sum, count) => sum + count, 0) },
  };
}

function reading(result) {
  return {
    dialogues: result.dialogues,
    correct: result.correct,
    accuracy: result.accuracy,
    meanProfiles: result.meanProfiles,
    openingTurns: result.openingTurns,
  };
}

export function analyzeProspectiveVectors(vectors, { states, passBar = 0.8 } = {}) {
  if (vectors.length !== 20) fail(`expected 20 vectors, found ${vectors.length}`);
  const personas = [...new Set(vectors.map((vector) => vector.persona))].sort();
  const worlds = [...new Set(vectors.map((vector) => vector.world))].sort();
  if (personas.length !== 2 || worlds.length !== 2) fail('cohort must retain exactly two personas and two worlds');
  for (const persona of personas) {
    for (const world of worlds) {
      const count = vectors.filter((vector) => vector.persona === persona && vector.world === world).length;
      if (count !== 5) fail(`${persona} x ${world} has ${count} vectors, expected 5`);
    }
  }

  const classifier = { opening_turns: [2, 4, 6, 8, 10] };
  const personaManifest = balancedManifest(
    { states, classifier },
    personas,
    Object.fromEntries(personas.map((persona) => [persona, 10])),
  );
  const personaResult = analyzeLearnerProfileRecoveryVectors(personaManifest, vectors);
  const worldVectors = vectors.map((vector) => ({ ...vector, persona: vector.world }));
  const worldManifest = balancedManifest(
    { states, classifier },
    worlds,
    Object.fromEntries(worlds.map((world) => [world, 10])),
  );
  const worldResult = analyzeLearnerProfileRecoveryVectors(worldManifest, worldVectors);

  const cells = {};
  for (const cell of [...new Set(vectors.map((vector) => vector.cell))].sort()) {
    const set = vectors.filter((vector) => vector.cell === cell);
    cells[cell] = {
      persona: set[0].persona,
      world: set[0].world,
      dialogues: set.length,
      meanProfile: centroid(set, states),
    };
  }
  let verdict = 'partial_or_interaction';
  if (personaResult.accuracy >= passBar) verdict = 'persona_transportable_within_scope';
  else if (worldResult.accuracy >= passBar) verdict = 'world_artifact_within_scope';

  return {
    verdict,
    passBar,
    persona: reading(personaResult),
    worldDiagnostic: reading(worldResult),
    cells,
  };
}

export function analyzeCompletedCohort(plan, state, { root = ROOT } = {}) {
  if (plan?.schema !== PLAN_SCHEMA) fail(`plan schema must be ${PLAN_SCHEMA}`);
  if (state?.schema !== STATE_SCHEMA) fail(`launch state schema must be ${STATE_SCHEMA}`);
  if (state.sourceSha !== plan.sourceSha || state.planHash !== plan.planHash) fail('launch state does not match plan');
  const technicalFailures = state.jobs.filter((job) => job.status !== 'sealed');
  if (state.status !== 'completed' || technicalFailures.length) {
    return {
      schema: REPORT_SCHEMA,
      status: 'technical_failure',
      sourceSha: plan.sourceSha,
      planHash: plan.planHash,
      technicalFailures: technicalFailures.map(({ id, status, failure, exitCode, signal }) => ({
        id,
        status,
        failure: failure || null,
        exitCode: exitCode ?? null,
        signal: signal || null,
      })),
      empirical: null,
    };
  }
  if (state.jobs.length !== 20) fail(`launch state has ${state.jobs.length} jobs, expected 20`);

  const design = readLearnerProfileWorldDeconfoundDesign();
  validateLearnerProfileWorldDeconfoundDesign(design, { root });
  const recoveryManifest = readLearnerProfileRecoveryManifest();
  const { triggerPath } = validateLearnerProfileRecoveryManifest(recoveryManifest, { root });
  const trigger = compileTutorStubTriggerArtifact(JSON.parse(fs.readFileSync(triggerPath, 'utf8')));
  const jobs = new Map(plan.jobs.map((job) => [job.id, job]));
  const sources = state.jobs.map((record) => {
    const job = jobs.get(record.id);
    if (!job) fail(`launch state contains unknown job ${record.id}`);
    if (!Array.isArray(record.traces) || record.traces.length !== 1) fail(`${record.id} must name exactly one trace`);
    const trace = path.resolve(root, record.traces[0]);
    const events = readJsonl(trace);
    if (!events.some((event) => event.type === 'run_end')) fail(`${record.id} trace is not sealed`);
    return {
      persona: job.persona,
      world: job.world,
      cell: job.cell,
      arm: job.cell,
      dialogue: job.id,
      trace,
      events,
    };
  });
  const prospectiveManifest = {
    ...recoveryManifest,
    corpus: {
      record_keeper: { expected_dialogues: 10 },
      tenant: { expected_dialogues: 10 },
    },
    expected_result: { dialogues: 20 },
  };
  const baseVectors = replayLearnerProfileRecoveryCorpus(prospectiveManifest, sources, trigger.patterns);
  const sourceById = new Map(sources.map((source) => [source.dialogue, source]));
  const vectors = baseVectors.map((vector) => {
    const source = sourceById.get(vector.d);
    return { ...vector, world: source.world, cell: source.cell, trace: path.relative(root, source.trace) };
  });
  const empirical = analyzeProspectiveVectors(vectors, {
    states: recoveryManifest.states,
    passBar: design.readings.pass_bar,
  });
  return {
    schema: REPORT_SCHEMA,
    status: 'analyzed',
    sourceSha: plan.sourceSha,
    planHash: plan.planHash,
    technicalFailures: [],
    empirical,
    vectors: vectors.map(({ persona, world, cell, d, n, vec, perTurn, trace }) => ({
      persona,
      world,
      cell,
      job: d,
      learnerTurns: n,
      vec,
      perTurn,
      trace,
    })),
    claimBoundary: design.claim_boundary,
    historicalBoundary:
      'The historical 56/64 result supplies the frozen 80 percent bar only; no historical dialogue is pooled.',
  };
}

export function renderAnalysis(report) {
  const lines = [
    '# Learner-profile/world deconfound',
    '',
    `- Source: \`${report.sourceSha}\``,
    `- Plan: \`${report.planHash}\``,
    `- Status: **${report.status}**`,
  ];
  if (report.status === 'technical_failure') {
    lines.push('', '## Technical failures', '');
    for (const failure of report.technicalFailures) {
      lines.push(`- ${failure.id}: ${failure.status}${failure.failure ? ` — ${failure.failure}` : ''}`);
    }
    lines.push('', 'No empirical verdict is reported from an incomplete cohort.');
    return `${lines.join('\n')}\n`;
  }
  const empirical = report.empirical;
  lines.push(
    '',
    '## Empirical endpoints',
    '',
    `- Terminal verdict: **${empirical.verdict}**`,
    `- Persona recovery: ${empirical.persona.correct}/${empirical.persona.dialogues} = ${(100 * empirical.persona.accuracy).toFixed(1)}% (bar ${(100 * empirical.passBar).toFixed(0)}%)`,
    `- World diagnostic: ${empirical.worldDiagnostic.correct}/${empirical.worldDiagnostic.dialogues} = ${(100 * empirical.worldDiagnostic.accuracy).toFixed(1)}%`,
    '',
    '## Technical failures',
    '',
    '- None; all 20 planned dialogues sealed and entered the frozen analysis.',
    '',
    '## Cell profiles',
    '',
  );
  for (const [cell, value] of Object.entries(empirical.cells)) {
    lines.push(`- ${cell}: ${value.dialogues} dialogues; persona ${value.persona}; world ${value.world}`);
  }
  lines.push('', report.claimBoundary, '', report.historicalBoundary);
  return `${lines.join('\n')}\n`;
}

function parseArgs(argv) {
  const args = { plan: null, state: null, output: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--plan') args.plan = path.resolve(argv[++index]);
    else if (arg === '--state') args.state = path.resolve(argv[++index]);
    else if (arg === '--output') args.output = path.resolve(argv[++index]);
    else fail(`unknown argument: ${arg}`);
  }
  if (!args.plan) fail('--plan is required');
  args.state ||= path.join(path.dirname(args.plan), 'launch-state.json');
  args.output ||= path.join(path.dirname(args.plan), 'analysis.json');
  return args;
}

export function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const report = analyzeCompletedCohort(readJson(args.plan, 'plan'), readJson(args.state, 'launch state'));
  fs.writeFileSync(args.output, `${JSON.stringify(report, null, 2)}\n`);
  const markdownPath = args.output.replace(/\.json$/u, '.md');
  fs.writeFileSync(markdownPath, renderAnalysis(report));
  process.stdout.write(renderAnalysis(report));
  if (report.status !== 'analyzed') process.exitCode = 1;
  return report;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
