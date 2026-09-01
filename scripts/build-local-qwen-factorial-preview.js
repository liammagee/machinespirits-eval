#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { renderFactorialReport } from '../services/localQwenFactorialReport.js';

function quality(turns) {
  return {
    scores: Object.fromEntries(
      ['overall_quality', 'successful_pedagogy', 'surprise_nonrepetition', 'character_adherence'].map((key) => [
        key,
        { score: 3, reasoning: 'Synthetic fixture; no empirical judgment.' },
      ]),
    ),
    learner_turns: turns.map((_, index) => ({
      turn: index + 1,
      new_move: 'Synthetic fixture',
      semantic_repeat_of: null,
      character_fidelity: 3,
      new_move_is_substantive: index > 0,
      unsupported_evidence_assertion: false,
      accepted_objection_reopened: false,
      evidence_reasoning: 'Synthetic fixture; no public-evidence claim.',
    })),
    tutor_turns: turns.map((_, index) => ({
      turn: index + 1,
      unsupported_evidence_assertion: false,
      evidence_reasoning: 'Synthetic fixture; no public-evidence claim.',
    })),
    measurement_indeterminate: false,
    indeterminate_reason: '',
    strengths: [],
    limitations: [],
    overall_assessment: 'Synthetic fixture only.',
  };
}

export function buildSyntheticPreview(outFile) {
  const turns = Array.from({ length: 8 }, (_, index) => ({
    turn: index + 1,
    learner: `Synthetic learner turn ${index + 1}; this is layout text, not model output.`,
    tutor: `Synthetic tutor turn ${index + 1}; this is layout text, not model output.`,
  }));
  const arms = ['normal', 'abliterated'].flatMap((variant) =>
    ['direct', 'ego_superego'].map((mode, index) => ({
      id: `${variant === 'normal' ? 'N' : 'A'}${index}`,
      variant,
      mode,
      opening: 'Synthetic opening for visual QA.',
      snapshot: { turns },
      wallTimeMs: 1000,
      repetition: { meanLexicalSurpriseAfterOpening: 0.5, distinct2: 0.5 },
      technical: {
        learnerMechanism: { medianLatencyMs: 100 },
        learnerFinal: { medianLatencyMs: 100, meanEndToEndOutputTokensPerSecond: 2 },
        tutor: { totalLatencyMs: 200 },
        guardedTutorTurns: 0,
        promptAuditRecoveries: 0,
      },
    })),
  );
  const dimensions = { synthetic_dimension: { score: 3, reasoning: 'Synthetic fixture.' } };
  const scores = arms.flatMap((arm) => [
    {
      arm: arm.id,
      kind: 'tutor',
      scored: { overall: 50 },
      raw: { turns: turns.map((_, index) => ({ turn_index: index, scores: dimensions })) },
    },
    {
      arm: arm.id,
      kind: 'learner',
      scored: { overall: 50 },
      raw: { turns: turns.map((_, index) => ({ learner_turn_index: index, scores: dimensions })) },
    },
    { arm: arm.id, kind: 'dialogue', scored: { overall: 50 }, raw: { scores: dimensions } },
    { arm: arm.id, kind: 'quality', scored: { overall: 50 }, raw: quality(turns) },
  ]);
  const rendered = renderFactorialReport({
    arms,
    evaluation: { scores },
    mock: true,
    provenance: { purpose: 'visual QA only', modelCalls: 0 },
  });
  fs.writeFileSync(outFile, rendered.html, { flag: 'wx' });
  return outFile;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  if (!process.argv[2]) throw new Error('output HTML path required');
  console.log(buildSyntheticPreview(path.resolve(process.argv[2])));
}
