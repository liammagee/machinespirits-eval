#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { scoreTutorStubResistanceRecoverySemanticCorpusV3 } from '../services/tutorStubResistanceRecoverySemanticAdjudicationV3.js';
import { validateTutorStubResistanceRecoverySemanticResponse } from '../services/tutorStubResistanceRecoverySemanticAdjudicationV2.js';
import {
  buildTutorStubResistanceRecoverySemanticBlindedValidationCases,
  tutorStubResistanceRecoverySemanticOpaqueCaseId,
} from '../services/tutorStubResistanceRecoverySemanticValidation.js';
import { loadTutorStubResistanceRecoverySemanticValidationV3 } from '../services/tutorStubResistanceRecoverySemanticValidationV3.js';

const SOURCE_FIELDS = Object.freeze([
  'trigger',
  'intervention',
  'prior_post_trigger',
  'intervening_tutor',
  'current_learner',
]);
const IMPLEMENTATION_PATH = 'scripts/analyze-tutor-stub-resistance-recovery-offset-cleaning.js';

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])]),
    );
  }
  return value;
}

function sha256(value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(String(value));
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function canonicalSha256(value) {
  return sha256(JSON.stringify(canonical(value)));
}

function json(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function exact(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function publicPacket(corpusCase) {
  return Object.fromEntries(SOURCE_FIELDS.map((field) => [field, corpusCase[field]]));
}

function withoutOffsets(record) {
  const copy = structuredClone(record);
  for (const span of copy?.judgment?.evidence_spans || []) {
    delete span.start_utf16;
    delete span.end_utf16;
  }
  return copy;
}

export function correctTutorStubResistanceRecoveryOffsetsV3({ record, publicPacket: packet }) {
  if (!record) return { record: null, corrections: [], issues: [] };
  const corrected = structuredClone(record);
  const corrections = [];
  const issues = [];
  for (const [index, span] of (corrected?.judgment?.evidence_spans || []).entries()) {
    const source = packet?.[span.source_id];
    if (typeof source !== 'string' || typeof span.text !== 'string' || !span.text) {
      issues.push(`span ${index} lacks a cited public source or quote text`);
      continue;
    }
    const start = source.indexOf(span.text);
    if (start < 0 || start !== source.lastIndexOf(span.text)) {
      issues.push(`span ${index} quote is not a unique exact match in cited source ${span.source_id}`);
      continue;
    }
    const end = start + span.text.length;
    corrections.push({
      span_index: index,
      source_id: span.source_id,
      text_sha256: sha256(span.text),
      old_start_utf16: span.start_utf16,
      old_end_utf16: span.end_utf16,
      new_start_utf16: start,
      new_end_utf16: end,
      changed: span.start_utf16 !== start || span.end_utf16 !== end,
    });
    span.start_utf16 = start;
    span.end_utf16 = end;
  }
  if (!exact(withoutOffsets(record), withoutOffsets(corrected))) {
    issues.push('correction changed a field other than numeric offsets');
  }
  return { record: corrected, corrections, issues };
}

function sourceFiles(root) {
  return {
    plan: path.join(root, 'plan.json'),
    seal: path.join(root, 'seal.json'),
    report: path.join(root, 'report.json'),
    cases: path.join(root, 'cases'),
  };
}

function verifySealedSource(root, loaded) {
  const files = sourceFiles(root);
  for (const file of Object.values(files)) {
    if (!fs.existsSync(file)) throw new Error(`sealed source is missing ${file}`);
  }
  const plan = json(files.plan);
  const seal = json(files.seal);
  const report = json(files.report);
  if (plan.plan_sha256 !== seal.plan_sha256 || plan.plan_sha256 !== report.plan_sha256) {
    throw new Error('source plan binding disagrees across plan, seal, and report');
  }
  if (canonicalSha256(seal) !== report.seal_sha256) throw new Error('source report seal digest does not reproduce');
  if (report.instrument_registration_sha256 !== loaded.instrumentSha256) {
    throw new Error('source report instrument binding differs from the frozen V3 registration');
  }
  if (report.heldout_corpus_sha256 !== loaded.corpusSha256) {
    throw new Error('source report corpus binding differs from the frozen V3 heldout');
  }
  const caseIds = Object.keys(seal.case_checkpoint_sha256 || {}).sort();
  if (caseIds.length !== loaded.corpus.cases.length) throw new Error('source seal does not contain every case');
  const checkpointFiles = {};
  for (const caseId of caseIds) {
    const file = path.join(files.cases, caseId, 'checkpoint.json');
    const checkpoint = json(file);
    if (canonicalSha256(checkpoint) !== seal.case_checkpoint_sha256[caseId]) {
      throw new Error(`source checkpoint digest does not reproduce for ${caseId}`);
    }
    checkpointFiles[caseId] = { file, checkpoint };
  }
  return {
    plan,
    seal,
    report,
    checkpointFiles,
    hashes: Object.fromEntries(['plan', 'seal', 'report'].map((name) => [name, sha256(fs.readFileSync(files[name]))])),
  };
}

export function buildTutorStubResistanceRecoveryOffsetCleanedV3Derivative({ sourceRoot }) {
  const loaded = loadTutorStubResistanceRecoverySemanticValidationV3();
  const source = verifySealedSource(sourceRoot, loaded);
  const blinded = buildTutorStubResistanceRecoverySemanticBlindedValidationCases(loaded.corpus.cases);
  const responsePairs = {};
  const correctedCases = [];
  const scoredCases = [];
  const validationByJudge = Object.fromEntries(
    loaded.instrument.measurement.judges.map((judge) => [
      judge.id,
      {
        records_present: 0,
        valid: 0,
        invalid_or_missing: 0,
        valid_high_confidence_determinate: 0,
        valid_medium_confidence_determinate: 0,
        issue_counts: {},
      },
    ]),
  );
  let records = 0;
  let quotes = 0;
  let changedOffsets = 0;
  const issues = [];

  for (const blindedCase of blinded) {
    const corpusCase = loaded.corpus.cases.find(
      (candidate) => tutorStubResistanceRecoverySemanticOpaqueCaseId(candidate) === blindedCase.case_id,
    );
    if (!corpusCase) throw new Error(`cannot join opaque case ${blindedCase.case_id}`);
    const checkpointEntry = source.checkpointFiles[blindedCase.case_id];
    if (!checkpointEntry) throw new Error(`source checkpoint is absent for ${blindedCase.case_id}`);
    const packet = publicPacket(corpusCase);
    const correctedJudges = {};
    responsePairs[blindedCase.case_id] = {};
    for (const stored of checkpointEntry.checkpoint.judge_results || []) {
      const corrected = correctTutorStubResistanceRecoveryOffsetsV3({ record: stored.record, publicPacket: packet });
      if (stored.record) records += 1;
      quotes += corrected.corrections.length;
      changedOffsets += corrected.corrections.filter((row) => row.changed).length;
      issues.push(...corrected.issues.map((issue) => `${blindedCase.case_id}:${stored.judge_id}: ${issue}`));
      correctedJudges[stored.judge_id] = {
        source_checkpoint_sha256: source.seal.case_checkpoint_sha256[blindedCase.case_id],
        source_outcome: stored.outcome,
        source_record_sha256: stored.record ? canonicalSha256(stored.record) : null,
        corrected_record_sha256: corrected.record ? canonicalSha256(corrected.record) : null,
        corrections: corrected.corrections,
        record: corrected.record,
      };
      const validation = validateTutorStubResistanceRecoverySemanticResponse({
        caseId: blindedCase.case_id,
        publicPacket: packet,
        response: corrected.record,
        registration: loaded.instrument,
        prompt: stored.prompt,
      });
      const summary = validationByJudge[stored.judge_id];
      if (corrected.record) summary.records_present += 1;
      if (validation.valid) {
        summary.valid += 1;
        const confidence = corrected.record.judgment.confidence;
        const determinate = corrected.record.judgment.final_recovery !== 'indeterminate';
        if (confidence === 'high' && determinate) summary.valid_high_confidence_determinate += 1;
        if (confidence === 'medium' && determinate) summary.valid_medium_confidence_determinate += 1;
      } else {
        summary.invalid_or_missing += 1;
        for (const issue of validation.issues) summary.issue_counts[issue] = (summary.issue_counts[issue] || 0) + 1;
      }
      responsePairs[blindedCase.case_id][stored.judge_id] = {
        prompt: stored.prompt,
        response: corrected.record,
      };
    }
    correctedCases.push({
      case_id: blindedCase.case_id,
      source_checkpoint_sha256: source.seal.case_checkpoint_sha256[blindedCase.case_id],
      judges: correctedJudges,
    });
    scoredCases.push({ ...corpusCase, case_id: blindedCase.case_id });
  }
  if (issues.length) throw new Error(`offset correction is not total and mechanical: ${issues.join('; ')}`);

  const score = scoreTutorStubResistanceRecoverySemanticCorpusV3({
    corpus: { ...loaded.corpus, cases: scoredCases },
    responsePairs,
    registration: loaded.instrument,
  });
  const gates = loaded.instrument.measurement.validationGates;
  const metrics = score.metrics;
  const gateResults = {
    judgment_validity_rate: {
      observed: metrics.judgment_validity_rate,
      required: gates.minimumJudgmentValidityRate,
      passed: metrics.judgment_validity_rate >= gates.minimumJudgmentValidityRate,
    },
    panels_with_two_eligible_voters: {
      observed: metrics.panels_with_two_eligible_voters,
      required: gates.minimumPanelsWithTwoEligibleVoters,
      passed: metrics.panels_with_two_eligible_voters >= gates.minimumPanelsWithTwoEligibleVoters,
    },
    per_judge_final_recovery_accuracy: Object.fromEntries(
      Object.entries(metrics.per_judge_final_recovery_accuracy).map(([judgeId, observed]) => [
        judgeId,
        {
          observed,
          required: gates.minimumPerJudgeFinalRecoveryAccuracy,
          passed: observed >= gates.minimumPerJudgeFinalRecoveryAccuracy,
        },
      ]),
    ),
    primary_sensitivity: {
      observed: metrics.primary_sensitivity,
      required: gates.minimumPrimarySensitivity,
      passed: metrics.primary_sensitivity >= gates.minimumPrimarySensitivity,
    },
    primary_specificity: {
      observed: metrics.primary_specificity,
      required: gates.minimumPrimarySpecificity,
      passed: metrics.primary_specificity >= gates.minimumPrimarySpecificity,
    },
    primary_exact_accuracy: {
      observed: metrics.primary_exact_accuracy,
      required: gates.minimumPrimaryExactAccuracy,
      passed: metrics.primary_exact_accuracy >= gates.minimumPrimaryExactAccuracy,
    },
    primary_determined_coverage_overall: {
      observed: metrics.primary_determined_coverage_overall,
      required: gates.minimumPrimaryDeterminedCoverageOverall,
      passed: metrics.primary_determined_coverage_overall >= gates.minimumPrimaryDeterminedCoverageOverall,
    },
    primary_determined_coverage_by_stratum: Object.fromEntries(
      Object.entries(metrics.primary_determined_coverage_by_stratum).map(([name, observed]) => [
        name,
        {
          observed,
          required: gates.minimumPrimaryDeterminedCoveragePerStratum,
          passed: observed >= gates.minimumPrimaryDeterminedCoveragePerStratum,
        },
      ]),
    ),
    aggregate_component_accuracy: {
      observed: metrics.aggregate_component_accuracy,
      required: gates.minimumAggregateComponentAccuracy,
      passed: metrics.aggregate_component_accuracy >= gates.minimumAggregateComponentAccuracy,
    },
    aggregate_component_determined_coverage: {
      observed: metrics.aggregate_component_determined_coverage,
      required: gates.minimumAggregateComponentDeterminedCoverage,
      passed: metrics.aggregate_component_determined_coverage >= gates.minimumAggregateComponentDeterminedCoverage,
    },
    action_classification_accuracy: {
      observed: metrics.action_classification_accuracy,
      required: gates.minimumActionClassificationAccuracy,
      passed: metrics.action_classification_accuracy >= gates.minimumActionClassificationAccuracy,
    },
    register_classification_accuracy: {
      observed: metrics.register_classification_accuracy,
      required: gates.minimumRegisterClassificationAccuracy,
      passed: metrics.register_classification_accuracy >= gates.minimumRegisterClassificationAccuracy,
    },
    mean_pairwise_recovery_agreement: {
      observed: metrics.mean_pairwise_recovery_agreement,
      required: gates.minimumMeanPairwiseRecoveryAgreement,
      passed: metrics.mean_pairwise_recovery_agreement >= gates.minimumMeanPairwiseRecoveryAgreement,
    },
    multi_rater_recovery_kappa: {
      observed: metrics.multi_rater_recovery_kappa,
      required: gates.minimumMultiRaterRecoveryKappa,
      passed: metrics.multi_rater_recovery_kappa >= gates.minimumMultiRaterRecoveryKappa,
    },
    prohibited_tool_events: {
      observed: metrics.prohibited_tool_events,
      maximum: gates.maximumProhibitedToolEvents,
      passed: metrics.prohibited_tool_events <= gates.maximumProhibitedToolEvents,
    },
  };
  return {
    schema: 'machinespirits.tutor-stub.resistance-recovery-semantic-offset-cleaned-v3-derivative.v1',
    created_at: new Date().toISOString(),
    implementation: {
      path: IMPLEMENTATION_PATH,
      sha256: sha256(fs.readFileSync(path.resolve(IMPLEMENTATION_PATH))),
    },
    source: {
      root: path.resolve(sourceRoot),
      raw_files_unchanged: true,
      plan_file_sha256: source.hashes.plan,
      seal_file_sha256: source.hashes.seal,
      report_file_sha256: source.hashes.report,
      canonical_plan_sha256: source.plan.plan_sha256,
      canonical_seal_sha256: canonicalSha256(source.seal),
      instrument_registration_path: loaded.instrumentPath,
      instrument_registration_sha256: loaded.instrumentSha256,
      heldout_corpus_path: loaded.registration.heldout.corpusPath,
      heldout_corpus_sha256: loaded.corpusSha256,
    },
    correction_policy: {
      authoritative_anchor: 'unique exact quote text within the model-cited public source',
      changed_fields: ['start_utf16', 'end_utf16'],
      source_id_text_field_judgment_confidence_and_provenance_changed: false,
      semantic_interpretation_used: false,
      outcomes_used_to_choose_or_modify_corrections: false,
      unresolved_or_nonunique_quote_disposition: 'fail_derivative',
      scoring_rule: 'original_frozen_v3_without_field_local_or_medium_confidence_amendments',
      raw_source_mutation: false,
    },
    accounting: {
      cases: correctedCases.length,
      judge_records_present: records,
      quote_spans_reanchored: quotes,
      quote_spans_with_changed_offsets: changedOffsets,
      quote_spans_unresolved: 0,
      model_calls: 0,
      programme_attempt_ledger_change: 0,
    },
    validation_by_judge: validationByJudge,
    gate_results: gateResults,
    corrected_cases: correctedCases,
    score,
    claim_boundary:
      'Post-run deterministic metadata correction scored only under the original frozen V3 rules; not a validation of V4 field-local validity or medium-confidence eligibility, and not confirmation outcome evidence.',
  };
}

function writeCreateOnce(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
}

export function writeTutorStubResistanceRecoveryOffsetCleanedV3Derivative({ sourceRoot, destination }) {
  const result = buildTutorStubResistanceRecoveryOffsetCleanedV3Derivative({ sourceRoot });
  fs.mkdirSync(destination, { recursive: false });
  const records = {
    schema: result.schema,
    source: result.source,
    correction_policy: result.correction_policy,
    accounting: result.accounting,
    validation_by_judge: result.validation_by_judge,
    corrected_cases: result.corrected_cases,
  };
  const report = {
    schema: 'machinespirits.tutor-stub.resistance-recovery-semantic-offset-cleaned-v3-report.v1',
    created_at: result.created_at,
    source: result.source,
    correction_policy: result.correction_policy,
    accounting: result.accounting,
    validation_by_judge: result.validation_by_judge,
    gate_results: result.gate_results,
    corrected_records_sha256: canonicalSha256(records),
    score: result.score,
    claim_boundary: result.claim_boundary,
  };
  writeCreateOnce(path.join(destination, 'corrected-records.json'), records);
  writeCreateOnce(path.join(destination, 'report.json'), report);
  const manifest = {
    schema: 'machinespirits.tutor-stub.resistance-recovery-semantic-offset-cleaned-v3-manifest.v1',
    source: result.source,
    files: {
      corrected_records: {
        path: 'corrected-records.json',
        sha256: sha256(fs.readFileSync(path.join(destination, 'corrected-records.json'))),
      },
      report: { path: 'report.json', sha256: sha256(fs.readFileSync(path.join(destination, 'report.json'))) },
    },
  };
  writeCreateOnce(path.join(destination, 'manifest.json'), manifest);
  return { result, report, manifest };
}

function main() {
  const { values } = parseArgs({
    options: {
      source: { type: 'string' },
      destination: { type: 'string' },
      json: { type: 'boolean', default: false },
    },
  });
  if (!values.source || !values.destination) {
    throw new Error(
      'usage: node scripts/analyze-tutor-stub-resistance-recovery-offset-cleaning.js --source <sealed-v3-root> --destination <new-derivative-root> [--json]',
    );
  }
  const written = writeTutorStubResistanceRecoveryOffsetCleanedV3Derivative({
    sourceRoot: path.resolve(values.source),
    destination: path.resolve(values.destination),
  });
  if (values.json) process.stdout.write(`${JSON.stringify(written.report, null, 2)}\n`);
  else {
    const metrics = written.report.score.metrics;
    process.stdout.write(
      [
        `status: ${written.report.score.status}`,
        `records: ${written.report.accounting.judge_records_present}`,
        `spans: ${written.report.accounting.quote_spans_reanchored}`,
        `changed offsets: ${written.report.accounting.quote_spans_with_changed_offsets}`,
        `validity: ${metrics.judgment_validity_rate}`,
        `primary exact: ${metrics.primary_exact_accuracy}`,
        `register accuracy: ${metrics.register_classification_accuracy}`,
      ].join('\n') + '\n',
    );
  }
}

if (path.resolve(process.argv[1] || '') === path.resolve(new URL(import.meta.url).pathname)) main();
