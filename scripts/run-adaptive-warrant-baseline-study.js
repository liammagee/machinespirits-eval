#!/usr/bin/env node

/**
 * Paired-seed baseline study for the explicit adaptive warrant gate.
 *
 * Design authority:
 *   docs/adaptation-refinement/baseline-comparison-design.md
 *
 * Conditions hold the tutor-stub pipeline, dynamic register policy, world,
 * models, learner profile, fixed eight-turn horizon, and run seed constant.
 * Only the warrant-gate mode changes: off, observe, or active.
 *
 * Live usage requires an explicit --launch-approved flag. The default is the
 * predeclared n=5 pilot; --runs 10 is the full study.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { deriveAdaptiveWarrantShadow } from './derive-adaptive-warrant-shadow.js';

export const ADAPTIVE_WARRANT_BASELINE_STUDY_SCHEMA = 'machinespirits.adaptation-refinement.baseline-study.v1';
export const ADAPTIVE_WARRANT_BASELINE_RESULT_SCHEMA = 'machinespirits.adaptation-refinement.baseline-study-results.v1';
export const ADAPTIVE_WARRANT_ANNOTATION_SCHEMA = 'machinespirits.adaptation-refinement.warrant-annotation-corpus.v1';
export const ADAPTIVE_WARRANT_ANNOTATION_SCORE_SCHEMA =
  'machinespirits.adaptation-refinement.warrant-annotation-scores.v1';

export const STUDY_CONDITIONS = Object.freeze([
  { id: 'baseline', warrantGateMode: 'off' },
  { id: 'instrumented', warrantGateMode: 'observe' },
  { id: 'intervening', warrantGateMode: 'active' },
]);
export const STUDY_PROFILES = Object.freeze(['low_agency', 'diligent', 'affective_resistant']);

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(SCRIPT_PATH), '..');
const DEFAULT_MODEL = 'codex.gpt-5.6-luna';
const DEFAULT_HORIZON = 8;
const LEARNER_ANALYSIS_PROMPT_PROFILE = 'compact_v1';
const SOURCE_FILES = Object.freeze([
  'docs/adaptation-refinement/baseline-comparison-design.md',
  'docs/adaptation-refinement/gold-annotations-first-corpus.md',
  'docs/adaptation-refinement/normative-adaptive-dialogue-architecture.md',
  'config/drama-derivation/world-005-marrick.yaml',
  'scripts/run-adaptive-warrant-baseline-study.js',
  'scripts/derive-adaptive-warrant-shadow.js',
  'scripts/run-tutor-stub-auto-eval.js',
  'scripts/tutor-stub-learner-profile-contracts.js',
  'services/adaptiveWarrantGateCore.js',
  'services/adaptiveWarrantPolicy.js',
  'services/tutorStubPromptAudit.js',
  'services/tutorStubPublicLearnerAnalysis.js',
  'services/tutorStubWarrantGate.js',
  'services/tutorStubResponseConfigurationSelectionRuntime.js',
  'services/tutorStubTurnOrchestration.js',
]);

function positiveInt(value, label) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) throw new Error(`${label} must be a positive integer`);
  return parsed;
}

function oneLine(value) {
  return String(value || '')
    .replace(/\s+/gu, ' ')
    .trim();
}

function safeTimestamp() {
  return new Date().toISOString().replace(/[:.]/gu, '-');
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function fileSha256(filePath) {
  return sha256(fs.readFileSync(filePath));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readJsonl(filePath) {
  const rows = [];
  for (const [index, line] of fs.readFileSync(filePath, 'utf8').split('\n').entries()) {
    if (!line.trim()) continue;
    try {
      rows.push(JSON.parse(line));
    } catch (error) {
      throw new Error(`Invalid JSONL at ${filePath}:${index + 1}: ${error.message}`);
    }
  }
  return rows;
}

function listFilesRecursive(rootDir, matcher) {
  if (!fs.existsSync(rootDir)) return [];
  const files = [];
  const visit = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const candidate = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(candidate);
      else if (matcher(candidate)) files.push(candidate);
    }
  };
  visit(rootDir);
  return files;
}

function latestFile(files) {
  return [...files].sort((left, right) => fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs)[0] || null;
}

function gitValue(args) {
  const result = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : null;
}

function sourceFingerprint() {
  const files = Object.fromEntries(
    SOURCE_FILES.map((relative) => {
      const absolute = path.join(ROOT, relative);
      return [relative, fs.existsSync(absolute) ? fileSha256(absolute) : null];
    }),
  );
  return {
    gitCommit: gitValue(['rev-parse', 'HEAD']),
    gitBranch: gitValue(['branch', '--show-current']),
    gitStatus: gitValue(['status', '--short']) || '',
    files,
    combinedSha256: sha256(JSON.stringify(files)),
  };
}

function shellDisplay(command, env = {}) {
  const quoted = command.map((part) => (/[\s'"$]/u.test(part) ? JSON.stringify(part) : part)).join(' ');
  const prefix = Object.entries(env)
    .map(([key, value]) => `${key}=${JSON.stringify(String(value))}`)
    .join(' ');
  return prefix ? `${prefix} ${quoted}` : quoted;
}

export function buildAdaptiveWarrantBaselineJobs({
  rootDir,
  runs = 5,
  masterSeed = 101,
  model = DEFAULT_MODEL,
  analysisModel = DEFAULT_MODEL,
  learnerModel = DEFAULT_MODEL,
  world = 'world_005_marrick',
  horizon = DEFAULT_HORIZON,
  maxTokens = 4096,
  historyTurns = 4,
  dryRun = false,
  studyId = path.basename(rootDir),
} = {}) {
  const jobs = [];
  for (let runIndex = 1; runIndex <= runs; runIndex += 1) {
    const seed = masterSeed + runIndex - 1;
    const cells = STUDY_PROFILES.flatMap((profile) =>
      STUDY_CONDITIONS.map((condition) => ({ profile, condition })),
    ).sort((left, right) =>
      sha256(`${studyId}|${runIndex}|${left.profile}|${left.condition.id}`).localeCompare(
        sha256(`${studyId}|${runIndex}|${right.profile}|${right.condition.id}`),
      ),
    );
    for (const { profile, condition } of cells) {
      const id = `${profile}-${condition.id}-r${runIndex}-s${seed}`;
      const jobDir = path.join(rootDir, 'jobs', id);
      const command = [
        process.execPath,
        'scripts/run-tutor-stub-auto-eval.js',
        '--runs',
        '1',
        '--run-seed',
        String(seed),
        '--turns',
        String(horizon),
        '--no-stop-on-grounded',
        '--primary-horizon',
        String(horizon),
        '--policies',
        'dynamic',
        '--warrant-gate',
        condition.warrantGateMode,
        '--auto-learner-profile-id',
        profile,
        '--world',
        world,
        '--dag-mode',
        'strict_dag',
        '--loop-mode',
        'strict',
        '--model',
        model,
        '--analysis-model',
        analysisModel,
        '--learner-analysis-prompt-profile',
        LEARNER_ANALYSIS_PROMPT_PROFILE,
        '--auto-learner-model',
        learnerModel,
        '--cli-effort',
        'medium',
        '--history-turns',
        String(historyTurns),
        '--max-tokens',
        String(maxTokens),
        '--register-temperature',
        '0.15',
        '--dag-fact-dropout',
        '0',
        '--release-speed',
        '1',
        '--parallelism',
        '1',
        '--progress-interval',
        '60',
        '--trace-dir',
        jobDir,
        '--parent-run-id',
        studyId,
        '--no-ledger',
        '--no-html-report',
        '--keep-going',
      ];
      if (dryRun) command.push('--dry-run');
      jobs.push({
        id,
        ordinal: jobs.length + 1,
        runIndex,
        seed,
        profile,
        condition: condition.id,
        warrantGateMode: condition.warrantGateMode,
        jobDir,
        command,
      });
    }
  }
  return jobs;
}

// This measure is deliberately separate from adaptiveWarrantGateCore: it is a
// public-text outcome definition, not the gate's signal classifier.
const DEFERRED_OPENING =
  /^(?:may|might|should|shall|could|can|would) (?:i|we)\b|^(?:would|could|will|can) you\b|^do you want (?:me|us) to\b|^is it (?:all right|ok(?:ay)?) if\b/iu;
const HEDGE_OPENING = /^(?:i (?:think|suppose|guess)|maybe|perhaps|possibly|it (?:seems|might|may)|i'?m not sure)\b/iu;
const CLAIM_PREDICATE =
  /\b(?:is|are|was|were|shows?|supports?|means?|establish(?:es|ed)?|rules? out|proves?|indicates?|requires?|cannot|does not|did not|must)\b/iu;

export function isUnhedgedOwnVoiceClaim(text) {
  const surface = oneLine(text);
  if (!surface || surface.length < 12 || DEFERRED_OPENING.test(surface) || HEDGE_OPENING.test(surface)) return false;
  if (surface.endsWith('?')) return false;
  return CLAIM_PREDICATE.test(surface);
}

function dagTotal(record) {
  const dag = record?.stateObservation?.dag || {};
  return Number(dag.grounded_count || 0) + Number(dag.voiced_derived_count || 0);
}

function deliveredFamily(record) {
  return (
    record?.deliveredResponseConfiguration?.action_family ||
    record?.registerSelection?.response_configuration?.action_family ||
    record?.registerSelection?.action_family ||
    null
  );
}

function traceDecisionRows(tracePath, turnRecords) {
  const shadow = deriveAdaptiveWarrantShadow(tracePath).sessions[0]?.decisions || [];
  const shadowByTurn = new Map(shadow.map((decision) => [Number(decision.turn), decision]));
  return turnRecords.slice(1).map((record, index) => {
    const turn = Number(record.turn || index + 2);
    const prior = turnRecords[index];
    const gate = record?.registerSelection?.warrant_gate || null;
    const shadowDecision = shadowByTurn.get(turn) || null;
    const family = deliveredFamily(record);
    const priorFamily = deliveredFamily(prior);
    return {
      turn,
      strategy_in_force: priorFamily,
      actual_family: family,
      revised: Boolean(family && priorFamily && family !== priorFamily),
      gate,
      shadow: shadowDecision,
      live_shadow_agree: gate && shadowDecision ? gate.revision_warranted === shadowDecision.revision_warranted : null,
    };
  });
}

export function summarizeAdaptiveWarrantTrace({ tracePath, job, childStatus = null, summaryPath = null } = {}) {
  const events = readJsonl(tracePath);
  const turnRecords = events
    .filter((event) => event.type === 'turn_complete' && event.turnRecord)
    .map((event) => event.turnRecord)
    .sort((left, right) => Number(left.turn) - Number(right.turn));
  const decisions = traceDecisionRows(tracePath, turnRecords);
  const learnerAnalysisCalls = events.filter(
    (event) => event.type === 'model_call' && event.role === 'tutor_stub_learner_analysis',
  );
  const learnerAnalysisPromptFailures = events.filter(
    (event) => event.type === 'prompt_audit_failed' && event.role === 'tutor_stub_learner_analysis',
  );
  const successfulLearnerAnalysisTurns = turnRecords.filter(
    (record) => record.classification?.combined === true && !record.classification?.error,
  );
  const liveDecisions = decisions.filter((row) => row.gate);
  const shadowDecisions = decisions.filter((row) => row.shadow);
  const firstWarrant = shadowDecisions.find((row) => row.shadow.revision_warranted)?.turn || null;
  const firstRevision = firstWarrant
    ? decisions.find((row) => row.turn >= firstWarrant && row.revised)?.turn || null
    : null;
  const firstOwnVoiceClaim = turnRecords.find((record) => isUnhedgedOwnVoiceClaim(record.learner))?.turn || null;
  const initialDagTotal = turnRecords.length ? dagTotal(turnRecords[0]) : null;
  const finalDagTotal = turnRecords.length ? dagTotal(turnRecords.at(-1)) : null;
  const publicTurns = turnRecords.map((record) => ({
    turn: Number(record.turn),
    learner: oneLine(record.learner),
    tutor: oneLine(record.tutor),
    dag_total: dagTotal(record),
    grounded_count: Number(record?.stateObservation?.dag?.grounded_count || 0),
    voiced_derived_count: Number(record?.stateObservation?.dag?.voiced_derived_count || 0),
    action_family: deliveredFamily(record),
  }));
  return {
    schema: ADAPTIVE_WARRANT_BASELINE_RESULT_SCHEMA,
    jobId: job.id,
    runIndex: job.runIndex,
    seed: job.seed,
    profile: job.profile,
    condition: job.condition,
    warrantGateMode: job.warrantGateMode,
    childStatus,
    summaryPath,
    tracePath,
    turnCount: turnRecords.length,
    learnerAnalysisCallCount: learnerAnalysisCalls.length,
    learnerAnalysisPromptFailureCount: learnerAnalysisPromptFailures.length,
    learnerAnalysisErrorCount: turnRecords.filter((record) => record.classification?.error).length,
    learnerAnalysisCoverage: turnRecords.length
      ? Number((successfulLearnerAnalysisTurns.length / turnRecords.length).toFixed(3))
      : null,
    initialDagTotal,
    finalDagTotal,
    learnerRecordGrowth:
      initialDagTotal === null || finalDagTotal === null ? null : Number(finalDagTotal - initialDagTotal),
    firstUnhedgedOwnVoiceClaimTurn: firstOwnVoiceClaim,
    deferenceBreakByHorizon: firstOwnVoiceClaim !== null,
    firstWarrantTurn: firstWarrant,
    firstRevisionTurn: firstRevision,
    revisionLagTurns: firstWarrant === null || firstRevision === null ? null : firstRevision - firstWarrant,
    warrantedButUnrevisedByHorizon: firstWarrant !== null && firstRevision === null,
    liveWarrantCount: liveDecisions.filter((row) => row.gate.revision_warranted).length,
    shadowWarrantCount: shadowDecisions.filter((row) => row.shadow.revision_warranted).length,
    overrideCount: liveDecisions.filter((row) => row.gate.override).length,
    gateOutcomeCoverage: liveDecisions.length
      ? Number((liveDecisions.filter((row) => row.gate.prior_turn_outcome).length / liveDecisions.length).toFixed(3))
      : null,
    liveShadowAgreement: liveDecisions.filter((row) => row.live_shadow_agree !== null).length
      ? Number(
          (
            liveDecisions.filter((row) => row.live_shadow_agree === true).length /
            liveDecisions.filter((row) => row.live_shadow_agree !== null).length
          ).toFixed(3),
        )
      : null,
    fallbackCount: turnRecords.filter((record) => record.tutorDeterministicFallback).length,
    leakFailureCount: turnRecords.filter((record) => record.tutorLeakAudit?.ok === false).length,
    decisions,
    publicTurns,
  };
}

function mean(values) {
  const finite = values
    .filter((value) => value !== null && value !== undefined && value !== '')
    .map(Number)
    .filter(Number.isFinite);
  return finite.length ? Number((finite.reduce((sum, value) => sum + value, 0) / finite.length).toFixed(3)) : null;
}

function aggregateGroup(rows) {
  const ok = rows.filter((row) => row.childStatus === 'ok' && row.turnCount > 0);
  const breaks = ok.filter((row) => row.deferenceBreakByHorizon);
  const warranted = ok.filter((row) => row.firstWarrantTurn !== null);
  return {
    planned: rows.length,
    ok: ok.length,
    failed: rows.length - ok.length,
    meanLearnerRecordGrowth: mean(ok.map((row) => row.learnerRecordGrowth)),
    meanLearnerAnalysisCoverage: mean(ok.map((row) => row.learnerAnalysisCoverage)),
    learnerAnalysisErrors: ok.reduce((sum, row) => sum + Number(row.learnerAnalysisErrorCount || 0), 0),
    deferenceBreakRate: ok.length ? Number((breaks.length / ok.length).toFixed(3)) : null,
    meanDeferenceBreakTurn: mean(breaks.map((row) => row.firstUnhedgedOwnVoiceClaimTurn)),
    warrantedSessions: warranted.length,
    warrantedButUnrevised: warranted.filter((row) => row.warrantedButUnrevisedByHorizon).length,
    meanRevisionLagTurns: mean(warranted.map((row) => row.revisionLagTurns)),
    meanLiveWarrants: mean(ok.map((row) => row.liveWarrantCount)),
    meanShadowWarrants: mean(ok.map((row) => row.shadowWarrantCount)),
    overrideSessions: ok.filter((row) => row.overrideCount > 0).length,
    meanOverrides: mean(ok.map((row) => row.overrideCount)),
    meanGateOutcomeCoverage: mean(ok.map((row) => row.gateOutcomeCoverage)),
    meanLiveShadowAgreement: mean(ok.map((row) => row.liveShadowAgreement)),
    fallbacks: ok.reduce((sum, row) => sum + row.fallbackCount, 0),
    leakFailures: ok.reduce((sum, row) => sum + row.leakFailureCount, 0),
  };
}

export function aggregateAdaptiveWarrantStudy(rows, { horizon = DEFAULT_HORIZON } = {}) {
  const byCell = {};
  for (const profile of STUDY_PROFILES) {
    byCell[profile] = {};
    for (const condition of STUDY_CONDITIONS) {
      byCell[profile][condition.id] = aggregateGroup(
        rows.filter((row) => row.profile === profile && row.condition === condition.id),
      );
    }
  }
  const pairedContrasts = {};
  for (const profile of STUDY_PROFILES) {
    const pairs = [];
    const observePairs = [];
    const profileRows = rows.filter((row) => row.profile === profile && row.childStatus === 'ok');
    const bySeed = new Map();
    for (const row of profileRows) {
      if (!bySeed.has(row.seed)) bySeed.set(row.seed, {});
      bySeed.get(row.seed)[row.condition] = row;
    }
    for (const [seed, cells] of bySeed) {
      if (!cells.baseline) continue;
      const baselineBreak = cells.baseline.firstUnhedgedOwnVoiceClaimTurn ?? horizon + 1;
      if (cells.intervening) {
        const activeBreak = cells.intervening.firstUnhedgedOwnVoiceClaimTurn ?? horizon + 1;
        pairs.push({
          seed,
          learnerRecordGrowthDifference: cells.intervening.learnerRecordGrowth - cells.baseline.learnerRecordGrowth,
          deferenceBreakRateDifference:
            Number(cells.intervening.deferenceBreakByHorizon) - Number(cells.baseline.deferenceBreakByHorizon),
          deferenceBreakTurnDifference: activeBreak - baselineBreak,
        });
      }
      if (cells.instrumented) {
        const observeBreak = cells.instrumented.firstUnhedgedOwnVoiceClaimTurn ?? horizon + 1;
        observePairs.push({
          seed,
          learnerRecordGrowthDifference: cells.instrumented.learnerRecordGrowth - cells.baseline.learnerRecordGrowth,
          deferenceBreakRateDifference:
            Number(cells.instrumented.deferenceBreakByHorizon) - Number(cells.baseline.deferenceBreakByHorizon),
          deferenceBreakTurnDifference: observeBreak - baselineBreak,
        });
      }
    }
    pairedContrasts[profile] = {
      pairs: pairs.length,
      instrumentedPairs: observePairs.length,
      activeMinusBaselineLearnerRecordGrowth: mean(pairs.map((row) => row.learnerRecordGrowthDifference)),
      activeMinusBaselineDeferenceBreakRate: mean(pairs.map((row) => row.deferenceBreakRateDifference)),
      activeMinusBaselineDeferenceBreakTurn: mean(pairs.map((row) => row.deferenceBreakTurnDifference)),
      instrumentedMinusBaselineLearnerRecordGrowth: mean(
        observePairs.map((row) => row.learnerRecordGrowthDifference),
      ),
      instrumentedMinusBaselineDeferenceBreakRate: mean(
        observePairs.map((row) => row.deferenceBreakRateDifference),
      ),
      instrumentedMinusBaselineDeferenceBreakTurn: mean(
        observePairs.map((row) => row.deferenceBreakTurnDifference),
      ),
      rows: pairs,
      instrumentedRows: observePairs,
    };
  }
  return { byCell, pairedContrasts };
}

export function resolveAdaptiveWarrantStudyStatus(rows, jobs, { dryRun = false } = {}) {
  if (rows.length !== jobs.length) return 'incomplete';
  if (dryRun) return rows.every((row) => row.childStatus === 'dry_run') ? 'dry_run' : 'incomplete';
  if (!rows.every((row) => row.childStatus === 'ok')) return 'incomplete';
  const analysisValid = rows.every(
    (row) =>
      row.turnCount === DEFAULT_HORIZON &&
      row.learnerAnalysisCallCount === row.turnCount &&
      row.learnerAnalysisErrorCount === 0 &&
      row.learnerAnalysisPromptFailureCount === 0 &&
      row.learnerAnalysisCoverage === 1,
  );
  return analysisValid ? 'complete' : 'invalid_analysis';
}

export function buildBlindedAnnotationCorpus(
  rows,
  { perCell = 2, studyId = 'study', samplingSeed = studyId, offsetPerCell = 0, sampleIdPrefix = 'case' } = {},
) {
  const cases = [];
  const key = [];
  for (const profile of STUDY_PROFILES) {
    for (const condition of STUDY_CONDITIONS) {
      const candidates = rows
        .filter((row) => row.profile === profile && row.condition === condition.id && row.childStatus === 'ok')
        .flatMap((row) =>
          row.decisions.map((decision) => ({ row, decision })).filter(({ decision }) => decision.turn >= 2),
        )
        .sort((left, right) =>
          sha256(`${samplingSeed}|${left.row.jobId}|${left.decision.turn}`).localeCompare(
            sha256(`${samplingSeed}|${right.row.jobId}|${right.decision.turn}`),
          ),
        )
        .slice(offsetPerCell, offsetPerCell + perCell);
      for (const { row, decision } of candidates) {
        const sampleId = `${sampleIdPrefix}-${String(cases.length + 1).padStart(3, '0')}`;
        const priorTurns = row.publicTurns.filter((turn) => turn.turn < decision.turn);
        const current = row.publicTurns.find((turn) => turn.turn === decision.turn);
        cases.push({
          sample_id: sampleId,
          transcript_before_decision: priorTurns.map(({ turn, learner, tutor }) => ({ turn, learner, tutor })),
          current_learner_turn: current ? { turn: current.turn, learner: current.learner } : null,
          learner_record_at_decision: current
            ? {
                grounded_count: current.grounded_count,
                voiced_derived_count: current.voiced_derived_count,
                total: current.dag_total,
              }
            : null,
          strategy_in_force: decision.strategy_in_force,
          revision_warranted: null,
          note: null,
        });
        key.push({
          sample_id: sampleId,
          job_id: row.jobId,
          profile: row.profile,
          condition: row.condition,
          seed: row.seed,
          trace: row.tracePath,
          turn: decision.turn,
          shadow: decision.shadow,
          gate: decision.gate,
          actual_family: decision.actual_family,
          revised: decision.revised,
        });
      }
    }
  }
  return {
    corpus: {
      schema: ADAPTIVE_WARRANT_ANNOTATION_SCHEMA,
      study_id: studyId,
      blinded: true,
      instructions:
        'Independently label revision_warranted as yes, no, or uncertain using only evidence available when the current learner turn arrived. Uncertain rows are reported but not scored.',
      cases,
    },
    key: {
      schema: `${ADAPTIVE_WARRANT_ANNOTATION_SCHEMA}.key`,
      study_id: studyId,
      blinded: false,
      cases: key,
    },
  };
}

function annotationLabel(value) {
  const label = String(value || '').trim().toLowerCase();
  return ['yes', 'no', 'uncertain'].includes(label) ? label : null;
}

export function validateBlindedAnnotationResponse({ response, corpus, expectedCorpusSha256 = null } = {}) {
  if (response?.schema !== 'machinespirits.adaptation-refinement.warrant-annotation-response.v1') {
    throw new Error('annotation response has an unsupported schema');
  }
  if (!corpus?.blinded || !Array.isArray(corpus.cases)) throw new Error('annotation corpus is not a blinded corpus');
  if (response.study_id !== corpus.study_id) throw new Error('annotation response study_id does not match the corpus');
  if (expectedCorpusSha256 && response.corpus_sha256 !== expectedCorpusSha256) {
    throw new Error('annotation response corpus_sha256 does not match the frozen corpus');
  }
  const expectedIds = corpus.cases.map((row) => row.sample_id).sort();
  const responseIds = (response.cases || []).map((row) => row.sample_id).sort();
  if (new Set(responseIds).size !== responseIds.length) throw new Error('annotation response contains duplicate sample ids');
  if (JSON.stringify(responseIds) !== JSON.stringify(expectedIds)) {
    throw new Error(`annotation response must label exactly ${expectedIds.length} frozen cases`);
  }
  for (const row of response.cases) {
    if (!annotationLabel(row.revision_warranted)) {
      throw new Error(`annotation response ${row.sample_id} has an invalid revision_warranted label`);
    }
    if (!oneLine(row.note)) throw new Error(`annotation response ${row.sample_id} requires a decision-time evidence note`);
  }
  return {
    ok: true,
    cases: responseIds.length,
    counts: Object.fromEntries(
      ['yes', 'no', 'uncertain'].map((label) => [
        label,
        response.cases.filter((row) => annotationLabel(row.revision_warranted) === label).length,
      ]),
    ),
  };
}

function ratio(numerator, denominator) {
  return denominator ? Number((numerator / denominator).toFixed(3)) : null;
}

export function scoreBlindedAnnotations({ annotatorA, annotatorB, key } = {}) {
  const first = new Map((annotatorA?.cases || []).map((row) => [row.sample_id, row]));
  const second = new Map((annotatorB?.cases || []).map((row) => [row.sample_id, row]));
  const keyed = new Map((key?.cases || []).map((row) => [row.sample_id, row]));
  const sampleIds = [...new Set([...first.keys(), ...second.keys(), ...keyed.keys()])].sort();
  const cases = sampleIds.map((sampleId) => {
    const labelA = annotationLabel(first.get(sampleId)?.revision_warranted);
    const labelB = annotationLabel(second.get(sampleId)?.revision_warranted);
    const consensus = labelA === labelB && ['yes', 'no'].includes(labelA) ? labelA : 'uncertain';
    const keyRow = keyed.get(sampleId) || null;
    const rawPrediction = keyRow?.gate?.revision_warranted ?? keyRow?.shadow?.revision_warranted;
    const predicted = typeof rawPrediction === 'boolean' ? (rawPrediction ? 'yes' : 'no') : null;
    return {
      sample_id: sampleId,
      annotator_a: labelA,
      annotator_b: labelB,
      consensus,
      predicted,
      scored: consensus !== 'uncertain' && predicted !== null,
      match: consensus !== 'uncertain' && predicted !== null ? consensus === predicted : null,
      profile: keyRow?.profile || null,
      condition: keyRow?.condition || null,
      seed: keyRow?.seed ?? null,
      turn: keyRow?.turn ?? null,
    };
  });
  const scored = cases.filter((row) => row.scored);
  const truePositive = scored.filter((row) => row.consensus === 'yes' && row.predicted === 'yes').length;
  const trueNegative = scored.filter((row) => row.consensus === 'no' && row.predicted === 'no').length;
  const falsePositive = scored.filter((row) => row.consensus === 'no' && row.predicted === 'yes').length;
  const falseNegative = scored.filter((row) => row.consensus === 'yes' && row.predicted === 'no').length;
  const rawAgreement = cases.filter(
    (row) => row.annotator_a !== null && row.annotator_b !== null && row.annotator_a === row.annotator_b,
  ).length;
  const jointlyLabeled = cases.filter((row) => row.annotator_a !== null && row.annotator_b !== null).length;
  return {
    schema: ADAPTIVE_WARRANT_ANNOTATION_SCORE_SCHEMA,
    cases,
    metrics: {
      totalCases: cases.length,
      jointlyLabeled,
      rawAnnotatorAgreement: ratio(rawAgreement, jointlyLabeled),
      scoredConsensusCases: scored.length,
      uncertainCases: cases.length - scored.length,
      truePositive,
      trueNegative,
      falsePositive,
      falseNegative,
      precision: ratio(truePositive, truePositive + falsePositive),
      recall: ratio(truePositive, truePositive + falseNegative),
      accuracy: ratio(truePositive + trueNegative, scored.length),
    },
  };
}

function markdownReport(study) {
  const lines = [
    '# Adaptive warrant baseline study',
    '',
    `Study: \`${study.studyId}\`  `,
    `Status: **${study.status}**  `,
    `Rows: ${study.rows.length}/${study.plan.jobs.length} collected`,
    '',
    '## Decision and downstream measures',
    '',
    '| Learner | Condition | OK/planned | Analysis | Record growth | Deference break | Break turn | Warrant sessions | Unrevised | Lag | Live/shadow | Override sessions | Overrides/row |',
    '|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|',
  ];
  for (const profile of STUDY_PROFILES) {
    for (const condition of STUDY_CONDITIONS) {
      const cell = study.aggregates.byCell[profile][condition.id];
      lines.push(
        `| ${profile} | ${condition.id} | ${cell.ok}/${cell.planned} | ${cell.meanLearnerAnalysisCoverage ?? 'n/a'} | ${cell.meanLearnerRecordGrowth ?? 'n/a'} | ${cell.deferenceBreakRate ?? 'n/a'} | ${cell.meanDeferenceBreakTurn ?? 'n/a'} | ${cell.warrantedSessions} | ${cell.warrantedButUnrevised} | ${cell.meanRevisionLagTurns ?? 'n/a'} | ${cell.meanLiveShadowAgreement ?? 'n/a'} | ${cell.overrideSessions} | ${cell.meanOverrides ?? 'n/a'} |`,
      );
    }
  }
  if (study.decisionQuality) {
    const metrics = study.decisionQuality.metrics;
    lines.push(
      '',
      '## Blinded decision quality',
      '',
      '| Scored consensus | Uncertain | Annotator agreement | Precision | Recall | Accuracy |',
      '|---:|---:|---:|---:|---:|---:|',
      `| ${metrics.scoredConsensusCases} | ${metrics.uncertainCases} | ${metrics.rawAnnotatorAgreement ?? 'n/a'} | ${metrics.precision ?? 'n/a'} | ${metrics.recall ?? 'n/a'} | ${metrics.accuracy ?? 'n/a'} |`,
    );
  }
  if (study.postRepairValidation) {
    const metrics = study.postRepairValidation.metrics;
    lines.push(
      '',
      '## Post-repair zero-overlap holdout',
      '',
      '| Scored consensus | Uncertain | Annotator agreement | Precision | Recall | Accuracy | Disposition |',
      '|---:|---:|---:|---:|---:|---:|---|',
      `| ${metrics.scoredConsensusCases} | ${metrics.uncertainCases} | ${metrics.rawAnnotatorAgreement ?? 'n/a'} | ${metrics.precision ?? 'n/a'} | ${metrics.recall ?? 'n/a'} | ${metrics.accuracy ?? 'n/a'} | candidate rejected and reverted |`,
    );
  }
  lines.push('', '## Paired active and inert-observe minus baseline contrasts', '');
  lines.push(
    '| Learner | Pairs | Observe record growth | Active record growth | Observe break rate | Active break rate | Observe break turn | Active break turn |',
  );
  lines.push('|---|---:|---:|---:|---:|---:|---:|---:|');
  for (const profile of STUDY_PROFILES) {
    const contrast = study.aggregates.pairedContrasts[profile];
    lines.push(
      `| ${profile} | ${contrast.pairs} | ${contrast.instrumentedMinusBaselineLearnerRecordGrowth ?? 'n/a'} | ${contrast.activeMinusBaselineLearnerRecordGrowth ?? 'n/a'} | ${contrast.instrumentedMinusBaselineDeferenceBreakRate ?? 'n/a'} | ${contrast.activeMinusBaselineDeferenceBreakRate ?? 'n/a'} | ${contrast.instrumentedMinusBaselineDeferenceBreakTurn ?? 'n/a'} | ${contrast.activeMinusBaselineDeferenceBreakTurn ?? 'n/a'} |`,
    );
  }
  lines.push(
    '',
    '## Reading boundary',
    '',
    ...(study.decisionQuality
      ? [
          '- Decision precision/recall is complete for the frozen two-annotator sample; uncertain rows are reported but not scored.',
        ]
      : [
          '- Decision precision/recall is pending two independent annotations of the blinded sample; uncertain rows are not scored.',
        ]),
    '- A complete status requires one successful combined learner-analysis call per turn with no prompt-audit or classification fallback.',
    '- Gate firings and revision lag are manipulation checks. Improvement claims, if any, must rest on learner-record growth, deference break, or a separately blinded tutor-turn score.',
    '- These are automated-learner sessions, not evidence of human learning.',
    '- Diligent-profile firings are the false-positive control and must accompany every headline result.',
    ...(study.postRepairValidation
      ? ['- The post-repair holdout failed its decision gate; it does not license n=10 or promotion of the candidate rule.']
      : []),
    '',
  );
  return `${lines.join('\n')}\n`;
}

function childSummary(job) {
  const summaryPath = latestFile(
    listFilesRecursive(job.jobDir, (file) => /auto-eval-[^/]+\.json$/u.test(path.basename(file))),
  );
  if (!summaryPath) return { summaryPath: null, summary: null, result: null };
  const summary = readJson(summaryPath);
  return { summaryPath, summary, result: summary.results?.[0] || null };
}

function collectJobResult(job, processResult = null) {
  const { summaryPath, result } = childSummary(job);
  const tracePath = latestFile(
    listFilesRecursive(job.jobDir, (file) => file.endsWith('.jsonl') && !file.endsWith('run-events.jsonl')),
  );
  if (!tracePath) {
    return {
      schema: ADAPTIVE_WARRANT_BASELINE_RESULT_SCHEMA,
      jobId: job.id,
      runIndex: job.runIndex,
      seed: job.seed,
      profile: job.profile,
      condition: job.condition,
      warrantGateMode: job.warrantGateMode,
      childStatus: result?.status || (processResult?.status === 0 ? 'dry_run' : 'failed'),
      processStatus: processResult?.status ?? null,
      summaryPath,
      tracePath: null,
      turnCount: 0,
      error: result?.error || processResult?.error || null,
    };
  }
  return {
    ...summarizeAdaptiveWarrantTrace({
      tracePath,
      job,
      childStatus: result?.status || (processResult?.status === 0 ? 'ok' : 'failed'),
      summaryPath,
    }),
    processStatus: processResult?.status ?? null,
    error: result?.error || processResult?.error || null,
  };
}

function runPreflight() {
  const checks = [
    ['npm', ['run', 'derivation:quality']],
    [process.execPath, ['--test', 'tests/tutorStubPromptAudit.test.js', 'tests/derivationWorldQuality.test.js']],
    [process.execPath, ['--test', 'tests/adaptiveWarrantGate.test.js', 'tests/adaptiveWarrantBaselineStudy.test.js']],
  ];
  for (const [command, commandArgs] of checks) {
    console.log(`[warrant-study] preflight: ${shellDisplay([command, ...commandArgs])}`);
    const result = spawnSync(command, commandArgs, { cwd: ROOT, stdio: 'inherit' });
    if (result.status !== 0) throw new Error(`preflight failed: ${command} ${commandArgs.join(' ')}`);
  }
}

function runJob(job, { logsDir }) {
  return new Promise((resolve) => {
    fs.mkdirSync(logsDir, { recursive: true });
    const logPath = path.join(logsDir, `${job.id}.log`);
    const log = fs.createWriteStream(logPath, { flags: 'a' });
    log.write(`\n[warrant-study] ${new Date().toISOString()}\n${shellDisplay(job.command)}\n\n`);
    const child = spawn(job.command[0], job.command.slice(1), {
      cwd: ROOT,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.pipe(log, { end: false });
    child.stderr.pipe(log, { end: false });
    let spawnError = null;
    child.on('error', (error) => {
      spawnError = error;
      log.write(`\n[warrant-study] spawn error: ${error.message}\n`);
    });
    child.on('close', (status, signal) => {
      log.end(`\n[warrant-study] exit=${status} signal=${signal || 'none'}\n`);
      resolve({ status, signal, error: spawnError?.message || null, logPath });
    });
  });
}

async function runPool(jobs, parallelism, worker, onFinish) {
  let cursor = 0;
  const runners = Array.from({ length: Math.min(parallelism, jobs.length) }, async () => {
    while (cursor < jobs.length) {
      const index = cursor;
      cursor += 1;
      const job = jobs[index];
      const result = await worker(job);
      await onFinish(job, result, index);
    }
  });
  await Promise.all(runners);
}

function writeStudyArtifacts({ rootDir, plan, rows, status }) {
  const aggregates = aggregateAdaptiveWarrantStudy(rows, { horizon: plan.config.horizon });
  const annotation = buildBlindedAnnotationCorpus(rows, {
    perCell: plan.config.annotationPerCell,
    studyId: plan.studyId,
  });
  const annotationScorePath = path.join(rootDir, 'annotation-consensus-and-scores.json');
  const validationScorePath = path.join(rootDir, 'validation-consensus-and-scores.json');
  const decisionQuality = fs.existsSync(annotationScorePath) ? readJson(annotationScorePath) : null;
  const postRepairValidation = fs.existsSync(validationScorePath) ? readJson(validationScorePath) : null;
  const existingStudyPath = path.join(rootDir, 'study-results.json');
  const existingStudy = fs.existsSync(existingStudyPath) ? readJson(existingStudyPath) : null;
  const preserveFrozenAnnotation =
    existingStudy?.status === 'complete' &&
    fs.existsSync(path.join(rootDir, 'annotation-sample.blinded.json')) &&
    fs.existsSync(path.join(rootDir, 'annotation-key.private.json'));
  const study = {
    schema: ADAPTIVE_WARRANT_BASELINE_STUDY_SCHEMA,
    studyId: plan.studyId,
    status,
    updatedAt: new Date().toISOString(),
    plan,
    analysisProvenance: sourceFingerprint(),
    rows,
    aggregates,
    decisionQuality,
    postRepairValidation,
    annotation: {
      blindedCorpus: path.join(rootDir, 'annotation-sample.blinded.json'),
      privateKey: path.join(rootDir, 'annotation-key.private.json'),
      scores: decisionQuality ? annotationScorePath : null,
    },
  };
  writeJson(existingStudyPath, study);
  fs.writeFileSync(path.join(rootDir, 'study-results.md'), markdownReport(study));
  if (!preserveFrozenAnnotation) {
    writeJson(study.annotation.blindedCorpus, annotation.corpus);
    writeJson(study.annotation.privateKey, annotation.key);
  }
  return study;
}

function scoreAnnotationArtifacts({
  rootDir,
  annotationAPath,
  annotationBPath,
  corpusFilename,
  keyFilename,
  outputFilename,
  evaluationBoundary,
}) {
  const corpusPath = path.join(rootDir, corpusFilename);
  const keyPath = path.join(rootDir, keyFilename);
  const annotatorA = readJson(annotationAPath);
  const annotatorB = readJson(annotationBPath);
  const corpus = readJson(corpusPath);
  const corpusSha256 = fileSha256(corpusPath);
  const validation = {
    annotatorA: validateBlindedAnnotationResponse({
      response: annotatorA,
      corpus,
      expectedCorpusSha256: corpusSha256,
    }),
    annotatorB: validateBlindedAnnotationResponse({
      response: annotatorB,
      corpus,
      expectedCorpusSha256: corpusSha256,
    }),
  };
  // Read the private condition/decision key only after both blind files have
  // passed completeness, vocabulary, study-id, and frozen-corpus validation.
  const key = readJson(keyPath);
  const score = {
    ...scoreBlindedAnnotations({ annotatorA, annotatorB, key }),
    studyId: corpus.study_id,
    scoredAt: new Date().toISOString(),
    evaluationBoundary,
    blindValidation: validation,
    sources: {
      annotatorA: { path: annotationAPath, sha256: fileSha256(annotationAPath) },
      annotatorB: { path: annotationBPath, sha256: fileSha256(annotationBPath) },
      corpus: { path: corpusPath, sha256: corpusSha256 },
      key: { path: keyPath, sha256: fileSha256(keyPath) },
    },
  };
  const outputPath = path.join(rootDir, outputFilename);
  writeJson(outputPath, score);
  return { outputPath, score };
}

function freezePostRepairValidation({ rootDir, offsetPerCell = 2, perCell = 2 } = {}) {
  const plan = readJson(path.join(rootDir, 'study-plan.json'));
  const rows = plan.jobs.map((job) => collectJobResult(job));
  const status = resolveAdaptiveWarrantStudyStatus(rows, plan.jobs, { dryRun: plan.config.dryRun });
  if (status !== 'complete') throw new Error(`cannot freeze validation from study status ${status}`);
  const validationId = `${plan.studyId}-post-repair-validation-v1`;
  const annotation = buildBlindedAnnotationCorpus(rows, {
    perCell,
    studyId: validationId,
    samplingSeed: plan.studyId,
    offsetPerCell,
    sampleIdPrefix: 'validation-case',
  });
  const expectedCases = STUDY_PROFILES.length * STUDY_CONDITIONS.length * perCell;
  if (annotation.corpus.cases.length !== expectedCases) {
    throw new Error(`validation freeze expected ${expectedCases} cases, got ${annotation.corpus.cases.length}`);
  }
  annotation.key.cases = annotation.key.cases.map((row) => ({
    ...row,
    prediction_source: 'post_repair_offline_shadow',
    recorded_pre_repair_gate: row.gate,
    gate: null,
  }));
  const primaryKeyPath = path.join(rootDir, 'annotation-key.private.json');
  const primaryKey = readJson(primaryKeyPath);
  const primarySources = new Set(primaryKey.cases.map((row) => `${row.job_id}:${row.turn}`));
  const overlaps = annotation.key.cases.filter((row) => primarySources.has(`${row.job_id}:${row.turn}`));
  if (overlaps.length) throw new Error(`validation freeze overlaps ${overlaps.length} primary annotation cases`);
  const corpusPath = path.join(rootDir, 'validation-sample.blinded.json');
  const keyPath = path.join(rootDir, 'validation-key.private.json');
  writeJson(corpusPath, annotation.corpus);
  writeJson(keyPath, annotation.key);
  const manifest = {
    schema: 'machinespirits.adaptation-refinement.warrant-validation-freeze.v1',
    study_id: validationId,
    status: 'frozen',
    frozen_at: new Date().toISOString(),
    source_study_id: plan.studyId,
    sampling: {
      offset_per_profile_condition_cell: offsetPerCell,
      cases_per_profile_condition_cell: perCell,
      total_cases: annotation.corpus.cases.length,
      excludes_primary_annotation_sample: true,
      verified_primary_overlap_count: overlaps.length,
    },
    prediction_source: 'current offline shadow over already-generated traces; recorded pre-repair live decisions ignored',
    calibration_boundary:
      'Fresh decision-point holdout from the valid n=5 pilot, but not fresh dialogue generation or live-v3 intervention evidence.',
    corpus: { path: corpusPath, sha256: fileSha256(corpusPath) },
    key: { path: keyPath, sha256: fileSha256(keyPath) },
    provenance: sourceFingerprint(),
  };
  const manifestPath = path.join(rootDir, 'validation-freeze-manifest.json');
  writeJson(manifestPath, manifest);
  return { corpusPath, keyPath, manifestPath, manifest };
}

function printHelp() {
  console.log(`Usage:
  node scripts/run-adaptive-warrant-baseline-study.js --dry-run [options]
  node scripts/run-adaptive-warrant-baseline-study.js --launch-approved [options]
  node scripts/run-adaptive-warrant-baseline-study.js --analyze <study-root>
  node scripts/run-adaptive-warrant-baseline-study.js --refresh-report <study-root>
  node scripts/run-adaptive-warrant-baseline-study.js --score-annotations <study-root> --annotation-a <file> --annotation-b <file>
  node scripts/run-adaptive-warrant-baseline-study.js --freeze-validation <study-root>
  node scripts/run-adaptive-warrant-baseline-study.js --score-validation <study-root> --annotation-a <file> --annotation-b <file>

Options:
  --runs <5|10>             n per condition x learner cell (default: 5 pilot)
  --master-seed <n>         first paired session seed (default: 101)
  --parallelism <n>         concurrent dialogues (default: 6)
  --root <path>             output root (default: ignored timestamped directory)
  --model <ref>             speaking tutor model (default: codex.gpt-5.6-luna)
  --analysis-model <ref>    classifier and learner-record model (default: same)
  --learner-model <ref>     automated learner model (default: same)
  --dry-run                 execute every child auto-eval in dry-run mode
  --launch-approved         required for model-backed execution
  --resume                  skip already successful job-result files
  --analyze <root>          rebuild results from existing job artifacts only
  --refresh-report <root>   recompute aggregates/report without replaying traces
  --score-annotations <root> score two independent blinded annotation files
  --freeze-validation <root> freeze a disjoint post-repair decision holdout
  --score-validation <root> score the frozen post-repair validation holdout
  --annotation-a <file>     first completed blinded corpus
  --annotation-b <file>     second completed blinded corpus
`);
}

async function main() {
  const { values } = parseArgs({
    options: {
      runs: { type: 'string', default: '5' },
      'master-seed': { type: 'string', default: '101' },
      parallelism: { type: 'string', default: '6' },
      root: { type: 'string' },
      model: { type: 'string', default: DEFAULT_MODEL },
      'analysis-model': { type: 'string', default: DEFAULT_MODEL },
      'learner-model': { type: 'string', default: DEFAULT_MODEL },
      'max-tokens': { type: 'string', default: '4096' },
      'history-turns': { type: 'string', default: '4' },
      'annotation-per-cell': { type: 'string', default: '2' },
      'dry-run': { type: 'boolean', default: false },
      'launch-approved': { type: 'boolean', default: false },
      resume: { type: 'boolean', default: false },
      analyze: { type: 'string' },
      'refresh-report': { type: 'string' },
      'score-annotations': { type: 'string' },
      'freeze-validation': { type: 'string' },
      'score-validation': { type: 'string' },
      'annotation-a': { type: 'string' },
      'annotation-b': { type: 'string' },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  if (values.help) return printHelp();

  if (values['refresh-report']) {
    const rootDir = path.resolve(ROOT, values['refresh-report']);
    const studyPath = path.join(rootDir, 'study-results.json');
    const study = readJson(studyPath);
    study.aggregates = aggregateAdaptiveWarrantStudy(study.rows, { horizon: study.plan.config.horizon });
    const validationScorePath = path.join(rootDir, 'validation-consensus-and-scores.json');
    study.postRepairValidation = fs.existsSync(validationScorePath) ? readJson(validationScorePath) : null;
    study.updatedAt = new Date().toISOString();
    writeJson(studyPath, study);
    fs.writeFileSync(path.join(rootDir, 'study-results.md'), markdownReport(study));
    console.log(`[warrant-study] refreshed ${path.join(rootDir, 'study-results.md')}`);
    return;
  }

  if (values['freeze-validation']) {
    const rootDir = path.resolve(ROOT, values['freeze-validation']);
    const frozen = freezePostRepairValidation({ rootDir });
    console.log(`[warrant-study] validation corpus ${frozen.corpusPath}`);
    console.log(`[warrant-study] sha256=${frozen.manifest.corpus.sha256}`);
    return;
  }

  if (values['score-validation']) {
    if (!values['annotation-a'] || !values['annotation-b']) {
      throw new Error('--score-validation requires --annotation-a and --annotation-b');
    }
    const rootDir = path.resolve(ROOT, values['score-validation']);
    const { outputPath, score } = scoreAnnotationArtifacts({
      rootDir,
      annotationAPath: path.resolve(ROOT, values['annotation-a']),
      annotationBPath: path.resolve(ROOT, values['annotation-b']),
      corpusFilename: 'validation-sample.blinded.json',
      keyFilename: 'validation-key.private.json',
      outputFilename: 'validation-consensus-and-scores.json',
      evaluationBoundary: 'fresh_post_repair_decision_holdout_from_existing_pilot_dialogues',
    });
    console.log(`[warrant-study] validation scores ${outputPath}`);
    console.log(`[warrant-study] scored=${score.metrics.scoredConsensusCases} uncertain=${score.metrics.uncertainCases}`);
    return;
  }

  if (values['score-annotations']) {
    if (!values['annotation-a'] || !values['annotation-b']) {
      throw new Error('--score-annotations requires --annotation-a and --annotation-b');
    }
    const rootDir = path.resolve(ROOT, values['score-annotations']);
    const annotationAPath = path.resolve(ROOT, values['annotation-a']);
    const annotationBPath = path.resolve(ROOT, values['annotation-b']);
    const { outputPath, score } = scoreAnnotationArtifacts({
      rootDir,
      annotationAPath,
      annotationBPath,
      corpusFilename: 'annotation-sample.blinded.json',
      keyFilename: 'annotation-key.private.json',
      outputFilename: 'annotation-consensus-and-scores.json',
      evaluationBoundary: 'pre_repair_primary_calibration_sample',
    });
    const study = readJson(path.join(rootDir, 'study-results.json'));
    study.decisionQuality = score;
    study.annotation.scores = outputPath;
    writeJson(path.join(rootDir, 'study-results.json'), study);
    fs.writeFileSync(path.join(rootDir, 'study-results.md'), markdownReport(study));
    console.log(`[warrant-study] annotation scores ${outputPath}`);
    console.log(`[warrant-study] scored=${score.metrics.scoredConsensusCases} uncertain=${score.metrics.uncertainCases}`);
    return;
  }

  if (values.analyze) {
    const rootDir = path.resolve(ROOT, values.analyze);
    const plan = readJson(path.join(rootDir, 'study-plan.json'));
    const rows = plan.jobs.map((job) => collectJobResult(job));
    for (const row of rows) writeJson(path.join(rootDir, 'job-results', `${row.jobId}.json`), row);
    const status = resolveAdaptiveWarrantStudyStatus(rows, plan.jobs, { dryRun: plan.config.dryRun });
    const study = writeStudyArtifacts({ rootDir, plan, rows, status });
    console.log(`[warrant-study] rebuilt ${path.join(rootDir, 'study-results.md')}`);
    console.log(`[warrant-study] status=${study.status} rows=${study.rows.length}/${study.plan.jobs.length}`);
    return;
  }

  const runs = positiveInt(values.runs, '--runs');
  if (![5, 10].includes(runs)) throw new Error('--runs must be 5 (pilot) or 10 (full study)');
  if (!values['dry-run'] && !values['launch-approved']) {
    throw new Error('Model-backed execution requires --launch-approved; run the same matrix with --dry-run first');
  }
  const masterSeed = positiveInt(values['master-seed'], '--master-seed');
  const parallelism = positiveInt(values.parallelism, '--parallelism');
  const rootDir = values.root
    ? path.resolve(ROOT, values.root)
    : path.join(
        ROOT,
        '.tutor-stub-auto-eval',
        `adaptive-warrant-baseline-${runs === 5 ? 'pilot' : 'full'}-${safeTimestamp()}`,
      );
  if (fs.existsSync(rootDir) && !values.resume) {
    throw new Error(`study root already exists; choose a new --root or pass --resume: ${rootDir}`);
  }
  fs.mkdirSync(rootDir, { recursive: true });
  const studyId = path.basename(rootDir);
  const jobs = buildAdaptiveWarrantBaselineJobs({
    rootDir,
    runs,
    masterSeed,
    model: values.model,
    analysisModel: values['analysis-model'],
    learnerModel: values['learner-model'],
    maxTokens: positiveInt(values['max-tokens'], '--max-tokens'),
    historyTurns: positiveInt(values['history-turns'], '--history-turns'),
    dryRun: values['dry-run'],
    studyId,
  });
  const plan = {
    schema: ADAPTIVE_WARRANT_BASELINE_STUDY_SCHEMA,
    studyId,
    createdAt: new Date().toISOString(),
    design: 'docs/adaptation-refinement/baseline-comparison-design.md',
    config: {
      runs,
      masterSeed,
      parallelism,
      horizon: DEFAULT_HORIZON,
      policy: 'dynamic',
      world: 'world_005_marrick',
      profiles: STUDY_PROFILES,
      conditions: STUDY_CONDITIONS,
      model: values.model,
      analysisModel: values['analysis-model'],
      learnerModel: values['learner-model'],
      maxTokens: positiveInt(values['max-tokens'], '--max-tokens'),
      historyTurns: positiveInt(values['history-turns'], '--history-turns'),
      annotationPerCell: positiveInt(values['annotation-per-cell'], '--annotation-per-cell'),
      learnerAnalysisPromptProfile: LEARNER_ANALYSIS_PROMPT_PROFILE,
      dryRun: values['dry-run'],
      fixedSeams: [
        'dynamic register policy',
        'strict DAG',
        'eight learner turns',
        'no stop on grounded closure',
        'no light adaptation',
        'no DAG fact dropout',
        'same model routing',
        'compact_v1 learner-analysis prompt profile',
        'same seed within profile x session index',
      ],
    },
    provenance: sourceFingerprint(),
    jobs,
  };
  writeJson(path.join(rootDir, 'study-plan.json'), plan);
  console.log(`[warrant-study] plan ${path.join(rootDir, 'study-plan.json')}`);
  console.log(`[warrant-study] ${jobs.length} dialogues; ${runs} per 3 conditions x 3 learners`);
  if (!values['dry-run']) runPreflight();

  const resultDir = path.join(rootDir, 'job-results');
  const rowsById = new Map();
  if (values.resume && fs.existsSync(resultDir)) {
    for (const resultFile of listFilesRecursive(resultDir, (file) => file.endsWith('.json'))) {
      let row = readJson(resultFile);
      if (row.childStatus === 'ok' && row.learnerAnalysisCoverage === undefined) {
        const job = jobs.find((candidate) => candidate.id === row.jobId);
        if (job) {
          row = collectJobResult(job);
          writeJson(resultFile, row);
        }
      }
      const reusableLiveRow = row.childStatus === 'ok' && row.learnerAnalysisCoverage === 1;
      if (reusableLiveRow || row.childStatus === 'dry_run') rowsById.set(row.jobId, row);
    }
  }
  const pending = jobs.filter((job) => !rowsById.has(job.id));
  let completed = rowsById.size;
  await runPool(
    pending,
    parallelism,
    (job) => runJob(job, { logsDir: path.join(rootDir, 'logs') }),
    async (job, processResult) => {
      const row = collectJobResult(job, processResult);
      rowsById.set(job.id, row);
      writeJson(path.join(resultDir, `${job.id}.json`), row);
      completed += 1;
      console.log(
        `[warrant-study] ${completed}/${jobs.length} ${job.id}: ${row.childStatus} ${row.turnCount || 0} turns`,
      );
      writeStudyArtifacts({
        rootDir,
        plan,
        rows: jobs.map((candidate) => rowsById.get(candidate.id)).filter(Boolean),
        status: 'running',
      });
    },
  );
  const rows = jobs.map((job) => rowsById.get(job.id)).filter(Boolean);
  const status = resolveAdaptiveWarrantStudyStatus(rows, jobs, { dryRun: values['dry-run'] });
  const study = writeStudyArtifacts({ rootDir, plan, rows, status });
  console.log(`[warrant-study] report ${path.join(rootDir, 'study-results.md')}`);
  console.log(`[warrant-study] status=${study.status}`);
  if (!['complete', 'dry_run'].includes(status)) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) {
  main().catch((error) => {
    console.error(`[warrant-study] error: ${error.message}`);
    process.exitCode = 1;
  });
}
