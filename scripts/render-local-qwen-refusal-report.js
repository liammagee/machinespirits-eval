#!/usr/bin/env node
// Saved evidence only; never invokes a provider or overwrites an earlier report.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildRefusalPlan } from './run-local-qwen-hostile-refusal.js';
import {
  readBenchmarkArm,
  assertCompleteScore,
  normalizeScores,
} from './score-local-qwen-resistant-learner-benchmark.js';
import { renderRefusalReport } from '../services/localQwenRefusalReport.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const json = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const lines = (file) =>
  fs.existsSync(file) ? fs.readFileSync(file, 'utf8').trim().split(/\r?\n/u).filter(Boolean).map(JSON.parse) : [];

// Report-only extraction: parse intact members without repairing the malformed
// outer envelope, and retain absent judgments as absent. Never used by a runner.
function intactMember(text, key) {
  const marker = `${JSON.stringify(key)}:`;
  const found = text.indexOf(marker);
  if (found < 0 || text.indexOf(marker, found + marker.length) >= 0)
    throw new Error(`missing or ambiguous partial member: ${key}`);
  const start = found + marker.length;
  let depth = 0;
  let quoted = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') {
        quoted = false;
        if (depth === 0) return JSON.parse(text.slice(start, i + 1));
      }
    } else if (char === '"') quoted = true;
    else if (char === '{' || char === '[') depth++;
    else if (char === '}' || char === ']') {
      depth--;
      if (depth === 0) return JSON.parse(text.slice(start, i + 1));
    } else if (depth === 0 && char === ',') return JSON.parse(text.slice(start, i));
  }
  throw new Error(`incomplete partial member: ${key}`);
}

export function parseRefusalPartialQuality(text) {
  const raw = {
    scores: Object.fromEntries(
      ['overall_quality', 'successful_pedagogy', 'surprise_nonrepetition', 'character_adherence'].map((key) => [
        key,
        intactMember(text, key),
      ]),
    ),
    ...Object.fromEntries(
      [
        'learner_turns',
        'tutor_turns',
        'measurement_indeterminate',
        'indeterminate_reason',
        'strengths',
        'limitations',
        'overall_assessment',
      ].map((key) => [key, intactMember(text, key)]),
    ),
  };
  assertCompleteScore('quality', raw, 8);
  if (raw.measurement_indeterminate !== false || raw.tutor_turns?.length !== 8)
    throw new Error('partial evidence is indeterminate or incomplete beyond the known fields');
  for (const rows of [raw.learner_turns, raw.tutor_turns])
    for (const [index, row] of rows.entries())
      if (
        row.turn !== index + 1 ||
        typeof row.unsupported_evidence_assertion !== 'boolean' ||
        !row.evidence_reasoning?.trim()
      )
        throw new Error('partial evidence annotations are invalid');
  for (const row of raw.learner_turns)
    if (
      typeof row.new_move_is_substantive !== 'boolean' ||
      (Object.hasOwn(row, 'accepted_objection_reopened') && typeof row.accepted_objection_reopened !== 'boolean')
    )
      throw new Error('partial novelty annotations are invalid');
  const missingFields = raw.learner_turns.flatMap((row, index) =>
    Object.hasOwn(row, 'accepted_objection_reopened') ? [] : [`learner_turns[${index}].accepted_objection_reopened`],
  );
  if (missingFields.length !== 7) throw new Error('not the observed seven missing reopening annotations');
  return {
    raw,
    scored: normalizeScores('quality', raw),
    partial: true,
    missingFields,
    extraction:
      'Intact JSON member values extracted from malformed outer envelope. No score, reason or annotation edited; seven missing judgments remain absent.',
  };
}
export function renderSavedRefusal({ reportBase = 'reviewed-report' } = {}) {
  const plan = buildRefusalPlan();
  const root = path.join(ROOT, plan.output);
  const ledger = lines(path.join(root, 'run-ledger.jsonl'));
  const originalJudges = lines(path.join(root, 'evaluation/judge-ledger.jsonl'));
  const continuationRoot = path.join(root, 'scoring-continuation-v1');
  const continuation = fs.existsSync(path.join(continuationRoot, 'continuation.json'))
    ? json(path.join(continuationRoot, 'continuation.json'))
    : null;
  const continuationComplete = fs.existsSync(path.join(continuationRoot, 'completed.json'));
  const judges = [
    ...originalJudges.map((row) => ({ ...row, directory: root })),
    ...lines(path.join(continuationRoot, 'evaluation/judge-ledger.jsonl')).map((row) => ({
      ...row,
      directory: continuationRoot,
    })),
  ];
  const arms = plan.arms.map((arm) => {
    const completed = ledger.find((row) => row.event === 'arm_completed' && row.arm === arm.id);
    if (!completed) throw new Error(`cannot compare: arm ${arm.id} lacks a complete dialogue`);
    return {
      ...readBenchmarkArm({ id: arm.id, path: path.join(root, arm.id, 'dialogue.json') }),
      variant: arm.variant,
      mode: arm.mode,
      wallTimeMs: completed.wallTimeMs,
    };
  });
  const scores = continuationComplete
    ? json(path.join(continuationRoot, 'evaluation/scores.json')).scores
    : judges
        .filter((row) => row.event === 'completed')
        .map((row) => {
          const raw = json(path.join(row.directory, 'evaluation', `${row.arm}-${row.kind}.json`));
          assertCompleteScore(row.kind, raw, 8, { extendedQuality: true });
          return {
            arm: row.arm,
            kind: row.kind,
            raw,
            scored: normalizeScores(row.kind, raw),
            indexNormalization: row.indexNormalization,
          };
        });
  if (continuation && !continuationComplete) {
    const raw = json(path.join(continuationRoot, 'A-dialogue.canonical-dimensions.json'));
    scores.push({
      arm: 'A',
      kind: 'dialogue',
      raw,
      scored: normalizeScores('dialogue', raw),
      projection: continuation.projection,
    });
  }
  for (const score of scores) assertCompleteScore(score.kind, score.raw, 8, { extendedQuality: true });
  const rejected = judges
    .filter((row) => row.event === 'failed')
    .map((row) => ({
      ...row,
      text: fs.existsSync(path.join(row.directory, 'evaluation', `${row.arm}-${row.kind}.response.txt`))
        ? fs.readFileSync(path.join(row.directory, 'evaluation', `${row.arm}-${row.kind}.response.txt`), 'utf8')
        : 'No reply received.',
    }));
  const partialReply = rejected.find((row) => row.arm === 'A' && row.kind === 'quality');
  if (partialReply) scores.push({ arm: 'A', kind: 'quality', ...parseRefusalPartialQuality(partialReply.text) });
  const observationsPath = path.join(root, 'observations.json');
  const observations = fs.existsSync(observationsPath) ? json(observationsPath) : [];
  const provenance = {
    ...json(path.join(root, 'provenance.json')),
    generationAttempts: 32,
    judgeAttempts: judges.filter((row) => row.event === 'reserved').length,
    acceptedAssessments: scores.filter((score) => !score.partial).length,
    partialAssessments: scores.filter((score) => score.partial).length,
    unattemptedAssessments: 8 - judges.filter((row) => row.event === 'reserved').length,
    initialValidationFailures: judges.filter((row) => row.event === 'failed').length,
    modelActivity: 'inactive; no model calls by renderer',
    reportRenderedAt: new Date().toISOString(),
    modelCallsByRenderer: 0,
    ...(continuation ? { technicalContinuation: continuation } : {}),
  };
  provenance.totalAttempts = provenance.generationAttempts + provenance.judgeAttempts;
  const evaluation = {
    scores,
    rejected,
    stopReason: continuationComplete
      ? null
      : partialReply
        ? 'Stopped at 36/40 attempts. Three complete normal-Qwen assessments plus one partial quality reply; seven reopening labels are missing. All four abliterated assessments remain unattempted. Missing is not zero; no judgments were imputed.'
        : ledger.findLast((row) => row.event === 'stopped')?.error,
  };
  const report = renderRefusalReport({
    arms,
    evaluation,
    provenance,
    observations,
    characterBrief: plan.assessmentContext.characterBrief,
  });
  fs.writeFileSync(path.join(root, `${reportBase}.html`), report.html, { flag: 'wx' });
  fs.writeFileSync(
    path.join(root, `${reportBase}-data.json`),
    JSON.stringify(
      { evaluation, provenance, observations, arms: arms.map(({ snapshot: _snapshot, ...arm }) => arm) },
      null,
      2,
    ),
    { flag: 'wx' },
  );
  return { report: path.join(root, `${reportBase}.html`), ...provenance };
}
if (import.meta.url === pathToFileURL(process.argv[1] || '').href)
  console.log(JSON.stringify(renderSavedRefusal(), null, 2));
