import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  ADAPTIVE_WARRANT_ANNOTATION_BATCH_RESPONSE_SCHEMA,
  ADAPTIVE_WARRANT_CHALLENGE_SUPPORT_PLAN_SCHEMA,
  assembleAdaptiveWarrantAnnotationResponse,
  prepareAdaptiveWarrantAnnotationBatches,
  validateAdaptiveWarrantAnnotationCorpusPair,
} from '../scripts/prepare-adaptive-warrant-annotation-batches.js';
import { ADAPTIVE_WARRANT_ANNOTATION_SCHEMA } from '../scripts/run-adaptive-warrant-baseline-study.js';

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function fileSha256(filePath) {
  return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function corpus(studyId, count, marker) {
  return {
    schema: ADAPTIVE_WARRANT_ANNOTATION_SCHEMA,
    study_id: studyId,
    blinded: true,
    cases: Array.from({ length: count }, (_, index) => ({
      sample_id: `${marker}-${String(index + 1).padStart(3, '0')}`,
      current_learner_turn: { turn: 1, text: `${marker} public learner evidence ${index + 1}` },
      normative_action_contract:
        index === 0
          ? {
              success_transition: 'renew',
              defeat_transition: 'answer_accountably',
              expiry_transition: 'ground_in_material',
            }
          : null,
    })),
  };
}

function completedCase(overrides = {}) {
  return {
    speech_act: 'other',
    open_obligation_source_turns: [],
    obligation_state: 'none',
    inquiry_state: 'incomplete',
    commitment_transition_warranted: 'no',
    current_candidate_override_required: 'no',
    primary_warrant_basis: 'none',
    recommended_action_family: 'hold',
    note: 'The public decision-time evidence supports holding this commitment.',
    divergence_by_dimension: Object.fromEntries(
      ['conceptual', 'interactional', 'engagement', 'pacing', 'epistemic', 'strategy_exhaustion'].map((dimension) => [
        dimension,
        {
          interpretation: 'aligned',
          magnitude: 'none',
          persistence: 'none',
          note: `The public ${dimension} evidence remains aligned with its norm.`,
        },
      ]),
    ),
    ...overrides,
  };
}

test('reader packets use exact sample-id maps and assembly applies only declared family canonicalization', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'warrant-annotation-collection-'));
  try {
    const corpusPath = path.join(root, 'corpus.json');
    const handbookPath = path.join(root, 'handbook.md');
    writeJson(corpusPath, corpus('natural-study', 4, 'natural'));
    fs.writeFileSync(handbookPath, '# Frozen handbook\n\nUse public evidence only.\n');
    const prepared = prepareAdaptiveWarrantAnnotationBatches({
      corpusPath,
      handbookPath,
      outputDir: path.join(root, 'collection'),
      batchSize: 2,
      corpusRole: 'natural_prevalence',
      preflightMode: true,
    });
    assert.equal(prepared.manifest.readers.length, 2);
    assert.deepEqual(
      prepared.manifest.readers.map((reader) => reader.batches.length),
      [2, 2],
    );
    assert.match(prepared.manifest.inference_boundary, /natural prevalence/u);
    const firstPacket = JSON.parse(fs.readFileSync(prepared.manifest.readers[0].batches[0].packet_path, 'utf8'));
    assert.ok(
      firstPacket.instructions.some((instruction) =>
        instruction.includes('no gate transition or prediction is supplied'),
      ),
    );
    assert.match(
      firstPacket.response_json_schema.$defs.case.properties.primary_warrant_basis.description,
      /Judge the raw public contract independently/u,
    );
    assert.deepEqual(firstPacket.cases_by_sample_id['natural-001'].declared_action_contract_successor_families, [
      'answer_accountably',
      'ground_in_material',
    ]);
    assert.ok(
      firstPacket.instructions.some((instruction) => instruction.includes('response schema enforces this pairing')),
    );
    assert.deepEqual(
      firstPacket.response_json_schema.$defs.case_action_contract_1.properties.recommended_action_family.enum,
      ['answer_accountably', 'ground_in_material'],
    );
    assert.equal(
      firstPacket.response_json_schema.$defs.case_non_action_contract.properties.primary_warrant_basis.enum.includes(
        'action_contract',
      ),
      false,
    );

    const reader = prepared.manifest.readers[0];
    const responseDir = path.join(root, 'responses-a');
    for (const [batchIndex, batch] of reader.batches.entries()) {
      const casesById = Object.fromEntries(
        batch.required_sample_ids.map((sampleId, caseIndex) => [
          sampleId,
          completedCase(batchIndex === 0 && caseIndex === 0 ? { recommended_action_family: 'stage_next_step' } : {}),
        ]),
      );
      writeJson(path.join(responseDir, batch.expected_response_filename), {
        schema: ADAPTIVE_WARRANT_ANNOTATION_BATCH_RESPONSE_SCHEMA,
        reader_id: reader.reader_id,
        batch_id: batch.batch_id,
        study_id: prepared.manifest.study_id,
        corpus_sha256: prepared.manifest.corpus.sha256,
        cases_by_sample_id: casesById,
      });
    }
    const assembled = assembleAdaptiveWarrantAnnotationResponse({
      manifestPath: prepared.manifestPath,
      readerId: 'reader-a',
      annotationRunId: 'independent-run-a',
      responseDir,
      outputPath: path.join(root, 'reader-a.json'),
    });
    assert.equal(assembled.validation.cases, 4);
    assert.equal(assembled.response.cases[0].recommended_action_family, 'hold');
    assert.equal(assembled.audit.edit_count, 1);
    assert.match(assembled.audit.edits[0].reason, /predeclared/u);

    const firstBatch = reader.batches[0];
    const malformedPath = path.join(responseDir, firstBatch.expected_response_filename);
    const malformed = JSON.parse(fs.readFileSync(malformedPath, 'utf8'));
    delete malformed.cases_by_sample_id[firstBatch.required_sample_ids[0]];
    writeJson(malformedPath, malformed);
    assert.throws(
      () =>
        assembleAdaptiveWarrantAnnotationResponse({
          manifestPath: prepared.manifestPath,
          readerId: 'reader-a',
          annotationRunId: 'independent-run-a-2',
          responseDir,
          outputPath: path.join(root, 'reader-a-invalid.json'),
        }),
      /exactly its required sample-id keys/u,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('V4 response validation rejects placeholder notes before consensus scoring', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'warrant-annotation-notes-'));
  try {
    const corpusPath = path.join(root, 'corpus.json');
    const handbookPath = path.join(root, 'handbook.md');
    writeJson(corpusPath, corpus('notes-study', 1, 'notes'));
    fs.writeFileSync(handbookPath, '# Frozen handbook\n');
    const prepared = prepareAdaptiveWarrantAnnotationBatches({
      corpusPath,
      handbookPath,
      outputDir: path.join(root, 'collection'),
      batchSize: 1,
      corpusRole: 'natural_prevalence',
      preflightMode: true,
    });
    const batch = prepared.manifest.readers[0].batches[0];
    const responseDir = path.join(root, 'responses');
    writeJson(path.join(responseDir, batch.expected_response_filename), {
      schema: ADAPTIVE_WARRANT_ANNOTATION_BATCH_RESPONSE_SCHEMA,
      reader_id: 'reader-a',
      batch_id: batch.batch_id,
      study_id: prepared.manifest.study_id,
      corpus_sha256: prepared.manifest.corpus.sha256,
      cases_by_sample_id: { [batch.required_sample_ids[0]]: completedCase({ note: 'Too short.' }) },
    });
    assert.throws(
      () =>
        assembleAdaptiveWarrantAnnotationResponse({
          manifestPath: prepared.manifestPath,
          readerId: 'reader-a',
          annotationRunId: 'independent-run-a',
          responseDir,
          outputPath: path.join(root, 'reader-a.json'),
        }),
      /at least 24 characters/u,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('natural gate and targeted diagnostic corpora remain separate without pooling scores', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'warrant-annotation-pair-'));
  try {
    const handbookPath = path.join(root, 'handbook.md');
    fs.writeFileSync(handbookPath, '# Shared frozen calibration handbook\n');
    const naturalPath = path.join(root, 'natural.json');
    const challengePath = path.join(root, 'challenge.json');
    const naturalCorpus = corpus('natural-study', 4, 'natural');
    const challengeCorpus = corpus('challenge-study', 12, 'challenge');
    writeJson(naturalPath, naturalCorpus);
    writeJson(challengePath, challengeCorpus);
    const natural = prepareAdaptiveWarrantAnnotationBatches({
      corpusPath: naturalPath,
      handbookPath,
      outputDir: path.join(root, 'natural-collection'),
      corpusRole: 'natural_prevalence',
      preflightMode: true,
    });

    const challengeIds = challengeCorpus.cases.map((row) => row.sample_id);
    const supportPlanPath = path.join(root, 'challenge-support.private.json');
    const first = (count) => challengeIds.slice(0, count);
    writeJson(supportPlanPath, {
      schema: ADAPTIVE_WARRANT_CHALLENGE_SUPPORT_PLAN_SCHEMA,
      study_id: challengeCorpus.study_id,
      corpus_sha256: fileSha256(challengePath),
      strata: {
        tutor_directed_public_result_request: first(8),
        learner_proposed_test: first(8),
        obligation_persistence: first(8),
        obligation_resolution: first(6),
        inquiry_complete: first(8),
        inquiry_incomplete: first(12),
        divergence_conceptual_nonaligned: first(2),
        divergence_interactional_nonaligned: first(2),
        divergence_engagement_nonaligned: first(2),
        divergence_pacing_nonaligned: first(2),
        divergence_epistemic_nonaligned: first(2),
        divergence_strategy_exhaustion_nonaligned: first(2),
      },
    });
    const challenge = prepareAdaptiveWarrantAnnotationBatches({
      corpusPath: challengePath,
      handbookPath,
      outputDir: path.join(root, 'challenge-collection'),
      corpusRole: 'targeted_challenge',
      supportPlanPath,
    });
    const pair = validateAdaptiveWarrantAnnotationCorpusPair({
      naturalManifestPath: natural.manifestPath,
      challengeManifestPath: challenge.manifestPath,
    });
    assert.equal(pair.natural.cases, 4);
    assert.equal(pair.challenge.cases, 12);
    assert.equal(pair.challenge.support_counts.obligation_resolution, 6);
    assert.match(pair.inference_boundaries.natural_prevalence, /pass\/fail gate only to a representative natural/u);
    assert.match(pair.inference_boundaries.targeted_challenge, /Diagnostic only/u);
    assert.match(pair.inference_boundaries.combined_gate, /Forbidden/u);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
