#!/usr/bin/env node

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { TUTOR_STUB_TRAJECTORY_DEV_CORPUS_SCHEMA } from '../services/tutorStubTrajectoryShadow.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_ARTIFACT_ROOT = path.resolve(ROOT, '..', '..', '.tutor-stub-auto-eval');
const DEFAULT_CALIBRATION = path.join(
  ROOT,
  'tests',
  'fixtures',
  'tutor-stub-performance-calibration',
  'gazette-answer-seeking-v21.json',
);
const DEFAULT_OUTPUT = path.join(ROOT, 'config', 'tutor-stub-trajectory-dev-v1.json');

const EPISODE_SPECS = [
  {
    id: 'ravensmark-affective-resistant-v18',
    campaign: 'V18',
    relativeDir: 'first-draft-generalization-v18-live/ravensmark_affective_resistant',
    turnRange: [1, 6],
  },
  {
    id: 'greyfen-answer-seeking-v19',
    campaign: 'V19',
    relativeDir: 'first-draft-generalization-v19-live/greyfen_answer_seeking',
    turnRange: [1, 10],
  },
  {
    id: 'tallow-answer-seeking-v20-turns-1-5',
    campaign: 'V20',
    relativeDir: 'first-draft-generalization-v20-live/tallow_answer_seeking',
    turnRange: [1, 5],
  },
  {
    id: 'nocturne-answer-seeking-v22-turns-1-8',
    campaign: 'V22',
    relativeDir: 'first-draft-generalization-v22-live/nocturne_answer_seeking',
    turnRange: [1, 8],
  },
];

const { values: args } = parseArgs({
  options: {
    'artifact-root': { type: 'string', default: DEFAULT_ARTIFACT_ROOT },
    'blind-dir': { type: 'string' },
    calibration: { type: 'string', default: DEFAULT_CALIBRATION },
    out: { type: 'string', default: DEFAULT_OUTPUT },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

function usage() {
  return `Usage:
  node scripts/assemble-tutor-stub-trajectory-dev-corpus.js \\
    --blind-dir <saved-blind-review-dir> [--artifact-root <saved-auto-eval-root>]

This performs a public-only, model-free extraction into the permanently
non-held-out trajectory-dev-v1 corpus. It does not run or score a model.`;
}

if (args.help || !args['blind-dir']) {
  console.log(usage());
  process.exit(args.help ? 0 : 1);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function sha256(filePath) {
  return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function source(filePath) {
  return { path: path.resolve(filePath), sha256: sha256(filePath) };
}

function findSingle(directory, pattern, label) {
  const matches = fs.readdirSync(directory).filter((name) => pattern.test(name));
  if (matches.length !== 1) {
    throw new Error(`expected one ${label} in ${directory}; found ${matches.length}`);
  }
  return path.join(directory, matches[0]);
}

function issueRows(turn) {
  return [
    ...(turn.tutorDramaticReleaseAudit?.issues || []),
    ...(turn.tutorQuestionSupportAudit?.issues || []),
    ...(turn.tutorDialogueClosureAudit?.issues || []),
    ...(turn.releaseDeliveryAudit?.issues || []),
  ];
}

function countIssues(issues, pattern) {
  return issues.filter((issue) => pattern.test(`${issue.type || ''} ${issue.reason || ''}`)).length;
}

function normalizeIntegrity(turn, duplicateClueTurns) {
  const issues = issueRows(turn);
  return {
    privateEvidence: (turn.tutorLeakAudit?.leaks || []).length,
    unsupportedEvidence: countIssues(issues, /unsupported|evidence correspondence/iu),
    sourcePerspectiveDrift: countIssues(issues, /source.*(?:drift|replacement|perspective)/iu),
    duplicateClueDelivery: duplicateClueTurns.has(turn.turn) ? 1 : 0,
    missingClueDelivery:
      (turn.releasePacing?.notDeliveredNow || []).length + countIssues(issues, /missing.*(?:clue|release)/iu),
    unanswerableQuestion: countIssues(issues, /unanswerable|unstaged|unknown information/iu),
    terminalContinuation: countIssues(issues, /terminal continuation|reopen|missing explicit dialogue close/iu),
  };
}

function normalizeTurn(turn, duplicateClueTurns) {
  const configuration = turn.deliveredResponseConfiguration || turn.responseConfiguration || {};
  return {
    turn: turn.turn,
    turnId: turn.turnId,
    learner: turn.learner,
    tutor: turn.tutor,
    composition: {
      uptake: turn.responseComposition?.uptake || turn.responseComposition?.audit?.segments?.uptake || '',
      development:
        turn.responseComposition?.development || turn.responseComposition?.audit?.segments?.development || '',
      recordedOk: turn.responseComposition?.audit?.ok ?? null,
    },
    release: {
      dueNow: turn.releasePacing?.dueNow || [],
      releasedNow: turn.releasePacing?.releasedNow || [],
      notDeliveredNow: turn.releasePacing?.notDeliveredNow || [],
      direction: turn.releasePacing?.direction || 'unrecorded',
      effectiveSpeed: turn.releasePacing?.effectiveSpeed ?? null,
      signalDirection: turn.releasePacing?.signal?.direction || 'unrecorded',
    },
    configuration: {
      part: configuration.actorial_part || 'unrecorded',
      stance: configuration.engagement_stance || configuration.selected_register || 'unrecorded',
      tactic: configuration.actorial_performance?.id || 'unrecorded',
      realizationRate: turn.responseConfigurationAudit?.realization_rate ?? null,
    },
    closure: {
      mandatory: turn.dialogueClosure?.frame?.mandatory === true,
      closesDialogue: turn.dialogueClosure?.audit?.closesDialogue === true,
      questionCount: turn.dialogueClosure?.audit?.questionCount ?? null,
    },
    hardIntegrity: normalizeIntegrity(turn, duplicateClueTurns),
    finalDeliveryOutcome: turn.tutorGuardAccounting?.outcome || null,
  };
}

function loadTrace(tracePath) {
  return fs
    .readFileSync(tracePath, 'utf8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function duplicateClueTurnsFromReport(reportPath) {
  const report = readJson(reportPath);
  const values = new Set();
  for (const result of report.results || []) {
    for (const summary of result.traceSummaries || []) {
      for (const duplicate of summary.characterAdaptation?.duplicateClueDeliveries || []) {
        values.add(duplicate.turn);
      }
    }
  }
  return values;
}

function buildEpisode(spec, artifactRoot) {
  const directory = path.join(artifactRoot, spec.relativeDir);
  const tracePath = findSingle(directory, /^\d{4}-.*\.jsonl$/u, 'public trace');
  const reportPath = findSingle(directory, /^auto-eval-.*\.json$/u, 'auto-eval report');
  const duplicates = duplicateClueTurnsFromReport(reportPath);
  const [start, end] = spec.turnRange;
  const turns = loadTrace(tracePath)
    .filter((row) => row.type === 'turn_complete')
    .map((row) => row.turnRecord)
    .filter((turn) => turn.turn >= start && turn.turn <= end)
    .map((turn) => normalizeTurn(turn, duplicates));
  if (turns.length !== end - start + 1) {
    throw new Error(`${spec.id} expected ${end - start + 1} turns; found ${turns.length}`);
  }
  return {
    id: spec.id,
    campaign: spec.campaign,
    source: { trace: source(tracePath), report: source(reportPath) },
    turnRange: { start, end },
    turns,
  };
}

function buildBlindPairs(blindDir) {
  const corpusPath = path.join(blindDir, 'blind-corpus.json');
  const keyPath = path.join(blindDir, 'review-key.json');
  const ratingsPath = path.join(blindDir, 'ratings.json');
  const corpus = readJson(corpusPath);
  const key = readJson(keyPath);
  const ratings = readJson(ratingsPath);
  const keyById = new Map(key.cases.map((row) => [row.id, row]));
  const ratingsById = new Map(ratings.cases.map((row) => [row.id, row]));
  const pairs = corpus.cases.filter((row) => row.kind === 'pair');
  if (pairs.length !== 6) throw new Error(`expected six blind pairs; found ${pairs.length}`);
  return {
    source: {
      blindCorpus: source(corpusPath),
      reviewKey: source(keyPath),
      ratings: source(ratingsPath),
    },
    pairs: pairs.map((pair) => {
      const keyRow = keyById.get(pair.id);
      const ratingRow = ratingsById.get(pair.id);
      const sourceClassByLabel = new Map(keyRow.candidates.map((row) => [row.label, row.sourceClass]));
      const scoresByLabel = new Map(ratingRow.candidates.map((row) => [row.label, row.scores]));
      return {
        id: pair.id,
        campaign: keyRow.campaign,
        source: {
          trace: { path: keyRow.tracePath, sha256: sha256(keyRow.tracePath) },
          turn: keyRow.turn,
        },
        context: pair.context,
        learner: pair.learner,
        originalAuditIssues: keyRow.originalAuditIssues,
        preference: sourceClassByLabel.get(ratingRow.preference),
        candidates: pair.candidates.map((candidate) => ({
          sourceClass: sourceClassByLabel.get(candidate.label),
          text: candidate.text,
          scores: scoresByLabel.get(candidate.label),
        })),
      };
    }),
  };
}

function buildCalibrationCases(calibrationPath) {
  const fixture = readJson(calibrationPath);
  if (fixture.cases.length !== 2) throw new Error(`expected two V21 calibration cases; found ${fixture.cases.length}`);
  return fixture.cases.map((row) => ({
    id: row.id,
    source: { fixture: source(calibrationPath), turn: row.turn },
    learner: row.learnerMessage,
    candidate: row.originalCandidate,
    expectedLabel: row.calibration.expectedLabel,
    expectedPerformanceRealized: row.calibration.expectedPerformanceRealized,
    recordedAuditIssue: row.recordedAudit.issues[0]?.type || null,
    rationale: row.calibration.rationale,
  }));
}

const artifactRoot = path.resolve(args['artifact-root']);
const blindDir = path.resolve(args['blind-dir']);
const calibrationPath = path.resolve(args.calibration);
const blind = buildBlindPairs(blindDir);
const corpus = {
  schema: TUTOR_STUB_TRAJECTORY_DEV_CORPUS_SCHEMA,
  id: 'trajectory-dev-v1',
  generatedAt: new Date().toISOString(),
  heldOut: false,
  runtimeDeliveryGate: false,
  retroactiveRelabeling: false,
  sourcePolicy:
    'Saved public learner/tutor messages plus normalized final-delivery audits only. Hidden evidence and private planner text are excluded.',
  claimBoundary:
    'This permanently non-held-out corpus supports development diagnostics only. It cannot relabel V18-V22, establish held-out generalization, or change runtime delivery gates. Independent blinded human review is required before any policy change.',
  sourceArtifacts: blind.source,
  pairedReviews: blind.pairs,
  calibrationCases: buildCalibrationCases(calibrationPath),
  sequenceEpisodes: EPISODE_SPECS.map((spec) => buildEpisode(spec, artifactRoot)),
  paceProbes: [
    {
      id: 'pace-fast-development-probe',
      synthetic: true,
      sourceEpisodeId: 'greyfen-answer-seeking-v19',
      sourceTurn: 5,
      learnerMessage: 'This is taking too long—move it along and give me the next clue.',
      expectedDirection: 'faster',
    },
    {
      id: 'pace-slow-development-probe',
      synthetic: true,
      sourceEpisodeId: 'greyfen-answer-seeking-v19',
      sourceTurn: 5,
      learnerMessage: 'Please slow down and keep us to one clue at a time.',
      expectedDirection: 'slower',
    },
  ],
};

const outputPath = path.resolve(args.out);
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(corpus, null, 2)}\n`, 'utf8');
console.log(outputPath);
