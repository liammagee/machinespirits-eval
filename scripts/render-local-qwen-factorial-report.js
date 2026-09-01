#!/usr/bin/env node
// Render saved evidence only. This command never calls a model or resumes a run.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import {
  assertCompleteScore,
  normalizeScores,
  parseBenchmarkScore,
  readBenchmarkArm,
} from './score-local-qwen-resistant-learner-benchmark.js';
import { renderFactorialReport } from '../services/localQwenFactorialReport.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const lines = (file) => fs.readFileSync(file, 'utf8').trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse);

// Report-only projection of the observed final reply. The live scorer remains strict.
// Missing judgments are never imputed or written back into the provider response.
export function parsePartialQualityForReport(text, turnCount) {
  const { parsed } = parseBenchmarkScore('quality', text, turnCount);
  if (
    parsed.measurement_indeterminate !== false ||
    typeof parsed.indeterminate_reason !== 'string' ||
    parsed.tutor_turns?.length !== turnCount ||
    !parsed.learner_turns.every(
      (row) => !Object.hasOwn(row, 'accepted_objection_reopened') && typeof row.new_move_is_substantive === 'boolean',
    )
  )
    throw new Error('partial reporting only supports the observed missing reopening annotation family');
  for (const rows of [parsed.learner_turns, parsed.tutor_turns])
    for (const [index, row] of rows.entries())
      if (
        row.turn !== index + 1 ||
        typeof row.unsupported_evidence_assertion !== 'boolean' ||
        typeof row.evidence_reasoning !== 'string' ||
        !row.evidence_reasoning.trim()
      )
        throw new Error('partial reply has additional invalid evidence annotations');
  return {
    raw: parsed,
    scored: normalizeScores('quality', parsed),
    partial: true,
    missingFields: parsed.learner_turns.map((_, index) => `learner_turns[${index}].accepted_objection_reopened`),
  };
}

export function renderSavedFactorial(sourceDir, { scoringRecoveryDir = null } = {}) {
  const outDir = scoringRecoveryDir || sourceDir;
  const ledger = lines(path.join(sourceDir, 'run-ledger.jsonl'));
  const judgeLedger = [sourceDir, ...(scoringRecoveryDir ? [scoringRecoveryDir] : [])].flatMap((directory) =>
    lines(path.join(directory, 'evaluation/judge-ledger.jsonl')).map((row) => ({ ...row, directory })),
  );
  const arms = ['A', 'B', 'C', 'D'].map((id) => {
    const completed = ledger.find((row) => row.event === 'arm_completed' && row.arm === id);
    if (!completed) throw new Error(`arm ${id} is incomplete; this renderer requires four saved dialogues`);
    const arm = readBenchmarkArm({ id, path: path.join(sourceDir, id, 'dialogue.json') });
    return {
      ...arm,
      variant: arm.snapshot.autoLearner.modelRef.includes('qwen-normal') ? 'normal' : 'abliterated',
      mode: arm.snapshot.turns[0].learnerResponseProvenance.automation.learnerDeliberation.mode,
      wallTimeMs: completed.wallTimeMs,
    };
  });
  const scores = judgeLedger
    .filter((row) => row.event === 'completed')
    .map((row) => {
      const raw = readJson(path.join(row.directory, 'evaluation', `${row.arm}-${row.kind}.json`));
      assertCompleteScore(row.kind, raw, 8, { extendedQuality: true });
      return { arm: row.arm, kind: row.kind, raw, scored: normalizeScores(row.kind, raw) };
    });
  let indexRecovery;
  if (scoringRecoveryDir) {
    const original = fs.readFileSync(path.join(sourceDir, 'evaluation/A-learner.response.txt'), 'utf8');
    const { parsed, indexNormalization } = parseBenchmarkScore('learner', original, 8, {
      extendedQuality: true,
      allowOneBasedIndices: true,
    });
    if (!indexNormalization || scores.some((score) => score.arm === 'A' && score.kind === 'learner'))
      throw new Error('unexpected index recovery source or duplicate assessment');
    const saved = readJson(path.join(scoringRecoveryDir, 'A-learner.index-corrected.json'));
    if (JSON.stringify(saved) !== JSON.stringify(parsed)) throw new Error('saved correction changed more than indices');
    scores.push({
      arm: 'A',
      kind: 'learner',
      raw: parsed,
      scored: normalizeScores('learner', parsed),
      indexNormalization,
    });
    indexRecovery =
      'The original A learner reply used 1–8 rather than 0–7. With explicit user approval, only its indices were converted; all scores and reasons are unchanged. Fourteen new Opus calls used the remaining allowance. The final D quality reply omitted the reopening annotation on all eight learner turns. Its other fields are reported as partial evidence, not a completed assessment. Original replies, reservations and both stop records remain intact; no dialogue or valid judge output was regenerated.';
  }
  const rejected = judgeLedger
    .filter((row) => row.event === 'failed')
    .filter((row) => !(scoringRecoveryDir && row.directory === sourceDir && row.arm === 'A' && row.kind === 'learner'))
    .map((row) => {
      const file = path.join(row.directory, 'evaluation', `${row.arm}-${row.kind}.response.txt`);
      return { ...row, text: fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : 'No response received.' };
    });
  if (scoringRecoveryDir) {
    const finalReply = rejected.find((row) => row.arm === 'D' && row.kind === 'quality');
    if (finalReply) {
      scores.push({ arm: 'D', kind: 'quality', ...parsePartialQualityForReport(finalReply.text, 8) });
      rejected.splice(rejected.indexOf(finalReply), 1);
    }
  }
  const partialAssessments = scores.filter((score) => score.partial).length;
  const evaluation = {
    scores,
    rejected,
    callsCompleted: judgeLedger.filter((row) => row.event === 'completed').length,
    indexRecovery,
    stopReason: partialAssessments
      ? 'All 112 attempts were used. Abliterated/direct lacks eight reopened-objection labels, so its reopening count and combined fresh-grounded count are unavailable. All four requested quality scores and the v2.2 rubrics are present.'
      : ledger.findLast((row) => row.event === 'stopped')?.error,
  };
  const generationCompleted = ledger
    .filter((row) => row.event === 'arm_completed')
    .reduce((sum, row) => sum + row.callsCompleted, 0);
  const judgeAttempts = judgeLedger.filter((row) => row.event === 'reserved').length;
  const provenance = {
    ...readJson(path.join(sourceDir, 'provenance.json')),
    ...(scoringRecoveryDir ? { recovery: readJson(path.join(scoringRecoveryDir, 'recovery.json')) } : {}),
    generationCompleted,
    judgeAttempts,
    acceptedAssessments: scores.length - partialAssessments,
    partialAssessments,
    judgeLedgerCompleted: judgeLedger.filter((row) => row.event === 'completed').length,
    judgeLedgerFailed: judgeLedger.filter((row) => row.event === 'failed').length,
    rejectedAssessments: rejected.length,
    unattemptedAssessments: 16 - judgeAttempts,
    totalAttemptsUsed: generationCompleted + judgeAttempts,
    remainingAttemptsUnused: 112 - generationCompleted - judgeAttempts,
    modelActivity: 'inactive; no calls made by this report renderer',
    reportRenderedAt: new Date().toISOString(),
  };
  const observationsFile = path.join(outDir, 'observations.json');
  const observations = fs.existsSync(observationsFile) ? readJson(observationsFile) : [];
  const report = renderFactorialReport({ arms, evaluation, provenance, observations, mock: provenance.mock });
  for (const name of ['report.html', 'public-dialogues.json', 'report-data.json'])
    if (fs.existsSync(path.join(outDir, name))) throw new Error(`refusing to overwrite ${name}`);
  fs.writeFileSync(path.join(outDir, 'report.html'), report.html, { flag: 'wx' });
  fs.writeFileSync(path.join(outDir, 'public-dialogues.json'), JSON.stringify(report.interchange, null, 2), {
    flag: 'wx',
  });
  fs.writeFileSync(
    path.join(outDir, 'report-data.json'),
    JSON.stringify(
      {
        evaluation,
        provenance,
        observations,
        arms: arms.map(({ snapshot: _snapshot, ...arm }) => arm),
      },
      null,
      2,
    ),
    { flag: 'wx' },
  );
  return { outDir, ...provenance };
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { 'recovery-dir': { type: 'string' } },
  });
  const result = renderSavedFactorial(
    path.resolve(positionals[0] || path.join(ROOT, '.tutor-stub-traces/qwen-superego-factorial-v1')),
    { scoringRecoveryDir: values['recovery-dir'] ? path.resolve(values['recovery-dir']) : null },
  );
  console.log(JSON.stringify(result, null, 2));
}
