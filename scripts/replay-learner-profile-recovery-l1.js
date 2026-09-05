#!/usr/bin/env node

/**
 * Re-run the original Phase L1 learner-profile recovery reading without model
 * calls. The tracked manifest freezes the historical trigger, qd-v1 detector,
 * corpus arms, classifier, and expected 56/64 result.
 *
 * This command fails closed when any original trace is unavailable. The old
 * scratch command silently skipped missing directories; that would allow a
 * partial corpus to masquerade as a reproduction.
 *
 * Usage:
 *   node scripts/replay-learner-profile-recovery-l1.js --check
 *   node scripts/replay-learner-profile-recovery-l1.js --json --no-write
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { recordObservedDigest } from '../services/recordedFileDigest.js';
import {
  classifyTutorStubLearnerPressure,
  compileTutorStubTriggerArtifact,
} from '../services/tutorStubMannerSwitch.js';
import {
  TUTOR_STUB_QUIET_DETECTOR_VERSION,
  createTutorStubQuietDetectorState,
  detectTutorStubQuietState,
} from '../services/tutorStubQuietDetectorV1.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_MANIFEST = path.join(ROOT, 'config', 'learner-profile-recovery-l1.json');
const DEFAULT_OUTPUT = path.join(ROOT, 'exports', 'learner-profile-recovery-l1.json');
const EXPECTED_SCHEMA = 'machinespirits.tutor-stub.learner-profile-recovery-l1.v1';

export class LearnerProfileRecoveryReplayError extends Error {
  constructor(message, details = {}) {
    super(`learner-profile recovery L1: ${message}`);
    this.name = 'LearnerProfileRecoveryReplayError';
    this.details = details;
  }
}

function fail(message, details) {
  throw new LearnerProfileRecoveryReplayError(message, details);
}

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function resolveInside(root, relativePath, label) {
  const absoluteRoot = path.resolve(root);
  const absolute = path.resolve(absoluteRoot, relativePath);
  if (absolute !== absoluteRoot && !absolute.startsWith(`${absoluteRoot}${path.sep}`)) {
    fail(`${label} must stay inside the repository: ${relativePath}`);
  }
  return absolute;
}

export function readLearnerProfileRecoveryManifest(manifestPath = DEFAULT_MANIFEST) {
  return JSON.parse(fs.readFileSync(path.resolve(manifestPath), 'utf8'));
}

export function validateLearnerProfileRecoveryManifest(manifest, { root = ROOT } = {}) {
  if (manifest?.schema !== EXPECTED_SCHEMA) fail(`schema must be ${EXPECTED_SCHEMA}`);
  if (manifest?.provenance?.quiet_detector?.version !== 'qd-v1') fail('quiet detector must remain qd-v1');
  if (TUTOR_STUB_QUIET_DETECTOR_VERSION !== 'qd-v1') fail('imported quiet detector does not report qd-v1');

  const quietPath = resolveInside(root, manifest.provenance.quiet_detector.path, 'quiet detector');
  const triggerPath = resolveInside(root, manifest.provenance.pressure_trigger.path, 'pressure trigger');
  for (const [label, filePath] of [
    ['quiet detector', quietPath],
    ['pressure trigger', triggerPath],
  ]) {
    if (!fs.existsSync(filePath)) fail(`${label} is missing: ${path.relative(root, filePath)}`);
  }
  // CLAUDE.md (2026-08-21): the quiet detector and the pressure trigger are
  // source files in services/. A one-line fix to either used to make this
  // replay refuse, so both digests are written down and the replay carries on.
  // The version check above still refuses on a changed detector version.
  const digestRecords = [
    recordObservedDigest({
      label: 'replay quiet detector',
      filePath: path.relative(root, quietPath),
      recordedSha256: manifest.provenance.quiet_detector.sha256,
      observedSha256: sha256File(quietPath),
    }),
    recordObservedDigest({
      label: 'replay pressure trigger',
      filePath: path.relative(root, triggerPath),
      recordedSha256: manifest.provenance.pressure_trigger.sha256,
      observedSha256: sha256File(triggerPath),
    }),
  ];

  const attestation = manifest.historical_execution_attestation;
  if (!attestation || !/^[0-9a-f]{64}$/u.test(attestation.transcript_sha256 || '')) {
    fail('historical execution attestation must pin the source transcript hash');
  }
  for (const field of ['command_sha256', 'output_sha256']) {
    if (!/^[0-9a-f]{64}$/u.test(attestation[field] || '')) {
      fail(`historical execution attestation must pin ${field}`);
    }
  }
  if (attestation.raw_corpus_status !== 'unavailable_after_local_remote_archive_and_actions_artifact_search') {
    fail('historical raw-corpus status changed');
  }
  if (!String(attestation.evidence_boundary || '').includes('not an independent reproduction')) {
    fail('historical execution attestation must retain the independent-reproduction boundary');
  }

  const personas = Object.entries(manifest.corpus || {});
  if (personas.length !== 2) fail('corpus must contain exactly two personas');
  const expectedTotal = personas.reduce((sum, [, spec]) => sum + Number(spec.expected_dialogues || 0), 0);
  if (expectedTotal !== manifest.expected_result?.dialogues) {
    fail(`persona counts total ${expectedTotal}, expected ${manifest.expected_result?.dialogues}`);
  }
  if (!Array.isArray(manifest.states) || !manifest.states.includes('neutral')) {
    fail('state vocabulary must be a non-empty list containing neutral');
  }
  for (const [persona, spec] of personas) {
    if (!spec.world || !Array.isArray(spec.arms) || !spec.arms.length) {
      fail(`${persona} must declare one world and at least one arm`);
    }
  }

  return { quietPath, triggerPath, expectedTotal, digestRecords };
}

function readTrace(tracePath) {
  const text = fs.readFileSync(tracePath, 'utf8').trim();
  if (!text) fail(`trace is empty: ${tracePath}`);
  try {
    return text.split('\n').map((line) => JSON.parse(line));
  } catch (error) {
    fail(`trace is not valid JSONL: ${tracePath} (${error.message})`);
  }
}

function traceDirectories(base) {
  return fs
    .readdirSync(base, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

export function loadLearnerProfileRecoveryCorpus(manifest, { root = ROOT } = {}) {
  const corpusRoot = resolveInside(root, manifest.corpus_root, 'corpus root');
  const missing = [];
  const sources = [];

  for (const [persona, spec] of Object.entries(manifest.corpus)) {
    for (const arm of spec.arms) {
      const base = path.join(corpusRoot, arm, 'traces', spec.world);
      if (!fs.existsSync(base)) {
        missing.push(path.relative(root, base));
        continue;
      }
      const dialogueDirs = traceDirectories(base);
      if (!dialogueDirs.length) {
        missing.push(`${path.relative(root, base)} (no dialogue directories)`);
        continue;
      }
      for (const dialogue of dialogueDirs) {
        const dir = path.join(base, dialogue);
        const traces = fs
          .readdirSync(dir)
          .filter((name) => name.endsWith('.jsonl'))
          .sort();
        if (traces.length !== 1) {
          missing.push(`${path.relative(root, dir)} (expected one JSONL trace, found ${traces.length})`);
          continue;
        }
        sources.push({
          persona,
          arm,
          dialogue,
          trace: path.join(dir, traces[0]),
          events: readTrace(path.join(dir, traces[0])),
        });
      }
    }
  }

  if (missing.length) {
    fail(`original trace corpus is incomplete; ${missing.length} required locations are missing`, { missing });
  }
  return sources;
}

function stateFrequency(labels, states) {
  return Object.fromEntries(
    states.map((state) => [state, labels.filter((label) => label === state).length / labels.length]),
  );
}

export function replayLearnerProfileStateVectors({ sources, states, minimumLearnerTurns, triggerPatterns }) {
  const vectors = [];
  const tooShort = [];

  for (const source of sources) {
    const quietState = createTutorStubQuietDetectorState();
    const perTurn = [];
    for (const event of source.events.filter((entry) => entry.type === 'turn_complete')) {
      const text = event.turnRecord?.learner || '';
      const pressure = classifyTutorStubLearnerPressure(text, triggerPatterns);
      let label = pressure;
      // Historical behavior: qd-v1 advances only on pressure-neutral turns.
      if (pressure === 'neutral') {
        const quiet = detectTutorStubQuietState(quietState, text, { pressure });
        label = quiet.type || 'neutral';
      }
      perTurn.push(label);
    }
    if (perTurn.length < minimumLearnerTurns) {
      tooShort.push({ ...source, learnerTurns: perTurn.length });
      continue;
    }
    vectors.push({
      ...Object.fromEntries(Object.entries(source).filter(([key]) => key !== 'events')),
      n: perTurn.length,
      vec: stateFrequency(perTurn, states),
      perTurn,
    });
  }

  if (tooShort.length) {
    fail(`${tooShort.length} source dialogues have fewer than ${minimumLearnerTurns} learner turns`, {
      tooShort: tooShort.map(({ trace, learnerTurns }) => ({ trace, learnerTurns })),
    });
  }

  return vectors;
}

export function replayLearnerProfileRecoveryCorpus(manifest, sources, triggerPatterns) {
  const vectors = replayLearnerProfileStateVectors({
    sources,
    states: manifest.states,
    minimumLearnerTurns: manifest.minimum_learner_turns,
    triggerPatterns,
  });

  for (const [persona, spec] of Object.entries(manifest.corpus)) {
    const observed = vectors.filter((vector) => vector.persona === persona).length;
    if (observed !== spec.expected_dialogues) {
      fail(`${persona} corpus has ${observed} dialogues, expected ${spec.expected_dialogues}`);
    }
  }
  if (vectors.length !== manifest.expected_result.dialogues) {
    fail(`corpus has ${vectors.length} dialogues, expected ${manifest.expected_result.dialogues}`);
  }
  return vectors;
}

function centroid(vectors, states) {
  if (!vectors.length) fail('cannot calculate a centroid from an empty set');
  return Object.fromEntries(
    states.map((state) => [state, vectors.reduce((sum, vector) => sum + vector.vec[state], 0) / vectors.length]),
  );
}

function distance(a, b, states) {
  return Math.sqrt(states.reduce((sum, state) => sum + (a[state] - b[state]) ** 2, 0));
}

function classify(vector, vectors, states, labelKey, labels, omittedVector = vector) {
  const centroids = Object.fromEntries(
    labels.map((label) => [
      label,
      centroid(
        vectors.filter((candidate) => candidate[labelKey] === label && candidate !== omittedVector),
        states,
      ),
    ]),
  );
  // This preserves the scratch replay's strict-less-than tie behavior: a tie
  // falls to the second label, historically the `tenant` persona.
  return distance(vector.vec, centroids[labels[0]], states) < distance(vector.vec, centroids[labels[1]], states)
    ? labels[0]
    : labels[1];
}

export function analyzeLeaveOneOutNearestCentroid({
  vectors,
  states,
  labelKey,
  labels = [...new Set(vectors.map((vector) => vector[labelKey]))],
  openingTurns = [],
}) {
  if (labels.length !== 2) fail(`classifier requires two ${labelKey} labels, found ${labels.length}`);
  if (vectors.some((vector) => !labels.includes(vector[labelKey]))) {
    fail(`classifier found a ${labelKey} value outside the frozen label order`);
  }
  const meanProfiles = Object.fromEntries(
    labels.map((label) => {
      const set = vectors.filter((vector) => vector[labelKey] === label);
      return [label, centroid(set, states)];
    }),
  );

  const predictions = vectors.map((vector) => ({
    id: vector.id || vector.trace,
    expected: vector[labelKey],
    predicted: classify(vector, vectors, states, labelKey, labels),
  }));
  const correct = predictions.filter((reading) => reading.predicted === reading.expected).length;
  const openingTurnResults = {};
  for (const turnCount of openingTurns) {
    let eligible = 0;
    let openingCorrect = 0;
    for (const vector of vectors) {
      if (vector.perTurn.length < turnCount) continue;
      const opening = vector.perTurn.slice(0, turnCount);
      const openingVector = { ...vector, vec: stateFrequency(opening, states) };
      const prediction = classify(openingVector, vectors, states, labelKey, labels, vector);
      eligible += 1;
      if (prediction === vector[labelKey]) openingCorrect += 1;
    }
    openingTurnResults[String(turnCount)] = {
      eligible,
      correct: openingCorrect,
      accuracy: eligible ? openingCorrect / eligible : null,
    };
  }

  return {
    dialogues: vectors.length,
    correct,
    accuracy: correct / vectors.length,
    labelKey,
    labels,
    meanProfiles,
    predictions,
    openingTurns: openingTurnResults,
  };
}

export function analyzeLearnerProfileRecoveryVectors(manifest, vectors) {
  return analyzeLeaveOneOutNearestCentroid({
    vectors,
    states: manifest.states,
    labelKey: 'persona',
    labels: Object.keys(manifest.corpus),
    openingTurns: manifest.classifier.opening_turns,
  });
}

export function verifyLearnerProfileRecoveryResult(manifest, result) {
  const expected = manifest.expected_result;
  const mismatches = [];
  for (const key of ['dialogues', 'correct']) {
    if (result[key] !== expected[key]) mismatches.push(`${key}: observed ${result[key]}, expected ${expected[key]}`);
  }
  for (const [turnCount, expectedReading] of Object.entries(expected.opening_turns)) {
    const observed = result.openingTurns[turnCount];
    if (!observed) {
      mismatches.push(`opening ${turnCount}: missing`);
      continue;
    }
    for (const key of ['eligible', 'correct']) {
      if (observed[key] !== expectedReading[key]) {
        mismatches.push(`opening ${turnCount} ${key}: observed ${observed[key]}, expected ${expectedReading[key]}`);
      }
    }
  }
  if (mismatches.length) fail(`replay did not reproduce the frozen result (${mismatches.join('; ')})`, { mismatches });
  return true;
}

function renderProfile(profile, states) {
  return states
    .filter((state) => profile[state] > 0.02)
    .map((state) => `${state}:${(profile[state] * 100).toFixed(0)}%`)
    .join(' ');
}

export function renderLearnerProfileRecoveryResult(manifest, result) {
  const lines = [
    `dialogues: ${result.dialogues} (${manifest.corpus['record-keeper'].expected_dialogues} record-keeper, ${manifest.corpus.tenant.expected_dialogues} tenant)`,
  ];
  for (const persona of Object.keys(manifest.corpus)) {
    lines.push('', `${persona} mean profile: ${renderProfile(result.meanProfiles[persona], manifest.states)}`);
  }
  lines.push(
    '',
    `leave-one-out nearest-centroid: ${result.correct}/${result.dialogues} = ${(100 * result.accuracy).toFixed(0)}%`,
  );
  for (const turnCount of manifest.classifier.opening_turns) {
    const reading = result.openingTurns[String(turnCount)];
    lines.push(
      `first ${turnCount} turns only: ${reading.correct}/${reading.eligible} = ${(100 * reading.accuracy).toFixed(0)}%`,
    );
  }
  return `${lines.join('\n')}\n`;
}

function parseArgs(argv) {
  const args = {
    manifest: DEFAULT_MANIFEST,
    root: ROOT,
    output: DEFAULT_OUTPUT,
    json: false,
    check: false,
    write: true,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--manifest') args.manifest = path.resolve(argv[++index]);
    else if (arg === '--root') args.root = path.resolve(argv[++index]);
    else if (arg === '--output') args.output = path.resolve(argv[++index]);
    else if (arg === '--json') args.json = true;
    else if (arg === '--check') args.check = true;
    else if (arg === '--no-write') args.write = false;
    else fail(`unknown argument: ${arg}`);
  }
  if (args.check) args.write = false;
  return args;
}

export function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const manifest = readLearnerProfileRecoveryManifest(args.manifest);
  const { triggerPath } = validateLearnerProfileRecoveryManifest(manifest, { root: args.root });
  const trigger = compileTutorStubTriggerArtifact(JSON.parse(fs.readFileSync(triggerPath, 'utf8')));
  const sources = loadLearnerProfileRecoveryCorpus(manifest, { root: args.root });
  const vectors = replayLearnerProfileRecoveryCorpus(manifest, sources, trigger.patterns);
  const result = analyzeLearnerProfileRecoveryVectors(manifest, vectors);
  verifyLearnerProfileRecoveryResult(manifest, result);

  if (args.write) {
    fs.mkdirSync(path.dirname(args.output), { recursive: true });
    const serializable = vectors.map(({ persona, arm, d, n, vec }) => ({ persona, arm, d, n, vec }));
    fs.writeFileSync(args.output, JSON.stringify(serializable, null, 1));
  }
  if (args.json) process.stdout.write(`${JSON.stringify({ status: 'reproduced', ...result }, null, 2)}\n`);
  else process.stdout.write(renderLearnerProfileRecoveryResult(manifest, result));
  return { manifest, vectors, result };
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    if (error.details?.missing) {
      for (const item of error.details.missing) console.error(`- ${item}`);
    }
    process.exitCode = 1;
  }
}
