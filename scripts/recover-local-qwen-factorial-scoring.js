#!/usr/bin/env node
// One bounded scoring continuation. Never regenerates a dialogue or overwrites evidence.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { spawnSync } from 'node:child_process';
import {
  assertCompleteScore,
  normalizeScores,
  parseBenchmarkScore,
  readBenchmarkArm,
  scoreBenchmarkArms,
} from './score-local-qwen-resistant-learner-benchmark.js';
import { buildFactorialPlan, verifyGeneratedArm } from './run-local-qwen-superego-experiment.js';
import { renderFactorialReport } from '../services/localQwenFactorialReport.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = path.join(ROOT, '.tutor-stub-traces/qwen-superego-factorial-v1');
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const lines = (file) => fs.readFileSync(file, 'utf8').trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);
const writeJson = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', { flag: 'wx' });

export function prepareScoringRecovery(source = SOURCE) {
  const runLedger = lines(path.join(source, 'run-ledger.jsonl'));
  const oldLedger = lines(path.join(source, 'evaluation/judge-ledger.jsonl'));
  const priorAttempts = oldLedger.filter((row) => row.event === 'reserved').length;
  const accepted = oldLedger.filter((row) => row.event === 'completed');
  const rejected = oldLedger.filter((row) => row.event === 'failed');
  if (
    priorAttempts !== 2 ||
    accepted.length !== 1 ||
    accepted[0].arm !== 'A' ||
    accepted[0].kind !== 'tutor' ||
    rejected.length !== 1 ||
    rejected[0].arm !== 'A' ||
    rejected[0].kind !== 'learner' ||
    rejected[0].error !== 'learner judge returned an invalid turn index'
  )
    throw new Error('source is not the two-attempt index-only stop authorized for this recovery');
  const arms = buildFactorialPlan().arms.map((plan) => {
    const completed = runLedger.find((row) => row.event === 'arm_completed' && row.arm === plan.id);
    if (!completed) throw new Error('all source dialogues must be complete');
    const arm = {
      ...readBenchmarkArm({ id: plan.id, path: path.join(source, plan.id, 'dialogue.json') }),
      ...plan,
      wallTimeMs: completed.wallTimeMs,
    };
    verifyGeneratedArm(arm, lines(path.resolve(ROOT, arm.snapshot.trace)));
    return arm;
  });
  const tutor = readJson(path.join(source, 'evaluation/A-tutor.json'));
  assertCompleteScore('tutor', tutor, 8, { extendedQuality: true });
  const savedResponse = path.join(source, 'evaluation/A-learner.response.txt');
  const repaired = parseBenchmarkScore('learner', fs.readFileSync(savedResponse, 'utf8'), 8, {
    extendedQuality: true,
    allowOneBasedIndices: true,
  });
  if (!repaired.indexNormalization) throw new Error('expected exactly the saved 1-based learner sequence');
  const priorScores = [
    { arm: 'A', kind: 'tutor', raw: tutor, scored: normalizeScores('tutor', tutor), source: 'original accepted reply' },
    {
      arm: 'A',
      kind: 'learner',
      raw: repaired.parsed,
      scored: normalizeScores('learner', repaired.parsed),
      indexNormalization: repaired.indexNormalization,
      source: savedResponse,
    },
  ];
  return {
    source,
    arms,
    priorAttempts,
    priorScores,
    repaired,
    savedResponse,
    outDir: path.join(source, 'scoring-recovery-v1'),
  };
}

export async function recoverScoring({ live = false } = {}) {
  const prepared = prepareScoringRecovery();
  const summary = {
    source: prepared.source,
    outDir: prepared.outDir,
    dialogueCalls: 0,
    priorGenerationAttempts: 96,
    priorJudgeAttempts: 2,
    savedAssessmentsReused: 2,
    newJudgeAttempts: 14,
    totalAttemptCeiling: 112,
    model: 'claude-code.claude-opus-5',
    indexNormalization: prepared.repaired.indexNormalization,
  };
  if (!live) return { ...summary, status: 'zero-call preflight passed' };
  fs.mkdirSync(prepared.outDir, { recursive: false });
  const git = (args) => spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' }).stdout?.trim();
  const recovery = {
    ...summary,
    startedAt: new Date().toISOString(),
    commit: git(['rev-parse', 'HEAD']),
    dirtyStatus: git(['status', '--short']),
    sourceReply: prepared.savedResponse,
    authority:
      'User explicitly agreed to index-only correction and the remaining 14 assessments; original 112 total ceiling unchanged.',
    promptClarification:
      'Explicit zero-based output indices; no rubric, evidence, character, model or scoring rule change.',
  };
  writeJson(path.join(prepared.outDir, 'recovery.json'), recovery);
  writeJson(path.join(prepared.outDir, 'A-learner.index-corrected.json'), prepared.repaired.parsed);
  try {
    const evaluation = await scoreBenchmarkArms(prepared.arms, path.join(prepared.outDir, 'evaluation'), {
      ceiling: 16,
      extendedQuality: true,
      priorAttempts: prepared.priorAttempts,
      priorScores: prepared.priorScores,
      allowOneBasedIndices: true,
    });
    evaluation.indexRecovery =
      'One original learner assessment used 1–8 rather than 0–7. With explicit user approval, only its indices were converted; every score and reason is unchanged. The original rejected reply and stop record remain intact. Fourteen new Opus assessments completed the original plan; no dialogue or valid judge output was regenerated.';
    const provenance = {
      ...readJson(path.join(prepared.source, 'provenance.json')),
      recovery,
      generationCompleted: 96,
      judgeAttempts: evaluation.attemptsUsed,
      totalAttemptsUsed: 96 + evaluation.attemptsUsed,
      acceptedAssessments: evaluation.scores.length,
      modelActivity: 'inactive; scoring complete',
      completedAt: new Date().toISOString(),
    };
    const report = renderFactorialReport({ arms: prepared.arms, evaluation, provenance });
    fs.writeFileSync(path.join(prepared.outDir, 'report.html'), report.html, { flag: 'wx' });
    writeJson(path.join(prepared.outDir, 'public-dialogues.json'), report.interchange);
    writeJson(path.join(prepared.outDir, 'report-data.json'), {
      evaluation,
      provenance,
      arms: prepared.arms.map(({ snapshot: _snapshot, raw: _raw, spec: _spec, ...arm }) => arm),
    });
    writeJson(path.join(prepared.outDir, 'completed.json'), {
      completedAt: provenance.completedAt,
      acceptedAssessments: evaluation.scores.length,
      totalAttemptsUsed: provenance.totalAttemptsUsed,
    });
    return { ...summary, status: 'complete', totalAttemptsUsed: provenance.totalAttemptsUsed };
  } catch (error) {
    writeJson(path.join(prepared.outDir, 'stopped.json'), {
      stoppedAt: new Date().toISOString(),
      error: error.message,
    });
    throw error;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const { values } = parseArgs({ options: { live: { type: 'boolean', default: false } } });
  recoverScoring({ live: values.live })
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch((error) => {
      console.error(error.stack || error.message);
      process.exitCode = 1;
    });
}
